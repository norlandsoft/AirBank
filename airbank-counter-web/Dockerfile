# ---- 构建阶段：pnpm + vite ----
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json pnpm-lock.yaml* ./
COPY . .
RUN corepack enable && pnpm install && pnpm build

# ---- 运行阶段：nginx 托管静态资源 ----
FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
