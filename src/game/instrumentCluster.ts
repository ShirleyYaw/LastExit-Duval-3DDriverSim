/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Canvas renderer for the car's instrument cluster: analog speedometer with a
 * posted-limit marker, tachometer, gear display, turn signals, and a small
 * driver-awareness display (following gap, mirror-scan timer).
 *
 * Deliberately free of three.js so it can be rendered/tested in a plain page.
 * The static dial faces are drawn once; only needles and lights are redrawn.
 */

export interface ClusterState {
  speedMph: number;
  rpm: number;
  limitMph: number;
  signal: 'off' | 'left' | 'right';
  hazards: boolean;
  headlights: boolean;
  wipers: boolean;
  /** Time gap to the car ahead; null when the road ahead is clear. */
  gapSec: number | null;
  secondsSinceScan: number;
  eyesOffRoad: boolean;
  tripMiles: number;
  clock: string;
  /** Free-running seconds, used for blinking. */
  time: number;
}

export const CLUSTER_W = 1024;
export const CLUSTER_H = 384;

const DIAL_R = 140;
const LEFT = { x: 186, y: 200 };
const RIGHT = { x: 838, y: 200 };
const SPEEDO_MAX = 120;
const TACH_MAX = 7; // x1000 rpm
const SWEEP_START = 135; // degrees, canvas convention (clockwise from +x)
const SWEEP = 270;

const rad = (d: number) => (d * Math.PI) / 180;

function dialAngle(value: number, max: number): number {
  return rad(SWEEP_START + (Math.min(max, Math.max(0, value)) / max) * SWEEP);
}

export class InstrumentCluster {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly face: HTMLCanvasElement;
  private lastLimit = -1;

  constructor(canvas?: HTMLCanvasElement) {
    this.canvas = canvas ?? document.createElement('canvas');
    this.canvas.width = CLUSTER_W;
    this.canvas.height = CLUSTER_H;
    this.ctx = this.canvas.getContext('2d')!;
    this.face = document.createElement('canvas');
    this.face.width = CLUSTER_W;
    this.face.height = CLUSTER_H;
  }

  // -------------------------------------------------------------------------
  // Static dial faces
  // -------------------------------------------------------------------------
  private drawFace(limit: number) {
    const c = this.face.getContext('2d')!;
    this.lastLimit = limit;
    c.clearRect(0, 0, CLUSTER_W, CLUSTER_H);

    // Housing
    const bg = c.createLinearGradient(0, 0, 0, CLUSTER_H);
    bg.addColorStop(0, '#0b0e14');
    bg.addColorStop(1, '#05070b');
    c.fillStyle = bg;
    c.fillRect(0, 0, CLUSTER_W, CLUSTER_H);
    c.strokeStyle = '#1b222d';
    c.lineWidth = 4;
    c.strokeRect(2, 2, CLUSTER_W - 4, CLUSTER_H - 4);

    this.drawDialFace(c, LEFT, SPEEDO_MAX, 10, 5, 20, (v) => String(v), limit);
    this.drawDialFace(c, RIGHT, TACH_MAX, 1, 0.5, 1, (v) => String(v), null);

    c.fillStyle = '#7a8aa0';
    c.font = 'bold 15px sans-serif';
    c.textAlign = 'center';
    c.fillText('MPH', LEFT.x, LEFT.y + 108);
    c.fillText('RPM x1000', RIGHT.x, RIGHT.y + 108);

    // Tach redline arc (6 - 7)
    c.strokeStyle = '#d83a2e';
    c.lineWidth = 9;
    c.beginPath();
    c.arc(RIGHT.x, RIGHT.y, DIAL_R - 8, dialAngle(6, TACH_MAX), dialAngle(7, TACH_MAX));
    c.stroke();

    // Centre display panel
    c.fillStyle = '#0a1018';
    c.strokeStyle = '#243040';
    c.lineWidth = 2;
    c.beginPath();
    c.roundRect(352, 30, 320, 326, 18);
    c.fill();
    c.stroke();

    c.fillStyle = '#5b6b80';
    c.font = 'bold 13px sans-serif';
    c.textAlign = 'left';
    c.fillText('FOLLOW GAP', 386, 168);
    c.fillText('MIRROR SCAN', 386, 262);
    c.textAlign = 'right';
    c.fillText('TRIP', 640, 308);
  }

  private drawDialFace(
    c: CanvasRenderingContext2D,
    ctr: { x: number; y: number },
    max: number,
    majorStep: number,
    minorStep: number,
    labelStep: number,
    label: (v: number) => string,
    limit: number | null
  ) {
    // Dial disc
    const g = c.createRadialGradient(ctr.x, ctr.y, 10, ctr.x, ctr.y, DIAL_R + 10);
    g.addColorStop(0, '#0f1620');
    g.addColorStop(1, '#070a10');
    c.fillStyle = g;
    c.beginPath();
    c.arc(ctr.x, ctr.y, DIAL_R + 8, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#2a3646';
    c.lineWidth = 4;
    c.stroke();

    c.textAlign = 'center';
    c.textBaseline = 'middle';
    for (let v = 0; v <= max + 1e-6; v += minorStep) {
      const a = dialAngle(v, max);
      const isMajor = Math.abs(v / majorStep - Math.round(v / majorStep)) < 1e-6;
      const len = isMajor ? 18 : 9;
      const r1 = DIAL_R - 2;
      const r0 = r1 - len;
      c.strokeStyle = isMajor ? '#e6edf5' : '#7d8b9c';
      c.lineWidth = isMajor ? 3 : 1.6;
      c.beginPath();
      c.moveTo(ctr.x + Math.cos(a) * r0, ctr.y + Math.sin(a) * r0);
      c.lineTo(ctr.x + Math.cos(a) * r1, ctr.y + Math.sin(a) * r1);
      c.stroke();

      if (Math.abs(v / labelStep - Math.round(v / labelStep)) < 1e-6) {
        c.fillStyle = '#f2f6fb';
        c.font = 'bold 22px sans-serif';
        c.fillText(label(v), ctr.x + Math.cos(a) * (r0 - 20), ctr.y + Math.sin(a) * (r0 - 20));
      }
    }

    if (limit !== null) {
      // Amber speed-limit marker: a wedge on the dial at the posted limit.
      const a = dialAngle(limit, max);
      const rOut = DIAL_R + 6;
      c.fillStyle = '#ffb21a';
      c.beginPath();
      c.moveTo(ctr.x + Math.cos(a) * (rOut - 24), ctr.y + Math.sin(a) * (rOut - 24));
      c.lineTo(ctr.x + Math.cos(a - 0.06) * rOut, ctr.y + Math.sin(a - 0.06) * rOut);
      c.lineTo(ctr.x + Math.cos(a + 0.06) * rOut, ctr.y + Math.sin(a + 0.06) * rOut);
      c.closePath();
      c.fill();
    }
    c.textBaseline = 'alphabetic';
  }

  // -------------------------------------------------------------------------
  // Dynamic layer
  // -------------------------------------------------------------------------
  update(s: ClusterState) {
    if (s.limitMph !== this.lastLimit) this.drawFace(s.limitMph);
    const c = this.ctx;
    c.drawImage(this.face, 0, 0);

    const speeding = s.speedMph > s.limitMph + 5;

    this.drawNeedle(c, LEFT, dialAngle(s.speedMph, SPEEDO_MAX), '#ff5a36');
    this.drawNeedle(c, RIGHT, dialAngle(s.rpm / 1000, TACH_MAX), '#ffd166');

    // Digital speed inside the speedometer
    c.textAlign = 'center';
    c.fillStyle = speeding ? '#ff5252' : '#ffffff';
    c.font = 'bold 54px sans-serif';
    c.fillText(String(Math.round(s.speedMph)), LEFT.x, LEFT.y + 70);

    this.drawCenterPanel(c, s, speeding);
    this.drawWarningLights(c, s);
  }

  private drawNeedle(c: CanvasRenderingContext2D, ctr: { x: number; y: number }, a: number, color: string) {
    c.save();
    c.translate(ctr.x, ctr.y);
    c.rotate(a);
    c.shadowColor = color;
    c.shadowBlur = 12;
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(-22, -3);
    c.lineTo(DIAL_R - 26, -2);
    c.lineTo(DIAL_R - 14, 0);
    c.lineTo(DIAL_R - 26, 2);
    c.lineTo(-22, 3);
    c.closePath();
    c.fill();
    c.restore();

    c.fillStyle = '#1a212c';
    c.strokeStyle = '#3a475a';
    c.lineWidth = 3;
    c.beginPath();
    c.arc(ctr.x, ctr.y, 13, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  }

  private drawCenterPanel(c: CanvasRenderingContext2D, s: ClusterState, speeding: boolean) {
    // Gear selector
    const gears = ['P', 'R', 'N', 'D'];
    c.font = 'bold 30px sans-serif';
    c.textAlign = 'center';
    gears.forEach((g, i) => {
      c.fillStyle = g === 'D' ? '#35e08a' : '#3a4656';
      c.fillText(g, 410 + i * 68, 78);
    });

    // Clock
    c.fillStyle = '#9fb0c6';
    c.font = 'bold 22px monospace';
    c.textAlign = 'right';
    c.fillText(s.clock, 646, 118);

    // Speed-limit sign
    c.fillStyle = '#f4f4f0';
    c.strokeStyle = '#111';
    c.lineWidth = 3;
    c.beginPath();
    c.roundRect(386, 92, 78, 48, 5);
    c.fill();
    c.stroke();
    c.fillStyle = '#111';
    c.font = 'bold 10px sans-serif';
    c.textAlign = 'center';
    c.fillText('SPEED LIMIT', 425, 106);
    c.font = 'bold 28px sans-serif';
    c.fillStyle = speeding ? '#c40000' : '#111';
    c.fillText(String(s.limitMph), 425, 134);

    // Following gap (3-second rule)
    let gapText = '---';
    let gapColor = '#5b6b80';
    let gapFill = 0;
    if (s.gapSec !== null) {
      gapText = `${s.gapSec.toFixed(1)} s`;
      gapFill = Math.min(1, s.gapSec / 3);
      gapColor = s.gapSec < 1.3 ? '#ff4d4d' : s.gapSec < 2.5 ? '#ffb21a' : '#35e08a';
    }
    c.textAlign = 'left';
    c.fillStyle = gapColor;
    c.font = 'bold 34px sans-serif';
    c.fillText(gapText, 386, 208);
    this.bar(c, 500, 190, 140, 14, gapFill, gapColor);

    // Mirror scan timer
    const since = s.secondsSinceScan;
    const scanColor = since < 8 ? '#35e08a' : since < 14 ? '#ffb21a' : '#ff4d4d';
    this.bar(c, 386, 276, 254, 14, Math.max(0, 1 - since / 20), scanColor);
    c.fillStyle = scanColor;
    c.font = 'bold 16px sans-serif';
    c.textAlign = 'left';
    c.fillText(since < 8 ? 'OK' : since < 14 ? 'CHECK MIRRORS' : 'LOOK BEHIND YOU', 386, 316);

    // Trip
    c.fillStyle = '#9fb0c6';
    c.font = 'bold 18px monospace';
    c.textAlign = 'right';
    c.fillText(`${s.tripMiles.toFixed(1)} mi`, 640, 332);

    // Eyes-off-road warning
    if (s.eyesOffRoad && Math.floor(s.time * 3) % 2 === 0) {
      c.fillStyle = '#ff4d4d';
      c.font = 'bold 15px sans-serif';
      c.textAlign = 'center';
      c.fillText('EYES ON ROAD', 512, 342);
    }
  }

  private bar(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: number, color: string) {
    c.fillStyle = '#17202c';
    c.fillRect(x, y, w, h);
    c.fillStyle = color;
    c.fillRect(x, y, w * Math.min(1, Math.max(0, fill)), h);
    c.strokeStyle = '#2a3646';
    c.lineWidth = 1;
    c.strokeRect(x, y, w, h);
  }

  private drawWarningLights(c: CanvasRenderingContext2D, s: ClusterState) {
    const blink = Math.floor(s.time * 2.6) % 2 === 0;
    const leftOn = (s.signal === 'left' || s.hazards) && blink;
    const rightOn = (s.signal === 'right' || s.hazards) && blink;
    this.arrow(c, 340, 40, -1, leftOn);
    this.arrow(c, 684, 40, 1, rightOn);

    // Telltales along the bottom of the centre panel
    const lights: { x: number; label: string; on: boolean; color: string }[] = [
      { x: 392, label: 'LIGHTS', on: s.headlights, color: '#35e08a' },
      { x: 480, label: 'WIPERS', on: s.wipers, color: '#4db8ff' },
      { x: 568, label: 'HAZARD', on: s.hazards && blink, color: '#ff4d4d' },
    ];
    c.font = 'bold 11px sans-serif';
    c.textAlign = 'center';
    lights.forEach((l) => {
      c.fillStyle = l.on ? l.color : '#222c3a';
      c.beginPath();
      c.arc(l.x + 22, 368 - 8, 5, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = l.on ? l.color : '#3a4656';
      c.fillText(l.label, l.x + 22, 381 - 4);
    });
  }

  private arrow(c: CanvasRenderingContext2D, x: number, y: number, dir: -1 | 1, on: boolean) {
    c.fillStyle = on ? '#35ff8a' : '#14301f';
    if (on) {
      c.shadowColor = '#35ff8a';
      c.shadowBlur = 14;
    }
    c.beginPath();
    c.moveTo(x + dir * 18, y);
    c.lineTo(x - dir * 4, y - 17);
    c.lineTo(x - dir * 4, y - 7);
    c.lineTo(x - dir * 18, y - 7);
    c.lineTo(x - dir * 18, y + 7);
    c.lineTo(x - dir * 4, y + 7);
    c.lineTo(x - dir * 4, y + 17);
    c.closePath();
    c.fill();
    c.shadowBlur = 0;
  }
}
