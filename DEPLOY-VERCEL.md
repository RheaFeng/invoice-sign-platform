# Vercel + Neon 免费部署指南（无信用卡）

> **架构**：前端页面 + API 运行在 Vercel Serverless 函数上（免费、无需信用卡），数据存储在 Neon 免费 PostgreSQL。
> 每日自动提醒改用 **Vercel Cron**（免费版每天 1 次，北京时间早上 8:00 触发）。

---

## 部署前你已准备好的东西（核对清单）

| 项目 | 状态 |
|---|---|
| GitHub 仓库 `RheaFeng/invoice-sign-platform` | ✅ 已有代码（需再推送本次 Vercel 改造） |
| Neon 数据库（`DATABASE_URL`） | ✅ 已连接验证（PostgreSQL 18.6） |
| 安全密钥 | ✅ 已生成（ENCRYPTION_KEY / SESSION_SECRET / ADMIN_INIT_PASSWORD） |
| Vercel 账号 | ❓ 需要注册（免费，不需要信用卡） |

---

## 第 1 步：把改造后的代码推送到 GitHub

本次已为 Vercel 完成代码改造（新增 `api/index.js`、`api/cron.js`、`vercel.json`，重构了启动逻辑），需要推送到 GitHub 后 Vercel 才能读到。

## 第 2 步：注册 Vercel（2 分钟，不需要信用卡）

1. 打开 **https://vercel.com** → 点 **Sign Up**
2. 选择 **Continue with GitHub**（用你的 GitHub 账号一键登录）
3. 按引导完成（可能要求验证手机号，**不要求绑定信用卡**）

## 第 3 步：导入项目（3 分钟）

1. 登录后进入 Dashboard → 点 **Add New…** → **Project**
2. 在列表里找到 **invoice-sign-platform** → 点 **Import**
3. 页面会自动读取仓库里的 `vercel.json`，**Framework Preset 会自动识别**，无需改动
4. 展开 **Environment Variables**，添加以下变量（必填 7 项 + 可选 2 项）：

| Key | Value（示例） |
|---|---|
| `DATABASE_CLIENT` | `pg` |
| `DATABASE_URL` | `postgresql://neondb_owner:你的密码@ep-xxxx-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require` |
| `ENCRYPTION_KEY` | 用 `generate-secrets.bat` 生成的正式值 |
| `SESSION_SECRET` | 用 `generate-secrets.bat` 生成的正式值 |
| `ADMIN_INIT_PASSWORD` | 用 `generate-secrets.bat` 生成的正式值 |
| `CRON_SECRET` | 随便一串长随机字符（如 `9fK2mQ7xR4vT8wZ1`），用于保护定时提醒接口 |
| `NODE_ENV` | `production` |

**可选（推荐配置，否则邮件只会生成草稿）：**

| Key | Value |
|---|---|
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` | 你的邮箱 SMTP 服务器（如 `smtp.office365.com` / `587` / `false`） |
| `SMTP_USER` / `SMTP_PASS` | 邮箱账号和密码（或授权码） |
| `MAIL_FROM` | 发件人显示，如 `Rhea Feng <rhea.feng@aithoth.com>` |
| `MAIL_REPLY_TO` | 收件人回信地址（可同发件人） |

> **BASE_URL 不用填**：Vercel 会自动提供 `VERCEL_URL` 环境变量，代码会自动生成正确的签署链接。若以后绑定了自定义域名，把 `BASE_URL` 填成你的域名（如 `https://sign.yourcompany.com`）即可。

5. 点 **Deploy**，等待 1-2 分钟构建完成
6. 构建完成后点 **Visit**（或 **Domains** 里的 `https://invoice-sign-platform.vercel.app`）打开你的网站

## 第 4 步：验证部署

1. 打开 `https://你的域名/admin`
2. 用 `admin` + 你设置的 `ADMIN_INIT_PASSWORD` 登录
3. 上传一个测试 Excel → 应生成发票 + 邀请链接/邮件
4. 打开签署链接 → 签字提交 → 回后台确认状态变为"已签署"
5. 打开 `https://你的域名/healthz` 应显示 `ok`

> 部署成功后建议到 Render 后台把之前没创建完的服务**删掉**（避免混淆），并把 GitHub token `render-push` 删除。

## 第 5 步：配置每日自动提醒（Vercel Cron）

`vercel.json` 已配置：

```json
"crons": [{ "path": "/api/cron", "schedule": "0 0 * * *" }]
```

- **免费版 Vercel Cron 每天最多触发 1 次**，`0 0 * * *` = 每天 UTC 00:00 = **北京时间早上 8:00**（自动对未签署发票发提醒邮件）
- 必须配置环境变量 `CRON_SECRET`，Vercel 触发时会自动带上 `Authorization: Bearer <CRON_SECRET>` 头，接口校验通过才执行
- 手动触发提醒：管理后台 → 提醒中心 → 手动运行，一样有效（不需要等 Cron）

## 第 6 步：配置邮件发送（可选但推荐）

不配置 SMTP 时，系统会为每封邮件生成 `.eml` 草稿存数据库，管理员在后台「提醒中心」下载后手动从 Outlook 发送。
配置 SMTP 后全部自动发送。

### 常见免费/可用 SMTP

| 服务 | SMTP 服务器 | 端口 | 加密 |
|---|---|---|---|
| 企业邮箱（如 aithoth.com） | 咨询 IT 部门 | 465/587 | SSL/TLS |
| QQ 邮箱 | `smtp.qq.com` | 465 | SSL（需开启 SMTP 并生成授权码） |
| 163 邮箱 | `smtp.163.com` | 465 | SSL（需授权码） |
| Gmail | `smtp.gmail.com` | 587 | TLS（需应用专用密码） |

配置后在 Vercel → Project → Settings → Environment Variables 里添加（或修改）对应变量，保存后会自动重新部署。

## 常见问题

### Q1: 部署后打开显示 404？
检查 `vercel.json` 是否在仓库根目录（`git ls-files | grep vercel`），以及是否已把本次改动推送到 GitHub。

### Q2: 上传 Excel 报错 / 无法生成？
- 免费版 Serverless 单次请求体限制约 4.5MB：Excel 请控制在几 MB 以内（模板通常几十 KB，没问题）
- 大批量上传（>50 行）建议分批，避免函数执行超时

### Q3: 每日提醒没收到？
- 先到后台「提醒中心」手动运行一次，确认邮件能发出
- 确认已配置 SMTP，且 `CRON_SECRET` 已设置
- Cron 免费版每天只跑 1 次（北京 8:00），不是实时

### Q4: 能绑定自己的域名吗？
可以：Vercel → Project → Settings → Domains → Add，填入你的域名并按提示配置 DNS 记录（免费版可绑定，但每个域名会占用配额）。

### Q5: 忘了 ADMIN_INIT_PASSWORD？
在 Vercel 环境变量里修改 `ADMIN_INIT_PASSWORD` 为新值，保存后重新部署。但注意：**仅当数据库里还没有 admin 账号时**才会创建；已有账号时请用后台「修改密码」功能。

## 数据安全提醒

- **ENCRYPTION_KEY 是数据加密密钥，丢失后已加密的发票数据无法解密**，请备份到密码管理器
- Neon 免费版 0.5GB 存储，发票数据 + 签名图片（base64）请留意用量，长期使用建议清理已完结的旧数据
- 每月用量可在 Vercel / Neon 控制台查看
