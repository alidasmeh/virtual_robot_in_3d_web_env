import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    {
      name: 'list-models-api',
      configureServer(server) {
        server.middlewares.use('/api/models', (req, res) => {
          const modelsDir = path.resolve(__dirname, 'trained_models');
          
          if (!fs.existsSync(modelsDir)) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify([]));
            return;
          }
          
          try {
            const files = fs.readdirSync(modelsDir)
              .filter(f => f.endsWith('.json'));
            
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(files));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
        });
      },
    },
  ],
});
