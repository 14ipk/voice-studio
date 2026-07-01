# ============================================================
#  Voice Studio — Fly.io 生产镜像
#  多阶段构建,最终镜像仅含运行时必需文件
# ============================================================

# ---- 阶段 1: 构建前端 + 安装依赖 ----
FROM node:22-slim AS builder
WORKDIR /app

# 启用 pnpm
RUN corepack enable && corepack prepare pnpm@10 --activate

# 复制依赖清单
COPY package.json pnpm-lock.yaml* ./

# 安装全部依赖(含 devDependencies 用于 vite build)
RUN pnpm install --no-frozen-lockfile

# 复制源码
COPY . .

# 构建前端 (会输出到 dist/)
RUN pnpm run build

# 清理 devDependencies,减小运行时镜像
RUN pnpm prune --prod

# ---- 阶段 2: 运行时 ----
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
# Fly.io 持久卷挂载点
ENV DATA_DIR=/data

# 复制运行时文件
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/api ./api
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/.gitignore ./

EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:'+process.env.PORT+'/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

# 启动 Express 服务器(同时托管前端 + API)
CMD ["node_modules/.bin/tsx", "api/server.ts"]
