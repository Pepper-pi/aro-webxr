// three-avbd imports 'three/webgpu' for one thing only: the buffer attribute it makes when it is given a WebGPU
// renderer to share. Here it is given a device of its own and no renderer, so that path never runs, and the whole
// of three's WebGPU build would come along for nothing. This stands in for it.
export * from 'three';
export class StorageInstancedBufferAttribute {
  constructor() { throw new Error('three-avbd was given a renderer: this build runs it on a device of its own'); }
}
