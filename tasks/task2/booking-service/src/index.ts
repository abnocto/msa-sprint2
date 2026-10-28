import * as db from './db.ts';
import * as kafka from './kafka.ts';
import * as grpcServer from './grpc-server.ts';

async function main() {
  await db.init();
  await kafka.connect();
  await grpcServer.start(Number(process.env.GRPC_PORT || 9090));
}

main().catch((err) => {
  console.error('booking-service failed to start', err);
  process.exit(1);
});
