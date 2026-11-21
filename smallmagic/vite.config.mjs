// The game's build: index.html at the top of dist, every path relative, nothing from other hosts.
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));

export default {
  root: here,
  base: './',
  publicDir: 'public',
  // three-avbd (the destruction block's physics, MIT) is vendored and imported from its source; only its world is
  // used, on a device of its own, so three's WebGPU build is stood in for (src/physics/three-webgpu-shim.js)
  resolve: { alias: [
    { find: /^three-avbd\/advanced$/, replacement: `${here}vendor/three-avbd/src/lib/advanced.ts` },
    { find: /^three-avbd$/, replacement: `${here}vendor/three-avbd/src/lib/world.ts` },
    { find: /^three\/webgpu$/, replacement: `${here}src/physics/three-webgpu-shim.js` },
  ] },
  build: {
    target: 'es2022',
    outDir: `${here}dist`,
    emptyOutDir: true,
    assetsInlineLimit: 0,
    modulePreload: { polyfill: false },
    chunkSizeWarningLimit: 8000,
    // three's notice, and any other library's, into the release
    license: { fileName: 'THIRD-PARTY-NOTICES.md' },
  },
};
