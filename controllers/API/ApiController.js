const {
  User,
  Driver,
  Otp,
  VehicleType,
  Wallet,
  Ride,
  DriverRechargeRequest,
  Holiday,
  Subscriptions,
  DriverSubscription,
  CmsPage
} = require("../../models/index");
const { Op } = require("sequelize");
const path = require('path');
const fs = require('fs');
const { literal } = require("sequelize");
const moment = require("moment");
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const admin = require('../../firebase');

class ApiController {

//----------------------------------------------------------|New Api User_register|--------------------------------------------------------/
  
  static user_login = async (req, res) => {
      try {
        const { phone, devicetoken } = req.body;

        if (!phone || !phone.trim()) {
          return res.status(400).json({ success: false, message: "Mobile number is required" });
        }

        const mobile = phone.trim();
        const user = await User.findOne({ where: { phone: mobile } });

        if (!user) {
          return res.status(200).json({
            success: true,
            is_registered: false,
            message: "User not registered, please complete registration",
          });
        }

        if (devicetoken) user.devicetoken = devicetoken;
        user.status = true;
        user.last_login = new Date();
        await user.save();

        return res.status(200).json({
          success: true,
          is_registered: true,
          message: "Login successful",
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            country_code: user.country_code,
            profile: user.profile,
            wallet: user.wallet,
          },
        });
      } catch (error) {
        console.error("User login error:", error);
        return res.status(500).json({ success: false, message: "Something went wrong" });
      }
    };


    static user_register = async (req, res) => {
        try {
          const { name, phone, country_code, devicetoken } = req.body;

          if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: "Name is required" });
          }
          if (!phone || !phone.trim()) {
            return res.status(400).json({ success: false, message: "Mobile number is required" });
          }
          if (!/^\d{6,15}$/.test(phone.trim())) {
            return res.status(400).json({ success: false, message: "Invalid mobile number" });
          }

        const mobile = phone.trim();

        let user = await User.findOne({ where: { phone: mobile } });
        let is_new_user = false;

        if (!user) {
          user = await User.create({
            name: name.trim(),
            phone: mobile,
            country_code: country_code || null,
            devicetoken: devicetoken || null,
            status: true,
            last_login: new Date(),
          });
          is_new_user = true;
        } else {
          user.name = name.trim();
          if (country_code) user.country_code = country_code;
          if (devicetoken) user.devicetoken = devicetoken;
          user.status = true;
          user.last_login = new Date();
          await user.save();
        }

        return res.status(is_new_user ? 201 : 200).json({
          success: true,
          message: is_new_user ? "User registered successfully" : "Login successful",
          is_new_user,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            country_code: user.country_code,
            profile: user.profile,
            wallet: user.wallet,
          },
        });
      } catch (error) {
        console.error("User register error:", error);
        return res.status(500).json({ success: false, message: "Something went wrong" });
      }
    };

//------------------------------------------------|driver_register|------------------------------------------------------------//

    static driver_login = async (req, res) => {
      try {
        const { phone, devicetoken } = req.body;

        if (!phone || !phone.trim()) {
          return res.status(400).json({ success: false, message: "Mobile number is required" });
        }

        const mobile = phone.trim();

        const driver = await Driver.findOne({
          where: { phone: mobile },
          include: [{
            model: VehicleType,
            attributes: ['type_name','label','vehicle_image', 'vehicle_logo']
          }]
        });

        if (!driver) {
          return res.status(200).json({
            success: true,
            is_registered: false,
            message: "Driver not registered, please complete registration",
          });
        }

        if (driver.status == 0) {
          return res.status(403).json({
            success: false,
            message: "Your account has been deactivated. Please contact support.",
          });
        }

        driver.phone_varified = true;          // Firebase pe verify ho chuka
        if (devicetoken) driver.devicetoken = devicetoken;
        await driver.save();

        const { password, ...safeDriver } = driver.get({ plain: true });

        return res.status(200).json({
          success: true,
          is_registered: true,
          message: "Login successful",
          driver: safeDriver,
        });
      } catch (error) {
        console.error("Driver login error:", error);
        return res.status(500).json({ success: false, message: "Something went wrong" });
      }
    };

    // ==================== DRIVER REGISTER ====================
    static driver_register = async (req, res) => {
      try {
        const {
          name, email, mobileNumber, gender, selectedCountry,
          vehicleType, vehicleNumber, vehicleModel, licenseNumber, devicetoken,
        } = req.body;

        if (!name || !mobileNumber || !selectedCountry || !vehicleType ||
            !vehicleNumber || !vehicleModel || !licenseNumber) {
          return res.status(400).json({ success: false, message: "All required fields are missing" });
        }

        if (!/^\d{6,15}$/.test(String(mobileNumber).trim())) {
          return res.status(400).json({ success: false, message: "Invalid mobile number" });
        }

        const mobile = String(mobileNumber).trim();

        const existingDriver = await Driver.findOne({ where: { phone: mobile } });
        if (existingDriver) {
          return res.status(409).json({
            success: false,
            message: "Driver already registered with this mobile number",
          });
        }

        const vehicle = await VehicleType.findByPk(vehicleType);
        if (!vehicle) {
          return res.status(400).json({ success: false, message: "Invalid vehicle type" });
        }

        const newDriver = await Driver.create({
          name: name.trim(),
          email: email || null,
          phone: mobile,
          gender: gender || null,
          country_code: selectedCountry,
          license_number: licenseNumber,
          vehicle_id: vehicleType,
          vehicle_number: vehicleNumber,
          vehicle_model: vehicleModel,
          devicetoken: devicetoken || null,
          status: 1,
          online_status: false,
          rating: 0.0,
          profile_photo: "",
          phone_varified: true,   // Firebase pe already verify ho chuka
        });

        const { password, ...safeDriver } = newDriver.get({ plain: true });

        return res.status(201).json({
          success: true,
          message: "Driver registered successfully",
          driver: safeDriver,
        });
      } catch (error) {
        console.error("Driver register error:", error);
        return res.status(500).json({ success: false, message: "Something went wrong" });
      }
    };
static cms_list = async (req, res) => {
  try {
    const pages = await CmsPage.findAll();
    res.status(200).json({
      message: "CMS data fetched successfully",
      data: pages,
    });

  } catch (error) {
    console.error("❌ Error:", error);
    res.status(500).json({
      message: "Something went wrong",
    });
  }
};

static async sendnotification(req, res) {
    try {
        const { token, title, body } = req.body;

        const message = {
            notification: { title, body },
            token
        };

        const response = await admin.messaging().send(message);
        res.json({ success: true, response });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
  }

  static generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }



  static async sendUserOtp(req, res) {
    const { phone, country_code } = req.body;
    if (!phone) {
      return res.status(400).json({ message: "Phone number is required" });
    }
    try {
      const otpCode = ApiController.generateOtp();
      const expiresAt = new Date(Date.now() + 5 * 60000); 
      await Otp.create({
        mobile: phone,
        otp_code: otpCode,
        user_type: "user",
        expires_at: expiresAt,
        verified: false,
        country_code: country_code,
      });
      console.log(`OTP ${otpCode} sent to user ${phone}`);
      res.json({ message: "OTP sent successfully" ,OTP:otpCode});
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Something went wrong" });
    }
  }

  static async verifyUserOtp(req, res) {
    const { phone, otp_code, country_code, devicetoken } = req.body;

    if (!phone || !otp_code) {
      return res
        .status(400)
        .json({ message: "Phone and OTP code are required" });
    }

    try {
      // Check OTP first
      const otp = await Otp.findOne({
        where: {
          mobile: phone,
          user_type: "user",
          otp_code,
          expires_at: { [Op.gt]: new Date() },
          verified: false,
          country_code: country_code,
        },
        order: [["created_at", "DESC"]],
      });

      if (!otp)
      return res.status(400).json({ message: "Invalid or expired OTP" });

      otp.verified = true;
      await otp.save();

      let user = await User.findOne({ where: { phone } });

      if (!user) {
        user = await User.create({
          phone,
          country_code,
          devicetoken: devicetoken || null,
          status: true,
          last_login: new Date(),
        });
      } else {
        user.last_login = new Date();
        if (devicetoken) {
          user.devicetoken = devicetoken;
        }
        await user.save();
      }

      await Otp.destroy({
        where: {
          mobile: phone,
          user_type: "user",
        },
      });

      res.json({
        message: "Login successful",
        user,
        is_new_user: !otp.user_id,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Something went wrong" });
    }
  }

  static async sendDriverOtp(req, res) {
    const { phone, country_code } = req.body;

    if (!phone) {
      return res.status(400).json({ message: "Phone number is required" });
    }

    try {
      const otpCode = ApiController.generateOtp();
      const expiresAt = new Date(Date.now() + 5 * 60000);
      await Otp.create({
        mobile: phone,
        otp_code: otpCode,
        user_type: "driver",
        expires_at: expiresAt,
        verified: false,
        country_code: country_code,
      });
      console.log(`Send OTP ${otpCode} to driver ${phone}`);
      res.json({ message: "OTP sent successfully" ,OTP:otpCode});
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Something went wrong" });
    }
  }

  static async verifyDriverOtp(req, res) {
    const { phone, otp_code, country_code, devicetoken } = req.body;

    if (!phone || !otp_code) {
      return res
        .status(400)
        .json({ message: "Phone and OTP code are required" });
    }

    try {
      const driver = await Driver.findOne({
        where: { phone },
      });

      if (!driver) {
        return res.status(404).json({
          message: "Driver not found or phone already verified",
        });
      }

      // Verify OTP
      const otp = await Otp.findOne({
        where: {
          mobile: phone,
          user_type: "driver",
          otp_code,
          expires_at: { [Op.gt]: new Date() },
          verified: false,
          country_code: country_code,
        },
        order: [["created_at", "DESC"]],
      });

      if (!otp) {
        return res.status(400).json({ message: "Invalid or expired OTP" });
      }

      // Update OTP record
      otp.verified = true;
      await otp.save();

      // Update driver's phone_verified status
      driver.phone_verified = true;

      // Update device token if provided
      if (devicetoken) {
        driver.devicetoken = devicetoken;
      }

      await driver.save();

      // Cleanup old OTPs
      await Otp.destroy({
        where: {
          mobile: phone,
          user_type: "driver",
        },
      });

      // Return success with driver data (exclude sensitive fields)
      const { password, ...safeDriverData } = driver.get({ plain: true });
      res.json({
        success: true,
        message: "OTP verified successfully",
        driver: safeDriverData,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

static driver_register = async (req, res) => {
  const {
    name,
    email,
    mobileNumber,
    gender,
    selectedCountry,
    vehicleType,
    vehicleNumber,
    vehicleModel,
    licenseNumber,
    devicetoken,
  } = req.body;

  if (
    !devicetoken ||
    !name ||
    !mobileNumber ||
    !selectedCountry ||
    !vehicleType ||
    !vehicleNumber ||
    !vehicleModel ||
    !licenseNumber
  ) {
    return res.status(400).json({ message: "All required fields are missing" });
  }

  try {
    const existingDriver = await Driver.findOne({
      where: { phone: mobileNumber },
    });

    if (existingDriver) {
      return res.status(409).json({
        message: "Driver already registered with this mobile number",
      });
    }

    const newDriver = await Driver.create({
      name,
      phone: mobileNumber,
      gender: gender || null,
      country_code: selectedCountry,
      license_number: licenseNumber,
      vehicle_id: vehicleType,
      vehicle_number: vehicleNumber,
      vehicle_model: vehicleModel,
      devicetoken,
      status: true,
      online_status: false,
      rating: 0.0,
      profile_photo: "",
      phone_varified: false,
    });

    return res.status(201).json({
      message: "Driver registered successfully",
      driver: newDriver,
    });
  } catch (error) {
    console.error("Driver register error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};


static vehicle_types = async (req, res) => {
  try {
    const currentTime = moment().format("HH:mm:ss");
    const todayDate = moment().format("YYYY-MM-DD");
    const isHoliday = !!await Holiday.findOne({
      where: { date: todayDate }
    });
    
    const timeCondition = literal(`
      (
        (start_time <= end_time AND '${currentTime}' BETWEEN start_time AND end_time)
        OR
        (start_time > end_time AND ('${currentTime}' >= start_time OR '${currentTime}' <= end_time))
      )
    `);
    const vehicle_types = await VehicleType.findAll({
      attributes: [
        "id",
        "type_name",
        "label",
        "description",
        "minimum_km",
        "minimum_fare",
        "fare_per_km",
        "vehicle_image",
        "vehicle_logo",
        "platform_fee",
        "start_time",
        "end_time",
        "shift_type",
        "is_holiday"
      ],
      where: {
        [Op.and]: [
          timeCondition,
          { is_holiday: isHoliday }
        ]
      }
    });

    return res.status(200).json({
      message: `Fetched ${isHoliday ? "holiday" : "normal"} vehicle types`,
      is_today_holiday: isHoliday,
      count: vehicle_types.length,
      vehicle_types
    });

  } catch (error) {
    console.error("❌ Error in vehicle_types API:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
};

static user_list = async (req, res) => {
    try {
      const users = await User.findAll();
      res
        .status(201)
        .json({ message: "send successfully", users: users });
     } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Something went wrong" });
    }
  };

  static driver_list = async (req, res) => {
    try {
      const drivers = await Driver.findAll();
      res
        .status(201)
        .json({ message: "send successfully", drivers: drivers });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Something went wrong" });
    }
  };

  static ride_list = async (req, res) => {
    try {
      const rides = await Ride.findAll();
      res
        .status(201)
        .json({ message: "send successfully", rides: rides });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Something went wrong" });
    }
  };

  static user_profile = async (req, res) => {
  try {
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ message: "user_id is required" });
    }

    const user = await User.findByPk(user_id, {
      attributes: ['name', 'email', 'phone','profile','wallet']
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "User profile fetched", user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Something went wrong" });
  }
  };

  static user_profile_update = async (req, res) => {
   try {
    const {
      user_id,
      name,
      email,
      phone
    } = req.body;

    if (!user_id) {
      return res.status(400).json({ message: "user_id is required" });
    }

    const user = await User.findByPk(user_id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // 🔍 Check if email already exists for another user
    if (email) {
      const existingEmailUser = await User.findOne({
        where: {
          email: email,
          id: { [Op.ne]: user_id } // exclude current user
        }
      });

      if (existingEmailUser) {
        return res.status(409).json({ message: "Email already in use by another user" });
      }
    }

    // 🔍 Check if phone already exists for another user
    if (phone) {
      const existingPhoneUser = await User.findOne({
        where: {
          phone: phone,
          id: { [Op.ne]: user_id }
        }
      });

      if (existingPhoneUser) {
        return res.status(409).json({ message: "Phone number already in use by another user" });
      }
    }

    // ✅ Update fields
    if (name) user.name = name;
    if (email) user.email = email;
    if (phone) user.phone = phone;

    // 📷 Handle profile photo upload
    if (req.file) {
      const oldPhotoPath = user.profile ? path.join(__dirname, '..', 'public', user.profile) : null;

      user.profile = `/upload/userprofile/${req.file.filename}`;

      if (oldPhotoPath && fs.existsSync(oldPhotoPath)) {
        fs.unlink(oldPhotoPath, (err) => {
          if (err) console.error("Failed to delete old profile photo:", err);
        });
      }
    }

    await user.save();

    const updatedProfile = await User.findOne({
      where: { id: user_id },
      attributes: ['id', 'name', 'email', 'phone', 'profile', 'wallet']
    });

    res.status(200).json({
      message: "User profile updated successfully",
      profile: updatedProfile
    });

  } catch (error) {
    console.error("User profile update error:", error);
    res.status(500).json({ message: "Error updating user profile" });
  }
  };

  static driver_recharge_request = async (req, res) => {
   try {
    const { driver_id, amount, payment_method, transaction_id, request_note } = req.body;

    if (!driver_id || !amount) {
      return res.status(400).json({ message: "Driver ID and amount are required" });
    }

    const driver = await Driver.findByPk(driver_id);
    if (!driver) {
      return res.status(404).json({ message: "Invalid Driver ID" });
    }

    // 1. Create Recharge Request with 'approved' status
    const newRequest = await DriverRechargeRequest.create({
      driver_id,
      amount,
      payment_method,
      transaction_id,
      request_note,
      status: 'approved' 
    });

    // 2. Update driver's wallet
    const newWalletBalance = (parseFloat(driver.wallet || 0) + parseFloat(amount));
    driver.wallet = newWalletBalance;
    await driver.save();

    // 3. Respond
    res.status(201).json({
      message: "Recharge request approved and wallet updated successfully",
      request: newRequest,
      updated_wallet_balance: newWalletBalance
    });

  } catch (error) {
    console.error("Recharge request error:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
  }

  static driver_recharge_history = async (req, res) => {
    try {
      const { driver_id } = req.body;
      console.log("Received driver_id:", driver_id); // Debug log

      const driver = await Driver.findByPk(parseInt(driver_id));  // Ensure correct type
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }

      const requests = await DriverRechargeRequest.findAll({
        where: { driver_id },
        order: [['requested_at', 'DESC']],
        attributes: [
          'id',
          'amount',
          'payment_method',
          'transaction_id',
          'status',
          'request_note',
          'admin_note',
          'requested_at',
          'processed_at'
        ]
      });

      res.status(200).json({
        message: `Recharge request history for driver ID ${driver_id}`,
        total_requests: requests.length,
        requests
      });
    } catch (error) {
      console.error("Fetch recharge history error:", error);
      res.status(500).json({ message: "Something went wrong" });
    }
  };

  static get_driver_subscriptions = async (req, res) => {
    try {
      const plans = await Subscriptions.findAll({
        order: [['price', 'ASC']], // Optional: sort by price or duration
      });

      res.status(200).json({
        success: true,
        message: "Subscription plans fetched successfully",
        data: plans
      });
    } catch (error) {
      console.error("Error fetching subscription plans:", error);
      res.status(500).json({
        success: false,
        message: "Something went wrong!",
        error: error.message
      });
    }
  };

  static purchase_subscription = async (req, res) => {
    const { driver_id, subscription_id } = req.body;
    try {
      const subscription = await Subscriptions.findByPk(subscription_id);
      if (!subscription) {
        return res.status(404).json({ success: false, message: "Subscription plan not found" });
      }

      // Check if driver already has an active subscription
      const existing = await DriverSubscription.findOne({
        where: {
          driver_id,
          status: 'active',
          end_date: {
            [Op.gte]: new Date().toISOString().split('T')[0] // still active
          }
        }
      });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: "You already have an active subscription"
        });
      }
      const startDate = new Date();
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + subscription.duration_days);

      await DriverSubscription.create({
        driver_id,
        subscription_id,
        mile :subscription.mile,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        status: 'active'
      });
      res.status(200).json({
        success: true,
        message: "Subscription purchased successfully",
      });

    } catch (error) {
      console.error("Purchase error:", error);
      res.status(500).json({ success: false, message: "Something went wrong", error: error.message });
    }
  };

  static driver_subscription_history = async (req, res) => {
    const { driver_id } = req.body;
    try {
      if (!driver_id) {
        return res.status(400).json({ success: false, message: "driver_id is required" });
      }

      const history = await DriverSubscription.findAll({
        where: { driver_id },
        include: [
          {
            model: Subscriptions,
            as: 'subscription',
            attributes: ['id', 'name', 'mile', 'duration_days', 'price']
          }
        ],
        order: [['created_at', 'DESC']]
      });

      res.status(200).json({
        success: true,
        message: "Subscription history fetched successfully",
        data: history
      });

    } catch (error) {
      console.error("History fetch error:", error);
      res.status(500).json({ success: false, message: "Something went wrong", error: error.message });
    }
  };

  static stripe_paymentgateway = async (req, res) => {
    try {
      const { amount, currency = "gbp", paymentMethodType = "card" } = req.body;

      if (!amount) {
        return res.status(400).json({ error: "Amount is required" });
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency,
        payment_method_types: [paymentMethodType],
      });

      res.status(200).json({
        success: true,
        clientSecret: paymentIntent.client_secret,
        message: "Payment intent created successfully"
      });

    } catch (err) {
      console.error("Stripe Error:", err);
      res.status(500).json({
        success: false,
        error: "Payment intent creation failed",
        message: err.message
      });
    }
  };
  
  // Account deletion (store-compliant): personal data is wiped and the phone number is released,
  // so signing in again with that number creates a brand-new account. Rides / transactions stay for records.
  static ACTIVE_RIDE_STATUSES = ['accepted', 'arrived', 'started', 'rideend'];

  static driver_soft_delete = async (req, res) => {
  try {
    const { driver_id } = req.body;

    if (!driver_id) {
      return res.status(400).json({ success: false, message: "driver_id is required" });
    }
    const driver = await Driver.findByPk(driver_id);

    if (!driver || String(driver.phone || '').startsWith('del_')) {
      return res.status(404).json({ success: false, message: "Driver not found or already deleted" });
    }

    const activeRide = await Ride.findOne({
      where: { driver_id, status: { [Op.in]: ApiController.ACTIVE_RIDE_STATUSES } },
    });
    if (activeRide) {
      return res.status(400).json({
        success: false,
        message: "You have an ongoing ride. Please complete it before deleting your account.",
      });
    }

    await Driver.update(
      {
        name: 'Deleted Driver',
        phone: `del_${driver.id}`,
        status: 0,
        online_status: 0,
        devicetoken: null,
        profile_photo: null,
        license_number: null,
        vehicle_number: null,
        driver_latitude: null,
        driver_longitude: null,
      },
      { where: { id: driver.id } }
    );

    return res.json({ success: true, message: "Driver account deleted successfully" });
  } catch (error) {
    console.error("Driver delete error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

static user_soft_delete = async (req, res) => {
  try {
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ success: false, message: "user_id is required" });
    }
    const user = await User.findByPk(user_id);

    if (!user || user.status === 'deleted') {
      return res.status(404).json({ success: false, message: "User not found or already deleted" });
    }

    const activeRide = await Ride.findOne({
      where: { user_id, status: { [Op.in]: ApiController.ACTIVE_RIDE_STATUSES } },
    });
    if (activeRide) {
      return res.status(400).json({
        success: false,
        message: "You have an ongoing ride. Please complete it before deleting your account.",
      });
    }

    // Requests still waiting for a driver are cancelled so no driver gets them
    await Ride.update(
      { status: 'cancelled', cancelled_by: 'user', cancel_reason: 'Account deleted' },
      { where: { user_id, status: { [Op.in]: ['pending', 'searching'] } } }
    );

    await User.update(
      {
        name: 'Deleted User',
        email: null,
        phone: `del_${user.id}`,
        password: null,
        profile: null,
        devicetoken: null,
        user_latitude: null,
        user_longitude: null,
        status: 'deleted',
      },
      { where: { id: user.id } }
    );

    return res.json({ success: true, message: "User account deleted successfully" });
  } catch (error) {
    console.error("User delete error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

static async driverReport(req, res) {
    try {
      const { driver_id, period } = req.query;
      let { from, to } = req.query;
      if (period) {
        const now = new Date();
        const end = new Date(now);
        end.setHours(23, 59, 59, 999);
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        if (period === 'daily') {

        } else if (period === 'weekly') {
          start.setDate(start.getDate() - 6); 
        } else if (period === 'monthly') {
          start.setDate(start.getDate() - 29); 
        } else {
          return res.status(400).json({
            success: false,
            message: "period must be 'daily', 'weekly' or 'monthly'"
          });
        }
        from = start;
        to = end;
      }

      const driverWhere = driver_id ? { id: driver_id } : {};
      const drivers = await Driver.findAll({
        where: driverWhere,
        attributes: ['id', 'name', 'phone', 'vehicle_number', 'online_status', 'status'],
        include: [{ model: VehicleType, attributes: ['type_name','label'] }]
      });

      if (!drivers.length) {
        return res.status(404).json({ success: false, message: 'No drivers found' });
      }

      const dateRange = {};
      if (from) dateRange[Op.gte] = (from instanceof Date) ? from : new Date(from);
      if (to) {
        const toDate = (to instanceof Date) ? to : new Date(to);
        if (!(to instanceof Date)) toDate.setHours(23, 59, 59, 999);
        dateRange[Op.lte] = toDate;
      }

      const reports = await Promise.all(drivers.map(async (driver) => {
        const rideWhere = { driver_id: driver.id };
        if (from || to) rideWhere.created_at = dateRange;

        const rides = await Ride.findAll({
          where: rideWhere,
          attributes: ['id', 'status', 'final_fare', 'distance_km', 'duration_min']
        });

        const completed = rides.filter(r => r.status === 'completed');
        const cancelled = rides.filter(r => r.status === 'cancelled');

        const total_earnings = completed.reduce((s, r) => s + (parseFloat(r.final_fare) || 0), 0);
        const total_distance_km = completed.reduce((s, r) => s + (parseFloat(r.distance_km) || 0), 0);

        return {
          id: driver.id,
          name: driver.name,
          phone: driver.phone,
          vehicle_number: driver.vehicle_number,
          vehicle_type: driver.VehicleType?.type_name || null,
          vehicle_label: driver.VehicleType?.label || null,
          online_status: driver.online_status,
          status: driver.status,
          total_rides: rides.length,
          completed_rides: completed.length,
          cancelled_rides: cancelled.length,
          total_earnings: Number(total_earnings.toFixed(2)),
          total_distance_miles: Number(total_distance_km.toFixed(2))
        };
      }));

      return res.json({
        success: true,
        filters: {
          driver_id: driver_id || 'all',
          period: period || null,
          from: from ? new Date(from).toISOString() : null,
          to: to ? new Date(to).toISOString() : null
        },
        data: reports
      });
    } catch (error) {
      console.error('driverReport error:', error);
      return res.status(500).json({ success: false, message: 'Something went wrong' });
    }
  }

}

module.exports = ApiController;
