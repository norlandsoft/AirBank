#!/usr/bin/env bash
# 端到端冒烟（E2E）：登录 → 转账 → 理财申购 → T+1 确认 → 日终 → 总分核对
# 前置：compose 全栈已启动且健康；依赖 docker exec 读取 Redis 中的图形验证码（培训环境）
set -eo pipefail
cd "$(dirname "$0")/.."
GW=${GATEWAY:-http://localhost:8080}

login() { # login <user> <userType> -> echo token
  local user=$1 ut=$2 cap token
  cap=$(curl -sf "$GW/api/uam/auth/captcha")
  local uuid code
  uuid=$(echo "$cap" | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["uuid"])')
  code=$(docker exec airbank-redis redis-cli --no-raw GET "captcha:$uuid" | tr -d '"')
  token=$(curl -sf -X POST "$GW/api/uam/auth/login" -H 'Content-Type: application/json' \
    -d "{\"loginName\":\"$user\",\"password\":\"Abc12345\",\"userType\":\"$ut\",\"captchaUuid\":\"$uuid\",\"captchaCode\":\"$code\"}" \
    | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["token"])')
  echo "$token"
}

jget() { python3 -c "import sys,json;d=json.load(sys.stdin);print($1)"; }

echo "== 1. 客户登录 =="
TOKEN=$(login zhangsan CUSTOMER)
[ -n "$TOKEN" ] && echo "PASS zhangsan login" || { echo "FAIL login"; exit 1; }
AUTH="Authorization: Bearer $TOKEN"

echo "== 2. 行内转账 zhangsan -> lisi 100.00 =="
ZS=$(curl -sf "$GW/api/core/accounts?customerId=1" -H "$AUTH" | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"][0]["acctNo"])')
LS=$(curl -sf "$GW/api/core/accounts?customerId=2" -H "$AUTH" | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"][0]["acctNo"])')
REQ="E2E-$(date +%s)-$RANDOM"
RESULT=$(curl -sf -X POST "$GW/api/core/txns" -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"requestNo\":\"$REQ\",\"txnType\":\"INNER_TRANSFER\",\"fromAcct\":\"$ZS\",\"toAcct\":\"$LS\",\"amount\":10000,\"summary\":\"e2e 转账\",\"channel\":\"OPENAPI\",\"operator\":\"e2e\",\"branchNo\":\"990\"}")
echo "$RESULT" | grep -q '"status":"SUCCESS"' && echo "PASS transfer" || { echo "FAIL transfer: $RESULT"; exit 1; }
# 幂等重放
REPLAY=$(curl -sf -X POST "$GW/api/core/txns" -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"requestNo\":\"$REQ\",\"txnType\":\"INNER_TRANSFER\",\"fromAcct\":\"$ZS\",\"toAcct\":\"$LS\",\"amount\":10000,\"summary\":\"e2e 转账\",\"channel\":\"OPENAPI\",\"operator\":\"e2e\",\"branchNo\":\"990\"}")
echo "$REPLAY" | grep -q '"duplicated":true' && echo "PASS idempotent replay" || { echo "FAIL replay: $REPLAY"; exit 1; }

echo "== 3. 理财申购 WB001 1000.00 =="
SUB=$(curl -sf -X POST "$GW/api/wealth/orders/subscribe" -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"requestNo\":\"$REQ-SUB\",\"customerId\":\"1\",\"acctNo\":\"$ZS\",\"productCode\":\"WB001\",\"amount\":100000,\"channel\":\"OPENAPI\",\"operator\":\"e2e\"}")
echo "$SUB" | grep -q '"status":"PAY_SUCCESS"' && echo "PASS subscribe" || { echo "FAIL subscribe: $SUB"; echo "提示：E2E 会推进业务状态（产品售出即转存续期），请先执行 ./scripts/reset.sh 重置环境"; exit 1; }

echo "== 3b. 小额贷款 LN002 申请 5000.00 → 审批放款 → 还一期 =="
APP=$(curl -sf -X POST "$GW/api/loan/applications" -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"requestNo\":\"$REQ-LOAN\",\"customerId\":\"1\",\"productCode\":\"LN002\",\"amount\":500000,\"termMonths\":6,\"purpose\":\"e2e 演示\",\"acctNo\":\"$ZS\",\"channel\":\"OPENAPI\",\"operator\":\"e2e\"}")
echo "$APP" | grep -q '"status":"DISBURSED"' && echo "PASS loan apply+disburse" || { echo "FAIL loan apply: $APP"; exit 1; }
LOANNO=$(echo "$APP" | jget "d['data']['loanNo']")
RP=$(curl -sf -X POST "$GW/api/loan/loans/repay" -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"requestNo\":\"$REQ-RP\",\"loanNo\":\"$LOANNO\",\"customerId\":\"1\",\"acctNo\":\"$ZS\",\"repayMode\":\"INSTALLMENT\",\"channel\":\"OPENAPI\",\"operator\":\"e2e\"}")
echo "$RP" | grep -q '"status":"SUCCESS"' && echo "PASS loan repay(installment)" || { echo "FAIL loan repay: $RP"; exit 1; }

echo "== 4. T+1 确认 + 收益计提（快进至明日） =="
TOMORROW=$(date -v+1d +%Y-%m-%d 2>/dev/null || date -d tomorrow +%Y-%m-%d)
curl -sf -X POST "$GW/api/wealth/internal/batch/confirm/trigger?batchDate=$TOMORROW" >/dev/null
curl -sf -X POST "$GW/api/wealth/internal/batch/accrual/trigger?batchDate=$TOMORROW" >/dev/null
POS=$(curl -sf "$GW/api/wealth/positions?customerId=1" -H "$AUTH")
echo "$POS" | grep -q 'WB001' && echo "PASS confirm+position" || { echo "FAIL position: $POS"; exit 1; }

echo "== 5. 日终批量（当日会计日期）+ 总分核对 =="
# 日终以当日会计日期汇总分录；T+1 确认/计提已在第 4 步快进
BATCH=$(curl -sf -X POST "$GW/api/core/internal/batch/day-end/trigger")
echo "$BATCH" | grep -q '"status":"SUCCESS"' && echo "PASS day-end batch" || { echo "FAIL batch: $BATCH"; exit 1; }
TODAY=$(date +%Y-%m-%d)
RECON=$(curl -sf "$GW/api/core/batch/recon-report?batchDate=$TODAY" -H "$AUTH")
BAL=$(echo "$RECON" | jget "d['data']['balanced']")
[ "$BAL" = "True" ] && echo "PASS recon balanced" || { echo "FAIL recon: $RECON"; exit 1; }

echo "== 6. 理财对账 =="
curl -sf -X POST "$GW/api/wealth/internal/recon/trigger?batchDate=$TODAY" >/dev/null
echo "ALL E2E PASSED ✅"
