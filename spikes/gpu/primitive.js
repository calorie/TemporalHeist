// This spike has no gameplay state. GPU readback is test evidence only.
async function render() {
  if (!navigator.gpu) throw new Error('WebGPU is unavailable in this browser');
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error('No WebGPU adapter');
  const device = await adapter.requestDevice();
  const errors = [];
  device.addEventListener('uncapturederror', (event) => errors.push(event.error.message));
  device.pushErrorScope('validation');
  const canvas = document.querySelector('canvas');
  const context = canvas.getContext('webgpu');
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC });
  const shader = device.createShaderModule({ code: `
    @vertex fn vs(@builtin(vertex_index) index: u32) -> @builtin(position) vec4f {
      let points = array<vec2f, 3>(vec2f(-0.8, -0.8), vec2f(0.8, -0.8), vec2f(0.0, 0.8));
      return vec4f(points[index], 0.0, 1.0);
    }
    @fragment fn fs() -> @location(0) vec4f { return vec4f(0.0, 1.0, 0.0, 1.0); }
  ` });
  const compilation = await shader.getCompilationInfo();
  const shaderErrors = compilation.messages.filter((message) => message.type === 'error');
  if (shaderErrors.length) throw new Error(shaderErrors.map((message) => message.message).join('\n'));
  const pipeline = await device.createRenderPipelineAsync({
    layout: 'auto', vertex: { module: shader, entryPoint: 'vs' },
    fragment: { module: shader, entryPoint: 'fs', targets: [{ format }] },
    primitive: { topology: 'triangle-list' },
  });
  const texture = context.getCurrentTexture();
  const readback = device.createBuffer({ size: 256 * 256 * 4, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginRenderPass({ colorAttachments: [{
    view: texture.createView(), clearValue: { r: 0, g: 0, b: 0, a: 1 },
    loadOp: 'clear', storeOp: 'store',
  }] });
  pass.setPipeline(pipeline);
  pass.draw(3);
  pass.end();
  encoder.copyTextureToBuffer({ texture }, { buffer: readback, bytesPerRow: 1024 }, [256, 256]);
  device.queue.submit([encoder.finish()]);
  await readback.mapAsync(GPUMapMode.READ);
  const bytes = new Uint8Array(readback.getMappedRange());
  const pixel = (x, y) => Array.from(bytes.slice((y * 256 + x) * 4, (y * 256 + x) * 4 + 4));
  const center = pixel(128, 128);
  const corner = pixel(0, 0);
  readback.unmap();
  readback.destroy();
  const validation = await device.popErrorScope();
  if (validation) errors.push(validation.message);
  if (errors.length) throw new Error(errors.join('\n'));
  if (center.join(',') !== '0,255,0,255' || corner.join(',') !== '0,0,0,255') {
    throw new Error(`Unexpected rendered pixels: ${center}; ${corner}`);
  }
  const info = adapter.info;
  return {
    adapter: { vendor: info.vendor, architecture: info.architecture, device: info.device,
      description: info.description, isFallbackAdapter: info.isFallbackAdapter },
    format, center, corner, shaderErrors: 0, validationErrors: errors,
  };
}
window.gpuResult = render().then((result) => {
  document.querySelector('#status').textContent = JSON.stringify(result, null, 2);
  return result;
}).catch((error) => {
  document.querySelector('#status').textContent = error.message;
  throw error;
});
