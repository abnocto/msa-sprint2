import { Kafka, Partitioners } from 'kafkajs';
import type { Booking } from './types.ts';

const TOPIC = process.env.BOOKING_TOPIC || 'booking-created';

const kafka = new Kafka({ clientId: 'booking-service', brokers: [process.env.KAFKA_BROKERS!] });
const producer = kafka.producer({ createPartitioner: Partitioners.DefaultPartitioner });

export function connect(): Promise<void> {
  return producer.connect();
}

export function publishBookingCreated(booking: Booking): void {
  producer
    .send({ topic: TOPIC, messages: [{ key: booking.id, value: JSON.stringify(booking) }] })
    .then(() => console.log(`BookingCreated sent: id=${booking.id}`))
    .catch((err) => console.error(`BookingCreated not sent: id=${booking.id}`, err));
}
