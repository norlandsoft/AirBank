#!/usr/bin/env bash
# 一键重置：销毁容器与数据卷并重新拉起（约 90 秒回到种子态）
set -eo pipefail
cd "$(dirname "$0")/.."
docker compose -f deploy/compose/docker-compose.yml down -v
docker compose -f deploy/compose/docker-compose.yml up -d
echo "[reset] AirBank restarted with fresh seed data."
