const express = require('express')
const router = express.Router()
const path = require('path');
const admincontroller = require('../controllers/admincontroller')
const vehiclecontroller = require('../controllers/vehiclecontroller')
const drivercontroller = require('../controllers/drivercontroller')
const bookingcontroller = require('../controllers/bookingcontroller')
const accountcontroller = require('../controllers/accountcontroller')
const reportcontroller = require('../controllers/reportcontroller')
const notificationcontroller = require('../controllers/notificationcontroller')
const checkuserauth = require('../middleware/auth');
const upload = require('../middleware/multer');
const driverProfileUpload = require('../middleware/driverProfileUpload');
router.get('/home',checkuserauth, admincontroller.home); // Dashboard
router.get('/users', admincontroller.users_list); // Users List
router.post('/user/update/:id', admincontroller.update_user);
router.get('/deleteuser',admincontroller.deleteuser);
router.get('/',admincontroller.login);
router.post('/logincheck',admincontroller.logincheck);
router.get('/logout',admincontroller.logout);
router.get('/subscriptionplan_list',admincontroller.subscriptionplan_list);
router.post('/subscription/add', admincontroller.add_subscriptionplan);
router.get('/subscription/edit/:id', admincontroller.edit_subscriptionplan);
router.post('/subscription/update', admincontroller.update_subscriptionplan);
router.get("/cms", admincontroller.support);
router.post("/cms/save", admincontroller.savePage);


//....................................................Driver.........................................................................................../
router.get('/drivers', drivercontroller.driver_list); 
router.get('/driver/edit/:id', checkuserauth, drivercontroller.driver_edit);
router.post('/driver/update/:id', checkuserauth, driverProfileUpload.single('profile_photo'), drivercontroller.driver_update);
router.post('/driver/:id/wallet-adjust', checkuserauth, drivercontroller.wallet_adjust);
router.post('/driver/document/:docId/verify', checkuserauth, drivercontroller.toggle_document_verify);
router.get('/driver/:id', drivercontroller.driver_detail);
router.get('/driver-recharge-history', drivercontroller.recharge_history_history);
router.post('/recharge-request/update-status/:id',drivercontroller.updateRechargeStatus);
router.get('/admin/driver/delete/:id', drivercontroller.delete_driver);

// router.get('/driver-subscription-history', drivercontroller.driver_subscription_history);
// router.post('/driver-subscriptions/:id/activate', drivercontroller.activate_driver_subscription);
// // Cancel subscription
// router.post('/driver-subscriptions/:id/cancel', drivercontroller.cancel_driver_subscription);

router.get('/driver/status/:id', drivercontroller.toggle_driver_status);
// ...................Booking History.................
router.get('/bookings', bookingcontroller.booking_list);
router.get('/bookings-details/:id', bookingcontroller.booking_details);
router.get('/bookings/delete/:id', bookingcontroller.booking_delete);
router.post('/bookings/delete-multiple', bookingcontroller.booking_delete_multiple);
router.get('/bookings/cancel/:id', bookingcontroller.cancel_booking);

// .................Vehicles Start.....................
router.get('/vehicles', vehiclecontroller.vehicle_list); 
router.get('/holidaylist', vehiclecontroller.holiday_list); 
router.get('/holiday/edit/:id', vehiclecontroller.holiday_edit); 
router.post('/holidays/update/:id', vehiclecontroller.holiday_update);


router.post('/vehicle/store', upload.fields([
  { name: 'vehicle_image', maxCount: 1 },
  { name: 'vehicle_logo', maxCount: 1 }
]), vehiclecontroller.store_vehicle);
router.get('/vehicles/delete/:id', vehiclecontroller.delete_vehicle);
router.get('/vehicles/edit/:id', vehiclecontroller.edit_vehicle);
router.post('/vehicles/update/:id', upload.fields([
  { name: 'vehicle_image', maxCount: 1 },
  { name: 'vehicle_logo', maxCount: 1 }
]), vehiclecontroller.update_vehicle);

// .................Admin Profile.....................
router.get('/profile', checkuserauth, admincontroller.profile);
router.post('/profile/update', checkuserauth, admincontroller.profile_update);
router.post('/profile/password', checkuserauth, admincontroller.password_update);

// Sidebar sections that are not built yet
router.get(['/coupons', '/banners', '/tickets', '/complaints', '/settings/general', '/settings/app-config', '/settings/roles', '/settings/logs'],
  checkuserauth, admincontroller.coming_soon);

// .................Accounts & Earnings.....................
router.get('/earnings/admin', checkuserauth, accountcontroller.admin_earnings);
router.get('/payout-requests', checkuserauth, accountcontroller.payout_requests);
router.post('/payout-requests/update-status/:id', checkuserauth, accountcontroller.update_payout_status);
router.get('/transaction-history', checkuserauth, accountcontroller.transaction_history);

// .................Reports.....................
router.get('/reports/trips', checkuserauth, reportcontroller.trip_report);
router.get('/reports/drivers', checkuserauth, reportcontroller.driver_report);
router.get('/reports/revenue', checkuserauth, reportcontroller.revenue_report);

// .................Push Notifications.....................
router.get('/push-notifications', checkuserauth, notificationcontroller.push_notifications);
router.post('/push-notifications/send', checkuserauth, notificationcontroller.send_notification);
router.post('/push-notifications/delete/:id', checkuserauth, notificationcontroller.delete_notification);

module.exports=router