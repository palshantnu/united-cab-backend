const express = require('express')
const router = express.Router()
const path = require('path');
const admincontroller = require('../controllers/admincontroller')
const vehiclecontroller = require('../controllers/vehiclecontroller')
const drivercontroller = require('../controllers/drivercontroller')
const bookingcontroller = require('../controllers/bookingcontroller')
const checkuserauth = require('../middleware/auth');
const upload = require('../middleware/multer');

router.get('/home',checkuserauth, admincontroller.home); // Dashboard
router.get('/drivers', drivercontroller.driver_list); // Drivers List
router.get('/users', admincontroller.users_list); // Users List

router.get('/',admincontroller.login);
router.post('/logincheck',admincontroller.logincheck);
router.get('/logout',admincontroller.logout);

// .................../Booking History.................
router.get('/bookings', bookingcontroller.booking_list); 
router.get('/bookings-details/:id', bookingcontroller.booking_details);

// .................Vehicles Start.....................
router.get('/vehicles', vehiclecontroller.vehicle_list); 
router.post('/vehicle/store', upload.fields([
  { name: 'vehicle_image', maxCount: 1 },
  { name: 'vehicle_logo', maxCount: 1 }
]), vehiclecontroller.store_vehicle);
router.get('/vehicles/delete/:id', vehiclecontroller.delete_vehicle);

module.exports=router