import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';

const definition = protoLoader.loadSync(new URL('./booking.proto', import.meta.url).pathname, {
  keepCase: true,
  defaults: true,
});

const { booking } = grpc.loadPackageDefinition(definition);

const client = new booking.BookingService(
  process.env.BOOKING_SERVICE_ADDR || 'booking-service:9090',
  grpc.credentials.createInsecure(),
);

export function listBookings(userId) {
  return new Promise((resolve, reject) => {
    client.ListBookings({ user_id: userId }, (err, res) => (err ? reject(err) : resolve(res.bookings)));
  });
}
