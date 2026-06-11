const EMPTY: u32 = 0u;
const SOLID: u32 = 1u;
const SAND: u32 = 2u;
const WATER: u32 = 3u;
const FIRE: u32 = 4u;
const SMOKE: u32 = 5u;
const SPARK: u32 = 6u;
const STEAM: u32 = 7u;
const WET_SAND: u32 = 8u;
const EMITTER_FLAG_EXPLOSION: u32 = 1u;
const EMITTER_PROFILE_DEFAULT: u32 = 0u;
const EMITTER_PROFILE_PURE: u32 = 1u;
const EMITTER_PROFILE_PROJECTILE_FIRE: u32 = 2u;
const AUX_PROJECTILE_FIRE: u32 = 251u;
const PROJECTILE_FIRE_DECAY_PER_STEP: u32 = 3u;

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
  if (mat == FIRE || mat == SMOKE || mat == STEAM) {
    return 8u;
  }
  return 0u;
}

fn canPowderEnter(moverMat: u32, targetMat: u32) -> bool {
  if (targetMat == SOLID || targetMat == SAND || targetMat == WET_SAND) {
    return false;
  }
  return materialDensity(moverMat) > materialDensity(targetMat);
}

fn canFluidEnter(mat: u32) -> bool {
  return mat != SOLID && materialDensity(WATER) > materialDensity(mat);
}

fn canSupportWater(mat: u32) -> bool {
  return mat == SOLID || mat == SAND || mat == WET_SAND || mat == WATER;
}

fn canSmokeEnter(mat: u32) -> bool {
  return mat == EMPTY || mat == FIRE;
}

fn canFireEnter(mat: u32) -> bool {
  return mat == EMPTY || mat == SMOKE || mat == STEAM || mat == FIRE;
}

fn isFireNear(x: i32, y: i32) -> bool {
  return material(getCell(x - 1, y)) == FIRE ||
    material(getCell(x + 1, y)) == FIRE ||
    material(getCell(x, y - 1)) == FIRE ||
    material(getCell(x, y + 1)) == FIRE;
}

fn isHeatNear(x: i32, y: i32) -> bool {
  return material(getCell(x - 1, y)) == FIRE ||
    material(getCell(x + 1, y)) == FIRE ||
    material(getCell(x, y - 1)) == FIRE ||
    material(getCell(x, y + 1)) == FIRE ||
    material(getCell(x - 1, y)) == SPARK ||
    material(getCell(x + 1, y)) == SPARK ||
    material(getCell(x, y - 1)) == SPARK ||
    material(getCell(x, y + 1)) == SPARK;
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

  var first = -1;
  var second = 1;
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

  var first = -1;
  var second = 1;
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

  var first = -1;
  var second = 1;
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

  var first = -1;
  var second = 1;
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

  var first = -1;
  var second = 1;
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

  var first = -1;
  var second = 1;
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

  if (mat == SAND || mat == WET_SAND) {
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

  if (mat == SMOKE || mat == STEAM) {
    let age = life(cell);
    if (age <= 1u) {
      if (mat == STEAM && randByte(x, y, 38u) < 96u) {
        return pack(WATER, 0u, randByte(x, y, 39u));
      }
      return pack(EMPTY, 0u, 0u);
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

  if (mat == SPARK) {
    let age = life(cell);
    if (isWetNear(x, y)) {
      if (randByte(x, y, 50u) < 172u) {
        return pack(STEAM, 18u + (randByte(x, y, 51u) & 23u), randByte(x, y, 52u));
      }
      return pack(EMPTY, 0u, 0u);
    }
    if (age <= 1u) {
      return pack(FIRE, 10u + (randByte(x, y, 53u) & 15u), randByte(x, y, 54u));
    }
    let moveTo = sparkTarget(x, y);
    if (!targetMatches(moveTo, x, y)) {
      if (randByte(x, y, 55u) < 72u) {
        return pack(FIRE, 5u + (randByte(x, y, 56u) & 11u), randByte(x, y, 57u));
      }
      return pack(EMPTY, 0u, 0u);
    }
    return pack(SPARK, age - 1u, randByte(x, y, 58u));
  }

  return cell;
}

fn applyIncoming(outCell: u32, x: i32, y: i32) -> u32 {
  var out = outCell;
  let outMat = material(out);

  if (outMat == EMPTY || outMat == SMOKE || outMat == WATER || outMat == FIRE || outMat == STEAM) {
    let above = getCell(x, y - 1);
    if ((material(above) == SAND || material(above) == WET_SAND) && targetMatches(sandTarget(x, y - 1, material(above)), x, y)) {
      return powderIncomingCell(above, outMat, x, y, 61u);
    }

    let aboveLeft = getCell(x - 1, y - 1);
    if ((material(aboveLeft) == SAND || material(aboveLeft) == WET_SAND) && targetMatches(sandTarget(x - 1, y - 1, material(aboveLeft)), x, y)) {
      return powderIncomingCell(aboveLeft, outMat, x, y, 62u);
    }

    let aboveRight = getCell(x + 1, y - 1);
    if ((material(aboveRight) == SAND || material(aboveRight) == WET_SAND) && targetMatches(sandTarget(x + 1, y - 1, material(aboveRight)), x, y)) {
      return powderIncomingCell(aboveRight, outMat, x, y, 63u);
    }

    let sparkAbove = getCell(x, y - 1);
    if (material(sparkAbove) == SPARK && life(sparkAbove) > 1u && targetMatches(sparkTarget(x, y - 1), x, y)) {
      return pack(SPARK, life(sparkAbove) - 1u, randByte(x, y, 61u));
    }

    let sparkAboveLeft = getCell(x - 1, y - 1);
    if (material(sparkAboveLeft) == SPARK && life(sparkAboveLeft) > 1u && targetMatches(sparkTarget(x - 1, y - 1), x, y)) {
      return pack(SPARK, life(sparkAboveLeft) - 1u, randByte(x, y, 62u));
    }

    let sparkAboveRight = getCell(x + 1, y - 1);
    if (material(sparkAboveRight) == SPARK && life(sparkAboveRight) > 1u && targetMatches(sparkTarget(x + 1, y - 1), x, y)) {
      return pack(SPARK, life(sparkAboveRight) - 1u, randByte(x, y, 63u));
    }
  }

  if (outMat == EMPTY || outMat == SMOKE || outMat == FIRE || outMat == STEAM) {
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

  if (material(out) == EMPTY || material(out) == FIRE || material(out) == SMOKE || material(out) == STEAM) {
    let gasBelow = getCell(x, y + 1);
    let gasBelowMat = material(gasBelow);
    if ((gasBelowMat == SMOKE || gasBelowMat == STEAM) && targetMatches(smokeTarget(x, y + 1), x, y)) {
      out = pack(gasBelowMat, max(life(gasBelow), 1u) - 1u, randByte(x, y, 71u));
    }

    let fireBelow = getCell(x, y + 1);
    if (isProjectileFire(fireBelow) && targetMatches(projectileFireTarget(x, y + 1), x, y)) {
      let nextAge = decayProjectileFireAge(life(fireBelow));
      if (nextAge > 0u) {
        out = pack(FIRE, nextAge, AUX_PROJECTILE_FIRE);
      }
    } else if (material(fireBelow) == FIRE && life(fireBelow) > 1u && targetMatches(fireTarget(x, y + 1), x, y)) {
      out = pack(FIRE, max(life(fireBelow), 24u) - 1u, randByte(x, y, 73u));
    }

    let fireBelowLeft = getCell(x - 1, y + 1);
    if (isProjectileFire(fireBelowLeft) && targetMatches(projectileFireTarget(x - 1, y + 1), x, y)) {
      let nextAge = decayProjectileFireAge(life(fireBelowLeft));
      if (nextAge > 0u) {
        out = pack(FIRE, nextAge, AUX_PROJECTILE_FIRE);
      }
    } else if (material(fireBelowLeft) == FIRE && life(fireBelowLeft) > 1u && targetMatches(fireTarget(x - 1, y + 1), x, y)) {
      out = pack(FIRE, max(life(fireBelowLeft), 20u) - 1u, randByte(x, y, 74u));
    }

    let fireBelowRight = getCell(x + 1, y + 1);
    if (isProjectileFire(fireBelowRight) && targetMatches(projectileFireTarget(x + 1, y + 1), x, y)) {
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
      return pack(WET_SAND, 0u, roll);
    }
    if (cellMat == WET_SAND) {
      return cell;
    }
    return pack(WATER, 0u, roll);
  }
  if (emitter.material == SAND) {
    if (cellMat == WATER) {
      return pack(WET_SAND, 0u, roll);
    }
    return pack(SAND, 0u, roll);
  }
  if (emitter.material == WET_SAND) {
    return pack(WET_SAND, 0u, roll);
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
  if (mat == FIRE) {
    let heat = clamp(l * 2.6 + n * 0.22, 0.0, 1.0);
    return vec4<f32>(2.15 + heat * 2.35, 0.24 + heat * 0.95, 0.02 + heat * 0.16 + n * 0.04, 1.0);
  }
  if (mat == SMOKE) {
    let a = 0.22 + l * 0.48;
    return vec4<f32>(a + n * 0.06, a + n * 0.05, a + n * 0.04, 1.0);
  }
  if (mat == SPARK) {
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
