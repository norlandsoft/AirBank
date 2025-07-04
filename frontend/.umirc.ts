import {defineConfig} from "umi";

export default defineConfig({
  dva: {},
  mfsu: false,
  title: '',
  links: [
    {id: 'theme', rel: 'stylesheet', type: 'text/css'},
    {rel: 'shortcut icon', href: '/favicon.svg'}
  ],
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
    "/api": {
      target: "http://localhost:7701",
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