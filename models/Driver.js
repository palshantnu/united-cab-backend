const { DataTypes } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  const Driver = sequelize.define('Driver', {
    name: DataTypes.STRING,
    phone: DataTypes.STRING,
    gender: DataTypes.STRING,
    country_code: DataTypes.STRING,
    profile_photo: DataTypes.STRING,
    license_number: DataTypes.STRING,
    vehicle_id: DataTypes.INTEGER, 
    vehicle_number: DataTypes.STRING,
    vehicle_model: DataTypes.STRING,
    devicetoken: DataTypes.STRING,
    rating: DataTypes.FLOAT,
    status: DataTypes.BOOLEAN,
    online_status: DataTypes.BOOLEAN,
    phone_varified: DataTypes.BOOLEAN,
    driver_latitude: DataTypes.FLOAT,
    driver_longitude: DataTypes.FLOAT,
    wallet: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0
    },
  }, {
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    tableName: 'drivers',
  });

  Driver.associate = (models) => {
    Driver.hasMany(models.DriverRechargeRequest, {
      foreignKey: 'driver_id',
      as: 'rechargeRequests',
    });

    Driver.hasMany(models.DriverSubscription, {
      foreignKey: 'driver_id',
      as: 'subscriptions'
    });

    Driver.hasMany(models.Ride, { 
      foreignKey: 'driver_id' 
    });

    Driver.belongsTo(models.VehicleType, { 
      foreignKey: 'vehicle_id' 
    });
  };

  return Driver;
};