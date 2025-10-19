import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const repoBase = '/dailycodepush/';
const globalProcess = (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process;
const isGitHubPages = globalProcess?.env?.GITHUB_PAGES === 'true';

export default defineConfig({
  base: isGitHubPages ? repoBase : '/',
  plugins: [react()],
  server: {
    port: 5173
  }
});
