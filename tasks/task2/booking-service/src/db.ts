import pg from 'pg';
import type { Booking } from './types.ts';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

export async function init(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS booking (
      id BIGINT PRIMARY KEY,
      user_id TEXT,
      hotel_id TEXT,
      promo_code TEXT,
      discount_percent DOUBLE PRECISION,
      price DOUBLE PRECISION NOT NULL,
      created_at TIMESTAMPTZ
    )
  `);
}

export async function saveBooking(b: Booking): Promise<void> {
  await pool.query(
    `INSERT INTO booking (id, user_id, hotel_id, promo_code, discount_percent, price, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [b.id, b.userId, b.hotelId, b.promoCode, b.discountPercent, b.price, b.createdAt],
  );
}

export async function findByUserId(userId: string): Promise<Booking[]> {
  const { rows } = await pool.query('SELECT * FROM booking WHERE user_id = $1 ORDER BY id', [userId]);
  
  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    hotelId: r.hotel_id,
    promoCode: r.promo_code,
    discountPercent: r.discount_percent,
    price: r.price,
    createdAt: r.created_at,
  }));
}
