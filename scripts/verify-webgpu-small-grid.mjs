import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const movementShader = readFileSync("src/render/webgpu/combatField/combatFieldMovement.wgsl", "utf8");
const reactionShader = readFileSync("src/render/webgpu/combatField/combatFieldReaction.wgsl", "utf8");
const queryShader = readFileSync("src/render/webgpu/combatField/combatFieldEntityQuery.wgsl", "utf8");

const material = {
  air: 0,
  sand: 2,
  water: 3,
  fire: 4,
  steam: 6,
};

const server = createServer((_request, response) => {
  response.writeHead(200, { "content-type": "text/html" });
  response.end("<!doctype html><title>webgpu-small-grid</title>");
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
const port = typeof address === "object" && address ? address.port : 0;

async function launchBrowser() {
  try {
    return await chromium.launch({ channel: "msedge", headless: true });
  } catch {
    return chromium.launch({ headless: true });
  }
}

try {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${port}`);

  const movementInput = createGrid(4, 4);
  movementInput[5] = material.sand;
  const movementOutput = await page.evaluate(runGridCompute, {
    shader: movementShader,
    entryPoint: "movementMain",
    width: 4,
    height: 4,
    cells: Array.from(movementInput),
  });
  assert(movementOutput[5] === material.air && movementOutput[9] === material.sand, "movement shader should move sand down");

  const reactionInput = createGrid(4, 4);
  reactionInput[5] = material.water;
  reactionInput[6] = material.fire;
  const reactionOutput = await page.evaluate(runGridCompute, {
    shader: reactionShader,
    entryPoint: "reactionMain",
    width: 4,
    height: 4,
    cells: Array.from(reactionInput),
  });
  assert(
    reactionOutput[5] === material.steam && reactionOutput[6] === material.steam,
    "reaction shader should turn water/fire into steam",
  );

  const queryInput = createGrid(8, 8);
  queryInput[27] = material.fire;
  const queryOutput = await page.evaluate(runQueryCompute, {
    shader: queryShader,
    width: 8,
    height: 8,
    cells: Array.from(queryInput),
    hitbox: [0.5, 0.5, 0.12, 0],
  });
  assert(queryOutput[0] > 0 && queryOutput[3] > 0, "query shader should report fire coverage and damage");

  await browser.close();
  console.log("WEBGPU_SMALL_GRID_OK");
} finally {
  server.close();
}

function createGrid(width, height) {
  return new Uint32Array(width * height);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function runGridCompute({ shader, entryPoint, width, height, cells }) {
  async function createDevice() {
    if (!navigator.gpu) {
      throw new Error("WebGPU unavailable");
    }

    const adapter = await navigator.gpu.requestAdapter();

    if (!adapter) {
      throw new Error("WebGPU adapter unavailable");
    }

    return adapter.requestDevice();
  }

  const device = await createDevice();
  const module = device.createShaderModule({ code: shader });
  const pipeline = device.createComputePipeline({
    layout: "auto",
    compute: { module, entryPoint },
  });
  const paramsBuffer = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const inputBuffer = device.createBuffer({
    size: cells.length * Uint32Array.BYTES_PER_ELEMENT,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  const outputBuffer = device.createBuffer({
    size: cells.length * Uint32Array.BYTES_PER_ELEMENT,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  });
  const readbackBuffer = device.createBuffer({
    size: cells.length * Uint32Array.BYTES_PER_ELEMENT,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });
  device.queue.writeBuffer(paramsBuffer, 0, new Uint32Array([width, height, 1, 0]));
  device.queue.writeBuffer(inputBuffer, 0, new Uint32Array(cells));
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: paramsBuffer } },
      { binding: 1, resource: { buffer: inputBuffer } },
      { binding: 2, resource: { buffer: outputBuffer } },
    ],
  });
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(Math.ceil(width / 8), Math.ceil(height / 8));
  pass.end();
  encoder.copyBufferToBuffer(outputBuffer, 0, readbackBuffer, 0, cells.length * Uint32Array.BYTES_PER_ELEMENT);
  device.queue.submit([encoder.finish()]);
  await readbackBuffer.mapAsync(GPUMapMode.READ);
  return Array.from(new Uint32Array(readbackBuffer.getMappedRange()).slice(0, cells.length));
}

async function runQueryCompute({ shader, width, height, cells, hitbox }) {
  async function createDevice() {
    if (!navigator.gpu) {
      throw new Error("WebGPU unavailable");
    }

    const adapter = await navigator.gpu.requestAdapter();

    if (!adapter) {
      throw new Error("WebGPU adapter unavailable");
    }

    return adapter.requestDevice();
  }

  const device = await createDevice();
  const module = device.createShaderModule({ code: shader });
  const pipeline = device.createComputePipeline({
    layout: "auto",
    compute: { module, entryPoint: "queryMain" },
  });
  const paramsBuffer = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const inputBuffer = device.createBuffer({
    size: cells.length * Uint32Array.BYTES_PER_ELEMENT,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  const hitboxBuffer = device.createBuffer({
    size: 4 * Float32Array.BYTES_PER_ELEMENT,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  const outputBuffer = device.createBuffer({
    size: 4 * Float32Array.BYTES_PER_ELEMENT,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  });
  const readbackBuffer = device.createBuffer({
    size: 4 * Float32Array.BYTES_PER_ELEMENT,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });
  device.queue.writeBuffer(paramsBuffer, 0, new Uint32Array([width, height, 1, 0]));
  device.queue.writeBuffer(inputBuffer, 0, new Uint32Array(cells));
  device.queue.writeBuffer(hitboxBuffer, 0, new Float32Array(hitbox));
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: paramsBuffer } },
      { binding: 1, resource: { buffer: inputBuffer } },
      { binding: 2, resource: { buffer: hitboxBuffer } },
      { binding: 3, resource: { buffer: outputBuffer } },
    ],
  });
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(1);
  pass.end();
  encoder.copyBufferToBuffer(outputBuffer, 0, readbackBuffer, 0, 4 * Float32Array.BYTES_PER_ELEMENT);
  device.queue.submit([encoder.finish()]);
  await readbackBuffer.mapAsync(GPUMapMode.READ);
  return Array.from(new Float32Array(readbackBuffer.getMappedRange()).slice(0, 4));
}
