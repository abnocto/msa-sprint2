#!/bin/bash
set -euo pipefail

echo "🏁 Регрессионный тест Hotelio после выноса booking-service"

# Проверка соединения
echo "🧪 Проверка подключения к БД..."
timeout 2 bash -c "</dev/tcp/${DB_HOST}/${DB_PORT}" \
  || { echo "❌ Не удалось подключиться к ${DB_HOST}:${DB_PORT}"; exit 1; }

# Загрузка фикстур
echo "🧪 Загрузка фикстур..."
PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" "${DB_NAME}" < init-fixtures.sql

# БД booking-service и booking-history-service (по умолчанию на том же хосте)
booking_db() { PGPASSWORD="${BOOKING_DB_PASSWORD:-booking}" psql -h "${BOOKING_DB_HOST:-$DB_HOST}" -p "${BOOKING_DB_PORT:-5433}" -U "${BOOKING_DB_USER:-booking}" -q "${BOOKING_DB_NAME:-booking}" "$@"; }
history_db() { PGPASSWORD="${HISTORY_DB_PASSWORD:-history}" psql -h "${HISTORY_DB_HOST:-$DB_HOST}" -p "${HISTORY_DB_PORT:-5434}" -U "${HISTORY_DB_USER:-history}" -q "${HISTORY_DB_NAME:-history}" "$@"; }

echo "🧪 Очистка тестовых броней в booking-service и истории..."
booking_db -c "DELETE FROM booking WHERE user_id LIKE 'test-%'"
history_db -c "DELETE FROM booking_history WHERE user_id LIKE 'test-%'"

# Перенос старых броней из монолита в booking-service с исходными ID.
# Идемпотентно (ON CONFLICT DO NOTHING): запускается до и после переключения монолита на gRPC.
echo "🧪 Перенос броней из монолита в booking-service..."
{
  echo "CREATE TEMP TABLE booking_import (LIKE booking);"
  echo "COPY booking_import (id, user_id, hotel_id, promo_code, discount_percent, price, created_at) FROM STDIN;"
  PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" "${DB_NAME}" \
    -c "\copy (SELECT id, user_id, hotel_id, promo_code, discount_percent, price, COALESCE(created_at, NOW()) FROM booking) TO STDOUT"
  echo "\\."
  echo "INSERT INTO booking SELECT * FROM booking_import ON CONFLICT (id) DO NOTHING;"
} | booking_db

echo "🧪 Выполнение HTTP-тестов..."

pass() { echo "✅ $1"; }
fail() { echo "❌ $1"; exit 1; }

BASE="${API_URL:-http://localhost:8080}"

echo ""
echo "Тесты пользователей..."
# 1. Получение пользователя по ID
curl -sSf "${BASE}/api/users/test-user-1" | grep -q 'Alice' && pass "Получение test-user-1 по ID работает" || fail "Пользователь test-user-1 не найден"

# 2. Статус пользователя
curl -sSf "${BASE}/api/users/test-user-1/status" | grep -q 'ACTIVE' && pass "Статус test-user-1: ACTIVE" || fail "Неверный статус пользователя"

# 3. Блэклист
curl -sSf "${BASE}/api/users/test-user-1/blacklisted" | grep -q 'true' && pass "test-user-1 в блэклисте" || fail "Блэклист не работает"

# 4. Активность
curl -sSf "${BASE}/api/users/test-user-1/active" | grep -q 'true' && pass "test-user-1 активен" || fail "Активность не работает"

# 5. Авторизация
curl -sSf "${BASE}/api/users/test-user-1/authorized" | grep -q 'false' && pass "test-user-1 не авторизован (в блэклисте)" || fail "Авторизация работает неправильно"

# 6. VIP-статус
curl -sSf "${BASE}/api/users/test-user-3/vip" | grep -q 'true' && pass "test-user-3 — VIP-пользователь" || fail "VIP-статус не работает"

# 7. Авторизация: положительный кейс
curl -sSf "${BASE}/api/users/test-user-2/authorized" | grep -q 'true' && pass "test-user-2 авторизован" || fail "Авторизация (true) не работает"

echo ""
echo "Тесты отелей..."

# 1. Получение отеля по ID
curl -sSf "${BASE}/api/hotels/test-hotel-1" | grep -q 'Seoul' && pass "test-hotel-1 получен по ID" || fail "test-hotel-1 не найден"

# 2. Проверка operational
curl -sSf "${BASE}/api/hotels/test-hotel-1/operational" | grep -q 'true' && pass "test-hotel-1 работает" || fail "test-hotel-1 не работает"
curl -sSf "${BASE}/api/hotels/test-hotel-3/operational" | grep -q 'false' && pass "test-hotel-3 не работает" || fail "Статус работы test-hotel-3 некорректен"

# 3. Проверка fullyBooked
curl -sSf "${BASE}/api/hotels/test-hotel-2/fully-booked" | grep -q 'true' && pass "test-hotel-2 полностью забронирован" || fail "Статус fullyBooked test-hotel-2 неверен"

# 4. Поиск по городу
curl -sSf "${BASE}/api/hotels/by-city?city=Seoul" | grep -q 'Seoul' && pass "Поиск отелей в Сеуле работает" || fail "Поиск отелей в Сеуле не работает"

# 5. Топ-отели (по рейтингу, limit)
curl -sSf "${BASE}/api/hotels/top-rated?city=Seoul&limit=1" | grep -q 'Seoul' && pass "Топ-отели в Сеуле загружены" || fail "Топ-отели не найдены"

echo ""
echo "Тесты ревью..."

# 11. Отзывы по hotelId
curl -sSf "${BASE}/api/reviews/hotel/test-hotel-1" | grep -q 'Amazing experience' \
  && pass "Отзывы test-hotel-1 найдены" || fail "Отзывы test-hotel-1 не найдены"

# 12. Надёжный отель (>=10 отзывов и avgRating >= 4.0)
curl -sSf "${BASE}/api/reviews/hotel/test-hotel-1/trusted" | grep -q 'true' \
  && pass "test-hotel-1 признан надёжным" || fail "Надёжность test-hotel-1 не определена"

# 13. Сомнительный отель (мало отзывов/низкий рейтинг)
curl -sSf "${BASE}/api/reviews/hotel/test-hotel-3/trusted" | grep -q 'false' \
  && pass "test-hotel-3 НЕ признан надёжным (ожидаемо)" || fail "Надёжность test-hotel-3 некорректно определена"

echo ""
echo "Тесты промокодов..."

# 1. Получение промо по коду
curl -sSf "${BASE}/api/promos/TESTCODE1" | grep -q 'TESTCODE1' && pass "Промокод TESTCODE1 найден" || fail "Промокод TESTCODE1 не найден"

# 2. Проверка VIP промо — для VIP
curl -sSf "${BASE}/api/promos/TESTCODE-VIP/valid?isVipUser=true" | grep -q 'true' && pass "VIP-промо доступен VIP" || fail "VIP-промо НЕ доступен VIP"

# 3. Проверка VIP промо — для обычного
curl -sSf "${BASE}/api/promos/TESTCODE-VIP/valid?isVipUser=false" | grep -q 'false' && pass "VIP-промо недоступен обычному" || fail "VIP-промо доступен обычному"

# 4. Проверка обычного промо
curl -sSf "${BASE}/api/promos/TESTCODE1/valid" | grep -q 'true' && pass "Обычный промо доступен" || fail "Обычный промо недоступен"

# 5. Проверка истекшего промо
curl -sSf "${BASE}/api/promos/TESTCODE-OLD/valid" | grep -q 'false' && pass "Истекший промо недоступен" || fail "Истекший промо доступен"

# 6. Валидация промо для user-2 (обычного)
curl -sSf -X POST "${BASE}/api/promos/validate?code=TESTCODE1&userId=test-user-2" | grep -q 'TESTCODE1' && pass "POST /validate промо прошёл" || fail "POST /validate не прошёл"

echo ""
echo "Тесты бронирования..."

# 1. Все бронирования без userId больше не отдаются (в gRPC-контракте только список по пользователю)
curl -s -o /dev/null -w "%{http_code}" "${BASE}/api/bookings" | grep -q '500' \
  && pass "Отклонено: список всех бронирований без userId" \
  || fail "Ошибка: сервер отдал бронирования без userId"

# 2. Получение бронирований пользователя (перенесены из монолита)
curl -sSf "${BASE}/api/bookings?userId=test-user-2" | grep -q 'test-user-2' && pass "Бронирования test-user-2 найдены" || fail "Нет бронирований test-user-2"

# 3. Успешное бронирование отеля без промо
curl -sSf -X POST "${BASE}/api/bookings?userId=test-user-3&hotelId=test-hotel-1" | grep -q 'test-hotel-1' && pass "Бронирование прошло (без промо)" || fail "Бронирование (без промо) не прошло"

# 4. Успешное бронирование с промо
booking=$(curl -sSf -X POST "${BASE}/api/bookings?userId=test-user-2&hotelId=test-hotel-1&promoCode=TESTCODE1")
echo "$booking" | grep -q 'TESTCODE1' && pass "Бронирование с промо прошло" || fail "Бронирование с промо не прошло"
booking_id=$(echo "$booking" | grep -o '"id":[0-9]*' | cut -d: -f2)

# 5. Ошибка — неактивный пользователь
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE}/api/bookings?userId=test-user-0&hotelId=test-hotel-1")
if [[ "$code" == "500" ]]; then
  pass "Отклонено: неактивный пользователь"
else
  fail "Ошибка: сервер принял бронирование от неактивного пользователя (код $code)"
fi

# 6. Ошибка — отель не доверенный
curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE}/api/bookings?userId=test-user-2&hotelId=test-hotel-3" | grep -q '500' \
  && pass "Отклонено: недоверенный отель" \
  || fail "Ошибка: сервер принял бронирование от недоверенного отеля"

# 7. Ошибка — отель полностью забронирован
curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE}/api/bookings?userId=test-user-2&hotelId=test-hotel-2" | grep -q '500' \
  && pass "Отклонено: отель полностью забронирован" \
  || fail "Ошибка: сервер принял бронирование в полностью занятом отеле"

echo ""
echo "Тесты booking-service и истории..."

# 8. Бронь сохранена в БД booking-service
booking_db -tAc "SELECT id FROM booking WHERE id = ${booking_id}" | grep -q "${booking_id}" \
  && pass "Бронь ${booking_id} в БД booking-service" || fail "Брони ${booking_id} нет в БД booking-service"

# 9. Бронь дошла через Kafka до booking-history-service (асинхронно, ждем до 10 секунд)
for _ in $(seq 1 10); do
  history_db -tAc "SELECT booking_id FROM booking_history WHERE booking_id = ${booking_id}" | grep -q "${booking_id}" && break
  sleep 1
done
history_db -tAc "SELECT booking_id FROM booking_history WHERE booking_id = ${booking_id}" | grep -q "${booking_id}" \
  && pass "Бронь ${booking_id} в истории бронирований" || fail "Брони ${booking_id} нет в истории бронирований"

echo "✅ Все HTTP-тесты пройдены!"
