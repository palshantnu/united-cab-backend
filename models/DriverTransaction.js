const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('DriverTransaction', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    driver_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    ride_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0
    },
    type: {
      type: DataTypes.ENUM('subscription', 'fare', 'bonus', 'penalty', 'wallet', 'payout'),
      allowNull: false
    },
    distance: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0
    },
    description: {
      type: DataTypes.STRING,
      allowNull: true
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'driver_transactions',
    timestamps: false, // handled manually using created_at & updated_at
    underscored: true // maps camelCase to snake_case columns
  });
};
