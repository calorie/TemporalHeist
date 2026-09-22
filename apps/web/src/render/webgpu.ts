import type { Facility } from '../map.ts';
import { surveillanceVisuals } from '../surveillance-view.ts';
import type { Presentation } from '../timeline.ts';
import shader from './shader.wgsl?raw';

type Instance = {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  color: [number, number, number, number];
  matrix?: number[];
};
const cube = new Float32Array([
  -1, -1, -1, 1, -1, -1, 1, 1, -1, -1, -1, -1, 1, 1, -1, -1, 1, -1, -1, -1, 1, 1, -1, 1, 1, 1, 1,
  -1, -1, 1, 1, 1, 1, -1, 1, 1, -1, -1, -1, -1, -1, 1, -1, 1, 1, -1, -1, -1, -1, 1, -1, -1, 1, 1, 1,
  -1, 1, -1, -1, -1, 1, 1, -1, 1, 1, 1, 1, -1, -1, 1, 1, 1, 1, 1, -1, 1, -1, -1, -1, -1, -1, 1, -1,
  -1, 1, 1, -1, -1, -1, -1, 1, 1, -1, 1, -1, 1, -1, 1, -1, 1, 1, 1, 1, -1, 1, -1, 1,
]);
const wedge = new Float32Array([
  0, 0, 0, -1, 0, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, -1, 1, 1, 0, 0, 0, 1, 0, 1, 1, 1, 1, 0, 0, 0, 1, 1,
  1, 0, 1, 0, 0, 0, 0, 0, 1, 0, -1, 1, 1, 0, 0, 0, -1, 1, 1, -1, 0, 1, -1, 0, 1, -1, 1, 1, 1, 1, 1,
  -1, 0, 1, 1, 1, 1, 1, 0, 1,
]);
export class WebGpuRenderer {
  #device: GPUDevice;
  #context: GPUCanvasContext;
  #format: GPUTextureFormat;
  #pipeline: GPURenderPipeline;
  #uniform: GPUBuffer;
  #instances: GPUBuffer;
  #depth?: GPUTexture;
  #size = '';
  #errors: string[] = [];
  readonly adapterInfo: GPUAdapterInfo;
  static async create(canvas: HTMLCanvasElement) {
    if (!navigator.gpu)
      throw new Error('WebGPU is unavailable. Use a current desktop Chromium with WebGPU enabled.');
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error('No WebGPU adapter is available.');
    const device = await adapter.requestDevice();
    return new WebGpuRenderer(canvas, adapter, device);
  }
  private constructor(
    readonly canvas: HTMLCanvasElement,
    adapter: GPUAdapter,
    device: GPUDevice,
  ) {
    this.#device = device;
    this.adapterInfo = adapter.info;
    device.addEventListener('uncapturederror', (event) => this.#errors.push(event.error.message));
    this.#context = canvas.getContext('webgpu') as GPUCanvasContext;
    this.#format = navigator.gpu.getPreferredCanvasFormat();
    this.#context.configure({ device, format: this.#format, alphaMode: 'opaque' });
    const module = device.createShaderModule({ code: shader });
    this.#pipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module,
        entryPoint: 'vs',
        buffers: [
          { arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] },
          {
            arrayStride: 80,
            stepMode: 'instance',
            attributes: [
              { shaderLocation: 1, offset: 0, format: 'float32x4' },
              { shaderLocation: 2, offset: 16, format: 'float32x4' },
              { shaderLocation: 3, offset: 32, format: 'float32x4' },
              { shaderLocation: 4, offset: 48, format: 'float32x4' },
              { shaderLocation: 5, offset: 64, format: 'float32x4' },
            ],
          },
        ],
      },
      fragment: {
        module,
        entryPoint: 'fs',
        targets: [
          {
            format: this.#format,
            blend: {
              color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
              alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
            },
          },
        ],
      },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' },
    });
    this.#uniform = device.createBuffer({
      size: 64,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.#instances = device.createBuffer({
      size: 80 * 256,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
  }
  render(map: Facility, p: Presentation) {
    this.#resize();
    const objects: Instance[] = [
      { x: 12000, y: -120, z: 4000, sx: 12000, sy: 100, sz: 4000, color: [0.035, 0.09, 0.12, 1] },
    ];
    for (const w of map.walls) objects.push(this.#box(w, 650, [0.12, 0.25, 0.31, 1]));
    for (const d of map.doors) {
      const open = p.snapshot?.doors.find((x) => x.id === d.id)?.active ?? false;
      objects.push(
        this.#box(d, open ? 80 : 520, open ? [0.1, 0.8, 0.55, 0.32] : [0.85, 0.3, 0.18, 1]),
      );
    }
    for (const plate of map.plates)
      objects.push({
        x: plate.x,
        y: 15,
        z: plate.z,
        sx: plate.radius,
        sy: 25,
        sz: plate.radius,
        color: p.snapshot?.plates.find((x) => x.id === plate.id)?.active
          ? [0.15, 1, 0.5, 0.9]
          : [0.12, 0.45, 0.5, 0.8],
      });
    for (const terminal of map.terminals)
      objects.push({
        x: terminal.x,
        y: 240,
        z: terminal.z,
        sx: 180,
        sy: 240,
        sz: 180,
        color: [0.8, 0.55, 0.15, 1],
      });
    const cones: Instance[] = [];
    for (const camera of surveillanceVisuals(map, p.snapshot)) {
      cones.push({
        x: camera.x,
        y: 20,
        z: camera.z,
        sx: camera.halfWidth,
        sy: 30,
        sz: camera.range,
        color: camera.coneColor,
        matrix: [
          camera.lateral[0] * camera.halfWidth,
          0,
          camera.lateral[1] * camera.halfWidth,
          0,
          0,
          30,
          0,
          0,
          camera.forward[0] * camera.range,
          0,
          camera.forward[1] * camera.range,
          0,
          camera.x,
          20,
          camera.z,
          1,
        ],
      });
      objects.push({
        x: camera.x,
        y: 380,
        z: camera.z,
        sx: 220,
        sy: 380,
        sz: 220,
        color: camera.bodyColor,
      });
    }
    for (const pose of p.live)
      objects.push({
        x: pose.xMm,
        y: 280,
        z: pose.zMm,
        sx: 220,
        sy: 280,
        sz: 220,
        color: pose.playerId === 1 ? [0.1, 0.7, 1, 1] : [1, 0.35, 0.65, 1],
      });
    for (const pose of p.echoes)
      objects.push({
        x: pose.xMm,
        y: 300,
        z: pose.zMm,
        sx: 250,
        sy: 300,
        sz: 250,
        color: pose.playerId === 1 ? [0.25, 0.85, 1, 0.35] : [1, 0.55, 0.8, 0.35],
      });
    this.#draw(cones, objects);
  }
  info() {
    return {
      backend: 'webgpu',
      adapter: {
        vendor: this.adapterInfo.vendor,
        architecture: this.adapterInfo.architecture,
        device: this.adapterInfo.device,
        description: this.adapterInfo.description,
        isFallbackAdapter: this.adapterInfo.isFallbackAdapter,
      },
      format: this.#format,
    };
  }
  errors() {
    return [...this.#errors];
  }
  #box(
    b: { minX: number; maxX: number; minZ: number; maxZ: number },
    h: number,
    color: [number, number, number, number],
  ): Instance {
    return {
      x: (b.minX + b.maxX) / 2,
      y: h / 2,
      z: (b.minZ + b.maxZ) / 2,
      sx: (b.maxX - b.minX) / 2,
      sy: h / 2,
      sz: (b.maxZ - b.minZ) / 2,
      color,
    };
  }
  #resize() {
    const scale = devicePixelRatio;
    const w = Math.max(1, Math.floor(this.canvas.clientWidth * scale)),
      h = Math.max(1, Math.floor(this.canvas.clientHeight * scale));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    const key = `${w}x${h}`;
    if (key !== this.#size) {
      this.#depth?.destroy();
      this.#depth = this.#device.createTexture({
        size: [w, h],
        format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });
      this.#size = key;
    }
  }
  #instanceData(objects: Instance[]) {
    const data = new Float32Array(objects.length * 20);
    objects.forEach((o, i) => {
      const matrix = o.matrix ?? [o.sx, 0, 0, 0, 0, o.sy, 0, 0, 0, 0, o.sz, 0, o.x, o.y, o.z, 1];
      data.set([...matrix, ...o.color], i * 20);
    });
    return data;
  }
  #draw(cones: Instance[], objects: Instance[]) {
    const depth = this.#depth;
    if (!depth) return;
    const aspect = this.canvas.width / this.canvas.height;
    const sx = 1 / 13000,
      sz = 1 / 5200;
    const view = new Float32Array([
      sx,
      0,
      0,
      0,
      0,
      0,
      1 / 2500,
      0,
      0,
      -sz * aspect,
      0,
      0,
      -12000 * sx,
      4000 * sz * aspect,
      -0.2,
      1,
    ]);
    this.#device.queue.writeBuffer(this.#uniform, 0, view);
    const cubeVertices = this.#device.createBuffer({
      size: cube.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    const wedgeVertices = this.#device.createBuffer({
      size: wedge.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    this.#device.queue.writeBuffer(cubeVertices, 0, cube);
    this.#device.queue.writeBuffer(wedgeVertices, 0, wedge);
    const coneBytes = cones.length * 80;
    if (cones.length > 0)
      this.#device.queue.writeBuffer(this.#instances, 0, this.#instanceData(cones));
    this.#device.queue.writeBuffer(this.#instances, coneBytes, this.#instanceData(objects));
    const bind = this.#device.createBindGroup({
      layout: this.#pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: this.#uniform } }],
    });
    const encoder = this.#device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: this.#context.getCurrentTexture().createView(),
          clearValue: { r: 0.015, g: 0.035, b: 0.055, a: 1 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
      depthStencilAttachment: {
        view: depth.createView(),
        depthClearValue: 1,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      },
    });
    pass.setPipeline(this.#pipeline);
    pass.setBindGroup(0, bind);
    if (cones.length > 0) {
      pass.setVertexBuffer(0, wedgeVertices);
      pass.setVertexBuffer(1, this.#instances);
      pass.draw(wedge.length / 3, cones.length);
    }
    pass.setVertexBuffer(0, cubeVertices);
    pass.setVertexBuffer(1, this.#instances, coneBytes);
    pass.draw(cube.length / 3, objects.length);
    pass.end();
    this.#device.queue.submit([encoder.finish()]);
    cubeVertices.destroy();
    wedgeVertices.destroy();
  }
}
