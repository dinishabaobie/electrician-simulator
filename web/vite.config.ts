import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sites } from './sites-vite-plugin';

export default defineConfig({
  // GitHub Pages 部署在 /electrician-simulator/ 子路径，其余环境一律根路径
  base: process.env.GITHUB_ACTIONS === 'true' ? '/electrician-simulator/' : '/',
  plugins: [react(), sites()],
});
