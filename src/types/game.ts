/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type GameChapter =
  | 'TITLE'
  | 'INTRO'
  | 'DRIVE_TO_COURTHOUSE'
  | 'ORIENTATION'
  | 'DRIVE_HOME'
  | 'ARRIVAL_HOME'
  | 'GAME_OVER_CRASH';

export interface CarControlsState {
  turnSignal: 'off' | 'left' | 'right';
  hazards: boolean;
  headlights: boolean;
  wipers: boolean;
  radioOn: boolean;
  radioStation: number; // 0: News, 1: Synthwave/Lo-Fi, 2: Classic Hits, 3: Classical
  radioVolume: number;
  acFanSpeed: number; // 0 - 3
}

export interface InGameTextMessage {
  id: string;
  sender: 'Mom' | 'Boss (Miller)' | 'Alex (Best Friend)' | 'Jury Services' | 'Unknown Poll';
  avatarColor: string;
  preview: string;
  fullText: string;
  timestamp: string;
  replyOptions?: {
    id: string;
    text: string;
    impact: 'safe' | 'distracted';
  }[];
}

export interface DrivingStats {
  speedMph: number;
  topSpeedMph: number;
  distanceDrivenMiles: number;
  totalDistanceMiles: number;
  timeRemainingSec: number;
  targetArrivalSec: number;
  elapsedSec: number;
  speedingViolations: number;
  policeStops: number;
  phoneDistractionsResisted: number;
  phoneDistractionsEngaged: number;
  roadRageDeescalated: number;
  roadRageEscalated: number;
  nearMisses: number;
  collisions: number;
  defensiveDrivingScore: number;
  civicResponsibilityScore: number;
  arrivedOnTime: boolean;
  orientationDecisions: {
    putPhoneAway: boolean;
    listenedAttentively: boolean;
    civicReflectionAnswer: string;
  };
  // Defensive-driving awareness metrics (head turns, mirrors, lane changes)
  mirrorChecks: number;
  shoulderChecks: number;
  safeLaneChanges: number;
  unsafeLaneChanges: number;
  tailgatingEvents: number;
  eyesOffRoadWarnings: number;
  secondsSinceScan: number;
}

export type TrafficVehicleType = 'sedan' | 'suv' | 'pickup' | 'van' | 'police';

export interface TrafficVehicle {
  id: number;
  type: TrafficVehicleType;
  x: number;
  y: number;
  z: number;
  speed: number;
  baseSpeed: number;
  targetLane: number;
  isBraking: boolean;
  color: number;
  length: number;
  width: number;
  meshGroup?: any;
  /** Scripted behaviour used for defensive-driving training scenarios. */
  behavior?: TrafficBehavior;
  /** Seconds spent in the current behaviour phase. */
  behaviorTimer?: number;
  /** Counts down while this vehicle is honking its horn. */
  honkTimer?: number;
}

export type TrafficBehavior =
  | 'normal'
  | 'lurker_approach' // closing in from behind toward the player's blind spot
  | 'lurker_hold' // sitting in the blind spot, matching the player's speed
  | 'lurker_leave' // finally passing (or dropping back)
  | 'lurker_evade' // emergency braking because the player moved over
  | 'tailgater' // glued to the player's rear bumper
  | 'passer'; // swinging around the player after the tailgating event

export interface DrivingDecisionEvent {
  id: string;
  title: string;
  sender?: string;
  description: string;
  prompt: string;
  options: {
    id: string;
    text: string;
    description: string;
    impact: 'safe' | 'risky' | 'reckless';
  }[];
}

export interface GameSettings {
  graphicsQuality: 'low' | 'medium' | 'high';
  soundEnabled: boolean;
  masterVolume: number;
  cameraView: 'cockpit' | 'hood';
  steeringSensitivity: number;
}

// ---------------------------------------------------------------------------
// Head-look / mirrors / defensive driving
// ---------------------------------------------------------------------------

/** Where the driver is deliberately looking. Yaw is positive to the LEFT. */
export type LookTarget =
  | 'forward'
  | 'mirror_left'
  | 'mirror_rear'
  | 'mirror_right'
  | 'shoulder_left'
  | 'shoulder_right';

export type GazeZone = 'road' | 'other' | Exclude<LookTarget, 'forward'>;

export interface DriverAwarenessSnapshot {
  gazeZone: GazeZone;
  yawDeg: number;
  pitchDeg: number;
  /** Continuous seconds the driver's eyes have been away from the road ahead. */
  eyesOffRoadSec: number;
  /** Seconds since the last mirror or shoulder check. */
  secondsSinceScan: number;
  /** Time gap to the vehicle ahead in the same lane (null = nobody close ahead). */
  followGapSec: number | null;
  laneIndex: number;
  elapsedSec: number;
}

export type DrivingFeedbackKind = 'good' | 'info' | 'warn' | 'bad';

export type DrivingFeedbackStat =
  | 'mirrorCheck'
  | 'shoulderCheck'
  | 'safeLaneChange'
  | 'unsafeLaneChange'
  | 'tailgating'
  | 'eyesOff';

export interface DrivingFeedback {
  id: number;
  /** Machine-readable code, e.g. "gaze_mirror_rear" or "lane_change". */
  code: string;
  kind: DrivingFeedbackKind;
  title: string;
  detail?: string;
  /** Change applied to the defensive driving score. */
  scoreDelta: number;
  stat?: DrivingFeedbackStat;
  /** Count this as a near miss. */
  nearMiss?: boolean;
  /** Silent events update stats/logic but are not shown as a toast. */
  silent?: boolean;
}
