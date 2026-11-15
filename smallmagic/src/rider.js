// Adapted from Moon Rider by Supermedium (MIT, Copyright © 2018).
// https://github.com/supermedium/moonrider
// src/components/beat.js (cut angle, score), beat-generator.js (anticipation),
// wall.js (when a wall is in the body). No A-Frame, no songs, no beatmaps.
//
// The MIT License
//
// Copyright © 2018 Supermedium.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

// One block for the drawn blade. Rates of 0 turn that part off.
export const TUNE = {
  holdMin: 5,
  holdMax: 7,
  travelSpeed: 4.2,
  attackRate: 1,
  orbRate: 0.12,
  orbCap: 3,
  windup: 0.38,
  window: 0.34,
  anticipation: 1.1,
  dodgeDelay: 0.14,
  hitStop: 0.08,
  shake: 0.02,
  clashIn: 0.62,
  clashOut: 0.36,
  clashGap: 1.15,
  staggerGood: 0.34,
  staggerPerfect: 0.55,
  openTime: 3.2,
  knock: 1.15,
  chopReach: 3.4,
  treeFall: 1.15,
  debrisHit: 9,
  poundWindup: 1.15,
  poundMin: 2.6,
  poundReach: 7.2,
  poundTime: 0.48,
  poundToss: 2.6,
  poundHit: 6,
  poundRocks: 6,
  rockMin: 0.85,
  rockMax: 1.25,
  rockLife: 4.2,
  rockFling: 1.7,
};

// Moon Rider beat.js. A swing within about 15° is a super cut. Past about 50° it misses.
export const ANGLE_DOT_SUPER = 0.97;
export const ANGLE_DOT_MIN = 0.625;
// Moon Rider beat-generator.js. Blocks are born this long before the beat and meet the sword 1.5m out.
export const SWORD_OFFSET = 1.5;
// Moon Rider wall.js.
export const WALL_HALF = 0.2;
export const LANE = 0.24;

const CUT = {
  up: [0, 1],
  down: [0, -1],
  left: [-1, 0],
  right: [1, 0],
};

/** Screen swipe against the arrow. +y on screen is down, so the cut's y is flipped. */
export function angleDot(dx, dy, dir) {
  const len = Math.hypot(dx, dy);
  if (len < 10) return 0;
  const cut = CUT[dir] || CUT.right;
  return ((dx / len) * cut[0] + ((-dy) / len) * cut[1]);
}

/**
 * Moon Rider's blade score is 70% direction and 30% swing speed.
 * The 30% here is how central the cut is (15) and how close it is to the beat (15).
 * The shown number rounds up to the next 10, as beat.js does.
 */
export function bladePoints(dot, center, timing, dotNote) {
  let anglePart;
  if (dotNote) anglePart = 70;
  else if (dot >= ANGLE_DOT_SUPER) anglePart = 70;
  else anglePart = Math.max(0, dot) * 70;
  const raw = anglePart + Math.max(0, center) * 15 + Math.max(0, timing) * 15;
  return Math.min(100, Math.ceil(raw / 10) * 10);
}

/** 0 at the windup's end, 1 when the block reaches the sword. */
export function flightU(song, due, flight) {
  return Math.max(0, Math.min(1, 1 - (due - song) / Math.max(flight, 0.05)));
}

/** A standing wall fills the lane. A ceiling wall misses a crouched body. */
export function wallBlocks(lateral, crouched, ceiling) {
  if (lateral > WALL_HALF) return false;
  if (ceiling && crouched) return false;
  return true;
}
