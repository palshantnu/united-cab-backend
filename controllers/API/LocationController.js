const { Driver, VehicleType,Ride } = require('../../models');
const { Op } = require('sequelize');
const geolib = require('geolib');

const LocationUtils = require('./locationUtils.js');

class LocationController {
    static activeWatchers = new Map();

    static getNearbyDrivers = async (req, res) => {
        try {
            const { latitude, longitude, userId } = req.query;

            if (!latitude || !longitude) {
                return res.status(400).json({ error: 'Latitude and longitude are required' });
            }
            const nearbyDrivers = await LocationUtils.findNearbyDrivers(latitude, longitude);
            
            if (userId) {
                this.startLiveUpdates(req.app.get('io'), userId, parseFloat(latitude), parseFloat(longitude));
            }

            res.json({ drivers: nearbyDrivers });
         } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Failed to fetch nearby drivers' });
         }
    };

    static startLiveUpdates = (io, userId, userLat, userLng) => {
        if (this.activeWatchers.has(userId)) {
            clearInterval(this.activeWatchers.get(userId));
        }
        const intervalId = setInterval(async () => {
            try {
                const nearbyDrivers = await LocationUtils.findNearbyDrivers(userLat, userLng);
                io.to(`user_${userId}`).emit('liveDriverUpdates', nearbyDrivers);
              } catch (error) {
                console.error('Live update error:', error);
            }
        }, 2000);

        this.activeWatchers.set(userId, intervalId);
    };

    static updateLocation = async (req, res) => {
        try {
            const { driver_id, lat, lng, isDriver } = req.body;

            if (!driver_id || !lat || !lng) {
                return res.status(400).json({ error: 'Missing required fields' });
            }

            if (isDriver) {
                await Driver.update(
                    {
                        driver_latitude: lat,
                        driver_longitude: lng
                    },
                    { where: { id: driver_id } }
                );
            }
            res.json({ success: true });
         } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Failed to update location' });
        }
    };

    static driverupdateLocation = async (req, res) => {
        try {
            const { driver_id, lat, lng, ride_id } = req.body;

            if (!driver_id || !lat || !lng || !ride_id) {
            return res.status(400).json({ error: "Missing required fields" });
            }

            const ride = await Ride.findOne({
                where: { id: parseInt(ride_id, 10) }, 
                attributes: ["id", "driver_id", "status"]
            });

            if (!ride) {
            return res.status(404).json({ error: "Ride not found" });
            }

            if (ride.driver_id !== parseInt(driver_id)) {
             return res.status(403).json({ error: "You are not assigned to this ride" });
            }

            // if (ride.status !== "ongoing" && ride.status !== "accepted") {
            // return res.status(400).json({ error: "Ride is not active" });
            // }

            await Driver.update(
            { driver_latitude: lat, driver_longitude: lng },
            { where: { id: driver_id } }
            );

            const io = req.app.get("io");

            io.to(`ride_${ride_id}`).emit("driverLiveLocation", {
                ride_id,
                driver_id,
                lat,
                lng,
                updatedAt: new Date()
            });

            return res.json({
            success: true,
            message: "Driver location updated successfully",
            data: { driver_id, lat, lng }
            });

        } catch (error) {
            console.error("❌ Error updating driver location:", error);
            return res.status(500).json({ error: "Failed to update location" });
        }
    };

    static driversendlocation = async (req, res) => {
     try {

            const { driver_id, lat, lng } = req.body;

            if (!driver_id || !lat || !lng) {
                return res.status(400).json({
                    success: false,
                    message: "driver_id, lat and lng are required"
                });
            }

            const driver = await Driver.findOne({
                where: { id: driver_id }
            });

            if (!driver) {
                return res.status(404).json({
                    success: false,
                    message: "Driver not found"
                });
            }

            await Driver.update(
                {
                    driver_latitude: lat,
                    driver_longitude: lng
                },
                {
                    where: { id: driver_id }
                }
            );

            // Socket emit
            // const io = req.app.get("io");

            // io.emit("driverLocationUpdated", {
            //     driver_id,
            //     lat,
            //     lng,
            //     updatedAt: new Date()
            // });

            return res.status(200).json({
                success: true,
                message: "Driver current location updated successfully",
                data: {
                    driver_id,
                    lat,
                    lng
                }
            });

        } catch (error) {

            console.error("❌ driversendlocation Error:", error);

            return res.status(500).json({
                success: false,
                message: "Something went wrong"
            });
        }
    };

    static getActiveNearbyDrivers = async (req, res) => {
        try {
            const { latitude, longitude, radius } = req.body;

            if (!latitude || !longitude) {
                return res.status(400).json({ success: false, message: 'latitude and longitude are required' });
            }

            const radiusMeters = radius ? parseInt(radius) : 24140;

            const drivers = await LocationUtils.findNearbyDrivers(
                parseFloat(latitude),
                parseFloat(longitude),
                null,
                radiusMeters
            );

            const vehicleGroups = {};
            drivers.forEach(d => {
                const key = d.vehicleType || 'Unknown';
                if (!vehicleGroups[key]) {
                    vehicleGroups[key] = {
                        vehicle_type: key,
                        vehicle_icon: d.vehicleIcon,
                        count: 0,
                        drivers: []
                    };
                }
                vehicleGroups[key].count++;
                vehicleGroups[key].drivers.push({
                    id: d.id,
                    name: d.name,
                    distance_meters: d.distance,
                    distance_km: (d.distance / 1000).toFixed(2),
                    location: d.location
                });
            });

            return res.json({
                success: true,
                total_active_drivers: drivers.length,
                radius_meters: radiusMeters,
                by_vehicle_type: Object.values(vehicleGroups)
            });

        } catch (error) {
            console.error('❌ getActiveNearbyDrivers error:', error);
            return res.status(500).json({ success: false, message: 'Failed to fetch nearby drivers' });
        }
    };

  static getDriverLiveLocation = async (req, res) => {
  try {
    const { ride_id } = req.params;

    if (!ride_id) {
      return res.status(400).json({ error: "Ride ID is required" });
    }

    const ride = await Ride.findOne({
      where: { id: parseInt(ride_id, 10) },
      attributes: ["id", "driver_id", "status"],
      include: [
        {
          model: Driver,
          as: 'driver',
          attributes: ["id", "driver_latitude", "driver_longitude"]
        }
      ]
    });

    if (!ride) {
      return res.status(404).json({ error: "Ride not found" });
    }

    if (!ride.driver) {
      return res.status(404).json({ error: "Driver not assigned yet" });
    }

    return res.json({
      success: true,
      data: {
        ride_id: ride.id,
        lat: ride.driver.driver_latitude,
        lng: ride.driver.driver_longitude,
        updatedAt: new Date()
      }
    });

  } catch (error) {
    console.error("❌ Error fetching driver location:", error);
    return res.status(500).json({ error: "Failed to fetch driver location" });
  }
};


}

module.exports = LocationController;