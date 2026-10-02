const { DataTypes } = require('sequelize');
const { sequelize } = require('../db/database');
const fs = require('fs');
const path = require('path');
const basename = path.basename(__filename);
// Import model definitions
const User = require('./User')(sequelize, DataTypes);
const Driver = require('./Driver')(sequelize, DataTypes);
const DriverDocument = require('./DriverDocument')(sequelize, DataTypes);
const VehicleType = require('./VehicleType')(sequelize, DataTypes);
const VehicleTariff = require('./VehicleTariff')(sequelize, DataTypes);
const Ride = require('./Ride')(sequelize, DataTypes);
const Payment = require('./Payment')(sequelize, DataTypes);
const SplitPayment = require('./SplitPayment')(sequelize, DataTypes);
const FareEstimation = require('./FareEstimation')(sequelize, DataTypes);
const Wallet = require('./Wallet')(sequelize, DataTypes);
const WalletTransaction = require('./WalletTransaction')(sequelize, DataTypes);
const Rating_Reviews = require('./Rating_Reviews')(sequelize, DataTypes);
const Otp = require('./Otp')(sequelize, DataTypes);
const DriverRechargeRequest = require('./DriverRechargeRequest')(sequelize, DataTypes);
const Holiday = require('./Holiday')(sequelize, DataTypes);
const Subscriptions = require('./Subscriptions')(sequelize, DataTypes);
const DriverSubscription = require('./DriverSubscription')(sequelize, DataTypes);
const DriverTransaction = require('./DriverTransaction')(sequelize, DataTypes);
const CmsPage = require('./CmsPage')(sequelize, DataTypes);
const DriverPayoutRequest = require('./DriverPayoutRequest')(sequelize, DataTypes);
const Notification = require('./Notification')(sequelize, DataTypes);
const NotificationRead = require('./NotificationRead')(sequelize, DataTypes);
const AppVersion = require('./AppVersion')(sequelize, DataTypes);

// Bundle models
const db = {
  sequelize,
  User,
  Driver,
  DriverDocument,
  VehicleType,
  VehicleTariff,
  Ride,
  Payment,
  SplitPayment,
  FareEstimation,
  Wallet,
  WalletTransaction,
  Rating_Reviews,
  Otp,
  DriverRechargeRequest,
  Holiday,
  Subscriptions,
  DriverSubscription,
  DriverTransaction,
  CmsPage,
  DriverPayoutRequest,
  Notification,
  NotificationRead,
  AppVersion
};
fs
  .readdirSync(__dirname)
  .filter((file) => {
    return (
      file.indexOf('.') !== 0 && file !== basename && file.slice(-3) === '.js'
    );
  })

require('./associations')(db);

module.exports = db;
