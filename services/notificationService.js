const { Op } = require('sequelize');
const { Notification, NotificationRead, User, Driver } = require('../models');

const AUDIENCES = ['all_users', 'all_drivers', 'everyone', 'user', 'driver'];

/**
 * Save an in-app notification and deliver it live over socket.io.
 * Apps listen for the 'notification' event (users join room user_<id>, drivers join driver_<id>).
 */
async function createNotification({ title, body, audience, target_id = null, type = 'admin', data = null }, io = null) {
  const notification = await Notification.create({ title, body, audience, target_id, type, data });

  if (io) {
    const payload = {
      id: notification.id,
      title,
      body,
      type,
      data,
      created_at: notification.created_at,
    };
    if (audience === 'user') io.to(`user_${target_id}`).emit('notification', payload);
    else if (audience === 'driver') io.to(`driver_${target_id}`).emit('notification', payload);
    else io.emit('notification', { ...payload, audience });
  }
  return notification;
}

// Where-clause for everything a given user / driver is allowed to see
async function visibleWhere(readerType, readerId) {
  const Model = readerType === 'user' ? User : Driver;
  const reader = await Model.findByPk(readerId, { attributes: ['id', 'created_at'] });
  if (!reader) return null;

  const broadcast = readerType === 'user' ? 'all_users' : 'all_drivers';
  return {
    [Op.or]: [
      // broadcasts sent after this account was created
      { audience: [broadcast, 'everyone'], created_at: { [Op.gte]: reader.created_at || new Date(0) } },
      { audience: readerType, target_id: readerId },
    ],
  };
}

async function listFor(readerType, readerId, { limit = 50, offset = 0 } = {}) {
  const where = await visibleWhere(readerType, readerId);
  if (!where) return null;

  const [rows, total] = await Promise.all([
    Notification.findAll({
      where,
      include: [{
        model: NotificationRead, as: 'reads', required: false,
        where: { reader_type: readerType, reader_id: readerId }, attributes: ['read_at'],
      }],
      order: [['created_at', 'DESC']],
      limit,
      offset,
    }),
    Notification.count({ where }),
  ]);
  const unread = await unreadCount(readerType, readerId, where);

  return {
    total,
    unread_count: unread,
    data: rows.map(n => ({
      id: n.id,
      title: n.title,
      body: n.body,
      type: n.type,
      data: n.data,
      created_at: n.created_at,
      is_read: n.reads.length > 0,
      read_at: n.reads[0]?.read_at || null,
    })),
  };
}

async function unreadCount(readerType, readerId, where = null) {
  where = where || await visibleWhere(readerType, readerId);
  if (!where) return 0;
  const [total, read] = await Promise.all([
    Notification.count({ where }),
    NotificationRead.count({
      where: { reader_type: readerType, reader_id: readerId },
      include: [{ model: Notification, where, attributes: [], required: true }],
    }),
  ]);
  return Math.max(total - read, 0);
}

// ids: array of notification ids, or 'all'
async function markRead(readerType, readerId, ids) {
  const where = await visibleWhere(readerType, readerId);
  if (!where) return 0;

  const visible = await Notification.findAll({
    where: ids === 'all' ? where : { [Op.and]: [where, { id: ids }] },
    attributes: ['id'],
  });
  if (!visible.length) return 0;

  await NotificationRead.bulkCreate(
    visible.map(n => ({ notification_id: n.id, reader_type: readerType, reader_id: readerId })),
    { ignoreDuplicates: true }
  );
  return visible.length;
}

module.exports = { AUDIENCES, createNotification, listFor, unreadCount, markRead };
