export interface Booking {
  id: string;
  userId: string;
  hotelId: string;
  promoCode: string | null;
  discountPercent: number;
  price: number;
  createdAt: Date;
}
