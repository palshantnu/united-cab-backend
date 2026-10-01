
const { Driver, VehicleType } = require('../models');
  module.exports = (io) => {
    io.on("connection", (socket) => {
      socket.on("registerUser", (userId) => {
        if (socket.userId === userId) return; 
        socket.userId = userId;
        socket.join(`user_${userId}`);
        console.log(`User ${userId} registered for location updates`);
      });

     socket.on("registerDriver", async ({ driverId, lat, lng, vehicleTypeId }) => {
      if (socket.driverId === driverId) return; 
      socket.driverId = driverId;
      socket.join(`driver_${driverId}`);
      console.log(`Driver ${driverId} registered`);
      try {
        await Driver.update(
          {
            driver_latitude: lat,
            driver_longitude: lng,
            status: "1", 
            online_status: "1",
          },
          { where: { id: driverId } }
        );
      } catch (error) {
        console.error("Error updating driver location:", error);
      }
    });

    socket.on("updateDriverLocation", async ({ driverId, lat, lng }) => {
      try {
        await Driver.update(
          {
            driver_latitude: lat,
            driver_longitude: lng,
          },
          { where: { id: driverId } }
        );

        io.emit(`driverLocation_${driverId}`, { lat, lng });
      } catch (error) {
        console.error("Error updating driver location:", error);
      }
    });

    socket.on("driverLocationUpdate", async (data) => {
        const { driver_id, lat, lng } = data;
        if (!driver_id || !lat || !lng) return;

        await Driver.update(
            { driver_latitude: lat, driver_longitude: lng },
            { where: { id: driver_id } }
        );

        io.emit("driverLiveLocation", {
            driver_id,
            lat,
            lng,
            updatedAt: new Date()
        });
    });

      socket.on("startSharingWithUser", ({ driverId, userId }) => {
        socket.join(`locationShare_${driverId}_${userId}`);
        console.log(`Driver ${driverId} sharing location with user ${userId}`);
      });
      socket.on("joinRide", (ride_id) => {
        socket.join(`ride_${ride_id}`);
        console.log(`👤 User ${socket.id} joined room ride_${ride_id}`);
      });

      // disconnect log rideSockets.js mein detailed version mein hai

  });
};