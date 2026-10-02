// models/ride.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Ride = sequelize.define('Ride', {
    user_id: DataTypes.INTEGER,
    driver_id: DataTypes.INTEGER,
    vehicle_id: DataTypes.INTEGER,
    pickup_address: DataTypes.STRING,
    dropoff_address: DataTypes.STRING,
    booking_type: DataTypes.STRING,
    pickup_lat: DataTypes.FLOAT,
    pickup_lng: DataTypes.FLOAT,
    dropoff_lat: DataTypes.FLOAT,
    dropoff_lng: DataTypes.FLOAT,
    // Intermediate stops between pickup and drop, in order:
    // [{ address, lat, lng, status: 'pending' | 'arrived' | 'completed', arrived_at, completed_at }]
    stops: {
      type: DataTypes.TEXT('long'),
      allowNull: true,
      get() {
        const raw = this.getDataValue('stops');
        if (!raw) return [];
        try {
          return JSON.parse(raw);
        } catch (e) {
          return [];
        }
      },
      set(value) {
        this.setDataValue('stops', Array.isArray(value) && value.length ? JSON.stringify(value) : null);
      },
    },
    status: {
      type: DataTypes.ENUM('searching','pending', 'accepted', 'completed', 'cancelled', 'arrived', 'started','rideend'),
      defaultValue: 'pending',
    },
    otp: DataTypes.STRING,
    cancel_reason: DataTypes.STRING,
    cancelled_by: DataTypes.STRING,
    timezone : DataTypes.STRING,       
    fare_estimate: DataTypes.FLOAT,
    final_fare: DataTypes.FLOAT,
    distance_km: DataTypes.FLOAT,
    duration_min: DataTypes.FLOAT,
    scheduled_at: DataTypes.DATE,
    completed_at: DataTypes.DATE,
  }, {
    timestamps: true,
    tableName: 'rides',
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  // Define associations in a separate function
  Ride.associate = (models) => {
    Ride.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    Ride.belongsTo(models.Driver, { foreignKey: 'driver_id', as: 'driver' });
    Ride.belongsTo(models.VehicleType, { foreignKey: 'vehicle_id', as: 'vehicle' });

  };

  return Ride;
};
