import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as bookingService from './booking-service.ts';
import type { Booking } from './types.ts';

// booking.proto
interface BookingRequest {
  user_id: string;
  hotel_id: string;
  promo_code: string;
}

interface BookingListRequest {
  user_id: string;
}

interface BookingResponse {
  id: string;
  user_id: string;
  hotel_id: string;
  promo_code: string;
  discount_percent: number;
  price: number;
  created_at: string;
}

const definition = protoLoader.loadSync(process.env.PROTO_PATH || '../booking.proto', { keepCase: true, defaults: true });
const bookingProto = grpc.loadPackageDefinition(definition).booking as grpc.GrpcObject;
const BookingServiceDef = bookingProto.BookingService as grpc.ServiceClientConstructor;

function toResponse(b: Booking): BookingResponse {
  return {
    id: b.id,
    user_id: b.userId,
    hotel_id: b.hotelId,
    promo_code: b.promoCode ?? '',
    discount_percent: b.discountPercent ?? 0,
    price: b.price,
    created_at: b.createdAt ? b.createdAt.toISOString() : '',
  };
}

function toGrpcError(err: unknown): Partial<grpc.ServiceError> {
  if (err instanceof bookingService.BookingRejectedError) {
    return { code: grpc.status.FAILED_PRECONDITION, details: err.message };
  }
  console.error(err);
  return { code: grpc.status.INTERNAL, details: err instanceof Error ? err.message : String(err) };
}

const handlers: grpc.UntypedServiceImplementation = {
  async CreateBooking(
    call: grpc.ServerUnaryCall<BookingRequest, BookingResponse>,
    callback: grpc.sendUnaryData<BookingResponse>,
  ) {
    const { user_id, hotel_id, promo_code } = call.request;
    try {
      const booking = await bookingService.createBooking(user_id, hotel_id, promo_code || null);
      callback(null, toResponse(booking));
    } catch (err) {
      callback(toGrpcError(err));
    }
  },

  async ListBookings(
    call: grpc.ServerUnaryCall<BookingListRequest, { bookings: BookingResponse[] }>,
    callback: grpc.sendUnaryData<{ bookings: BookingResponse[] }>,
  ) {
    try {
      const bookings = await bookingService.listByUser(call.request.user_id);
      callback(null, { bookings: bookings.map(toResponse) });
    } catch (err) {
      callback(toGrpcError(err));
    }
  },
};

export function start(port: number): Promise<grpc.Server> {
  const server = new grpc.Server();
  server.addService(BookingServiceDef.service, handlers);
  
  return new Promise((resolve, reject) => {
    server.bindAsync(`0.0.0.0:${port}`, grpc.ServerCredentials.createInsecure(), (err) => {
      if (err) return reject(err);
      console.log(`gRPC server started on port ${port}`);
      resolve(server);
    });
  });
}
