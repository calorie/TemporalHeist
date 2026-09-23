struct Uniforms { view: mat4x4f }
@group(0) @binding(0) var<uniform> uniforms: Uniforms;
struct In { @location(0) position: vec3f, @location(1) m0: vec4f, @location(2) m1: vec4f, @location(3) m2: vec4f, @location(4) m3: vec4f, @location(5) color: vec4f, @location(6) radialRange: f32 }
struct Out { @builtin(position) position: vec4f, @location(0) color: vec4f, @location(1) delta: vec2f, @location(2) @interpolate(flat) radialRange: f32 }
@vertex fn vs(input: In) -> Out {
  var out: Out;
  let model = mat4x4f(input.m0,input.m1,input.m2,input.m3);
  let world = model * vec4f(input.position,1);
  out.position = uniforms.view * world;
  out.color = input.color;
  out.delta = world.xz - input.m3.xz;
  out.radialRange = input.radialRange;
  return out;
}
@fragment fn fs(input: Out) -> @location(0) vec4f {
  if (input.radialRange > 0 && dot(input.delta, input.delta) > input.radialRange * input.radialRange) { discard; }
  return input.color;
}
