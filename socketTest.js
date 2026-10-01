const { io } = require("socket.io-client");

const socket = io('https://unitedcabsmerthyr.uk');

socket.emit('joinRideRoom', {
  rideId: 123,
  userType: 'user'
});

const ride_id = 97;
setInterval(() => {
  socket.emit('shareLocation', {
    rideId: 123,
    userType: 'user',
    location: { lat: 23.2599, lng: 77.4126 }
  });
}, 5000);


socket.on('receiveLocation', (data) => {
  console.log('📍 Received location from:', data.from, data.location);
});

socket.emit("joinRide", ride_id);
socket.on("driverLiveLocation", (data) => {
  console.log("📍 Driver location update:", data);
});