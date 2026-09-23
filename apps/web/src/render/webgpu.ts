import type { Facility } from '../map.ts';
import { objectivePrimitives } from '../objective-view.ts';
import {
  extractionVisual,
  sceneClearColor,
  WORLD_CENTER_X,
  WORLD_CENTER_Z,
  WORLD_HALF_DEPTH,
  WORLD_HALF_WIDTH,
} from '../presentation-view.ts';
import {
  surveillanceVisuals,
  WORLD_DEPTH_OFFSET,
  WORLD_DEPTH_SCALE,
} from '../surveillance-view.ts';
import type { Presentation } from '../timeline.ts';
import { guardPrimitives } from './guard-geometry.ts';
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
  radialRange?: number;
};
type PixelProbe = {
  x: number;
  y: number;
  resolve: (rgba: number[]) => void;
  reject: (error: unknown) => void;
};
const cube = new Float32Array([
  -1, -1, -1, 1, -1, -1, 1, 1, -1, -1, -1, -1, 1, 1, -1, -1, 1, -1, -1, -1, 1, 1, -1, 1, 1, 1, 1,
  -1, -1, 1, 1, 1, 1, -1, 1, 1, -1, -1, -1, -1, -1, 1, -1, 1, 1, -1, -1, -1, -1, 1, -1, -1, 1, 1, 1,
  -1, -1, 1, 1, -1, 1, 1, 1, 1, -1, -1, 1, 1, 1, 1, -1, 1, -1, -1, -1, 1, -1, -1, 1, -1, 1, -1, -1,
  -1, 1, -1, 1, -1, -1, 1, -1, 1, -1, -1, 1, 1, 1, 1, 1, -1, 1, -1, 1, 1, 1, 1, 1, -1,
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
  #cubeVertices: GPUBuffer;
  #wedgeVertices: GPUBuffer;
  #depth?: GPUTexture;
  #size = '';
  #errors: string[] = [];
  #pixelProbe?: PixelProbe;
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
    this.#context.configure({
      device,
      format: this.#format,
      alphaMode: 'opaque',
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
    });
    const module = device.createShaderModule({ code: shader });
    this.#pipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module,
        entryPoint: 'vs',
        buffers: [
          { arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] },
          {
            arrayStride: 84,
            stepMode: 'instance',
            attributes: [
              { shaderLocation: 1, offset: 0, format: 'float32x4' },
              { shaderLocation: 2, offset: 16, format: 'float32x4' },
              { shaderLocation: 3, offset: 32, format: 'float32x4' },
              { shaderLocation: 4, offset: 48, format: 'float32x4' },
              { shaderLocation: 5, offset: 64, format: 'float32x4' },
              { shaderLocation: 6, offset: 80, format: 'float32' },
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
      size: 84 * 256,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    this.#cubeVertices = device.createBuffer({
      size: cube.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    this.#wedgeVertices = device.createBuffer({
      size: wedge.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(this.#cubeVertices, 0, cube);
    device.queue.writeBuffer(this.#wedgeVertices, 0, wedge);
  }
  render(map: Facility, p: Presentation) {
    this.#resize();
    const objects: Instance[] = [
      { x: 12000, y: -120, z: 4000, sx: 12000, sy: 100, sz: 4000, color: [0.035, 0.09, 0.12, 1] },
      extractionVisual(map, p.snapshot),
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
    objects.push(...objectivePrimitives(map, p));
    const cones: Instance[] = [];
    for (const camera of surveillanceVisuals(map, p.snapshot)) {
      cones.push({
        x: camera.x,
        y: camera.coneY,
        z: camera.z,
        sx: camera.halfWidth,
        sy: camera.coneHalfHeight,
        sz: camera.range,
        color: camera.coneColor,
        matrix: [
          camera.lateral[0] * camera.halfWidth,
          0,
          camera.lateral[1] * camera.halfWidth,
          0,
          0,
          camera.coneHalfHeight,
          0,
          0,
          camera.forward[0] * camera.range,
          0,
          camera.forward[1] * camera.range,
          0,
          camera.x,
          camera.coneY,
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
    const guards = guardPrimitives(map, p);
    cones.push(...guards.cones);
    objects.push(...guards.objects);
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
    this.#draw(cones, objects, sceneClearColor(p.snapshot));
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
  samplePixel(x: number, y: number): Promise<number[]> {
    if (this.#pixelProbe)
      return Promise.reject(new Error('A renderer pixel probe is already pending'));
    return new Promise((resolve, reject) => {
      this.#pixelProbe = { x, y, resolve, reject };
    });
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
    const data = new Float32Array(objects.length * 21);
    objects.forEach((o, i) => {
      const matrix = o.matrix ?? [o.sx, 0, 0, 0, 0, o.sy, 0, 0, 0, 0, o.sz, 0, o.x, o.y, o.z, 1];
      data.set([...matrix, ...o.color, o.radialRange ?? 0], i * 21);
    });
    return data;
  }
  #draw(cones: Instance[], objects: Instance[], clearColor: [number, number, number, number]) {
    if (cones.length + objects.length > 256)
      throw new Error('Scene exceeds the persistent WebGPU instance buffer');
    const depth = this.#depth;
    if (!depth) return;
    const aspect = this.canvas.width / this.canvas.height;
    const sx = 1 / WORLD_HALF_WIDTH,
      sz = 1 / WORLD_HALF_DEPTH;
    const view = new Float32Array([
      sx,
      0,
      0,
      0,
      0,
      0,
      WORLD_DEPTH_SCALE,
      0,
      0,
      -sz * aspect,
      0,
      0,
      -WORLD_CENTER_X * sx,
      WORLD_CENTER_Z * sz * aspect,
      WORLD_DEPTH_OFFSET,
      1,
    ]);
    this.#device.queue.writeBuffer(this.#uniform, 0, view);
    const coneBytes = cones.length * 84;
    if (cones.length > 0)
      this.#device.queue.writeBuffer(this.#instances, 0, this.#instanceData(cones));
    this.#device.queue.writeBuffer(this.#instances, coneBytes, this.#instanceData(objects));
    const bind = this.#device.createBindGroup({
      layout: this.#pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: this.#uniform } }],
    });
    const encoder = this.#device.createCommandEncoder();
    const surface = this.#context.getCurrentTexture();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: surface.createView(),
          clearValue: {
            r: clearColor[0],
            g: clearColor[1],
            b: clearColor[2],
            a: clearColor[3],
          },
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
      pass.setVertexBuffer(0, this.#wedgeVertices);
      pass.setVertexBuffer(1, this.#instances);
      pass.draw(wedge.length / 3, cones.length);
    }
    pass.setVertexBuffer(0, this.#cubeVertices);
    pass.setVertexBuffer(1, this.#instances, coneBytes);
    pass.draw(cube.length / 3, objects.length);
    pass.end();
    const probe = this.#pixelProbe;
    let readback: GPUBuffer | undefined;
    if (probe) {
      this.#pixelProbe = undefined;
      readback = this.#device.createBuffer({
        size: 256,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
      });
      encoder.copyTextureToBuffer(
        {
          texture: surface,
          origin: {
            x: Math.max(0, Math.min(this.canvas.width - 1, Math.round(probe.x))),
            y: Math.max(0, Math.min(this.canvas.height - 1, Math.round(probe.y))),
          },
        },
        { buffer: readback, bytesPerRow: 256 },
        [1, 1],
      );
    }
    this.#device.queue.submit([encoder.finish()]);
    if (probe && readback) {
      void readback
        .mapAsync(GPUMapMode.READ)
        .then(() => probe.resolve(Array.from(new Uint8Array(readback.getMappedRange(), 0, 4))))
        .catch(probe.reject)
        .finally(() => {
          readback.unmap();
          readback.destroy();
        });
    }
  }
}
