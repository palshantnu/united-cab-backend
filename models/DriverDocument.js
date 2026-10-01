
const { DataTypes } = require('sequelize');
const sequelize = require('../db/database').sequelize;


// models/DriverDocument.js
module.exports = (sequelize, DataTypes) => {
    return sequelize.define('DriverDocument', {
      driver_id: DataTypes.INTEGER,
      vehicle_number: DataTypes.STRING,
      document_type: DataTypes.ENUM('license', 'insurance'),
      document_file: DataTypes.STRING,
      verified: DataTypes.BOOLEAN,
      uploaded_at: DataTypes.DATE,
    }, {
      timestamps: false,
      tableName: 'driver_documents',
    });
  };
  