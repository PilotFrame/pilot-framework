import { createServer } from 'http';

import { appConfig } from './config.js';
import { createApp } from './app.js';

const app = createApp();
const server = createServer(app);

server.listen(appConfig.PORT, () => {
  console.log(`Control plane listening on port ${appConfig.PORT}`);
});

function shutdown(signal: string) {
  console.log(`Received ${signal}, shutting down gracefully...`);
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

