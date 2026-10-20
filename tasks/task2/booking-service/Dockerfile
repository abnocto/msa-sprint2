FROM node:24-slim

WORKDIR /app

COPY booking-service/package.json booking-service/package-lock.json ./
RUN npm ci --omit=dev

COPY booking.proto ./
COPY booking-service/src ./src

ENV PROTO_PATH=/app/booking.proto

CMD ["node", "src/index.ts"]
