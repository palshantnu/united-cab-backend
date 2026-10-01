module.exports = (db) => {
  const {
    User, Driver, DriverDocument, VehicleType, Ride, Payment, SplitPayment,
    Wallet, WalletTransaction, Rating_Reviews, Subscriptions, DriverSubscription,
    DriverTransaction, DriverRechargeRequest, DriverPayoutRequest,
    Notification, NotificationRead
  } = db;

  Notification.hasMany(NotificationRead,   { foreignKey: 'notification_id', as: 'reads', onDelete: 'CASCADE' });
  NotificationRead.belongsTo(Notification, { foreignKey: 'notification_id' });

  User.hasMany(Ride,   { foreignKey: 'user_id',   as: 'rides' });
  Ride.belongsTo(User, { foreignKey: 'user_id',   as: 'user' });

  Driver.hasMany(Ride,   { foreignKey: 'driver_id', as: 'rides' });
  Ride.belongsTo(Driver, { foreignKey: 'driver_id', as: 'driver' });

  VehicleType.hasMany(Ride,   { foreignKey: 'vehicle_id', as: 'rides' });
  Ride.belongsTo(VehicleType, { foreignKey: 'vehicle_id', as: 'vehicle' });

  VehicleType.hasMany(Driver,   { foreignKey: 'vehicle_id' });
  Driver.belongsTo(VehicleType, { foreignKey: 'vehicle_id' });

  Driver.hasMany(DriverDocument,   { foreignKey: 'driver_id' });
  DriverDocument.belongsTo(Driver, { foreignKey: 'driver_id' });

  Ride.hasMany(Rating_Reviews,   { foreignKey: 'ride_id' });
  Rating_Reviews.belongsTo(Ride, { foreignKey: 'ride_id' });
  User.hasMany(Rating_Reviews,   { foreignKey: 'user_id' });
  Driver.hasMany(Rating_Reviews, { foreignKey: 'driver_id' });

  DriverSubscription.belongsTo(Subscriptions, { foreignKey: 'subscription_id', as: 'subscription' });
  Subscriptions.hasMany(DriverSubscription,   { foreignKey: 'subscription_id' });
  Driver.hasMany(DriverSubscription,   { foreignKey: 'driver_id' });
  DriverSubscription.belongsTo(Driver, { foreignKey: 'driver_id' });

  Driver.hasMany(DriverTransaction,   { foreignKey: 'driver_id' });
  DriverTransaction.belongsTo(Driver, { foreignKey: 'driver_id' });
  Driver.hasMany(DriverRechargeRequest,   { foreignKey: 'driver_id' });
  DriverRechargeRequest.belongsTo(Driver, { foreignKey: 'driver_id' });
  Driver.hasMany(DriverPayoutRequest,   { foreignKey: 'driver_id' });
  DriverPayoutRequest.belongsTo(Driver, { foreignKey: 'driver_id', as: 'driver' });

  Ride.hasOne(Payment,   { foreignKey: 'ride_id' });
  Payment.belongsTo(Ride, { foreignKey: 'ride_id' });
  Ride.hasMany(SplitPayment, { foreignKey: 'ride_id' });
  User.hasMany(SplitPayment, { foreignKey: 'payer_user_id',      as: 'Payer' });
  User.hasMany(SplitPayment, { foreignKey: 'split_with_user_id', as: 'SplitWith' });
  Driver.hasOne(Wallet,   { foreignKey: 'driver_id' });
  Wallet.belongsTo(Driver, { foreignKey: 'driver_id' });
  Wallet.hasMany(WalletTransaction,   { foreignKey: 'wallet_id' });
  WalletTransaction.belongsTo(Wallet, { foreignKey: 'wallet_id' });
};