const { Op, fn, col } = require('sequelize');
const {
  Driver, DriverTransaction, DriverSubscription, Subscriptions,
  DriverRechargeRequest, DriverPayoutRequest, sequelize
} = require('../models/index');
const { getDateRange, dayList, toYmd, money, sendCsv } = require('../services/reportHelpers');
const { createNotification } = require('../services/notificationService');

// Subscriptions that were actually paid for (pending = not activated, cancelled = refunded/void)
const PAID_SUB_STATUSES = ['active', 'expired'];

class accountcontroller {

  // Admin Commission: what the platform earned in the selected period
  static admin_earnings = async (req, res) => {
    try {
      const range = getDateRange(req.query);

      const [subscriptions, rideDeductions, rechargeTotal, payoutTotal, walletBalance, pendingPayouts] = await Promise.all([
        DriverSubscription.findAll({
          where: { status: PAID_SUB_STATUSES, created_at: range.where },
          include: [
            { model: Subscriptions, as: 'subscription', attributes: ['name', 'price'] },
            { model: Driver, attributes: ['id', 'name', 'phone'] },
          ],
          order: [['created_at', 'DESC']],
        }),
        DriverTransaction.findAll({
          where: { type: 'wallet', created_at: range.where },
          include: [{ model: Driver, attributes: ['id', 'name', 'phone'] }],
          order: [['created_at', 'DESC']],
        }),
        DriverRechargeRequest.sum('amount', { where: { status: 'approved', requested_at: range.where } }),
        DriverPayoutRequest.sum('amount', { where: { status: 'approved', processed_at: range.where } }),
        Driver.sum('wallet'),
        DriverPayoutRequest.count({ where: { status: 'pending' } }),
      ]);

      const subscriptionRevenue = subscriptions.reduce((s, x) => s + (parseFloat(x.subscription?.price) || 0), 0);
      const rideCommission = rideDeductions.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);

      // Daily series for the chart
      const days = dayList(range.from, range.to);
      const subByDay = Object.fromEntries(days.map(d => [d, 0]));
      const rideByDay = Object.fromEntries(days.map(d => [d, 0]));
      subscriptions.forEach(x => {
        const d = toYmd(new Date(x.created_at));
        if (d in subByDay) subByDay[d] += parseFloat(x.subscription?.price) || 0;
      });
      rideDeductions.forEach(x => {
        const d = toYmd(new Date(x.created_at));
        if (d in rideByDay) rideByDay[d] += parseFloat(x.amount) || 0;
      });

      // One combined list of earning entries
      const entries = [
        ...subscriptions.map(x => ({
          date: x.created_at,
          driver: x.Driver?.name || 'Unknown',
          driver_id: x.driver_id,
          source: 'Subscription',
          reference: x.subscription?.name || `Plan #${x.subscription_id}`,
          amount: money(x.subscription?.price),
        })),
        ...rideDeductions.map(x => ({
          date: x.created_at,
          driver: x.Driver?.name || 'Unknown',
          driver_id: x.driver_id,
          source: 'Ride Commission',
          reference: x.ride_id ? `Ride #${x.ride_id}` : (x.description || ''),
          amount: money(x.amount),
        })),
      ].sort((a, b) => new Date(b.date) - new Date(a.date));

      if (req.query.export === 'csv') {
        return sendCsv(res, `admin-earnings-${range.fromStr}-to-${range.toStr}.csv`, [
          { key: 'date', label: 'Date' },
          { key: 'driver', label: 'Driver' },
          { key: 'source', label: 'Source' },
          { key: 'reference', label: 'Reference' },
          { key: 'amount', label: 'Amount (GBP)' },
        ], entries);
      }

      res.render('admin/earnings_admin', {
        range,
        summary: {
          total: money(subscriptionRevenue + rideCommission),
          subscriptionRevenue: money(subscriptionRevenue),
          rideCommission: money(rideCommission),
          subscriptionCount: subscriptions.length,
          rideCount: rideDeductions.length,
          rechargeTotal: money(rechargeTotal),
          payoutTotal: money(payoutTotal),
          walletBalance: money(walletBalance),
          pendingPayouts,
        },
        chart: {
          days,
          subscription: days.map(d => money(subByDay[d])),
          ride: days.map(d => money(rideByDay[d])),
        },
        entries,
      });
    } catch (error) {
      console.error('admin_earnings error:', error);
      res.status(500).send('Something went wrong!');
    }
  };

  // Payout Requests: drivers withdrawing their wallet balance
  static payout_requests = async (req, res) => {
    try {
      const where = {};
      if (['pending', 'approved', 'rejected'].includes(req.query.status)) where.status = req.query.status;

      const requests = await DriverPayoutRequest.findAll({
        where,
        include: [{ model: Driver, as: 'driver', attributes: ['id', 'name', 'phone', 'wallet'] }],
        order: [['requested_at', 'DESC']],
      });

      const counts = await DriverPayoutRequest.findAll({
        attributes: ['status', [fn('COUNT', col('id')), 'count'], [fn('SUM', col('amount')), 'total']],
        group: ['status'],
        raw: true,
      });
      const stats = { pending: { count: 0, total: 0 }, approved: { count: 0, total: 0 }, rejected: { count: 0, total: 0 } };
      counts.forEach(c => { stats[c.status] = { count: Number(c.count), total: money(c.total) }; });

      res.render('admin/payout_requests', { requests, stats, status: where.status || 'all' });
    } catch (error) {
      console.error('payout_requests error:', error);
      res.status(500).send('Something went wrong!');
    }
  };

  static update_payout_status = async (req, res) => {
    const { id } = req.params;
    const { status, admin_note } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      req.flash('error', 'Invalid status.');
      return res.redirect('/payout-requests');
    }

    const t = await sequelize.transaction();
    try {
      const request = await DriverPayoutRequest.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
      if (!request || request.status !== 'pending') {
        await t.rollback();
        req.flash('error', 'Payout request not found or already processed.');
        return res.redirect('/payout-requests');
      }

      if (status === 'approved') {
        const driver = await Driver.findByPk(request.driver_id, { transaction: t, lock: t.LOCK.UPDATE });
        const amount = parseFloat(request.amount);
        if (!driver || (parseFloat(driver.wallet) || 0) < amount) {
          await t.rollback();
          req.flash('error', 'Driver wallet balance is lower than the payout amount.');
          return res.redirect('/payout-requests');
        }
        driver.wallet = money((parseFloat(driver.wallet) || 0) - amount);
        await driver.save({ transaction: t });

        await DriverTransaction.create({
          driver_id: driver.id,
          amount,
          type: 'payout',
          description: `Payout of £ ${amount.toFixed(2)} (request #${request.id})`,
        }, { transaction: t });
      }

      request.status = status;
      request.admin_note = admin_note || null;
      request.processed_at = new Date();
      await request.save({ transaction: t });
      await t.commit();

      const amountText = `£${parseFloat(request.amount).toFixed(2)}`;
      await createNotification({
        title: status === 'approved' ? 'Payout Approved ✅' : 'Payout Rejected ❌',
        body: status === 'approved'
          ? `Your payout request of ${amountText} has been approved.`
          : `Your payout request of ${amountText} was rejected.${admin_note ? ' Note: ' + admin_note : ''}`,
        audience: 'driver',
        target_id: request.driver_id,
        type: 'payout',
        data: { payoutId: request.id, status },
      }, req.app.get('io'));

      req.flash('success', `Payout request #${request.id} ${status}.`);
      res.redirect('/payout-requests');
    } catch (error) {
      if (!t.finished) await t.rollback();
      console.error('update_payout_status error:', error);
      req.flash('error', 'Something went wrong.');
      res.redirect('/payout-requests');
    }
  };

  // Transactions: every money movement on driver accounts in one list
  static transaction_history = async (req, res) => {
    try {
      const range = getDateRange(req.query);
      const type = req.query.type || 'all';
      const driverId = req.query.driver_id ? parseInt(req.query.driver_id) : null;
      const byDriver = driverId ? { driver_id: driverId } : {};

      const want = t => type === 'all' || type === t;
      const driverInclude = { model: Driver, attributes: ['id', 'name', 'phone'] };

      const [rideTx, recharges, subs, payouts, drivers] = await Promise.all([
        want('ride') || want('payout')
          ? DriverTransaction.findAll({
            where: {
              ...byDriver,
              created_at: range.where,
              type: type === 'ride' ? { [Op.in]: ['wallet', 'subscription'] }
                : type === 'payout' ? 'payout'
                  : { [Op.ne]: null },
            },
            include: [driverInclude],
          })
          : [],
        want('recharge')
          ? DriverRechargeRequest.findAll({ where: { ...byDriver, requested_at: range.where }, include: [driverInclude] })
          : [],
        want('subscription')
          ? DriverSubscription.findAll({
            where: { ...byDriver, created_at: range.where },
            include: [driverInclude, { model: Subscriptions, as: 'subscription', attributes: ['name', 'price'] }],
          })
          : [],
        // pending/rejected payouts are shown here; approved ones already appear as DriverTransaction 'payout'
        want('payout')
          ? DriverPayoutRequest.findAll({
            where: { ...byDriver, requested_at: range.where, status: { [Op.ne]: 'approved' } },
            include: [{ ...driverInclude, as: 'driver' }],
          })
          : [],
        Driver.findAll({ attributes: ['id', 'name', 'phone'], order: [['name', 'ASC']] }),
      ]);

      const labelFor = { wallet: 'Ride Charge', subscription: 'Ride (Subscription Miles)', payout: 'Payout', fare: 'Fare', bonus: 'Bonus', penalty: 'Penalty' };
      const transactions = [
        ...rideTx.map(x => ({
          date: x.created_at,
          driver: x.Driver?.name || 'Unknown',
          driver_id: x.driver_id,
          type: labelFor[x.type] || x.type,
          direction: ['bonus'].includes(x.type) ? 'credit' : (x.type === 'subscription' ? 'none' : 'debit'),
          amount: money(x.amount),
          status: 'completed',
          description: x.type === 'subscription' ? `${x.distance} miles used — ${x.description || ''}` : (x.description || ''),
        })),
        ...recharges.map(x => ({
          date: x.requested_at,
          driver: x.Driver?.name || 'Unknown',
          driver_id: x.driver_id,
          type: 'Wallet Recharge',
          direction: 'credit',
          amount: money(x.amount),
          status: x.status,
          description: [x.payment_method, x.transaction_id].filter(Boolean).join(' • '),
        })),
        ...subs.map(x => ({
          date: x.created_at,
          driver: x.Driver?.name || 'Unknown',
          driver_id: x.driver_id,
          type: 'Subscription Purchase',
          direction: 'debit',
          amount: money(x.subscription?.price),
          status: x.status,
          description: `${x.subscription?.name || 'Plan'} (${x.start_date} → ${x.end_date})`,
        })),
        ...payouts.map(x => ({
          date: x.requested_at,
          driver: x.driver?.name || 'Unknown',
          driver_id: x.driver_id,
          type: 'Payout Request',
          direction: 'debit',
          amount: money(x.amount),
          status: x.status,
          description: x.payout_method || '',
        })),
      ].sort((a, b) => new Date(b.date) - new Date(a.date));

      if (req.query.export === 'csv') {
        return sendCsv(res, `transactions-${range.fromStr}-to-${range.toStr}.csv`, [
          { key: 'date', label: 'Date' },
          { key: 'driver', label: 'Driver' },
          { key: 'type', label: 'Type' },
          { key: 'direction', label: 'Credit/Debit' },
          { key: 'amount', label: 'Amount (GBP)' },
          { key: 'status', label: 'Status' },
          { key: 'description', label: 'Description' },
        ], transactions);
      }

      res.render('admin/transaction_history', { transactions, drivers, range, type, driverId });
    } catch (error) {
      console.error('transaction_history error:', error);
      res.status(500).send('Something went wrong!');
    }
  };
  // App API: driver asks to withdraw wallet balance
  // POST /api/driver/payout-request { driver_id, amount, payout_method, account_details, request_note }
  static api_payout_request = async (req, res) => {
    try {
      const { driver_id, payout_method, account_details, request_note } = req.body;
      const amount = parseFloat(req.body.amount);
      if (!driver_id || !(amount > 0)) {
        return res.status(400).json({ success: false, message: 'driver_id and a positive amount are required' });
      }

      const driver = await Driver.findByPk(driver_id, { attributes: ['id', 'wallet'] });
      if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

      // Money already locked in other pending requests can't be requested again
      const pending = parseFloat(await DriverPayoutRequest.sum('amount', { where: { driver_id, status: 'pending' } })) || 0;
      const available = money((parseFloat(driver.wallet) || 0) - pending);
      if (amount > available) {
        return res.status(400).json({ success: false, message: `Amount exceeds available balance (£${available})`, available_balance: available });
      }

      const request = await DriverPayoutRequest.create({
        driver_id, amount, payout_method, account_details, request_note, status: 'pending',
      });
      res.status(201).json({ success: true, message: 'Payout request submitted', data: request });
    } catch (error) {
      console.error('api_payout_request error:', error);
      res.status(500).json({ success: false, message: 'Something went wrong' });
    }
  };

  // POST /api/driver/payout-history { driver_id }
  static api_payout_history = async (req, res) => {
    try {
      const { driver_id } = req.body;
      if (!driver_id) return res.status(400).json({ success: false, message: 'driver_id is required' });
      const data = await DriverPayoutRequest.findAll({ where: { driver_id }, order: [['requested_at', 'DESC']] });
      res.json({ success: true, data });
    } catch (error) {
      console.error('api_payout_history error:', error);
      res.status(500).json({ success: false, message: 'Something went wrong' });
    }
  };
}

module.exports = accountcontroller;
