# Containerized raw WebGPU spike

Run from this checkout using an agent/run ID unique to this checkout:

```sh
sh container gpu-0922b build dev
sh container gpu-0922b run --rm dev npm ci
sh container gpu-0922b run --rm dev node spikes/gpu/test.mjs
```

The test starts Vite on an ephemeral container-loopback port, launches the full
containerized Chromium in headless mode, compiles raw WGSL, renders a green
triangle into a WebGPU canvas, and reads back its actual pixels. It asserts a
green center and black corner, zero WGSL compilation errors, and zero WebGPU
validation errors. No host port or host browser is used.

Evidence and screenshot are written to the Compose project's private artifacts
volume at `/artifacts/gpu-AGENT_RUN_ID/{evidence.json,primitive.png}`. The persistent
browser profile is also private to this path. Stop and delete this stack with:

```sh
sh container gpu-0922b down --volumes --remove-orphans
```

Verified on 2026-09-22 with Chromium 153.0.8010.12 in the pinned Playwright 1.63.0
container image: adapter vendor `google`, architecture `swiftshader`, fallback
adapter `true`, canvas format `rgba8unorm`, center `[0,255,0,255]`, corner
`[0,0,0,255]`. This is software GPU verification, with no performance claim.

Both ANGLE and Vulkan must be explicitly configured for this image. Using only
`--use-angle=swiftshader` produced a swapchain SharedImage failure. The working
configuration is encoded in `test.mjs`: ANGLE Vulkan + SwiftShader Vulkan with
Vulkan features enabled and native Vulkan surfaces disabled.

This proves the renderer prerequisite only. It does not verify gameplay,
network transport, two-client agreement, or two-full-stack isolation.
