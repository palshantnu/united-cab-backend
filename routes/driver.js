const express = require('express');
const router = express.Router();
const DriverController = require('../controllers/DriverController');
const { uploadDriverProfile } = require('../middleware/multer');

// 👇 POST route to update driver profile
router.post('/driver/update-profile', uploadDriverProfile, DriverController.driver_profile_update);

module.exports = router;
