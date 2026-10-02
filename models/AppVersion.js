// App update settings managed from the admin panel — one row per app + platform
module.exports = (sequelize, DataTypes) => {
  const AppVersion = sequelize.define('AppVersion', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    app: {
      type: DataTypes.ENUM('user', 'driver'),
      allowNull: false,
    },
    platform: {
      type: DataTypes.ENUM('android', 'ios'),
      allowNull: false,
    },
    // Newest version on the store; apps below it are asked to update
    latest_version: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: '1.0.0',
    },
    // How apps below latest_version are asked: 'normal' (can skip) or 'force' (must update)
    update_type: {
      type: DataTypes.ENUM('normal', 'force'),
      allowNull: false,
      defaultValue: 'normal',
    },
    // Apps below this are always forced, even when the latest release is a normal update
    min_version: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    store_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    title: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // Master switch — when off, apps never show an update prompt
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'app_versions',
    timestamps: false,
    indexes: [
      { unique: true, fields: ['app', 'platform'] },
    ],
  });

  return AppVersion;
};
