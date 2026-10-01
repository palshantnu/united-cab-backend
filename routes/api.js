const express = require('express')
const router = express.Router()
const ApiController = require('../controllers/API/ApiController')
console.log("Loaded ApiController:", Object.keys(ApiController));
const LocationController = require('../controllers/API/LocationController');
const RideController = require('../controllers/API/RideController');
const accountcontroller = require('../controllers/accountcontroller');
const notificationcontroller = require('../controllers/notificationcontroller');
const driverProfileUpload = require('../middleware/driverProfileUpload');
const userProfileUpload = require('../middleware/userprofile');

// User OTP endpoints
router.get('/cmslist', ApiController.cms_list);
router.post('/sendnotification', ApiController.sendnotification);
router.post('/user/send-otp', ApiController.sendUserOtp);
router.post('/user/verify-otp', ApiController.verifyUserOtp);
router.post('/user_profile', ApiController.user_profile);
router.post('/user_profile_update',userProfileUpload.single('profile'),ApiController.user_profile_update);
router.post("/user/login",      ApiController.user_login);
router.post("/user/register",   ApiController.user_register);
router.post("/driver/login",    ApiController.driver_login);
router.post("/driver/register", ApiController.driver_register);
// Driver OTP endpoints
router.post('/driver/send-otp', ApiController.sendDriverOtp);
router.post('/driver/verify-otp', ApiController.verifyDriverOtp);
router.get('/driver/report', ApiController.driverReport);

// Driver registration endpoints
router.post('/driver-register', ApiController.driver_register);
router.post('/driver_recharge_request', ApiController.driver_recharge_request);
router.post('/driver_recharge_history', ApiController.driver_recharge_history);
router.post('/driver/subscription-history', ApiController.driver_subscription_history);
router.get('/vehicle-types', ApiController.vehicle_types);
// Location endpoints
router.get('/drivers/nearby', LocationController.getNearbyDrivers);
router.post('/drivers/active-nearby', LocationController.getActiveNearbyDrivers);
router.post('/driver/send-location', LocationController.driversendlocation);
router.post('/location/update', LocationController.updateLocation);
router.post('/driverlocation/update', LocationController.driverupdateLocation);
router.get("/ride/driver-location/:ride_id",LocationController.getDriverLiveLocation);
// Ride endpoints
router.post('/rides/request', RideController.requestRide);
router.post('/user/pending/ride', RideController.getUserPendingRide);
router.post('/driverride/pending', RideController.getDriverPendingRide);
router.post('/driver/pending/ride', RideController.getDriverAcceptedRide);
router.post('/user/ReviewRide', RideController.userReviewRide);
router.post('/driver/driverReviewRide', RideController.driverReviewRide);
router.post('/rides/accept', RideController.acceptRide);
router.post('/rides/cancel', RideController.cancelRide);
router.post('/rides/complete', RideController.completeRide);
router.post('/rides/driver/history', RideController.ride_history);
router.post('/rides/user/history', RideController.userride_history);
router.get('/ride-status/:rideId', RideController.getRideStatus);
router.get('/getRideDetails/:rideId', RideController.getRideDetails);
router.post('/ride/update-status', RideController.updateRideStatus);
router.post('/user/cancel-ride', RideController.cancelRideByUser);
router.post('/driver-profile', RideController.driver_profile);
router.post('/driver_status_update', RideController.driver_status_update);
router.post('/driver_status_get', RideController.driver_status_get);
router.post('/driver_profile_update',driverProfileUpload.single('profile_photo'),RideController.driver_profile_update);
router.post('/drivers/transactions', RideController.getDriverTransactions);
router.post('/wallet/get',RideController. getWallet);
router.post('/getPendingRequests', RideController.getPendingRequests);
// Driver payouts
router.post('/driver/payout-request', accountcontroller.api_payout_request);
router.post('/driver/payout-history', accountcontroller.api_payout_history);
// Admin notifications inbox (user / driver app)
router.post('/notifications', notificationcontroller.api_list);
router.post('/notifications/unread-count', notificationcontroller.api_unread_count);
router.post('/notifications/read', notificationcontroller.api_mark_read);

// Wallet endpoints
// router.post('/driver/wallet', ApiController.driverwallet);
// ...........................test..................
router.get('/users/list', ApiController.user_list);
router.get('/driver/list', ApiController.driver_list);
router.post('/driver/delete', ApiController.driver_soft_delete);
router.post('/user/delete', ApiController.user_soft_delete);
router.get('/ride/list', ApiController.ride_list);
router.get('/subscriptionplan', ApiController.get_driver_subscriptions);
router.post('/purchase_subscription', ApiController.purchase_subscription);
router.post('/stripe_paymentgateway', ApiController.stripe_paymentgateway);



module.exports = router;