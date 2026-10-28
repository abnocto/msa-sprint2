import * as db from './db.ts';
import * as consumer from './kafka-consumer.ts';

async function main() {
  await db.init();
  await consumer.start();
}

main().catch((err) => {
  console.error('booking-history-service failed to start', err);
  process.exit(1);
});
