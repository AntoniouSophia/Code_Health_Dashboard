import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const frontendDir = fileURLToPath(new URL('.', import.meta.url));
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, frontendDir, 'VITE_'), ...process.env };
  const port = Number(env.VITE_DEV_PORT);
  if (!env.VITE_DEV_HOST?.trim() || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Set VITE_DEV_HOST and a valid VITE_DEV_PORT in frontend/.env.');
  }
  return {
    envDir: frontendDir,
    plugins: [react()],
    server: { host: env.VITE_DEV_HOST, port, strictPort: true }
  };
});
