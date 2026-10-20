# Задание 3: личный кабинет на GraphQL Federation

## Запуск

1. Поднять уже готовый task2: `docker compose up -d` в `task2`.
2. Сбилдить и поднять task3: `docker compose up -d --build` в `task3`.
3. В GraphQL Playground: http://localhost:4000/ проверить, нужны заголовок `userid: test-user-2` и запрос `bookingsByUser(userId: "test-user-2")`.

## Как работает запрос

1. Клиент вызывает `bookingsByUser(userId)` у `apollo-gateway` с заголовком `userid`.
2. `apollo-gateway` передает заголовок `userid` в подграфы и отправляет запрос за бронированиями в подграф `booking-subgraph`.
3. `booking-subgraph` проверяет доступ: пользователь видит только свои брони.
    - нет заголовка `userid` - ошибка `UNAUTHENTICATED`;
    - `userid` не совпадает с `userId` запроса - ошибка `FORBIDDEN`.
4. `booking-subgraph` получает брони из `booking-service` (task2) по gRPC (`ListBookings`).
5. `apollo-gateway` запрашивает отели через подграф `hotel-subgraph` (`__resolveReference` по id), тот запрашивает отель из REST монолита (`GET /api/hotels/{id}`).

## Что изменено

- `booking-subgraph`: вызов `booking-service` по gRPC, проверка заголовка `userid`, добавлено поле `hotel` в `Booking`.
- `hotel-subgraph`: вызов монолита (REST). У отеля нет названия и звезд, поэтому `name` использует описание, а `stars` округленный рейтинг.
- `apollo-gateway`: передача заголовка `userid` в подграфы. Тут пришлось немного переделать, по умолчанию не работало (не передавался заголовок).
- `docker-compose.yml`: сеть `hotelio-net`, чтобы обращаться к сервисам task2.
