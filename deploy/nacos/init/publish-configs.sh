#!/bin/sh
# 首次部署：等待 Nacos 就绪 → 创建命名空间 → 幂等发布全部配置（docs/design/09 §5.2）
set -e
NACOS="${NACOS_ADDR:-airbank-nacos}:8848"
NS="${NACOS_NAMESPACE:-airbank-dev}"
GROUP="AIRBANK_GROUP"
i=0
until curl -sf "http://$NACOS/nacos/v1/console/health/liveness" >/dev/null 2>&1; do
  i=$((i+1)); [ "$i" -ge 60 ] && echo "nacos not ready, abort" && exit 1
  sleep 2
done
curl -s -X POST "http://$NACOS/nacos/v1/console/namespaces" \
  -d "customNamespaceId=$NS&namespaceName=AirBank&namespaceDesc=AirBank training env" >/dev/null || true
cd /configs || exit 1
for f in *.yaml; do
  dataId="$f"
  r=$(curl -s -X POST "http://$NACOS/nacos/v1/cs/configs" \
    --data-urlencode "dataId=$dataId" --data-urlencode "group=$GROUP" \
    --data-urlencode "tenant=$NS" --data-urlencode "type=yaml" --data-urlencode "content@$f")
  echo "publish $dataId -> $r"
  [ "$r" = "true" ] || exit 1
done
echo "[nacos-init] all configs published."
