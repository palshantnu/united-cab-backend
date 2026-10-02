require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const flash = require('connect-flash');
const { Server } = require("socket.io");
const http = require('http');
const app = express();
const port = 3001;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static('public'));

app.use(session({
  secret: process.env.SESSION_SECRET,
  cookie: { maxAge: 60000 },
  resave: false,
  saveUninitialized: true,
}));
app.use(flash());

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use((req, res, next) => {
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  res.locals.errors = req.flash('errors');
  next();
});
app.use((req, res, next) => {
  res.locals.baseUrl = `${req.protocol}://${req.get('host')}`;
  next();
});

// Logged-in admin for the panel header (skipped for app APIs)
const { attachAdmin } = require('./middleware/auth');
app.use((req, res, next) => (req.path.startsWith('/api') ? next() : attachAdmin(req, res, next)));

const adminRoutes = require('./routes/admin');
const webRoutes = require('./routes/web');
const apiRoutes = require('./routes/api');


app.use('/', webRoutes);
app.use('/api', apiRoutes);
app.use('/admin', adminRoutes);
const db = require('./models'); // associations are applied inside models/index.js

(async () => {
  try {
    await db.sequelize.authenticate();
    console.log('✅ MySQL Connected');
    // Create only the newer tables if missing (no ALTER on existing tables)
    await db.DriverPayoutRequest.sync();
    await db.Notification.sync();
    await db.NotificationRead.sync();
    await db.sequelize.query(
      "ALTER TABLE driver_transactions MODIFY `type` ENUM('subscription','fare','bonus','penalty','wallet','payout') NOT NULL"
    );
    const ridesTable = await db.sequelize.getQueryInterface().describeTable('rides');
    if (!ridesTable.stops) {
      await db.sequelize.query('ALTER TABLE rides ADD COLUMN `stops` LONGTEXT NULL AFTER `dropoff_lng`');
    }
    console.log('📦 Tables ready');
  } catch (err) {
    console.error('❌ DB connection failed:', err);
  }
})();

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.set('io', io);
require('./sockets/locationSockets')(io);
require('./sockets/rideSockets')(io);

// Scheduled ride scheduler — har 60 second mein chalega
const RideController = require('./controllers/API/RideController');
const { Ride } = require('./models');
const { Op } = require('sequelize');

async function runScheduledRideDispatcher() {
  try {
    const now = new Date();
    const thirtyMinLater = new Date(now.getTime() + 30 * 60 * 1000);

    const rides = await Ride.findAll({
      where: {
        status: 'pending',
        booking_type: 'scheduled',
        scheduled_at: { [Op.between]: [now, thirtyMinLater] }
      },
      raw: true
    });

    if (rides.length === 0) return;

    console.log(`🕐 Scheduler: ${rides.length} scheduled ride(s) to dispatch`);

    for (const ride of rides) {
      try {
        await Ride.update({ status: 'searching' }, { where: { id: ride.id, status: 'pending' } });
        await RideController.notifyEligibleDrivers(ride, io);
        console.log(`✅ Scheduler: Drivers notified for ride ${ride.id}`);
      } catch (err) {
        console.error(`❌ Scheduler: Error notifying for ride ${ride.id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('❌ Scheduler Error:', err.message);
  }
}

setInterval(runScheduledRideDispatcher, 60 * 1000);

server.listen(port, () => {
  console.log(`🚀 Server running at: http://localhost:${port}`);
});
