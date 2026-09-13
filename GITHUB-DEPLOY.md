# 发布到 GitHub Pages

本压缩包里只有一个项目文件夹。先解压，再把**该文件夹内的文件**上传到一个 GitHub 仓库的根目录。不要直接上传 zip；GitHub Pages 不会自动解压它。

1. 在 GitHub 创建一个公开仓库，例如 `breath-password-demo`，默认分支选 `main`。
2. 在仓库页面选择 **Add file → Upload files**，上传解压后项目文件夹中的文件和文件夹，包括 `.github`。也可以用 GitHub Desktop 提交整个目录。
3. 打开仓库 **Settings → Pages → Build and deployment**，将 Source 设为 **GitHub Actions**。
4. 等待 **Actions → Deploy website to GitHub Pages** 运行成功。网页地址会显示在 Pages 设置页，通常是 `https://你的用户名.github.io/breath-password-demo/`。

## 重要限制

- GitHub Pages 是静态托管。网页、麦克风采集、本地个人基线、密码模式和 CAREUP 参考数据演示可在 HTTPS 下运行；麦克风仍需访问者自己授权。
- `/api/analyze-state` 是服务端 AI 接口，GitHub Pages **不会运行它**。网页会回退到本地解释，健康状态仍由本地规则计算。不要把 Anthropic API Key 写进仓库或网页源码。
- 健康模式首页的「智能解读」介绍和测量结果页的来源徽标会如实显示本次是「AI 已参与」还是「本地解读」。研究模式只是查看与导出记录，不是 AI 开关。
- 用户昵称和健康记录存于**各自浏览器的本地存储**；换电脑或换浏览器不会自动同步。昵称不是登录凭证。
- 原始 CAREUP CSV 没有放进压缩包；前端仅含脱敏演示 JSON。

本地验证：安装 Node.js 后在项目目录运行 `npm ci`、`npm test`、`npm run build`。`dist/` 是已构建的静态文件，但推荐使用工作流自动构建和发布。
