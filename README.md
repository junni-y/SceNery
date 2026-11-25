# SceNery
# Storyboard Studio (分镜构思工作台)

Notion 结构化表格 + Miro 无限自由画布的结合体，专为动画、电影与短剧分镜创作设计。

## 本地启动
npm install
npm run dev

## 静态构建
npm run build
输出目录为 `dist/`，可部署到 Vercel、Netlify 或其他静态网站托管平台。

## 部署到 GitHub Pages

仓库已配置 GitHub Actions：将代码推送到 `main` 分支后，会自动构建并发布到 GitHub Pages。

首次部署前，在仓库 **Settings → Pages → Build and deployment → Source** 中选择 **GitHub Actions**。部署完成后，可在该页面或 Actions 工作流详情中打开网站。