const { DataTypes } = require('sequelize');
const sequelize = require('../db/database').sequelize;

// models/WalletTransaction.js
module.exports = (sequelize, DataTypes) => {
    return sequelize.define('WalletTransaction', {
      wallet_id: DataTypes.INTEGER,
      type: DataTypes.ENUM('credit', 'debit'),
      amount: DataTypes.FLOAT,
      description: DataTypes.STRING,
    }, {
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: false,
      tableName: 'wallet_transactions',
    });
  };
  