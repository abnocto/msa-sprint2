# Задание 5: управление трафиком с Istio

## Запуск

### Установка istio
- `istioctl install --set profile=demo -y`
- `kubectl label namespace default istio-injection=enabled --overwrite`

### Билд и деплой
- `docker build -t booking-service:latest booking-service`
- `minikube image load booking-service:latest`
- `helm upgrade --install booking-service-v1 helm/booking-service -f helm/booking-service/values-staging.yaml -f helm/booking-service/values-v1.yaml`
- `helm upgrade --install booking-service-v2 helm/booking-service -f helm/booking-service/values-staging.yaml -f helm/booking-service/values-v2.yaml`
- `kubectl apply -f k8s/service.yaml -f istio/`

### Проверки
- `kubectl port-forward -n istio-system svc/istio-ingressgateway 9090:80`
- `./check-canary.sh`
- `./check-fallback.sh`
- `./check-feature-flag.sh`
- `./check-istio.sh`

## Что сделано

### Две версии сервиса
- Немного переделаны helm чарты для поддержки двух версий сервиса. По факту просто метка версии ставится.
- Эндпоинт `/ping` теперь отвечает с версией `pong v1` или `pong v2`, чтобы видеть, какая версия ответила.
- Общий Service (`k8s/service.yaml`) вынесен отдельно от чарта. В чарте он бы конфликтовал между двумя версиями.

### Istio

#### Gateway
- Добавлен, т.к. если просто пробросить порт как в task4 на `booking-service`, то не применится Istio логика.

#### VirtualService
- Фича-флаг: если есть заголовок `x-version: v2` (который ставит EnvoyFilter), используем v2
- Canary 90/10, причем 90 процентов это не v1, а приоритетная версия (см. DestinationRule), чтобы если поды v1 выключены, трафик шел на v2 (проверка фолбэка)
- Ретраи на ошибки (в Istio retries задаются в VirtualService, в DestinationRule их нет)

#### DestinationRule
- Сабсеты по метке `version`
- Circuit breaker
- Приоритет (failoverPriority) у v1 подов для реализации логики фолбэка

#### EnvoyFilter
- Кастомный Lua-фильтр на gateway ставит `x-version: v2` при переданном `X-Feature-Enabled: true` (по нему уже маршрутизирует VirtualService)

#### Проверки
- Доработан `check-canary`, чтобы считал ответы по версиям
- Еще доработан `check-fallback`, чтобы выключал все поды v1 (чтобы можно было проверить фолбэк)
- Все проверки успешно проходят
