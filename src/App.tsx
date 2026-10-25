/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { DrivingEngine, EngineCallbacks } from './game/threeEngine';
import { soundManager } from './audio/soundManager';
import {
  GameChapter,
  DrivingStats,
  DrivingDecisionEvent,
  InGameTextMessage,
  CarControlsState,
  DriverAwarenessSnapshot,
  DrivingFeedback,
  LookTarget,
} from './types/game';
import { DRIVE_TIME_LIMIT_SEC } from './game/clock';
import { TitleScreen } from './components/TitleScreen';
import { RenpyWakeUpScene } from './components/RenpyWakeUpScene';
import { DrivingHUD } from './components/DrivingHUD';
import { EventModal } from './components/EventModal';
import { CourthouseOrientation } from './components/CourthouseOrientation';
import { ArrivalHomeScene } from './components/ArrivalHomeScene';
import { GameOverModal } from './components/GameOverModal';
import { PauseModal } from './components/PauseModal';

const INITIAL_DRIVER_STATE: DriverAwarenessSnapshot = {
  gazeZone: 'road',
  yawDeg: 0,
  pitchDeg: 0,
  eyesOffRoadSec: 0,
  secondsSinceScan: 0,
  followGapSec: null,
  laneIndex: 1,
  elapsedSec: 0,
};

function createInitialStats(): DrivingStats {
  return {
    speedMph: 0,
    topSpeedMph: 0,
    distanceDrivenMiles: 0,
    totalDistanceMiles: 3.5,
    timeRemainingSec: 180,
    targetArrivalSec: 180,
    elapsedSec: 0,
    speedingViolations: 0,
    policeStops: 0,
    phoneDistractionsResisted: 0,
    phoneDistractionsEngaged: 0,
    roadRageDeescalated: 0,
    roadRageEscalated: 0,
    nearMisses: 0,
    collisions: 0,
    defensiveDrivingScore: 100,
    civicResponsibilityScore: 100,
    arrivedOnTime: true,
    orientationDecisions: {
      putPhoneAway: true,
      listenedAttentively: true,
      civicReflectionAnswer: 'protection',
    },
    mirrorChecks: 0,
    shoulderChecks: 0,
    safeLaneChanges: 0,
    unsafeLaneChanges: 0,
    tailgatingEvents: 0,
    eyesOffRoadWarnings: 0,
    secondsSinceScan: 0,
  };
}

/** Which look target (if any) a key press means. Digits use the physical key; Z/X use the letter. */
function lookTargetForKey(e: KeyboardEvent): LookTarget | null {
  if (e.code === 'Digit1' || e.code === 'Numpad1') return 'mirror_left';
  if (e.code === 'Digit2' || e.code === 'Numpad2') return 'mirror_rear';
  if (e.code === 'Digit3' || e.code === 'Numpad3') return 'mirror_right';
  const k = e.key.toLowerCase();
  if (k === 'z') return 'shoulder_left';
  if (k === 'x') return 'shoulder_right';
  return null;
}

const FEEDBACK_VISIBLE_MS = 6500;

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<DrivingEngine | null>(null);

  // Game Chapter State
  const [currentChapter, setCurrentChapter] = useState<GameChapter>('TITLE');
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [cameraMode, setCameraMode] = useState<'cockpit' | 'hood'>('cockpit');
  const [activeEvent, setActiveEvent] = useState<DrivingDecisionEvent | null>(null);
  const [crashedVehicleType, setCrashedVehicleType] = useState<string>('vehicle');

  // Driving Telemetry & Stats
  const [speedMph, setSpeedMph] = useState(0);
  const [rpm, setRpm] = useState(800);
  const [distanceDrivenMiles, setDistanceDrivenMiles] = useState(0);
  const [totalDistanceMiles, setTotalDistanceMiles] = useState(3.5);
  const [timeRemainingSec, setTimeRemainingSec] = useState(180);

  // Car Controls State
  const [controlsState, setControlsState] = useState<CarControlsState>({
    turnSignal: 'off',
    hazards: false,
    headlights: false,
    wipers: false,
    radioOn: true,
    radioStation: 1, // Lo-Fi Synthwave
    radioVolume: 0.6,
    acFanSpeed: 2,
  });

  // Active In-Car Phone Message
  const [activePhoneMessage, setActivePhoneMessage] = useState<InGameTextMessage | null>(null);

  const [stats, setStats] = useState<DrivingStats>(createInitialStats);

  // Defensive-driving awareness (head look, scanning, following distance)
  const [driverState, setDriverState] = useState<DriverAwarenessSnapshot>(INITIAL_DRIVER_STATE);
  const [feedbackItems, setFeedbackItems] = useState<DrivingFeedback[]>([]);
  const driverStateRef = useRef<DriverAwarenessSnapshot>(INITIAL_DRIVER_STATE);
  const pendingTailgaterRef = useRef(false);
  const tailgaterTimerRef = useRef<number | null>(null);

  const currentChapterRef = useRef<GameChapter>(currentChapter);
  currentChapterRef.current = currentChapter;

  const activeEventRef = useRef<DrivingDecisionEvent | null>(activeEvent);
  activeEventRef.current = activeEvent;

  const isPausedRef = useRef(false);
  isPausedRef.current = isPaused;

  const triggeredEventsRef = useRef<Set<string>>(new Set());
  const phoneMessageTimerRef = useRef<number | null>(null);
  const keysDown = useRef<{ [key: string]: boolean }>({});

  const pushFeedback = useCallback((fb: Omit<DrivingFeedback, 'id'> & { id?: number }) => {
    const item: DrivingFeedback = { ...fb, id: fb.id ?? Date.now() + Math.random() };
    setFeedbackItems((prev) => [...prev.slice(-3), item]);
    window.setTimeout(() => {
      setFeedbackItems((prev) => prev.filter((x) => x.id !== item.id));
    }, FEEDBACK_VISIBLE_MS);
  }, []);

  const showTailgaterDecision = useCallback(() => {
    if (!pendingTailgaterRef.current) return;
    pendingTailgaterRef.current = false;
    if (tailgaterTimerRef.current) {
      clearTimeout(tailgaterTimerRef.current);
      tailgaterTimerRef.current = null;
    }
    setActiveEvent({
      id: 'ch1_roadrage',
      title: 'Aggressive Tailgater on Highway',
      description:
        'The pickup you just saw in your mirror is riding your bumper, flashing its high beams and leaning on the horn.',
      prompt: 'How do you handle the aggressive driver?',
      options: [
        {
          id: 'deescalate',
          text: 'Indicate right, check side mirror, and let them pass',
          description: 'De-escalate the tension and protect both vehicles from a high-speed rear-end collision.',
          impact: 'safe',
        },
        {
          id: 'brake_check',
          text: 'Tap your brakes firmly to teach them a lesson',
          description: 'Extremely hazardous road rage maneuver that causes severe multi-vehicle pileups.',
          impact: 'reckless',
        },
      ],
    });
  }, []);

  const updateInputs = useCallback(() => {
    if (!engineRef.current || isPaused) return;

    let throttle = 0;
    let brake = 0;
    let steer = 0;

    const k = keysDown.current;
    if (k['w'] || k['arrowup'] || k['keyw']) throttle = 1;
    if (k['s'] || k['arrowdown'] || k['keys']) brake = 1;
    if (k[' '] || k['space']) brake = 1.8;
    if (k['a'] || k['arrowleft'] || k['keya']) steer -= 1;
    if (k['d'] || k['arrowright'] || k['keyd']) steer += 1;

    engineRef.current.throttleInput = throttle;
    engineRef.current.brakeInput = brake;
    engineRef.current.steerInput = steer;
  }, [isPaused]);

  // Incoming Phone Message Queue for frequent messages during driving
  const incomingMessagesQueue: InGameTextMessage[] = [
    {
      id: 'msg_mom_1',
      sender: 'Mom',
      avatarColor: 'bg-rose-500 text-white',
      preview: 'Did you grab your summons card?',
      fullText: 'Honey, did you remember your summons card and ID? Check your glovebox if you don’t have it!',
      timestamp: '8:32 AM',
    },
    {
      id: 'msg_boss_1',
      sender: 'Boss (Miller)',
      avatarColor: 'bg-sky-600 text-white',
      preview: 'Are you coming in after check-in?',
      fullText: 'Hey, are you able to remote in after juror orientation? The county hearing document needs review!',
      timestamp: '8:36 AM',
    },
    {
      id: 'msg_alex_1',
      sender: 'Alex (Best Friend)',
      avatarColor: 'bg-amber-500 text-slate-950',
      preview: 'Bro jury duty?! LMAO',
      fullText: 'Bro jury duty on a Monday?! Enjoy the stale courthouse coffee haha! Snap me a pic from the courtroom!',
      timestamp: '8:41 AM',
    },
    {
      id: 'msg_mom_2',
      sender: 'Mom',
      avatarColor: 'bg-rose-500 text-white',
      preview: 'Watch out for rain near exit 12',
      fullText: 'Traffic report says heavy rain clouds over downtown. Keep both hands on the wheel sweetie!',
      timestamp: '8:44 AM',
    },
  ];

  // Trigger frequent text messages
  const scheduleNextTextMessage = useCallback(() => {
    if (phoneMessageTimerRef.current) clearTimeout(phoneMessageTimerRef.current);

    phoneMessageTimerRef.current = window.setTimeout(() => {
      const ch = currentChapterRef.current;
      if (ch === 'DRIVE_TO_COURTHOUSE' || ch === 'DRIVE_HOME') {
        const unread = incomingMessagesQueue[Math.floor(Math.random() * incomingMessagesQueue.length)];
        soundManager.playPhoneChime();
        soundManager.playPhoneBuzz();
        setActivePhoneMessage(unread);
        if (engineRef.current) {
          engineRef.current.latestPhoneTicker = `${unread.sender}: ${unread.preview}`;
        }
      }
      scheduleNextTextMessage();
    }, 24000); // Trigger every ~24 seconds while driving
  }, []);

  // Check major story events
  const checkEventTriggers = useCallback((miles: number) => {
    if (activeEventRef.current) return;
    const chapter = currentChapterRef.current;

    if (chapter === 'DRIVE_TO_COURTHOUSE') {
      if (miles >= 1.0 && !triggeredEventsRef.current.has('ch1_phone')) {
        triggeredEventsRef.current.add('ch1_phone');
        soundManager.playPhoneChime();
        setActiveEvent({
          id: 'ch1_phone',
          title: 'Incoming Text Alert',
          sender: 'Work Manager (Urgent)',
          description: 'Your phone buzzes loudly on the passenger seat with two unread messages: "Where are you?! The county hearing docs must be signed!"',
          prompt: 'How do you respond while driving at 50 MPH?',
          options: [
            {
              id: 'ignore_phone',
              text: 'Leave phone alone & keep eyes focused on highway traffic',
              description: 'Zero distraction. You will address messages after parking safely at the courthouse.',
              impact: 'safe',
            },
            {
              id: 'glance_phone',
              text: 'Quickly glance down at the screen while steering',
              description: 'Takes your eyes off the highway for 3 seconds—equivalent to traveling 200 feet blindfolded.',
              impact: 'risky',
            },
          ],
        });
      } else if (miles >= 2.2 && !triggeredEventsRef.current.has('ch1_roadrage')) {
        triggeredEventsRef.current.add('ch1_roadrage');
        // A real pickup appears behind you. Check the mirror to see it, then decide.
        engineRef.current?.spawnTailgater();
        pendingTailgaterRef.current = true;
        pushFeedback({
          code: 'tailgater_alert',
          kind: 'warn',
          title: 'Something is closing fast behind you',
          detail: 'Check your rearview mirror: hold 2 (or tap Rear).',
          scoreDelta: 0,
        });
        tailgaterTimerRef.current = window.setTimeout(showTailgaterDecision, 7000);
      }
    } else if (chapter === 'DRIVE_HOME') {
      if (miles >= 1.0 && !triggeredEventsRef.current.has('ch3_rain')) {
        triggeredEventsRef.current.add('ch3_rain');
        setActiveEvent({
          id: 'ch3_rain',
          title: 'Sudden Florida Rain Squall',
          description: 'Dark storm clouds unleash heavy rain across the highway. Road markings blur and water puddles create hydroplaning hazards.',
          prompt: 'How do you adapt your driving to wet weather?',
          options: [
            {
              id: 'safe_rain',
              text: 'Turn on wipers, increase following distance, ease to 40 MPH',
              description: 'Prevent hydroplaning, double your braking buffer, and maintain full traction.',
              impact: 'safe',
            },
            {
              id: 'speed_rain',
              text: 'Maintain 60 MPH to get through the storm quickly',
              description: 'High risk of losing tire grip and spinning into the median guardrail.',
              impact: 'risky',
            },
          ],
        });
      } else if (miles >= 2.2 && !triggeredEventsRef.current.has('ch3_police')) {
        triggeredEventsRef.current.add('ch3_police');
        setActiveEvent({
          id: 'ch3_police',
          title: 'Florida Highway Patrol Speed Trap',
          description: 'You spot a state trooper parked with radar on the right shoulder under the overhead highway sign. The posted speed limit is 50 MPH.',
          prompt: 'Check your speedometer and lane position:',
          options: [
            {
              id: 'obey_speed',
              text: 'Check speedometer, maintain smooth 48 MPH in middle lane',
              description: 'Respect traffic laws and move over safely to give law enforcement roadside buffer.',
              impact: 'safe',
            },
            {
              id: 'weave_police',
              text: 'Accelerate past slower traffic in the left passing lane',
              description: 'Risks an immediate traffic stop, citation, and points on your license.',
              impact: 'risky',
            },
          ],
        });
      }
    }
  }, [pushFeedback, showTailgaterDecision]);

  const callbacksRef = useRef<EngineCallbacks>({
    onSpeedUpdate: () => {},
    onDistanceUpdate: () => {},
    onCollision: () => {},
    onNearMiss: () => {},
    onSpeedingViolation: () => {},
    onDestinationReached: () => {},
    onDriverState: () => {},
    onFeedback: () => {},
    onControlsChanged: () => {},
  });

  callbacksRef.current = {
    onSpeedUpdate: (speed, engineRpm) => {
      setSpeedMph(speed);
      setRpm(engineRpm);
      setStats((prev) => ({
        ...prev,
        speedMph: speed,
        topSpeedMph: Math.max(prev.topSpeedMph, speed),
      }));
    },
    onDistanceUpdate: (milesDriven, total) => {
      setDistanceDrivenMiles(milesDriven);
      setTotalDistanceMiles(total);
      checkEventTriggers(milesDriven);
    },
    onCollision: (hitType) => {
      setCrashedVehicleType(hitType);
      setCurrentChapter('GAME_OVER_CRASH');
      setStats((prev) => ({
        ...prev,
        collisions: prev.collisions + 1,
        defensiveDrivingScore: 0,
        secondsSinceScan: driverStateRef.current.secondsSinceScan,
      }));
    },
    onNearMiss: () => {
      setStats((prev) => ({
        ...prev,
        nearMisses: prev.nearMisses + 1,
        defensiveDrivingScore: Math.max(10, prev.defensiveDrivingScore - 8),
      }));
    },
    onSpeedingViolation: () => {
      setStats((prev) => ({
        ...prev,
        speedingViolations: prev.speedingViolations + 1,
        defensiveDrivingScore: Math.max(10, prev.defensiveDrivingScore - 12),
      }));
    },
    onDriverState: (state) => {
      driverStateRef.current = state;
      setDriverState(state);
      setTimeRemainingSec(Math.max(0, DRIVE_TIME_LIMIT_SEC - Math.floor(state.elapsedSec)));
    },
    onFeedback: (fb) => {
      setStats((prev) => {
        const next = { ...prev };
        if (fb.scoreDelta) {
          next.defensiveDrivingScore = Math.min(100, Math.max(10, prev.defensiveDrivingScore + fb.scoreDelta));
        }
        if (fb.nearMiss) next.nearMisses = prev.nearMisses + 1;
        switch (fb.stat) {
          case 'mirrorCheck':
            next.mirrorChecks = prev.mirrorChecks + 1;
            break;
          case 'shoulderCheck':
            next.shoulderChecks = prev.shoulderChecks + 1;
            break;
          case 'safeLaneChange':
            next.safeLaneChanges = prev.safeLaneChanges + 1;
            break;
          case 'unsafeLaneChange':
            next.unsafeLaneChanges = prev.unsafeLaneChanges + 1;
            break;
          case 'tailgating':
            next.tailgatingEvents = prev.tailgatingEvents + 1;
            break;
          case 'eyesOff':
            next.eyesOffRoadWarnings = prev.eyesOffRoadWarnings + 1;
            break;
        }
        return next;
      });

      if (!fb.silent) {
        if (fb.kind === 'good') soundManager.playScanChime();
        else if (fb.kind === 'warn' || fb.kind === 'bad') soundManager.playWarningBeep();
        pushFeedback(fb);
      }

      // Seeing the tailgater in the rearview mirror is what triggers the decision.
      if (fb.code === 'gaze_mirror_rear' && pendingTailgaterRef.current) {
        window.setTimeout(showTailgaterDecision, 900);
      }
    },
    onControlsChanged: (controls) => {
      setControlsState((prev) => ({ ...prev, ...controls }));
    },
    onDestinationReached: () => {
      const ch = currentChapterRef.current;
      if (ch === 'DRIVE_TO_COURTHOUSE') {
        engineRef.current?.stop();
        setCurrentChapter('ORIENTATION');
      } else if (ch === 'DRIVE_HOME') {
        engineRef.current?.stop();
        setCurrentChapter('ARRIVAL_HOME');
      }
    },
  };

  // Initialize Three.js Engine ONCE on mount
  useEffect(() => {
    if (!mountRef.current) return;

    const engine = new DrivingEngine(mountRef.current, {
      onSpeedUpdate: (speed, rpm) => callbacksRef.current.onSpeedUpdate(speed, rpm),
      onDistanceUpdate: (miles, total) => callbacksRef.current.onDistanceUpdate(miles, total),
      onCollision: (hit) => callbacksRef.current.onCollision(hit),
      onNearMiss: () => callbacksRef.current.onNearMiss(),
      onSpeedingViolation: () => callbacksRef.current.onSpeedingViolation(),
      onDestinationReached: () => callbacksRef.current.onDestinationReached(),
      onDriverState: (state) => callbacksRef.current.onDriverState?.(state),
      onFeedback: (fb) => callbacksRef.current.onFeedback?.(fb),
      onControlsChanged: (controls) => callbacksRef.current.onControlsChanged?.(controls),
    });

    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
      if (phoneMessageTimerRef.current) clearTimeout(phoneMessageTimerRef.current);
    };
  }, []);

  // Keyboard Event Listeners for full car controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const code = e.code.toLowerCase();
      keysDown.current[key] = true;
      keysDown.current[code] = true;

      // Head look: hold 1/2/3 for mirrors, Z/X for over-the-shoulder checks
      const lookTarget = lookTargetForKey(e);
      if (lookTarget && !isPausedRef.current && !activeEventRef.current) {
        engineRef.current?.pressLook(lookTarget);
      }

      // Turn signals: Q for Left, E for Right
      if (key === 'q') {
        engineRef.current?.toggleTurnSignal('left');
        setControlsState((prev) => ({
          ...prev,
          turnSignal: prev.turnSignal === 'left' ? 'off' : 'left',
        }));
      } else if (key === 'e') {
        engineRef.current?.toggleTurnSignal('right');
        setControlsState((prev) => ({
          ...prev,
          turnSignal: prev.turnSignal === 'right' ? 'off' : 'right',
        }));
      }

      // Hazards: F
      if (key === 'f') {
        engineRef.current?.toggleHazards();
        setControlsState((prev) => ({ ...prev, hazards: !prev.hazards }));
      }

      // Headlights: L
      if (key === 'l') {
        engineRef.current?.toggleHeadlights();
        setControlsState((prev) => ({ ...prev, headlights: !prev.headlights }));
      }

      // Windshield Wipers: K
      if (key === 'k') {
        engineRef.current?.toggleWipers();
        setControlsState((prev) => ({ ...prev, wipers: !prev.wipers }));
      }

      // Horn: H
      if (key === 'h' && !e.repeat) {
        engineRef.current?.pressHorn();
      }

      // Pause
      if (key === 'p' || key === 'escape') {
        const ch = currentChapterRef.current;
        if ((ch === 'DRIVE_TO_COURTHOUSE' || ch === 'DRIVE_HOME') && !activeEventRef.current) {
          setIsPaused((prev) => {
            const next = !prev;
            if (next) engineRef.current?.pause();
            else engineRef.current?.resume();
            return next;
          });
        }
      }

      // Camera: C
      if (key === 'c') {
        setCameraMode((prev) => {
          const next = prev === 'cockpit' ? 'hood' : 'cockpit';
          engineRef.current?.setCameraMode(next);
          return next;
        });
      }

      updateInputs();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const code = e.code.toLowerCase();
      keysDown.current[key] = false;
      keysDown.current[code] = false;

      const releasedLook = lookTargetForKey(e);
      if (releasedLook) engineRef.current?.releaseLook(releasedLook);

      if (key === 'h') {
        engineRef.current?.releaseHorn();
      }

      updateInputs();
    };

    const handleBlur = () => engineRef.current?.clearLook();

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [updateInputs]);

  // While a decision modal is open the simulation freezes, so the player is not
  // driving blind behind a blurred overlay.
  const prevEventRef = useRef<DrivingDecisionEvent | null>(null);
  useEffect(() => {
    const engine = engineRef.current;
    if (engine) {
      if (activeEvent) {
        engine.clearLook();
        engine.pause();
      } else if (prevEventRef.current && !isPausedRef.current) {
        engine.resume();
      }
    }
    prevEventRef.current = activeEvent;
  }, [activeEvent]);

  // Start or transition chapters
  const handleStartChapter = (chapter: GameChapter) => {
    soundManager.playButtonClick();
    setCurrentChapter(chapter);
    setIsPaused(false);
    setActiveEvent(null);
    setActivePhoneMessage(null);

    if (chapter === 'DRIVE_TO_COURTHOUSE' || chapter === 'DRIVE_HOME') {
      setDistanceDrivenMiles(0);
      setTotalDistanceMiles(3.5);
      setTimeRemainingSec(180);
      triggeredEventsRef.current.clear();
      pendingTailgaterRef.current = false;
      if (tailgaterTimerRef.current) {
        clearTimeout(tailgaterTimerRef.current);
        tailgaterTimerRef.current = null;
      }
      setFeedbackItems([]);
      setDriverState(INITIAL_DRIVER_STATE);
      driverStateRef.current = INITIAL_DRIVER_STATE;
      engineRef.current?.startDrive(chapter);
      scheduleNextTextMessage();
    }
  };

  // Car Controls Handlers
  const handleToggleTurnSignal = (dir: 'left' | 'right') => {
    engineRef.current?.toggleTurnSignal(dir);
    setControlsState((prev) => ({
      ...prev,
      turnSignal: prev.turnSignal === dir ? 'off' : dir,
    }));
  };

  const handleToggleHazards = () => {
    engineRef.current?.toggleHazards();
    setControlsState((prev) => ({ ...prev, hazards: !prev.hazards }));
  };

  const handleToggleHeadlights = () => {
    engineRef.current?.toggleHeadlights();
    setControlsState((prev) => ({ ...prev, headlights: !prev.headlights }));
  };

  const handleToggleWipers = () => {
    engineRef.current?.toggleWipers();
    setControlsState((prev) => ({ ...prev, wipers: !prev.wipers }));
  };

  const handleNextRadioStation = () => {
    engineRef.current?.nextRadioStation();
    setControlsState((prev) => ({
      ...prev,
      radioStation: (prev.radioStation + 1) % 4,
      radioOn: true,
    }));
  };

  const handleToggleRadioPower = () => {
    engineRef.current?.toggleRadioPower();
    setControlsState((prev) => ({ ...prev, radioOn: !prev.radioOn }));
  };

  // Phone Actions
  const handlePhoneAction = (action: 'ignore' | 'reply_safe' | 'glance_distracted') => {
    soundManager.playButtonClick();
    setActivePhoneMessage(null);

    setStats((prev) => {
      if (action === 'ignore' || action === 'reply_safe') {
        return {
          ...prev,
          phoneDistractionsResisted: prev.phoneDistractionsResisted + 1,
          defensiveDrivingScore: Math.min(100, prev.defensiveDrivingScore + 10),
        };
      } else {
        // Distracted driving penalty and brief steering wobble
        if (engineRef.current) {
          engineRef.current.playerX += (Math.random() - 0.5) * 1.5;
        }
        return {
          ...prev,
          phoneDistractionsEngaged: prev.phoneDistractionsEngaged + 1,
          defensiveDrivingScore: Math.max(10, prev.defensiveDrivingScore - 15),
        };
      }
    });
  };

  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    soundManager.setMuted(next);
  };

  const handleToggleCamera = () => {
    const next = cameraMode === 'cockpit' ? 'hood' : 'cockpit';
    setCameraMode(next);
    engineRef.current?.setCameraMode(next);
  };

  const isDrivingChapter =
    currentChapter === 'DRIVE_TO_COURTHOUSE' || currentChapter === 'DRIVE_HOME';

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans select-none">
      {/* 1. Dedicated WebGL Canvas Container */}
      <div ref={mountRef} className="absolute inset-0 z-0 w-full h-full" />

      {/* 2. Title Screen */}
      {currentChapter === 'TITLE' && (
        <TitleScreen
          onStartGame={(target) => {
            if (target === 'INTRO') setCurrentChapter('INTRO');
            else if (target === 'ORIENTATION') setCurrentChapter('ORIENTATION');
            else if (target === 'DRIVE_HOME') handleStartChapter('DRIVE_HOME');
            else handleStartChapter('DRIVE_TO_COURTHOUSE');
          }}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
        />
      )}

      {/* 3. Ren'Py Visual Novel Wake Up Prologue */}
      {currentChapter === 'INTRO' && (
        <RenpyWakeUpScene onComplete={() => handleStartChapter('DRIVE_TO_COURTHOUSE')} />
      )}

      {/* 4. Active Driving HUD & Vehicle Controls */}
      {isDrivingChapter && (
        <DrivingHUD
          speedMph={speedMph}
          rpm={rpm}
          distanceDrivenMiles={distanceDrivenMiles}
          totalDistanceMiles={totalDistanceMiles}
          timeRemainingSec={timeRemainingSec}
          speedLimitMph={50}
          defensiveScore={stats.defensiveDrivingScore}
          civicScore={stats.civicResponsibilityScore}
          chapterTitle={
            currentChapter === 'DRIVE_TO_COURTHOUSE'
              ? 'Chapter 1: Drive to Courthouse'
              : 'Chapter 3: Drive Home (Rain)'
          }
          isMuted={isMuted}
          cameraMode={cameraMode}
          controlsState={controlsState}
          activePhoneMessage={activePhoneMessage}
          driverState={driverState}
          feedback={feedbackItems}
          onLook={(target, pressed) => {
            if (pressed) engineRef.current?.pressLook(target);
            else engineRef.current?.releaseLook(target);
          }}
          onToggleMute={handleToggleMute}
          onToggleCamera={handleToggleCamera}
          onPause={() => {
            setIsPaused(true);
            engineRef.current?.clearLook();
            engineRef.current?.pause();
          }}
          onSteer={(dir) => {
            if (engineRef.current) engineRef.current.steerInput = dir;
          }}
          onThrottle={(val) => {
            if (engineRef.current) engineRef.current.throttleInput = val;
          }}
          onBrake={(val) => {
            if (engineRef.current) engineRef.current.brakeInput = val;
          }}
          onToggleTurnSignal={handleToggleTurnSignal}
          onToggleHazards={handleToggleHazards}
          onToggleHeadlights={handleToggleHeadlights}
          onToggleWipers={handleToggleWipers}
          onPressHorn={() => engineRef.current?.pressHorn()}
          onReleaseHorn={() => engineRef.current?.releaseHorn()}
          onNextRadioStation={handleNextRadioStation}
          onToggleRadioPower={handleToggleRadioPower}
          onPhoneAction={handlePhoneAction}
        />
      )}

      {/* 5. Mid-Drive Dynamic Decision Modal */}
      {activeEvent && (
        <EventModal
          event={activeEvent}
          onSelectOption={(optionId, impact) => {
            soundManager.playButtonClick();
            const eventId = activeEvent.id;
            setActiveEvent(null);
            if (eventId === 'ch1_roadrage') engineRef.current?.resolveTailgater();
            setStats((prev) => {
              let defDelta = impact === 'safe' ? 10 : impact === 'risky' ? -18 : -30;
              let civDelta = impact === 'safe' ? 10 : impact === 'risky' ? -10 : -25;
              const rageDelta =
                eventId === 'ch1_roadrage'
                  ? impact === 'safe'
                    ? { roadRageDeescalated: prev.roadRageDeescalated + 1 }
                    : { roadRageEscalated: prev.roadRageEscalated + 1 }
                  : {};
              return {
                ...prev,
                ...rageDelta,
                defensiveDrivingScore: Math.min(100, Math.max(10, prev.defensiveDrivingScore + defDelta)),
                civicResponsibilityScore: Math.min(100, Math.max(10, prev.civicResponsibilityScore + civDelta)),
              };
            });
          }}
        />
      )}

      {/* 6. Chapter 2: Courthouse Orientation Scene */}
      {currentChapter === 'ORIENTATION' && (
        <CourthouseOrientation
          stats={stats}
          onCompleteOrientation={(decisions) => {
            setStats((prev) => ({
              ...prev,
              orientationDecisions: decisions,
              civicResponsibilityScore: decisions.putPhoneAway
                ? prev.civicResponsibilityScore
                : Math.max(10, prev.civicResponsibilityScore - 15),
            }));
            handleStartChapter('DRIVE_HOME');
          }}
        />
      )}

      {/* 7. Chapter 4: Arrival at Home Scene with Mom */}
      {currentChapter === 'ARRIVAL_HOME' && (
        <ArrivalHomeScene
          stats={stats}
          onRestart={() => {
            setStats(createInitialStats());
            handleStartChapter('DRIVE_TO_COURTHOUSE');
          }}
        />
      )}

      {/* 8. Mandatory Crash Ending Modal */}
      {currentChapter === 'GAME_OVER_CRASH' && (
        <GameOverModal
          stats={stats}
          vehicleHitType={crashedVehicleType}
          onRestartNewRun={() => {
            setStats(createInitialStats());
            handleStartChapter('DRIVE_TO_COURTHOUSE');
          }}
        />
      )}

      {/* 9. Pause Modal */}
      {isPaused && (
        <PauseModal
          onResume={() => {
            setIsPaused(false);
            engineRef.current?.resume();
          }}
          onRestart={() => {
            setIsPaused(false);
            handleStartChapter(currentChapter);
          }}
          onQuitToTitle={() => {
            setIsPaused(false);
            engineRef.current?.stop();
            setCurrentChapter('TITLE');
          }}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          cameraMode={cameraMode}
          onToggleCamera={handleToggleCamera}
        />
      )}
    </div>
  );
}
