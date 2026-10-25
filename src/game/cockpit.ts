/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import {
  CLUSTER,
  EYE_REST,
  MIRRORS,
  Vec3,
  WHEEL,
  WINDSHIELD,
} from './cockpitLayout';

/**
 * Builds the player's car interior.
 *
 * Three groups, so the mirror cameras can see what a real mirror would:
 *  - front:     dash, wheel, pillars, doors, screens. Hidden during mirror passes.
 *  - rearShell: headliner, seat backs, headrests, rear window frame. Visible in
 *               the rearview mirror (you see headrests and the window frame).
 *  - body:      the car's outer skin (hood, side panels). Visible in side mirrors.
 *
 * Car-local coordinates: +x right, +y up, the car drives toward -z.
 */

export interface CockpitTextures {
  cluster: THREE.Texture;
  gps: THREE.Texture;
  mirrorRear: THREE.Texture;
  mirrorLeft: THREE.Texture;
  mirrorRight: THREE.Texture;
}

export interface MirrorMeshes {
  rear: THREE.Mesh;
  left: THREE.Mesh;
  right: THREE.Mesh;
}

export interface CockpitUpdate {
  steeringAngle: number;
  wipersOn: boolean;
  raining: boolean;
}

function noiseTexture(base: string, speckle: number, size = 256): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d')!;
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < size * size * 0.18; i++) {
    const v = Math.random();
    g.fillStyle = v > 0.5 ? `rgba(255,255,255,${speckle})` : `rgba(0,0,0,${speckle * 1.4})`;
    g.fillRect(Math.random() * size, Math.random() * size, 1.5, 1.5);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function dropletTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, 512, 256);
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 256;
    const r = 1.5 + Math.random() * 4.5;
    const grad = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
    grad.addColorStop(0, 'rgba(235,245,255,0.95)');
    grad.addColorStop(0.6, 'rgba(170,200,230,0.45)');
    grad.addColorStop(1, 'rgba(120,150,180,0.0)');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A square-section beam between two points. */
function beam(a: Vec3, b: Vec3, thickness: number, mat: THREE.Material): THREE.Mesh {
  const len = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  const m = new THREE.Mesh(new THREE.BoxGeometry(thickness, thickness, len), mat);
  m.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  m.lookAt(b.x, b.y, b.z);
  return m;
}

function box(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

/** Orient an object's +z face toward a target point (yaw then pitch). */
function faceToward(obj: THREE.Object3D, from: Vec3, to: Vec3) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  obj.rotation.order = 'YXZ';
  obj.rotation.y = Math.atan2(dx, dz);
  obj.rotation.x = -Math.atan2(dy, Math.hypot(dx, dz));
}

export class Cockpit {
  readonly front = new THREE.Group();
  readonly rearShell = new THREE.Group();
  readonly body = new THREE.Group();

  readonly mirrors: MirrorMeshes;
  private readonly wheelRotor = new THREE.Group();
  private readonly armL = new THREE.Group();
  private readonly armR = new THREE.Group();
  private readonly droplets: THREE.Mesh;
  private readonly dropletMat: THREE.MeshBasicMaterial;

  private wiperPhase = 0;
  private sinceWipe = 99;
  private lastWipeSign = 1;

  constructor(tex: CockpitTextures) {
    // Mirror textures are rendered from a rear-facing camera; flip them
    // horizontally so they read like real mirrors.
    for (const t of [tex.mirrorRear, tex.mirrorLeft, tex.mirrorRight]) {
      t.repeat.set(-1, 1);
      t.offset.set(1, 0);
    }

    const leather = noiseTexture('#23262b', 0.05);
    leather.repeat.set(3, 3);
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1b1d21, roughness: 0.9, metalness: 0.05, map: leather });
    const dashMat = new THREE.MeshStandardMaterial({ color: 0x202328, roughness: 0.92, metalness: 0.03, map: leather });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x2c3036, roughness: 0.7, metalness: 0.1 });
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x16181b, roughness: 0.85 });
    const linerMat = new THREE.MeshStandardMaterial({ color: 0x3a3d41, roughness: 0.95, side: THREE.DoubleSide });
    const seatMat = new THREE.MeshStandardMaterial({ color: 0x2a2724, roughness: 0.85, map: leather });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xcfd3d8, metalness: 0.95, roughness: 0.15 });
    const paintMat = new THREE.MeshStandardMaterial({ color: 0x1f3a52, metalness: 0.7, roughness: 0.25 });
    const ventMat = new THREE.MeshStandardMaterial({ color: 0x0c0d0f, roughness: 0.6 });

    // -----------------------------------------------------------------------
    // Dashboard: extruded side profile (sx = distance ahead of the car's centre)
    // -----------------------------------------------------------------------
    const prof = new THREE.Shape();
    prof.moveTo(0.22, 0.55);
    prof.lineTo(0.22, 0.88);
    prof.lineTo(0.4, 0.92);
    prof.lineTo(0.62, 0.935);
    prof.lineTo(0.95, 0.955);
    prof.lineTo(1.12, 0.985);
    prof.lineTo(1.16, 0.97);
    prof.lineTo(1.16, 0.55);
    prof.closePath();
    const dashWidth = 1.74;
    const dash = new THREE.Mesh(new THREE.ExtrudeGeometry(prof, { depth: dashWidth, bevelEnabled: false }), dashMat);
    dash.rotation.y = Math.PI / 2; // shape x -> world -z, extrusion -> world +x
    dash.position.set(-dashWidth / 2, 0, 0);
    this.front.add(dash);

    // Defroster slots along the base of the windshield
    for (const x of [-0.45, 0.0, 0.45]) {
      this.front.add(box(0.34, 0.006, 0.03, ventMat, x, 0.972, -1.02));
    }

    // -----------------------------------------------------------------------
    // Instrument cluster pod, tilted to face the driver's eyes
    // -----------------------------------------------------------------------
    const pod = new THREE.Group();
    pod.position.set(CLUSTER.center.x, CLUSTER.center.y, CLUSTER.center.z);
    pod.rotation.x = CLUSTER.tiltX;
    pod.add(box(0.54, 0.205, 0.16, darkMat, 0, 0, -0.085));
    const clusterPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(CLUSTER.width, CLUSTER.height),
      new THREE.MeshBasicMaterial({ map: tex.cluster, toneMapped: false })
    );
    clusterPlane.position.z = 0.0;
    pod.add(clusterPlane);
    pod.add(box(0.56, 0.012, 0.14, darkMat, 0, 0.105, 0.04)); // hood / visor
    pod.add(box(0.012, 0.2, 0.1, darkMat, -0.275, 0, 0.03));
    pod.add(box(0.012, 0.2, 0.1, darkMat, 0.275, 0, 0.03));
    this.front.add(pod);

    // -----------------------------------------------------------------------
    // Centre infotainment screen (angled toward the driver)
    // -----------------------------------------------------------------------
    const screenPos: Vec3 = { x: 0.1, y: 1.05, z: -0.82 };
    const screenGroup = new THREE.Group();
    screenGroup.position.set(screenPos.x, screenPos.y, screenPos.z);
    faceToward(screenGroup, screenPos, EYE_REST);
    screenGroup.add(box(0.3, 0.2, 0.05, darkMat, 0, 0, -0.03));
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.276, 0.1836),
      new THREE.MeshBasicMaterial({ map: tex.gps, toneMapped: false })
    );
    screen.position.z = 0.0;
    screenGroup.add(screen);
    this.front.add(screenGroup);
    // Stalk joining the screen to the dash
    this.front.add(box(0.12, 0.1, 0.1, darkMat, screenPos.x, 0.95, screenPos.z - 0.03));

    // -----------------------------------------------------------------------
    // Steering wheel (static root tilted; rotor spins)
    // -----------------------------------------------------------------------
    const wheelRoot = new THREE.Group();
    wheelRoot.position.set(WHEEL.center.x, WHEEL.center.y, WHEEL.center.z);
    wheelRoot.rotation.x = WHEEL.tiltX;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(WHEEL.radius, 0.024, 14, 48), darkMat);
    this.wheelRotor.add(rim);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.075, 0.05, 20), darkMat);
    hub.rotation.x = Math.PI / 2;
    this.wheelRotor.add(hub);
    this.wheelRotor.add(box(0.17, 0.034, 0.016, chromeMat, -0.1, 0, 0));
    this.wheelRotor.add(box(0.17, 0.034, 0.016, chromeMat, 0.1, 0, 0));
    this.wheelRotor.add(box(0.034, 0.17, 0.016, chromeMat, 0, -0.1, 0));
    // 12 o'clock marker stripe
    this.wheelRotor.add(box(0.014, 0.034, 0.03, new THREE.MeshStandardMaterial({ color: 0xd8d8d8 }), 0, WHEEL.radius, 0));
    wheelRoot.add(this.wheelRotor);
    wheelRoot.add(box(0.12, 0.12, 0.18, darkMat, 0, -0.06, -0.12)); // column shroud
    this.front.add(wheelRoot);

    // -----------------------------------------------------------------------
    // Frame: A-pillars, header, roof rails, B-pillars, doors
    // -----------------------------------------------------------------------
    const W = WINDSHIELD;
    const t = 0.07;
    this.front.add(
      beam({ x: -W.baseHalfW, y: W.baseY, z: W.baseZ - 0.01 }, { x: -W.topHalfW, y: W.topY + 0.02, z: W.topZ }, t, pillarMat),
      beam({ x: W.baseHalfW, y: W.baseY, z: W.baseZ - 0.01 }, { x: W.topHalfW, y: W.topY + 0.02, z: W.topZ }, t, pillarMat),
      box(W.topHalfW * 2 + 0.07, 0.07, 0.12, pillarMat, 0, W.topY + 0.02, W.topZ),
      beam({ x: -W.topHalfW, y: W.topY + 0.02, z: W.topZ }, { x: -0.7, y: 1.5, z: 1.6 }, 0.06, pillarMat),
      beam({ x: W.topHalfW, y: W.topY + 0.02, z: W.topZ }, { x: 0.7, y: 1.5, z: 1.6 }, 0.06, pillarMat)
    );

    // Door trims and window sills
    for (const s of [-1, 1]) {
      this.front.add(box(0.09, 0.46, 2.2, darkMat, s * 0.855, 0.73, 0.3));
      this.front.add(box(0.12, 0.03, 2.2, trimMat, s * 0.85, 0.975, 0.3));
      // Armrest
      this.front.add(box(0.1, 0.06, 0.5, trimMat, s * 0.78, 0.86, 0.05));
    }

    // Floor, seat cushions and centre console
    this.front.add(box(1.7, 0.04, 3.6, new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 1 }), 0, 0.3, 0.1));
    this.front.add(box(0.5, 0.12, 0.55, seatMat, -0.4, 0.5, 0.25));
    this.front.add(box(0.5, 0.12, 0.55, seatMat, 0.4, 0.5, 0.25));
    this.front.add(box(0.3, 0.32, 1.1, darkMat, 0.0, 0.62, -0.2));
    const shifter = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.14, 12), chromeMat);
    shifter.position.set(0, 0.86, -0.12);
    this.front.add(shifter);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.04, 16, 16), darkMat);
    knob.position.set(0, 0.94, -0.12);
    this.front.add(knob);
    const mug = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.035, 0.14, 16),
      new THREE.MeshStandardMaterial({ color: 0x005577, roughness: 0.3, metalness: 0.4 })
    );
    mug.position.set(0, 0.86, 0.2);
    this.front.add(mug);

    // -----------------------------------------------------------------------
    // Mirrors (live camera textures)
    // -----------------------------------------------------------------------
    const makeMirror = (
      pos: Vec3,
      w: number,
      h: number,
      map: THREE.Texture,
      housing: { w: number; h: number; d: number }
    ): THREE.Mesh => {
      const g = new THREE.Group();
      g.position.set(pos.x, pos.y, pos.z);
      faceToward(g, pos, EYE_REST);
      g.add(box(housing.w, housing.h, housing.d, darkMat, 0, 0, -housing.d / 2 - 0.002));
      const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map }));
      face.position.z = 0.001;
      g.add(face);
      this.front.add(g);
      return face;
    };

    this.mirrors = {
      rear: makeMirror(MIRRORS.rear.pos, MIRRORS.rear.width, MIRRORS.rear.height, tex.mirrorRear, { w: 0.3, h: 0.11, d: 0.04 }),
      left: makeMirror(MIRRORS.left.pos, MIRRORS.left.width, MIRRORS.left.height, tex.mirrorLeft, { w: 0.29, h: 0.19, d: 0.1 }),
      right: makeMirror(MIRRORS.right.pos, MIRRORS.right.width, MIRRORS.right.height, tex.mirrorRight, { w: 0.35, h: 0.22, d: 0.1 }),
    };
    // Rearview stalk and side-mirror arms
    this.front.add(box(0.025, 0.12, 0.025, darkMat, 0, 1.43, -0.5));
    this.front.add(box(0.14, 0.03, 0.04, darkMat, -0.98, 1.0, -0.72));
    this.front.add(box(0.14, 0.03, 0.04, darkMat, 0.98, 1.0, -0.72));

    // -----------------------------------------------------------------------
    // Wipers (pivot at the base of the glass, blade sweeps in the glass plane)
    // -----------------------------------------------------------------------
    const slope = Math.atan2(W.topZ - W.baseZ, W.topY - W.baseY); // glass tilt from vertical
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.8 });
    const nz = Math.cos(slope);
    const ny = -Math.sin(slope);
    const makeWiper = (x: number, arm: THREE.Group) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, W.baseY + ny * 0.012 + 0.01, W.baseZ + 0.03 + nz * 0.012);
      pivot.rotation.x = slope;
      arm.add(box(0.014, 0.5, 0.008, bladeMat, 0, 0.25, 0));
      arm.add(box(0.008, 0.46, 0.006, bladeMat, 0, 0.23, -0.01));
      pivot.add(arm);
      this.front.add(pivot);
    };
    makeWiper(-0.4, this.armL);
    makeWiper(0.25, this.armR);

    // Rain droplets stuck to the glass (opacity driven by wiper cleaning)
    this.dropletMat = new THREE.MeshBasicMaterial({
      map: dropletTexture(),
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const glassLen = Math.hypot(W.topZ - W.baseZ, W.topY - W.baseY);
    this.droplets = new THREE.Mesh(new THREE.PlaneGeometry((W.baseHalfW + W.topHalfW) * 0.95, glassLen * 0.92), this.dropletMat);
    this.droplets.position.set(0, (W.baseY + W.topY) / 2 + ny * 0.02, (W.baseZ + W.topZ) / 2 + nz * 0.02);
    this.droplets.rotation.x = slope;
    this.droplets.renderOrder = 5;
    this.droplets.visible = false;
    this.front.add(this.droplets);

    // -----------------------------------------------------------------------
    // Rear shell: visible in the rearview mirror
    // -----------------------------------------------------------------------
    const liner = new THREE.Mesh(new THREE.PlaneGeometry(1.56, 2.4), linerMat);
    liner.rotation.x = Math.PI / 2; // face downward
    liner.position.set(0, 1.5, 0.75);
    this.rearShell.add(liner);

    this.rearShell.add(
      beam({ x: -0.78, y: 1.0, z: 1.4 }, { x: -0.66, y: 1.45, z: 1.82 }, 0.08, pillarMat),
      beam({ x: 0.78, y: 1.0, z: 1.4 }, { x: 0.66, y: 1.45, z: 1.82 }, 0.08, pillarMat),
      box(1.4, 0.07, 0.1, pillarMat, 0, 1.45, 1.82),
      box(1.5, 0.04, 0.75, trimMat, 0, 1.0, 1.5), // parcel shelf
      box(1.5, 0.55, 0.16, seatMat, 0, 0.78, 1.0), // rear seat back
      box(0.05, 0.54, 0.07, pillarMat, -0.84, 1.23, 0.68), // B pillars
      box(0.05, 0.54, 0.07, pillarMat, 0.84, 1.23, 0.68)
    );
    for (const x of [-0.5, 0, 0.5]) this.rearShell.add(box(0.18, 0.15, 0.09, seatMat, x, 1.12, 1.0));
    // Front seat backs and headrests (the driver and passenger sit in front of the mirror)
    for (const x of [-0.4, 0.4]) {
      this.rearShell.add(box(0.5, 0.6, 0.12, seatMat, x, 0.78, 0.58));
      this.rearShell.add(box(0.2, 0.16, 0.09, seatMat, x, 1.16, 0.55));
    }

    // -----------------------------------------------------------------------
    // Outer body: hood and side panels (seen in side mirrors)
    // -----------------------------------------------------------------------
    this.body.add(box(1.6, 0.1, 1.15, paintMat, 0, 0.85, -1.62));
    for (const s of [-1, 1]) {
      this.body.add(box(0.06, 0.62, 2.5, paintMat, s * 0.93, 0.67, 0.75));
      this.body.add(box(0.06, 0.3, 0.6, paintMat, s * 0.93, 0.8, -0.8));
    }
  }

  /** Per-frame animation for moving parts. */
  update(dt: number, u: CockpitUpdate) {
    // Steering wheel: positive steeringAngle steers right = clockwise from the driver's seat.
    this.wheelRotor.rotation.z = -u.steeringAngle * 1.8;

    // Wipers sweep from a parked angle (lying along the base) to nearly vertical.
    const PARK = -1.45;
    const TOP = 0.12;
    let angle: number;
    if (u.wipersOn) {
      this.wiperPhase += dt * 4.6;
      const s = Math.sin(this.wiperPhase);
      angle = PARK + (0.5 + 0.5 * s) * (TOP - PARK);
      // Each time the blades pass the glass, the droplets get cleared.
      const sign = Math.cos(this.wiperPhase) >= 0 ? 1 : -1;
      if (sign !== this.lastWipeSign) this.sinceWipe = 0;
      this.lastWipeSign = sign;
    } else {
      const cur = this.armL.rotation.z;
      angle = cur + (PARK - cur) * (1 - Math.exp(-6 * dt));
    }
    this.armL.rotation.z = angle;
    this.armR.rotation.z = angle;

    this.sinceWipe += dt;
    this.droplets.visible = u.raining;
    if (u.raining) {
      const target = 0.08 + 0.85 * (1 - Math.exp(-this.sinceWipe / 2.4));
      this.dropletMat.opacity += (target - this.dropletMat.opacity) * (1 - Math.exp(-8 * dt));
    } else {
      this.dropletMat.opacity = 0;
    }
  }

  setSteeringVisible(v: boolean) {
    this.front.visible = v;
  }
}
