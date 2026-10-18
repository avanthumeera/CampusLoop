import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const clientDirectory = path.dirname(fileURLToPath(import.meta.url));
const serverDirectory = path.resolve(clientDirectory, '../server');

// In the Vite preview, serve the existing Express app in the same process.
// This keeps the backend separate in server/ while avoiding unreliable
// localhost connections between separate development processes.
const localApi = {
  name: 'campusloop-local-api',
  async configureServer(viteServer) {
    process.env.DOTENV_CONFIG_PATH ||= path.join(serverDirectory, '.env');
    const backendUrl = pathToFileURL(path.join(serverDirectory, 'src/index.js')).href;
    const { app } = await import(backendUrl);
    viteServer.middlewares.use(app);
  },
};

export default defineConfig({
  plugins: [react(), localApi],
});
