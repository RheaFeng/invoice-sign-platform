# Cloudflare Tunnel 公网部署指南

本方案按照你提供的架构图实现：**本地服务器 + Cloudflare Tunnel + 自有域名**，无需公网 IP、无需开放路由器端口。

> 提示：此方案要求你的电脑保持开机，且 Node.js 服务与 Cloudflare Tunnel 同时运行。如需更高可用性，建议使用 Render/Neon 云部署（见 `README.md`）。

---

## 前置条件

1. **Cloudflare 账号**：免费注册 https://dash.cloudflare.com
2. **域名**：在 Cloudflare 托管的域名（可在 Cloudflare 注册，或使用已购买的域名并修改 NS 到 Cloudflare）
3. **本机环境**：已在本目录运行过发票平台，且 `http://localhost:3000` 可正常访问

---

## 已下载文件

- `cloudflared.exe`：Cloudflare Tunnel 客户端
- `cloudflared-config.yml`：隧道配置文件（需你填入 tunnel-id 和域名）
- `start-server.bat`：启动发票平台
- `start-tunnel.bat`：启动 Cloudflare Tunnel
- `install-service.bat`：将两者安装为 Windows 开机自启服务（需管理员权限）

---

## 部署步骤

### 1. 登录 Cloudflare

在 PowerShell 或 CMD 中进入本目录，运行：

```powershell
.\cloudflared.exe tunnel login
```

浏览器会弹出授权页面，选择你的域名并授权。授权成功后，会生成证书：
`%USERPROFILE%\.cloudflared\cert.pem`

### 2. 创建隧道

```powershell
.\cloudflared.exe tunnel create invoice-sign-platform
```

输出示例：

```
Tunnel credentials written to C:\Users\<你>\.cloudflared\<TUNNEL-ID>.json
Created tunnel invoice-sign-platform with id <TUNNEL-ID>
```

复制 `<TUNNEL-ID>`。

### 3. 配置域名和隧道

编辑 `cloudflared-config.yml`：

- 将 `<YOUR-TUNNEL-ID>` 替换为上一步的 tunnel-id（共两处）
- 将 `invoices.yourdomain.com` 替换为你自己的子域名，例如 `invoice.aithoth.com`

示例：

```yaml
tunnel: 1a2b3c4d-5e6f-7g8h-9i0j-1k2l3m4n5o6p
credentials-file: "%USERPROFILE%/.cloudflared/1a2b3c4d-5e6f-7g8h-9i0j-1k2l3m4n5o6p.json"

ingress:
  - hostname: invoice.aithoth.com
    service: http://localhost:3000
  - service: http_status:404
```

### 4. 创建 DNS 记录

运行：

```powershell
.\cloudflared.exe tunnel route dns invoice-sign-platform invoice.aithoth.com
```

（将 `invoice.aithoth.com` 换成你的子域名）

这会自动在 Cloudflare DNS 中添加一条 CNAME 记录。

### 5. 配置发票平台公网地址

编辑 `.env` 文件，将：

```env
BASE_URL=http://localhost:3000
```

改为你的公网域名：

```env
BASE_URL=https://invoice.aithoth.com
```

> 必须带 `https://`，因为 Cloudflare Tunnel 默认提供 HTTPS。

### 6. 启动服务

先启动发票平台：

```powershell
.\start-server.bat
```

再打开另一个窗口启动隧道：

```powershell
.\start-tunnel.bat
```

等待显示 `Connected` 后，即可通过 `https://invoice.aithoth.com/admin` 访问管理后台。

---

## 设置为开机自启（推荐）

以**管理员身份**运行：

```powershell
.\install-service.bat
```

然后启动服务：

```powershell
net start InvoiceSignPlatform
net start cloudflared
```

---

## 安全建议

1. **首次访问后立刻修改管理员密码**：登录 `https://你的域名/admin`，进入侧边栏 "Change password"
2. **重新生成密钥**：上线前重新生成 `.env` 中的 `ENCRYPTION_KEY` 和 `SESSION_SECRET`（可用 `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` 生成）
3. **配置企业邮箱 SMTP**：在 `.env` 中填写 SMTP 信息，否则邮件会生成 `.eml` 草稿，需手动下载发送
4. **Cloudflare Access（可选）**：在 Cloudflare Zero Trust 中给 `/admin` 路径增加额外身份验证，防止管理后台被公开访问

---

## 常见问题

### 隧道显示 Connected，但访问域名报错 502

- 确认 `http://localhost:3000` 本地可访问
- 确认 `.env` 中的 `BASE_URL` 已改为公网域名
- 确认 `cloudflared-config.yml` 中的 `service: http://localhost:3000` 正确

### 邮件发送失败

- 检查 `.env` 中 `SMTP_HOST`、`SMTP_USER`、`SMTP_PASS` 是否填写
- 如使用 Gmail，需使用"应用专用密码"
- 如无法配置 SMTP，系统会自动生成 `.eml` 草稿，可在管理后台 Reminders 页下载后手动发送

### 电脑重启后无法访问

- 检查两个 Windows 服务是否已启动：`InvoiceSignPlatform` 和 `cloudflared`
- 或重新运行 `start-server.bat` 和 `start-tunnel.bat`
