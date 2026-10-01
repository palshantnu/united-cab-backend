const { DataTypes } = require('sequelize');
const sequelize = require('../db/database').sequelize;


// models/SplitPayment.js
module.exports = (sequelize, DataTypes) => {
    return sequelize.define('SplitPayment', {
      ride_id: DataTypes.INTEGER,
      payer_user_id: DataTypes.INTEGER,
      split_with_user_id: DataTypes.INTEGER,
      amount: DataTypes.FLOAT,
      status: DataTypes.STRING,
    }, {
      timestamps: false,
      tableName: 'split_payments',
    });
  };
  