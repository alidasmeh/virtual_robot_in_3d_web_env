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

        server.middlewares.use('/api/save-model', (req, res) => {
          if (req.method !== 'POST') {
            res.statusCode = 405;
            res.end();
            return;
          }

          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const data = JSON.parse(body);
              const { fileName, state } = data;
              const modelsDir = path.resolve(__dirname, 'trained_models');
              
              if (!fs.existsSync(modelsDir)) {
                fs.mkdirSync(modelsDir);
              }

              const safeName = fileName.replace(/[^a-z0-9_.-]/gi, '_');
              fs.writeFileSync(path.join(modelsDir, safeName), JSON.stringify(state, null, 2));

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true }));
            } catch (err) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
          });
        });
      },
    },
  ],
});
