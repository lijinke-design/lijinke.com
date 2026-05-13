# lijinke.com 部署指南

把这个项目搬到自己的域名 `lijinke.com`，以及之后用 `lijinke.com/admin.html` 改内容。

总览：你需要做 5 步（每步都列了实操点击路径，给零基础同学）。

---

## ① 在 GitHub 上建 repo，把代码传上去

1. 浏览器打开 https://github.com/new
2. 填：
   - Owner：选你自己（`lijinke-design`）
   - Repository name：随便起，比如 `lijinke-site`
   - 选 **Public**（要给 Cloudflare Pages 免费抓取）
   - **不要**勾选 README / .gitignore / license
3. 点 **Create repository**
4. 回到你电脑，在项目文件夹打开终端执行（把 `lijinke-site` 换成你刚才起的名字）：

```bash
cd ~/api-worker/.claude/worktrees/funny-euler-cf6ff5
git init
git add index.html admin.html content.json assets SETUP.md
git commit -m "init: personal site"
git branch -M main
git remote add origin https://github.com/lijinke-design/lijinke-site.git
git push -u origin main
```

刷新 GitHub 那个 repo 页面，应该能看到 4 个文件 + assets 文件夹。

---

## ② 在 Cloudflare 上把代码连起来

> Cloudflare Pages 是免费静态托管，每次你 push 到 GitHub 它会自动重新发布。

1. 浏览器打开 https://dash.cloudflare.com → 注册 / 登录（用 Google 一键登录即可，免费）
2. 左侧菜单 → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**
3. 第一次需要 **Connect GitHub account**，授权 Cloudflare 读你刚才那个 repo
4. 选中 `lijinke-site` repo，点 **Begin setup**
5. Build settings 全部留空（这是纯静态站，不需要构建）：
   - Framework preset: `None`
   - Build command: 留空
   - Build output directory: `/`
6. 点 **Save and Deploy**

等 30~60 秒，会给你一个临时网址 `https://lijinke-site.pages.dev` —— 打开看看，应该就是你的网站。

---

## ③ 把 lijinke.com 域名绑上 Cloudflare Pages

> 你的域名在阿里云注册的，**Cloudflare 需要接管域名解析**才能绑域名。这一步是把阿里云的 DNS Server 改成 Cloudflare 的。

### 3.1 把 lijinke.com 添加到 Cloudflare 账户

1. Cloudflare 控制台 → 左侧 **Websites** → **Add a site**
2. 输入 `lijinke.com` → **Continue**
3. 选 **Free 计划** → **Continue**
4. Cloudflare 会扫描现有 DNS 记录（如果阿里云上已有解析就保留），点 **Continue**
5. Cloudflare 会给你 **2 个 Name Server**，类似：
   - `xxx.ns.cloudflare.com`
   - `yyy.ns.cloudflare.com`
   - **把这两个记下来。**

### 3.2 去阿里云改 DNS Server

1. 打开 https://dc.console.aliyun.com/next/index#/domain/list/all-domain
2. 找到 `lijinke.com` → 点 **管理**
3. 左侧 **DNS 修改** → **修改 DNS 服务器**
4. 把原来的两个（一般是 `dns19.hichina.com` 之类）替换成上面 Cloudflare 给的两个
5. 保存

**注意：DNS 切换需要 10 分钟 ~ 24 小时全网生效。** 一般 30 分钟就好。
回 Cloudflare 控制台点 **Check nameservers** 按钮，状态变 Active 就行了。

### 3.3 在 Pages 项目上绑域名

1. Cloudflare → Workers & Pages → 你的 `lijinke-site` 项目 → **Custom domains** → **Set up a custom domain**
2. 输入 `lijinke.com` → **Continue** → **Activate**
3. Cloudflare 会自动加 CNAME 记录，等 1~2 分钟生效
4. 同样方式再加一个 `www.lijinke.com`（可选）

**完成。** 现在打开 `https://lijinke.com` 就是你的网站，全程 HTTPS，免费 CDN 加速。

---

## ④ 配置后台登录用的 GitHub Token

> 后台用 GitHub API 把你的改动写回 repo，所以需要一个授权 Token。

1. 打开 https://github.com/settings/personal-access-tokens/new
2. 填：
   - Token name：`lijinke-cms`（随便起）
   - Expiration：90 days 或更长
   - Resource owner：你自己 (`lijinke-design`)
   - Repository access：**Only select repositories** → 勾选你的 `lijinke-site`
   - Repository permissions：
     - **Contents**：**Read and write** ⭐
     - 其他不用勾
3. 点 **Generate token**
4. 复制出来那个 `github_pat_xxx...` 字符串 —— **关掉页面就再也看不到了，存好。**

---

## ⑤ 第一次用后台

1. 打开 `https://lijinke.com/admin.html`
2. 填：
   - GitHub 用户名：`lijinke-design`
   - 仓库名：`lijinke-site`
   - 分支：`main`
   - Token：粘贴刚才那串
3. 点 **登录并加载内容**
4. 左侧菜单切到任何一个 tab，开始改内容
5. 改完点右上角 **保存并发布**
6. 30 秒后 `lijinke.com` 自动更新（Cloudflare Pages 每次 git push 自动重新部署）

---

## 常见问题

**Q：保存失败 `401 Unauthorized` 怎么办？**
A：Token 错了，或权限没给对。回 ④ 重新生成，确保勾了 Contents Read and write 和正确的 repo。

**Q：保存成功了但网站没变？**
A：浏览器缓存，按 `Cmd+Shift+R` 强制刷新。或者 Cloudflare Pages 还在部署，去 Cloudflare 控制台看 Deployment 状态。

**Q：admin.html 别人能不能打开？**
A：可以打开，但没有你的 Token 啥也改不了。如果担心，可以把它放到 `admin/index.html` 等隐蔽路径下，或者改名（同步更新本指南）。

**Q：人物图片想换怎么办？**
A：把新图放到 `assets/` 文件夹，git push，然后后台 → 基础信息 → 人物图片路径 改成新文件名。

**Q：万一改坏了？**
A：去 GitHub repo 看 commit 历史，每次保存都是一个 commit，点 revert 就能回滚。
