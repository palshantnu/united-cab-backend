module.exports = (sequelize, DataTypes) => {
  const DriverRechargeRequest = sequelize.define("DriverRechargeRequest", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    driver_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    payment_method: {
      type: DataTypes.STRING,
    },
    transaction_id: {
      type: DataTypes.STRING,
    },
    status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected'),
      defaultValue: 'pending',
    },
    request_note: {
      type: DataTypes.TEXT,
    },
    admin_note: {
      type: DataTypes.TEXT,
    },
    requested_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    processed_at: {
      type: DataTypes.DATE,
    }
   }, {
    tableName: 'driver_recharge_requests',
    timestamps: false,
  });

  DriverRechargeRequest.associate = (models) => {
      DriverRechargeRequest.belongsTo(models.Driver, {
        foreignKey: 'driver_id',
        as: 'driver',
      });
  };



  return DriverRechargeRequest;
};
