// models/VehicleTariff.js
module.exports = (sequelize, DataTypes) => {
  return sequelize.define('VehicleTariff', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    vehicle_type_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    passenger_min: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    passenger_max: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    time_start: {
      type: DataTypes.TIME,
      allowNull: true
    },
    time_end: {
      type: DataTypes.TIME,
      allowNull: true
    },
    is_holiday: {
      type: DataTypes.BOOLEAN,  // tinyint(1) = BOOLEAN in Sequelize
      defaultValue: false
    },
    start_fare: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true
    },
    per_mile_fare: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true
    },
    notes: {
      type: DataTypes.STRING(255),
      allowNull: true
    }
  }, {
    timestamps: false,
    tableName: 'vehicle_tariffs'
  });
};
