import * as db from './db.ts';
import * as monolithClient from './monolith-client.ts';
import * as kafka from './kafka.ts';
import { nextId } from './id-generator.ts';
import type { Booking } from './types.ts';

export class BookingRejectedError extends Error {}

async function validateUser(userId: string) {
  if (!(await monolithClient.isUserActive(userId))) throw new BookingRejectedError('User is inactive');
  if (await monolithClient.isUserBlacklisted(userId)) throw new BookingRejectedError('User is blacklisted');
}

async function validateHotel(hotelId: string) {
  if (!(await monolithClient.isHotelOperational(hotelId))) throw new BookingRejectedError('Hotel is not operational');
  if (!(await monolithClient.isHotelTrusted(hotelId))) throw new BookingRejectedError('Hotel is not trusted based on reviews');
  if (await monolithClient.isHotelFullyBooked(hotelId)) throw new BookingRejectedError('Hotel is fully booked');
}

async function resolveBasePrice(userId: string): Promise<number> {
  const status = await monolithClient.getUserStatus(userId);
  return status?.toUpperCase() === 'VIP' ? 80.0 : 100.0;
}

async function resolvePromoDiscount(promoCode: string | null, userId: string): Promise<number> {
  if (!promoCode) return 0.0;
  return (await monolithClient.getPromoDiscount(promoCode, userId)) ?? 0.0;
}

export async function createBooking(userId: string, hotelId: string, promoCode: string | null): Promise<Booking> {
  console.log(`Creating booking: userId=${userId}, hotelId=${hotelId}, promoCode=${promoCode}`);

  await validateUser(userId);
  await validateHotel(hotelId);

  const basePrice = await resolveBasePrice(userId);
  const discount = await resolvePromoDiscount(promoCode, userId);

  const booking: Booking = {
    id: nextId(),
    userId,
    hotelId,
    promoCode,
    discountPercent: discount,
    price: basePrice - discount,
    createdAt: new Date(),
  };

  // Для упрощения без Transactional Outbox
  await db.saveBooking(booking);
  kafka.publishBookingCreated(booking);
  
  return booking;
}

export function listByUser(userId: string): Promise<Booking[]> {
  return db.findByUserId(userId);
}
