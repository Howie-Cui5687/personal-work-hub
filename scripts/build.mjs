import { existsSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cliPath = path.join(projectRoot, 'node_modules', 'vinext', 'dist', 'cli.js');
const outputPath = path.join(projectRoot, 'dist', 'client', 'index.html');
const startedAt = Date.now();

const result = spawnSync(process.execPath, [cliPath, 'build', ...process.argv.slice(2)], {
  cwd: projectRoot,
  env: process.env,
  stdio: 'inherit',
});

if (result.status === 0) process.exit(0);

const outputIsFresh =
  existsSync(outputPath) && statSync(outputPath).mtimeMs >= startedAt - 1000;
const knownWindowsLibuvExit =
  process.platform === 'win32' &&
  (result.status === 3221226505 || result.status === -1073740791);

if (knownWindowsLibuvExit && outputIsFresh) {
  console.warn(
    '\nVinext completed the static export. Ignoring its known Windows/Node libuv shutdown assertion.\n',
  );
  process.exit(0);
}

process.exit(result.status ?? 1);
