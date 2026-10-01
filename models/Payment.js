const { DataTypes } = require('sequelize');
const sequelize = require('../db/database').sequelize;


// models/Payment.js
module.exports = (sequelize, DataTypes) => {
    return sequelize.define('Payment', {
      ride_id: DataTypes.INTEGER,
      user_id: DataTypes.INTEGER,
      driver_id: DataTypes.INTEGER,
      amount: DataTypes.FLOAT,
      payment_method: DataTypes.ENUM('card', 'cash', 'wallet'),
      transaction_id: DataTypes.STRING,
      status: DataTypes.STRING,
      paid_at: DataTypes.DATE,
    }, {
      timestamps: false,
      tableName: 'payments',
    });
  };
  