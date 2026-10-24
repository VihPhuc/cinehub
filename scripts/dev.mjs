import { spawn } from 'node:child_process';

const isWindows = process.platform === 'win32';
const npm = isWindows ? 'npm.cmd' : 'npm';
const spawnOptions = { stdio: 'inherit', shell: isWindows };
const children = [
  spawn(npm, ['--prefix', 'backend', 'run', 'start:dev'], spawnOptions),
  spawn(npm, ['--prefix', 'frontend', 'run', 'dev'], spawnOptions),
];

let stopping = false;

function killTree(child) {
  if (!child.pid || child.exitCode !== null) return;
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    return;
  }
  child.kill('SIGTERM');
}

function shutdown(code) {
  if (stopping) return;
  stopping = true;
  for (const child of children) killTree(child);
  process.exitCode = code;
  setTimeout(() => process.exit(code), 3000).unref();
}

for (const child of children) {
  child.on('error', (error) => {
    console.error(`[dev] failed to start: ${error.message}`);
    shutdown(1);
  });
  child.on('close', (code) => {
    if (!stopping) shutdown(code ?? 1);
  });
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
