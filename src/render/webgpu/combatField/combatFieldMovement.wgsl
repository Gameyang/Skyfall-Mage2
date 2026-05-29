struct SimParams {
  gridSize: vec2u,
  frame: u32,
  _pad0: u32,
};

@group(0) @binding(0) var<uniform> params: SimParams;
@group(0) @binding(1) var<storage, read> cellsIn: array<u32>;
@group(0) @binding(2) var<storage, read_write> cellsOut: array<u32>;

@compute @workgroup_size(8, 8)
fn movementMain(@builtin(global_invocation_id) id: vec3u) {
  if (id.x >= params.gridSize.x || id.y >= params.gridSize.y) {
    return;
  }

  let index = id.y * params.gridSize.x + id.x;
  let current = materialAt(id.xy);
  let above = select(255u, materialAt(vec2u(id.x, id.y - 1u)), id.y > 0u);
  let below = select(255u, materialAt(vec2u(id.x, id.y + 1u)), id.y + 1u < params.gridSize.y);

  if (current == 0u && isFalling(above)) {
    cellsOut[index] = above;
    return;
  }

  if (isFalling(current) && below == 0u) {
    cellsOut[index] = 0u;
    return;
  }

  if (current == 0u && isGas(below)) {
    cellsOut[index] = below;
    return;
  }

  if (isGas(current) && above == 0u) {
    cellsOut[index] = 0u;
    return;
  }

  cellsOut[index] = current;
}

fn materialAt(position: vec2u) -> u32 {
  return cellsIn[position.y * params.gridSize.x + position.x] & 255u;
}

fn isFalling(material: u32) -> bool {
  return material == 2u || material == 3u || material == 10u || material == 12u || material == 15u || material == 16u;
}

fn isGas(material: u32) -> bool {
  return material == 5u || material == 6u;
}
