import { createReadStream, existsSync, statSync, cpSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// 共享字体目录（仓库根 assets/fonts，柜面/网银两前端共用一份）
const FONTS_SRC = resolve(__dirname, '../assets/fonts');

/** 开发期以中间件服务 /fonts/*，构建期把真实文件拷入 dist/fonts */
const sharedFonts = (): Plugin => ({
  name: 'ab-shared-fonts',
  configureServer(server) {
    server.middlewares.use('/fonts', (req, res, next) => {
      const rel = decodeURIComponent((req.url ?? '').replace(/^\//, ''));
      const file = resolve(FONTS_SRC, rel);
      if (!file.startsWith(FONTS_SRC + sep) || !existsSync(file) || !statSync(file).isFile()) {
        next();
        return;
      }
      res.setHeader('Content-Type', 'font/woff2');
      res.setHeader('Cache-Control', 'no-cache');
      createReadStream(file).pipe(res);
    });
  },
  closeBundle() {
    cpSync(FONTS_SRC, resolve(__dirname, 'dist/fonts'), { recursive: true, dereference: true });
  },
});

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), sharedFonts()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
});
