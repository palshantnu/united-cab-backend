// models/VehicleType.js
module.exports = (sequelize, DataTypes) => {
  const VehicleType = sequelize.define('VehicleType', {
    type_name: DataTypes.STRING,
    label: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    capacity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 4
    },
    description: DataTypes.STRING,
    minimum_km: DataTypes.FLOAT,
    minimum_fare: DataTypes.FLOAT,
    fare_per_km: DataTypes.FLOAT,
    vehicle_image: DataTypes.STRING,
    vehicle_logo: DataTypes.STRING,
    platform_fee: DataTypes.FLOAT,
    shift_type: DataTypes.STRING,
    start_time: DataTypes.TIME,
    end_time: DataTypes.TIME,
    is_holiday: {
      type: DataTypes.BOOLEAN,
      // defaultValue: false
    },
  }, {
    timestamps: false,
    tableName: 'vehicle_types',
  });

  // Define association in associate function
  VehicleType.associate = (models) => {
    VehicleType.hasMany(models.Ride, { foreignKey: 'vehicle_id' });
  };

  return VehicleType;
};
