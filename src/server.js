import { createServer } from 'node:http';
import { createApp } from './app.js';
import { config } from './config.js';

const app = createApp();
const server = createServer(app.handle);

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`\n  El puerto ${config.port} ya está en uso.`);
    console.error('  Cerrá el otro proceso o iniciá con otro puerto:  set PORT=3001 && start.bat\n');
    process.exit(1);
  }
  console.error('Error del servidor:', error);
  process.exit(1);
});

server.listen(config.port, config.host, () => {
  const url = `http://${config.host === '0.0.0.0' ? '127.0.0.1' : config.host}:${config.port}`;
  console.log('');
  console.log('    Kiosco del Recreo');
  console.log('  ────────────────────────────────────────────');
  console.log(`  Servidor:   ${url}`);
  console.log(`  Base datos: ${config.dbPath}`);
  if (app.seedResult.seeded) {
    console.log('');
    console.log('  Datos iniciales creados.');
    console.log(`  Admin:   ${config.seedAdmin.email}  /  ${config.seedAdmin.password}`);
    console.log(`  Alumno:  ${config.seedDemoStudent.email}  /  ${config.seedDemoStudent.password}`);
  }
  console.log('  ────────────────────────────────────────────');
  console.log('  Presiona Ctrl+C para detener el servidor.');
  console.log('');

  if (process.platform === 'win32' && process.env.OPEN_BROWSER !== '0') {
    import('node:child_process')
      .then(({ exec }) => {
        exec(`cmd /c start "" "${url}"`);
      })
      .catch(() => {});
  }
});

let closing = false;
function shutdown(signal) {
  if (closing) return;
  closing = true;
  console.log(`\n  Cerrando servidor (${signal})...`);
  server.close(() => {
    app.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 3000).unref?.();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
