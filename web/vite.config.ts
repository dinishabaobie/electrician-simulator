import { defineConfig, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import { sites } from './sites-vite-plugin';

export default defineConfig(async () => {
  const isGitHubPages = process.env.GITHUB_ACTIONS === 'true';
  const plugins: PluginOption[] = [react()];

  if (!isGitHubPages) {
    const { cloudflare } = await import('@cloudflare/vite-plugin');
    plugins.push(sites(), cloudflare({ viteEnvironment: { name: 'server' } }));
  }

  return {
    base: isGitHubPages ? '/electrician-simulator/' : '/',
    plugins,
  };
});
