# Inno Agent macOS 云端打包说明

通过 **GitHub Actions** 在云端 macOS 机器上自动构建 **arm64 DMG**，无需在本机安装 Electron 或执行打包命令。

工作流文件：`.github/workflows/release-mac.yml`  
Actions 中显示名称：**macOS Release**

---

## 1. 前置条件

| 条件 | 说明 |
|------|------|
| 仓库在 GitHub | 已启用 **Actions**（Settings → Actions → General） |
| workflow 在默认分支 | `.github/workflows/release-mac.yml` 必须在 **`main`** 上，Actions 左侧才会出现「macOS Release」；仅在功能分支时需先合并到 `main` |
| 权限 | 对仓库有 push tag 或手动运行 workflow 的权限 |

确认 workflow 是否存在：  
`https://github.com/<owner>/inno-agent/blob/main/.github/workflows/release-mac.yml`

---

## 2. 产物说明

| 项目 | 说明 |
|------|------|
| 格式 | `Inno Agent-<version>-arm64.dmg` |
| 架构 | **arm64**（Apple Silicon） |
| 签名 | 默认 **未签名**（`CSC_IDENTITY_AUTO_DISCOVERY=false`） |
| 安装 | 用户首次打开可能需 **右键 → 打开** 绕过 Gatekeeper |

---

## 3. 触发方式

### 3.1 推送版本 tag（正式发版）

```bash
# 确保 tag 指向包含 Electron 代码与 workflow 的提交
git tag v0.3.0
git push origin v0.3.0
```

- tag 须匹配 **`v*.*.*`**（如 `v0.2.0`、`v1.0.0`）
- 构建完成后 DMG 会出现在 **Releases** 页面，并附带自动生成的 Release Notes
- tag 含 `-beta` 或 `-rc` 时标记为 **预发布**

### 3.2 手动运行（测试包）

1. 打开仓库 **Actions**
2. 左侧选择 **macOS Release**
3. 右侧 **Run workflow**
4. **Use workflow from** 选择分支（如 `main` 或 `yrt`）
5. **version**（可选）：填写如 `0.3.1` 会临时改当次构建的 `package.json` 版本（不写回仓库）；留空则用当前分支上的版本号
6. 点击 **Run workflow**

手动触发 **不会** 创建 GitHub Release，仅在当次 run 的 **Artifacts** 中下载 DMG。

---

## 4. 构建流程（workflow 做了什么）

```
检出代码
  → Node.js 20 + npm ci
  → （可选）按输入覆盖 package.json 版本
  → 编译后端 tsc
  → 编译前端 Vite
  → electron-builder --mac dmg --arm64（未签名）
  → 上传 Artifacts（保留 30 天）
  → 若由 tag 触发：创建 Release 并附上 DMG
```

运行环境：`macos-14`（Apple Silicon runner）。

---

## 5. 如何下载 DMG

| 触发方式 | 下载位置 |
|----------|----------|
| 推送 tag | 仓库 **Releases** → 对应版本 → Assets |
| 手动 Run workflow | **Actions** → 点进该次 run → 底部 **Artifacts** → `InnoAgent-<version>-arm64` |

---

## 6. 启用代码签名与公证（可选）

当前为未签名包。正式对外分发时，在 workflow 中启用注释掉的签名步骤，并在仓库 **Settings → Secrets and variables → Actions** 配置：

| Secret | 含义 |
|--------|------|
| `CSC_LINK` | Base64 编码的 `.p12` 证书 |
| `CSC_KEY_PASSWORD` | 证书密码 |
| `APPLE_ID` | Apple ID 邮箱 |
| `APPLE_APP_SPECIFIC_PASSWORD` | 应用专用密码 |
| `APPLE_TEAM_ID` | 开发者 Team ID |

具体变量名与步骤见 `release-mac.yml` 内 **7b** 注释段。

---

## 7. 常见问题

### Actions 里搜不到「macOS Release」

- workflow 文件是否在 **`main`**（默认分支）上
- 是否已进入 **Actions** 页并刷新；新 workflow 合并后稍等片刻

### 推了分支但没有构建

- 仅 **push tag `v*.*.*`** 或 **手动 Run workflow** 会触发，普通分支 push **不会** 触发

### 构建失败

在 Actions 里点开失败的 job，查看具体 step（常见：`npm ci`、后端/前端编译、`electron-builder`）。本地可先 `npm run build` 验证能否通过编译。

### 合并分支后仍无 workflow

`main` 上需包含 `.github/workflows/release-mac.yml`；若只在 `yrt` 上有，需合并 PR 到 `main`。

---

## 8. 快速参考

```bash
# 正式发版（Release + DMG）
git tag v0.3.0 && git push origin v0.3.0
```

```text
Actions 入口：https://github.com/<owner>/inno-agent/actions/workflows/release-mac.yml
Releases 入口：https://github.com/<owner>/inno-agent/releases
```
