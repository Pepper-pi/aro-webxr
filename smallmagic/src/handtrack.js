// Optional camera hands. The library and its model are loaded from the network only after Hands mode is turned on.
// @mediapipe/tasks-vision is Apache-2.0. Nothing from it is stored in this repo.
// If the camera is refused, or the files cannot be fetched, the drawn arms stay as they are.
let started = false;
export const tracked = { u: 0.5, v: 0.7, on: false };

export async function startHandTrack(onHands) {
  if (started) return;
  started = true;
  try {
    const vision = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/+esm');
    const files = await vision.FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm');
    const landmarker = await vision.HandLandmarker.createFromOptions(files, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
        delegate: 'CPU',
      },
      runningMode: 'VIDEO',
      numHands: 2,
    });
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 320, height: 240 } });
    const video = document.createElement('video');
    video.playsInline = true;
    video.muted = true;
    video.srcObject = stream;
    await video.play();
    const loop = () => {
      if (video.readyState >= 2) {
        try {
          const res = landmarker.detectForVideo(video, performance.now());
          const hand = res?.landmarks?.[0];
          if (hand?.[0]) {
            tracked.u = hand[0].x;
            tracked.v = hand[0].y;
            tracked.on = true;
            onHands(res.landmarks);
          } else tracked.on = false;
        } catch { /* a bad frame is skipped */ }
      }
      requestAnimationFrame(loop);
    };
    loop();
  } catch (e) {
    console.warn('hand tracking unavailable', e);
  }
}
