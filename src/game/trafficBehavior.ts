/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TrafficVehicle } from '../types/game';

/**
 * Scripted traffic used to teach defensive driving. These behaviors only
 * change a vehicle's speed / target lane / state; the engine moves vehicles.
 * Pure logic (no three.js) so it can be unit tested.
 *
 * Longitudinal convention: d = vehicle.z - playerZ.  d > 0 means the vehicle is
 * BEHIND the player (the player drives toward -z).
 */

export interface BehaviorContext {
  playerX: number;
  playerZ: number;
  playerSpeedMph: number;
  playerHalfWidth: number;
  playerHalfLength: number;
  laneCenters: readonly number[];
  honk: (v: TrafficVehicle) => void;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function nearestLaneCenter(x: number, lanes: readonly number[]): number {
  let best = lanes[0];
  for (const c of lanes) if (Math.abs(c - x) < Math.abs(best - x)) best = c;
  return best;
}

/** Bumper-to-bumper gap (metres) between the player and a vehicle behind them. */
export function gapBehindPlayer(v: TrafficVehicle, c: BehaviorContext): number {
  return v.z - v.length / 2 - (c.playerZ + c.playerHalfLength);
}

export const LURKER_HOLD_MIN_SEC = 7;
export const LURKER_HOLD_EXTRA_SEC = 3;

export function beginLurker(v: TrafficVehicle) {
  v.behavior = 'lurker_approach';
  v.behaviorTimer = 0;
}

export function stepBehavior(v: TrafficVehicle, c: BehaviorContext, dt: number): void {
  const behavior = v.behavior ?? 'normal';
  if (behavior === 'normal') return;

  const d = v.z - c.playerZ;
  const alongsideReach = v.length / 2 + c.playerHalfLength + 1.0;

  if (v.honkTimer && v.honkTimer > 0) v.honkTimer = Math.max(0, v.honkTimer - dt);

  switch (behavior) {
    case 'lurker_approach': {
      if (d > 4.5) {
        // Close in quickly, but never absurdly fast.
        v.speed = c.playerSpeedMph + clamp(0.6 * (d - 3), 5, 14);
      } else {
        v.behavior = 'lurker_hold';
        v.behaviorTimer = LURKER_HOLD_MIN_SEC + Math.random() * LURKER_HOLD_EXTRA_SEC;
      }
      break;
    }

    case 'lurker_hold': {
      // Sit just behind the driver's door, exactly where mirrors can't see.
      v.speed = Math.max(0, c.playerSpeedMph + clamp(0.8 * (d - 2.0), -8, 8));
      v.behaviorTimer = (v.behaviorTimer ?? 0) - dt;
      if ((v.behaviorTimer ?? 0) <= 0) {
        v.behavior = 'lurker_leave';
        v.behaviorTimer = 0;
      }
      break;
    }

    case 'lurker_leave': {
      v.speed = c.playerSpeedMph + 12;
      if (d < -45) {
        v.behavior = 'normal';
        v.speed = v.baseSpeed;
      }
      break;
    }

    case 'lurker_evade': {
      // Emergency braking to get out of the way of a driver who just moved over.
      v.speed = Math.max(8, c.playerSpeedMph - 24);
      v.behaviorTimer = (v.behaviorTimer ?? 0) - dt;
      if ((v.behaviorTimer ?? 0) <= 0) {
        v.behavior = 'normal';
        v.speed = v.baseSpeed;
      }
      break;
    }

    case 'tailgater': {
      v.targetLane = nearestLaneCenter(c.playerX, c.laneCenters);
      const gap = gapBehindPlayer(v, c);
      let speed = c.playerSpeedMph + clamp(1.2 * (gap - 4), -25, 12);
      // Aggressive but never an actual rear-end collision by itself.
      if (gap < 2) speed = Math.min(speed, c.playerSpeedMph - 4);
      if (gap < 0.8) speed = Math.min(speed, c.playerSpeedMph - 12);
      v.speed = Math.max(0, speed);
      // Lean on the horn every few seconds.
      v.behaviorTimer = (v.behaviorTimer ?? 0) + dt;
      if ((v.behaviorTimer ?? 0) > 3.5) {
        v.behaviorTimer = 0;
        v.honkTimer = 0.45;
        c.honk(v);
      }
      break;
    }

    case 'passer': {
      v.speed = c.playerSpeedMph + 16;
      if (d < -35) {
        v.behavior = 'normal';
        v.speed = v.baseSpeed;
      }
      break;
    }
  }

  // Lurkers back off immediately if the player drifts into their lane.
  if (behavior === 'lurker_approach' || behavior === 'lurker_hold' || behavior === 'lurker_leave') {
    const edgeGap = Math.abs(v.x - c.playerX) - (c.playerHalfWidth + v.width / 2);
    if (Math.abs(d) < alongsideReach + 1.5 && edgeGap < 1.1) {
      v.behavior = 'lurker_evade';
      v.behaviorTimer = 1.3;
      v.honkTimer = 0.6;
      c.honk(v);
    }
  }
}

/** Per-frame lateral movement toward a vehicle's target lane. */
export function stepLateral(v: TrafficVehicle, dt: number) {
  const dx = v.targetLane - v.x;
  if (Math.abs(dx) < 0.001) return;
  const maxStep = 3.0 * dt;
  v.x += clamp(dx, -maxStep, maxStep);
}

/**
 * Decide how a tailgating vehicle leaves once the player has made their
 * decision. Returns false if no adjacent lane was free (it then drops back).
 */
export function releaseTailgater(
  v: TrafficVehicle,
  c: BehaviorContext,
  others: readonly TrafficVehicle[]
): boolean {
  const lanes = c.laneCenters;
  const cur = lanes.indexOf(nearestLaneCenter(v.x, lanes));
  const options = [cur - 1, cur + 1].filter((i) => i >= 0 && i < lanes.length);
  // Prefer the lane away from the player's own lane choice, then any free lane.
  for (const i of options) {
    const lane = lanes[i];
    const blocked = others.some((o) => o !== v && Math.abs(o.x - lane) < 2.5 && Math.abs(o.z - v.z) < 14);
    if (!blocked) {
      v.targetLane = lane;
      v.behavior = 'passer';
      v.honkTimer = 0.6;
      c.honk(v);
      return true;
    }
  }
  v.behavior = 'normal';
  v.speed = Math.max(10, v.baseSpeed - 10);
  return false;
}
