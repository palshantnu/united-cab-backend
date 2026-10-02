const { fn, col } = require('sequelize');
const { User, Driver, Notification, NotificationRead } = require('../models/index');
const { AUDIENCES, createNotification, listFor, unreadCount, markRead } = require('../services/notificationService');

class notificationcontroller {

  static push_notifications = async (req, res) => {
    try {
      const [users, drivers, history, readCounts] = await Promise.all([
        User.findAll({ attributes: ['id', 'name', 'phone'], order: [['name', 'ASC']] }),
        Driver.findAll({ attributes: ['id', 'name', 'phone'], order: [['name', 'ASC']] }),
        Notification.findAll({ order: [['created_at', 'DESC']], limit: 200 }),
        NotificationRead.findAll({
          attributes: ['notification_id', [fn('COUNT', col('id')), 'count']],
          group: ['notification_id'],
          raw: true,
        }),
      ]);

      const readsById = Object.fromEntries(readCounts.map(r => [r.notification_id, Number(r.count)]));
      const nameOf = {
        user: Object.fromEntries(users.map(u => [u.id, u.name])),
        driver: Object.fromEntries(drivers.map(d => [d.id, d.name])),
      };

      res.render('admin/push_notifications', {
        users, drivers, history, nameOf, readsById,
        userCount: users.length,
        driverCount: drivers.length,
      });
    } catch (error) {
      console.error('push_notifications error:', error);
      res.status(500).send('Something went wrong!');
    }
  };

  static send_notification = async (req, res) => {
    try {
      const title = (req.body.title || '').trim();
      const body = (req.body.body || '').trim();
      const audience = req.body.audience;
      const targetId = audience === 'user' ? parseInt(req.body.user_id)
        : audience === 'driver' ? parseInt(req.body.driver_id) : null;

      if (!title || !body) {
        req.flash('error', 'Title and message are required.');
        return res.redirect('/push-notifications');
      }
      if (!AUDIENCES.includes(audience) || ((audience === 'user' || audience === 'driver') && !targetId)) {
        req.flash('error', 'Please choose who should receive the notification.');
        return res.redirect('/push-notifications');
      }
      if (audience === 'user' && !(await User.count({ where: { id: targetId } }))) {
        req.flash('error', 'Selected user not found.');
        return res.redirect('/push-notifications');
      }
      if (audience === 'driver' && !(await Driver.count({ where: { id: targetId } }))) {
        req.flash('error', 'Selected driver not found.');
        return res.redirect('/push-notifications');
      }

      await createNotification({ title, body, audience, target_id: targetId, type: 'admin' }, req.app.get('io'));
      req.flash('success', 'Notification sent. It will appear in the app inbox.');
      res.redirect('/push-notifications');
    } catch (error) {
      console.error('send_notification error:', error);
      req.flash('error', 'Something went wrong while sending.');
      res.redirect('/push-notifications');
    }
  };

  static delete_notification = async (req, res) => {
    try {
      await NotificationRead.destroy({ where: { notification_id: req.params.id } });
      await Notification.destroy({ where: { id: req.params.id } });
      req.flash('success', 'Notification deleted.');
    } catch (error) {
      console.error('delete_notification error:', error);
      req.flash('error', 'Could not delete notification.');
    }
    res.redirect('/push-notifications');
  };

  // ---------------- App APIs ----------------

  static readParams(req) {
    const type = req.body.type;
    const id = parseInt(req.body.id);
    return ['user', 'driver'].includes(type) && id ? { type, id } : null;
  }

  // POST /api/notifications { type: 'user' | 'driver', id, page?, limit? }
  static api_list = async (req, res) => {
    try {
      const p = notificationcontroller.readParams(req);
      if (!p) return res.status(400).json({ success: false, message: "type ('user' or 'driver') and id are required" });

      const limit = Math.min(parseInt(req.body.limit) || 20, 100);
      const page = Math.max(parseInt(req.body.page) || 1, 1);
      const result = await listFor(p.type, p.id, { limit, offset: (page - 1) * limit });
      if (!result) return res.status(404).json({ success: false, message: `${p.type} not found` });

      res.json({ success: true, page, limit, ...result });
    } catch (error) {
      console.error('notifications api error:', error);
      res.status(500).json({ success: false, message: 'Something went wrong' });
    }
  };

  // POST /api/notifications/unread-count { type, id }
  static api_unread_count = async (req, res) => {
    try {
      const p = notificationcontroller.readParams(req);
      if (!p) return res.status(400).json({ success: false, message: "type ('user' or 'driver') and id are required" });
      res.json({ success: true, unread_count: await unreadCount(p.type, p.id) });
    } catch (error) {
      console.error('unread count api error:', error);
      res.status(500).json({ success: false, message: 'Something went wrong' });
    }
  };

  // POST /api/notifications/read { type, id }                  -> marks ALL pending as read (called when the inbox opens)
  //                              { type, id, notification_id } -> marks only the given id(s)
  static api_mark_read = async (req, res) => {
    try {
      const p = notificationcontroller.readParams(req);
      if (!p) return res.status(400).json({ success: false, message: "type ('user' or 'driver') and id are required" });

      const ids = [].concat(req.body.notification_id || []).map(Number).filter(Boolean);
      const marked = await markRead(p.type, p.id, ids.length ? ids : 'all');
      res.json({ success: true, marked, unread_count: await unreadCount(p.type, p.id) });
    } catch (error) {
      console.error('mark read api error:', error);
      res.status(500).json({ success: false, message: 'Something went wrong' });
    }
  };
}

module.exports = notificationcontroller;
