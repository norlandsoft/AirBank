import {defineConfig} from "umi";
import MonacoEditorWebpackPlugin from 'monaco-editor-webpack-plugin';
import path from 'path';

export default defineConfig({
  dva: {},
  mfsu: false,
  title: '',
  links: [
    {id: 'theme', rel: 'stylesheet', type: 'text/css'},
    {rel: 'shortcut icon', href: '/favicon.svg'}
  ],
  alias: {
    "aird": path.resolve(__dirname, "src/components/AirDesign"),
  },
  routes: [
    {
      path: "/",
      component: "@/layouts/SecurityLayout"
    },
    {
      path: "*",
      component: "@/layouts/Error404"
    }
  ],
  proxy: {
    // 平台API
    "/rest": {
      target: "http://localhost:8000",
      changeOrigin: true,
      pathRewrite: {"^": ""},
      'onProxyRes': function (proxyRes, req, res) {
        proxyRes.headers['Content-Encoding'] = 'chunked';
      }
    },
    // 引擎API
    "/api": {
      target: "http://localhost:10080",
      changeOrigin: true,
      pathRewrite: {"^": ""},
      'onProxyRes': function (proxyRes, req, res) {
        proxyRes.headers['Content-Encoding'] = 'chunked';
      }
    }
  },
  esbuildMinifyIIFE: true,
  base: "/",
  outputPath: "dist",
});