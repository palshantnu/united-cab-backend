// utils/locationUtils.js
const geolib = require('geolib');
const { Driver, VehicleType } = require('../../models');
const { Op } = require("sequelize");
class LocationUtils {
   static async findNearbyDrivers(userLat, userLng, vehicleTypeId = null) {
    const whereClause = {
        online_status: 1,
        status: '1'
    };

    if (vehicleTypeId) {
        whereClause.vehicle_id = vehicleTypeId;
    }

    const drivers = await Driver.findAll({
        where: whereClause,
        include: [{
            model: VehicleType,
            attributes: ['type_name','vehicle_image']
        }]
    });

    return drivers
        .filter(driver => driver.driver_latitude != null && driver.driver_longitude != null)
        .map(driver => {
            const distance = geolib.getDistance(
                { latitude: parseFloat(userLat), longitude: parseFloat(userLng) },
                { latitude: parseFloat(driver.driver_latitude), longitude: parseFloat(driver.driver_longitude) }
            );
            return { driver, distance };
        })
        
        .map(({ driver, distance }) => ({
            id: driver.id,
            name: driver.name,
            vehicleType: driver.VehicleType?.type_name || '',
            vehicleIcon: driver.VehicleType?.vehicle_image || '',
            distance,
            location: {
                lat: driver.driver_latitude,
                lng: driver.driver_longitude
            }
        }));
}

}

module.exports = LocationUtils;
