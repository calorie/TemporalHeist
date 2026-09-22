struct Uniforms { view: mat4x4f }
@group(0) @binding(0) var<uniform> uniforms: Uniforms;
struct In { @location(0) position: vec3f, @location(1) m0: vec4f, @location(2) m1: vec4f, @location(3) m2: vec4f, @location(4) m3: vec4f, @location(5) color: vec4f }
struct Out { @builtin(position) position: vec4f, @location(0) color: vec4f }
@vertex fn vs(input: In) -> Out { var out: Out; let model = mat4x4f(input.m0,input.m1,input.m2,input.m3); out.position = uniforms.view * model * vec4f(input.position,1); out.color=input.color; return out; }
@fragment fn fs(input: Out) -> @location(0) vec4f { return input.color; }
