// ACL

const MONOLITH_URL = process.env.MONOLITH_URL;

const request = (path: string, options?: RequestInit) => fetch(`${MONOLITH_URL}${path}`, options);

async function getBoolean(path: string): Promise<boolean> {
  const res = await request(path);
  
  if (!res.ok) throw new Error(`Monolith ${path} responded ${res.status}`);
  
  return (await res.text()).trim() === 'true';
}

export const isUserActive = (userId: string) => getBoolean(`/api/users/${userId}/active`);
export const isUserBlacklisted = (userId: string) => getBoolean(`/api/users/${userId}/blacklisted`);
export const isHotelOperational = (hotelId: string) => getBoolean(`/api/hotels/${hotelId}/operational`);
export const isHotelFullyBooked = (hotelId: string) => getBoolean(`/api/hotels/${hotelId}/fully-booked`);
export const isHotelTrusted = (hotelId: string) => getBoolean(`/api/reviews/hotel/${hotelId}/trusted`);

export async function getUserStatus(userId: string): Promise<string | null> {
  const res = await request(`/api/users/${encodeURIComponent(userId)}/status`);

  // 404 - у пользователя нет статуса
  if (res.status === 404) return null;
  
  if (!res.ok) throw new Error(`Monolith user status responded ${res.status}`);
  
  return res.text();
}

export async function getPromoDiscount(promoCode: string, userId: string): Promise<number | null> {
  const res = await request(`/api/promos/validate?code=${promoCode}&userId=${userId}`, { method: 'POST' });
  
  // 400 - промокод недействителен или не подходит пользователю
  if (res.status === 400) return null;
  
  if (!res.ok) throw new Error(`Monolith promo validate responded ${res.status}`);
  
  const promo = (await res.json()) as { discount: number };
  return promo.discount;
}
