const MONOLITH_URL = process.env.MONOLITH_URL || 'http://monolith:8080';

export async function getHotel(id) {
  const res = await fetch(`${MONOLITH_URL}/api/hotels/${id}`);
  
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Monolith hotel ${id} responded ${res.status}`);

  const hotel = await res.json();

  return {
    id: hotel.id,
    // у отеля нет поля name
    name: hotel.description,
    city: hotel.city,
    // у отеля нет поля stars
    stars: Math.round(hotel.rating),
  };
}
