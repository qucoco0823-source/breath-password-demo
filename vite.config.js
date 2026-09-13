import { defineConfig } from "vite";
import { healthApiPlugin } from "./api/dev-middleware.js";

function blockRawCareupData() {
  return {
    name: "block-raw-careup-data",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = new URL(req.url || "/", "http://localhost").pathname;
        if (/^\/datasets\/careup-ic(?:\/|$)/i.test(pathname)) {
          res.statusCode = 404;
          res.end("Not found");
          return;
        }
        next();
      });
    },
  };
}

// 没有用 @vitejs/plugin-react：那个插件的主要价值是热更新时保留组件状态，
// 而这个 Demo 每次改动都要重新走一遍注册流程，状态本来就得重置。
// 少一个依赖，现场装包更快、更不容易出问题。
//
// 代价：JSX 交给 esbuild 处理（下面的 esbuild 配置），没有 React Fast Refresh。
export default defineConfig({
  // 相对路径让同一份构建产物可放在 GitHub Pages 的 /仓库名/ 下。
  base: "./",
  // /api/analyze-state 在开发期由中间件处理，与生产环境共用同一个
  // handleAnalyze。API Key 只在 Node 侧的 process.env 里，不进浏览器包。
  //
  // ⚠ 绝不要用 define / import.meta.env 往前端传 Key：
  //   Vite 会把它内联进 dist/，等于公开发布。
  //   test/health-no-key-in-bundle.test.mjs 对构建产物做静态检查锁住这一点。
  plugins: [blockRawCareupData(), healthApiPlugin()],
  esbuild: {
    jsx: "automatic",   // 自动注入 React，App.jsx 里不需要 import React
  },
  server: {
    port: 5173,
    // 麦克风需要安全上下文。localhost 被浏览器视为安全来源，可以直接用；
    // 若要在手机上测，得配 HTTPS 或用端口转发，否则 getUserMedia 会被拒绝。
    strictPort: false,
  },
  build: {
    outDir: "dist",
    target: "es2020",
  },
});
