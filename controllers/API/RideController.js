const { Ride, Driver, User,DriverDocument,VehicleType,Rating_Reviews,DriverSubscription,DriverTransaction,DriverRechargeRequest,Subscriptions, sequelize} = require('../../models');
const geolib = require('geolib');
const LocationUtils = require('./locationUtils.js');
const path = require('path');
const fs = require('fs');
const { Op } = require("sequelize"); 
const admin = require('../../firebase');
const moment = require("moment-timezone");

class RideController {

static MAX_STOPS = 5;

// Validates stops sent by the user app and stores them in route order
static normalizeStops(stops) {
  if (stops == null) return [];
  if (!Array.isArray(stops)) throw new Error('stops must be an array');
  if (stops.length > RideController.MAX_STOPS) {
    throw new Error(`Maximum ${RideController.MAX_STOPS} stops allowed`);
  }
  return stops.map((stop, i) => {
    const lat = parseFloat(stop?.lat);
    const lng = parseFloat(stop?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new Error(`Invalid location for stop ${i + 1}`);
    }
    return { address: String(stop.address || `Stop ${i + 1}`), lat, lng, status: 'pending' };
  });
}

// Works for model instances (parsed by getter) and raw rows (JSON string, e.g. scheduler)
static stopsPayload(ride) {
  let stops = ride.stops;
  if (typeof stops === 'string') {
    try {
      stops = JSON.parse(stops);
    } catch (e) {
      stops = [];
    }
  }
  return (Array.isArray(stops) ? stops : []).map(({ address, lat, lng, status }) => ({ address, lat, lng, status }));
}

static async getEligibleVehicleIds(requestedVehicleId) {
  const requested = await VehicleType.findByPk(requestedVehicleId, {
    attributes: ['id', 'capacity'],
    raw: true
  });

  if (!requested) return [requestedVehicleId];

  const rows = await VehicleType.findAll({
    where: { capacity: { [Op.gte]: requested.capacity } },
    attributes: ['id'],
    raw: true
  });

  return rows.map(r => r.id);
}

static async getAllowedRideVehicleIds(driverVehicleId) {
  const driverVehicle = await VehicleType.findByPk(driverVehicleId, {
    attributes: ['id', 'capacity'],
    raw: true
  });

  if (!driverVehicle) return [driverVehicleId];

  const rows = await VehicleType.findAll({
    where: { capacity: { [Op.lte]: driverVehicle.capacity } },
    attributes: ['id'],
    raw: true
  });

  return rows.map(r => r.id);
}


static async sendPushNotification(token, title, body, data = {}, ownerType = null, ownerId = null) {
  try {
    if (!token || typeof token !== 'string' || token.trim() === '') {
      console.log("❌ No device token found");
      return;
    }
    const message = {
      token: token,
      notification: {
        title: title,
        body: body,
      },
      data: {
        ...data,
      },
      android: {
        priority: "high",
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
          },
        },
      },
    };
    const response = await admin.messaging().send(message);
    console.log("✅ Firebase response:", response);
    return response;

  } catch (error) {
    const invalidTokenCodes = [
      'messaging/registration-token-not-registered',
      'messaging/invalid-registration-token',
      'messaging/third-party-auth-error',
    ];
    if (invalidTokenCodes.includes(error?.errorInfo?.code)) {
      console.warn(`⚠️ Invalid device token detected, clearing from DB. Owner: ${ownerType} ${ownerId}`);
      try {
        if (ownerType === 'user' && ownerId) {
          await User.update({ devicetoken: null }, { where: { id: ownerId } });
        } else if (ownerType === 'driver' && ownerId) {
          await Driver.update({ devicetoken: null }, { where: { id: ownerId } });
        }
      } catch (dbErr) {
        console.error("❌ Failed to clear invalid token:", dbErr.message);
      }
    } else {
      console.error("🔥 Firebase notification error code:", error?.errorInfo?.code || error?.code);
      console.error("🔥 Firebase notification error msg:", error?.message);
    }
  }
}
static async sendStatusNotifyToUser (status, userToken, rideId, userId = null){
  const notify = RideController.getStatusNotification(status);
  if (notify) {
    await RideController.sendPushNotification(
      userToken,
      notify.title,
      notify.body,
      { rideId: rideId.toString(), status },
      'user',
      userId
    );
  }
};

static getStatusNotification(status) {
  switch (status) {
    case 'accepted':
      return { title: 'Ride Accepted 🚕', body: 'Driver has accepted your ride.' };
    case 'arrived':
      return { title: 'Driver Arrived 📍', body: 'Driver has arrived at pickup location.' };
    case 'started':
      return { title: 'Ride Started ▶️', body: 'Your ride has started.' };
    case 'rideend':
      return { title: 'Ride Ended 🏁', body: 'Ride ended successfully.' };
    case 'completed':
      return { title: 'Ride Completed ✅', body: 'Thank you for riding with us.' };
    case 'cancelled':
      return { title: 'Ride Cancelled ❌', body: 'Ride cancelled by driver.' };
    default:
      return null;
  }
}

static updateRideStatus = async (req, res) => {
  try {
    const { driverId, rideId, status, otp, stopIndex } = req.body;
    const ride = await Ride.findByPk(rideId, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email', 'phone', 'country_code', 'devicetoken']
        },    
        {
        model: Driver,
        as: 'driver',
        attributes: ['id', 'name', 'phone', 'country_code']
      }
      ],
    });

    if (!ride) {
      return res.status(404).json({ error: 'Ride not found' });
    }
    const io = req.app.get('io');
    const user = await User.findByPk(ride.user_id, {
      attributes: ['devicetoken']
    });

    if (status === 'accepted') {
      if (!['pending', 'searching'].includes(ride.status)) {
        return res.status(400).json({ error: 'Ride already accepted or cancelled' });
      }
      const driver = await Driver.findByPk(driverId, {
        include: [{
          model: VehicleType,
          attributes: ['type_name','vehicle_logo']
        }]
      });
      if (!driver) {
        return res.status(404).json({ error: 'Driver not found' });
      }
      ride.driver_id = driverId;
      ride.status = 'accepted';
      await ride.save();
      await ride.reload({
        include: [
          { model: User, as: 'user' },
          { model: Driver, as: 'driver' }
        ]
      });
      await Driver.update({ status: '2' }, { where: { id: driverId } });
      const distance = geolib.getDistance(
        { latitude: parseFloat(ride.pickup_lat), longitude: parseFloat(ride.pickup_lng) },
        { latitude: parseFloat(driver.driver_latitude), longitude: parseFloat(driver.driver_longitude) }
      );
      const driverData = {
        id: driver.id,
        name: driver.name,
        phone: driver.phone,
        vehicleType: driver.VehicleType?.type_name || '',
        vehicleIcon: driver.VehicleType?.vehicle_logo || '',
        distance: distance,
        location: {
          lat: driver.driver_latitude,
          lng: driver.driver_longitude
        }
      };
      io.to(`ride_${rideId}`).emit('rideStatusUpdate', { status: ride });
      io.to(`user_${ride.user_id}`).emit('driverAssigned', {
        rideId,
        driver: driverData
      });
      io.emit('rideUnavailable', { rideId });
      io.to(`driver_${driverId}`).emit('startSharingLocation', { 
        rideId,
        userId: ride.user_id
      });
      await RideController.sendStatusNotifyToUser('accepted', user?.devicetoken, ride.id, ride.user_id);
      await RideController.sendPushNotification(
        driver?.devicetoken,
        'Ride Accepted',
        'You accepted a ride.',
        { rideId: ride.id.toString(), status },
        'driver',
        driverId
      );

      return res.json({ 
        success: true,
        status: 'accepted',
        driver: driverData,
        rideId: ride.id
      });

    } else if (status === 'arrived') {
      ride.status = 'arrived';
      await ride.save();

      io.to(`ride_${rideId}`).emit('rideStatusUpdate', { status: ride });
      await RideController.sendStatusNotifyToUser('arrived', user?.devicetoken, ride.id, ride.user_id);
      return res.json({ success: true, status: 'arrived' });
    } else if (status === 'start') {
      if (!otp || otp !== ride.otp) {
        return res.status(400).json({ error: 'Invalid or missing OTP' });
      }
      ride.status = 'started';
      ride.otp = null;
      await ride.save();
      io.to(`ride_${rideId}`).emit('rideStatusUpdate', { status: ride });
      await RideController.sendStatusNotifyToUser('started', user?.devicetoken, ride.id, ride.user_id);
      return res.json({ success: true, status: 'started' });
    } else if (status === 'rideend') {
            ride.status = 'rideend';
            ride.completed_at = new Date();
            const scheduledAt = new Date(ride.scheduled_at);
            const completedAt = ride.completed_at;
            const diffMs = completedAt - scheduledAt;
            const durationMin = Math.floor(diffMs / 60000);
            ride.duration_min = durationMin;
            await ride.save();
            const distanceKm = ride.distance_km;
            const finalFare = ride.final_fare;
            const currentDate = new Date();
            const subscription = await DriverSubscription.findOne({
                where: {
                driver_id: driverId,
                status: 'active',
                start_date: { [Op.lte]: currentDate },
                end_date: { [Op.gte]: currentDate }
                },
                order: [['end_date', 'DESC']]
            });
            if (subscription && subscription.mile >= distanceKm) {
                subscription.mile -= distanceKm;
                await subscription.save();
                await DriverTransaction.create({
                 driver_id: driverId,
                 ride_id: ride.id,
                 amount: 0,
                 type: 'subscription',
                 distance: distanceKm,
                 description: `Deducted ${distanceKm}mile from subscription`,
                });

            } else {
                        const driver = await Driver.findByPk(driverId);
                        if (driver.wallet < finalFare) {
                        return res.status(400).json({ error: 'Insufficient wallet balance' });
                        }
                        driver.wallet -= finalFare;
                        await driver.save();
                        await DriverTransaction.create({
                            driver_id: driverId,
                            ride_id: ride.id,
                            amount: finalFare,
                            type: 'wallet',
                            description: `Deducted € ${finalFare} from wallet`,
                        });
                    }
        io.to(`ride_${rideId}`).emit('rideStatusUpdate', { status: ride });
        await RideController.sendStatusNotifyToUser('rideend', user?.devicetoken, ride.id, ride.user_id);
        return res.json({ success: true, status: 'rideend' });
    }else if (status === 'completed') {
      ride.status = 'completed';
      await ride.save();
      await Driver.update({ status: '1' }, { where: { id: driverId } });
      io.to(`ride_${rideId}`).emit('rideStatusUpdate', { status: ride });
      await RideController.sendStatusNotifyToUser('completed', user?.devicetoken, ride.id, ride.user_id);
      return res.json({ success: true, status: 'completed' });
    } else if (status === 'cancelled') {
      ride.status = 'cancelled';
      ride.cancelled_by = 'driver';
      await ride.save();
      await Driver.update({ status: '1' }, { where: { id: driverId } });
      io.to(`ride_${rideId}`).emit('rideStatusUpdate', { status: ride });
      await RideController.sendStatusNotifyToUser('cancelled', user?.devicetoken, ride.id, ride.user_id);
      return res.json({ success: true, status: 'cancelled' });
    } else if (status === 'stop_arrived' || status === 'stop_completed') {
      if (ride.status !== 'started') {
        return res.status(400).json({ error: 'Ride is not in progress' });
      }
      const stops = ride.stops;
      const index = Number(stopIndex);
      const stop = Number.isInteger(index) ? stops[index] : null;
      if (!stop) {
        return res.status(400).json({ error: 'Invalid stop' });
      }
      if (stops.slice(0, index).some(s => s.status !== 'completed')) {
        return res.status(400).json({ error: 'Please complete previous stops first' });
      }

      if (status === 'stop_arrived') {
        if (stop.status !== 'pending') {
          return res.status(400).json({ error: 'Already arrived at this stop' });
        }
        stop.status = 'arrived';
        stop.arrived_at = new Date();
      } else {
        if (stop.status !== 'arrived') {
          return res.status(400).json({ error: 'Mark arrival at this stop first' });
        }
        stop.status = 'completed';
        stop.completed_at = new Date();
      }
      ride.stops = stops;
      await ride.save();

      io.to(`ride_${rideId}`).emit('rideStatusUpdate', { status: ride });
      if (status === 'stop_arrived') {
        await RideController.sendPushNotification(
          user?.devicetoken,
          `Arrived at Stop ${index + 1} 📍`,
          `Driver has reached ${stop.address}`,
          { rideId: ride.id.toString(), status, stopIndex: String(index) },
          'user',
          ride.user_id
        );
      }
      return res.json({ success: true, status, stopIndex: index, stops: ride.stops });
    } else {
      return res.status(400).json({ error: 'Invalid status provided' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update ride status' });
  }
};

static cancelRideByUser = async (req, res) => {
    try {
        const { rideId, userId } = req.body;

        const ride = await Ride.findByPk(rideId);

        if (!ride) {
            return res.status(404).json({ error: 'Ride not found' });
        }

        if (ride.user_id !== userId) {
            return res.status(403).json({ error: 'Unauthorized to cancel this ride' });
        }

        if (!['pending', 'accepted'].includes(ride.status)) {
            return res.status(400).json({ error: 'Ride cannot be cancelled at this stage' });
        }

        ride.status = 'cancelled';
        ride.cancelled_by = 'user';
        await ride.save();

        const io = req.app.get('io');

        if (ride.driver_id) {
            await Driver.update({ status: '1' }, { where: { id: ride.driver_id } });

            io.to(`driver_${ride.driver_id}`).emit('rideCancelled', {
                rideId: ride.id,
                by: 'user'
            });
        }

        io.to(`ride_${rideId}`).emit('rideStatusUpdate', { status: ride });
        io.to(`user_${userId}`).emit('rideCancelled', {
            rideId: ride.id,
            by: 'user'
        });

        return res.json({ success: true, message: 'Ride cancelled successfully' });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Something went wrong while cancelling the ride' });
    }
};

static getRideStatus = async (req, res) => {
    try {
        const { rideId } = req.params;

        const ride = await Ride.findByPk(rideId, {
            attributes: ['status']
        });

        if (!ride) {
            return res.status(404).json({ success: false, message: 'Ride not found' });
        }

        return res.status(200).json({ success: true, status: ride.status });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

static getRideDetails = async (req, res) => {
    try {
        const { rideId } = req.params;

        const ride = await Ride.findByPk(rideId, {
            attributes: [
                'id',
                'user_id',
                'driver_id',
                'pickup_address',
                'dropoff_address',
                'stops',
                'status',
                'fare_estimate',
                'final_fare',
                'distance_km',
                'duration_min',
                'scheduled_at',
                'completed_at',
                'vehicle_id'
            ],
            include: [
                {
                    model: User,
                    attributes: ['name'], // or 'username' if field is named that
                    as: 'user'
                },
                {
                    model: Driver,
                    attributes: ['name'],
                    as: 'driver'
                },
                {
                    model: VehicleType,
                    attributes: ['type_name'],
                    as: 'vehicle'
                }
            ]
        });

        if (!ride) {
            return res.status(404).json({ success: false, message: 'Ride not found' });
        }

        return res.status(200).json({ success: true, data: ride });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

// static requestRide = async (req, res) => {
//     try {
//         const {
//             userId, pickupLat, pickupLng, dropoffLat, dropoffLng,
//             vehicleTypeId, dropoff_address, pickup_address,
//             fare_estimate, final_fare, distance_km
//         } = req.body;

//         const user = await User.findByPk(userId);
//         if (!user) {
//             return res.status(404).json({ success: false, message: 'User not found' });
//         }

//         const existingRide = await Ride.findOne({
//             where: {
//                 user_id: userId,
//                 status: ['arrived', 'accepted', 'started']
//             }
//         });

//         if (existingRide) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'You already have an active ride. Please complete or cancel it first.'
//             });
//         }

//         const now = new Date();
//         const otp = Math.floor(1000 + Math.random() * 9000).toString();

//         const ride = await Ride.create({
//             user_id: userId,
//             pickup_lat: pickupLat,
//             pickup_lng: pickupLng,
//             dropoff_lat: dropoffLat,
//             dropoff_lng: dropoffLng,
//             vehicle_id: vehicleTypeId,
//             dropoff_address,
//             pickup_address,
//             status: 'pending',
//             scheduled_at: now,
//             otp,
//             fare_estimate,
//             final_fare,
//             distance_km
//         });

//         const allNearbyDrivers = await LocationUtils.findNearbyDrivers(pickupLat, pickupLng, vehicleTypeId);
//         console.log("348",allNearbyDrivers);
//         const currentDate = new Date().toISOString().split('T')[0];

//         const eligibleDrivers = [];

//         for (const driver of allNearbyDrivers) {
//          // 1. Check active subscription using DriverSubscription model
//          console.log("318",driver);
//          const subscription = await DriverSubscription.findOne({
//             where: {
//                 driver_id: driver.id,
//                 status: 'active',
//                 start_date: { [Op.lte]: currentDate },
//                 end_date: { [Op.gte]: currentDate },
//             },
//             order: [['end_date', 'DESC']],
//          });

//         let hasValidSubscription = false;

//         if (subscription && subscription.mile >= distance_km) {
//             hasValidSubscription = true;
//         }

//         // 2. If no valid subscription, check wallet using Driver model
//         let hasSufficientWallet = false;

//         if (!hasValidSubscription) {
//             const walletDriver = await Driver.findOne({
//                 where: { id: driver.id },
//                 attributes: ['wallet'],
//             });

//             if (walletDriver && walletDriver.wallet >= final_fare) {
//                 hasSufficientWallet = true;
//             }
//         }

//         // 3. Add driver if eligible
//         if (hasValidSubscription || hasSufficientWallet) {
//             eligibleDrivers.push(driver);
//         }
//     }


//         // Send ride request only to eligible drivers
//         const io = req.app.get('io');
//         eligibleDrivers.forEach(driver => {
//             io.to(`driver_${driver.id}`).emit('newRideRequest', {
//                 rideId: ride.id,
//                 pickupLocation: { lat: pickupLat, lng: pickupLng, address: pickup_address },
//                 dropoffLocation: { lat: dropoffLat, lng: dropoffLng, address: dropoff_address },
//                 vehicleTypeId,
//                 userId
//             });
//         });

//         return res.status(201).json({
//             success: true,
//             rideId: ride.id,
//             otp, // Remove in production
//             eligibleDrivers
//         });

//     } catch (error) {
//         console.error(error);
//         return res.status(400).json({
//             success: false,
//             message: error.message,
//         });
//     }
// };
//-----------------------------------------------|old-code|------------------------------------------------------
// static getPendingRequests = async (req, res) => {
//     try {
//         const { driverId } = req.body; 
//         const driver = await Driver.findByPk(driverId);
//         if (!driver) {
//             return res.status(404).json({ success: false, message: "Driver not found" });
//         }
//         if (driver.online_status != 1 || driver.status != '1') {
//             return res.status(200).json({ message: "Driver is offline" });
//         }
//         const nowTs = new Date();
//         const pendingRides = await Ride.findAll({
//             where: {
//                 status: { [Op.in]: ['pending', 'searching'] },
//                 [Op.or]: [
//                     { booking_type: 'instant' },
//                     {
//                         booking_type: 'scheduled',
//                         scheduled_at: { [Op.lte]: new Date(nowTs.getTime() + 30 * 60 * 1000) }
//                     }
//                 ]
//             },
//             order: [['scheduled_at', 'DESC']],
//             include: [
//                 { model: User, attributes: ['id', 'name', 'phone'] }
//             ]
//         });
//         const eligibleRequests = [];
//         for (const ride of pendingRides) {
//             const isNearby = await LocationUtils.findNearbyDrivers(
//                 ride.pickup_lat, ride.pickup_lng, ride.vehicle_id
//             );
//             // if (!isNearby) continue;
//             if (!isNearby.some(d => d.id === driver.id)) continue;

//             const currentDate = new Date().toISOString().split('T')[0];
//             const subscription = await DriverSubscription.findOne({
//                 where: {
//                     driver_id: driverId,
//                     status: 'active',
//                     start_date: { [Op.lte]: currentDate },
//                     end_date: { [Op.gte]: currentDate },
//                 },
//                 order: [['end_date', 'DESC']],
//             });

//             let hasValidSubscription = false;
//             if (subscription && subscription.mile >= ride.distance_km) {
//                 hasValidSubscription = true;
//             }

//             let hasSufficientWallet = false;
//             if (!hasValidSubscription) {
//                 if (driver.wallet >= ride.final_fare) {
//                     hasSufficientWallet = true;
//                 }
//             }

//             if (hasValidSubscription || hasSufficientWallet) {
//                 eligibleRequests.push({
//                     rideId: ride.id,
//                     pickupLocation: {
//                         lat: parseFloat(ride.pickup_lat),
//                         lng: parseFloat(ride.pickup_lng),
//                         address: ride.pickup_address
//                     },
//                     dropoffLocation: {
//                         lat: parseFloat(ride.dropoff_lat),
//                         lng: parseFloat(ride.dropoff_lng),
//                         address: ride.dropoff_address
//                     },
//                     vehicleTypeId: ride.vehicle_id,
//                     userId: ride.user_id,
//                     name: ride.User?.name,
//                     phone: ride.User?.phone,
//                     booking_type: ride.booking_type,
//                     scheduled_at: ride.scheduled_at,
//                     distance_miles: ride.distance_km ? Number(Number(ride.distance_km).toFixed(1)) : 0,
//                     fare_estimate: ride.fare_estimate,
//                     final_fare: ride.final_fare
//                 });
//             }
//         }
//         if (eligibleRequests.length > 0) {
//           return res.status(200).json(eligibleRequests[0]); 
//         } else {
//           return res.status(200).json({ message: "No pending rides found" });
//         }
//     } catch (error) {
//         console.error(error);
//         return res.status(500).json({ success: false, message: error.message });
//     }
// };
// ---------------------------------------------------|new-code|--------------------------------------------------
static getPendingRequests = async (req, res) => {
    try {
        const { driverId } = req.body;
        const driver = await Driver.findByPk(driverId);
        if (!driver) {
            return res.status(404).json({ success: false, message: "Driver not found" });
        }
        if (driver.online_status != 1 || driver.status != '1') {
            return res.status(200).json({ message: "Driver is offline" });
        }

        const allowedVehicleIds = await RideController.getAllowedRideVehicleIds(driver.vehicle_id);

        const nowTs = new Date();
        const pendingRides = await Ride.findAll({
            where: {
                status: { [Op.in]: ['pending', 'searching'] },
                vehicle_id: { [Op.in]: allowedVehicleIds },
                [Op.or]: [
                    { booking_type: 'instant' },
                    {
                        booking_type: 'scheduled',
                        scheduled_at: { [Op.lte]: new Date(nowTs.getTime() + 30 * 60 * 1000) }
                    }
                ]
            },
            order: [['scheduled_at', 'DESC']],
            include: [
                 { model: User, as: 'user', attributes: ['id', 'name', 'phone'] }
            ]
        });

        const eligibleRequests = [];
        const currentDate = new Date().toISOString().split('T')[0];

        for (const ride of pendingRides) {
            const isNearby = await LocationUtils.findNearbyDrivers(
                ride.pickup_lat, ride.pickup_lng, driver.vehicle_id
            );
            if (!isNearby.some(d => d.id === driver.id)) continue;

            const subscription = await DriverSubscription.findOne({
                where: {
                    driver_id: driverId,
                    status: 'active',
                    start_date: { [Op.lte]: currentDate },
                    end_date: { [Op.gte]: currentDate },
                },
                order: [['end_date', 'DESC']],
            });

            let hasValidSubscription = false;
            if (subscription && subscription.mile >= ride.distance_km) {
                hasValidSubscription = true;
            }

            let hasSufficientWallet = false;
            if (!hasValidSubscription && driver.wallet >= ride.final_fare) {
                hasSufficientWallet = true;
            }

            if (hasValidSubscription || hasSufficientWallet) {
                eligibleRequests.push({
                    rideId: ride.id,
                    pickupLocation: {
                        lat: parseFloat(ride.pickup_lat),
                        lng: parseFloat(ride.pickup_lng),
                        address: ride.pickup_address
                    },
                    dropoffLocation: {
                        lat: parseFloat(ride.dropoff_lat),
                        lng: parseFloat(ride.dropoff_lng),
                        address: ride.dropoff_address
                    },
                    vehicleTypeId: ride.vehicle_id,
                    userId: ride.user_id,
                    name: ride.user?.name,
                    phone: ride.user?.phone,
                    booking_type: ride.booking_type,
                    scheduled_at: ride.scheduled_at,
                    distance_miles: ride.distance_km ? Number(Number(ride.distance_km).toFixed(1)) : 0,
                    stops: RideController.stopsPayload(ride),
                    fare_estimate: ride.fare_estimate,
                    final_fare: ride.final_fare
                });
            }
        }

        if (eligibleRequests.length > 0) {
            return res.status(200).json(eligibleRequests[0]);
        } else {
            return res.status(200).json({ message: "No pending rides found" });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// static requestRide = async (req, res) => {
//     try {
//         const {
//             userId, pickupLat, pickupLng, dropoffLat, dropoffLng,
//             vehicleTypeId, dropoff_address, pickup_address,
//             fare_estimate, final_fare, distance_km,booking_type, scheduled_at
//         } = req.body;

//         const user = await User.findByPk(userId);
//         if (!user) {
//             return res.status(404).json({ success: false, message: 'User not found' });
//         }
//         const existingRide = await Ride.findOne({
//             where: {
//                 user_id: userId,
//                 status: ['arrived', 'accepted', 'started']
//             }
//         });

//         if (existingRide) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'You already have an active ride. Please complete or cancel it first.'
//             });
//         }

//         const now = new Date();
//         const otp = Math.floor(1000 + Math.random() * 9000).toString();
//         const ride = await Ride.create({
//             user_id: userId,
//             pickup_lat: pickupLat,
//             pickup_lng: pickupLng,
//             dropoff_lat: dropoffLat,
//             dropoff_lng: dropoffLng,
//             vehicle_id: vehicleTypeId,
//             dropoff_address,
//             pickup_address,
//             status: 'pending',
//             booking_type: booking_type || 'instant',
//             scheduled_at: booking_type === 'scheduled' ? scheduled_at : now,
//             scheduled_at: now,
//             otp,
//             fare_estimate,
//             final_fare,
//             distance_km
//         });

//         if (booking_type === 'scheduled') {
//             return res.status(201).json({
//                 success: true,
//                 message: 'Ride scheduled successfully',
//                 rideId: ride.id,
//                 booking_type: 'scheduled'
//             });
//         }

//         const allNearbyDrivers = await LocationUtils.findNearbyDrivers(pickupLat, pickupLng, vehicleTypeId);
//         const currentDate = new Date().toISOString().split('T')[0];
//         const eligibleDrivers = [];

//         for (const driver of allNearbyDrivers) {
//             const subscription = await DriverSubscription.findOne({
//                 where: {
//                     driver_id: driver.id,
//                     status: 'active',
//                     start_date: { [Op.lte]: currentDate },
//                     end_date: { [Op.gte]: currentDate },
//                 },
//                 order: [['end_date', 'DESC']],
//             });
    
//             let hasValidSubscription = false;

//             if (subscription && subscription.mile >= distance_km) {
//                 hasValidSubscription = true;
//             }

//             let hasSufficientWallet = false;
//             if (!hasValidSubscription) {
//                 const walletDriver = await Driver.findOne({
//                     where: { id: driver.id },
//                     attributes: ['wallet', 'devicetoken'],
//                 });

//                 if (walletDriver && walletDriver.wallet >= final_fare) {
//                     hasSufficientWallet = true;
//                 }
//                 driver.devicetoken = walletDriver?.devicetoken || null;
//               } else {
//                 const walletDriver = await Driver.findOne({
//                     where: { id: driver.id },
//                     attributes: ['devicetoken'],
//                 });
//                 driver.devicetoken = walletDriver?.devicetoken || null;
//             }

//             if (hasValidSubscription || hasSufficientWallet) {
//                 eligibleDrivers.push(driver);
//             }
//         }
//         const io = req.app.get('io');
//          eligibleDrivers.forEach(driver => {
//             io.to(`driver_${driver.id}`).emit('newRideRequest', {
//                 rideId: ride.id,
//                 pickupLocation: { lat: pickupLat, lng: pickupLng, address: pickup_address },
//                 dropoffLocation: { lat: dropoffLat, lng: dropoffLng, address: dropoff_address },
//                 vehicleTypeId,
//                 userId
//             });
//          });
//          for (const driver of eligibleDrivers) {
//           if (driver.devicetoken) {
//            try {
//              const message = {
//               token: driver.devicetoken,
//                 notification: {
//                     title: "New Ride Request",
//                     body: `Pickup: ${pickup_address} → Drop: ${dropoff_address}`
//                 },
//                 android: {
//                   notification: {
//                     sound: "notification"
//                   }
//                 },
//                 apns: {
//                     payload: {
//                         aps: {
//                             sound: "notification.wav"
//                         }
//                     }
//                 }
//             };

//           await admin.messaging().send(message);

//         } catch (err) {
//           console.error(
//               `Failed to send notification to driver ${driver.id}:`,
//               err.message
//           );
//         }
        
//         }
//           // if (driver.devicetoken) {
//           //               try {
//           //                   await admin.messaging().send({
//           //                       notification: {
//           //                           title: "New Ride Request",
//           //                           body: `Pickup: ${pickup_address} → Drop: ${dropoff_address}`
//           //                       },
//           //                       token: driver.devicetoken
//           //                   });
//           //               } catch (err) {
//           //                   console.error(`Failed to send notification to driver ${driver.id}:`, err.message);
//           //               }
//           // }
//         }

//         return res.status(201).json({
//             success: true,
//             rideId: ride.id,
//             otp,
//             eligibleDrivers
//         });

//     } catch (error) {
//         console.error(error);
//         return res.status(400).json({
//             success: false,
//             message: error.message,
//         });
//     }
// };


// static notifyEligibleDrivers = async (ride, io) => {
//     try {
//         const allNearbyDrivers = await LocationUtils.findNearbyDrivers(
//             ride.pickup_lat,
//             ride.pickup_lng,
//             ride.vehicle_id
//         );

//         const currentDate = new Date().toISOString().split('T')[0];
//         const eligibleDrivers = [];
//         const userdata = await User.findByPk(ride.user_id, {
//             attributes: ['name','phone']
//         });
        
//         for (const driver of allNearbyDrivers) {
//             try {
//                 const subscription = await DriverSubscription.findOne({
//                     where: {
//                         driver_id: driver.id,
//                         status: 'active',
//                         start_date: { [Op.lte]: currentDate },
//                         end_date: { [Op.gte]: currentDate },
//                     },
//                     order: [['end_date', 'DESC']],
//                 });

//                 const walletDriver = await Driver.findByPk(driver.id, {
//                     attributes: ['wallet', 'devicetoken']
//                 });

//                 let isEligible = false;

//                 if (subscription && subscription.mile >= ride.distance_km) {
//                     isEligible = true;
//                 } else if (walletDriver && walletDriver.wallet >= ride.final_fare) {
//                     isEligible = true;
//                 }

//                 console.log(`   ↳ Driver ${driver.id}: distance=${driver.distance}m | sub=${subscription ? `active(mile=${subscription.mile})` : 'none'} | wallet=${walletDriver?.wallet} | needFare=${ride.final_fare} | eligible=${isEligible}`);

//                 if (!isEligible) {
//                     console.log(`   ❌ Driver ${driver.id} NOT eligible → skipped (sub mile < distance AND wallet < fare)`);
//                     continue;
//                 }

//                 /* ================= SOCKET (SAFE) ================= */
//                 if (io) {
//                     try {
//                         const ridePayload = {
//                             rideId: ride.id,
//                             pickupLocation: { lat: ride.pickup_lat, lng: ride.pickup_lng, address: ride.pickup_address },
//                             dropoffLocation: { lat: ride.dropoff_lat, lng: ride.dropoff_lng, address: ride.dropoff_address },
//                             vehicleTypeId: ride.vehicle_id,
//                             userId: ride.user_id,
//                             name: userdata?.name || "User",
//                             phone: userdata?.phone || "",
//                             booking_type: ride.booking_type,
//                             scheduled_at: ride.scheduled_at,
//                             distance_miles: ride.distance_km ? Number(Number(ride.distance_km).toFixed(1)) : 0,
//                             fare_estimate: ride.fare_estimate,
//                             final_fare: ride.final_fare
//                         };
//                         console.log(`📤 [Driver ${driver.id}] newRideRequest payload:`, JSON.stringify(ridePayload));
//                         io.to(`driver_${driver.id}`).emit('newRideRequest', ridePayload);
//                     } catch (err) {
//                         console.error(`❌ Socket Error (Driver ${driver.id}):`, err.message);
//                     }
//                 } else {
//                     console.log(`⚠️ IO missing → socket skipped (Driver ${driver.id})`);
//                 }
//                 /* ================= FCM PUSH ================= */
//                 if (walletDriver?.devicetoken) {
//                     try {
//                         console.log("🔥 Sending push to:", walletDriver.devicetoken);

//                         await RideController.sendPushNotification(
//                             walletDriver.devicetoken,
//                             "New Ride Request",
//                             `Pickup: ${ride.pickup_address} → Drop: ${ride.dropoff_address}`,
//                             {
//                                 rideId: ride.id.toString(),
//                                 booking_type: ride.booking_type ? String(ride.booking_type) : "",
//                                 scheduled_at: ride.scheduled_at ? String(ride.scheduled_at) : "",
//                                 distance_km: ride.distance_km != null ? String(ride.distance_km) : "",
//                                 distance_miles: ride.distance_km ? String(Number(ride.distance_km).toFixed(1)) : "",
//                                 fare_estimate: ride.fare_estimate != null ? String(ride.fare_estimate) : "",
//                                 final_fare: ride.final_fare != null ? String(ride.final_fare) : ""
//                             },
//                             'driver',
//                             driver.id
//                         );

//                         console.log(`✅ Push Sent (Driver ${driver.id})`);

//                     } catch (err) {
//                         console.error(`❌ FCM Error (Driver ${driver.id}):`, err.message);
//                     }
//                 } else {
//                     console.log(`⚠️ No device token (Driver ${driver.id})`);
//                 }

//                 eligibleDrivers.push(driver);

//             } catch (innerError) {
//                 console.error(`❌ Driver Loop Error (Driver ${driver?.id}):`, innerError.message);
//             }
//         }

//         return eligibleDrivers;

//     } catch (error) {
//         console.error("❌ Notification Error:", error.message);
//         return [];
//     }
// };

static notifyEligibleDrivers = async (ride, io) => {
    try {
        const eligibleVehicleIds = await RideController.getEligibleVehicleIds(ride.vehicle_id);
        console.log(`🚗 Ride ${ride.id} (vehicle ${ride.vehicle_id}) → eligible vehicles:`, eligibleVehicleIds);

        let allNearbyDrivers = [];
        for (const vId of eligibleVehicleIds) {
            const drivers = await LocationUtils.findNearbyDrivers(
                ride.pickup_lat,
                ride.pickup_lng,
                vId
            );
            if (drivers && drivers.length) {
                allNearbyDrivers = allNearbyDrivers.concat(drivers);
            }
        }

        allNearbyDrivers = allNearbyDrivers.filter(
            (d, i, arr) => arr.findIndex(x => x.id === d.id) === i
        );

        const currentDate = new Date().toISOString().split('T')[0];
        const eligibleDrivers = [];
        const userdata = await User.findByPk(ride.user_id, {
            attributes: ['name', 'phone']
        });

        for (const driver of allNearbyDrivers) {
            try {
                const subscription = await DriverSubscription.findOne({
                    where: {
                        driver_id: driver.id,
                        status: 'active',
                        start_date: { [Op.lte]: currentDate },
                        end_date: { [Op.gte]: currentDate },
                    },
                    order: [['end_date', 'DESC']],
                });

                const walletDriver = await Driver.findByPk(driver.id, {
                    attributes: ['wallet', 'devicetoken']
                });

                let isEligible = false;

                if (subscription && subscription.mile >= ride.distance_km) {
                    isEligible = true;
                } else if (walletDriver && walletDriver.wallet >= ride.final_fare) {
                    isEligible = true;
                }

                console.log(`   ↳ Driver ${driver.id}: sub=${subscription ? `active(mile=${subscription.mile})` : 'none'} | wallet=${walletDriver?.wallet} | needFare=${ride.final_fare} | eligible=${isEligible}`);

                if (!isEligible) {
                    console.log(`   ❌ Driver ${driver.id} NOT eligible → skipped`);
                    continue;
                }

                if (io) {
                    try {
                        const ridePayload = {
                            rideId: ride.id,
                            pickupLocation: { lat: ride.pickup_lat, lng: ride.pickup_lng, address: ride.pickup_address },
                            dropoffLocation: { lat: ride.dropoff_lat, lng: ride.dropoff_lng, address: ride.dropoff_address },
                            vehicleTypeId: ride.vehicle_id,
                            userId: ride.user_id,
                            name: userdata?.name || "User",
                            phone: userdata?.phone || "",
                            booking_type: ride.booking_type,
                            scheduled_at: ride.scheduled_at,
                            distance_miles: ride.distance_km ? Number(Number(ride.distance_km).toFixed(1)) : 0,
                            stops: RideController.stopsPayload(ride),
                            fare_estimate: ride.fare_estimate,
                            final_fare: ride.final_fare
                        };
                        io.to(`driver_${driver.id}`).emit('newRideRequest', ridePayload);
                    } catch (err) {
                        console.error(`❌ Socket Error (Driver ${driver.id}):`, err.message);
                    }
                }

                if (walletDriver?.devicetoken) {
                    try {
                        await RideController.sendPushNotification(
                            walletDriver.devicetoken,
                            "New Ride Request",
                            `Pickup: ${ride.pickup_address} → Drop: ${ride.dropoff_address}`,
                            {
                                rideId: ride.id.toString(),
                                booking_type: ride.booking_type ? String(ride.booking_type) : "",
                                scheduled_at: ride.scheduled_at ? String(ride.scheduled_at) : "",
                                distance_km: ride.distance_km != null ? String(ride.distance_km) : "",
                                distance_miles: ride.distance_km ? String(Number(ride.distance_km).toFixed(1)) : "",
                                stops_count: String(RideController.stopsPayload(ride).length),
                                fare_estimate: ride.fare_estimate != null ? String(ride.fare_estimate) : "",
                                final_fare: ride.final_fare != null ? String(ride.final_fare) : ""
                            },
                            'driver',
                            driver.id
                        );
                    } catch (err) {
                        console.error(`❌ FCM Error (Driver ${driver.id}):`, err.message);
                    }
                }

                eligibleDrivers.push(driver);

            } catch (innerError) {
                console.error(`❌ Driver Loop Error (Driver ${driver?.id}):`, innerError.message);
            }
        }

        return eligibleDrivers;

    } catch (error) {
        console.error("❌ Notification Error:", error.message);
        return [];
    }
};

static requestRide = async (req, res) => {
  try {
        const {
            userId, pickupLat, pickupLng, dropoffLat, dropoffLng,
            vehicleTypeId, dropoff_address, pickup_address,
            fare_estimate, final_fare, distance_km,
            booking_type, scheduled_at, timezone, stops
        } = req.body;

        let rideStops;
        try {
            rideStops = RideController.normalizeStops(stops);
        } catch (err) {
            return res.status(400).json({ success: false, message: err.message });
        }

        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const existingRide = await Ride.findOne({
            where: { user_id: userId, status: ['arrived', 'accepted', 'started'] }
        });

        if (existingRide) {
            return res.status(400).json({ success: false, message: 'Active ride exists.' });
        }
        const isScheduled = booking_type === 'scheduled';
        let finalScheduledTime;

        if (isScheduled) {
            const userTimezone = timezone || 'Asia/Kolkata';
            finalScheduledTime = moment
                .tz(scheduled_at, userTimezone)
                .utc()
                .format("YYYY-MM-DD HH:mm:ss");
        } else {
            finalScheduledTime = moment.utc().format("YYYY-MM-DD HH:mm:ss");
        }

        const ride = await Ride.create({
            user_id: userId,
            pickup_lat: pickupLat,
            pickup_lng: pickupLng,
            dropoff_lat: dropoffLat,
            dropoff_lng: dropoffLng,
            vehicle_id: vehicleTypeId,
            dropoff_address,
            pickup_address,
            stops: rideStops,
            status: 'pending',
            booking_type: booking_type || 'instant',
            scheduled_at: finalScheduledTime,
            timezone: timezone || 'Asia/Kolkata',
            otp: Math.floor(1000 + Math.random() * 9000).toString(),
            fare_estimate,
            final_fare,
            distance_km
        });

        if (isScheduled) {
            return res.status(201).json({
                success: true,
                message: 'Ride Scheduled Successfully',
                rideId: ride.id
            });
        }

        const io = req.app.get('io');
        const eligibleDrivers = await this.notifyEligibleDrivers(ride, io);
        return res.status(201).json({
            success: true,
            rideId: ride.id,
            eligibleDrivers
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// static acceptRide = async (req, res) => {
//     try {
//         const { driverId, rideId } = req.body;
//         const ride = await Ride.findByPk(rideId);
//         if (!ride) {
//             return res.status(404).json({ error: 'Ride not found' });
//         }

//         if (ride.status !== 'pending') {
//             return res.status(400).json({ error: 'Ride already accepted or cancelled' });
//         }

//         const driver = await Driver.findByPk(driverId, {
//             include: [{
//                 model: VehicleType,
//                 attributes: ['type_name', 'vehicle_logo']
//             }]
//         });

//         if (!driver) {
//             return res.status(404).json({ error: 'Driver not found' });
//         }

//         ride.driver_id = driverId;
//         ride.status = 'accepted';
//         await ride.save();
//         await Driver.update({ status: '2' }, { where: { id: driverId } });
//         const io = req.app.get('io');
//         const distance = geolib.getDistance(
//             { latitude: parseFloat(ride.pickup_lat), longitude: parseFloat(ride.pickup_lng) },
//             { latitude: parseFloat(driver.driver_latitude), longitude: parseFloat(driver.driver_longitude) }
//         );

//         const driverData = {
//             id: driver.id,
//             name: driver.name,
//             phone: driver.phone,
//             vehicleType: driver.VehicleType?.type_name || '',
//             vehicleIcon: driver.VehicleType?.vehicle_logo || '',
//             distance: distance,
//             location: {
//                 lat: driver.driver_latitude,
//                 lng: driver.driver_longitude
//             }
//         };
//         io.to(`ride_${rideId}`).emit('rideStatusUpdate', { status: ride});
//          console.log(`📢 Ride status updated and emitted via socket for rideId: ${ride}`);

//         io.to(`user_${ride.user_id}`).emit('driverAssigned', {
//             rideId,
//             driver: driverData
//         });

//         io.emit('rideUnavailable', { rideId });

//         io.to(`driver_${driverId}`).emit('startSharingLocation', { 
//             rideId,
//             userId: ride.user_id
//         });

//         res.json({ 
//             success: true,
//             driver: driverData,
//             rideId: ride.id
//         });
//     } catch (error) {
//         console.error(error);
//         res.status(500).json({ error: 'Failed to accept ride' });
//     }
// }
static acceptRide = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { driverId, rideId } = req.body;
        const [updatedRows] = await Ride.update(
            { driver_id: driverId, status: 'accepted' },
            {
                where: {
                    id: rideId,
                    status: { [Op.in]: ['pending', 'searching'] }
                },
                transaction: t
            }
        );

        if (updatedRows === 0) {
            await t.rollback();
            return res.status(400).json({ error: 'Ride already accepted or cancelled' });
        }
        
        const ride = await Ride.findByPk(rideId, { transaction: t });

        const driver = await Driver.findByPk(driverId, {
            include: [{
                model: VehicleType,
                attributes: ['type_name', 'vehicle_logo']
            }],
            transaction: t
        });

        if (!driver) {
            await t.rollback();
            return res.status(404).json({ error: 'Driver not found' });
        }

        await Driver.update(
            { status: 'busy' },
            { where: { id: driverId }, transaction: t }
        );

        await t.commit();

        const io = req.app.get('io');

        const distance = geolib.getDistance(
            { latitude: parseFloat(ride.pickup_lat), longitude: parseFloat(ride.pickup_lng) },
            { latitude: parseFloat(driver.driver_latitude), longitude: parseFloat(driver.driver_longitude) }
        );

        const driverData = {
            id: driver.id,
            name: driver.name,
            phone: driver.phone,
            vehicleType: driver.VehicleType?.type_name || '',
            vehicleIcon: driver.VehicleType?.vehicle_logo || '',
            distance,
            location: {
                lat: driver.driver_latitude,
                lng: driver.driver_longitude
            }
        };

        io.to(`user_${ride.user_id}`).emit('driverAssigned', {
            rideId,
            driver: driverData
        });

        io.emit('rideUnavailable', { rideId });

        io.to(`ride_${rideId}`).emit('rideStatusUpdate', {
            rideId,
            status: 'accepted'
        });

        io.to(`driver_${driverId}`).emit('startSharingLocation', {
            rideId,
            userId: ride.user_id
        });

        console.log(`✅ Ride ${rideId} accepted by Driver ${driverId}`);

        return res.json({
            success: true,
            rideId,
            driver: driverData
        });

    } catch (error) {
        await t.rollback();
        console.error("❌ Accept Ride Error:", error);
        return res.status(500).json({ error: 'Failed to accept ride' });
    }
};

static cancelRide = async (req, res) => {
    try {
        const { rideId, userId, reason } = req.body;

        const ride = await Ride.findByPk(rideId);
        if (!ride) {
            return res.status(404).json({ error: 'Ride not found' });
        }

        // Update ride with cancelled status and reason
        ride.status = 'cancelled';
        ride.cancel_reason = reason;
        await ride.save();

        // Update driver status if assigned
        if (ride.driver_id) {
            // Assuming "available" corresponds to integer 1
            await Driver.update({ status: 1 }, { where: { id: ride.driver_id } });
        }

        const io = req.app.get('io');
        
        // Emit ride status update event to ride room
        io.to(`ride_${rideId}`).emit('rideStatusUpdate', { status: ride });
        console.log(`📢 Ride status updated and emitted via socket for rideId: ${ride}`);

        // Emit an event specifically for ride cancellation to the ride room
        io.to(`ride_${rideId}`).emit('rideCancelled', {
            rideId,
            cancelledBy: userId,
            reason
        });

        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to cancel ride' });
    }
};

static completeRide = async (req, res) => {
try {
            
            const {rideId, driverId } = req.body;

            const ride = await Ride.findByPk(rideId);
            if (!ride) {
                return res.status(404).json({ error: 'Ride not found' });
            }

            ride.status = 'completed';
            await ride.save();

            await Driver.update({ status: 'available' }, { where: { id: driverId } });

            const io = req.app.get('io');
            io.to(`ride_${rideId}`).emit('rideCompleted', {
                rideId
            });

            res.json({ success: true });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Failed to complete ride' });
        }
}
static ride_history = async (req, res) => {
   try {
            const { driver_id } = req.body;
            const whereCondition = driver_id ? { driver_id } : {};
            
            const bookings = await Ride.findAll({
                where: whereCondition,
                include: [
                    {
                        model: Driver,
                        as: 'driver',
                        attributes: ['id', 'name'],
                        include: [
                            { model: DriverDocument, attributes: ['vehicle_number'] },
                            { model: VehicleType, attributes: ['type_name'] }
                        ]
                    },
                    { model: User, attributes: ['name', 'email'] },
                    { 
                        model: Rating_Reviews,
                        attributes: ['rated_by_driver', 'rated_by_user', 'reviewed_by_user', 'reviewed_by_driver']
                    }
                ]
            });
            res.status(200).json({
                message: "Booking History successfully",
                bookings: bookings, // Adjust based on your model
              });
    
        } catch (error) {
            console.error("Booking list error:", error);
            res.status(500).send("Error fetching bookings");
        }
    }
static driver_profile = async (req, res) => {
   try {
        const { driver_id } = req.body;

        if (!driver_id) {
            return res.status(400).json({ message: "driver_id is required" });
        }

        const driver = await Driver.findOne({
            where: { id: driver_id },
            attributes: ['id', 'name', 'phone','vehicle_id','vehicle_number','vehicle_model','rating','status','online_status','phone_varified','gender','profile_photo'], // Add more attributes as needed
            include: [
                {
                    model: DriverDocument,
                    attributes: ['document_type', 'document_file']
                },
                {
                    model: VehicleType,
                    attributes: ['type_name','description','minimum_km','minimum_fare','fare_per_km','vehicle_image','vehicle_logo','platform_fee']
                }
                // {
                //     model: Ride,
                //     attributes: ['id', 'pickup_location', 'drop_location', 'status', 'createdAt'],
                //     include: [
                //         {
                //             model: User,
                //             attributes: ['name', 'email']
                //         },
                //         {
                //             model: Rating_Reviews,
                //             attributes: ['rated_by_user', 'reviewed_by_user']
                //         }
                //     ]
                // }
            ]
        });

        if (!driver) {
            return res.status(404).json({ message: "Driver not found" });
        }

        res.status(200).json({
            message: "Driver profile fetched successfully",
            profile: driver
        });

    } catch (error) {
        console.error("Driver profile error:", error);
        res.status(500).send("Error fetching driver profile");
    }
}
static driver_profile_update = async (req, res) => {
  try {
    const {
      driver_id,
      name,
      gender,
      phone,
      vehicle_id,
      vehicle_number,
      vehicle_model
    } = req.body;

    if (!driver_id) {
      return res.status(400).json({ message: "driver_id is required" });
    }

    // Check if vehicle exists
    if (vehicle_id) {
      const vehicle = await VehicleType.findByPk(vehicle_id);
      if (!vehicle) {
        return res.status(400).json({ message: "Invalid vehicle_id. Vehicle not found." });
      }
    }

    const driver = await Driver.findByPk(driver_id);
    if (!driver) {
      return res.status(404).json({ message: "Driver not found" });
    }

    // Check for phone conflict
    if (phone) {
      const phoneExists = await Driver.findOne({
        where: {
          phone,
          id: { [Op.ne]: driver_id }
        }
      });
      if (phoneExists) {
        return res.status(409).json({ message: "Phone number already in use by another driver" });
      }
    }

    // Update provided fields
    if (name) driver.name = name;
    if (gender) driver.gender = gender;
    if (phone) driver.phone = phone;
    if (vehicle_id) driver.vehicle_id = vehicle_id;
    if (vehicle_number) driver.vehicle_number = vehicle_number;
    if (vehicle_model) driver.vehicle_model = vehicle_model;

    // Handle profile photo upload
    if (req.file) {
      const oldPhotoPath = driver.profile_photo ? path.join(__dirname, '..', 'public', driver.profile_photo) : null;

      driver.profile_photo = `/upload/driver_profiles/${req.file.filename}`;

      if (oldPhotoPath && fs.existsSync(oldPhotoPath)) {
        fs.unlink(oldPhotoPath, (err) => {
          if (err) {
            console.error("Failed to delete old profile photo:", err);
          }
        });
      }
    }

    await driver.save();

    // Return updated profile
    const updatedProfile = await Driver.findOne({
      where: { id: driver_id },
      attributes: [
        'id', 'name', 'phone', 'vehicle_id', 'vehicle_number',
        'vehicle_model', 'rating', 'phone_varified', 'profile_photo'
      ],
      include: [
        {
          model: VehicleType,
          attributes: ['type_name', 'description', 'minimum_km', 'minimum_fare', 'fare_per_km', 'vehicle_image', 'vehicle_logo', 'platform_fee']
        }
      ]
    });

    res.status(200).json({
      message: "Driver profile updated successfully",
      profile: updatedProfile
    });

  } catch (error) {
    console.error("Driver profile update error:", error);
    res.status(500).json({ message: "Error updating driver profile" });
  }
};
static driver_status_update = async (req, res) => {
  try {
    const { driver_id, online_status } = req.body; // ✅ Correct destructuring

    if (!driver_id) {
      return res.status(400).json({ message: "driver_id is required" });
    }

    const driver = await Driver.findByPk(driver_id);

    if (!driver) {
      return res.status(404).json({ message: "Driver not found" });
    }

    if (online_status !== undefined) {
      driver.online_status = online_status;
    }

    await driver.save();

    res.status(200).json({
      message: "Driver online status updated successfully",
      updated_online_status: driver.online_status,
    });

  } catch (error) {
    console.error("Driver online status update error:", error);
    res.status(500).json({ message: "Error updating driver online status" });
  }
};
static driver_status_get = async (req, res) => {
  try {
    const { driver_id } = req.body;

    if (!driver_id) {
      return res.status(400).json({ message: "driver_id is required" });
    }

    const driver = await Driver.findByPk(driver_id);

    if (!driver) {
      return res.status(404).json({ message: "Driver not found" });
    }

    // Check status text
    const statusText = driver.online_status == 1 ? "Online" : "Offline";

    res.status(200).json({
      message: `Driver is now ${statusText}`,
      driver_id: driver.id,
      online_status: driver.online_status,
    });

  } catch (error) {
    console.error("Driver online status update error:", error);
    res.status(500).json({ message: "Error updating driver online status" });
  }
};
static userride_history = async (req, res) => {
 try {
        const { user_id } = req.body;
        const whereCondition = user_id ? { user_id } : {};
        const bookings = await Ride.findAll({
            where: whereCondition,
            attributes: {
                exclude: ['user_id','driver_id', 'vehicle_id', 'otp'] 
            },
            include: [
                {
                    model: Driver,
                    as: 'driver',
                    attributes: ['id', 'name'],
                    include: [
                        { model: DriverDocument, attributes: ['vehicle_number'] },
                        { model: VehicleType, attributes: ['type_name'] }
                    ]
                },
                {
                    model: User,
                    attributes: ['name', 'email']
                },
                {
                    model: Rating_Reviews,
                    attributes: [
                        'rated_by_driver',
                        'rated_by_user',
                        'reviewed_by_user',
                        'reviewed_by_driver'
                    ]
                }
            ]
        });


        res.status(200).json({
            message: "User ride history fetched successfully",
            bookings: bookings,
        });

    } catch (error) {
        console.error("Ride history fetch error:", error);
        res.status(500).send("Error fetching ride history");
    }
}
static getUserPendingRide = async (req, res) => {
    try {
        const { user_id } = req.body;
        const ride = await Ride.findOne({
            where: {
                user_id: user_id,
                status: { [Op.in]: ['accepted','started','arrived','rideend'] }
            },
            include: [
              {
                model: Driver,
                as: 'driver',
                attributes: ['id', 'name', 'phone','country_code']
              }
            ],
            order: [['id', 'DESC']]
        });

        if (!ride) {
            return res.status(404).json({
                success: false,
                message: 'No pending ride found for user'
            });
        }

        return res.status(200).json({
            success: true,
            ride
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
// --------------------------------------------------|old-code|-----------------------------------------------------------------//

// static getDriverPendingRide = async (req, res) => {
//   try {
//     const { driver_id } = req.body;

//     if (!driver_id) {
//       return res.status(400).json({
//         success: false,
//         message: "driver_id is required"
//       });
//     }

//     const driver = await Driver.findByPk(driver_id, {
//       attributes: ['id', 'vehicle_id'],
//       raw: true
//     });

//     if (!driver) {
//       return res.status(404).json({
//         success: false,
//         message: "Driver not found"
//       });
//     }
    
//     if (driver.online_status != 1 || driver.status != '1') {
//       return res.status(200).json({
//         success: true,
//         ride: null,
//         message: "Driver is offline"
//       });
//     }

//     const now = new Date();
//     const ride = await Ride.findOne({
//       where: {
//         vehicle_id: driver.vehicle_id,
//         status: 'pending',
//         [Op.or]: [
//           { booking_type: 'instant' },
//           {
//             booking_type: 'scheduled',
//             scheduled_at: { [Op.lte]: new Date(now.getTime() + 30 * 60 * 1000) }
//           }
//         ]
//       },
//       order: [['id', 'DESC']]
//     });

//     if (!ride) {
//       return res.status(200).json({
//         success: true,
//         ride: null,
//         message: "No pending ride for this vehicle"
//       });
//     }

//     return res.status(200).json({
//       success: true,
//       ride
//     });

//   } catch (error) {
//     return res.status(500).json({
//       success: false,
//       message: error.message
//     });
//   }
// };

//-----------------------------------------------------|new-code|---------------------------------------------------------------//
 static getDriverPendingRide = async (req, res) => {
  try {
    const { driver_id } = req.body;

    if (!driver_id) {
      return res.status(400).json({
        success: false,
        message: "driver_id is required"
      });
    }

    const driver = await Driver.findByPk(driver_id, {
      attributes: ['id', 'vehicle_id', 'online_status', 'status'],
      raw: true
    });

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found"
      });
    }

    if (driver.online_status != 1 || driver.status != '1') {
      return res.status(200).json({
        success: true,
        ride: null,
        message: "Driver is offline"
      });
    }
    const allowedVehicleIds = await RideController.getAllowedRideVehicleIds(driver.vehicle_id);
    const now = new Date();
    const ride = await Ride.findOne({
      where: {
        vehicle_id: { [Op.in]: allowedVehicleIds },
        status: 'pending',
        [Op.or]: [
          { booking_type: 'instant' },
          {
            booking_type: 'scheduled',
            scheduled_at: { [Op.lte]: new Date(now.getTime() + 30 * 60 * 1000) }
          }
        ]
      },
      order: [['id', 'DESC']]
    });

    if (!ride) {
      return res.status(200).json({
        success: true,
        ride: null,
        message: "No pending ride for this vehicle"
      });
    }

    return res.status(200).json({
      success: true,
      ride
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

static getDriverAcceptedRide = async (req, res) => {
 try {
        const { driver_id } = req.body;
        const ride = await Ride.findOne({
            where: {
                driver_id: driver_id,
                status: { [Op.in]: ['accepted','started','arrived','rideend'] }
            },
            include: [
              {
                model: User,
                as: 'user',
                attributes: ['id', 'name', 'phone', 'email','country_code']
              }
            ],
            order: [['id', 'DESC']]
        });

        if (!ride) {
            return res.status(404).json({
                success: false,
                message: 'No accepted ride found for driver'
            });
        }

        return res.status(200).json({
            success: true,
            ride
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
static giveRideRating = async (req, res) => {
 try {
        const {
            ride_id,
            user_id,
            driver_id,
            rated_by_user,
            rated_by_driver,
            reviewed_by_user,
            reviewed_by_driver
        } = req.body;

        let review = await RideReview.findOne({
            where: { ride_id }
        });

        if (review) {
            // Update if review already exists
            await review.update({
                rated_by_user,
                rated_by_driver,
                reviewed_by_user,
                reviewed_by_driver
            });
        } else {
            // Create new review entry
            review = await RideReview.create({
                ride_id,
                user_id,
                driver_id,
                rated_by_user,
                rated_by_driver,
                reviewed_by_user,
                reviewed_by_driver
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Review submitted successfully',
            review
        });

    } catch (error) {
        console.error("Error in giveRideRating:", error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
static userReviewRide = async (req, res) => {
    try {
        const { ride_id, user_id, rated_by_user, reviewed_by_user } = req.body;

        // Validate required fields
        if (!ride_id || !user_id) {
            return res.status(400).json({
                success: false,
                message: "ride_id and user_id are required"
            });
        }

        // Check if the ride exists and belongs to the user
        const ride = await Ride.findOne({ where: { id: ride_id, user_id } });

        if (!ride) {
            return res.status(404).json({
                success: false,
                message: "Ride not found"
            });
        }

        if (ride.status !== 'completed') {
            return res.status(400).json({
                success: false,
                message: "Review can only be submitted after the ride is completed"
            });
        }

        let review = await Rating_Reviews.findOne({
            where: { ride_id, user_id }
        });

        if (review) {
            await review.update({ rated_by_user, reviewed_by_user });
        } else {
            review = await Rating_Reviews.create({
                ride_id,
                user_id,
                rated_by_user,
                reviewed_by_user
            });
        }

        return res.status(200).json({
            success: true,
            message: 'User review submitted successfully',
            review
        });

    } catch (error) {
        console.error("userReviewRide Error:", error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
static driverReviewRide = async (req, res) => {
  try {
        const { ride_id, driver_id, rated_by_driver, reviewed_by_driver } = req.body;

        if (!ride_id || !driver_id) {
            return res.status(400).json({
                success: false,
                message: "ride_id and driver_id are required"
            });
        }

        const ride = await Ride.findOne({ where: { id: ride_id, driver_id } });

        if (!ride) {
            return res.status(404).json({
                success: false,
                message: "Ride not found or not assigned to this driver"
            });
        }

        // Only allow review if ride is completed
        if (ride.status !== 'completed') {
            return res.status(400).json({
                success: false,
                message: "Review can only be submitted after the ride is completed"
            });
        }

        // Check if driver already reviewed this ride
        let review = await Rating_Reviews.findOne({
            where: { ride_id, driver_id }
        });

        if (review) {
            // Optional: prevent update if only one review allowed
            await review.update({ rated_by_driver, reviewed_by_driver });
        } else {
            review = await Rating_Reviews.create({
                ride_id,
                driver_id,
                rated_by_driver,
                reviewed_by_driver
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Driver review submitted successfully',
            review
        });

    } catch (error) {
        console.error("driverReviewRide Error:", error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
static getDriverTransactions = async (req, res) => {
  const { driverId } = req.body;

  if (!driverId) {
    return res.status(400).json({ success: false, message: 'driverId is required in the request body' });
  }

  try {
        const rawSubscriptions = await DriverSubscription.findAll({
            where: { driver_id: driverId },
            include: [{
                model: Subscriptions,
                as: 'subscription',
                attributes: [['name', 'subscription_name']]
            }],
            attributes: ['id', 'driver_id', 'start_date', 'end_date'],
            order: [['created_at', 'DESC']],
            raw: true
            });

            const subscriptions = rawSubscriptions.map(sub => ({
            id: sub.id,
            driver_id: sub.driver_id,
            start_date: sub.start_date,
            end_date: sub.end_date,
            subscription_name: sub['subscription.subscription_name'] // fix key name
        }));
        const transactions = await DriverTransaction.findAll({
        where: { driver_id: driverId },
        order: [['created_at', 'DESC']]
        });

        const recharges = await DriverRechargeRequest.findAll({
        where: { driver_id: driverId },
        order: [['requested_at', 'DESC']]
        });

        return res.json({
        success: true,
        data: {
            subscriptions,
            transactions,
            recharges
        }
        });

  } catch (error) {
    console.error('Error fetching driver transactions:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

static getWallet = async (req, res) => {
  const { driverId } = req.body; // 👈 body se liya

  if (!driverId) {
    return res.status(400).json({ success: false, message: 'driverId is required in body' });
  }

  try {
    const wallet = await Driver.findOne({ where: { id: driverId } });

    if (!wallet) {
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }

    res.json({ success: true, balance: wallet.wallet });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};



}

module.exports = RideController;