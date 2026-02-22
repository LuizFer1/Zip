const { spawnSync } = require('node:child_process');

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function rebuildForElectron() {
  const electronVersion = require('electron/package.json').version;
  run('npm', [
    'rebuild',
    'better-sqlite3',
    '--runtime=electron',
    `--target=${electronVersion}`,
    '--dist-url=https://electronjs.org/headers',
  ]);
}

function rebuildForNode() {
  run('npm', ['rebuild', 'better-sqlite3']);
}

const mode = (process.argv[2] ?? 'electron').toLowerCase();
if (mode === 'electron') {
  rebuildForElectron();
} else if (mode === 'node') {
  rebuildForNode();
} else {
  console.error(`Unknown mode "${mode}". Use "electron" or "node".`);
  process.exit(1);
}
