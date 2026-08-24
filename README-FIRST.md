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
| 部署到 Render | 按 `DEPLOY-RENDER-NEON.md` 操作 |

## ❌ 千万不要做的事

| ❌ 错 | ✅ 对 |
|---|---|
| 双击 `node_modules\xxx\node.js` | 用 `node script.js` 命令运行 |
| Win+R 粘贴 `node -e "..."` | 打开 cmd/PowerShell 后再粘贴 |
| 在文件资源管理器里"打开" .js | 用编辑器或命令行打开 |

## 部署 6 步速览

详见 `DEPLOY-RENDER-NEON.md`，简要步骤：

1. **生成密钥**：双击 `generate-secrets.bat` → 把生成的 3 个值记下来
2. **注册 Neon**：https://neon.tech → 创建项目 → 复制连接串 → 选 Singapore 区域
3. **推 GitHub**：用 GitHub Desktop 把 `invoice-sign-platform` 推到自己的 GitHub
4. **Render 建服务**：https://render.com → New Web Service → 选仓库 → Free 套餐 → 填环境变量
5. **验证**：访问 `https://你的服务名.onrender.com/admin` 登录
6. **保活**：用 UptimeRobot 监控 `/healthz`，避免免费实例 15 分钟无请求后休眠
