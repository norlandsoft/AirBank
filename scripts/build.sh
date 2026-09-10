#!/usr/bin/env bash
# 构建全部镜像：后端（Maven 多模块）+ 前端（Vite/nginx）
set -eo pipefail
cd "$(dirname "$0")/.."
mvn -q install -DskipTests
docker compose -f deploy/compose/docker-compose.yml build "$@"
echo "[build] all images built."
