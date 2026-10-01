const { DataTypes } = require('sequelize');
const sequelize = require('../db/database').sequelize;

const Booking = sequelize.define('Booking', {
  booking_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  driver_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  vehicle_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('accepted', 'completed', 'cancelled', 'arrived', 'started', 'rideend'),
    defaultValue: 'pending'
  },
  cancelled_by: {
    type: DataTypes.ENUM('user', 'driver', 'admin'),
    allowNull: true
  },
  cancel_reason: {
    type: DataTypes.STRING,
    allowNull: true
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  payment_mode: {
    type: DataTypes.ENUM('cash', 'card', 'wallet'),
    allowNull: false
  },
  paid: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  is_track: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  distance: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  travel_time: {
    type: DataTypes.STRING,
    allowNull: true
  },
  user_latitude: {
    type: DataTypes.DECIMAL(9, 6),
    allowNull: true
  },
  user_longitude: {
    type: DataTypes.DECIMAL(9, 6),
    allowNull: true
  },
  driver_address: {
    type: DataTypes.STRING,
    allowNull: true
  },
  driver_latitude: {
    type: DataTypes.DECIMAL(9, 6),
    allowNull: true
  },
  track_distance: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  track_latitude: {
    type: DataTypes.DECIMAL(9, 6),
    allowNull: true
  },
  track_longitude: {
    type: DataTypes.DECIMAL(9, 6),
    allowNull: true
  },
  assigned_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  schedule_date: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  schedule_start: {
    type: DataTypes.TIME,
    allowNull: true
  },
  schedule_end: {
    type: DataTypes.TIME,
    allowNull: true
  },
  person: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  user_rated: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  driver_rated: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  user_review: {
    type: DataTypes.STRING,
    allowNull: true
  },
  driver_review: {
    type: DataTypes.STRING,
    allowNull: true
  },
  user_wallet: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00
  },
  stop_lat: {
    type: DataTypes.DECIMAL(9, 6),
    allowNull: true
  },
  stop_long: {
    type: DataTypes.DECIMAL(9, 6),
    allowNull: true
  },
  otp: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  tableName: 'bookings',
  timestamps: true, 
  paranoid: true, 
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = Booking;
