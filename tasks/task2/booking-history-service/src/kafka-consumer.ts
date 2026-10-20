import { Kafka } from 'kafkajs';
import * as db from './db.ts';
import type { BookingCreatedEvent } from './types.ts';

const TOPIC = process.env.BOOKING_TOPIC || 'booking-created';

const kafka = new Kafka({ clientId: 'booking-history-service', brokers: [process.env.KAFKA_BROKERS!] });
const consumer = kafka.consumer({ groupId: 'booking-history-service' });

export async function start(): Promise<void> {
  await consumer.connect();
  
  await consumer.subscribe({ topic: TOPIC, fromBeginning: true });
  
  await consumer.run({
    eachMessage: async ({ message }) => {
      const booking = JSON.parse(message.value!.toString()) as BookingCreatedEvent;
      await db.saveBooking(booking);
      console.log(`Booking history saved: bookingId=${booking.id}`);
    },
  });
}
