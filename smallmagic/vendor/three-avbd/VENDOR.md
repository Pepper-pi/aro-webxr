# three-avbd, vendored

- Source: https://github.com/sbobyn/three-avbd at commit `cd3ce901557aa9cf4f7ede489fac385971d383ea`
  (2026-10-24; the 0.4.0 release candidate). npm `three-avbd` is published up to 0.3.0, so the block pins the
  commit by carrying the copy.
- Copied: `src/lib`, `src/avbd3d`, `src/avbd2d`, `LICENSE`, `THIRD_PARTY_NOTICES.md`, `README.md`. One kernel is changed (below).
- MIT, © 2026 Steven Bobyn. Third-party parts (avbd-demo2d/3d ports, MIT © Chris Giles; box2d-lite, MIT © Erin
  Catto; three.js, MIT) are listed in `THIRD_PARTY_NOTICES.md`.
- The demo imports it through Vite aliases (`vite.config.mjs`): `three-avbd` → `src/lib/index.ts`,
  `three-avbd/advanced` → `src/lib/advanced.ts`. The build ships `LICENSE-three-avbd.txt` and
  `THIRD_PARTY_NOTICES.md` beside `index.html`.
- The demo writes weld thresholds into the solver's joint records after settling (`src/physics/structure.ts`,
  through `three-avbd/advanced`'s layout constants), and batches joint releases on a rebuild by catching the
  solver's `releaseJoints`.

## Changed

One kernel, to offer upstream:

- `src/avbd2d/gpu/wgsl-topology.ts`, `sortAdjacency`: a body's constraint list longer than 32 is heap sorted (O(n log n),
  in place, the same `adjKey` / `keyLess` order) instead of insertion sorted (O(n²)); shorter lists keep the insertion
  sort. Added `siftDown` for it. The sort runs one thread per body, and a body under a heap of rubble, the ground above
  all, can have thousands of contacts, so its insertion sort (millions of steps) holds up the whole step. The order is
  unchanged, so runs stay deterministic. (Patch's Brickfall found and fixed this first.) A list whose end comes before
  its start is left alone: that's a broken scan, and unsigned it would be a sort of billions, which hangs the GPU device.
