# Vertical slice state

## Status

Implementation and local container verification completed on 2026-09-22 on branch
`vertical-slice`. No default-branch merge has been performed.

## Implemented

- Frozen protobuf and semantic contract in `proto/temporal_heist.proto` and
  `docs/CONTRACT_V1.md`; prost and ts-proto consumers share that source.
- Deterministic 60 Hz Rust simulation with two players, validated intents, integer
  collision, 60-second history, one-generation 600-tick Echoes, Presence/Action/None
  effects, session lifecycle, idempotency, and current-world door authority.
- Rust authority and MoQ adapter publishing 20 Hz world snapshots and grouped bounded
  history while consuming separate per-player motion/action tracks.
- TypeScript MoQ adapter, canonical timeline ring buffer, input layer, three-zone map,
  and raw WebGPU/WGSL 2.5D renderer for live actors, Echoes, plates, doors and walls.
- Container-only Compose topology for relay, authority, web and Chromium clients with
  run-ID namespacing, private networks, seven private writable volumes, no fixed host
  ports and no `container_name`.
- Stable `container` commands and CI workflow using the same `verify` and `acceptance`
  entry points as local agents.

## Finalized commands

```sh
sh container <run-id> bootstrap
sh container <run-id> verify
sh container <run-id> acceptance
sh container <run-id> up -d relay authority web
sh container <run-id> --profile test run --rm browser
sh container <run-id> down --volumes --remove-orphans
```

## Passed verification evidence

- `sh container final-verify verify` passed from an isolated fresh namespace:
  deterministic code generation, TS→Rust→TS protobuf vectors, rustfmt, workspace
  clippy with warnings denied, 11 Rust tests, TypeScript typecheck, Biome, timeline
  tests, and Vite production build.
- Simulation tests cover closed-door collision, collision-independent historical Echo
  poses, live and Echo Presence, exact `T + 600` Action/Presence behavior, single
  Action pulse, no Echo recursion, None targets, stale epoch/session rejection,
  per-kind duplicate sequence rejection, timeouts and independent snapshot decoding.
- Integrated two-client E2E passed all three plate/door pairs at the 600-tick canonical
  offset. B crossed door 13, both clients received the same authoritative outcome,
  and both WebGPU renderers reported no transport or GPU errors.
- MoQ spike passed browser→relay→Rust and Rust→relay→browser over negotiated
  `moq-lite-05`, with two simultaneous browser publishers and retained `fetchGroup`
  after 11 seconds. Selected versions are `@moq/net` 0.3.5, `moq-net` 0.2.22,
  `moq-native` 0.19.19 and `moq-relay` 0.14.18.
- WebGPU spike and integrated E2E ran Chromium 153.0.8010.12 in the Playwright
  container. Adapter: vendor `google`, architecture `swiftshader`, fallback `true`,
  format `rgba8unorm`; primitive pixel readback and WGSL validation passed.

## Concurrent full-stack isolation evidence

`sh container iso-final-a acceptance` and `sh container iso-final-b acceptance` ran
concurrently. Each stack owned its relay, authority, web server and two Chromium
persistent contexts and ran the full three-zone scenario.

- Network A: `e285a4c990efe18e6ec61f847a4f415bc283acf1ca8bbf200348a8fbd7fca35a`
- Network B: `27c404a8b16bee885739b10a3ee3927d86d3147b7e9e1b6b2cf9ac0e79eb7c0e`
- Each project had independently prefixed `artifacts`, `cargo-git`, `cargo-registry`,
  `certificates`, `node-modules`, `npm-cache`, and `target` volumes.
- Neither stack published a host port. Rooms/epochs and browser profile/artifact paths
  used their respective run IDs.
- Removing A with `down --volumes --remove-orphans` removed only A's network and seven
  volumes. B's network ID, relay, web server and all seven volumes remained. A fresh
  `sh container iso-final-b acceptance` passed after A's deletion.

Earlier spike isolation details remain reproducible in `spikes/isolation/`.

## Known constraints and unverified items

- P0 targets current desktop Chromium. Safari, Firefox, mobile, production auth,
  persistence, matchmaking, WAN deployment and hardware-GPU performance are outside
  the accepted scope.
- Automated GPU evidence uses SwiftShader software WebGPU. Hardware passthrough has
  not been measured.
- The dev authority is room-lifetime scoped and exits after every announced input
  publisher has terminated. Compose restarts it with a fresh epoch; P0 does not keep
  a room after all clients leave.
- Automated screenshots are in each run-private Docker artifact volume. A VNC/noVNC
  interactive display is not included.

## Recommended next action

Review the feature branch and open one focused pull request. After P0, the highest
value follow-up is authority reconnect/restart hardening plus a container-owned remote
debugging or noVNC surface for interactive visual QA.
