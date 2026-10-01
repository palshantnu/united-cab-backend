// In-app notifications (shown inside the user / driver app inbox)
module.exports = (sequelize, DataTypes) => {
  const Notification = sequelize.define('Notification', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    body: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    // all_users | all_drivers | everyone | user | driver
    audience: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    // set when audience is a single user / driver
    target_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    // admin (sent from panel) | payout | system
    type: {
      type: DataTypes.STRING(20),
      defaultValue: 'admin',
    },
    // extra info for the app, e.g. { payoutId, status }
    data: {
      type: DataTypes.TEXT,
      allowNull: true,
      get() {
        const raw = this.getDataValue('data');
        try { return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
      },
      set(value) {
        this.setDataValue('data', value ? JSON.stringify(value) : null);
      },
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'notifications',
    timestamps: false,
  });

  return Notification;
};
