#!/bin/bash

set -e

echo "▶️ Testing fallback route..."

# "авария" все подов v1, из-за этого трафик v1 должен уйти на v2
kubectl scale deployment booking-service-v1 --replicas=0
kubectl wait --for=delete pod -l version=v1 --timeout=60s
sleep 3

for i in {1..20}
do
    curl -s -w " [%{http_code}]" http://localhost:9090/ping
    echo
done | sort | uniq -c

# поднимаем обратно v1
kubectl scale deployment booking-service-v1 --replicas=2
kubectl rollout status deployment booking-service-v1
