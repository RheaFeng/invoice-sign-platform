# Render + Neon 免费云部署完整指南

> **架构**：你的代码运行在 Render 免费 Node 服务上，数据存储在 Neon 免费 PostgreSQL 上。  
> 全程零费用，全球可访问，HTTPS 自动生效。

---

## 目录

1. [部署前准备](#1-部署前准备)
2. [注册 Neon 数据库（5 分钟）](#2-注册-neon-数据库5-分钟)
3. [推送代码到 GitHub（5 分钟）](#3-推送代码到-github5-分钟)
4. [在 Render 创建服务（10 分钟）](#4-在-render-创建服务10-分钟)
5. [验证部署](#5-验证部署)
6. [配置保活防休眠](#6-配置保活防休眠)
7. [配置 SMTP 邮件发送（可选）](#7-配置-smtp-邮件发送可选)
8. [日常使用](#8-日常使用)
9. [常见问题](#9-常见问题)

---

## 1. 部署前准备

### 你需要准备的东西

| 项目             | 说明                | 费用              |
| -------------- | ----------------- | --------------- |
| GitHub 账号      | 用于托管代码            | 免费              |
| Render 账号      | 用于运行服务器           | 免费额度（每月 750 小时） |
| Neon 账号        | 用于 PostgreSQL 数据库 | 免费额度（0.5GB 存储）  |
| UptimeRobot 账号 | 用于保活防休眠           | 免费额度（50 个监控）    |

### 生成安全密钥

在本项目目录下运行以下命令（需要 Node.js），**生成 3 个不同的随机密钥**，分别记录：

```bash
node -e "console.log('ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('base64'))"
node -e "console.log('SESSION_SECRET=' + require('crypto').randomBytes(32).toString('base64'))"
node -e "console.log('ADMIN_INIT_PASSWORD=' + require('crypto').randomBytes(12).toString('base64'))"
```

将输出保存好，后面要在 Render 配置环境变量时填入。例如：

```
ENCRYPTION_KEY=Kx9m4pQ8vN3wR7tY2sL6hJ5fD0gB8cA1eZ4xW9nM7qI=
SESSION_SECRET=Ab3Cd6Ef9Hi2Jk5Lm8No1Pq4Rs7Tu0Vw3Xy6Zz9Bb2Cc5Dd8Ee=
ADMIN_INIT_PASSWORD=YWJjMTIzNDU2Nw==
```

> ⚠️ **ENCRYPTION_KEY 是数据加密密钥，一旦设置不可更改！** 如果丢失，已加密的发票数据将无法解密。请额外备份一份到安全的地方。

---

## 2. 注册 Neon 数据库（5 分钟）

1. 打开 <https://neon.tech> → 点击 **Sign Up**（可用 GitHub 账号直接登录）
2. 创建项目：
   - **Project name**：`invoice-platform`（随意）
   - **Region**：选 `Asia Pacific (Singapore)` — 离中国最近
   - **Postgres version**：默认即可
3. 创建完成后，页面会显示连接串，**复制 Connection string**：
   ```
   postgresql://neondb_owner:AbCdEf123456@ep-cool-name-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
   > 🔑 **这个连接串就是后面的 `DATABASE_URL`，请保存好，尤其是密码部分。**
4. 验证：在 Neon 控制台左侧可以看到你的数据库 `neondb`，初始为空表（部署后自动建表）

---

## 3. 推送代码到 GitHub（5 分钟）

### 方式 A：用 GitHub Desktop（推荐，零命令行）

1. 下载安装 <https://desktop.github.com>
2. 登录 → **File → New Repository**
   - **Name**：`invoice-sign-platform`
   - **Local path**：选择项目目录 `WorkBuddy\2026-08-12-16-55-28\invoice-sign-platform`
   - 勾选 **Initialize this repository with a README**
3. 点击 **Commit to main** → **Push origin**
4. 确认 GitHub 网站上能看到代码

### 方式 B：用命令行

```bash
cd "C:\Users\Chuanchuan Feng\WorkBuddy\2026-08-12-16-55-28\invoice-sign-platform"

git init
git add .
git commit -m "Invoice Sign Platform - ready for Render deployment"

# 在 GitHub 网站创建一个空仓库 invoice-sign-platform（不要勾选 README/gitignore）
git remote add origin https://github.com/你的用户名/invoice-sign-platform.git
git branch -M main
git push -u origin main
```

> ⚠️ 确认 `.gitignore` 已排除 `.env`、`data/`、`node_modules/`、`cloudflared.exe`（都已配好）

---

## 4. 在 Render 创建服务（10 分钟）

### 方式 A：Blueprint 一键导入（推荐）

1. 打开 <https://render.com> → 注册/登录（可用 GitHub 账号）
2. 进入 Dashboard → 右上角 **New +** → **Blueprint**
3. 选择你刚推送的 `invoice-sign-platform` 仓库
4. Render 会自动读取 `render.yaml`，识别出需要创建的服务
5. 点击 **Apply** 创建服务

### 方式 B：手动创建

1. Dashboard → **New +** → **Web Service**
2. 连接你的 GitHub 仓库 `invoice-sign-platform`
3. 填写配置：
   - **Name**：`invoice-sign-platform`（会成为 URL 的一部分）
   - **Runtime**：`Node`
   - **Build Command**：`npm install --omit=dev --omit=optional --no-audit --no-fund`
   - **Start Command**：`node server.js`
   - **Instance Type**：`Free`
4. 点击 **Create Web Service**

### 配置环境变量（关键步骤）

无论是方式 A 还是 B，部署前都需要在 Render 的 **Environment** 标签页添加以下变量：

| 变量名                   | 值                                   | 说明                                |
| --------------------- | ----------------------------------- | --------------------------------- |
| `NODE_ENV`            | `production`                        | 生产模式                              |
| `PORT`                | `3000`                              | 服务端口                              |
| `BASE_URL`            | `https://你的服务名.onrender.com`        | Render 分配的公网地址（部署后才有，可先空着，部署后回来填） |
| `DATABASE_CLIENT`     | `pg`                                | 使用 PostgreSQL                     |
| `DATABASE_URL`        | `postgresql://...?sslmode=require`  | 第 2 步 Neon 复制的连接串                 |
| `ENCRYPTION_KEY`      | 第 1 步生成的值                           | 数据加密密钥                            |
| `SESSION_SECRET`      | 第 1 步生成的值                           | 会话签名密钥                            |
| `ADMIN_INIT_PASSWORD` | 第 1 步生成的值                           | 管理员初始密码（登录后修改，然后删除此变量）            |
| `SMTP_HOST`           | （见第 7 步）                            | 企业邮箱 SMTP 主机，暂时留空                 |
| `SMTP_PORT`           | `465`                               | SMTP 端口                           |
| `SMTP_SECURE`         | `true`                              | 使用 SSL                            |
| `SMTP_USER`           | （见第 7 步）                            | SMTP 用户名                          |
| `SMTP_PASS`           | （见第 7 步）                            | SMTP 授权码                          |
| `MAIL_FROM`           | `Rhea Feng <rhea.feng@aithoth.com>` | 发件人显示名                            |
| `REMINDER_CRON`       | `0 10 * * *`                        | 每天 10:00 提醒（北京时间）                 |
| `REMINDER_STRATEGY`   | `ALL`                               | 每天提醒所有未签署者                        |

### 首次部署流程

1. 添加完环境变量后，Render 会自动开始构建
2. 等待 Build 完成（约 1-3 分钟），状态变为 **Live**
3. 此时你的服务地址是 `https://invoice-sign-platform-xxxx.onrender.com`
4. **回到 Render 的 Environment**，将 `BASE_URL` 填入这个完整地址
5. Render 会自动重新部署（或手动点 **Manual Deploy → Deploy latest commit**）

---

## 5. 验证部署

### 5.1 健康检查

浏览器访问：

```
https://你的域名.onrender.com/healthz
```

应返回 `ok`。

### 5.2 管理后台

访问：

```
https://你的域名.onrender.com/admin
```

- 如果配置了 `ADMIN_INIT_PASSWORD`：用 `admin` + 你设置的密码登录
- 如果没配置：页面会显示 **Initialize System** 表单，自己设置管理员密码

### 5.3 功能验证清单

| 测试项      | 操作                                            | 预期结果                     |
| -------- | --------------------------------------------- | ------------------------ |
| 登录       | 输入 admin / 密码                                 | 进入 Dashboard             |
| 上传 Excel | Upload 页上传 `Invoice mail merge template.xlsx` | 显示 "Created N invoices"  |
| 签署链接     | 发票列表点 "Link" → 复制链接 → 浏览器打开                   | 显示发票详情 + 签字区             |
| 签字       | 手写或输入姓名 → Submit                              | 显示 "Successfully signed" |
| 状态更新     | 回到 Dashboard 刷新                               | 该发票状态变为 Signed           |
| 批量下载     | 勾选发票 → Download Selected                      | 下载 ZIP，内含 PDF            |
| 改密码      | 右上角 → Change Password                         | 成功修改                     |
| 布局设置     | Layout Settings 页修改标题/主题色                     | 签署页面样式更新                 |
| 添加用户     | Users 页添加操作员                                  | 新用户可登录                   |

---

## 6. 配置保活防休眠

Render 免费实例 **15 分钟无请求会自动休眠**，休眠时：

- 网站无法访问（收到 502 或加载超时）
- 定时提醒任务不会执行

### 解决方案：UptimeRobot 免费保活

1. 打开 <https://uptimerobot.com> → 注册（免费）
2. **Add New Monitor**：
   - **Monitor Type**：`HTTP(s)`
   - **Friendly Name**：`Invoice Platform Keep-Alive`
   - **URL**：`https://你的域名.onrender.com/healthz`
   - **Monitoring Interval**：`5 minutes`
3. 点击 **Create Monitor**

这样每 5 分钟 ping 一次，实例永远不会休眠。

> ✅ 免费额度 50 个监控器，完全够用。

---

## 7. 配置 SMTP 邮件发送（可选）

不配置 SMTP 时，系统会生成 `.eml` 草稿，你在后台 **Reminders** 页下载后用 Outlook 手动发送。

配置后，系统**自动发送签署链接邮件和每日提醒**。

### 常见邮箱 SMTP 配置

| 邮箱       | SMTP_HOST               | SMTP_PORT | SMTP_USER               | SMTP_PASS            |
| -------- | ----------------------- | --------- | ----------------------- | -------------------- |
| 企业邮箱(腾讯) | `smtp.exmail.qq.com`    | 465       | `rhea.feng@aithoth.com` | 登录邮箱后台生成授权码          |
| Gmail    | `smtp.gmail.com`        | 465       | 你的 Gmail 地址             | App Password（需开 2FA） |
| Outlook  | `smtp-mail.outlook.com` | 587       | 邮箱地址                    | 邮箱密码                 |
| QQ 邮箱    | `smtp.qq.com`           | 465       | QQ 邮箱地址                 | 授权码（非密码）             |

### 在 Render 配置

进入 Render Dashboard → 你的服务 → **Environment** → 添加/修改：

```
SMTP_HOST=smtp.exmail.qq.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=rhea.feng@aithoth.com
SMTP_PASS=你的SMTP授权码
MAIL_FROM=Rhea Feng <rhea.feng@aithoth.com>
```

保存后自动重新部署。之后上传 Excel 时会自动发送签署邮件。

---

## 8. 日常使用

### 每月发票流程

```
1. 准备 Excel（使用现有 Invoice mail merge template.xlsx 模板）
2. 登录 https://你的域名.onrender.com/admin
3. Upload 页上传 Excel
4. 系统自动生成发票 + 签署链接
   - 配置了 SMTP：自动发邮件给每个 Agent
   - 未配置 SMTP：在 Reminders 页下载 .eml 草稿，用 Outlook 手动发送
5. Dashboard 实时查看签署状态
6. 全部签署完成后，批量下载 ZIP（含签名 PDF）
7. 文件名格式：Agent name invoice_Project Name_YYYYMM.pdf
```

### 安全注意事项

| 事项           | 操作                                                        |
| ------------ | --------------------------------------------------------- |
| 修改管理员密码      | 登录后右上角 → Change Password                                  |
| 删除初始密码变量     | Render Dashboard → Environment → 删除 `ADMIN_INIT_PASSWORD` |
| 添加操作用户       | Users 页 → 添加（可设为 operator 仅查看，或 admin 全权）                 |
| 备份加密密钥       | `ENCRYPTION_KEY` 丢失 = 数据不可恢复，请额外备份                        |
| 定期检查 Neon 用量 | <https://console.neon.tech> 查看存储用量（免费 0.5GB）              |

---

## 9. 常见问题

### Q: 部署后访问报 502 / 加载很慢？

Render 免费实例首次启动需要约 30-60 秒（冷启动）。等待后刷新即可。配置 UptimeRobot 后不会再冷启动。

### Q: 上传 Excel 后没有收到邮件？

检查是否配置了 SMTP 环境变量。未配置时系统不会发邮件，而是在后台 **Reminders** 页生成 `.eml` 草稿。

### Q: 每日提醒没有执行？

1. 确认 UptimeRobot 在运行（实例未休眠）
2. 确认 `REMINDER_CRON` 设置正确（默认 `0 10 * * *` = 北京时间 10:00）
3. 查看 Render 日志：Dashboard → Logs → 搜索 `[reminder]`

### Q: 如何更新代码？

```bash
# 本地修改代码后
git add .
git commit -m "描述修改内容"
git push origin main
```

Render 检测到推送后会自动重新部署。

### Q: Neon 免费额度够用吗？

免费 0.5GB 存储，每条发票记录约 2-5KB。可存储约 10 万条发票记录，完全够用。如超限，Neon 会暂停读写，可删除旧数据恢复。

### Q: 如何删除已签署的旧发票？

登录管理后台 → Invoices 页 → 勾选要删除的 → Delete（管理员权限）。或在 Neon 控制台直接执行 SQL。

### Q: 忘记管理员密码怎么办？

在 Render 的 Environment 中重新设置 `ADMIN_INIT_PASSWORD` 为新密码，保存部署。如果已有管理员账号，需要通过 Neon 控制台或 API 重置。建议联系有 admin 权限的其他用户帮忙重置。

### Q: 可以绑定自己的域名吗？

Render 免费版不支持自定义域名（需要升级到付费计划）。使用 `https://你的服务名.onrender.com` 即可。

---

## 文件清单

部署完成后，以下文件已就绪，无需额外修改：

| 文件              | 作用                        | 部署时是否需要修改            |
| --------------- | ------------------------- | -------------------- |
| `render.yaml`   | Render Blueprint 配置       | ❌ 不需要，已在环境变量中配置      |
| `Dockerfile`    | Docker 构建文件（备用）           | ❌                    |
| `.dockerignore` | Docker 构建排除列表             | ❌                    |
| `.gitignore`    | Git 排除列表                  | ❌                    |
| `.env.example`  | 环境变量模板参考                  | ❌ 仅为参考，实际在 Render 配置 |
| `server.js`     | 服务入口（已加 trust proxy）      | ❌                    |
| `package.json`  | 依赖清单（better-sqlite3 已改可选） | ❌                    |
| `src/`          | 后端代码                      | ❌                    |
| `public/`       | 前端页面                      | ❌                    |
