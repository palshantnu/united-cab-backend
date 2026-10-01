const fs = require("fs");
const path = require("path"); // Add this line to import the 'path' module
const { Driver, VehicleType, DriverDocument,Wallet, DriverRechargeRequest,DriverSubscription,Subscriptions,
  Ride, User, DriverTransaction, Rating_Reviews, DriverPayoutRequest } = require("../models/index");
const { Op, fn, col, literal } = require("sequelize");
const { createNotification } = require("../services/notificationService");

class drivercontroller {
 static driver_list = async (req, res) => {
  try {
    const today = new Date();

    const drivers = await Driver.findAll({
      include: [
        {
          model: VehicleType,
          attributes: ["type_name","shift_type"],
        },
        {
          model: DriverDocument,
          attributes: ["vehicle_number"],
        },
        {
          model: Wallet,
          attributes: ["balance"],
        },
      ],
    });
    res.render("admin/driver_list", { drivers });

  } catch (error) {
    console.error(error);
    res.status(500).send("Something went wrong!");
  }
 };

  static recharge_history_history = async (req, res) => {
    try {
      const drivers = await DriverRechargeRequest.findAll({
        include: [{
          model: Driver,
          as: 'driver',
          attributes: ['name', 'phone'],
        }],
        order: [['requested_at', 'DESC']],
      });

      res.render("admin/driver_recharge_history", { drivers });
    } catch (error) {
      console.error("Error fetching recharge history:", error);
      res.status(500).send("Something went wrong!");
    }
  };

  static updateRechargeStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).send('Invalid status.');
    }

    try {
      const request = await DriverRechargeRequest.findByPk(id);

      if (!request) {
        return res.status(404).send('Recharge request not found.');
      }

      if (request.status !== 'pending') {
        return res.status(400).send('Status already updated.');
      }

      // Begin transaction (optional for safety)
      const t = await DriverRechargeRequest.sequelize.transaction();

      try {
        // Update recharge request status
        request.status = status;
        request.processed_at = new Date();
        await request.save({ transaction: t });

        // If approved, update driver's wallet
        if (status === 'approved') {
          const driver = await Driver.findByPk(request.driver_id, { transaction: t });

          if (!driver) {
            await t.rollback();
            return res.status(404).send('Driver not found.');
          }

          driver.wallet = (driver.wallet || 0) + parseFloat(request.amount);
          await driver.save({ transaction: t });
        }

        await t.commit();
        res.redirect('/driver-recharge-history');
      } catch (innerError) {
        await t.rollback();
        throw innerError;
      }

    } catch (error) {
      console.error('Status update failed:', error);
      res.status(500).send('Something went wrong.');
    }
  };

  static driver_detail = async (req, res) => {
    const driverId = req.params.id;

    try {
      const driver = await Driver.findOne({
        where: { id: driverId },
        include: [{ model: VehicleType }, { model: DriverDocument }],
      });

      if (!driver) {
        return res.status(404).send("Driver not found");
      }

      const [rideStats, recentRides, transactions, activeSubscription, ratingStats, pendingPayouts, vehicles] = await Promise.all([
        Ride.findOne({
          where: { driver_id: driverId },
          attributes: [
            [fn('COUNT', col('id')), 'total'],
            [fn('SUM', literal("CASE WHEN status = 'completed' THEN 1 ELSE 0 END")), 'completed'],
            [fn('SUM', literal("CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END")), 'cancelled'],
            [fn('SUM', literal("CASE WHEN status = 'completed' THEN final_fare ELSE 0 END")), 'earnings'],
            [fn('SUM', literal("CASE WHEN status = 'completed' THEN distance_km ELSE 0 END")), 'distance'],
          ],
          raw: true,
        }),
        Ride.findAll({
          where: { driver_id: driverId },
          include: [{ model: User, as: 'user', attributes: ['name', 'phone'] }],
          order: [['created_at', 'DESC']],
          limit: 10,
        }),
        DriverTransaction.findAll({ where: { driver_id: driverId }, order: [['created_at', 'DESC']], limit: 10 }),
        DriverSubscription.findOne({
          where: { driver_id: driverId, status: 'active', end_date: { [Op.gte]: new Date() } },
          include: [{ model: Subscriptions, as: 'subscription', attributes: ['name', 'mile', 'price'] }],
          order: [['end_date', 'DESC']],
        }),
        Rating_Reviews.findOne({
          where: { driver_id: driverId, rated_by_user: { [Op.gt]: 0 } },
          attributes: [[fn('AVG', col('rated_by_user')), 'avg'], [fn('COUNT', col('id')), 'count']],
          raw: true,
        }),
        DriverPayoutRequest.count({ where: { driver_id: driverId, status: 'pending' } }),
        VehicleType.findAll({ attributes: ['id', 'type_name'] }),
      ]);

      const total = Number(rideStats?.total) || 0;
      const completed = Number(rideStats?.completed) || 0;
      const stats = {
        total,
        completed,
        cancelled: Number(rideStats?.cancelled) || 0,
        completionRate: total ? Math.round((completed / total) * 100) : 0,
        earnings: parseFloat(rideStats?.earnings) || 0,
        distance: parseFloat(rideStats?.distance) || 0,
        rating: ratingStats?.avg ? parseFloat(ratingStats.avg).toFixed(1) : (driver.rating ? Number(driver.rating).toFixed(1) : null),
        ratingCount: Number(ratingStats?.count) || 0,
      };

      res.render("admin/driver_detail", {
        driver, stats, recentRides, transactions, activeSubscription, pendingPayouts, vehicles,
        photoUrl: drivercontroller.fileUrl(driver.profile_photo, '/upload/driver_profiles/'),
        docUrl: file => drivercontroller.fileUrl(file, '/uploads/documents/'),
      });
    } catch (error) {
      console.log(error);
      res.status(500).send("Something went wrong!");
    }
  };

  // Stored paths are sometimes full ("/upload/x.jpg"), sometimes just a file name
  static fileUrl(value, defaultDir) {
    if (!value) return null;
    if (/^https?:\/\//.test(value) || value.startsWith('/')) return value;
    return defaultDir + value;
  }

  static driver_edit = async (req, res) => {
    try {
      const driver = await Driver.findByPk(req.params.id, { include: [{ model: VehicleType }] });
      if (!driver) return res.status(404).send("Driver not found");
      const vehicles = await VehicleType.findAll({ attributes: ['id', 'type_name', 'shift_type'] });
      res.render("admin/driver_edit", {
        driver, vehicles,
        photoUrl: drivercontroller.fileUrl(driver.profile_photo, '/upload/driver_profiles/'),
      });
    } catch (error) {
      console.error('driver_edit error:', error);
      res.status(500).send("Something went wrong!");
    }
  };

  static driver_update = async (req, res) => {
    const { id } = req.params;
    const back = `/driver/edit/${id}`;
    try {
      const driver = await Driver.findByPk(id);
      if (!driver) return res.status(404).send("Driver not found");

      const name = (req.body.name || '').trim();
      const phone = (req.body.phone || '').trim();
      const countryCode = (req.body.country_code || '').trim();
      if (!name || !phone) {
        req.flash('error', 'Name and phone are required.');
        return res.redirect(back);
      }

      const duplicate = await Driver.findOne({
        where: { phone, country_code: countryCode || driver.country_code, id: { [Op.ne]: driver.id } },
        attributes: ['id'],
      });
      if (duplicate) {
        req.flash('error', `Phone number is already used by driver #${duplicate.id}.`);
        return res.redirect(back);
      }

      const vehicleId = req.body.vehicle_id ? parseInt(req.body.vehicle_id) : null;
      if (vehicleId && !(await VehicleType.count({ where: { id: vehicleId } }))) {
        req.flash('error', 'Selected vehicle type does not exist.');
        return res.redirect(back);
      }

      Object.assign(driver, {
        name,
        phone,
        country_code: countryCode || driver.country_code,
        gender: req.body.gender || null,
        license_number: (req.body.license_number || '').trim() || null,
        vehicle_id: vehicleId,
        vehicle_number: (req.body.vehicle_number || '').trim() || null,
        vehicle_model: (req.body.vehicle_model || '').trim() || null,
        phone_varified: req.body.phone_varified === '1',
      });

      // 2 = currently on a trip; only switch between active / inactive when the admin changes it
      if (req.body.status === '0') driver.status = 0;
      else if (req.body.status === '1' && driver.status == 0) driver.status = 1;

      if (req.file) {
        const oldPhoto = driver.profile_photo;
        driver.profile_photo = `/upload/driver_profiles/${req.file.filename}`;
        if (oldPhoto && oldPhoto.startsWith('/upload/driver_profiles/')) {
          fs.unlink(path.join(__dirname, '..', 'public', oldPhoto), () => {});
        }
      }

      await driver.save();
      req.flash('success', 'Driver details updated.');
      res.redirect(`/driver/${driver.id}`);
    } catch (error) {
      console.error('driver_update error:', error);
      req.flash('error', 'Could not update driver.');
      res.redirect(back);
    }
  };

  // Manual credit / debit on the driver wallet (recorded as bonus / penalty)
  static wallet_adjust = async (req, res) => {
    const { id } = req.params;
    const amount = parseFloat(req.body.amount);
    const direction = req.body.direction;
    const reason = (req.body.reason || '').trim();

    if (!(amount > 0) || !['credit', 'debit'].includes(direction) || !reason) {
      req.flash('error', 'Amount, type and reason are required.');
      return res.redirect(`/driver/${id}`);
    }

    const t = await Driver.sequelize.transaction();
    try {
      const driver = await Driver.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
      if (!driver) {
        await t.rollback();
        return res.status(404).send("Driver not found");
      }
      const current = parseFloat(driver.wallet) || 0;
      if (direction === 'debit' && amount > current) {
        await t.rollback();
        req.flash('error', `Cannot debit £${amount.toFixed(2)} — wallet has only £${current.toFixed(2)}.`);
        return res.redirect(`/driver/${id}`);
      }

      driver.wallet = Number((direction === 'credit' ? current + amount : current - amount).toFixed(2));
      await driver.save({ transaction: t });
      await DriverTransaction.create({
        driver_id: driver.id,
        amount,
        type: direction === 'credit' ? 'bonus' : 'penalty',
        description: `Admin ${direction}: ${reason}`,
      }, { transaction: t });
      await t.commit();

      await createNotification({
        title: direction === 'credit' ? 'Wallet Credited 💰' : 'Wallet Debited',
        body: `£${amount.toFixed(2)} has been ${direction === 'credit' ? 'added to' : 'deducted from'} your wallet. Reason: ${reason}`,
        audience: 'driver',
        target_id: driver.id,
        type: 'system',
        data: { wallet: driver.wallet },
      }, req.app.get('io'));

      req.flash('success', `Wallet ${direction === 'credit' ? 'credited' : 'debited'} by £${amount.toFixed(2)}.`);
      res.redirect(`/driver/${id}`);
    } catch (error) {
      if (!t.finished) await t.rollback();
      console.error('wallet_adjust error:', error);
      req.flash('error', 'Could not adjust wallet.');
      res.redirect(`/driver/${id}`);
    }
  };

  static toggle_document_verify = async (req, res) => {
    try {
      const doc = await DriverDocument.findByPk(req.params.docId);
      if (!doc) return res.status(404).send("Document not found");
      doc.verified = !doc.verified;
      await doc.save();
      req.flash('success', `Document marked as ${doc.verified ? 'verified' : 'not verified'}.`);
      res.redirect(`/driver/${doc.driver_id}`);
    } catch (error) {
      console.error('toggle_document_verify error:', error);
      res.status(500).send("Something went wrong!");
    }
  };

  static toggle_driver_status = async (req, res) => {
    const driverId = req.params.id;

    try {
      const driver = await Driver.findByPk(driverId);

      if (!driver) {
        return res.status(404).send("Driver not found");
      }
      console.log(driver.status )
      // Toggle status: if 1 then 0 else 1
      driver.status = driver.status == 1 ? 0 : 1;
      console.log(driver.status )
      await driver.save();

      // Redirect back to the previous page or fallback to driver list
      res.redirect(req.get('referer') || '/admin/driver_list');
    } catch (error) {
      console.error(error);
      res.status(500).send("Something went wrong!");
    }
  };

 static driver_subscription_history = async (req, res) => {
  try {
    const subscriptions = await DriverSubscription.findAll({
      include: [
        {
          model: Driver,
          as: 'driver',
          attributes: ['name', 'phone'],
        },
        {
          model: Subscriptions,
          as: 'subscription',
          attributes: ['name', 'duration_days', 'price','mile'],
        }
      ],
      order: [['created_at', 'DESC']],
    });

    res.render("admin/driver_subscription_history", { subscriptions });
  } catch (error) {
    console.error("Error fetching driver subscription history:", error);
    res.status(500).send("Something went wrong!");
  }
};

static activate_driver_subscription = async (req, res) => {
  try {
    const { id } = req.params;

    const driverSub = await DriverSubscription.findOne({
      where: { id },
      include: [
        {
          model: Subscriptions,
          as: 'subscription',
          attributes: ['mile', 'duration_days'],
        },
      ],
    });

    if (!driverSub) {
      return res.status(404).send("Driver subscription not found");
    }

    const existingSub = await DriverSubscription.findOne({
      where: {
        driver_id: driverSub.driver_id,
        id: { [Op.ne]: driverSub.id },
      },
      order: [['created_at', 'DESC']],
    });

    if (existingSub && existingSub.status === 'active') {
      return res.redirect('/admin/driver-subscription-history');
    }

    if (
      !existingSub ||
      existingSub.status === 'cancelled' ||
      existingSub.status === 'expired'
    ) {
      const today = new Date();
      const endDate = new Date();
      endDate.setDate(today.getDate() + driverSub.subscription.duration_days);

      driverSub.status = 'active';
      driverSub.mile = driverSub.subscription.mile;
      driverSub.start_date = today;
      driverSub.end_date = endDate;

      await driverSub.save();

      return res.redirect('/admin/driver-subscription-history');
    }
    return res.status(400).send("Plan cannot be activated due to current subscription status.");
   } catch (err) {
    console.error('Activation error:', err);
    res.status(500).send("Failed to activate subscription");
  }
};


static cancel_driver_subscription = async (req, res) => {
  try {
    const { id } = req.params;

    const driverSub = await DriverSubscription.findOne({ where: { id } });

    if (!driverSub) {
      return res.status(404).send("Driver subscription not found");
    }

    driverSub.status = 'cancelled';
    await driverSub.save();

    res.redirect('/admin/driver-subscription-history');
  } catch (err) {
    console.error('Cancel error:', err);
    res.status(500).send("Failed to cancel subscription");
  }
};

static delete_driver = async (req, res) => {
  try {
    const { id } = req.params;
    const driver = await Driver.findOne({ where: { id } });
    if (!driver) {
      return res.status(404).send("Driver not found");
    }
    await driver.destroy(); 
    res.redirect('/drivers'); 
  } catch (err) {
    console.error('Delete driver error:', err);
    res.status(500).send("Failed to delete driver");
  }
};





}
module.exports = drivercontroller;
