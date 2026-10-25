/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  TrafficVehicle,
  TrafficVehicleType,
  TrafficBehavior,
  GameChapter,
  CarControlsState,
  DriverAwarenessSnapshot,
  DrivingFeedback,
  LookTarget,
} from '../types/game';
import {
  createTrafficVehicleMesh,
  createPalmTree,
  createRoadsideBuilding,
  createHighwayGantry,
} from './proceduralModels';
import { soundManager } from '../audio/soundManager';
import { Cockpit } from './cockpit';
import { InstrumentCluster } from './instrumentCluster';
import { LookController } from './lookController';
import { DefensiveDrivingMonitor } from './defensiveDriving';
import {
  BehaviorContext,
  beginLurker,
  nearestLaneCenter,
  releaseTailgater,
  stepBehavior,
  stepLateral,
} from './trafficBehavior';
import { BASE_FOV, EYE_REST, MIRRORS, MIRROR_CAMERAS, headEyePosition } from './cockpitLayout';
import { formatGameClock } from './clock';

type MirrorKey = 'rear' | 'left' | 'right';
const D2R = Math.PI / 180;

export interface EngineCallbacks {
  onSpeedUpdate: (speedMph: number, rpm: number) => void;
  onDistanceUpdate: (milesDriven: number, totalMiles: number) => void;
  onCollision: (otherVehicleType: string) => void;
  onNearMiss: () => void;
  onSpeedingViolation: () => void;
  onDestinationReached: () => void;
  /** ~10 Hz snapshot of where the driver is looking, scan timer, following gap, etc. */
  onDriverState?: (state: DriverAwarenessSnapshot) => void;
  /** Defensive-driving feedback (good habits, mistakes, silent mirror-check events). */
  onFeedback?: (feedback: DrivingFeedback) => void;
  /** The engine changed in-car controls by itself (e.g. signal auto-cancel). */
  onControlsChanged?: (controls: CarControlsState) => void;
}

export class DrivingEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;

  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private clock: THREE.Clock;
  private isSoftwareGl: boolean;

  // Car & cockpit
  private playerCarGroup: THREE.Group;
  private cockpit!: Cockpit;

  // Instrument cluster (canvas texture on the dashboard)
  private cluster: InstrumentCluster;
  private clusterTexture: THREE.CanvasTexture;
  private clusterTimer = 0;
  private gpsTimer = 0;

  // Infotainment screen
  private gpsCanvas: HTMLCanvasElement;
  private gpsTexture: THREE.CanvasTexture;

  // Head look, mirrors and defensive driving
  private look = new LookController();
  private monitor!: DefensiveDrivingMonitor;
  private awareness: DriverAwarenessSnapshot = {
    gazeZone: 'road',
    yawDeg: 0,
    pitchDeg: 0,
    eyesOffRoadSec: 0,
    secondsSinceScan: 0,
    followGapSec: null,
    laneIndex: 1,
    elapsedSec: 0,
  };
  private awarenessTimer = 0;
  private feedbackId = 0;
  private elapsedSec = 0;
  private rpm = 800;
  private lastNearMissAt = -99;
  private lastLookHintAt = -99;
  private camPitchOff = 0;
  private camYawOff = 0;
  private camRoll = 0;

  private mirrorCams!: Record<MirrorKey, THREE.PerspectiveCamera>;
  private mirrorTargets!: Record<MirrorKey, THREE.WebGLRenderTarget>;
  private mirrorFrame = 0;
  private mirrorWarmup = 6;
  private mirrorFrustum = new THREE.Frustum();
  private mirrorProj = new THREE.Matrix4();

  // Scenario traffic (blind-spot lurkers, tailgater)
  private readonly laneCenters = [-7.0, -2.5, 2.5, 7.0];
  private lurkerClock = 0;
  private nextLurkerAt = 9;
  private tailgater: TrafficVehicle | null = null;
  private behaviorCtx: BehaviorContext;

  // Pointer / touch free-look
  private pointerId: number | null = null;
  private lastPointerX = 0;
  private lastPointerY = 0;

  // Headlights
  private headlightL: THREE.SpotLight | null = null;
  private headlightR: THREE.SpotLight | null = null;

  // Road & Environment
  private roadGroup: THREE.Group;
  private roadSegments: THREE.Group[] = [];
  private readonly segmentLength = 120;
  private readonly totalSegments = 6;
  private roadWidth = 20;
  private rainParticles: THREE.Points | null = null;

  // Traffic
  private trafficList: TrafficVehicle[] = [];
  private trafficGroup: THREE.Group;
  private nextTrafficId = 1;
  private lastTrafficSpawnZ = -80;

  // Driving State & Kinematics
  public speedMph: number = 0;
  public playerX: number = -2.5;
  public playerZ: number = 0;
  public steeringAngle: number = 0;
  public steerInput: number = 0;
  public throttleInput: number = 0;
  public brakeInput: number = 0;

  // In-Car Controls State
  public controlsState: CarControlsState = {
    turnSignal: 'off',
    hazards: false,
    headlights: false,
    wipers: false,
    radioOn: true,
    radioStation: 1, // Lo-Fi Synthwave
    radioVolume: 0.6,
    acFanSpeed: 2,
  };

  public currentChapter: GameChapter = 'DRIVE_TO_COURTHOUSE';
  public isPaused: boolean = false;
  public isCrashed: boolean = false;
  public isCompleted: boolean = false;
  public cameraMode: 'cockpit' | 'hood' = 'cockpit';

  // Metrics
  public totalDistanceMiles: number = 3.5;
  public distanceDrivenMiles: number = 0;
  private lastViolationCheckTime: number = 0;
  private speedLimitMph: number = 50;

  // Active Radio Station Name Display
  public radioStationNames = [
    '89.1 FL Civic News',
    '94.7 Synthwave Lo-Fi',
    '98.5 Highway Rock',
    '102.3 Classical FM',
  ];

  // Latest incoming message ticker
  public latestPhoneTicker: string = 'No new messages';

  // Animation & Loop
  private animFrameId: number = 0;
  private isRunning: boolean = false;

  private _playerBox: THREE.Box3 = new THREE.Box3();
  private _trafficBox: THREE.Box3 = new THREE.Box3();

  constructor(container: HTMLElement, callbacks: EngineCallbacks) {
    this.container = container;
    this.callbacks = callbacks;

    // Detect software WebGL
    this.isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.container.appendChild(this.renderer.domElement);

    // Scene & Main Camera
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      62,
      this.container.clientWidth / this.container.clientHeight,
      0.1,
      1200
    );

    this.clock = new THREE.Clock();

    // Environment
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    // GPS & Infotainment Canvas
    this.gpsCanvas = document.createElement('canvas');
    this.gpsCanvas.width = 512;
    this.gpsCanvas.height = 340;
    this.gpsTexture = new THREE.CanvasTexture(this.gpsCanvas);
    this.gpsTexture.colorSpace = THREE.SRGBColorSpace;

    // Instrument cluster canvas
    this.cluster = new InstrumentCluster();
    this.clusterTexture = new THREE.CanvasTexture(this.cluster.canvas);
    this.clusterTexture.colorSpace = THREE.SRGBColorSpace;
    this.clusterTexture.anisotropy = 4;

    // One camera + render target per mirror (rearview, driver side, passenger side)
    this.createMirrorRigs();

    this.behaviorCtx = {
      playerX: -2.5,
      playerZ: 0,
      playerSpeedMph: 0,
      playerHalfWidth: 0.95,
      playerHalfLength: 2.1,
      laneCenters: this.laneCenters,
      honk: () => soundManager.playNpcHonk(),
    };

    // Scene Hierarchy
    this.roadGroup = new THREE.Group();
    this.scene.add(this.roadGroup);

    this.trafficGroup = new THREE.Group();
    this.scene.add(this.trafficGroup);

    this.playerCarGroup = new THREE.Group();
    this.scene.add(this.playerCarGroup);

    // Attach the main camera and the three mirror cameras to the player car
    this.camera.rotation.order = 'YXZ';
    this.playerCarGroup.add(this.camera);
    for (const key of ['rear', 'left', 'right'] as MirrorKey[]) {
      this.playerCarGroup.add(this.mirrorCams[key]);
    }

    this.setupLighting();
    this.buildRoadSegments();
    this.buildCockpit();
    this.buildHeadlights();
    this.buildRainSystem();
    this.updateGpsCanvas(0, 'Route to County Courthouse', 'In 0.8 mi: Exit 14');

    window.addEventListener('resize', this.onWindowResize);

    this.monitor = new DefensiveDrivingMonitor({
      laneCenters: this.laneCenters,
      playerHalfLength: 2.1,
      emit: (fb) => this.emitFeedback(fb),
    });
    this.monitor.reset(this.playerX);
    this.setupPointerLook();

    // Pre-start radio if enabled
    if (this.controlsState.radioOn) {
      soundManager.setRadioStation(this.controlsState.radioStation, this.controlsState.radioVolume);
    }

    this.start();
  }

  public setCallbacks(callbacks: EngineCallbacks) {
    this.callbacks = callbacks;
  }

  private setupLighting() {
    const skyColor = this.currentChapter === 'DRIVE_HOME' ? 0x6e7b8b : 0xbdd7ee;
    this.scene.background = new THREE.Color(skyColor);
    this.scene.fog = new THREE.FogExp2(skyColor, 0.0035);

    const hemiLight = new THREE.HemisphereLight(0xfff5e6, 0x445533, 0.75);
    hemiLight.position.set(0, 50, 0);
    this.scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xffeedd, 1.4);
    sunLight.position.set(40, 60, -40);
    sunLight.castShadow = !this.isSoftwareGl;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.bias = -0.0005;
    this.scene.add(sunLight);
  }

  private buildHeadlights() {
    this.headlightL = new THREE.SpotLight(0xfff8e7, 0, 85, 0.45, 0.5, 1);
    this.headlightL.position.set(-0.7, 0.65, -2.1);
    this.headlightL.target.position.set(-0.7, 0.1, -40);

    this.headlightR = new THREE.SpotLight(0xfff8e7, 0, 85, 0.45, 0.5, 1);
    this.headlightR.position.set(0.7, 0.65, -2.1);
    this.headlightR.target.position.set(0.7, 0.1, -40);

    this.playerCarGroup.add(
      this.headlightL,
      this.headlightR,
      this.headlightL.target,
      this.headlightR.target
    );
  }

  private createRoadTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#22252a';
    ctx.fillRect(0, 0, 1024, 1024);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    for (let i = 0; i < 4000; i++) {
      ctx.fillRect(Math.random() * 1024, Math.random() * 1024, 2, 2);
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(40, 0, 14, 1024);
    ctx.fillRect(970, 0, 14, 1024);

    ctx.fillStyle = '#e8b923';
    ctx.fillRect(502, 0, 8, 1024);
    ctx.fillRect(514, 0, 8, 1024);

    ctx.fillStyle = '#f0f3f6';
    const dashLength = 80;
    const gapLength = 60;
    for (let y = 0; y < 1024; y += dashLength + gapLength) {
      ctx.fillRect(276, y, 10, dashLength);
      ctx.fillRect(748, y, 10, dashLength);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 4);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
    return texture;
  }

  private buildRoadSegments() {
    const roadTexture = this.createRoadTexture();
    const roadMat = new THREE.MeshStandardMaterial({
      map: roadTexture,
      roughness: 0.75,
      metalness: 0.1,
    });

    const grassMat = new THREE.MeshStandardMaterial({
      color: 0x456938,
      roughness: 0.9,
      metalness: 0.05,
    });

    const guardrailMat = new THREE.MeshStandardMaterial({
      color: 0xaaaaaa,
      metalness: 0.85,
      roughness: 0.2,
    });

    for (let i = 0; i < this.totalSegments; i++) {
      const segment = new THREE.Group();
      const zOffset = -i * this.segmentLength;

      const roadMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(this.roadWidth, this.segmentLength),
        roadMat
      );
      roadMesh.rotation.x = -Math.PI / 2;
      roadMesh.receiveShadow = !this.isSoftwareGl;
      segment.add(roadMesh);

      const grassL = new THREE.Mesh(new THREE.PlaneGeometry(60, this.segmentLength), grassMat);
      grassL.rotation.x = -Math.PI / 2;
      grassL.position.x = -(this.roadWidth / 2 + 30);
      grassL.position.y = -0.02;

      const grassR = new THREE.Mesh(new THREE.PlaneGeometry(60, this.segmentLength), grassMat);
      grassR.rotation.x = -Math.PI / 2;
      grassR.position.x = this.roadWidth / 2 + 30;
      grassR.position.y = -0.02;
      segment.add(grassL, grassR);

      const railL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.7, this.segmentLength), guardrailMat);
      railL.position.set(-(this.roadWidth / 2 + 0.5), 0.45, 0);
      const railR = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.7, this.segmentLength), guardrailMat);
      railR.position.set(this.roadWidth / 2 + 0.5, 0.45, 0);
      segment.add(railL, railR);

      for (let s = -this.segmentLength / 2; s < this.segmentLength / 2; s += 25) {
        const palmL = createPalmTree();
        palmL.position.set(-(this.roadWidth / 2 + 4 + Math.random() * 4), 0, s + (Math.random() - 0.5) * 8);
        palmL.scale.setScalar(0.9 + Math.random() * 0.3);
        segment.add(palmL);

        const palmR = createPalmTree();
        palmR.position.set(this.roadWidth / 2 + 4 + Math.random() * 4, 0, s + (Math.random() - 0.5) * 8);
        palmR.scale.setScalar(0.9 + Math.random() * 0.3);
        segment.add(palmR);
      }

      if (i % 2 === 0) {
        const house = createRoadsideBuilding('house');
        house.position.set(this.roadWidth / 2 + 18, 0, 0);
        segment.add(house);
      } else if (i === 3) {
        const gasStation = createRoadsideBuilding('gas_station');
        gasStation.position.set(-(this.roadWidth / 2 + 20), 0, 0);
        segment.add(gasStation);
      }

      if (i === 1 || i === 4) {
        const gantry = createHighwayGantry('EXIT 14: COUNTY COURTHOUSE', 'SPEED LIMIT 50 MPH');
        gantry.position.set(0, 0, 0);
        segment.add(gantry);
      }

      segment.position.z = zOffset;
      this.roadSegments.push(segment);
      this.roadGroup.add(segment);
    }
  }

  private buildCockpit() {
    this.cockpit = new Cockpit({
      cluster: this.clusterTexture,
      gps: this.gpsTexture,
      mirrorRear: this.mirrorTargets.rear.texture,
      mirrorLeft: this.mirrorTargets.left.texture,
      mirrorRight: this.mirrorTargets.right.texture,
    });
    this.playerCarGroup.add(this.cockpit.front, this.cockpit.rearShell, this.cockpit.body);
    this.setCameraSeatingPosition();
  }

  private createMirrorRigs() {
    // Software GL is slow, so use smaller mirror textures there.
    const scale = this.isSoftwareGl ? 0.5 : 1;
    const sizes: Record<MirrorKey, [number, number]> = {
      rear: [512, 160],
      left: [256, 160],
      right: [320, 192],
    };
    this.mirrorCams = {} as Record<MirrorKey, THREE.PerspectiveCamera>;
    this.mirrorTargets = {} as Record<MirrorKey, THREE.WebGLRenderTarget>;
    (['rear', 'left', 'right'] as MirrorKey[]).forEach((key) => {
      const [w, h] = sizes[key];
      this.mirrorTargets[key] = new THREE.WebGLRenderTarget(Math.round(w * scale), Math.round(h * scale), {
        colorSpace: THREE.SRGBColorSpace,
        generateMipmaps: false,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
      });
      const cfg = MIRROR_CAMERAS[key];
      const cam = new THREE.PerspectiveCamera(cfg.fovY, cfg.aspect, 0.3, 170);
      const out = cfg.yawOutDeg * D2R;
      // A rear-facing camera: yaw = PI. Side mirrors angle slightly outward.
      const yaw = key === 'rear' ? Math.PI : key === 'left' ? Math.PI - out : Math.PI + out;
      cam.rotation.order = 'YXZ';
      cam.rotation.set(cfg.pitchDeg * D2R, yaw, 0);
      const p = MIRRORS[key].pos;
      cam.position.set(p.x, p.y, p.z);
      this.mirrorCams[key] = cam;
    });
  }

  private setCameraSeatingPosition() {
    this.camera.rotation.order = 'YXZ';
    if (this.cameraMode === 'cockpit') {
      this.camera.position.set(EYE_REST.x, EYE_REST.y, EYE_REST.z);
    } else {
      this.camera.position.set(0, 1.15, -1.8);
    }
    this.camera.rotation.set(0, 0, 0);
    this.camera.fov = BASE_FOV;
    this.camera.updateProjectionMatrix();
  }

  public setCameraMode(mode: 'cockpit' | 'hood') {
    const changed = mode !== this.cameraMode;
    this.cameraMode = mode;
    this.look.enabled = mode === 'cockpit';
    this.look.clear();
    if (this.cockpit) this.cockpit.front.visible = mode === 'cockpit';
    this.setCameraSeatingPosition();
    if (changed && mode === 'hood') {
      this.emitFeedback({
        code: 'hood_camera',
        kind: 'info',
        title: 'Hood camera: no mirrors',
        detail: 'Switch back to the cockpit view (C) to use mirrors and shoulder checks.',
        scoreDelta: 0,
      });
    }
  }

  // --- HEAD LOOK ---
  public pressLook(target: LookTarget) {
    if (this.cameraMode !== 'cockpit') {
      if (this.elapsedSec - this.lastLookHintAt > 4) {
        this.lastLookHintAt = this.elapsedSec;
        this.emitFeedback({
          code: 'look_needs_cockpit',
          kind: 'info',
          title: 'Mirrors need the cockpit view',
          detail: 'Press C to switch cameras.',
          scoreDelta: 0,
        });
      }
      return;
    }
    this.look.press(target);
  }

  public releaseLook(target: LookTarget) {
    this.look.release(target);
  }

  public clearLook() {
    this.look.clear();
  }

  private setupPointerLook() {
    const el = this.renderer.domElement;
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', this.onPointerDown);
    el.addEventListener('pointermove', this.onPointerMove);
    el.addEventListener('pointerup', this.onPointerUp);
    el.addEventListener('pointercancel', this.onPointerUp);
  }

  private onPointerDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (this.cameraMode !== 'cockpit' || this.isPaused || this.isCrashed) return;
    this.pointerId = e.pointerId;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
    this.look.beginDrag();
    try {
      this.renderer.domElement.setPointerCapture(e.pointerId);
    } catch (_) {}
  };

  private onPointerMove = (e: PointerEvent) => {
    if (e.pointerId !== this.pointerId) return;
    this.look.dragBy(e.clientX - this.lastPointerX, e.clientY - this.lastPointerY);
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
  };

  private onPointerUp = (e: PointerEvent) => {
    if (e.pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.look.endDrag();
  };

  private emitFeedback(fb: Omit<DrivingFeedback, 'id'>) {
    this.callbacks.onFeedback?.({ ...fb, id: ++this.feedbackId });
  }

  private emitControls() {
    this.callbacks.onControlsChanged?.({ ...this.controlsState });
  }

  private cancelTurnSignal() {
    if (this.controlsState.turnSignal === 'off') return;
    this.controlsState.turnSignal = 'off';
    if (!this.controlsState.hazards) soundManager.stopTurnSignal();
    this.emitControls();
  }

  // --- CAR CONTROLS TOGGLES ---
  public toggleTurnSignal(dir: 'left' | 'right') {
    if (this.controlsState.turnSignal === dir) {
      this.controlsState.turnSignal = 'off';
      soundManager.stopTurnSignal();
    } else {
      this.controlsState.turnSignal = dir;
      soundManager.startTurnSignal();
    }
  }

  public toggleHazards() {
    this.controlsState.hazards = !this.controlsState.hazards;
    if (this.controlsState.hazards) {
      soundManager.startTurnSignal();
    } else if (this.controlsState.turnSignal === 'off') {
      soundManager.stopTurnSignal();
    }
  }

  public toggleHeadlights() {
    this.controlsState.headlights = !this.controlsState.headlights;
    const intensity = this.controlsState.headlights ? 2.8 : 0;
    if (this.headlightL) this.headlightL.intensity = intensity;
    if (this.headlightR) this.headlightR.intensity = intensity;
  }

  public toggleWipers() {
    this.controlsState.wipers = !this.controlsState.wipers;
  }

  public pressHorn() {
    soundManager.startHorn();
  }

  public releaseHorn() {
    soundManager.stopHorn();
  }

  public nextRadioStation() {
    if (!this.controlsState.radioOn) {
      this.controlsState.radioOn = true;
    }
    this.controlsState.radioStation = (this.controlsState.radioStation + 1) % 4;
    soundManager.setRadioStation(this.controlsState.radioStation, this.controlsState.radioVolume);
  }

  public toggleRadioPower() {
    this.controlsState.radioOn = !this.controlsState.radioOn;
    if (this.controlsState.radioOn) {
      soundManager.setRadioStation(this.controlsState.radioStation, this.controlsState.radioVolume);
    } else {
      soundManager.stopRadio();
    }
  }

  private buildRainSystem() {
    const rainCount = 1800;
    const rainGeo = new THREE.BufferGeometry();
    const rainPos = new Float32Array(rainCount * 3);

    for (let i = 0; i < rainCount; i++) {
      rainPos[i * 3] = (Math.random() - 0.5) * 60;
      rainPos[i * 3 + 1] = Math.random() * 25;
      rainPos[i * 3 + 2] = -Math.random() * 80;
    }

    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
    const rainMat = new THREE.PointsMaterial({
      color: 0xaaccff,
      size: 0.12,
      transparent: true,
      opacity: 0.55,
    });

    this.rainParticles = new THREE.Points(rainGeo, rainMat);
    this.rainParticles.visible = false;
    this.scene.add(this.rainParticles);
  }

  public setChapterEnvironment(chapter: GameChapter) {
    this.currentChapter = chapter;

    if (chapter === 'DRIVE_HOME') {
      const stormyColor = 0x5a6572;
      this.scene.background = new THREE.Color(stormyColor);
      if (this.scene.fog) this.scene.fog.color = new THREE.Color(stormyColor);
      if (this.rainParticles) this.rainParticles.visible = true;
      soundManager.startRainSound();
      this.controlsState.wipers = true;
      this.emitControls();
    } else {
      const morningColor = 0xbdd7ee;
      this.scene.background = new THREE.Color(morningColor);
      if (this.scene.fog) this.scene.fog.color = new THREE.Color(morningColor);
      if (this.rainParticles) this.rainParticles.visible = false;
      soundManager.stopRainSound();
      this.controlsState.wipers = false;
      this.emitControls();
    }
  }

  public updateGpsCanvas(progressRatio: number, destinationName: string, nextTurnPrompt: string) {
    const ctx = this.gpsCanvas.getContext('2d')!;
    const w = this.gpsCanvas.width;
    const h = this.gpsCanvas.height;

    ctx.fillStyle = '#0f141c';
    ctx.fillRect(0, 0, w, h);

    // Top status banner with time and battery
    ctx.fillStyle = '#1b2330';
    ctx.fillRect(0, 0, w, 44);

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('NAV • GPS ACTIVE', 16, 28);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px monospace';
    const milesLeft = Math.max(0, this.totalDistanceMiles - this.distanceDrivenMiles).toFixed(1);
    ctx.fillText(`${milesLeft} mi left`, w - 110, 28);

    // Split screen: Left half is Map, Right half is Radio & Phone ticker!
    // Map on Left (w = 260)
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let x = 0; x < 260; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, 48);
      ctx.lineTo(x, h - 68);
      ctx.stroke();
    }
    for (let y = 48; y < h - 68; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(260, y);
      ctx.stroke();
    }

    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(130, h - 75);
    ctx.lineTo(130, 55);
    ctx.stroke();

    const playerMapY = (h - 75) - progressRatio * (h - 135);
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(130, playerMapY, 7, 0, Math.PI * 2);
    ctx.fill();

    // Right Half: Car Radio & Phone notification ticker
    ctx.fillStyle = '#141b24';
    ctx.fillRect(264, 48, w - 264, h - 116);
    ctx.strokeStyle = '#334155';
    ctx.strokeRect(264, 48, w - 264, h - 116);

    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('FM STEREO RADIO', 276, 70);

    const stationTitle = this.controlsState.radioOn
      ? this.radioStationNames[this.controlsState.radioStation]
      : 'RADIO OFF';
    ctx.fillStyle = this.controlsState.radioOn ? '#ffffff' : '#64748b';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(stationTitle, 276, 94);

    // Audio frequency bars simulation
    if (this.controlsState.radioOn) {
      const time = performance.now() * 0.005;
      for (let b = 0; b < 12; b++) {
        const barH = 6 + Math.abs(Math.sin(time + b * 0.8)) * 22;
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(276 + b * 17, 130 - barH, 10, barH);
      }
    }

    // Phone / Message banner
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(270, 142, w - 280, 28);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '11px sans-serif';
    ctx.fillText(`📱 ${this.latestPhoneTicker}`, 276, 160);

    // Bottom Turn Instruction bar
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(10, h - 62, w - 20, 54);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(10, h - 62, w - 20, 54);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(nextTurnPrompt, 24, h - 35);

    ctx.fillStyle = '#38bdf8';
    ctx.font = '12px sans-serif';
    ctx.fillText(`Destination: ${destinationName}`, 24, h - 16);

    this.gpsTexture.needsUpdate = true;
  }

  private spawnTrafficAt(
    lane: number,
    z: number,
    opts: { type?: TrafficVehicleType; speed?: number; behavior?: TrafficBehavior; track?: boolean } = {}
  ): TrafficVehicle {
    const types: TrafficVehicleType[] = ['sedan', 'suv', 'pickup', 'van', 'police'];
    const typeRoll = Math.random();
    const type: TrafficVehicleType =
      opts.type ?? (typeRoll < 0.15 ? 'police' : types[Math.floor(Math.random() * (types.length - 1))]);

    const carColors = [0x991111, 0x1f4e79, 0x2e4053, 0xd4ac0d, 0x7f8c8d, 0xffffff];
    const color = carColors[Math.floor(Math.random() * carColors.length)];

    const baseSpeed = 40 + Math.random() * 15;
    const mesh = createTrafficVehicleMesh(type, color);
    mesh.position.set(lane, 0, z);

    const vehicle: TrafficVehicle = {
      id: this.nextTrafficId++,
      type,
      x: lane,
      y: 0,
      z,
      speed: opts.speed ?? baseSpeed,
      baseSpeed,
      targetLane: lane,
      isBraking: false,
      color,
      length: (type === 'van' || type === 'pickup') ? 4.8 : 4.4,
      width: 2.1,
      meshGroup: mesh,
      behavior: opts.behavior ?? 'normal',
      behaviorTimer: 0,
      honkTimer: 0,
    };

    this.trafficList.push(vehicle);
    this.trafficGroup.add(mesh);
    if (opts.track !== false) this.lastTrafficSpawnZ = z;
    return vehicle;
  }

  private spawnTrafficAhead() {
    const lanes = [-7.0, -2.5, 2.5, 7.0];
    const lane = lanes[Math.floor(Math.random() * lanes.length)];
    const spawnZ = this.playerZ - 130 - Math.random() * 40;
    this.spawnTrafficAt(lane, spawnZ);
  }

  public startDrive(chapter: GameChapter) {
    this.currentChapter = chapter;
    this.playerX = -2.5;
    this.playerZ = 0;
    this.speedMph = 35;
    this.distanceDrivenMiles = 0;
    this.isCrashed = false;
    this.isCompleted = false;
    this.isPaused = false;
    this.throttleInput = 0;
    this.brakeInput = 0;
    this.steerInput = 0;
    this.steeringAngle = 0;
    this.elapsedSec = 0;
    this.rpm = 800;
    this.lastNearMissAt = -99;
    this.lurkerClock = 0;
    this.nextLurkerAt = 9;
    this.tailgater = null;
    this.mirrorWarmup = 6;
    this.playerCarGroup.rotation.set(0, 0, 0);
    this.look.reset();
    this.monitor.reset(this.playerX);
    this.controlsState.turnSignal = 'off';
    this.controlsState.hazards = false;
    soundManager.stopTurnSignal();

    for (const v of this.trafficList) {
      this.trafficGroup.remove(v.meshGroup);
    }
    this.trafficList = [];

    // Pre-spawn traffic both ahead and slightly behind on other lanes for mirror checking!
    const lanes = [-7.0, -2.5, 2.5, 7.0];
    // Ahead:
    for (let i = 0; i < 5; i++) {
      const lane = lanes[i % lanes.length];
      const z = -60 - i * 45;
      this.spawnTrafficAt(lane, z);
    }
    // Trailing behind (visible in rearview/side mirrors!):
    this.spawnTrafficAt(-7.0, 35);
    this.spawnTrafficAt(2.5, 55);

    this.roadSegments.forEach((segment, idx) => {
      segment.position.z = -idx * this.segmentLength;
    });

    this.playerCarGroup.position.set(this.playerX, 0, this.playerZ);
    this.setCameraSeatingPosition();
    this.setChapterEnvironment(chapter);
    this.emitControls();

    this.start();
  }

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.clock.start();
    soundManager.startEngine();
    this.tick();
  }

  public stop() {
    this.isRunning = false;
    cancelAnimationFrame(this.animFrameId);
    soundManager.stopEngine();
    soundManager.stopSiren();
    soundManager.stopRainSound();
    soundManager.stopRadio();
    soundManager.stopTurnSignal();
    soundManager.stopHorn();
  }

  public pause() {
    this.isPaused = true;
    soundManager.stopEngine();
  }

  public resume() {
    this.isPaused = false;
    this.clock.getDelta();
    soundManager.startEngine();
  }

  private tick = () => {
    if (!this.isRunning) return;

    const delta = Math.min(this.clock.getDelta(), 0.1);

    if (!this.isPaused && !this.isCrashed && !this.isCompleted) {
      this.elapsedSec += delta;
      this.updatePhysics(delta);
      this.updateTraffic(delta);
      this.updateRoadSegments();
      this.updateDriverAwareness(delta);
      this.checkCollisions();
      this.updateCameraAndCockpit(delta);
      this.updateMirrors();
    }

    this.renderer.render(this.scene, this.camera);
    this.animFrameId = requestAnimationFrame(this.tick);
  };

  /**
   * Renders the mirrors that are actually in the driver's view. The mirror the
   * driver is focusing on updates every frame; the others take turns, which
   * keeps the cost to roughly one extra scene pass per frame.
   */
  private updateMirrors() {
    if (this.cameraMode !== 'cockpit') return;

    this.playerCarGroup.updateMatrixWorld(true);
    this.mirrorProj.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    this.mirrorFrustum.setFromProjectionMatrix(this.mirrorProj);

    const keys: MirrorKey[] = ['rear', 'left', 'right'];
    const visible = keys.filter((k) => this.mirrorFrustum.intersectsObject(this.cockpit.mirrors[k]));
    if (visible.length === 0) return;

    const toRender = new Set<MirrorKey>();
    if (this.mirrorWarmup > 0) {
      this.mirrorWarmup--;
      visible.forEach((k) => toRender.add(k));
    } else {
      const zone = this.awareness.gazeZone;
      const focus: MirrorKey | null =
        zone === 'mirror_rear' ? 'rear' : zone === 'mirror_left' ? 'left' : zone === 'mirror_right' ? 'right' : null;
      if (focus && visible.includes(focus)) toRender.add(focus);

      const every = this.isSoftwareGl ? 4 : 1;
      this.mirrorFrame++;
      if (this.mirrorFrame % every === 0) {
        toRender.add(visible[Math.floor(this.mirrorFrame / every) % visible.length]);
      }
    }
    if (toRender.size === 0) return;

    // The interior must not block the mirror cameras; the shadow map is reused.
    const frontWasVisible = this.cockpit.front.visible;
    this.cockpit.front.visible = false;
    const prevAutoUpdate = this.renderer.shadowMap.autoUpdate;
    this.renderer.shadowMap.autoUpdate = false;

    toRender.forEach((k) => {
      this.renderer.setRenderTarget(this.mirrorTargets[k]);
      this.renderer.render(this.scene, this.mirrorCams[k]);
    });

    this.renderer.setRenderTarget(null);
    this.renderer.shadowMap.autoUpdate = prevAutoUpdate;
    this.cockpit.front.visible = frontWasVisible;
  }

  /** Head movement, gaze tracking and defensive-driving evaluation. */
  private updateDriverAwareness(dt: number) {
    this.look.update(dt);

    if (this.cameraMode === 'cockpit') {
      this.awareness = this.monitor.update({
        dt,
        speedMph: this.speedMph,
        playerX: this.playerX,
        playerZ: this.playerZ,
        signal: this.controlsState.turnSignal,
        hazards: this.controlsState.hazards,
        gazeYaw: this.look.yaw,
        gazePitch: this.look.pitch,
        vehicles: this.trafficList,
      });
      if (this.monitor.consumeSignalCancel()) this.cancelTurnSignal();
    }

    this.awarenessTimer += dt;
    if (this.awarenessTimer >= 0.1) {
      this.awarenessTimer = 0;
      this.callbacks.onDriverState?.({ ...this.awareness, elapsedSec: this.elapsedSec });
    }
  }

  private updatePhysics(dt: number) {
    if (this.throttleInput > 0) {
      const accelRate = 22 * (1 - this.speedMph / 95);
      this.speedMph = Math.min(85, this.speedMph + accelRate * dt * this.throttleInput);
    } else if (this.brakeInput > 0) {
      const brakePower = 48 * this.brakeInput;
      this.speedMph = Math.max(0, this.speedMph - brakePower * dt);
      if (this.speedMph > 35 && this.brakeInput > 0.8) {
        soundManager.playBrakeScreech();
      }
    } else {
      this.speedMph = Math.max(0, this.speedMph - 9.5 * dt);
    }

    const speedRatio = Math.min(1.2, Math.max(0.2, this.speedMph / 45));
    if (Math.abs(this.steerInput) > 0.05) {
      this.steeringAngle = THREE.MathUtils.damp(
        this.steeringAngle,
        this.steerInput * 0.75,
        10,
        dt
      );
      // Roughly a 1.5 second lane change at highway speed: no more teleporting sideways.
      this.playerX += this.steeringAngle * 4.0 * speedRatio * dt;
    } else {
      this.steeringAngle = THREE.MathUtils.damp(this.steeringAngle, 0, 8, dt);
    }

    const maxRoadX = this.roadWidth / 2 - 1.2;
    if (this.playerX > maxRoadX) {
      this.playerX = maxRoadX;
      this.speedMph *= 0.96;
    } else if (this.playerX < -maxRoadX) {
      this.playerX = -maxRoadX;
      this.speedMph *= 0.96;
    }

    const metersPerSec = this.speedMph * 0.447;
    const distanceThisFrame = metersPerSec * dt;
    this.playerZ -= distanceThisFrame;

    this.distanceDrivenMiles += distanceThisFrame / 1609.34;
    this.callbacks.onDistanceUpdate(this.distanceDrivenMiles, this.totalDistanceMiles);

    const rpmTarget = 800 + (this.speedMph / 85) * 4800 + (this.throttleInput > 0 ? 600 : 0);
    this.rpm += (rpmTarget - this.rpm) * (1 - Math.exp(-6 * dt));
    this.callbacks.onSpeedUpdate(this.speedMph, this.rpm);
    soundManager.updateEnginePitch(this.speedMph, this.throttleInput > 0.3);

    const now = performance.now();
    if (this.speedMph > this.speedLimitMph + 12 && now - this.lastViolationCheckTime > 5000) {
      this.lastViolationCheckTime = now;
      this.callbacks.onSpeedingViolation();
    }

    if (this.distanceDrivenMiles >= this.totalDistanceMiles) {
      this.isCompleted = true;
      this.callbacks.onDestinationReached();
    }
  }

  private updateTraffic(dt: number) {
    if (this.trafficList.length < 8 && this.playerZ - this.lastTrafficSpawnZ < 60) {
      this.spawnTrafficAhead();
    }

    this.updateScenarioTraffic(dt);

    this.behaviorCtx.playerX = this.playerX;
    this.behaviorCtx.playerZ = this.playerZ;
    this.behaviorCtx.playerSpeedMph = this.speedMph;

    for (let i = this.trafficList.length - 1; i >= 0; i--) {
      const v = this.trafficList[i];
      stepBehavior(v, this.behaviorCtx, dt);
      stepLateral(v, dt);
      const vMps = v.speed * 0.447;

      v.z -= vMps * dt;
      v.meshGroup.position.set(v.x, v.y, v.z);

      if (v.type === 'police') {
        const time = performance.now() * 0.008;
        const blue = v.meshGroup.getObjectByName('policeBlue') as THREE.Mesh;
        const red = v.meshGroup.getObjectByName('policeRed') as THREE.Mesh;
        if (blue && red) {
          (blue.material as THREE.MeshStandardMaterial).emissiveIntensity = Math.sin(time) > 0 ? 3.0 : 0.2;
          (red.material as THREE.MeshStandardMaterial).emissiveIntensity = Math.sin(time) <= 0 ? 3.0 : 0.2;
        }
      }

      if (v.z > this.playerZ + 120 || v.z < this.playerZ - 350) {
        this.trafficGroup.remove(v.meshGroup);
        this.trafficList.splice(i, 1);
      }
    }
  }

  /** Spawns a vehicle that drifts into the driver's blind spot every so often. */
  private updateScenarioTraffic(dt: number) {
    if (this.speedMph < 25 || this.distanceDrivenMiles > this.totalDistanceMiles - 0.35) return;
    this.lurkerClock += dt;
    if (this.lurkerClock < this.nextLurkerAt) return;
    if (this.trafficList.some((v) => v.behavior?.startsWith('lurker'))) return;

    const lanes = this.laneCenters;
    const idx = lanes.indexOf(nearestLaneCenter(this.playerX, lanes));
    const spawnZ = this.playerZ + 40;
    const free = [idx - 1, idx + 1].filter(
      (i) =>
        i >= 0 &&
        i < lanes.length &&
        !this.trafficList.some((o) => Math.abs(o.x - lanes[i]) < 2.5 && Math.abs(o.z - spawnZ) < 18)
    );
    if (free.length === 0) {
      this.nextLurkerAt = this.lurkerClock + 4;
      return;
    }

    const lane = lanes[free[Math.floor(Math.random() * free.length)]];
    const kinds: TrafficVehicleType[] = ['sedan', 'suv', 'pickup'];
    const v = this.spawnTrafficAt(lane, spawnZ, {
      type: kinds[Math.floor(Math.random() * kinds.length)],
      speed: this.speedMph + 12,
      track: false,
    });
    beginLurker(v);
    this.lurkerClock = 0;
    this.nextLurkerAt = 22 + Math.random() * 10;
  }

  /** Puts an aggressive pickup right behind the player (seen in the rearview mirror). */
  public spawnTailgater() {
    if (this.tailgater && this.trafficList.includes(this.tailgater)) return;
    const lane = nearestLaneCenter(this.playerX, this.laneCenters);
    this.tailgater = this.spawnTrafficAt(lane, this.playerZ + 26, {
      type: 'pickup',
      speed: this.speedMph + 14,
      behavior: 'tailgater',
      track: false,
    });
  }

  /** The player has decided how to respond; the tailgater swings around or drops back. */
  public resolveTailgater() {
    const v = this.tailgater;
    this.tailgater = null;
    if (!v || v.behavior !== 'tailgater') return;
    this.behaviorCtx.playerX = this.playerX;
    this.behaviorCtx.playerZ = this.playerZ;
    this.behaviorCtx.playerSpeedMph = this.speedMph;
    releaseTailgater(v, this.behaviorCtx, this.trafficList);
  }

  private updateRoadSegments() {
    this.roadSegments.forEach((segment) => {
      if (segment.position.z > this.playerZ + this.segmentLength) {
        segment.position.z -= this.totalSegments * this.segmentLength;
      }
    });

    if (this.rainParticles && this.rainParticles.visible) {
      this.rainParticles.position.set(this.playerX, 0, this.playerZ);
    }
  }

  private checkCollisions() {
    this._playerBox.setFromCenterAndSize(
      new THREE.Vector3(this.playerX, 0.75, this.playerZ),
      new THREE.Vector3(1.9, 1.4, 4.2)
    );

    for (const v of this.trafficList) {
      this._trafficBox.setFromCenterAndSize(
        new THREE.Vector3(v.x, 0.8, v.z),
        new THREE.Vector3(v.width * 0.88, 1.4, v.length * 0.88)
      );

      if (this._playerBox.intersectsBox(this._trafficBox)) {
        this.triggerCrash(v.type);
        return;
      }

      const dx = Math.abs(this.playerX - v.x);
      const dz = Math.abs(this.playerZ - v.z);
      if (dx < 2.5 && dz < 5.5 && this.speedMph > 40 && this.elapsedSec - this.lastNearMissAt > 2.5) {
        this.lastNearMissAt = this.elapsedSec;
        this.callbacks.onNearMiss();
      }
    }
  }

  private triggerCrash(hitVehicleType: string) {
    this.isCrashed = true;
    soundManager.playCrashSound();

    this.playerCarGroup.rotation.z = (Math.random() - 0.5) * 0.4;
    this.playerCarGroup.rotation.y = (Math.random() - 0.5) * 0.6;
    this.speedMph = 0;
    this.look.clear();

    this.callbacks.onCollision(hitVehicleType);
  }

  private updateCameraAndCockpit(dt: number) {
    this.playerCarGroup.position.set(this.playerX, 0, this.playerZ);

    this.cockpit.update(dt, {
      steeringAngle: this.steeringAngle,
      wipersOn: this.controlsState.wipers,
      raining: this.currentChapter === 'DRIVE_HOME',
    });

    if (this.cameraMode === 'cockpit') {
      const accelPitch = (this.throttleInput > 0 ? -0.015 : 0) + (this.brakeInput > 0 ? 0.03 : 0);
      this.camPitchOff = THREE.MathUtils.damp(this.camPitchOff, accelPitch * 0.5, 8, dt);
      this.camYawOff = THREE.MathUtils.damp(this.camYawOff, -this.steeringAngle * 0.04, 8, dt);
      this.camRoll = THREE.MathUtils.damp(this.camRoll, -this.steeringAngle * 0.025, 8, dt);
      const roadVibe = (Math.random() - 0.5) * 0.002 * (this.speedMph / 50);

      // The head pivots about the neck, so looking sideways also moves the eye a little.
      const eye = headEyePosition(this.look.yaw, this.look.pitch, this.look.leanX, this.look.leanZ);
      this.camera.position.set(eye.x - this.steeringAngle * 0.03, eye.y + accelPitch + roadVibe, eye.z);
      this.camera.rotation.set(
        this.look.pitch * D2R + this.camPitchOff,
        this.look.yaw * D2R + this.camYawOff,
        this.camRoll
      );
      if (Math.abs(this.camera.fov - this.look.fov) > 0.05) {
        this.camera.fov = this.look.fov;
        this.camera.updateProjectionMatrix();
      }
    } else {
      this.camera.position.set(0, 1.15, -1.8);
      this.camera.rotation.set(0, 0, 0);
    }

    // Instrument cluster (about 30 Hz is plenty for gauges)
    this.clusterTimer += dt;
    if (this.clusterTimer >= 1 / 30) {
      this.clusterTimer = 0;
      this.cluster.update({
        speedMph: this.speedMph,
        rpm: this.rpm,
        limitMph: this.speedLimitMph,
        signal: this.controlsState.turnSignal,
        hazards: this.controlsState.hazards,
        headlights: this.controlsState.headlights,
        wipers: this.controlsState.wipers,
        gapSec: this.awareness.followGapSec,
        secondsSinceScan: this.awareness.secondsSinceScan,
        eyesOffRoad: this.awareness.eyesOffRoadSec > 1.5,
        tripMiles: this.distanceDrivenMiles,
        clock: formatGameClock(this.elapsedSec),
        time: this.elapsedSec,
      });
      this.clusterTexture.needsUpdate = true;
    }

    // Infotainment screen (cheaper, so it updates less often)
    this.gpsTimer += dt;
    if (this.gpsTimer >= 0.125) {
      this.gpsTimer = 0;
      const progress = Math.min(1, this.distanceDrivenMiles / this.totalDistanceMiles);
      const destName = this.currentChapter === 'DRIVE_HOME' ? 'Home Sweet Home' : 'Orange County Courthouse';
      const turnText = this.currentChapter === 'DRIVE_HOME'
        ? 'In 1.2 mi: Exit for Suburban Heights'
        : (progress > 0.8 ? 'Take Exit 14 for County Courthouse' : 'Follow FL-408 E toward Courthouse');
      this.updateGpsCanvas(progress, destName, turnText);
    }
  }

  public onWindowResize = () => {
    if (!this.container || !this.renderer || !this.camera) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  public dispose() {
    this.stop();
    window.removeEventListener('resize', this.onWindowResize);
    try {
      this.renderer.dispose();
      (['rear', 'left', 'right'] as MirrorKey[]).forEach((k) => this.mirrorTargets[k].dispose());
      this.gpsTexture.dispose();
      this.clusterTexture.dispose();
      const el = this.renderer.domElement;
      el.removeEventListener('pointerdown', this.onPointerDown);
      el.removeEventListener('pointermove', this.onPointerMove);
      el.removeEventListener('pointerup', this.onPointerUp);
      el.removeEventListener('pointercancel', this.onPointerUp);
      if (this.container.contains(this.renderer.domElement)) {
        this.container.removeChild(this.renderer.domElement);
      }
    } catch (_) {}
  }
}
