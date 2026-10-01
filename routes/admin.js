const express = require('express');
const router = express.Router();

const drivercontroller = require('../controllers/drivercontroller');

// Driver Subscription Routes
router.get('/driver-subscription-history', drivercontroller.driver_subscription_history);
router.post('/driver-subscriptions/:id/activate', drivercontroller.activate_driver_subscription);
router.post('/driver-subscriptions/:id/cancel', drivercontroller.cancel_driver_subscription);

module.exports = router;
