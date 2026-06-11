import { spawnSync } from 'node:child_process';

function runGit(args, options = {}) {
  const result = spawnSync('git', args, {
    env: { ...process.env, ...(options.env || {}) },
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    encoding: options.capture ? 'utf8' : undefined,
  });

  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(`git ${args.join(' ')} failed with exit code ${result.status}`);
  }

  return result;
}

function readGit(args, options = {}) {
  return runGit(args, { ...options, capture: true });
}

function parseMessage(argv) {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '-m' || arg === '--message' || arg === '-Message') {
      return argv[index + 1] || '';
    }
  }

  const loose = argv.filter((arg) => !arg.startsWith('-'));
  return loose.join(' ');
}

function defaultMessage() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `chore: finish work ${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

function pushCurrentBranch() {
  const remote = process.env.SKYFALL_AUTO_PUSH_REMOTE || 'origin';
  const branch = readGit(['branch', '--show-current']).stdout.trim();
  if (!branch) {
    throw new Error('Cannot push from detached HEAD.');
  }

  const remoteCheck = readGit(['remote', 'get-url', remote], { allowFailure: true });
  if (remoteCheck.status !== 0) {
    throw new Error(`Remote '${remote}' does not exist.`);
  }

  const upstream = readGit(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], {
    allowFailure: true,
  });
  if (upstream.status === 0 && upstream.stdout.trim()) {
    runGit(['push']);
  } else {
    runGit(['push', '-u', remote, branch]);
  }
}

const message = parseMessage(process.argv.slice(2)) || defaultMessage();

runGit(['add', '-A']);
const pendingChanges = readGit(['status', '--porcelain']).stdout.trim();

if (pendingChanges) {
  runGit(['commit', '-m', message], {
    env: {
      SKYFALL_SKIP_AUTO_PUSH: '1',
    },
  });
} else {
  console.log('No changes to commit. Pushing current branch.');
}

pushCurrentBranch();
