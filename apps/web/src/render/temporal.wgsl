struct Uniforms { view: mat4x4f }
struct Segment { points: vec4f, ticks: vec4f }
struct Pulse { data: vec4f }
@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> segments: array<Segment>;
@group(0) @binding(2) var<storage, read> pulses: array<Pulse>;

struct TemporalOut {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
  @location(1) side: f32,
  @location(2) age: f32,
}

fn owner_color(owner: f32, age: f32) -> vec3f {
  let recent = select(vec3f(1.0, 0.28, 0.65), vec3f(0.05, 0.78, 1.0), owner < 1.5);
  let old = select(vec3f(0.34, 0.05, 0.20), vec3f(0.02, 0.20, 0.34), owner < 1.5);
  return mix(recent, old, clamp(age / 600.0, 0.0, 1.0));
}

@vertex fn segment_vs(@builtin(vertex_index) vertex: u32, @builtin(instance_index) instance: u32) -> TemporalOut {
  let record = segments[instance];
  let corners = array<vec2f, 6>(
    vec2f(0.0, -1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0),
    vec2f(0.0, -1.0), vec2f(1.0, 1.0), vec2f(0.0, 1.0),
  );
  let corner = corners[vertex];
  let start = record.points.xy;
  let canonical_end = record.points.zw;
  let delta = canonical_end - start;
  let distance = length(delta);
  let direction = select(vec2f(1.0, 0.0), delta / max(distance, 0.001), distance > 0.001);
  let end = select(start + direction * 20.0, canonical_end, distance > 0.001);
  let normal = vec2f(-direction.y, direction.x);
  let age = mix(record.ticks.x, record.ticks.y, corner.x);
  let freshness = 1.0 - clamp(age / 600.0, 0.0, 1.0);
  let half_width = mix(35.0, 105.0, freshness);
  let world = mix(start, end, corner.x) + normal * corner.y * half_width;
  var out: TemporalOut;
  out.position = uniforms.view * vec4f(world.x, 80.0, world.y, 1.0);
  out.color = vec4f(owner_color(record.ticks.z, age), mix(0.28, 0.72, freshness));
  out.side = corner.y;
  out.age = age;
  return out;
}

@fragment fn segment_fs(input: TemporalOut) -> @location(0) vec4f {
  let edge = 1.0 - smoothstep(0.60, 1.0, abs(input.side));
  let knot_distance = min(fract(input.age / 60.0), 1.0 - fract(input.age / 60.0));
  let knot = 1.0 - smoothstep(0.0, 0.055, knot_distance);
  return vec4f(input.color.rgb * mix(1.0, 1.7, knot), input.color.a * edge);
}

@vertex fn pulse_vs(@builtin(vertex_index) vertex: u32, @builtin(instance_index) instance: u32) -> TemporalOut {
  let record = pulses[instance].data;
  let segment = vertex / 6u;
  let corner = vertex % 6u;
  let ring_segments = 96.0;
  let start_angle = f32(segment) * 6.283185307 / ring_segments;
  let end_angle = f32(segment + 1u) * 6.283185307 / ring_segments;
  let end_vertex = corner == 1u || corner == 2u || corner == 4u;
  let outer_vertex = corner == 2u || corner == 4u || corner == 5u;
  let angle = select(start_angle, end_angle, end_vertex);
  let progress = clamp(record.w / 60.0, 0.0, 1.0);
  let radius = 280.0 + record.w * 18.0;
  let thickness = mix(105.0, 45.0, progress);
  let radial = radius + select(-thickness * 0.5, thickness * 0.5, outer_vertex);
  let world = record.xy + vec2f(cos(angle), sin(angle)) * radial;
  var out: TemporalOut;
  out.position = uniforms.view * vec4f(world.x, 90.0, world.y, 1.0);
  out.color = vec4f(owner_color(record.z, record.w * 10.0), (1.0 - progress) * 0.75 + 0.18);
  out.side = select(-1.0, 1.0, outer_vertex);
  out.age = record.w;
  return out;
}

@fragment fn pulse_fs(input: TemporalOut) -> @location(0) vec4f {
  let edge = 1.0 - smoothstep(0.72, 1.0, abs(input.side));
  return vec4f(input.color.rgb, input.color.a * edge);
}
