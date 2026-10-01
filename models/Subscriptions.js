const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('Subscriptions', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    duration_days: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    created_at: {
      type: DataTypes.DATE, 
      allowNull: true,
      defaultValue: sequelize.literal('CURRENT_TIMESTAMP')
    },
    mile: {
      type: DataTypes.INTEGER, 
      allowNull: true,
    }
  }, {
    tableName: 'subscriptions',
    timestamps: false 
  });
};
