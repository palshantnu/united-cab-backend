// models/Rating.js
module.exports = (sequelize, DataTypes) => {
    const Rating = sequelize.define('Rating_Reviews', {
      ride_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      driver_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      rated_by_driver: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0
      },
      rated_by_user: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0
      },
      reviewed_by_user: {
        type: DataTypes.TEXT,  // or STRING if you prefer shorter reviews
        allowNull: true,
      },
      reviewed_by_driver: {
        type: DataTypes.TEXT,  // or STRING
        allowNull: true,
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
    }, {
      tableName: 'ratings_reviews',
      timestamps: false,
    });
  
    return Rating;
  };
  