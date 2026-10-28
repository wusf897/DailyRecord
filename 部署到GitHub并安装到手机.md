# 记录鸭 · 部署到 GitHub 并安装到手机（逐步操作）

全程约 10 分钟，不需要装 Android Studio，不需要写服务器代码。

有两条路，都能得到可安装的 App：

| 路线 | 得到什么 | 优点 | 缺点 |
| --- | --- | --- | --- |
| **A. GitHub Pages（推荐）** | 一个网址，手机上「安装」后有独立图标 | 改完代码推送即自动更新，零成本 | 首次打开需要联网 |
| **B. GitHub Actions 编译 APK** | 真正的 `.apk` 安装包 | 可发给别人、可离线、更像原生 App | 手动点一次编译，约 5–10 分钟 |

建议**先做 A 用起来**，想要安装包时再补 B（同一份仓库，不用重头再来）。

---

## 第 0 步：准备（1 分钟）

**本机状态：** Git 2.55.0 已安装；仓库已初始化好，默认分支 `main`；`.gitignore` 已配好（`node_modules/`、`www/`、`android/` 都会被忽略）。

**你还需要准备：**

1. 一个 GitHub 账号（没有就去 <https://github.com/signup> 注册）
2. 记下三个信息，后面每条命令里都要替换掉：

| 占位符 | 是什么 | 例子 |
| --- | --- | --- |
| `<用户名>` | 你的 GitHub 用户名 | `zhangsan` |
| `<邮箱>` | GitHub 绑定的邮箱 | `zhangsan@example.com` |
| `<仓库名>` | 给仓库起的名字，**只能用英文/数字/横线** | `jiluya` |

> ⚠️ **免费账号必须用公开（Public）仓库**，GitHub Pages 才免费开放。私有仓库要升级到 Pro 才能用 Pages。
> 别担心数据隐私：**仓库公开但数据不公开**——每个手机的数据只存在它自己的浏览器里，
> 别人打开网址看到的是他自己的空界面。

---

## 第 1 步：本机 Git 初始化

打开 **Git Bash**（或 PowerShell），进入项目目录：

```bash
cd "/c/Users/DELL/WorkBuddy/小工具开发/记录鸭"
```

### 1.1 告诉 Git 你是谁（每台电脑只需设一次）

```bash
git config user.name "<用户名>"
git config user.email "<邮箱>"
```

> 这两条只在当前仓库生效，不影响你电脑上别的项目。

### 1.2 仓库已经初始化好了，确认一下状态

```bash
git status
```

你应该看到绿色的已暂存文件列表（约 28 个），包含 `index.html`、`assets/`、`icons/`、`.github/` 等，
**不应该**出现 `node_modules/`、`www/`、`android/`。

如果 `git status` 提示 "not a git repository"，补一条：

```bash
git init
git symbolic-ref HEAD refs/heads/main
git add -A
```

### 1.3 提交第一个版本

```bash
git commit -m "记录鸭 v3：频次记录 App 首个版本"
```

看到类似 `28 files changed` 就成功了。

---

## 第 2 步：在 GitHub 上建仓库

1. 打开 <https://github.com/new>
2. **Repository name** 填 `<仓库名>`（如 `jiluya`）
3. 选 **Public**
4. **下面三项都不要勾**（Initialize with README、Add .gitignore、Choose a license）——
   我们本地已经有这些文件了，勾了会造成冲突
5. 点 **Create repository**

建好后页面会停在一段命令提示那里，**先别急着复制**，用下面第 3 步的。

---

## 第 3 步：推送到 GitHub

### 3.1 关联远程仓库

```bash
git remote add origin https://github.com/<用户名>/<仓库名>.git
```

用 `git remote -v` 确认能对上。

### 3.2 推送

```bash
git branch -M main
git push -u origin main
```

**第一次推送会要求登录**（Git for Windows 自带凭据管理器）：

- 会弹出浏览器窗口或对话框 → 选 **Sign in with your browser** → 按提示授权即可
- 如果弹的是命令行要密码：不要用登录密码，去
  GitHub → **Settings → Developer settings → Personal access tokens → Tokens (classic)**
  → **Generate new token**，勾选 `repo` 权限，生成的那串字符当作**密码**粘贴进来

推送成功后刷新 GitHub 仓库页面，应该能看到文件了。

---

## 第 4 步：开启 GitHub Pages（路线 A）

1. 仓库页面 → **Settings** → 左侧 **Pages**
2. **Source** 选 **GitHub Actions**（不是 "Deploy from a branch"）
3. 保存

然后去 **Actions** 标签页，会看到「部署到 GitHub Pages」工作流正在跑（是我已经配好的
`.github/workflows/deploy-pages.yml`）。等它变绿（约 1 分钟）。

完成后：**Settings → Pages** 页面顶部会出现你的网址：

```
https://<用户名>.github.io/<仓库名>/
```

> 例如用户名 `zhangsan`、仓库名 `jiluya`，网址就是 `https://zhangsan.github.io/jiluya/`
> （仓库若起名 `<用户名>.github.io`，网址就是 `https://<用户名>.github.io/`）

---

## 第 5 步：在安卓手机上安装成 App（路线 A 收尾）

1. 手机 Chrome 打开上一步的网址
2. 右上角 **⋮ 菜单** → **安装应用**（或「添加到主屏幕」）
3. 确认安装

桌面上会出现「记录鸭」图标。**打开后是全屏、无地址栏、有独立任务窗口，断网也能用**——
和原生 App 几乎没区别。

> 如果菜单里没有「安装应用」：确认是 HTTPS 网址（不要 HTTP）、系统是 Chrome 而非某些精简浏览器。
> 华为/小米自带浏览器对该功能支持不一，换 Chrome 最稳。

> **数据搬家**：手机上装好后，先用旧的那个（本地预览/旧手机）导出备份或同步码，
> 在手机 App 的设置页导入，记录就过去了。详见 `README.md` 的「换手机时怎么搬数据」。

---

## 第 6 步：编译真正的 APK（路线 B，可选）

装 Signed APK 其实还需要签名，我们先出 **debug 版自用完全够**（能装、能用、能备份）。

1. 推送完成后打开仓库 → **Actions** 标签页
2. 左侧工作流列表点 **构建安卓 APK**
3. 右侧 **Run workflow** → 分支选 `main`，构建类型选 `debug` → 点运行
4. 等 5–10 分钟，状态变绿后点进这次运行
5. 页面底部 **Artifacts** 区 → 下载 `jiluya-apk-debug`
6. 解压得到 `app-debug.apk`，传到手机安装
   （Android 会提示「未知来源应用」，允许即可）

> 数据独立：APK 版和网址版的数据互不相通，都是各自独立的本地存储。
> 换版本时用同步码搬一次即可。

---

## 第 7 步：以后改了代码怎么更新

**改完代码，在本项目目录跑一遍测试再推送（可选但推荐）：**

```bash
npm test                 # 数据层 58 + 界面 108 项
npm run test:browser     # 真实浏览器点击验证 43 项（需本机 Chrome）
```

> 注意：`test:browser` 会清空 `localhost:8080` 的本地数据，别在存了真实记录的浏览器里跑。

然后三行推送命令即可：

```bash
git add -A
git commit -m "改了某某功能"
git push
```

推送后 **1 分钟 GitHub Pages 自动更新**，手机上的 App 下次打开就是新版。

> ⚠️ **改了前端一定要顺手做一件事**：把 `index.html` 里资源地址的 `?v=1028d` 改成新值，
> 并把 `sw.js` 里 `var CACHE = 'jlduck-v5'` 的版本号 +1。
> 否则用户手机还在跑缓存的旧版，会以为「改了没生效」。
> 这一步踩过坑，别忘。

---

## 排错速查

| 现象 | 原因与处理 |
| --- | --- |
| `git push` 报鉴权失败 | 用 Personal Access Token（勾 `repo`）当密码，不要用登录密码 |
| `failed to push some refs` | 建仓库时不小心勾了 README，先 `git pull --rebase origin main` 再 push |
| Actions 里 Pages 工作流报红 | 点进去看日志；多半是 Settings → Pages 的 Source 没选 GitHub Actions |
| 手机打开网址是 404 | 仓库名是否和网址对得上；首次部署要等 1–2 分钟，再刷新试试 |
| 网址能开但按钮点着没反应 | 版本号没升导致缓存了旧 JS（见第 7 步），或清一下浏览器该站点数据 |
| 手机 Chrome 菜单里找不到「安装应用」 | 必须是 HTTPS 网址；局域网 `192.168.x.x` 这种 HTTP 地址不支持安装 |
| APK 安装被拦截 | Android 设置里允许「未知来源应用」安装（不同品牌位置不同） |

---

## 一句话总结

```bash
git config user.name "<用户名>" && git config user.email "<邮箱>"
git add -A && git commit -m "记录鸭 v3"
git remote add origin https://github.com/<用户名>/<仓库名>.git
git push -u origin main
```

之后 GitHub 上打开 **Settings → Pages → Source: GitHub Actions**，
手机 Chrome 打开 `https://<用户名>.github.io/<仓库名>/` → 菜单「安装应用」，完事。

---

## 附：能不能用 Gitee（码云）替代 GitHub？

**结论：做「代码存放」可以，做「网址托管 + 安装 App」不行。**

### 为什么不行：Gitee Pages 已经下线

Gitee 官方在自家 issue 区明确回复过：

> 「非常抱歉，由于不可抗原因，Pages 服务已经下线，暂无具体计划再次上线。」
> —— gitee.com/oschina/git-osc/issues/I9KMJV

另一条 issue（2025-06）官方答复同样是「该功能已下线」。所以现在网上那些教你
「Gitee 仓库 → 服务 → Gitee Pages → 启动」得到 `xxx.gitee.io` 网址的教程**都是过期的**，
照着做会发现入口根本点不了。

而 **GitHub Pages 是你在这个项目里唯一零配置、能白拿 HTTPS 网址的渠道**，
有了 HTTPS 网址才能「安装到主屏幕」——这一步没法用 Gitee 绕过。

### Gitee 还能用在哪：当代码仓库备份（可选）

Gitee 的 git 托管本身完全正常，国内访问也快。你可以把它当成**第二个远程仓库**，
一份代码推两处，互为备份：

```bash
git remote add gitee https://gitee.com/<码云用户名>/<仓库名>.git
git push gitee main          # 以后推两份：git push origin main && git push gitee main
```

推送时需要码云的私人令牌作密码：
码云 → 设置 → 安全设置 → 私人令牌 → 生成（勾选 `projects` 权限）。

> 注意：这条只是备份，**推到 Gitee 不会得到任何网址**，安装 App 还是得走 Pages 那条路。

### 如果 GitHub 打开慢怎么办

先说一个容易被忽略的点：**这个 App 一旦装好就是完全离线的。**
Service Worker 会把整个应用缓存到手机里，所以**只要第一次把网址打开成功就够了**，
之后哪怕 GitHub 再也连不上，App 照样能用。

所以「慢」通常不是致命问题。真遇到打不开，按顺序试：

1. 换网络：手机流量 和 WiFi 表现经常不一样，先换一个试试
2. 多刷新几次：间歇性干扰下有概率连上
3. 换个时间：晚高峰和白天差别很大
4. 查官方状态：<https://www.githubstatus.com> 看 Pages 是不是绿

### 完全绕开 GitHub 的办法（不想用 GitHub 时选这些）

| 方案 | 怎么用 | 门槛 |
| --- | --- | --- |
| **Netlify Drop**（最省事） | 注册个免费账号并登录后，打开 <https://app.netlify.com/drop>，把 `index.html`、`manifest.webmanifest`、`sw.js`、`assets/`、`icons/` 整个拖进去，立刻得到 HTTPS 网址 | 不用 git、不用命令行；更新就是重新拖一次文件夹 |
| **腾讯云 EdgeOne Pages** | 关联仓库自动构建，国内节点快；未备案域名只能走海外节点 | 需要腾讯云账号 |
| **Vercel / Cloudflare Pages** | 导入仓库自动部署 | 需要账号，国内速度一般 |

> ⚠️ **Netlify Drop 一定要先免费注册并登录再拖**。不登录拖上去的站点会被套一层
> 「临时密码」保护，还必须回到账号里认领（claim）才长期保留——这两种情况都会让手机打不开或装不了。
> 登录后再拖，得到的就是干净的公开 HTTPS 网址。文件夹别超过 50MB。

> 顺带一提：本机能顺畅访问 GitHub（实测 `https://github.com` 响应 200、约 3 秒），
> 正常情况下按上文第 1–5 步走完完全没问题，不必折腾替代品。

### APK 编译呢

Gitee Go 是 Gitee 的 CI 服务，免费额度每仓库约 200 分钟构建时长（另有每月额度），
理论上能跑 Gradle 编安卓包。但相比已经配好的 GitHub Actions（仓库里
`.github/workflows/build-apk.yml` 已经能一键点运行），Gitee Go 需要重配一份流水线、
且安卓构建吃资源容易超免费额度。**除非你完全不能用 GitHub，否则没必要迁移。**
