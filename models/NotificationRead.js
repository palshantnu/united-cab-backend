// One row per (notification, reader) once the user / driver has opened it
module.exports = (sequelize, DataTypes) => {
  const NotificationRead = sequelize.define('NotificationRead', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    notification_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    reader_type: {
      type: DataTypes.ENUM('user', 'driver'),
      allowNull: false,
    },
    reader_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    read_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'notification_reads',
    timestamps: false,
    indexes: [
      { unique: true, fields: ['notification_id', 'reader_type', 'reader_id'] },
    ],
  });

  return NotificationRead;
};
