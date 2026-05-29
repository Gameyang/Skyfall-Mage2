struct QueryParams {
  gridSize: vec2u,
  hitboxCount: u32,
  _pad0: u32,
};

@group(0) @binding(0) var<uniform> params: QueryParams;
@group(0) @binding(1) var<storage, read> cellsIn: array<u32>;
@group(0) @binding(2) var<storage, read> hitboxes: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> queryResults: array<vec4f>;

@compute @workgroup_size(64)
fn queryMain(@builtin(global_invocation_id) id: vec3u) {
  if (id.x >= params.hitboxCount) {
    return;
  }

  let hitbox = hitboxes[id.x];
  let center = vec2u(
    min(u32(hitbox.x * f32(params.gridSize.x - 1u)), params.gridSize.x - 1u),
    min(u32(hitbox.y * f32(params.gridSize.y - 1u)), params.gridSize.y - 1u)
  );
  let radius = max(1u, u32(ceil(hitbox.z * f32(max(params.gridSize.x, params.gridSize.y)))));
  var sampled = 0.0;
  var fire = 0.0;
  var force = 0.0;
  var water = 0.0;

  for (var oy = -8; oy <= 8; oy = oy + 1) {
    for (var ox = -8; ox <= 8; ox = ox + 1) {
      let distanceSq = ox * ox + oy * oy;
      if (distanceSq > i32(radius * radius)) {
        continue;
      }

      let sx = i32(center.x) + ox;
      let sy = i32(center.y) + oy;
      if (sx < 0 || sy < 0 || sx >= i32(params.gridSize.x) || sy >= i32(params.gridSize.y)) {
        continue;
      }

      sampled = sampled + 1.0;
      let material = cellsIn[u32(sy) * params.gridSize.x + u32(sx)] & 255u;
      if (material == 4u || material == 7u || material == 10u) {
        fire = fire + 1.0;
      }
      if (material == 8u) {
        force = force + 1.0;
      }
      if (material == 3u || material == 6u) {
        water = water + 1.0;
      }
    }
  }

  let divisor = max(1.0, sampled);
  let fireCoverage = fire / divisor;
  let forceCoverage = force / divisor;
  let waterCoverage = water / divisor;
  queryResults[id.x] = vec4f(fireCoverage, forceCoverage, waterCoverage, fireCoverage * 18.0 + forceCoverage * 9.0);
}
