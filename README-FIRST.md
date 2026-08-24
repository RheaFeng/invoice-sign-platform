# ⚠️ 阅读我！（必读）

## 为什么要读这个

本项目是 Node.js 应用，**绝对不要双击 `.js` 文件**！Windows 默认会用"Windows Script Host（WSH）"以老式 JScript 引擎运行 JS 文件，导致 `module` 未定义等错误（错误代码 `800A1391`）。

## 怎么运行

正确方式 — 始终通过 **cmd / PowerShell / .bat 文件**调用 `node.exe`：

| 任务 | 正确做法 |
|---|---|
| 生成部署密钥（**第 1 步**） | 双击 `generate-secrets.bat` ← 一键完成 |
| 备用：生成密钥（如果 .bat 还报错） | 打开 PowerShell 或 cmd，运行 `node generate-secrets.js` |
| 启动本地服务器（调试用） | 双击 `start-server.bat` |
| 安装为 Windows 服务（可选） | 右键 `install-service.bat` → 以管理员身份运行 |
| 上传到 GitHub | 用 GitHub Desktop 或 `git` 命令行 |
| 部署到公网 | **首选 Vercel（无需信用卡）** 按 `DEPLOY-VERCEL.md`；备选 Render 按 `DEPLOY-RENDER-NEON.md` |

## ❌ 千万不要做的事

| ❌ 错 | ✅ 对 |
|---|---|
| 双击 `node_modules\xxx\node.js` | 用 `node script.js` 命令运行 |
| Win+R 粘贴 `node -e "..."` | 打开 cmd/PowerShell 后再粘贴 |
| 在文件资源管理器里"打开" .js | 用编辑器或命令行打开 |

## 部署 6 步速览（Vercel 方案，无需信用卡）

详见 `DEPLOY-VERCEL.md`，简要步骤：

1. **生成密钥**：双击 `generate-secrets.bat` → 把生成的 3 个值记下来（另需自定 1 个 `CRON_SECRET`）
2. **注册 Neon**：https://neon.tech → 创建项目 → 复制连接串 → 选 Singapore 区域（已完成 ✅）
3. **推 GitHub**：用 GitHub Desktop 或命令行把改造后的代码推到 `RheaFeng/invoice-sign-platform`
4. **Vercel 部署**：https://vercel.com → Sign Up（GitHub 登录）→ Add New Project → Import `invoice-sign-platform` → 填环境变量 → Deploy
5. **验证**：访问 `https://invoice-sign-platform.vercel.app/admin` 登录
6. **每日提醒**：Vercel Cron 已配置（每天北京 8:00 自动触发，需设 `CRON_SECRET`）

> 注：Vercel 免费版无需绑定信用卡；Render 新账号需要绑卡验证（已弃用，保留文档作备选）。
