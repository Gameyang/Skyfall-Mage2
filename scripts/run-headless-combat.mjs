import { runHeadlessCombatSimulation } from '../src/game/headlessCombat.js';
import { HEADLESS_GAME_CONTENT } from '../src/game/content/headless.js';

const args = parseArgs(process.argv.slice(2));
const durationMs = readNumber(args.durationMs ?? args.duration, 120000);
const tickMs = readNumber(args.tickMs ?? args.tick, 100);
const width = readNumber(args.width, 960);
const height = readNumber(args.height, 540);
const sampleIntervalMs = readNumber(args.sampleIntervalMs ?? args.sample, 30000);
const playerHp = readNumber(args.playerHp, 10000);
const playerPolicy = args.playerPolicy || 'stationary';
const waveSeed = args.waveSeed || null;
const contactDamageMultiplier = readNumber(args.contactDamageMultiplier, 1, { allowZero: true });
const skillLoadoutOverride = parseSkillLoadoutOverride(args.skills || args.skill, HEADLESS_GAME_CONTENT.skills);
const content = skillLoadoutOverride.length > 0
  ? {
    ...HEADLESS_GAME_CONTENT,
    skillLoadoutOverride,
  }
  : HEADLESS_GAME_CONTENT;

const { state, metrics } = runHeadlessCombatSimulation({
  content,
  durationMs,
  tickMs,
  width,
  height,
  sampleIntervalMs,
  playerHp,
  playerPolicy,
  waveSeed,
  contactDamageMultiplier,
});

console.log(JSON.stringify({
  config: {
    durationMs,
    tickMs,
    width,
    height,
    sampleIntervalMs,
    playerHp,
    playerPolicy,
    waveSeed,
    contactDamageMultiplier,
    equippedSkillIds: state.session.equippedSkillIds,
  },
  summary: {
    spawnedEnemies: metrics.spawnedEnemies,
    backloggedSpawns: metrics.backloggedSpawns,
    killedEnemies: metrics.killedEnemies,
    despawnedEnemies: metrics.despawnedEnemies,
    skippedSpawns: metrics.skippedSpawns,
    playerHits: metrics.playerHits,
    playerDamage: metrics.playerDamage,
    peakActiveEnemies: metrics.peakActiveEnemies,
    peakProjectiles: metrics.peakProjectiles,
    finalScore: metrics.finalScore,
    playerDiedAtMs: metrics.playerDiedAtMs,
  },
  waveStarts: metrics.waveStarts,
  waveCompletions: metrics.waveCompletions,
  waves: metrics.waves,
  snapshots: metrics.snapshots,
}, null, 2));

function parseArgs(argv) {
  const parsed = {};
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue;
    const [key, value = 'true'] = arg.slice(2).split('=');
    parsed[key] = value;
  }
  return parsed;
}

function readNumber(value, fallback, { allowZero = false } = {}) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  if (allowZero && number >= 0) return number;
  return number > 0 ? number : fallback;
}

function parseSkillLoadoutOverride(value, skills) {
  const normalized = String(value || '').trim();
  if (!normalized || normalized.toLowerCase() === 'random') return Object.freeze([]);
  if (normalized.toLowerCase() === 'all') return Object.freeze(Object.keys(skills));

  const ids = [];
  const seen = new Set();
  for (const rawId of normalized.split(',')) {
    const skillId = rawId.trim();
    if (!skillId || seen.has(skillId) || !skills[skillId]) continue;

    seen.add(skillId);
    ids.push(skillId);
  }
  return Object.freeze(ids);
}
