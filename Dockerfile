# Invoice Sign Platform — 生产优化 Dockerfile
# 使用 pg（PostgreSQL），不依赖 better-sqlite3 编译
FROM node:20-slim

WORKDIR /app

# 仅复制依赖描述
COPY package*.json ./

# 安装生产依赖（--omit=optional 跳过 better-sqlite3 编译）
RUN npm install --omit=dev --omit=optional --no-audit --no-fund

# 复制项目代码
COPY . .

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "server.js"]
