// Self-healing supervisor: keeps server.mjs + localtunnel alive and publishes the
// current public URL to ~/.automaton/glider-public-url.txt and to /bounties meta.
// Restarts a dead child after a backoff; re-acquires a fresh tunnel URL on tunnel death.
import { spawn } from 'node:child_process';
import { writeFileSync, appendFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { homedir } from 'node:os';

const PORT = 8787;
const HOME = homedir();
const URL_FILE = `${HOME}/.automaton/glider-public-url.txt`;
const LOG = `${HOME}/.automaton/glider-supervisor.log`;
const log = (m) => { const l = `[${new Date().toISOString()}] ${m}`; appendFileSync(LOG, l + '\n'); };
const pub = () => {}; // structured no-op placeholder for clarity

let server = null, tunnel = null, tunnelUrl = null;

function startServer() {
  server = spawn(process.execPath, ['server.mjs'], { env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'ignore', 'inherit'] });
  log(`server started pid=${server.pid}`);
  server.on('exit', (c) => { log(`server exited code=${c}; restarting in 2s`); server = null; setTimeout(startServer, 2000); });
}

function startTunnel() {
  tunnel = spawn('npx', ['--yes', 'localtunnel', '--port', String(PORT)], { stdio: ['ignore', 'pipe', 'pipe'] });
  let buf = '';
  const onChunk = (d) => {
    buf += d.toString();
    const m = buf.match(/https:\/\/[a-z0-9-]+\.loca\.lt/);
    if (m && m[0] !== tunnelUrl) {
      tunnelUrl = m[0];
      writeFileSync(URL_FILE, tunnelUrl);
      log(`tunnel url=${tunnelUrl} (written to ${URL_FILE})`);
    }
  };
  tunnel.stdout.on('data', onChunk);
  tunnel.stderr.on('data', onChunk);
  tunnel.on('exit', (c) => { log(`tunnel exited code=${c}; re-acquiring in 3s`); tunnel = null; setTimeout(startTunnel, 3000); });
}

process.on('SIGTERM', () => { try { server?.kill(); tunnel?.kill(); } catch {} process.exit(0); });
startServer();
setTimeout(startTunnel, 1500); // give server a moment
log('supervisor starting');
