module.exports = (sequelize, DataTypes) => {
  const DriverSubscription = sequelize.define('DriverSubscription', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    driver_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    subscription_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    start_date: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    end_date: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },  
    mile: { 
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    status: {
      type: DataTypes.ENUM('active', 'expired', 'pending','cancelled'),
      allowNull: true,
      defaultValue: 'pending'
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: sequelize.literal('CURRENT_TIMESTAMP')
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
      onUpdate: sequelize.literal('CURRENT_TIMESTAMP')
    }
  }, {
    tableName: 'driver_subscriptions',
    timestamps: false
  });

  // Associations
  DriverSubscription.associate = function(models) {
    DriverSubscription.belongsTo(models.Driver, {
      foreignKey: 'driver_id',
      as: 'driver' // must match query alias
    });

    DriverSubscription.belongsTo(models.Subscriptions, {
      foreignKey: 'subscription_id',
      as: 'subscription' // optional, if you want to include subscription info too
    });
  };

  return DriverSubscription;
};
