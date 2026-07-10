import { defineConfig, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import { sites } from './sites-vite-plugin';

export default defineConfig(async () => {
  const isGitHubPages = process.env.GITHUB_ACTIONS === 'true';
  // Cloudflare Pages 只托管静态产物，走纯静态构建（dist/index.html + 根路径 base）
  const isCloudflarePages = process.env.CF_PAGES === '1';
  const plugins: PluginOption[] = [react()];

  if (!isGitHubPages && !isCloudflarePages) {
    const { cloudflare } = await import('@cloudflare/vite-plugin');
    plugins.push(sites(), cloudflare({ viteEnvironment: { name: 'server' } }));
  }

  return {
    base: isGitHubPages ? '/electrician-simulator/' : '/',
    plugins,
  };
});
