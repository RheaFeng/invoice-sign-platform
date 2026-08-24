# 在线发票签署平台（Invoice Sign Platform）

类似 Adobe Sign 的发票签署系统：上传 Excel 模板 → 自动生成发票与专属签署链接 → 邮件发送 → 收件人在线预览并签字 → 管理员后台跟踪状态、批量下载、每日自动提醒。

## 功能

| 模块 | 说明 |
|---|---|
| Excel 上传 | 支持现有 `Invoice mail merge template.xlsx` 结构，自动识别列；敏感字段（邮箱、银行、收款信息）AES-256-GCM 加密存储 |
| 签署链接 | 每条发票生成 128-bit 随机 token 链接，数据库只存 SHA-256 哈希，无法反查他人数据；签署页仅显示本人信息 |
| 在线签字 | 网页预览发票 + 手写画板签名 / 输入姓名签名，二选一 |
| 邮件 | 配置 SMTP 后自动发送邀请与提醒；未配置时自动生成 `.eml` 草稿，在后台「Reminders」页下载后手动发送 |
| 每日提醒 | 每天 10:00（北京时间）对未签署发票自动提醒，直至签署完成 |
| 批量下载 | 已签署发票 PDF（合成签名），未签署原发票 PDF，一键打包 ZIP |
| 管理后台 | 状态看板、发票列表（筛选/搜索/分页）、用户管理、布局设置（标题/主题色/文案/邮件模板）、审计日志 |

## 本地运行

```bash
npm install
# 复制 .env.example 为 .env 并填写 ENCRYPTION_KEY / SESSION_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"  # 生成密钥
npm start
```

访问 `http://localhost:3000/admin`。首次使用：
1. 如果配置了 `ADMIN_INIT_PASSWORD`，会自动创建管理员 `admin`；
2. 否则打开页面会看到「Initialize System」表单，自己设置管理员密码。
3. 登录后在「Users」页添加操作用户，在「Layout Settings」页调整页面外观。

## 免费公网部署（Render + Neon）⭐ 推荐

全程免费：Render Web Service（每月 750 小时）+ Neon PostgreSQL（0.5GB 存储）。

**👉 完整步骤请阅读 [DEPLOY-RENDER-NEON.md](./DEPLOY-RENDER-NEON.md)**

简要流程：
1. 生成安全密钥（ENCRYPTION_KEY / SESSION_SECRET / ADMIN_INIT_PASSWORD）
2. 注册 Neon → 创建免费 PostgreSQL 数据库 → 复制连接串
3. 推送代码到 GitHub
4. 在 Render 创建 Web Service → 配置环境变量 → 部署
5. 配置 UptimeRobot 保活（防 Render 免费实例休眠）
6. （可选）配置企业邮箱 SMTP 实现自动发信

部署配置文件已就绪：`render.yaml`（Blueprint）、`Dockerfile`（备用）、`.dockerignore`、`.gitignore`。

## 安全说明

- **字段级加密**：姓名、邮箱、发票号、项目、账期、收款信息全部 AES-256-GCM 加密后入库；即使数据库泄露，无 `ENCRYPTION_KEY` 也无法读取。
- **签署链接防枚举**：链接 token 128-bit 随机，数据库仅存 SHA-256 哈希，拿到数据库也无法还原他人链接；链接仅能查看本人发票。
- **管理员会话**：签名 Cookie（HMAC-SHA256），7 天有效；登录有 15 分钟 20 次限流；签署接口有请求频率限制。
- **敏感信息隔离**：银行/收款等字段仅登录管理员可见，签署页面只展示计费明细。

## 目录结构

```
├── server.js              # 入口（已配置 trust proxy）
├── render.yaml            # Render Blueprint 部署配置
├── Dockerfile             # Docker 构建文件（备用）
├── .dockerignore          # Docker 构建排除
├── .gitignore             # Git 排除
├── .env.example           # 环境变量模板
├── DEPLOY-RENDER-NEON.md  # ⭐ Render+Neon 完整部署指南
├── src/
│   ├── config.js          # 环境变量配置
│   ├── db.js              # Knex + 数据库迁移（支持 pg / better-sqlite3）
│   ├── middleware/auth.js # 会话认证中间件
│   ├── routes/            # auth / admin / sign 路由
│   └── services/          # security / excel / pdf / mailer / reminder / settings / templates
└── public/                # sign.html 签署页 + admin.html 管理后台
```
