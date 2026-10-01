// models/Otp.js
module.exports = (sequelize, DataTypes) => {
  return sequelize.define(
    "Otp",
    {
      mobile: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      country_code: DataTypes.STRING,
      otp_code: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      expires_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      verified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      user_type: {
        type: DataTypes.ENUM("user", "driver"),
        allowNull: false,
      },
    },
    {
      timestamps: true,
      createdAt: "created_at",
      updatedAt: false,
      tableName: "otps",
    }
  );
};
