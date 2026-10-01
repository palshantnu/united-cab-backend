module.exports = (sequelize, DataTypes) => {
  const DriverPayoutRequest = sequelize.define('DriverPayoutRequest', {
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
    payout_method: {
      type: DataTypes.STRING,
    },
    account_details: {
      type: DataTypes.TEXT,
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
    tableName: 'driver_payout_requests',
    timestamps: false,
  });

  return DriverPayoutRequest;
};
