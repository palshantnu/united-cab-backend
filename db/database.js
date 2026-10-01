require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
  host: process.env.DB_HOST,
  dialect: 'mysql',
  port: 3306,
  logging: false
});

const connectdb = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ MySQL Connected');
  } catch (err) {
    console.error('❌ DB connection failed:', err);
  }
};

module.exports = connectdb;
module.exports.sequelize = sequelize; // Optional: export sequelize instance for models
