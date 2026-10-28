import pg from 'pg';
import type { BookingCreatedEvent } from './types.ts';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

export async function init(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS booking_history (
      booking_id BIGINT PRIMARY KEY,
      user_id TEXT,
      hotel_id TEXT,
      promo_code TEXT,
      discount_percent DOUBLE PRECISION,
      price DOUBLE PRECISION NOT NULL,
      created_at TIMESTAMPTZ
    );

    CREATE INDEX IF NOT EXISTS booking_history_user_id ON booking_history (user_id);
    CREATE INDEX IF NOT EXISTS booking_history_hotel_id ON booking_history (hotel_id);
    CREATE INDEX IF NOT EXISTS booking_history_created_at ON booking_history (created_at);
  `);
}

// Идемпотентность по ID
export async function saveBooking(b: BookingCreatedEvent): Promise<void> {
  await pool.query(
    `INSERT INTO booking_history (booking_id, user_id, hotel_id, promo_code, discount_percent, price, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (booking_id) DO NOTHING`,
    [b.id, b.userId, b.hotelId, b.promoCode, b.discountPercent, b.price, b.createdAt],
  );
}
