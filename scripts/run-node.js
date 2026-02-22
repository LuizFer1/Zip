const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const profiles = {
  node1: {
    ZIP_P2P_HOST: '127.0.0.1',
    ZIP_P2P_PORT: '7070',
    ZIP_P2P_SEEDS: '',
    ZIP_P2P_NODE_ID: 'node-1',
    ZIP_DB_PATH: './zip-node1.db',
    userDataDir: path.join(os.tmpdir(), 'zip-node1'),
  },
  node2: {
    ZIP_P2P_HOST: '127.0.0.1',
    ZIP_P2P_PORT: '7071',
    ZIP_P2P_SEEDS: '127.0.0.1:7070',
    ZIP_P2P_NODE_ID: 'node-2',
    ZIP_DB_PATH: './zip-node2.db',
    userDataDir: path.join(os.tmpdir(), 'zip-node2'),
  },
};

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const profileName = (process.argv[2] ?? '').toLowerCase();
const profile = profiles[profileName];
if (!profile) {
  console.error('Usage: node scripts/run-node.js <node1|node2>');
  process.exit(1);
}

if (process.env.ZIP_SKIP_BUILD !== '1') {
  run('npm', ['run', 'build']);
}

if (process.env.ZIP_SKIP_REBUILD !== '1') {
  run('node', ['scripts/rebuild-native.js', 'electron']);
}

const env = {
  ...process.env,
  ...profile,
};

run('electron', ['.', `--user-data-dir=${profile.userDataDir}`], env);
