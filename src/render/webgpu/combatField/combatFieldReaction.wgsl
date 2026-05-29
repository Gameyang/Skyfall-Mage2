struct SimParams {
  gridSize: vec2u,
  frame: u32,
  _pad0: u32,
};

@group(0) @binding(0) var<uniform> params: SimParams;
@group(0) @binding(1) var<storage, read> cellsIn: array<u32>;
@group(0) @binding(2) var<storage, read_write> cellsOut: array<u32>;

@compute @workgroup_size(8, 8)
fn reactionMain(@builtin(global_invocation_id) id: vec3u) {
  if (id.x >= params.gridSize.x || id.y >= params.gridSize.y) {
    return;
  }

  let index = id.y * params.gridSize.x + id.x;
  let current = materialAt(id.xy);
  let neighbor = reactiveNeighbor(id.xy);

  if ((current == 3u && isFire(neighbor)) || (isFire(current) && neighbor == 3u)) {
    cellsOut[index] = 6u;
    return;
  }

  if (current == 10u && neighbor == 3u) {
    cellsOut[index] = 11u;
    return;
  }

  if (current == 3u && neighbor == 10u) {
    cellsOut[index] = 6u;
    return;
  }

  if ((current == 15u && neighbor == 3u) || (current == 3u && neighbor == 15u)) {
    cellsOut[index] = 3u;
    return;
  }

  if (current == 13u && neighbor == 12u) {
    cellsOut[index] = 5u;
    return;
  }

  if (current == 14u && isFire(neighbor)) {
    cellsOut[index] = 4u;
    return;
  }

  cellsOut[index] = current;
}

fn materialAt(position: vec2u) -> u32 {
  return cellsIn[position.y * params.gridSize.x + position.x] & 255u;
}

fn reactiveNeighbor(position: vec2u) -> u32 {
  if (position.x > 0u) {
    let left = materialAt(vec2u(position.x - 1u, position.y));
    if (left != 0u) {
      return left;
    }
  }
  if (position.x + 1u < params.gridSize.x) {
    let right = materialAt(vec2u(position.x + 1u, position.y));
    if (right != 0u) {
      return right;
    }
  }
  if (position.y > 0u) {
    let up = materialAt(vec2u(position.x, position.y - 1u));
    if (up != 0u) {
      return up;
    }
  }
  if (position.y + 1u < params.gridSize.y) {
    return materialAt(vec2u(position.x, position.y + 1u));
  }
  return 0u;
}

fn isFire(material: u32) -> bool {
  return material == 4u || material == 7u || material == 10u;
}
