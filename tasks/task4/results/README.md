# Задание 4: автоматизация развертывания и тестирования

## Запуск

1. `minikube start --driver=docker`
2. `npm install`
3. `npx gitlab-ci-local build test deploy tag --variable DEPLOY_ENV=staging` (или `prod`)

## Проверки
- `kubectl port-forward svc/booking-service 8080:80`
- `./check-status.sh`
- `./check-dns.sh`
- `curl http://localhost:8080/ping`

## Что сделано

### Сервис
- mock на Go заменен на сервис на TypeScript (Node.js 24, без зависимостей)
- `/ping` (liveness)
- `/ready` (readiness)
- `/feature` только при `ENABLE_FEATURE_X=true`

### Helm-чарт
- `values.yaml` содержит только общее для окружений (образ, Service, пробы)
- `values-staging.yaml` / `values-prod.yaml` содержит все, что зависит от окружения: реплики, `pullPolicy`, `env` с фича-флагом, `resources`
- liveness намеренно проверяется реже, чем readiness, т.к. readiness влияет на исключение пода из трафика без рестарта, а liveness на рестарт

### CI/CD
- build: `docker build`;
- test: `docker run`, `curl /ping`, контейнер удаляется в `after_script` (при провале теста тоже)
- deploy: `minikube image load`, `helm upgrade --install ... --wait` (ждет readiness, при неудаче тег не ставится). Тег образа это короткий хэш коммита, если оставить просто `latest`, `helm upgrade` не поменяет манифест, поэтому поды не будут перезапущены. 
- tag: локальный git-тег `deploy-<env>-<timestamp>`, в remote не пушится

### Service Discovery
- Ничего делать не пришлось дополнительно
- Клиенты обращаются по имени сервиса `booking-service`, который DNS (CoreDNS) резолвит в статичный ClusterIP благодаря тому, что настроен Service. Дальше уже по DNAT правилам, которые kube-proxy прописывает в ядро ноды, соединения на ClusterIP балансируются на IP конкретных подов (L4 балансировка).
