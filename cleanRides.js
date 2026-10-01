require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { Sequelize } = require("sequelize");
const moment = require("moment");

const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
  host: process.env.DB_HOST,
  dialect: "mysql",
  logging: false,
});

async function cleanPendingRides() {
  try {

    const [instantResult] = await sequelize.query(`
      UPDATE rides
      SET status = 'cancelled'
      WHERE status = 'pending'
        AND booking_type = 'instant'
        AND created_at <= (NOW() - INTERVAL 70 SECOND)
    `);

    const [scheduledResult] = await sequelize.query(`
      UPDATE rides
      SET status = 'cancelled'
      WHERE status = 'pending'
        AND booking_type = 'scheduled'
        AND scheduled_at <= (NOW() - INTERVAL 30 SECOND)
    `);

    const [subResult] = await sequelize.query(`
      UPDATE driver_subscriptions
      SET status = 'cancelled',
          updated_at = NOW()
      WHERE status = 'active'
        AND end_date < CURDATE()
    `);

    console.log(`[${moment().format()}] Instant cancelled:`, instantResult.affectedRows || 0);
    console.log(`[${moment().format()}] Scheduled cancelled:`, scheduledResult.affectedRows || 0);
    console.log(`[${moment().format()}] Subscriptions cancelled:`, subResult.affectedRows || 0);

  } catch (err) {
    console.error("Error cleaning rides:", err);
  } finally {
    await sequelize.close();
  }
}

cleanPendingRides();