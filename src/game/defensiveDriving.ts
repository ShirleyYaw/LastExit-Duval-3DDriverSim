/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  DriverAwarenessSnapshot,
  DrivingFeedback,
  GazeZone,
  TrafficVehicle,
} from '../types/game';
import { classifyGaze, isEyesOffRoad } from './cockpitLayout';

/**
 * Watches what the driver actually DOES (where they look, whether they signal,
 * how close they follow, whether they check before moving over) and turns it
 * into defensive-driving feedback and score changes.
 *
 * It only needs plain numbers, so it has no three.js dependency and can be
 * unit tested in Node.
 */

export type MonitorVehicle = Pick<TrafficVehicle, 'id' | 'x' | 'z' | 'length' | 'width' | 'speed'>;

export interface MonitorInput {
  dt: number;
  speedMph: number;
  playerX: number;
  playerZ: number;
  signal: 'off' | 'left' | 'right';
  hazards: boolean;
  gazeYaw: number;
  gazePitch: number;
  vehicles: readonly MonitorVehicle[];
}

export type FeedbackEmit = (fb: Omit<DrivingFeedback, 'id'>) => void;

export interface MonitorConfig {
  laneCenters: number[];
  /** Half the player's car length (metres). */
  playerHalfLength: number;
  emit: FeedbackEmit;
}

type Side = 'left' | 'right';

type LaneRisk = 'blind_spot' | 'closing_fast' | 'tight_gap';

interface LaneChangeIntent {
  dir: -1 | 1;
  fromIdx: number;
  t0: number;
  signalOk: boolean;
  mirrorOk: boolean;
  shoulderOk: boolean;
  risk: LaneRisk | null;
}

// Tunables -------------------------------------------------------------------
const MPH_TO_MPS = 0.447;
/** Mirrors should be scanned every 5-8 seconds. */
const SCAN_NUDGE_SEC = 10;
const SCAN_PENALTY_SEC = 20;
/** Eyes must not leave the road for more than ~2 seconds at a time. */
const EYES_WARN_SEC = 2.0;
const EYES_PENALTY_SEC = 3.2;
const SIGNAL_MIN_SEC = 0.9;
const MIRROR_FRESH_SEC = 7;
const SHOULDER_FRESH_SEC = 4.5;
const LANE_DEVIATION_INTENT_M = 0.9;
const LANE_HYSTERESIS_M = 0.3;
const FOLLOW_TOO_CLOSE_SEC = 1.3;
const FOLLOW_GOOD_SEC = 2.5;

export class DefensiveDrivingMonitor {
  private readonly cfg: MonitorConfig;
  private readonly laneEdges: number[];

  private t = 0;

  // gaze / scan tracking
  private lastCheck: Record<string, number> = {};
  private lastAnyScan = 0;
  private lastScanReward = -99;
  private dwellZone: GazeZone = 'road';
  private dwellSec = 0;
  private dwellCounted = false;
  private currentZone: GazeZone = 'road';
  private scanNudged = false;
  private lastScanPenalty = -99;

  // eyes off road
  private offRoadSec = 0;
  private offRoadWarned = false;
  private offRoadPenalized = false;

  // turn signal
  private signalSide: Side | null = null;
  private signalSec = 0;
  private lastSignalAdvice = -99;
  private signalCancelAt = -1;
  private cancelRequested = false;

  // lanes
  private laneIdx = 0;
  private intent: LaneChangeIntent | null = null;

  // following distance
  private gapSec: number | null = null;
  private tooCloseSec = 0;
  private goodGapSec = 0;
  private lastFollowWarn = -99;
  private lastFollowPraise = -99;

  constructor(cfg: MonitorConfig) {
    this.cfg = cfg;
    this.laneEdges = [];
    for (let i = 0; i < cfg.laneCenters.length - 1; i++) {
      this.laneEdges.push((cfg.laneCenters[i] + cfg.laneCenters[i + 1]) / 2);
    }
  }

  /** Call at the start of every drive. */
  reset(startX: number) {
    this.t = 0;
    this.lastCheck = {};
    this.lastAnyScan = 0;
    this.lastScanReward = -99;
    this.dwellZone = 'road';
    this.dwellSec = 0;
    this.dwellCounted = false;
    this.currentZone = 'road';
    this.scanNudged = false;
    this.lastScanPenalty = -99;
    this.offRoadSec = 0;
    this.offRoadWarned = false;
    this.offRoadPenalized = false;
    this.signalSide = null;
    this.signalSec = 0;
    this.lastSignalAdvice = -99;
    this.signalCancelAt = -1;
    this.cancelRequested = false;
    this.intent = null;
    this.gapSec = null;
    this.tooCloseSec = 0;
    this.goodGapSec = 0;
    this.lastFollowWarn = -99;
    this.lastFollowPraise = -99;
    this.laneIdx = this.nearestLane(startX);
  }

  /** True once when the monitor wants the turn signal switched off (lane change finished). */
  consumeSignalCancel(): boolean {
    const r = this.cancelRequested;
    this.cancelRequested = false;
    return r;
  }

  get elapsed(): number {
    return this.t;
  }

  update(input: MonitorInput): DriverAwarenessSnapshot {
    const { dt } = input;
    this.t += dt;

    this.updateGaze(input);
    this.updateEyesOffRoad(input);
    this.updateSignal(input);
    this.updateLane(input);
    this.updateFollowing(input);
    this.updateScanDiscipline(input);

    return {
      gazeZone: this.currentZone,
      yawDeg: input.gazeYaw,
      pitchDeg: input.gazePitch,
      eyesOffRoadSec: this.offRoadSec,
      secondsSinceScan: this.t - this.lastAnyScan,
      followGapSec: this.gapSec,
      laneIndex: this.laneIdx,
      elapsedSec: this.t,
    };
  }

  // ---------------------------------------------------------------------------
  // Gaze: did the driver really look at a mirror / over their shoulder?
  // ---------------------------------------------------------------------------
  private updateGaze(input: MonitorInput) {
    const zone = classifyGaze(input.gazeYaw, input.gazePitch);
    this.currentZone = zone;

    if (zone !== this.dwellZone) {
      this.dwellZone = zone;
      this.dwellSec = 0;
      this.dwellCounted = false;
    } else {
      this.dwellSec += input.dt;
    }

    if (zone === 'road' || zone === 'other' || this.dwellCounted) return;
    const needed = zone.startsWith('shoulder') ? 0.18 : 0.22;
    if (this.dwellSec < needed) return;

    this.dwellCounted = true;
    this.lastCheck[zone] = this.t;
    this.lastAnyScan = this.t;
    this.scanNudged = false;

    const isMirror = zone.startsWith('mirror');
    const reward = this.t - this.lastScanReward > 5 ? 1 : 0;
    if (reward) this.lastScanReward = this.t;

    this.cfg.emit({
      code: `gaze_${zone}`,
      kind: 'info',
      title: '',
      scoreDelta: reward,
      stat: isMirror ? 'mirrorCheck' : 'shoulderCheck',
      silent: true,
    });
  }

  // ---------------------------------------------------------------------------
  // Eyes off the road
  // ---------------------------------------------------------------------------
  private updateEyesOffRoad(input: MonitorInput) {
    const moving = input.speedMph > 15;
    if (isEyesOffRoad(input.gazeYaw, input.gazePitch)) {
      this.offRoadSec += input.dt;
    } else {
      this.offRoadSec = 0;
      this.offRoadWarned = false;
      this.offRoadPenalized = false;
    }
    if (!moving) return;

    if (this.offRoadSec > EYES_WARN_SEC && !this.offRoadWarned) {
      this.offRoadWarned = true;
      this.cfg.emit({
        code: 'eyes_off_road_warn',
        kind: 'warn',
        title: 'Eyes back on the road!',
        detail: 'A quick glance is 1-2 seconds. At 50 MPH you travel the length of a football field in 4.',
        scoreDelta: 0,
      });
    }
    if (this.offRoadSec > EYES_PENALTY_SEC && !this.offRoadPenalized) {
      this.offRoadPenalized = true;
      this.cfg.emit({
        code: 'eyes_off_road',
        kind: 'bad',
        title: 'Eyes off the road too long',
        detail: 'Long looks away from traffic are how rear-end collisions start.',
        scoreDelta: -5,
        stat: 'eyesOff',
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Turn signal bookkeeping
  // ---------------------------------------------------------------------------
  private updateSignal(input: MonitorInput) {
    const side: Side | null = !input.hazards && input.signal !== 'off' ? input.signal : null;
    if (side !== this.signalSide) {
      this.signalSide = side;
      this.signalSec = 0;
      if (side && input.speedMph > 15 && this.t - this.lastSignalAdvice > 6) {
        const checked =
          this.t - Math.max(this.lastCheck[`mirror_${side}`] ?? -99, this.lastCheck['mirror_rear'] ?? -99) < MIRROR_FRESH_SEC &&
          this.t - (this.lastCheck[`shoulder_${side}`] ?? -99) < SHOULDER_FRESH_SEC;
        if (!checked) {
          this.lastSignalAdvice = this.t;
          this.cfg.emit({
            code: 'signal_advice',
            kind: 'info',
            title: 'Signal on. Now look before you move.',
            detail: `Check your ${side} mirror, then shoulder-check your ${side} blind spot, then ease over.`,
            scoreDelta: 0,
          });
        }
      }
    } else if (side) {
      this.signalSec += input.dt;
    }

    if (this.signalCancelAt >= 0 && this.t >= this.signalCancelAt) {
      this.signalCancelAt = -1;
      this.cancelRequested = true;
    }
  }

  // ---------------------------------------------------------------------------
  // Lane changes
  // ---------------------------------------------------------------------------
  private nearestLane(x: number): number {
    let best = 0;
    let bestD = Infinity;
    this.cfg.laneCenters.forEach((c, i) => {
      const d = Math.abs(c - x);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  }

  private updateLane(input: MonitorInput) {
    // Lane index with hysteresis so wobbling on a line doesn't spam events.
    while (this.laneIdx < this.laneEdges.length && input.playerX > this.laneEdges[this.laneIdx] + LANE_HYSTERESIS_M) {
      this.laneIdx++;
    }
    while (this.laneIdx > 0 && input.playerX < this.laneEdges[this.laneIdx - 1] - LANE_HYSTERESIS_M) {
      this.laneIdx--;
    }

    const dev = input.playerX - this.cfg.laneCenters[this.laneIdx];

    if (!this.intent) {
      if (input.speedMph > 8 && Math.abs(dev) > LANE_DEVIATION_INTENT_M) {
        const dir: -1 | 1 = dev < 0 ? -1 : 1;
        const target = this.laneIdx + dir;
        if (target >= 0 && target < this.cfg.laneCenters.length) {
          this.beginIntent(dir, input);
        }
      }
      return;
    }

    const it = this.intent;
    if (this.laneIdx !== it.fromIdx) {
      this.commitLaneChange(it, input, this.laneIdx - it.fromIdx === it.dir);
      this.intent = null;
    } else if (Math.abs(dev) < 0.35 || (Math.sign(dev) !== it.dir && Math.abs(dev) > LANE_DEVIATION_INTENT_M)) {
      // Drifted back into the lane without changing: not a lane change.
      this.intent = null;
    }
  }

  private beginIntent(dir: -1 | 1, input: MonitorInput) {
    const side: Side = dir < 0 ? 'left' : 'right';
    const signalOk = this.signalSide === side && this.signalSec >= SIGNAL_MIN_SEC;
    const lastMirror = Math.max(this.lastCheck[`mirror_${side}`] ?? -99, this.lastCheck['mirror_rear'] ?? -99);
    const mirrorOk = this.t - lastMirror <= MIRROR_FRESH_SEC;
    const shoulderOk = this.t - (this.lastCheck[`shoulder_${side}`] ?? -99) <= SHOULDER_FRESH_SEC;
    this.intent = {
      dir,
      fromIdx: this.laneIdx,
      t0: this.t,
      signalOk,
      mirrorOk,
      shoulderOk,
      risk: this.assessLane(this.laneIdx + dir, input),
    };
  }

  /** Is anyone in (or about to be in) the lane the driver is moving into? */
  assessLane(targetIdx: number, input: MonitorInput): LaneRisk | null {
    const center = this.cfg.laneCenters[targetIdx];
    if (center === undefined) return null;
    const half = this.cfg.playerHalfLength;
    const playerMps = input.speedMph * MPH_TO_MPS;

    for (const v of input.vehicles) {
      if (Math.abs(v.x - center) > 2.5) continue;
      const d = v.z - input.playerZ; // positive = behind the player
      const reach = v.length / 2 + half;

      if (Math.abs(d) < reach + 1.5) return 'blind_spot';

      if (d > 0) {
        const closing = v.speed * MPH_TO_MPS - playerMps;
        if (closing > 0 && d - reach < closing * 2.5 + 4) return 'closing_fast';
      } else {
        const gap = -d - reach;
        if (gap < 3 + playerMps * 0.3) return 'tight_gap';
      }
    }
    return null;
  }

  private commitLaneChange(it: LaneChangeIntent, input: MonitorInput, completed: boolean) {
    if (!completed) return;
    const side: Side = it.dir < 0 ? 'left' : 'right';

    const problems: string[] = [];
    let delta = 0;

    if (!it.signalOk) {
      problems.push('no turn signal');
      delta -= 6;
    }
    if (!it.mirrorOk) {
      problems.push('no mirror check');
      delta -= 5;
    }
    if (!it.shoulderOk) {
      problems.push('no blind-spot check');
      delta -= 5;
    }

    // Use the risk measured when the driver decided to move over. At commit
    // time they are already inside the new lane, so only a fast vehicle
    // closing from behind is still meaningful to re-check.
    const riskNow = this.assessLane(this.laneIdx, input);
    const risk = it.risk ?? (riskNow === 'closing_fast' ? riskNow : null);

    if (risk) {
      problems.push(
        risk === 'blind_spot'
          ? `a vehicle was alongside you in the ${side} blind spot`
          : risk === 'closing_fast'
          ? 'a fast vehicle was closing in from behind'
          : 'the gap ahead in that lane was too tight'
      );
      delta -= 14;
    }

    if (problems.length === 0) {
      this.cfg.emit({
        code: 'lane_change_good',
        kind: 'good',
        title: 'Textbook lane change',
        detail: 'Signal, mirror, shoulder check, clear lane. This is how you stay alive.',
        scoreDelta: 6,
        stat: 'safeLaneChange',
      });
    } else {
      this.cfg.emit({
        code: risk ? 'lane_change_unsafe' : 'lane_change_sloppy',
        kind: risk ? 'bad' : 'warn',
        title: risk ? 'Unsafe lane change' : 'Sloppy lane change',
        detail: `You moved over with ${problems.join(', ')}.`,
        scoreDelta: delta,
        stat: risk ? 'unsafeLaneChange' : undefined,
        nearMiss: !!risk,
      });
    }

    // Real cars cancel the signal once the wheel straightens after the lane change.
    if (this.signalSide) this.signalCancelAt = this.t + 1.0;
  }

  // ---------------------------------------------------------------------------
  // Following distance (the 3-second rule)
  // ---------------------------------------------------------------------------
  private updateFollowing(input: MonitorInput) {
    const playerMps = input.speedMph * MPH_TO_MPS;
    this.gapSec = null;

    if (input.speedMph >= 12) {
      let best = Infinity;
      for (const v of input.vehicles) {
        if (Math.abs(v.x - input.playerX) > 1.9) continue;
        const ahead = input.playerZ - v.z;
        if (ahead <= 0) continue;
        const gapM = ahead - v.length / 2 - this.cfg.playerHalfLength;
        if (gapM < best) best = gapM;
      }
      if (best < 120) this.gapSec = Math.max(0, best) / playerMps;
    }

    if (this.gapSec !== null && input.speedMph > 25 && this.gapSec < FOLLOW_TOO_CLOSE_SEC) {
      this.tooCloseSec += input.dt;
      this.goodGapSec = 0;
      if (this.tooCloseSec > 2.5 && this.t - this.lastFollowWarn > 8) {
        this.lastFollowWarn = this.t;
        this.tooCloseSec = 0;
        this.cfg.emit({
          code: 'tailgating',
          kind: 'bad',
          title: 'Too close. Back off.',
          detail: 'Keep at least a 3-second gap. It is the only thing that buys you stopping distance.',
          scoreDelta: -4,
          stat: 'tailgating',
        });
      }
    } else {
      this.tooCloseSec = 0;
      if (this.gapSec !== null && this.gapSec >= FOLLOW_GOOD_SEC) {
        this.goodGapSec += input.dt;
        if (this.goodGapSec > 12 && this.t - this.lastFollowPraise > 30) {
          this.lastFollowPraise = this.t;
          this.goodGapSec = 0;
          this.cfg.emit({
            code: 'follow_good',
            kind: 'good',
            title: 'Good following distance',
            detail: 'A safe gap gives you time to react.',
            scoreDelta: 2,
          });
        }
      } else {
        this.goodGapSec = 0;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Scan discipline: look at your mirrors every 5-8 seconds
  // ---------------------------------------------------------------------------
  private updateScanDiscipline(input: MonitorInput) {
    if (input.speedMph < 20) {
      // Don't punish scan gaps while crawling/stopped.
      this.lastAnyScan = Math.max(this.lastAnyScan, this.t - 4);
      return;
    }
    const since = this.t - this.lastAnyScan;

    if (since > SCAN_NUDGE_SEC && !this.scanNudged) {
      this.scanNudged = true;
      this.cfg.emit({
        code: 'scan_nudge',
        kind: 'info',
        title: 'Scan your mirrors',
        detail: 'Check behind you every 5-8 seconds. (1 / 2 / 3 for mirrors, Z / X over your shoulder)',
        scoreDelta: 0,
      });
    }
    if (since > SCAN_PENALTY_SEC && this.t - this.lastScanPenalty > 20) {
      this.lastScanPenalty = this.t;
      this.cfg.emit({
        code: 'scan_lapse',
        kind: 'warn',
        title: 'No mirror check for 20+ seconds',
        detail: 'Traffic behind you keeps changing. Look often.',
        scoreDelta: -2,
      });
    }
  }
}
