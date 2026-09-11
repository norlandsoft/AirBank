# ---- 构建阶段：node:22-alpine + corepack pnpm ----
# 构建上下文为仓库根（见 deploy/compose），前端目录与共享字体目录 assets/ 一并拷入
FROM node:22-alpine AS build
WORKDIR /app

RUN corepack enable

COPY airbank-ebank-web/package.json airbank-ebank-web/pnpm-lock.yaml airbank-ebank-web/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY airbank-ebank-web/ ./
COPY assets/ /assets/
RUN pnpm build

# ---- 运行阶段：nginx:1.27-alpine ----
FROM nginx:1.27-alpine
COPY airbank-ebank-web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
