const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('Holiday', {
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      unique: false
    },
    name: {
      type: DataTypes.STRING,
      allowNull: true
    }
  }, {
    tableName: 'holidays',
    timestamps: false // Disable if you don't need createdAt/updatedAt
  });
};
