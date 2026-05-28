const EMPTY: u32 = 0u;
const SOLID: u32 = 1u;
const SAND: u32 = 2u;
const WATER: u32 = 3u;
const FIRE: u32 = 4u;
const SMOKE: u32 = 5u;
const SPARK: u32 = 6u;

struct SimParams {
  width: u32,
  height: u32,
  frame: u32,
  emitterActive: u32,
  emitterX: u32,
  emitterY: u32,
  emitterRadius: u32,
  emitterMaterial: u32,
  explosionActive: u32,
  explosionX: u32,
  explosionY: u32,
  explosionRadius: u32,
  canvasWidth: u32,
  canvasHeight: u32,
  pad0: u32,
  pad1: u32,
};

@group(0) @binding(0) var<storage, read> src: array<u32>;
@group(0) @binding(1) var<storage, read_write> dst: array<u32>;
@group(0) @binding(2) var<uniform> params: SimParams;

fn pack(material: u32, life: u32, aux: u32) -> u32 {
  return (material & 255u) | ((life & 255u) << 8u) | ((aux & 255u) << 16u);
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

fn indexOf(x: u32, y: u32) -> u32 {
  return y * params.width + x;
}

fn inBounds(x: i32, y: i32) -> bool {
  return x >= 0 && y >= 0 && x < i32(params.width) && y < i32(params.height);
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

fn canSandEnter(mat: u32) -> bool {
  return mat == EMPTY || mat == WATER || mat == SMOKE || mat == FIRE;
}

fn canFluidEnter(mat: u32) -> bool {
  return mat == EMPTY || mat == SMOKE || mat == FIRE;
}

fn canSmokeEnter(mat: u32) -> bool {
  return mat == EMPTY || mat == FIRE;
}

fn isWetNear(x: i32, y: i32) -> bool {
  return material(getCell(x - 1, y)) == WATER ||
    material(getCell(x + 1, y)) == WATER ||
    material(getCell(x, y - 1)) == WATER ||
    material(getCell(x, y + 1)) == WATER;
}

fn sandTarget(x: i32, y: i32) -> vec2<i32> {
  let below = material(getCell(x, y + 1));
  if (canSandEnter(below)) {
    return vec2<i32>(x, y + 1);
  }

  var first = -1;
  var second = 1;
  if (randBit(x, y, 11u)) {
    first = 1;
    second = -1;
  }

  let firstMat = material(getCell(x + first, y + 1));
  if (canSandEnter(firstMat)) {
    return vec2<i32>(x + first, y + 1);
  }

  let secondMat = material(getCell(x + second, y + 1));
  if (canSandEnter(secondMat)) {
    return vec2<i32>(x + second, y + 1);
  }

  return vec2<i32>(x, y);
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

  let firstMat = material(getCell(x + first, y));
  if (canFluidEnter(firstMat)) {
    return vec2<i32>(x + first, y);
  }

  let secondMat = material(getCell(x + second, y));
  if (canFluidEnter(secondMat)) {
    return vec2<i32>(x + second, y);
  }

  return vec2<i32>(x, y);
}

fn smokeTarget(x: i32, y: i32) -> vec2<i32> {
  let up = material(getCell(x, y - 1));
  if (canSmokeEnter(up)) {
    return vec2<i32>(x, y - 1);
  }

  var first = -1;
  var second = 1;
  if (randBit(x, y, 31u)) {
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

fn targetMatches(moveTo: vec2<i32>, x: i32, y: i32) -> bool {
  return moveTo.x == x && moveTo.y == y;
}

fn applyCurrentOutgoing(cell: u32, x: i32, y: i32) -> u32 {
  let mat = material(cell);

  if (mat == SAND) {
    let moveTo = sandTarget(x, y);
    if (!targetMatches(moveTo, x, y)) {
      let moveToMat = material(getCell(moveTo.x, moveTo.y));
      if (moveToMat == WATER) {
        return pack(WATER, 0u, aux(cell));
      }
      return pack(EMPTY, 0u, 0u);
    }
    return cell;
  }

  if (mat == WATER) {
    let moveTo = waterTarget(x, y);
    if (!targetMatches(moveTo, x, y)) {
      return pack(EMPTY, 0u, 0u);
    }
    return cell;
  }

  if (mat == SMOKE) {
    let age = life(cell);
    if (age <= 1u) {
      return pack(EMPTY, 0u, 0u);
    }
    let moveTo = smokeTarget(x, y);
    if (!targetMatches(moveTo, x, y)) {
      return pack(EMPTY, 0u, 0u);
    }
    return pack(SMOKE, age - 1u, aux(cell));
  }

  if (mat == FIRE) {
    if (isWetNear(x, y)) {
      return pack(SMOKE, 44u + (randByte(x, y, 41u) & 15u), 0u);
    }
    let age = life(cell);
    if (age <= 1u) {
      return pack(SMOKE, 36u + (randByte(x, y, 42u) & 31u), 0u);
    }
    if (randByte(x, y, 43u) < 48u && canSmokeEnter(material(getCell(x, y - 1)))) {
      return pack(EMPTY, 0u, 0u);
    }
    return pack(FIRE, age - 1u, randByte(x, y, 44u));
  }

  if (mat == SPARK) {
    let age = life(cell);
    if (age <= 1u) {
      return pack(FIRE, 12u, randByte(x, y, 51u));
    }
    let moveTo = sandTarget(x, y);
    if (!targetMatches(moveTo, x, y)) {
      return pack(EMPTY, 0u, 0u);
    }
    return pack(SPARK, age - 1u, randByte(x, y, 52u));
  }

  return cell;
}

fn applyIncoming(outCell: u32, x: i32, y: i32) -> u32 {
  var out = outCell;
  let outMat = material(out);

  if (outMat == EMPTY || outMat == SMOKE || outMat == WATER || outMat == FIRE) {
    let above = getCell(x, y - 1);
    if (material(above) == SAND && targetMatches(sandTarget(x, y - 1), x, y)) {
      return pack(SAND, 0u, aux(above));
    }

    let aboveLeft = getCell(x - 1, y - 1);
    if (material(aboveLeft) == SAND && targetMatches(sandTarget(x - 1, y - 1), x, y)) {
      return pack(SAND, 0u, aux(aboveLeft));
    }

    let aboveRight = getCell(x + 1, y - 1);
    if (material(aboveRight) == SAND && targetMatches(sandTarget(x + 1, y - 1), x, y)) {
      return pack(SAND, 0u, aux(aboveRight));
    }

    let sparkAbove = getCell(x, y - 1);
    if (material(sparkAbove) == SPARK && targetMatches(sandTarget(x, y - 1), x, y)) {
      return pack(SPARK, max(life(sparkAbove), 8u), randByte(x, y, 61u));
    }
  }

  if (outMat == EMPTY || outMat == SMOKE || outMat == FIRE) {
    let waterAbove = getCell(x, y - 1);
    if (material(waterAbove) == WATER && targetMatches(waterTarget(x, y - 1), x, y)) {
      out = pack(WATER, 0u, aux(waterAbove));
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

  if (material(out) == EMPTY || material(out) == FIRE) {
    let smokeBelow = getCell(x, y + 1);
    if (material(smokeBelow) == SMOKE && targetMatches(smokeTarget(x, y + 1), x, y)) {
      out = pack(SMOKE, max(life(smokeBelow), 1u) - 1u, randByte(x, y, 71u));
    }

    let fireBelow = getCell(x, y + 1);
    if (material(fireBelow) == FIRE && randByte(x, y, 72u) < 54u) {
      out = pack(FIRE, max(life(fireBelow), 24u) - 1u, randByte(x, y, 73u));
    }
  }

  return out;
}

fn applyEmitter(cell: u32, x: i32, y: i32) -> u32 {
  if (params.emitterActive == 0u) {
    return cell;
  }

  let dx = x - i32(params.emitterX);
  let dy = y - i32(params.emitterY);
  let radius = i32(params.emitterRadius);
  if (dx * dx + dy * dy > radius * radius) {
    return cell;
  }

  let roll = randByte(x, y, 91u);
  if (roll > 210u) {
    return cell;
  }

  if (params.emitterMaterial == WATER) {
    return pack(WATER, 0u, roll);
  }
  if (params.emitterMaterial == SAND) {
    return pack(SAND, 0u, roll);
  }

  if (roll < 58u) {
    return pack(SPARK, 18u + (roll & 15u), roll);
  }
  if (roll < 92u) {
    return pack(SMOKE, 38u + (roll & 31u), roll);
  }
  return pack(FIRE, 34u + (roll & 63u), roll);
}

fn applyExplosion(cell: u32, x: i32, y: i32) -> u32 {
  if (params.explosionActive == 0u) {
    return cell;
  }

  let dx = x - i32(params.explosionX);
  let dy = y - i32(params.explosionY);
  let radius = i32(params.explosionRadius);
  let dist2 = dx * dx + dy * dy;
  if (dist2 > radius * radius) {
    return cell;
  }

  if (material(cell) == SOLID && dist2 > (radius * radius) / 3) {
    return cell;
  }

  let roll = randByte(x, y, 101u);
  if (dist2 < (radius * radius) / 5) {
    if (roll < 90u) {
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
  out = applyExplosion(out, x, y);
  out = applyEmitter(out, x, y);

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
  if (mat == WATER) {
    return vec4<f32>(0.08 + n * 0.04, 0.30 + n * 0.08, 0.85 + n * 0.13, 1.0);
  }
  if (mat == FIRE) {
    return vec4<f32>(1.0, 0.18 + l * 0.70, 0.02 + n * 0.12, 1.0);
  }
  if (mat == SMOKE) {
    let a = 0.22 + l * 0.48;
    return vec4<f32>(a + n * 0.06, a + n * 0.05, a + n * 0.04, 1.0);
  }
  if (mat == SPARK) {
    return vec4<f32>(1.0, 0.88 + n * 0.12, 0.28 + l * 0.5, 1.0);
  }

  let sky = 0.025 + f32(y) / f32(max(params.height, 1u)) * 0.035;
  return vec4<f32>(sky * 0.7, sky * 0.8, sky, 1.0);
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
