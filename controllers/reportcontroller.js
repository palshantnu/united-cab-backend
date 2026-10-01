const { Op, fn, col, literal } = require('sequelize');
const {
  Ride, User, Driver, VehicleType, Rating_Reviews,
  DriverTransaction, DriverSubscription, Subscriptions, DriverRechargeRequest
} = require('../models/index');
const { getDateRange, dayList, toYmd, money, sendCsv } = require('../services/reportHelpers');

const RIDE_STATUSES = ['searching', 'pending', 'accepted', 'arrived', 'started', 'rideend', 'completed', 'cancelled'];

class reportcontroller {

  // Trip Reports: every ride in the period with status breakdown
  static trip_report = async (req, res) => {
    try {
      const range = getDateRange(req.query);
      const status = RIDE_STATUSES.includes(req.query.status) ? req.query.status : 'all';
      const vehicleId = req.query.vehicle_id ? parseInt(req.query.vehicle_id) : null;

      const where = { created_at: range.where };
      if (status !== 'all') where.status = status;
      if (vehicleId) where.vehicle_id = vehicleId;

      const [rides, vehicles] = await Promise.all([
        Ride.findAll({
          where,
          include: [
            { model: User, as: 'user', attributes: ['id', 'name', 'phone'] },
            { model: Driver, as: 'driver', attributes: ['id', 'name', 'phone'] },
            { model: VehicleType, as: 'vehicle', attributes: ['id', 'type_name'] },
          ],
          order: [['created_at', 'DESC']],
        }),
        VehicleType.findAll({ attributes: ['id', 'type_name'] }),
      ]);

      const byStatus = Object.fromEntries(RIDE_STATUSES.map(s => [s, 0]));
      rides.forEach(r => { byStatus[r.status] = (byStatus[r.status] || 0) + 1; });
      const completed = rides.filter(r => r.status === 'completed');
      const totalFare = completed.reduce((s, r) => s + (parseFloat(r.final_fare) || 0), 0);
      const totalDistance = completed.reduce((s, r) => s + (parseFloat(r.distance_km) || 0), 0);

      const rows = rides.map(r => ({
        id: r.id,
        date: r.created_at,
        user: r.user?.name || '-',
        driver: r.driver?.name || '-',
        vehicle: r.vehicle?.type_name || '-',
        booking_type: r.booking_type || '-',
        pickup: r.pickup_address || '',
        dropoff: r.dropoff_address || '',
        distance: money(r.distance_km),
        fare: money(r.final_fare || r.fare_estimate),
        status: r.status,
        cancelled_by: r.cancelled_by || '',
        cancel_reason: r.cancel_reason || '',
      }));

      if (req.query.export === 'csv') {
        return sendCsv(res, `trip-report-${range.fromStr}-to-${range.toStr}.csv`, [
          { key: 'id', label: 'Ride ID' },
          { key: 'date', label: 'Date' },
          { key: 'user', label: 'User' },
          { key: 'driver', label: 'Driver' },
          { key: 'vehicle', label: 'Vehicle' },
          { key: 'booking_type', label: 'Booking Type' },
          { key: 'pickup', label: 'Pickup' },
          { key: 'dropoff', label: 'Drop-off' },
          { key: 'distance', label: 'Distance' },
          { key: 'fare', label: 'Fare (GBP)' },
          { key: 'status', label: 'Status' },
          { key: 'cancelled_by', label: 'Cancelled By' },
          { key: 'cancel_reason', label: 'Cancel Reason' },
        ], rows);
      }

      res.render('admin/report_trips', {
        range, status, vehicleId, vehicles, rows, byStatus,
        summary: {
          total: rides.length,
          completed: completed.length,
          cancelled: byStatus.cancelled,
          completionRate: rides.length ? Math.round((completed.length / rides.length) * 100) : 0,
          totalFare: money(totalFare),
          avgFare: completed.length ? money(totalFare / completed.length) : 0,
          totalDistance: money(totalDistance),
        },
      });
    } catch (error) {
      console.error('trip_report error:', error);
      res.status(500).send('Something went wrong!');
    }
  };

  // Driver Performance: rides, completion rate, earnings and rating per driver
  static driver_report = async (req, res) => {
    try {
      const range = getDateRange(req.query);

      const [drivers, rideStats, ratingStats] = await Promise.all([
        Driver.findAll({
          attributes: ['id', 'name', 'phone', 'vehicle_number', 'status', 'online_status', 'wallet', 'rating'],
          include: [{ model: VehicleType, attributes: ['type_name'] }],
        }),
        Ride.findAll({
          where: { driver_id: { [Op.ne]: null }, created_at: range.where },
          attributes: [
            'driver_id',
            [fn('COUNT', col('id')), 'total'],
            [fn('SUM', literal("CASE WHEN status = 'completed' THEN 1 ELSE 0 END")), 'completed'],
            [fn('SUM', literal("CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END")), 'cancelled'],
            [fn('SUM', literal("CASE WHEN status = 'cancelled' AND cancelled_by = 'driver' THEN 1 ELSE 0 END")), 'driver_cancelled'],
            [fn('SUM', literal("CASE WHEN status = 'completed' THEN final_fare ELSE 0 END")), 'earnings'],
            [fn('SUM', literal("CASE WHEN status = 'completed' THEN distance_km ELSE 0 END")), 'distance'],
          ],
          group: ['driver_id'],
          raw: true,
        }),
        Rating_Reviews.findAll({
          where: { driver_id: { [Op.ne]: null }, rated_by_user: { [Op.gt]: 0 }, created_at: range.where },
          attributes: ['driver_id', [fn('AVG', col('rated_by_user')), 'avg'], [fn('COUNT', col('id')), 'count']],
          group: ['driver_id'],
          raw: true,
        }),
      ]);

      const statsById = Object.fromEntries(rideStats.map(s => [s.driver_id, s]));
      const ratingById = Object.fromEntries(ratingStats.map(s => [s.driver_id, s]));

      const rows = drivers.map(d => {
        const s = statsById[d.id] || {};
        const r = ratingById[d.id];
        const total = Number(s.total) || 0;
        const completed = Number(s.completed) || 0;
        return {
          id: d.id,
          name: d.name || '-',
          phone: d.phone || '',
          vehicle: d.VehicleType?.type_name || '-',
          vehicle_number: d.vehicle_number || '',
          active: d.status == 1 || d.status == 2,
          total_rides: total,
          completed,
          cancelled: Number(s.cancelled) || 0,
          driver_cancelled: Number(s.driver_cancelled) || 0,
          completion_rate: total ? Math.round((completed / total) * 100) : 0,
          earnings: money(s.earnings),
          distance: money(s.distance),
          rating: r ? Number(parseFloat(r.avg).toFixed(1)) : (d.rating ? Number(d.rating.toFixed(1)) : null),
          rating_count: r ? Number(r.count) : 0,
          wallet: money(d.wallet),
        };
      }).sort((a, b) => b.earnings - a.earnings || b.total_rides - a.total_rides);

      if (req.query.export === 'csv') {
        return sendCsv(res, `driver-performance-${range.fromStr}-to-${range.toStr}.csv`, [
          { key: 'id', label: 'Driver ID' },
          { key: 'name', label: 'Name' },
          { key: 'phone', label: 'Phone' },
          { key: 'vehicle', label: 'Vehicle' },
          { key: 'vehicle_number', label: 'Vehicle No.' },
          { key: 'total_rides', label: 'Total Rides' },
          { key: 'completed', label: 'Completed' },
          { key: 'cancelled', label: 'Cancelled' },
          { key: 'driver_cancelled', label: 'Cancelled by Driver' },
          { key: 'completion_rate', label: 'Completion %' },
          { key: 'earnings', label: 'Earnings (GBP)' },
          { key: 'distance', label: 'Distance' },
          { key: 'rating', label: 'Avg Rating' },
          { key: 'wallet', label: 'Wallet (GBP)' },
        ], rows);
      }

      const active = rows.filter(r => r.total_rides > 0);
      res.render('admin/report_drivers', {
        range, rows,
        summary: {
          drivers: rows.length,
          activeDrivers: active.length,
          totalEarnings: money(rows.reduce((s, r) => s + r.earnings, 0)),
          avgCompletion: active.length ? Math.round(active.reduce((s, r) => s + r.completion_rate, 0) / active.length) : 0,
          top: rows.filter(r => r.earnings > 0).slice(0, 10),
        },
      });
    } catch (error) {
      console.error('driver_report error:', error);
      res.status(500).send('Something went wrong!');
    }
  };

  // Revenue Analysis: gross ride fares vs platform revenue, per day and per vehicle type
  static revenue_report = async (req, res) => {
    try {
      const range = getDateRange(req.query);

      const [rides, rideCharges, subscriptions, recharges] = await Promise.all([
        Ride.findAll({
          where: { status: 'completed', created_at: range.where },
          attributes: ['id', 'final_fare', 'distance_km', 'created_at', 'vehicle_id'],
          include: [{ model: VehicleType, as: 'vehicle', attributes: ['type_name'] }],
        }),
        DriverTransaction.findAll({ where: { type: 'wallet', created_at: range.where }, attributes: ['amount', 'created_at'] }),
        DriverSubscription.findAll({
          where: { status: ['active', 'expired'], created_at: range.where },
          attributes: ['created_at'],
          include: [{ model: Subscriptions, as: 'subscription', attributes: ['price'] }],
        }),
        DriverRechargeRequest.findAll({ where: { status: 'approved', requested_at: range.where }, attributes: ['amount', 'requested_at'] }),
      ]);

      const days = dayList(range.from, range.to);
      const blank = () => ({ rides: 0, gross: 0, rideCharges: 0, subscriptions: 0, recharges: 0 });
      const daily = Object.fromEntries(days.map(d => [d, blank()]));
      const add = (date, key, amount) => {
        const d = toYmd(new Date(date));
        if (daily[d]) daily[d][key] += amount;
      };

      const byVehicle = {};
      rides.forEach(r => {
        const fare = parseFloat(r.final_fare) || 0;
        add(r.created_at, 'gross', fare);
        add(r.created_at, 'rides', 1);
        const v = r.vehicle?.type_name || 'Unknown';
        byVehicle[v] = byVehicle[v] || { vehicle: v, rides: 0, gross: 0, distance: 0 };
        byVehicle[v].rides += 1;
        byVehicle[v].gross += fare;
        byVehicle[v].distance += parseFloat(r.distance_km) || 0;
      });
      rideCharges.forEach(x => add(x.created_at, 'rideCharges', parseFloat(x.amount) || 0));
      subscriptions.forEach(x => add(x.created_at, 'subscriptions', parseFloat(x.subscription?.price) || 0));
      recharges.forEach(x => add(x.requested_at, 'recharges', parseFloat(x.amount) || 0));

      const dailyRows = days.map(d => {
        const x = daily[d];
        return {
          date: d,
          rides: x.rides,
          gross: money(x.gross),
          rideCharges: money(x.rideCharges),
          subscriptions: money(x.subscriptions),
          platform: money(x.rideCharges + x.subscriptions),
          recharges: money(x.recharges),
        };
      });

      if (req.query.export === 'csv') {
        return sendCsv(res, `revenue-${range.fromStr}-to-${range.toStr}.csv`, [
          { key: 'date', label: 'Date' },
          { key: 'rides', label: 'Completed Rides' },
          { key: 'gross', label: 'Gross Fare (GBP)' },
          { key: 'rideCharges', label: 'Ride Charges (GBP)' },
          { key: 'subscriptions', label: 'Subscription Sales (GBP)' },
          { key: 'platform', label: 'Platform Revenue (GBP)' },
          { key: 'recharges', label: 'Wallet Recharges (GBP)' },
        ], dailyRows);
      }

      const sum = key => money(dailyRows.reduce((s, r) => s + r[key], 0));
      const totalRides = dailyRows.reduce((s, r) => s + r.rides, 0);
      const gross = sum('gross');

      // Compare with the previous period of the same length
      const spanMs = range.to - range.from;
      const prevFrom = new Date(range.from.getTime() - spanMs - 1);
      const prevTo = new Date(range.from.getTime() - 1);
      const prevGross = await Ride.sum('final_fare', {
        where: { status: 'completed', created_at: { [Op.between]: [prevFrom, prevTo] } },
      });
      const growth = prevGross ? Math.round(((gross - prevGross) / prevGross) * 100) : null;

      res.render('admin/report_revenue', {
        range,
        dailyRows,
        byVehicle: Object.values(byVehicle)
          .map(v => ({ ...v, gross: money(v.gross), distance: money(v.distance), avg: money(v.gross / v.rides) }))
          .sort((a, b) => b.gross - a.gross),
        summary: {
          gross,
          rides: totalRides,
          avgFare: totalRides ? money(gross / totalRides) : 0,
          rideCharges: sum('rideCharges'),
          subscriptions: sum('subscriptions'),
          platform: sum('platform'),
          recharges: sum('recharges'),
          prevGross: money(prevGross),
          growth,
        },
      });
    } catch (error) {
      console.error('revenue_report error:', error);
      res.status(500).send('Something went wrong!');
    }
  };
}

module.exports = reportcontroller;
