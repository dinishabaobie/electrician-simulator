import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 部署到 GitHub Pages 的项目页：https://dinishabaobie.github.io/electrician-simulator/
// 构建时用子路径，本地开发仍用根路径。
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/electrician-simulator/' : '/',
  plugins: [react()],
}));
