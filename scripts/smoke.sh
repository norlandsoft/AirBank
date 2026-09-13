#!/usr/bin/env bash
# 部署冒烟：网关路由、各服务健康、前端可达（G0 验收命令）
set -eo pipefail
cd "$(dirname "$0")/.."
GATEWAY=${GATEWAY:-http://localhost:8080}
fail=0
check() { # name url expect
  if curl -sf -m 5 "$2" | grep -q "$3"; then echo "PASS $1"; else echo "FAIL $1 ($2)"; fail=1; fi
}
check gateway      "$GATEWAY/actuator/health"                          '"status":"UP"'
check uam          "$GATEWAY/api/uam/actuator/health"                  '"status":"UP"'
check core         "$GATEWAY/api/core/actuator/health"                 '"status":"UP"'
check wealth       "$GATEWAY/api/wealth/actuator/health"               '"status":"UP"'
check loan         "$GATEWAY/api/loan/actuator/health"                 '"status":"UP"'
check counter      "$GATEWAY/api/counter/actuator/health"              '"status":"UP"'
check ebank        "$GATEWAY/api/ebank/actuator/health"                '"status":"UP"'
check captcha      "$GATEWAY/api/uam/auth/captcha"                     'svg'
check swagger-core "$GATEWAY/api/core/swagger-ui/index.html"            'swagger'
curl -sf -m 5 http://localhost:8001/ >/dev/null && echo "PASS counter-web" || { echo "FAIL counter-web"; fail=1; }
curl -sf -m 5 http://localhost:8002/ >/dev/null && echo "PASS ebank-web"   || { echo "FAIL ebank-web"; fail=1; }
exit $fail
