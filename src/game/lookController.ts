/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { LookTarget } from '../types/game';
import { BASE_FOV, LOOK_PRESETS, LookPose } from './cockpitLayout';

const MAX_YAW = 118;
const MAX_PITCH_UP = 30;
const MAX_PITCH_DOWN = -42;

/** Pointer-drag sensitivity in degrees per pixel. */
const DRAG_YAW_PER_PX = 0.22;
const DRAG_PITCH_PER_PX = 0.18;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Smoothly moves the driver's head toward whatever they are looking at.
 *
 * Sources of look input (they can be combined):
 *  - held look targets (keys / on-screen buttons): mirrors and shoulder checks
 *  - free look: pointer / touch dragging; springs back to centre on release
 *
 * Pure logic (no three.js) so it can be unit tested.
 */
export class LookController {
  yaw = 0;
  pitch = 0;
  fov = BASE_FOV;
  leanX = 0;
  leanZ = 0;

  /** When false the head is locked facing forward (e.g. hood camera). */
  enabled = true;

  private held: LookTarget[] = [];
  private freeYaw = 0;
  private freePitch = 0;
  private dragging = false;

  private readonly presets: Record<LookTarget, LookPose>;

  constructor(presets: Record<LookTarget, LookPose> = LOOK_PRESETS) {
    this.presets = presets;
  }

  /** The most recently pressed look target that is still held. */
  get activeTarget(): LookTarget {
    return this.held.length ? this.held[this.held.length - 1] : 'forward';
  }

  get isDragging(): boolean {
    return this.dragging;
  }

  press(target: LookTarget) {
    if (target === 'forward') return;
    this.held = this.held.filter((t) => t !== target);
    this.held.push(target);
  }

  release(target: LookTarget) {
    this.held = this.held.filter((t) => t !== target);
  }

  clear() {
    this.held = [];
    this.dragging = false;
  }

  beginDrag() {
    this.dragging = true;
  }

  /** Dragging right looks right; dragging down looks down. */
  dragBy(dxPx: number, dyPx: number) {
    if (!this.dragging) return;
    this.freeYaw = clamp(this.freeYaw - dxPx * DRAG_YAW_PER_PX, -MAX_YAW, MAX_YAW);
    this.freePitch = clamp(this.freePitch - dyPx * DRAG_PITCH_PER_PX, MAX_PITCH_DOWN, MAX_PITCH_UP);
  }

  endDrag() {
    this.dragging = false;
  }

  /** Reset instantly (new drive, crash, etc.). */
  reset() {
    this.clear();
    this.freeYaw = 0;
    this.freePitch = 0;
    this.yaw = 0;
    this.pitch = 0;
    this.fov = BASE_FOV;
    this.leanX = 0;
    this.leanZ = 0;
  }

  update(dt: number) {
    const preset = this.enabled ? this.presets[this.activeTarget] : this.presets.forward;

    if (!this.enabled) {
      this.freeYaw = 0;
      this.freePitch = 0;
    } else if (!this.dragging) {
      // Free-look springs back to centre once released.
      const decay = Math.exp(-7 * dt);
      this.freeYaw *= decay;
      this.freePitch *= decay;
      if (Math.abs(this.freeYaw) < 0.05) this.freeYaw = 0;
      if (Math.abs(this.freePitch) < 0.05) this.freePitch = 0;
    }

    const targetYaw = clamp(preset.yaw + this.freeYaw, -MAX_YAW, MAX_YAW);
    const targetPitch = clamp(preset.pitch + this.freePitch, MAX_PITCH_DOWN, MAX_PITCH_UP);

    const engaged = this.held.length > 0 || this.dragging;
    // Turn briskly toward something, relax a little slower on the way back.
    const k = engaged ? 16 : 9;
    const a = 1 - Math.exp(-k * dt);

    this.yaw += (targetYaw - this.yaw) * a;
    this.pitch += (targetPitch - this.pitch) * a;
    this.fov += (preset.fov - this.fov) * (1 - Math.exp(-10 * dt));
    this.leanX += (preset.leanX - this.leanX) * a;
    this.leanZ += (preset.leanZ - this.leanZ) * a;
  }
}
