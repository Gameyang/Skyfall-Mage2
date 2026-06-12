const EMPTY: u32 = 0u;
const SOLID: u32 = 1u;
const SAND: u32 = 2u;
const WATER: u32 = 3u;
const FIRE: u32 = 4u;
const SMOKE: u32 = 5u;
const SPARK: u32 = 6u;
const STEAM: u32 = 7u;
const WET_SAND: u32 = 8u;
const ELECTRIC: u32 = 9u;
const ROCK: u32 = 10u;
const ICE: u32 = 11u;
const DUST: u32 = 12u;
const FIXED_ZONE: u32 = 13u;
const CHAIN_ARC: u32 = 14u;
const CHAIN_EXPLOSION: u32 = 15u;
const LASER_ARC: u32 = 16u;
const PINBALL_ROCK: u32 = 17u;
const LIGHTNING_ROCK: u32 = 18u;
const ICE_BURST: u32 = 19u;
const BLIZZARD: u32 = 20u;
const FIRE_DUST: u32 = 21u;
const CHARGED_DUST: u32 = 22u;
const AMPLIFY_ZONE: u32 = 23u;
const SLOW_ZONE: u32 = 24u;
const GRAVITY_ZONE: u32 = 25u;
const EMITTER_FLAG_EXPLOSION: u32 = 1u;
const EMITTER_PROFILE_DEFAULT: u32 = 0u;
const EMITTER_PROFILE_PURE: u32 = 1u;
const EMITTER_PROFILE_PROJECTILE_FIRE: u32 = 2u;
const EMITTER_PROFILE_SKILL_EXPLOSION_FIRE: u32 = 3u;
const AUX_ELECTRIC_RESIDUAL_SPARK: u32 = 250u;
const AUX_PROJECTILE_FIRE: u32 = 251u;
const AUX_SKILL_EXPLOSION_FIRE: u32 = 252u;
const PROJECTILE_FIRE_DECAY_PER_STEP: u32 = 3u;
const SKILL_EXPLOSION_FIRE_DECAY_PER_STEP: u32 = 5u;

struct SimParams {
  width: u32,
  height: u32,
  frame: u32,
  emitterCount: u32,
  canvasWidth: u32,
  canvasHeight: u32,
  maxEmitters: u32,
  timeMs: u32,
  gasWindX: u32,
  gasWindY: u32,
  gasNoiseStrength: u32,
  gasNoiseScale: u32,
  gasNoiseSpeed: u32,
  gasWindStrength: u32,
  pad6: u32,
  pad7: u32,
};

struct Emitter {
  material: u32,
  x: u32,
  y: u32,
  radius: u32,
  strength: u32,
  seed: u32,
  flags: u32,
  profileData: u32,
};

@group(0) @binding(0) var<storage, read> src: array<u32>;
@group(0) @binding(1) var<storage, read_write> dst: array<u32>;
@group(0) @binding(2) var<uniform> params: SimParams;
@group(0) @binding(3) var<storage, read> emitters: array<Emitter>;

fn pack(materialValue: u32, lifeValue: u32, auxValue: u32) -> u32 {
  return (materialValue & 255u) | ((lifeValue & 255u) << 8u) | ((auxValue & 255u) << 16u);
}

fn material(cell: u32) -> u32 {
  return cell & 255u;
}

fn life(cell: u32) -> u32 {
  return (cell >> 8u) & 255u;
}

fn aux(cell: u32) -> u32 {
  return (cell >> 16u) & 255u;
}

fn emitterProfile(emitter: Emitter) -> u32 {
  return emitter.profileData & 255u;
}

fn emitterLife(emitter: Emitter, fallback: u32) -> u32 {
  let configured = (emitter.profileData >> 8u) & 255u;
  if (configured > 0u) {
    return configured;
  }
  return fallback;
}

fn isProjectileFire(cell: u32) -> bool {
  return material(cell) == FIRE && aux(cell) == AUX_PROJECTILE_FIRE;
}

fn isSkillExplosionFire(cell: u32) -> bool {
  return material(cell) == FIRE && aux(cell) == AUX_SKILL_EXPLOSION_FIRE;
}

fn isElectricResidualSpark(cell: u32) -> bool {
  return material(cell) == SPARK && aux(cell) == AUX_ELECTRIC_RESIDUAL_SPARK;
}

fn isSecondaryMaterial(mat: u32) -> bool {
  return mat == CHAIN_ARC ||
    mat == CHAIN_EXPLOSION ||
    mat == LASER_ARC ||
    mat == PINBALL_ROCK ||
    mat == LIGHTNING_ROCK ||
    mat == ICE_BURST ||
    mat == BLIZZARD ||
    mat == FIRE_DUST ||
    mat == CHARGED_DUST ||
    mat == AMPLIFY_ZONE ||
    mat == SLOW_ZONE ||
    mat == GRAVITY_ZONE;
}

fn isElectricCarrier(mat: u32) -> bool {
  return mat == ELECTRIC ||
    mat == CHAIN_ARC ||
    mat == LASER_ARC ||
    mat == LIGHTNING_ROCK ||
    mat == CHARGED_DUST;
}

fn isSparkCarrier(mat: u32) -> bool {
  return mat == SPARK || mat == CHAIN_EXPLOSION;
}

fn isHotMaterial(mat: u32) -> bool {
  return mat == FIRE ||
    mat == SPARK ||
    mat == CHAIN_EXPLOSION ||
    mat == FIRE_DUST ||
    mat == ICE_BURST;
}

fn isHeavyFallingMaterial(mat: u32) -> bool {
  return mat == SAND ||
    mat == WET_SAND ||
    mat == ROCK ||
    mat == ICE ||
    mat == PINBALL_ROCK ||
    mat == LIGHTNING_ROCK ||
    mat == ICE_BURST;
}

fn isPassableSecondaryMaterial(mat: u32) -> bool {
  return isSecondaryMaterial(mat) && !isHeavyFallingMaterial(mat);
}

fn indexOf(x: u32, y: u32) -> u32 {
  return y * params.width + x;
}

fn getCell(x: i32, y: i32) -> u32 {
  if (x < 0 || x >= i32(params.width) || y >= i32(params.height)) {
    return pack(SOLID, 255u, 0u);
  }
  if (y < 0) {
    return pack(EMPTY, 0u, 0u);
  }
  return src[indexOf(u32(x), u32(y))];
}

fn hash(x: u32, y: u32, salt: u32) -> u32 {
  var h = x * 374761393u + y * 668265263u + salt * 2246822519u + 3266489917u;
  h = (h ^ (h >> 13u)) * 1274126177u;
  return h ^ (h >> 16u);
}

fn randBit(x: i32, y: i32, salt: u32) -> bool {
  return (hash(u32(max(x, 0)), u32(max(y, 0)), params.frame + salt) & 1u) == 0u;
}

fn randByte(x: i32, y: i32, salt: u32) -> u32 {
  return hash(u32(max(x, 0)), u32(max(y, 0)), params.frame + salt) & 255u;
}

fn randByteWithSeed(x: i32, y: i32, salt: u32, seed: u32) -> u32 {
  return hash(u32(max(x, 0)), u32(max(y, 0)), params.frame + salt + seed) & 255u;
}

fn signedParam(value: u32) -> i32 {
  return bitcast<i32>(value);
}

fn gasWindX() -> i32 {
  return clamp(signedParam(params.gasWindX), -1, 1);
}

fn gasWindY() -> i32 {
  return clamp(signedParam(params.gasWindY), -1, 1);
}

fn gasNoiseValue(x: i32, y: i32, salt: u32) -> u32 {
  let scale = max(params.gasNoiseScale, 1u);
  let speed = max(params.gasNoiseSpeed, 1u);
  let sampleX = u32(max(x, 0)) / scale;
  let sampleY = u32(max(y, 0)) / scale;
  return hash(sampleX, sampleY, salt + params.frame / speed);
}

fn gasNoiseX(x: i32, y: i32, salt: u32) -> i32 {
  let strength = min(params.gasNoiseStrength, 255u);
  if (strength == 0u || (gasNoiseValue(x, y, salt) & 255u) >= strength) {
    return 0;
  }

  let direction = (gasNoiseValue(x, y, salt + 1u) >> 8u) & 3u;
  if (direction == 0u) {
    return -1;
  }
  if (direction == 1u) {
    return 1;
  }
  return 0;
}

fn gasFlowX(x: i32, y: i32, salt: u32) -> i32 {
  var wind = gasWindX();
  let windStrength = min(params.gasWindStrength, 255u);
  if (wind != 0 && randByte(x, y, salt + 2u) >= windStrength) {
    wind = 0;
  }

  return clamp(wind + gasNoiseX(x, y, salt), -1, 1);
}

fn gasVerticalPause(x: i32, y: i32, salt: u32) -> bool {
  let windY = gasWindY();
  if (windY <= 0) {
    return false;
  }
  return randByte(x, y, salt) < u32(windY) * 64u;
}

fn materialDensity(mat: u32) -> u32 {
  if (mat == SOLID) {
    return 255u;
  }
  if (mat == LIGHTNING_ROCK) {
    return 112u;
  }
  if (mat == PINBALL_ROCK) {
    return 104u;
  }
  if (mat == ROCK) {
    return 94u;
  }
  if (mat == ICE_BURST) {
    return 86u;
  }
  if (mat == ICE) {
    return 82u;
  }
  if (mat == WET_SAND) {
    return 76u;
  }
  if (mat == SAND) {
    return 68u;
  }
  if (mat == WATER) {
    return 42u;
  }
  if (mat == SPARK) {
    return 24u;
  }
  if (isElectricCarrier(mat)) {
    return 16u;
  }
  if (mat == BLIZZARD || mat == FIRE_DUST || mat == CHARGED_DUST) {
    return 12u;
  }
  if (mat == DUST) {
    return 10u;
  }
  if (mat == FIXED_ZONE || mat == AMPLIFY_ZONE || mat == SLOW_ZONE || mat == GRAVITY_ZONE) {
    return 6u;
  }
  if (mat == FIRE || mat == SMOKE || mat == STEAM) {
    return 8u;
  }
  return 0u;
}

fn canPowderEnter(moverMat: u32, targetMat: u32) -> bool {
  if (targetMat == SOLID ||
    targetMat == SAND ||
    targetMat == WET_SAND ||
    targetMat == ROCK ||
    targetMat == ICE ||
    targetMat == PINBALL_ROCK ||
    targetMat == LIGHTNING_ROCK ||
    targetMat == ICE_BURST) {
    return false;
  }
  return materialDensity(moverMat) > materialDensity(targetMat);
}

fn canFluidEnter(mat: u32) -> bool {
  return mat != SOLID &&
    mat != ROCK &&
    mat != ICE &&
    mat != PINBALL_ROCK &&
    mat != LIGHTNING_ROCK &&
    mat != ICE_BURST &&
    materialDensity(WATER) > materialDensity(mat);
}

fn canSupportWater(mat: u32) -> bool {
  return mat == SOLID ||
    mat == SAND ||
    mat == WET_SAND ||
    mat == ROCK ||
    mat == ICE ||
    mat == PINBALL_ROCK ||
    mat == LIGHTNING_ROCK ||
    mat == ICE_BURST ||
    mat == WATER;
}

fn canSmokeEnter(mat: u32) -> bool {
  return mat == EMPTY || mat == FIRE || mat == ELECTRIC || mat == DUST || mat == FIXED_ZONE || isPassableSecondaryMaterial(mat);
}

fn canFireEnter(mat: u32) -> bool {
  return mat == EMPTY ||
    mat == SMOKE ||
    mat == STEAM ||
    mat == FIRE ||
    mat == ELECTRIC ||
    mat == DUST ||
    mat == FIXED_ZONE ||
    isPassableSecondaryMaterial(mat);
}

fn isFireNear(x: i32, y: i32) -> bool {
  return isHotMaterial(material(getCell(x - 1, y))) ||
    isHotMaterial(material(getCell(x + 1, y))) ||
    isHotMaterial(material(getCell(x, y - 1))) ||
    isHotMaterial(material(getCell(x, y + 1)));
}

fn isHeatNear(x: i32, y: i32) -> bool {
  return isHotMaterial(material(getCell(x - 1, y))) ||
    isHotMaterial(material(getCell(x + 1, y))) ||
    isHotMaterial(material(getCell(x, y - 1))) ||
    isHotMaterial(material(getCell(x, y + 1)));
}

fn isDirectElectricNear(x: i32, y: i32) -> bool {
  return isElectricCarrier(material(getCell(x - 1, y))) ||
    isElectricCarrier(material(getCell(x + 1, y))) ||
    isElectricCarrier(material(getCell(x, y - 1))) ||
    isElectricCarrier(material(getCell(x, y + 1)));
}

fn isSparkNear(x: i32, y: i32) -> bool {
  return isSparkCarrier(material(getCell(x - 1, y))) ||
    isSparkCarrier(material(getCell(x + 1, y))) ||
    isSparkCarrier(material(getCell(x, y - 1))) ||
    isSparkCarrier(material(getCell(x, y + 1)));
}

fn isElectricNear(x: i32, y: i32) -> bool {
  return isDirectElectricNear(x, y) || isSparkNear(x, y);
}

fn isSandNear(x: i32, y: i32) -> bool {
  return material(getCell(x - 1, y)) == SAND ||
    material(getCell(x + 1, y)) == SAND ||
    material(getCell(x, y - 1)) == SAND ||
    material(getCell(x, y + 1)) == SAND ||
    material(getCell(x - 1, y)) == WET_SAND ||
    material(getCell(x + 1, y)) == WET_SAND ||
    material(getCell(x, y - 1)) == WET_SAND ||
    material(getCell(x, y + 1)) == WET_SAND;
}

fn isWetNear(x: i32, y: i32) -> bool {
  return material(getCell(x - 1, y)) == WATER ||
    material(getCell(x + 1, y)) == WATER ||
    material(getCell(x, y - 1)) == WATER ||
    material(getCell(x, y + 1)) == WATER ||
    material(getCell(x - 1, y)) == WET_SAND ||
    material(getCell(x + 1, y)) == WET_SAND ||
    material(getCell(x, y - 1)) == WET_SAND ||
    material(getCell(x, y + 1)) == WET_SAND;
}

fn sandTarget(x: i32, y: i32, moverMat: u32) -> vec2<i32> {
  let below = material(getCell(x, y + 1));
  if (canPowderEnter(moverMat, below)) {
    return vec2<i32>(x, y + 1);
  }

  var first: i32 = -1;
  var second: i32 = 1;
  if (randBit(x, y, 11u)) {
    first = 1;
    second = -1;
  }

  let firstMat = material(getCell(x + first, y + 1));
  if (canPowderEnter(moverMat, firstMat)) {
    return vec2<i32>(x + first, y + 1);
  }

  let secondMat = material(getCell(x + second, y + 1));
  if (canPowderEnter(moverMat, secondMat)) {
    return vec2<i32>(x + second, y + 1);
  }

  return vec2<i32>(x, y);
}

fn settledSandAbsorbTarget(x: i32, y: i32) -> vec2<i32> {
  if (randByte(x, y, 14u) > 192u) {
    return vec2<i32>(x, y);
  }

  var first: i32 = -1;
  var second: i32 = 1;
  if (randBit(x, y, 15u)) {
    first = 1;
    second = -1;
  }

  if (material(getCell(x + first, y)) == WATER) {
    return vec2<i32>(x + first, y);
  }
  if (material(getCell(x + second, y)) == WATER) {
    return vec2<i32>(x + second, y);
  }
  if (material(getCell(x, y - 1)) == WATER) {
    return vec2<i32>(x, y - 1);
  }
  if (material(getCell(x, y + 1)) == WATER) {
    return vec2<i32>(x, y + 1);
  }

  return vec2<i32>(x, y);
}

fn settledSandAbsorbsCell(sandX: i32, sandY: i32, waterX: i32, waterY: i32) -> bool {
  let moveTo = sandTarget(sandX, sandY, SAND);
  if (moveTo.x != sandX || moveTo.y != sandY) {
    return false;
  }

  let absorbFrom = settledSandAbsorbTarget(sandX, sandY);
  return absorbFrom.x == waterX && absorbFrom.y == waterY;
}

fn waterIsAbsorbedBySettledSand(x: i32, y: i32) -> bool {
  let sandBelow = getCell(x, y + 1);
  if (material(sandBelow) == SAND && settledSandAbsorbsCell(x, y + 1, x, y)) {
    return true;
  }

  let sandLeft = getCell(x - 1, y);
  if (material(sandLeft) == SAND && settledSandAbsorbsCell(x - 1, y, x, y)) {
    return true;
  }

  let sandRight = getCell(x + 1, y);
  if (material(sandRight) == SAND && settledSandAbsorbsCell(x + 1, y, x, y)) {
    return true;
  }

  let sandAbove = getCell(x, y - 1);
  if (material(sandAbove) == SAND && settledSandAbsorbsCell(x, y - 1, x, y)) {
    return true;
  }

  return false;
}

fn wetSandContactScore(x: i32, y: i32) -> u32 {
  var score = 0u;

  if (material(getCell(x - 1, y)) == WET_SAND) {
    score += 2u;
  }
  if (material(getCell(x + 1, y)) == WET_SAND) {
    score += 2u;
  }
  if (material(getCell(x, y - 1)) == WET_SAND) {
    score += 1u;
  }
  if (material(getCell(x, y + 1)) == WET_SAND) {
    score += 3u;
  }
  if (material(getCell(x - 1, y + 1)) == WET_SAND) {
    score += 1u;
  }
  if (material(getCell(x + 1, y + 1)) == WET_SAND) {
    score += 1u;
  }

  return score;
}

fn shouldSpreadWetSand(x: i32, y: i32) -> bool {
  let score = wetSandContactScore(x, y);
  if (score == 0u) {
    return false;
  }

  let phase = hash(u32(max(x, 0)), u32(max(y, 0)), 20u) & 3u;
  if ((params.frame & 3u) != phase) {
    return false;
  }

  return randByte(x, y, 19u) < min(18u, score * 3u);
}

fn waterPressure(x: i32, y: i32) -> u32 {
  var pressure = 0u;

  if (material(getCell(x, y - 1)) == WATER) {
    pressure += 1u;
  }
  if (material(getCell(x, y - 2)) == WATER) {
    pressure += 1u;
  }
  if (material(getCell(x - 1, y - 1)) == WATER) {
    pressure += 1u;
  }
  if (material(getCell(x + 1, y - 1)) == WATER) {
    pressure += 1u;
  }

  return pressure;
}

fn waterTarget(x: i32, y: i32) -> vec2<i32> {
  let below = material(getCell(x, y + 1));
  if (canFluidEnter(below)) {
    return vec2<i32>(x, y + 1);
  }

  var first: i32 = -1;
  var second: i32 = 1;
  if (randBit(x, y, 21u)) {
    first = 1;
    second = -1;
  }

  let firstDownMat = material(getCell(x + first, y + 1));
  if (canFluidEnter(firstDownMat)) {
    return vec2<i32>(x + first, y + 1);
  }

  let secondDownMat = material(getCell(x + second, y + 1));
  if (canFluidEnter(secondDownMat)) {
    return vec2<i32>(x + second, y + 1);
  }

  let supported = canSupportWater(below);
  let flowRoll = randByte(x, y, 22u);
  let pressure = waterPressure(x, y);

  if (supported && pressure > 0u && flowRoll < 252u) {
    return vec2<i32>(x, y);
  }
  if (supported && pressure == 0u && flowRoll < 48u) {
    return vec2<i32>(x, y);
  }

  let firstMat = material(getCell(x + first, y));
  if (canFluidEnter(firstMat)) {
    let firstBelow = material(getCell(x + first, y + 1));
    if (!supported || canSupportWater(firstBelow)) {
      return vec2<i32>(x + first, y);
    }
  }

  let secondMat = material(getCell(x + second, y));
  if (canFluidEnter(secondMat)) {
    let secondBelow = material(getCell(x + second, y + 1));
    if (!supported || canSupportWater(secondBelow)) {
      return vec2<i32>(x + second, y);
    }
  }

  return vec2<i32>(x, y);
}

fn smokeTarget(x: i32, y: i32) -> vec2<i32> {
  if (gasVerticalPause(x, y, 29u)) {
    return vec2<i32>(x, y);
  }

  let flowX = gasFlowX(x, y, 30u);
  if (flowX != 0) {
    let flowMat = material(getCell(x + flowX, y - 1));
    if (canSmokeEnter(flowMat)) {
      return vec2<i32>(x + flowX, y - 1);
    }
  }

  let up = material(getCell(x, y - 1));
  if (canSmokeEnter(up)) {
    return vec2<i32>(x, y - 1);
  }

  var first: i32 = -1;
  var second: i32 = 1;
  if (flowX < 0) {
    first = -1;
    second = 1;
  } else if (flowX > 0) {
    first = 1;
    second = -1;
  } else if (randBit(x, y, 31u)) {
    first = 1;
    second = -1;
  }

  let firstMat = material(getCell(x + first, y - 1));
  if (canSmokeEnter(firstMat)) {
    return vec2<i32>(x + first, y - 1);
  }

  let secondMat = material(getCell(x + second, y - 1));
  if (canSmokeEnter(secondMat)) {
    return vec2<i32>(x + second, y - 1);
  }

  return vec2<i32>(x, y);
}

fn fireTarget(x: i32, y: i32) -> vec2<i32> {
  var stayThreshold = 64u;
  let verticalWind = gasWindY();
  if (verticalWind < 0) {
    stayThreshold = 28u;
  } else if (verticalWind > 0) {
    stayThreshold = 112u;
  }

  if (randByte(x, y, 32u) < stayThreshold) {
    return vec2<i32>(x, y);
  }

  let flowX = gasFlowX(x, y, 33u);
  if (flowX != 0) {
    let flowMat = material(getCell(x + flowX, y - 1));
    if (canFireEnter(flowMat)) {
      return vec2<i32>(x + flowX, y - 1);
    }
  }

  let up = material(getCell(x, y - 1));
  if (canFireEnter(up)) {
    return vec2<i32>(x, y - 1);
  }

  var first: i32 = -1;
  var second: i32 = 1;
  if (flowX < 0) {
    first = -1;
    second = 1;
  } else if (flowX > 0) {
    first = 1;
    second = -1;
  } else if (randBit(x, y, 34u)) {
    first = 1;
    second = -1;
  }

  let firstMat = material(getCell(x + first, y - 1));
  if (canFireEnter(firstMat)) {
    return vec2<i32>(x + first, y - 1);
  }

  let secondMat = material(getCell(x + second, y - 1));
  if (canFireEnter(secondMat)) {
    return vec2<i32>(x + second, y - 1);
  }

  return vec2<i32>(x, y);
}

fn decayProjectileFireAge(age: u32) -> u32 {
  if (age <= PROJECTILE_FIRE_DECAY_PER_STEP) {
    return 0u;
  }
  return age - PROJECTILE_FIRE_DECAY_PER_STEP;
}

fn decaySkillExplosionFireAge(age: u32) -> u32 {
  if (age <= SKILL_EXPLOSION_FIRE_DECAY_PER_STEP) {
    return 0u;
  }
  return age - SKILL_EXPLOSION_FIRE_DECAY_PER_STEP;
}

fn projectileFireTarget(x: i32, y: i32) -> vec2<i32> {
  if (gasVerticalPause(x, y, 35u)) {
    return vec2<i32>(x, y);
  }

  let flowX = gasFlowX(x, y, 36u);
  if (flowX != 0) {
    let flowMat = material(getCell(x + flowX, y - 1));
    if (canFireEnter(flowMat)) {
      return vec2<i32>(x + flowX, y - 1);
    }
  }

  if (randByte(x, y, 37u) < 96u) {
    return vec2<i32>(x, y);
  }

  let up = material(getCell(x, y - 1));
  if (canFireEnter(up)) {
    return vec2<i32>(x, y - 1);
  }

  var first: i32 = -1;
  var second: i32 = 1;
  if (flowX < 0) {
    first = -1;
    second = 1;
  } else if (flowX > 0) {
    first = 1;
    second = -1;
  } else if (randBit(x, y, 38u)) {
    first = 1;
    second = -1;
  }

  let firstMat = material(getCell(x + first, y - 1));
  if (canFireEnter(firstMat)) {
    return vec2<i32>(x + first, y - 1);
  }

  let secondMat = material(getCell(x + second, y - 1));
  if (canFireEnter(secondMat)) {
    return vec2<i32>(x + second, y - 1);
  }

  return vec2<i32>(x, y);
}

fn sparkTarget(x: i32, y: i32) -> vec2<i32> {
  return sandTarget(x, y, SPARK);
}

fn electricTarget(x: i32, y: i32) -> vec2<i32> {
  if (randByte(x, y, 59u) < 92u) {
    return vec2<i32>(x, y);
  }

  let flowX = gasFlowX(x, y, 60u);
  if (flowX != 0) {
    let flowMat = material(getCell(x + flowX, y));
    if (flowMat == EMPTY || flowMat == FIRE || flowMat == STEAM || flowMat == SMOKE || flowMat == DUST) {
      return vec2<i32>(x + flowX, y);
    }
  }

  if (randBit(x, y, 61u) && material(getCell(x, y - 1)) == EMPTY) {
    return vec2<i32>(x, y - 1);
  }
  if (material(getCell(x, y + 1)) == EMPTY) {
    return vec2<i32>(x, y + 1);
  }
  return vec2<i32>(x, y);
}

fn dustTarget(x: i32, y: i32) -> vec2<i32> {
  if (randByte(x, y, 64u) < 100u) {
    return vec2<i32>(x, y);
  }

  let flowX = gasFlowX(x, y, 65u);
  if (flowX != 0 && material(getCell(x + flowX, y + 1)) == EMPTY) {
    return vec2<i32>(x + flowX, y + 1);
  }
  if (material(getCell(x, y + 1)) == EMPTY) {
    return vec2<i32>(x, y + 1);
  }
  if (flowX != 0 && material(getCell(x + flowX, y)) == EMPTY) {
    return vec2<i32>(x + flowX, y);
  }
  return vec2<i32>(x, y);
}

fn chainArcTarget(x: i32, y: i32) -> vec2<i32> {
  var first: i32 = -1;
  var second: i32 = 1;
  if (randBit(x, y, 66u)) {
    first = 1;
    second = -1;
  }

  if (material(getCell(x + first, y)) == EMPTY) {
    return vec2<i32>(x + first, y);
  }
  if (material(getCell(x + second, y)) == EMPTY) {
    return vec2<i32>(x + second, y);
  }
  if (randBit(x, y, 67u) && material(getCell(x, y - 1)) == EMPTY) {
    return vec2<i32>(x, y - 1);
  }
  if (material(getCell(x, y + 1)) == EMPTY) {
    return vec2<i32>(x, y + 1);
  }
  return vec2<i32>(x, y);
}

fn laserArcTarget(x: i32, y: i32) -> vec2<i32> {
  var direction: i32 = -1;
  if (randBit(x, y, 68u)) {
    direction = 1;
  }
  if (material(getCell(x + direction, y - 1)) == EMPTY) {
    return vec2<i32>(x + direction, y - 1);
  }
  if (material(getCell(x + direction, y)) == EMPTY) {
    return vec2<i32>(x + direction, y);
  }
  return vec2<i32>(x, y);
}

fn pinballRockTarget(x: i32, y: i32) -> vec2<i32> {
  var direction: i32 = -1;
  if (randBit(x, y, 69u)) {
    direction = 1;
  }
  if (randByte(x, y, 70u) < 92u && material(getCell(x + direction, y - 1)) == EMPTY) {
    return vec2<i32>(x + direction, y - 1);
  }
  return sandTarget(x, y, PINBALL_ROCK);
}

fn lightningRockTarget(x: i32, y: i32) -> vec2<i32> {
  if (material(getCell(x, y + 1)) == EMPTY || material(getCell(x, y + 1)) == ELECTRIC || material(getCell(x, y + 1)) == SPARK) {
    return vec2<i32>(x, y + 1);
  }
  return sandTarget(x, y, LIGHTNING_ROCK);
}

fn iceBurstTarget(x: i32, y: i32) -> vec2<i32> {
  var direction: i32 = -1;
  if (randBit(x, y, 71u)) {
    direction = 1;
  }
  if (material(getCell(x + direction, y - 1)) == EMPTY) {
    return vec2<i32>(x + direction, y - 1);
  }
  return sandTarget(x, y, ICE_BURST);
}

fn secondaryTarget(sourceMat: u32, x: i32, y: i32) -> vec2<i32> {
  if (sourceMat == CHAIN_ARC) {
    return chainArcTarget(x, y);
  }
  if (sourceMat == LASER_ARC) {
    return laserArcTarget(x, y);
  }
  if (sourceMat == PINBALL_ROCK) {
    return pinballRockTarget(x, y);
  }
  if (sourceMat == LIGHTNING_ROCK) {
    return lightningRockTarget(x, y);
  }
  if (sourceMat == ICE_BURST) {
    return iceBurstTarget(x, y);
  }
  if (sourceMat == BLIZZARD || sourceMat == FIRE_DUST || sourceMat == CHARGED_DUST) {
    return dustTarget(x, y);
  }
  return vec2<i32>(x, y);
}

fn targetMatches(moveTo: vec2<i32>, x: i32, y: i32) -> bool {
  return moveTo.x == x && moveTo.y == y;
}

fn powderIncomingCell(sourceCell: u32, targetMat: u32, x: i32, y: i32, salt: u32) -> u32 {
  let sourceMat = material(sourceCell);
  if (sourceMat == SAND && targetMat == WATER) {
    return pack(WET_SAND, 0u, randByte(x, y, salt));
  }
  return pack(sourceMat, 0u, aux(sourceCell));
}

fn applyCurrentOutgoing(cell: u32, x: i32, y: i32) -> u32 {
  let mat = material(cell);

  if (isSecondaryMaterial(mat)) {
    let age = life(cell);
    if (age <= 1u) {
      if (mat == PINBALL_ROCK || mat == LIGHTNING_ROCK) {
        return pack(ROCK, 0u, aux(cell));
      }
      if (mat == ICE_BURST) {
        return pack(ICE, 0u, aux(cell));
      }
      return pack(EMPTY, 0u, 0u);
    }

    var moveTo = vec2<i32>(x, y);
    if (mat == CHAIN_ARC) {
      moveTo = chainArcTarget(x, y);
    } else if (mat == LASER_ARC) {
      moveTo = laserArcTarget(x, y);
    } else if (mat == PINBALL_ROCK) {
      moveTo = pinballRockTarget(x, y);
    } else if (mat == LIGHTNING_ROCK) {
      moveTo = lightningRockTarget(x, y);
    } else if (mat == ICE_BURST) {
      moveTo = iceBurstTarget(x, y);
    } else if (mat == BLIZZARD || mat == FIRE_DUST || mat == CHARGED_DUST) {
      moveTo = dustTarget(x, y);
    }

    if (!targetMatches(moveTo, x, y)) {
      if (mat == LIGHTNING_ROCK && randByte(x, y, 73u) < 124u) {
        return pack(CHAIN_ARC, 8u + (randByte(x, y, 74u) & 7u), randByte(x, y, 75u));
      }
      if (mat == CHAIN_ARC || mat == LASER_ARC || mat == CHARGED_DUST) {
        return pack(SPARK, 4u + (randByte(x, y, 76u) & 7u), randByte(x, y, 77u));
      }
      return pack(EMPTY, 0u, 0u);
    }

    return pack(mat, age - 1u, aux(cell));
  }

  if (mat == SAND || mat == WET_SAND || mat == ROCK || mat == ICE) {
    if (mat == SAND && isSparkNear(x, y) && randByte(x, y, 11u) < 156u) {
      return pack(CHAIN_EXPLOSION, 12u + (randByte(x, y, 12u) & 15u), randByte(x, y, 13u));
    }
    if (mat == ROCK && isWetNear(x, y) && randByte(x, y, 10u) < 108u) {
      return pack(PINBALL_ROCK, 42u + (randByte(x, y, 11u) & 31u), randByte(x, y, 12u));
    }
    if (mat == ROCK && isDirectElectricNear(x, y) && randByte(x, y, 12u) < 148u) {
      return pack(LIGHTNING_ROCK, 28u + (randByte(x, y, 13u) & 31u), randByte(x, y, 14u));
    }
    if (mat == ICE && isHeatNear(x, y) && randByte(x, y, 20u) < 148u) {
      return pack(ICE_BURST, 18u + (randByte(x, y, 21u) & 15u), randByte(x, y, 22u));
    }
    if (mat == ICE && isSandNear(x, y) && randByte(x, y, 22u) < 112u) {
      return pack(BLIZZARD, 34u + (randByte(x, y, 23u) & 31u), randByte(x, y, 24u));
    }
    if (mat == SAND && isDirectElectricNear(x, y) && randByte(x, y, 12u) < 126u) {
      return pack(FIXED_ZONE, 36u + (randByte(x, y, 13u) & 31u), randByte(x, y, 14u));
    }
    if (mat == SAND && isFireNear(x, y) && randByte(x, y, 15u) < 112u) {
      return pack(ROCK, 0u, randByte(x, y, 16u));
    }
    if (mat == SAND && isWetNear(x, y) && randByte(x, y, 17u) < 58u) {
      return pack(DUST, 34u + (randByte(x, y, 18u) & 31u), randByte(x, y, 19u));
    }
    if (mat == WET_SAND && isHeatNear(x, y) && randByte(x, y, 17u) < 34u) {
      return pack(SAND, 0u, randByte(x, y, 18u));
    }

    let moveTo = sandTarget(x, y, mat);
    if (!targetMatches(moveTo, x, y)) {
      let moveToMat = material(getCell(moveTo.x, moveTo.y));
      if (mat == WET_SAND && moveToMat == WATER) {
        return pack(WATER, 0u, aux(cell));
      }
      return pack(EMPTY, 0u, 0u);
    }
    if (mat == SAND) {
      let absorbFrom = settledSandAbsorbTarget(x, y);
      if (!targetMatches(absorbFrom, x, y)) {
        return pack(WET_SAND, 0u, randByte(x, y, 16u));
      }
      if (shouldSpreadWetSand(x, y)) {
        return pack(WET_SAND, 0u, randByte(x, y, 20u));
      }
    }
    return cell;
  }

  if (mat == WATER) {
    if (isSparkNear(x, y) && randByte(x, y, 29u) < 162u) {
      return pack(LASER_ARC, 12u + (randByte(x, y, 30u) & 15u), randByte(x, y, 31u));
    }
    if (isDirectElectricNear(x, y) && randByte(x, y, 30u) < 154u) {
      return pack(ICE, 0u, randByte(x, y, 31u));
    }
    if (isSandNear(x, y) && randByte(x, y, 32u) < 76u) {
      return pack(DUST, 32u + (randByte(x, y, 33u) & 31u), randByte(x, y, 34u));
    }
    if (waterIsAbsorbedBySettledSand(x, y)) {
      return pack(EMPTY, 0u, 0u);
    }

    if (isHeatNear(x, y) && randByte(x, y, 35u) < 168u) {
      return pack(STEAM, 50u + (randByte(x, y, 36u) & 31u), randByte(x, y, 37u));
    }

    let moveTo = waterTarget(x, y);
    if (!targetMatches(moveTo, x, y)) {
      return pack(EMPTY, 0u, 0u);
    }
    return cell;
  }

  if (mat == SMOKE || mat == STEAM || mat == DUST || mat == FIXED_ZONE) {
    let age = life(cell);
    if (age <= 1u) {
      if (mat == STEAM && randByte(x, y, 38u) < 96u) {
        return pack(WATER, 0u, randByte(x, y, 39u));
      }
      return pack(EMPTY, 0u, 0u);
    }

    if (mat == FIXED_ZONE) {
      if (isFireNear(x, y) && randByte(x, y, 38u) < 132u) {
        return pack(AMPLIFY_ZONE, 34u + (randByte(x, y, 39u) & 31u), randByte(x, y, 40u));
      }
      if (isWetNear(x, y) && randByte(x, y, 41u) < 124u) {
        return pack(SLOW_ZONE, 40u + (randByte(x, y, 42u) & 31u), randByte(x, y, 43u));
      }
      if (isSandNear(x, y) && randByte(x, y, 44u) < 116u) {
        return pack(GRAVITY_ZONE, 40u + (randByte(x, y, 45u) & 31u), randByte(x, y, 46u));
      }
      return pack(FIXED_ZONE, age - 1u, aux(cell));
    }

    if (mat == DUST) {
      if (isFireNear(x, y) && randByte(x, y, 38u) < 140u) {
        return pack(FIRE_DUST, 26u + (randByte(x, y, 39u) & 23u), randByte(x, y, 40u));
      }
      if (isDirectElectricNear(x, y) && randByte(x, y, 41u) < 148u) {
        return pack(CHARGED_DUST, 30u + (randByte(x, y, 42u) & 31u), randByte(x, y, 43u));
      }
      let moveTo = dustTarget(x, y);
      if (!targetMatches(moveTo, x, y)) {
        return pack(EMPTY, 0u, 0u);
      }
      return pack(DUST, age - 1u, aux(cell));
    }

    if (mat == STEAM && isDirectElectricNear(x, y) && randByte(x, y, 38u) < 172u) {
      return pack(CHAIN_ARC, 18u + (randByte(x, y, 39u) & 15u), randByte(x, y, 40u));
    }

    let moveTo = smokeTarget(x, y);
    if (!targetMatches(moveTo, x, y)) {
      return pack(EMPTY, 0u, 0u);
    }
    if (mat == STEAM) {
      let nextAge = age - 1u;
      if (nextAge < 10u && randByte(x, y, 40u) < 28u) {
        return pack(WATER, 0u, randByte(x, y, 41u));
      }
      return pack(STEAM, nextAge, aux(cell));
    }
    return pack(SMOKE, age - 1u, aux(cell));
  }

  if (mat == FIRE) {
    if (isSkillExplosionFire(cell)) {
      if (isWetNear(x, y)) {
        return pack(STEAM, 12u + (randByte(x, y, 39u) & 15u), randByte(x, y, 40u));
      }

      let nextAge = decaySkillExplosionFireAge(life(cell));
      if (nextAge == 0u) {
        return pack(EMPTY, 0u, 0u);
      }

      let moveTo = fireTarget(x, y);
      if (!targetMatches(moveTo, x, y)) {
        return pack(EMPTY, 0u, 0u);
      }

      return pack(FIRE, nextAge, AUX_SKILL_EXPLOSION_FIRE);
    }

    if (isProjectileFire(cell)) {
      let nextAge = decayProjectileFireAge(life(cell));
      if (nextAge == 0u) {
        return pack(EMPTY, 0u, 0u);
      }
      let moveTo = projectileFireTarget(x, y);
      if (!targetMatches(moveTo, x, y)) {
        return pack(EMPTY, 0u, 0u);
      }
      return pack(FIRE, nextAge, AUX_PROJECTILE_FIRE);
    }

    if (isDirectElectricNear(x, y) && randByte(x, y, 40u) < 176u) {
      return pack(SPARK, 18u + (randByte(x, y, 41u) & 23u), randByte(x, y, 42u));
    }
    if (isSandNear(x, y) && randByte(x, y, 43u) < 116u) {
      return pack(ROCK, 0u, randByte(x, y, 44u));
    }
    if (isWetNear(x, y)) {
      return pack(STEAM, 52u + (randByte(x, y, 41u) & 31u), randByte(x, y, 45u));
    }
    let age = life(cell);
    if (age <= 1u) {
      return pack(SMOKE, 36u + (randByte(x, y, 42u) & 31u), 0u);
    }
    let moveTo = fireTarget(x, y);
    if (!targetMatches(moveTo, x, y)) {
      if (randByte(x, y, 43u) < 76u) {
        return pack(SMOKE, 20u + (randByte(x, y, 44u) & 31u), randByte(x, y, 45u));
      }
      return pack(EMPTY, 0u, 0u);
    }
    if (randByte(x, y, 46u) < 24u && canSmokeEnter(material(getCell(x, y - 1)))) {
      return pack(SMOKE, 22u + (randByte(x, y, 47u) & 31u), randByte(x, y, 48u));
    }
    return pack(FIRE, age - 1u, randByte(x, y, 49u));
  }

  if (mat == SPARK || mat == ELECTRIC) {
    let age = life(cell);
    if (mat == SPARK && isSandNear(x, y) && randByte(x, y, 48u) < 172u) {
      return pack(CHAIN_EXPLOSION, 12u + (randByte(x, y, 49u) & 15u), randByte(x, y, 50u));
    }
    if (mat == SPARK && isWetNear(x, y) && randByte(x, y, 50u) < 172u) {
      return pack(LASER_ARC, 12u + (randByte(x, y, 51u) & 15u), randByte(x, y, 52u));
    }
    if (mat == ELECTRIC && isSandNear(x, y) && randByte(x, y, 49u) < 148u) {
      return pack(FIXED_ZONE, 36u + (randByte(x, y, 50u) & 31u), randByte(x, y, 51u));
    }
    if (isWetNear(x, y)) {
      if (mat == ELECTRIC && randByte(x, y, 52u) < 172u) {
        return pack(ICE, 0u, randByte(x, y, 53u));
      }
      if (randByte(x, y, 50u) < 172u) {
        return pack(STEAM, 18u + (randByte(x, y, 51u) & 23u), randByte(x, y, 52u));
      }
      return pack(EMPTY, 0u, 0u);
    }
    if (mat == ELECTRIC && isFireNear(x, y) && randByte(x, y, 54u) < 184u) {
      return pack(SPARK, 20u + (randByte(x, y, 55u) & 23u), randByte(x, y, 56u));
    }
    if (age <= 1u) {
      if (mat == ELECTRIC) {
        return pack(EMPTY, 0u, 0u);
      }
      if (isElectricResidualSpark(cell)) {
        return pack(EMPTY, 0u, 0u);
      }
      return pack(FIRE, 10u + (randByte(x, y, 53u) & 15u), randByte(x, y, 54u));
    }
    var moveTo = sparkTarget(x, y);
    if (mat == ELECTRIC) {
      moveTo = electricTarget(x, y);
    }
    if (!targetMatches(moveTo, x, y)) {
      if (mat == ELECTRIC) {
        if (randByte(x, y, 55u) < 96u) {
          return pack(SPARK, 6u + (randByte(x, y, 56u) & 7u), AUX_ELECTRIC_RESIDUAL_SPARK);
        }
        return pack(EMPTY, 0u, 0u);
      }
      if (isElectricResidualSpark(cell)) {
        return pack(EMPTY, 0u, 0u);
      }
      if (randByte(x, y, 55u) < 72u) {
        return pack(FIRE, 5u + (randByte(x, y, 56u) & 11u), randByte(x, y, 57u));
      }
      return pack(EMPTY, 0u, 0u);
    }
    return pack(mat, age - 1u, aux(cell));
  }

  return cell;
}

fn applyIncoming(outCell: u32, x: i32, y: i32) -> u32 {
  var out = outCell;
  let outMat = material(out);

  if (outMat == EMPTY || outMat == SMOKE || outMat == WATER || outMat == FIRE || outMat == STEAM || outMat == ELECTRIC || outMat == DUST || outMat == FIXED_ZONE || isPassableSecondaryMaterial(outMat)) {
    let above = getCell(x, y - 1);
    if ((material(above) == SAND || material(above) == WET_SAND || material(above) == ROCK || material(above) == ICE) && targetMatches(sandTarget(x, y - 1, material(above)), x, y)) {
      return powderIncomingCell(above, outMat, x, y, 61u);
    }

    let aboveLeft = getCell(x - 1, y - 1);
    if ((material(aboveLeft) == SAND || material(aboveLeft) == WET_SAND || material(aboveLeft) == ROCK || material(aboveLeft) == ICE) && targetMatches(sandTarget(x - 1, y - 1, material(aboveLeft)), x, y)) {
      return powderIncomingCell(aboveLeft, outMat, x, y, 62u);
    }

    let aboveRight = getCell(x + 1, y - 1);
    if ((material(aboveRight) == SAND || material(aboveRight) == WET_SAND || material(aboveRight) == ROCK || material(aboveRight) == ICE) && targetMatches(sandTarget(x + 1, y - 1, material(aboveRight)), x, y)) {
      return powderIncomingCell(aboveRight, outMat, x, y, 63u);
    }

    let sparkAbove = getCell(x, y - 1);
    if (material(sparkAbove) == SPARK && life(sparkAbove) > 1u && targetMatches(sparkTarget(x, y - 1), x, y)) {
      return pack(SPARK, life(sparkAbove) - 1u, aux(sparkAbove));
    }
    if (material(sparkAbove) == ELECTRIC && life(sparkAbove) > 1u && targetMatches(electricTarget(x, y - 1), x, y)) {
      return pack(ELECTRIC, life(sparkAbove) - 1u, randByte(x, y, 61u));
    }

    let sparkAboveLeft = getCell(x - 1, y - 1);
    if (material(sparkAboveLeft) == SPARK && life(sparkAboveLeft) > 1u && targetMatches(sparkTarget(x - 1, y - 1), x, y)) {
      return pack(SPARK, life(sparkAboveLeft) - 1u, aux(sparkAboveLeft));
    }
    if (material(sparkAboveLeft) == ELECTRIC && life(sparkAboveLeft) > 1u && targetMatches(electricTarget(x - 1, y - 1), x, y)) {
      return pack(ELECTRIC, life(sparkAboveLeft) - 1u, randByte(x, y, 62u));
    }

    let sparkAboveRight = getCell(x + 1, y - 1);
    if (material(sparkAboveRight) == SPARK && life(sparkAboveRight) > 1u && targetMatches(sparkTarget(x + 1, y - 1), x, y)) {
      return pack(SPARK, life(sparkAboveRight) - 1u, aux(sparkAboveRight));
    }
    if (material(sparkAboveRight) == ELECTRIC && life(sparkAboveRight) > 1u && targetMatches(electricTarget(x + 1, y - 1), x, y)) {
      return pack(ELECTRIC, life(sparkAboveRight) - 1u, randByte(x, y, 63u));
    }

    let electricLeft = getCell(x - 1, y);
    if (material(electricLeft) == ELECTRIC && life(electricLeft) > 1u && targetMatches(electricTarget(x - 1, y), x, y)) {
      return pack(ELECTRIC, life(electricLeft) - 1u, randByte(x, y, 64u));
    }

    let electricRight = getCell(x + 1, y);
    if (material(electricRight) == ELECTRIC && life(electricRight) > 1u && targetMatches(electricTarget(x + 1, y), x, y)) {
      return pack(ELECTRIC, life(electricRight) - 1u, randByte(x, y, 65u));
    }

    let electricBelow = getCell(x, y + 1);
    if (material(electricBelow) == ELECTRIC && life(electricBelow) > 1u && targetMatches(electricTarget(x, y + 1), x, y)) {
      return pack(ELECTRIC, life(electricBelow) - 1u, randByte(x, y, 66u));
    }

    let secondaryAbove = getCell(x, y - 1);
    if (isSecondaryMaterial(material(secondaryAbove)) && life(secondaryAbove) > 1u && targetMatches(secondaryTarget(material(secondaryAbove), x, y - 1), x, y)) {
      return pack(material(secondaryAbove), life(secondaryAbove) - 1u, aux(secondaryAbove));
    }

    let secondaryAboveLeft = getCell(x - 1, y - 1);
    if (isSecondaryMaterial(material(secondaryAboveLeft)) && life(secondaryAboveLeft) > 1u && targetMatches(secondaryTarget(material(secondaryAboveLeft), x - 1, y - 1), x, y)) {
      return pack(material(secondaryAboveLeft), life(secondaryAboveLeft) - 1u, aux(secondaryAboveLeft));
    }

    let secondaryAboveRight = getCell(x + 1, y - 1);
    if (isSecondaryMaterial(material(secondaryAboveRight)) && life(secondaryAboveRight) > 1u && targetMatches(secondaryTarget(material(secondaryAboveRight), x + 1, y - 1), x, y)) {
      return pack(material(secondaryAboveRight), life(secondaryAboveRight) - 1u, aux(secondaryAboveRight));
    }

    let secondaryLeft = getCell(x - 1, y);
    if (isSecondaryMaterial(material(secondaryLeft)) && life(secondaryLeft) > 1u && targetMatches(secondaryTarget(material(secondaryLeft), x - 1, y), x, y)) {
      return pack(material(secondaryLeft), life(secondaryLeft) - 1u, aux(secondaryLeft));
    }

    let secondaryRight = getCell(x + 1, y);
    if (isSecondaryMaterial(material(secondaryRight)) && life(secondaryRight) > 1u && targetMatches(secondaryTarget(material(secondaryRight), x + 1, y), x, y)) {
      return pack(material(secondaryRight), life(secondaryRight) - 1u, aux(secondaryRight));
    }

    let secondaryBelow = getCell(x, y + 1);
    if (isSecondaryMaterial(material(secondaryBelow)) && life(secondaryBelow) > 1u && targetMatches(secondaryTarget(material(secondaryBelow), x, y + 1), x, y)) {
      return pack(material(secondaryBelow), life(secondaryBelow) - 1u, aux(secondaryBelow));
    }
  }

  if (outMat == EMPTY || outMat == SMOKE || outMat == FIRE || outMat == STEAM || outMat == ELECTRIC || outMat == DUST || outMat == FIXED_ZONE || isPassableSecondaryMaterial(outMat)) {
    let waterAbove = getCell(x, y - 1);
    if (material(waterAbove) == WATER && targetMatches(waterTarget(x, y - 1), x, y)) {
      out = pack(WATER, 0u, aux(waterAbove));
    }

    let waterAboveLeft = getCell(x - 1, y - 1);
    if (material(waterAboveLeft) == WATER && targetMatches(waterTarget(x - 1, y - 1), x, y)) {
      out = pack(WATER, 0u, aux(waterAboveLeft));
    }

    let waterAboveRight = getCell(x + 1, y - 1);
    if (material(waterAboveRight) == WATER && targetMatches(waterTarget(x + 1, y - 1), x, y)) {
      out = pack(WATER, 0u, aux(waterAboveRight));
    }

    let waterLeft = getCell(x - 1, y);
    if (material(waterLeft) == WATER && targetMatches(waterTarget(x - 1, y), x, y)) {
      out = pack(WATER, 0u, aux(waterLeft));
    }

    let waterRight = getCell(x + 1, y);
    if (material(waterRight) == WATER && targetMatches(waterTarget(x + 1, y), x, y)) {
      out = pack(WATER, 0u, aux(waterRight));
    }
  }

  if (material(out) == EMPTY || material(out) == FIRE || material(out) == SMOKE || material(out) == STEAM || material(out) == ELECTRIC || material(out) == DUST || material(out) == FIXED_ZONE || isPassableSecondaryMaterial(material(out))) {
    let gasBelow = getCell(x, y + 1);
    let gasBelowMat = material(gasBelow);
    if ((gasBelowMat == SMOKE || gasBelowMat == STEAM) && targetMatches(smokeTarget(x, y + 1), x, y)) {
      out = pack(gasBelowMat, max(life(gasBelow), 1u) - 1u, randByte(x, y, 71u));
    }
    if (gasBelowMat == DUST && targetMatches(dustTarget(x, y + 1), x, y)) {
      out = pack(DUST, max(life(gasBelow), 1u) - 1u, randByte(x, y, 72u));
    }

    let fireBelow = getCell(x, y + 1);
    if (isSkillExplosionFire(fireBelow) && targetMatches(fireTarget(x, y + 1), x, y)) {
      let nextAge = decaySkillExplosionFireAge(life(fireBelow));
      if (nextAge > 0u) {
        out = pack(FIRE, nextAge, AUX_SKILL_EXPLOSION_FIRE);
      }
    } else if (isProjectileFire(fireBelow) && targetMatches(projectileFireTarget(x, y + 1), x, y)) {
      let nextAge = decayProjectileFireAge(life(fireBelow));
      if (nextAge > 0u) {
        out = pack(FIRE, nextAge, AUX_PROJECTILE_FIRE);
      }
    } else if (material(fireBelow) == FIRE && life(fireBelow) > 1u && targetMatches(fireTarget(x, y + 1), x, y)) {
      out = pack(FIRE, max(life(fireBelow), 24u) - 1u, randByte(x, y, 73u));
    }

    let fireBelowLeft = getCell(x - 1, y + 1);
    if (isSkillExplosionFire(fireBelowLeft) && targetMatches(fireTarget(x - 1, y + 1), x, y)) {
      let nextAge = decaySkillExplosionFireAge(life(fireBelowLeft));
      if (nextAge > 0u) {
        out = pack(FIRE, nextAge, AUX_SKILL_EXPLOSION_FIRE);
      }
    } else if (isProjectileFire(fireBelowLeft) && targetMatches(projectileFireTarget(x - 1, y + 1), x, y)) {
      let nextAge = decayProjectileFireAge(life(fireBelowLeft));
      if (nextAge > 0u) {
        out = pack(FIRE, nextAge, AUX_PROJECTILE_FIRE);
      }
    } else if (material(fireBelowLeft) == FIRE && life(fireBelowLeft) > 1u && targetMatches(fireTarget(x - 1, y + 1), x, y)) {
      out = pack(FIRE, max(life(fireBelowLeft), 20u) - 1u, randByte(x, y, 74u));
    }

    let fireBelowRight = getCell(x + 1, y + 1);
    if (isSkillExplosionFire(fireBelowRight) && targetMatches(fireTarget(x + 1, y + 1), x, y)) {
      let nextAge = decaySkillExplosionFireAge(life(fireBelowRight));
      if (nextAge > 0u) {
        out = pack(FIRE, nextAge, AUX_SKILL_EXPLOSION_FIRE);
      }
    } else if (isProjectileFire(fireBelowRight) && targetMatches(projectileFireTarget(x + 1, y + 1), x, y)) {
      let nextAge = decayProjectileFireAge(life(fireBelowRight));
      if (nextAge > 0u) {
        out = pack(FIRE, nextAge, AUX_PROJECTILE_FIRE);
      }
    } else if (material(fireBelowRight) == FIRE && life(fireBelowRight) > 1u && targetMatches(fireTarget(x + 1, y + 1), x, y)) {
      out = pack(FIRE, max(life(fireBelowRight), 20u) - 1u, randByte(x, y, 75u));
    }
  }

  return out;
}

fn applyBrushEmitter(cell: u32, emitter: Emitter, x: i32, y: i32) -> u32 {
  let cellMat = material(cell);
  let roll = randByteWithSeed(x, y, 91u + emitter.material * 17u, emitter.seed);
  if (roll > emitter.strength) {
    return cell;
  }

  if (emitter.material == EMPTY) {
    return pack(EMPTY, 0u, 0u);
  }
  if (emitter.material == SOLID) {
    return pack(SOLID, 255u, roll);
  }

  if (cellMat == SOLID) {
    return cell;
  }

  if (emitter.material == WATER) {
    if (cellMat == SAND) {
      return pack(DUST, emitterLife(emitter, 34u + (roll & 31u)), roll);
    }
    if (cellMat == WET_SAND) {
      return cell;
    }
    if (isSparkCarrier(cellMat)) {
      return pack(LASER_ARC, emitterLife(emitter, 12u + (roll & 15u)), roll);
    }
    if (isElectricCarrier(cellMat)) {
      return pack(ICE, 0u, roll);
    }
    return pack(WATER, 0u, roll);
  }
  if (emitter.material == SAND) {
    if (cellMat == WATER) {
      return pack(DUST, 34u + (roll & 31u), roll);
    }
    if (cellMat == FIRE) {
      return pack(ROCK, 0u, roll);
    }
    if (isSparkCarrier(cellMat)) {
      return pack(CHAIN_EXPLOSION, emitterLife(emitter, 12u + (roll & 15u)), roll);
    }
    if (isElectricCarrier(cellMat)) {
      return pack(FIXED_ZONE, 36u + (roll & 31u), roll);
    }
    return pack(SAND, 0u, roll);
  }
  if (emitter.material == WET_SAND) {
    return pack(WET_SAND, 0u, roll);
  }
  if (emitter.material == ELECTRIC) {
    if (cellMat == WATER) {
      return pack(ICE, 0u, roll);
    }
    if (cellMat == STEAM) {
      return pack(CHAIN_ARC, emitterLife(emitter, 18u + (roll & 15u)), roll);
    }
    if (cellMat == SAND || cellMat == WET_SAND) {
      return pack(FIXED_ZONE, emitterLife(emitter, 36u + (roll & 31u)), roll);
    }
    if (cellMat == ROCK || cellMat == PINBALL_ROCK) {
      return pack(LIGHTNING_ROCK, emitterLife(emitter, 28u + (roll & 31u)), roll);
    }
    if (cellMat == DUST || cellMat == FIRE_DUST) {
      return pack(CHARGED_DUST, emitterLife(emitter, 30u + (roll & 31u)), roll);
    }
    if (cellMat == FIRE) {
      return pack(SPARK, emitterLife(emitter, 18u + (roll & 23u)), roll);
    }
    return pack(ELECTRIC, emitterLife(emitter, 18u + (roll & 23u)), roll);
  }
  if (emitter.material == ROCK) {
    return pack(ROCK, 0u, roll);
  }
  if (emitter.material == ICE) {
    return pack(ICE, 0u, roll);
  }
  if (emitter.material == DUST) {
    return pack(DUST, emitterLife(emitter, 34u + (roll & 31u)), roll);
  }
  if (emitter.material == FIXED_ZONE) {
    return pack(FIXED_ZONE, emitterLife(emitter, 36u + (roll & 31u)), roll);
  }
  if (emitter.material == SMOKE) {
    return pack(SMOKE, emitterLife(emitter, 42u + (roll & 47u)), roll);
  }
  if (emitter.material == STEAM) {
    return pack(STEAM, emitterLife(emitter, 42u + (roll & 47u)), roll);
  }
  if (emitter.material == SPARK) {
    return pack(SPARK, emitterLife(emitter, 16u + (roll & 23u)), roll);
  }

  let profile = emitterProfile(emitter);
  if (emitter.material == FIRE) {
    if (cellMat == WATER || cellMat == WET_SAND || cellMat == SLOW_ZONE) {
      return pack(STEAM, emitterLife(emitter, 36u + (roll & 31u)), roll);
    }
    if (cellMat == SAND) {
      return pack(ROCK, 0u, roll);
    }
    if (isElectricCarrier(cellMat)) {
      return pack(SPARK, emitterLife(emitter, 18u + (roll & 23u)), roll);
    }
    if (cellMat == ICE) {
      return pack(ICE_BURST, emitterLife(emitter, 18u + (roll & 15u)), roll);
    }
    if (cellMat == DUST || cellMat == CHARGED_DUST) {
      return pack(FIRE_DUST, emitterLife(emitter, 26u + (roll & 23u)), roll);
    }
    if (cellMat == FIXED_ZONE || cellMat == GRAVITY_ZONE) {
      return pack(AMPLIFY_ZONE, emitterLife(emitter, 34u + (roll & 31u)), roll);
    }
  }
  if (profile == EMITTER_PROFILE_PROJECTILE_FIRE) {
    return pack(FIRE, emitterLife(emitter, 36u + (roll & 31u)), AUX_PROJECTILE_FIRE);
  }
  if (profile == EMITTER_PROFILE_PURE) {
    return pack(FIRE, emitterLife(emitter, 36u + (roll & 31u)), roll);
  }

  if (roll < 58u) {
    return pack(SPARK, 18u + (roll & 15u), roll);
  }
  if (roll < 92u) {
    return pack(SMOKE, 38u + (roll & 31u), roll);
  }
  return pack(FIRE, 34u + (roll & 63u), roll);
}

fn applyExplosionEmitter(cell: u32, emitter: Emitter, x: i32, y: i32, dist2: i32) -> u32 {
  let radius = i32(emitter.radius);
  let radius2 = radius * radius;

  if (material(cell) == SOLID && dist2 > radius2 / 3) {
    return cell;
  }

  let roll = randByteWithSeed(x, y, 101u, emitter.seed);
  if (roll > emitter.strength && dist2 > radius2 / 6) {
    return cell;
  }

  if (emitterProfile(emitter) == EMITTER_PROFILE_SKILL_EXPLOSION_FIRE) {
    let fireLife = emitterLife(emitter, 14u + (roll & 15u));
    let ringWidth = max(2, radius / 4);
    let innerRadius = max(0, radius - ringWidth);
    let innerRadius2 = innerRadius * innerRadius;

    if (dist2 < innerRadius2) {
      if (roll < 80u) {
        return pack(EMPTY, 0u, 0u);
      }
      return cell;
    }

    if (roll < 214u) {
      return pack(FIRE, fireLife, AUX_SKILL_EXPLOSION_FIRE);
    }
    if (roll < 238u) {
      return pack(SPARK, 8u + (roll & 15u), roll);
    }
    if (roll < 248u) {
      return pack(SMOKE, 8u + (roll & 15u), roll);
    }
    return cell;
  }

  if (dist2 < radius2 / 5) {
    if (roll < 92u) {
      return pack(EMPTY, 0u, 0u);
    }
    return pack(FIRE, 48u + (roll & 31u), roll);
  }

  if (roll < 88u) {
    return pack(SPARK, 18u + (roll & 15u), roll);
  }
  if (roll < 150u) {
    return pack(FIRE, 36u + (roll & 31u), roll);
  }
  if (roll < 206u) {
    return pack(SMOKE, 48u + (roll & 31u), roll);
  }
  return pack(SAND, 0u, roll);
}

fn applyEmitters(cell: u32, x: i32, y: i32) -> u32 {
  var out = cell;
  let count = min(params.emitterCount, params.maxEmitters);

  for (var i = 0u; i < count; i = i + 1u) {
    let emitter = emitters[i];
    let dx = x - i32(emitter.x);
    let dy = y - i32(emitter.y);
    let radius = i32(emitter.radius);
    let dist2 = dx * dx + dy * dy;

    if (dist2 <= radius * radius) {
      if ((emitter.flags & EMITTER_FLAG_EXPLOSION) != 0u) {
        out = applyExplosionEmitter(out, emitter, x, y, dist2);
      } else {
        out = applyBrushEmitter(out, emitter, x, y);
      }
    }
  }

  return out;
}

@compute @workgroup_size(8, 8, 1)
fn simulate(@builtin(global_invocation_id) globalId: vec3<u32>) {
  if (globalId.x >= params.width || globalId.y >= params.height) {
    return;
  }

  let x = i32(globalId.x);
  let y = i32(globalId.y);
  let index = indexOf(globalId.x, globalId.y);
  let current = src[index];

  var out = applyCurrentOutgoing(current, x, y);
  out = applyIncoming(out, x, y);
  out = applyEmitters(out, x, y);

  dst[index] = out;
}

struct VertexOut {
  @builtin(position) position: vec4<f32>,
};

@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOut {
  var positions = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0),
  );

  var out: VertexOut;
  out.position = vec4<f32>(positions[vertexIndex], 0.0, 1.0);
  return out;
}

fn materialColor(cell: u32, x: u32, y: u32) -> vec4<f32> {
  let mat = material(cell);
  let l = f32(life(cell)) / 255.0;
  let n = f32((hash(x, y, aux(cell) + params.frame) & 31u)) / 31.0;

  if (mat == SOLID) {
    return vec4<f32>(0.18 + n * 0.08, 0.17 + n * 0.06, 0.18 + n * 0.05, 1.0);
  }
  if (mat == ROCK) {
    return vec4<f32>(0.27 + n * 0.08, 0.25 + n * 0.06, 0.27 + n * 0.05, 1.0);
  }
  if (mat == ICE) {
    let shine = 0.45 + n * 0.22;
    return vec4<f32>(0.45 + shine * 0.35, 0.78 + shine * 0.2, 1.2 + shine * 0.35, 1.0);
  }
  if (mat == SAND) {
    return vec4<f32>(0.78 + n * 0.12, 0.58 + n * 0.08, 0.28 + n * 0.06, 1.0);
  }
  if (mat == WET_SAND) {
    return vec4<f32>(0.46 + n * 0.07, 0.34 + n * 0.05, 0.20 + n * 0.04, 1.0);
  }
  if (mat == WATER) {
    let still = f32((hash(x, y, aux(cell) + 17u) & 31u)) / 31.0;
    return vec4<f32>(0.08 + still * 0.04, 0.30 + still * 0.08, 0.85 + still * 0.13, 1.0);
  }
  if (mat == ELECTRIC) {
    let heat = clamp(0.85 + l * 0.95 + n * 0.25, 0.0, 2.0);
    return vec4<f32>(0.55 + heat * 0.8, 1.6 + heat * 1.3, 2.4 + heat * 1.8, 1.0);
  }
  if (mat == FIRE) {
    let heat = clamp(l * 2.6 + n * 0.22, 0.0, 1.0);
    return vec4<f32>(2.15 + heat * 2.35, 0.24 + heat * 0.95, 0.02 + heat * 0.16 + n * 0.04, 1.0);
  }
  if (mat == DUST) {
    let a = 0.28 + l * 0.28;
    return vec4<f32>(a * 1.35 + n * 0.08, a * 1.12 + n * 0.06, a * 0.76 + n * 0.04, 1.0);
  }
  if (mat == FIXED_ZONE) {
    let pulse = 0.44 + l * 0.62 + n * 0.18;
    return vec4<f32>(0.55 + pulse * 0.4, 0.95 + pulse * 0.9, 1.3 + pulse * 1.2, 1.0);
  }
  if (mat == CHAIN_ARC) {
    let pulse = 0.85 + l * 1.15 + n * 0.45;
    return vec4<f32>(0.72 + pulse * 0.95, 1.9 + pulse * 1.45, 3.2 + pulse * 2.0, 1.0);
  }
  if (mat == CHAIN_EXPLOSION) {
    let heat = 0.9 + l * 1.2 + n * 0.35;
    return vec4<f32>(3.1 + heat * 1.4, 1.35 + heat * 0.95, 0.35 + heat * 0.45, 1.0);
  }
  if (mat == LASER_ARC) {
    let beam = 0.92 + l * 1.0 + n * 0.28;
    return vec4<f32>(0.75 + beam * 0.8, 2.25 + beam * 1.55, 3.4 + beam * 1.75, 1.0);
  }
  if (mat == PINBALL_ROCK) {
    let shine = 0.32 + n * 0.22;
    return vec4<f32>(0.36 + shine * 0.38, 0.42 + shine * 0.34, 0.50 + shine * 0.46, 1.0);
  }
  if (mat == LIGHTNING_ROCK) {
    let charge = 0.5 + l * 0.9 + n * 0.28;
    return vec4<f32>(0.45 + charge * 0.55, 0.85 + charge * 1.1, 1.35 + charge * 1.45, 1.0);
  }
  if (mat == ICE_BURST) {
    let shard = 0.58 + l * 0.72 + n * 0.24;
    return vec4<f32>(0.74 + shard * 0.38, 1.1 + shard * 0.42, 1.8 + shard * 0.76, 1.0);
  }
  if (mat == BLIZZARD) {
    let frost = 0.38 + l * 0.46 + n * 0.2;
    return vec4<f32>(0.62 + frost * 0.22, 0.82 + frost * 0.32, 1.18 + frost * 0.58, 1.0);
  }
  if (mat == FIRE_DUST) {
    let ember = 0.55 + l * 0.62 + n * 0.22;
    return vec4<f32>(1.8 + ember * 1.2, 0.72 + ember * 0.58, 0.24 + ember * 0.18, 1.0);
  }
  if (mat == CHARGED_DUST) {
    let charge = 0.42 + l * 0.68 + n * 0.26;
    return vec4<f32>(0.56 + charge * 0.4, 1.2 + charge * 0.9, 1.65 + charge * 1.2, 1.0);
  }
  if (mat == AMPLIFY_ZONE) {
    let pulse = 0.5 + l * 0.72 + n * 0.24;
    return vec4<f32>(1.7 + pulse * 0.95, 0.72 + pulse * 0.54, 0.28 + pulse * 0.22, 1.0);
  }
  if (mat == SLOW_ZONE) {
    let pulse = 0.42 + l * 0.48 + n * 0.18;
    return vec4<f32>(0.42 + pulse * 0.28, 0.78 + pulse * 0.46, 1.08 + pulse * 0.72, 1.0);
  }
  if (mat == GRAVITY_ZONE) {
    let pull = 0.42 + l * 0.5 + n * 0.2;
    return vec4<f32>(0.62 + pull * 0.35, 0.50 + pull * 0.26, 0.78 + pull * 0.48, 1.0);
  }
  if (mat == SMOKE) {
    let a = 0.22 + l * 0.48;
    return vec4<f32>(a + n * 0.06, a + n * 0.05, a + n * 0.04, 1.0);
  }
  if (mat == SPARK) {
    if (isElectricResidualSpark(cell)) {
      let charge = clamp(0.78 + l * 0.9 + n * 0.24, 0.0, 1.8);
      return vec4<f32>(0.58 + charge * 0.7, 1.65 + charge * 1.25, 3.0 + charge * 1.7, 1.0);
    }
    let heat = clamp(0.8 + l * 0.8 + n * 0.25, 0.0, 1.8);
    return vec4<f32>(2.8 + heat * 1.45, 1.85 + heat * 1.05, 0.55 + heat * 0.45, 1.0);
  }
  if (mat == STEAM) {
    let a = 0.36 + l * 0.44;
    return vec4<f32>(a * 0.82 + n * 0.04, a * 0.94 + n * 0.05, a + n * 0.08, 1.0);
  }

  return vec4<f32>(0.0, 0.0, 0.0, 0.0);
}

@fragment
fn fragmentMain(@builtin(position) position: vec4<f32>) -> @location(0) vec4<f32> {
  let cw = max(params.canvasWidth, 1u);
  let ch = max(params.canvasHeight, 1u);
  let gx = min(params.width - 1u, u32((position.x / f32(cw)) * f32(params.width)));
  let gy = min(params.height - 1u, u32((position.y / f32(ch)) * f32(params.height)));
  let cell = src[indexOf(gx, gy)];
  return materialColor(cell, gx, gy);
}
