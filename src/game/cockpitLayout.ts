/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GazeZone, LookTarget } from '../types/game';

/**
 * Single source of truth for the cockpit geometry and the driver's head model.
 *
 * Coordinates are car-local metres: +x is right, +y is up and the car drives
 * toward -z. The driver sits on the LEFT (x < 0), like in a US car.
 *
 * Yaw angles are in degrees and POSITIVE TO THE LEFT (same sense as three.js
 * rotation.y), pitch is positive UP.
 *
 * This file has no three.js dependency so it can be unit tested in plain Node.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

const D2R = Math.PI / 180;

/** Default (looking down the road) vertical field of view. */
export const BASE_FOV = 62;
/** Narrower field of view while the driver focuses on a mirror. */
export const MIRROR_FOCUS_FOV = 34;
/** Wider field of view while looking over the shoulder (peripheral vision). */
export const SHOULDER_FOV = 76;

/** Pivot of the head (the neck). The head rotates about this point. */
export const NECK: Vec3 = { x: -0.4, y: 1.1, z: 0.28 };
/** Eye position relative to the neck pivot. */
export const EYE_OFFSET: Vec3 = { x: 0, y: 0.12, z: -0.13 };
/** Eye position with the head facing straight ahead. */
export const EYE_REST: Vec3 = {
  x: NECK.x + EYE_OFFSET.x,
  y: NECK.y + EYE_OFFSET.y,
  z: NECK.z + EYE_OFFSET.z,
};

/** Mirror face centres and (slightly game-friendly) sizes. */
export const MIRRORS = {
  rear: { pos: { x: 0.0, y: 1.36, z: -0.52 } as Vec3, width: 0.27, height: 0.085 },
  left: { pos: { x: -1.07, y: 1.08, z: -0.74 } as Vec3, width: 0.24, height: 0.15 },
  // The passenger mirror is far from the driver, so it is drawn a bit larger.
  right: { pos: { x: 1.07, y: 1.08, z: -0.74 } as Vec3, width: 0.3, height: 0.18 },
} as const;

/**
 * Real mirrors are deliberately limited: the side mirrors look back and a
 * little outward, which leaves a blind spot alongside the rear doors.
 */
export const MIRROR_CAMERAS = {
  rear: { fovY: 15, aspect: MIRRORS.rear.width / MIRRORS.rear.height, yawOutDeg: 0, pitchDeg: -2.5 },
  left: { fovY: 26, aspect: MIRRORS.left.width / MIRRORS.left.height, yawOutDeg: 11, pitchDeg: -1 },
  right: { fovY: 26, aspect: MIRRORS.right.width / MIRRORS.right.height, yawOutDeg: 11, pitchDeg: -1 },
} as const;

/** Windshield glass plane (side profile). */
export const WINDSHIELD = {
  baseZ: -1.12,
  baseY: 0.99,
  topZ: -0.45,
  topY: 1.5,
  /** Half width at the base / top of the glass. */
  baseHalfW: 0.8,
  topHalfW: 0.72,
} as const;

/** Instrument cluster pod (tilted toward the driver's eyes). */
export const CLUSTER = {
  center: { x: -0.4, y: 1.04, z: -0.62 } as Vec3,
  tiltX: -0.25, // radians; negative tilts the face up toward the eyes
  width: 0.46,
  height: 0.1725,
} as const;

/** Steering wheel. */
export const WHEEL = {
  center: { x: -0.4, y: 0.86, z: -0.28 } as Vec3,
  radius: 0.185,
  tiltX: -0.35,
} as const;

// ---------------------------------------------------------------------------
// Head model
// ---------------------------------------------------------------------------

/** Eye position for a given head pose (yaw about the neck, then pitch). */
export function headEyePosition(yawDeg: number, pitchDeg: number, leanX = 0, leanZ = 0): Vec3 {
  const yaw = yawDeg * D2R;
  const p = pitchDeg * D2R;
  // Pitch (rotation about the local x axis) applied to the eye offset.
  const oy = EYE_OFFSET.y * Math.cos(p) - EYE_OFFSET.z * Math.sin(p);
  const oz = EYE_OFFSET.y * Math.sin(p) + EYE_OFFSET.z * Math.cos(p);
  const ox = EYE_OFFSET.x;
  // Yaw (rotation about the vertical axis).
  const x = ox * Math.cos(yaw) + oz * Math.sin(yaw);
  const z = -ox * Math.sin(yaw) + oz * Math.cos(yaw);
  return { x: NECK.x + x + leanX, y: NECK.y + oy, z: NECK.z + z + leanZ };
}

/** Unit vector the eye is looking along for a given head pose. */
export function headForward(yawDeg: number, pitchDeg: number): Vec3 {
  const yaw = yawDeg * D2R;
  const p = pitchDeg * D2R;
  return {
    x: -Math.cos(p) * Math.sin(yaw),
    y: Math.sin(p),
    z: -Math.cos(p) * Math.cos(yaw),
  };
}

/** Solve the head yaw/pitch that centres a point of interest in the view. */
export function solveLookToward(target: Vec3): { yaw: number; pitch: number } {
  let yaw = 0;
  let pitch = 0;
  for (let i = 0; i < 16; i++) {
    const e = headEyePosition(yaw, pitch);
    const dx = target.x - e.x;
    const dy = target.y - e.y;
    const dz = target.z - e.z;
    yaw = Math.atan2(-dx, -dz) / D2R;
    pitch = Math.atan2(dy, Math.hypot(dx, dz)) / D2R;
  }
  return { yaw, pitch };
}

export interface LookPose {
  yaw: number;
  pitch: number;
  fov: number;
  /** Body lean in metres (x: toward the right, z: toward the rear). */
  leanX: number;
  leanZ: number;
}

export function buildLookPresets(): Record<LookTarget, LookPose> {
  const left = solveLookToward(MIRRORS.left.pos);
  const rear = solveLookToward(MIRRORS.rear.pos);
  const right = solveLookToward(MIRRORS.right.pos);
  return {
    forward: { yaw: 0, pitch: 0, fov: BASE_FOV, leanX: 0, leanZ: 0 },
    mirror_left: { yaw: left.yaw, pitch: left.pitch, fov: MIRROR_FOCUS_FOV, leanX: -0.015, leanZ: 0 },
    mirror_rear: { yaw: rear.yaw, pitch: rear.pitch, fov: MIRROR_FOCUS_FOV, leanX: 0.01, leanZ: 0 },
    mirror_right: { yaw: right.yaw, pitch: right.pitch, fov: MIRROR_FOCUS_FOV + 4, leanX: 0.03, leanZ: 0 },
    // Over-the-shoulder blind-spot checks: big head turn plus a little torso twist.
    shoulder_left: { yaw: 104, pitch: -3, fov: SHOULDER_FOV, leanX: -0.07, leanZ: 0.05 },
    shoulder_right: { yaw: -112, pitch: -3, fov: SHOULDER_FOV, leanX: 0.05, leanZ: 0.05 },
  };
}

export const LOOK_PRESETS: Record<LookTarget, LookPose> = buildLookPresets();

// ---------------------------------------------------------------------------
// Gaze classification
// ---------------------------------------------------------------------------

const MIRROR_YAW_TOL = 13;
const MIRROR_PITCH_TOL = 17;
/** Yaw beyond which a head turn is a true over-the-shoulder check. */
export const SHOULDER_YAW = 72;

/** What is the driver looking at, given their head orientation? */
export function classifyGaze(yawDeg: number, pitchDeg: number): GazeZone {
  if (yawDeg >= SHOULDER_YAW) return 'shoulder_left';
  if (yawDeg <= -SHOULDER_YAW) return 'shoulder_right';

  const near = (t: LookTarget) =>
    Math.abs(yawDeg - LOOK_PRESETS[t].yaw) <= MIRROR_YAW_TOL &&
    Math.abs(pitchDeg - LOOK_PRESETS[t].pitch) <= MIRROR_PITCH_TOL;
  if (near('mirror_left')) return 'mirror_left';
  if (near('mirror_rear')) return 'mirror_rear';
  if (near('mirror_right')) return 'mirror_right';

  if (Math.abs(yawDeg) <= 24 && pitchDeg >= -27) return 'road';
  return 'other';
}

/** True if the driver's eyes are not on the road ahead. */
export function isEyesOffRoad(yawDeg: number, pitchDeg: number): boolean {
  return Math.abs(yawDeg) > 24 || pitchDeg < -27;
}
