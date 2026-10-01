// models/FareEstimation.js
module.exports = (sequelize, DataTypes) => {
    return sequelize.define('FareEstimation', {
      user_id: DataTypes.INTEGER,
      pickup_lat: DataTypes.FLOAT,
      dropoff_lat: DataTypes.FLOAT,
      estimated_fare: DataTypes.FLOAT,
      distance_km: DataTypes.FLOAT,
      estimated_time_min: DataTypes.FLOAT,
    }, {
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: false,
      tableName: 'fare_estimations',
    });
  };
  