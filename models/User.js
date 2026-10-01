module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    name: DataTypes.STRING,
    email: DataTypes.STRING,
    phone: DataTypes.STRING,
    password: DataTypes.STRING,
    status: DataTypes.STRING,
    user_latitude: DataTypes.FLOAT,
    user_longitude: DataTypes.FLOAT,
    profile: DataTypes.STRING,
    devicetoken: DataTypes.STRING,
    wallet: DataTypes.FLOAT,
    country_code:DataTypes.STRING,
    
  }, {
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    tableName: 'user',
  });

  // Define associations in a separate associate function
  User.associate = (models) => {
    User.hasMany(models.Ride, { foreignKey: 'user_id' });
  };

  return User;
};
