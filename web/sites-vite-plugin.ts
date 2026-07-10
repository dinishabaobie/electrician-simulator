import { existsSync } from 'node:fs';
import { cp, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';

export function sites(): Plugin {
  let root = process.cwd();

  return {
    name: 'sites',
    apply: 'build',
    configResolved(config) {
      root = config.root;
    },
    async closeBundle() {
      const hostingConfig = resolve(root, '.openai', 'hosting.json');
      if (!existsSync(hostingConfig)) return;
      const outputDirectory = resolve(root, 'dist', '.openai');
      await mkdir(outputDirectory, { recursive: true });
      await cp(hostingConfig, resolve(outputDirectory, 'hosting.json'));
    },
  };
}
