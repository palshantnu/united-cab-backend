require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Sequelize } = require("sequelize");
const path = require("path");
const moment = require("moment-timezone");

const RideController = require(path.join(__dirname, "../controllers/API/RideController"));

const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
  host: process.env.DB_HOST,
  dialect: "mysql",
  logging: false,
});
// const admin = require("firebase-admin");
// const serviceAccount = require("../serviceAccountKey.json"); 

// if (!admin.apps.length) {
//   admin.initializeApp({
//     credential: admin.credential.cert(serviceAccount),
//   });
// }

// async function testFCM() {
//   try {
//     const message = {
//       token: "eAiNAECq50BRs4iYXyweK5:APA91bETj0qtOvQEKlQRrsZA8_9hMmAqBreaTLwVSHs8KkaiTjWx6r9ffXzrFAaSyIxBAJkaOTgkomQRnf2QWdU3qIDDm2vCzNEhE4ZeD_YdQwjZc72N4jQ",
//       notification: {
//         title: "Cron Test",
//         body: "Firebase working from cron ✅"
//       }
//     };

//     const response = await admin.messaging().send(message);

//     console.log("🔥 FCM SUCCESS:", response);

//   } catch (err) {
//     console.error("🔥 FCM ERROR FULL:", JSON.stringify(err, null, 2));
//   }
// }

(async () => {
  try {
    const nowUTC = new Date().toISOString();
    const nowIST = moment().tz("Asia/Kolkata").format();
    const [[time]] = await sequelize.query("SELECT NOW() AS db_time");
    const [rides] = await sequelize.query(`
      SELECT * FROM rides
      WHERE status = 'pending'
      AND booking_type = 'scheduled'
      AND scheduled_at BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 30 MINUTE)
    `);
    //  await testFCM(); 
    if (rides.length === 0) {
      console.log("❌ No rides to trigger");
      return;
    }
   
    for (let ride of rides) {
      console.log("🚀 Trigger ride:", ride.id);

      // ✅ Update ride status safely
      // await sequelize.query(`
      //   UPDATE rides 
      //   SET status = 'searching' 
      //   WHERE id = :id
      // `, {
      //   replacements: { id: ride.id }
      // });

      try {
        await RideController.notifyEligibleDrivers(ride, null);
        console.log("✅ Drivers notified for ride:", ride.id);
      } catch (err) {
        console.error("❌ Notify Error:", err.message);
      }
    }

  } catch (err) {
    console.error("❌ Cron Error:", err.message);
  }
})();