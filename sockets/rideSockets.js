// rideSockets.js
// const { Driver, VehicleType } = require('../models');
const { Ride,User } = require('../models');  

const sendRideStatusToSocket = async (rideId, io) => {
  try {
    const ride = await Ride.findByPk(rideId, {
      attributes: ['id', 'status', 'pickup_lat', 'pickup_lng', 'dropoff_lat', 'dropoff_lng'],       
      include: [
              {
                model: User,
                as: 'user',
                attributes: ['id', 'name', 'phone', 'email']
              }
            ],
    });
    console.log(`🧪 ride ${ride?.id} user:`, ride?.user ? { id: ride.user.id, name: ride.user.name } : null);
    if (!ride) {
      console.log('Ride not found:', rideId);
      return;
    }
    
    io.to(`ride_${rideId}`).emit('rideStatusFromDB', {
      rideId: ride.id,
      status: ride.status,
      pickupLocation: {
        lat: ride.pickup_lat,
        lng: ride.pickup_lng
      },
      user: {
        id: ride.user?.id || null,
        name: ride.user?.name || null,
        phone: ride.user?.phone || null,
        email: ride.user?.email || null,
      },
      dropoffLocation: {
        lat: ride.dropoff_lat,
        lng: ride.dropoff_lng
      },
      timestamp: new Date()
    });

    console.log(`✅ Sent ride data for ${rideId} to ride_${rideId}`);
  } catch (error) {
    console.error('❌ Error sending ride data via socket:', error);
  }
};
module.exports = (io) => {
    io.on('connection', (socket) => {
        const transport = socket.conn.transport.name;
        const ip = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
        const ua = (socket.handshake.headers['user-agent'] || '').slice(0, 60);
        const connectedAt = Date.now();
        console.log(`🟢 connected: ${socket.id} | transport=${transport} | ip=${ip} | ua=${ua}`);

        socket.conn.on('upgrade', (newTransport) => {
            console.log(`⬆️  ${socket.id} upgraded: → ${newTransport.name}`);
        });

        socket.on('disconnect', (reason) => {
            const duration = ((Date.now() - connectedAt) / 1000).toFixed(1);
            const who = socket.driverId ? `driver=${socket.driverId}` : socket.userId ? `user=${socket.userId}` : 'unregistered';
            console.log(`❌ disconnect: ${socket.id} | reason="${reason}" | lived=${duration}s | ${who}`);
        });
        socket.on('joinRideRoom', ({ rideId, userType, userId }) => {
            const room = `ride_${rideId}`;
            socket.join(room);
            console.log(`${userType} joined ride room: ${room}`);
        });

        socket.on('shareLocation', ({ rideId, userType, location }) => {
            const room = `ride_${rideId}`;
            socket.to(room).emit('locationUpdate', {
                userType,
                location,
                timestamp: new Date()
            });
        });

        socket.on('updateRideStatus', ({ rideId, status }) => {
            const room = `ride_${rideId}`;
            io.to(room).emit('rideStatusUpdate', {
                status,
                timestamp: new Date()
            });
        });
        socket.on('getRideStatusFromServer', async ({ rideId }) => {
            console.log(`📥 Received request to get ride status for rideId: ${rideId}`);
            try {
                await sendRideStatusToSocket(rideId, io);
                console.log(`✅ Ride status sent for rideId: ${rideId}`);
            } catch (error) {
                console.error(`❌ Failed to send ride status for rideId ${rideId}:`, error);
            }
        });



    });
};