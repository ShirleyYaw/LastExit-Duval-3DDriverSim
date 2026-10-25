/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Volume2,
  VolumeX,
  Pause,
  Camera,
  ChevronDown,
  ChevronUp,
  Shield,
  Clock,
  Navigation,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Radio,
  Smartphone,
  Eye,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import {
  CarControlsState,
  DriverAwarenessSnapshot,
  DrivingFeedback,
  InGameTextMessage,
  LookTarget,
} from '../types/game';
import { DefensiveCoach } from './DefensiveCoach';
import { formatGameClock } from '../game/clock';
import { IOSMessagesThread, IOSNotification } from './ios/IOSKit';

interface DrivingHUDProps {
  speedMph: number;
  rpm: number;
  distanceDrivenMiles: number;
  totalDistanceMiles: number;
  timeRemainingSec: number;
  speedLimitMph: number;
  defensiveScore: number;
  civicScore: number;
  chapterTitle: string;
  isMuted: boolean;
  cameraMode: 'cockpit' | 'hood';
  controlsState: CarControlsState;
  activePhoneMessage: InGameTextMessage | null;
  driverState: DriverAwarenessSnapshot;
  feedback: DrivingFeedback[];
  onLook: (target: LookTarget, pressed: boolean) => void;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onPause: () => void;
  onSteer: (dir: number) => void;
  onThrottle: (val: number) => void;
  onBrake: (val: number) => void;
  onToggleTurnSignal: (dir: 'left' | 'right') => void;
  onToggleHazards: () => void;
  onToggleHeadlights: () => void;
  onToggleWipers: () => void;
  onPressHorn: () => void;
  onReleaseHorn: () => void;
  onNextRadioStation: () => void;
  onToggleRadioPower: () => void;
  onPhoneAction: (action: 'ignore' | 'reply_safe' | 'glance_distracted') => void;
}

export const DrivingHUD: React.FC<DrivingHUDProps> = ({
  speedMph,
  rpm,
  distanceDrivenMiles,
  totalDistanceMiles,
  timeRemainingSec,
  speedLimitMph,
  defensiveScore,
  civicScore,
  chapterTitle,
  isMuted,
  cameraMode,
  controlsState,
  activePhoneMessage,
  driverState,
  feedback,
  onLook,
  onToggleMute,
  onToggleCamera,
  onPause,
  onSteer,
  onThrottle,
  onBrake,
  onToggleTurnSignal,
  onToggleHazards,
  onToggleHeadlights,
  onToggleWipers,
  onPressHorn,
  onReleaseHorn,
  onNextRadioStation,
  onToggleRadioPower,
  onPhoneAction,
}) => {
  // On desktop the 3D dashboard is the main instrument panel, so the dock starts
  // compact. Touch devices need the buttons, so it starts open there.
  const [isDockCollapsed, setIsDockCollapsed] = useState(
    () => typeof window !== 'undefined' && !window.matchMedia('(pointer: coarse)').matches
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 't' && !e.repeat) setIsDockCollapsed((c) => !c);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const [activeTab, setActiveTab] = useState<'drive' | 'car_controls' | 'radio' | 'phone'>('drive');

  // The text you just sent (shown as a blue iMessage bubble for a few seconds).
  const [sentReply, setSentReply] = useState<{
    contact: string;
    received: string;
    time: string;
    text: string;
  } | null>(null);
  const sentTimerRef = useRef<number | null>(null);
  useEffect(() => () => {
    if (sentTimerRef.current) clearTimeout(sentTimerRef.current);
  }, []);

  const handleReply = () => {
    if (!activePhoneMessage) return;
    const text =
      activePhoneMessage.replyOptions?.find((o) => o.impact === 'distracted')?.text ?? 'On my way!';
    setSentReply({
      contact: activePhoneMessage.sender,
      received: activePhoneMessage.fullText,
      time: activePhoneMessage.timestamp,
      text,
    });
    if (sentTimerRef.current) clearTimeout(sentTimerRef.current);
    sentTimerRef.current = window.setTimeout(() => setSentReply(null), 4000);
    onPhoneAction('glance_distracted');
  };

  // Simulated clock time
  const elapsedSec = Math.max(0, 180 - timeRemainingSec);
  const formattedTime = formatGameClock(elapsedSec);
  const isRunningLate = elapsedSec >= 156; // 8:50 AM or later

  const isSpeeding = speedMph > speedLimitMph + 5;
  const progressPercent = Math.min(100, Math.round((distanceDrivenMiles / totalDistanceMiles) * 100));

  const radioStations = [
    '89.1 FL Civic News',
    '94.7 Synthwave Lo-Fi',
    '98.5 Highway Rock',
    '102.3 Classical FM',
  ];

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-3.5 select-none font-sans">
      {/* 1. Top Minimal Bar */}
      <div className="pointer-events-auto flex flex-wrap items-center justify-between gap-3 bg-slate-950/90 border border-slate-800 rounded-2xl px-4 py-2.5 text-slate-100 shadow-xl">
        {/* Objective & Progress */}
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-sky-500/20 text-sky-400 rounded-lg">
            <Navigation className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Current Route</div>
            <div className="text-sm font-bold text-white flex items-center gap-2">
              <span>{chapterTitle}</span>
              <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-slate-800 text-sky-300">
                {distanceDrivenMiles.toFixed(1)} / {totalDistanceMiles.toFixed(1)} mi ({progressPercent}%)
              </span>
            </div>
          </div>
        </div>

        {/* Clock, Speed Limit, Defensive Score */}
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <div className="flex flex-col">
              <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Arrival Due 9:00 AM</span>
              <span className={`text-sm font-mono font-bold ${isRunningLate ? 'text-rose-400' : 'text-slate-100'}`}>
                {formattedTime}
              </span>
            </div>
          </div>

          <div className={`flex flex-col items-center justify-center border-2 rounded px-2 py-0.5 min-w-[50px] ${
            isSpeeding ? 'bg-rose-950 border-rose-500 text-rose-200' : 'bg-slate-100 border-slate-900 text-slate-900'
          }`}>
            <span className="text-[8px] font-black uppercase tracking-tighter leading-tight">LIMIT</span>
            <span className="text-base font-black leading-none">{speedLimitMph}</span>
          </div>

          <div className="hidden sm:flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
            <Shield className={`w-4 h-4 ${defensiveScore > 75 ? 'text-emerald-400' : 'text-amber-400'}`} />
            <div className="flex flex-col text-right">
              <span className="text-[9px] uppercase tracking-wider text-slate-400">Defensive Score</span>
              <span className="text-xs font-bold text-white">{defensiveScore}%</span>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={onToggleCamera}
              className="p-2 bg-slate-900 hover:bg-slate-800 rounded-xl text-slate-200 border border-slate-800 transition cursor-pointer"
              title={`Switch View (Current: ${cameraMode})`}
            >
              <Camera className="w-4 h-4" />
            </button>
            <button
              onClick={onToggleMute}
              className="p-2 bg-slate-900 hover:bg-slate-800 rounded-xl text-slate-200 border border-slate-800 transition cursor-pointer"
              title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
            </button>
            <button
              onClick={onPause}
              className="p-2 bg-slate-900 hover:bg-slate-800 rounded-xl text-slate-200 border border-slate-800 transition cursor-pointer"
              title="Pause Game (Esc/P)"
            >
              <Pause className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Center Viewport HUD Alerts */}
      <div className="flex-1 flex flex-col items-center justify-between pointer-events-none py-2">
        {/* Defensive driving coach: gaze indicator, scan/gap chips, feedback toasts */}
        <DefensiveCoach driverState={driverState} feedback={feedback} cameraMode={cameraMode} />

        {/* Incoming text: native iPhone-style notification banner over the game UI */}
        {activePhoneMessage && (
          <div className="fixed inset-x-0 top-[72px] z-40 flex justify-center px-3 pointer-events-none">
          <IOSNotification
            className="pointer-events-auto w-full max-w-sm"
            icon="messages"
            title={activePhoneMessage.sender}
            body={activePhoneMessage.fullText}
            time="now"
          >
            <div className="flex items-center gap-2">
              <button
                onClick={() => onPhoneAction('ignore')}
                className="ios-action flex-1"
                style={{ color: '#007aff' }}
              >
                Ignore
              </button>
              <button
                onClick={handleReply}
                className="ios-action flex-1"
                style={{ color: '#ff3b30' }}
              >
                Reply
              </button>
            </div>
            <div className="ios-secondary text-[11px] text-center mt-1.5">
              Ignoring keeps you focused (+10 Safety). Replying while driving costs -15.
            </div>
          </IOSNotification>
          </div>
        )}
      </div>

      {/* 3. Sleek Collapsible Bottom Dock with Tabs: Drive, Car Controls, Radio, Phone */}
      <div className="pointer-events-auto flex flex-col items-center">
        {/* Collapse / Expand Toggle Button */}
        <button
          onClick={() => setIsDockCollapsed(!isDockCollapsed)}
          className="mb-1.5 px-3 py-1 bg-slate-900/90 border border-slate-800 rounded-t-lg text-xs font-medium text-slate-300 hover:text-white flex items-center gap-1.5 cursor-pointer shadow-md transition"
        >
          {isDockCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          <span>{isDockCollapsed ? 'Show Controls (T)' : 'Hide Controls (T)'}</span>
        </button>

        {!isDockCollapsed && (
          <div className="w-full max-w-4xl bg-slate-950/95 border border-slate-800 rounded-3xl p-3 sm:p-4 shadow-2xl flex flex-col gap-3 text-slate-100">
            {/* Dock Tab Selector */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setActiveTab('drive')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    activeTab === 'drive' ? 'bg-sky-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Drive & Look
                </button>
                <button
                  onClick={() => setActiveTab('car_controls')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'car_controls' ? 'bg-sky-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span>Vehicle Controls</span>
                  {(controlsState.turnSignal !== 'off' || controlsState.hazards) && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('radio')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'radio' ? 'bg-sky-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>Radio</span>
                </button>
                <button
                  onClick={() => setActiveTab('phone')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'phone' ? 'bg-sky-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Phone</span>
                  {activePhoneMessage && <span className="w-2 h-2 rounded-full bg-amber-400" />}
                </button>
              </div>

              {/* Speed readout on all tabs */}
              <div className="flex items-baseline gap-1">
                <span className={`text-2xl font-black font-mono ${isSpeeding ? 'text-rose-400' : 'text-white'}`}>
                  {Math.round(speedMph)}
                </span>
                <span className="text-[10px] uppercase font-bold text-slate-400">MPH</span>
              </div>
            </div>

            {/* Tab 1: Drive & Touch Buttons */}
            {activeTab === 'drive' && (
              <div className="flex flex-wrap items-center justify-between gap-4">
                {/* Head look: hold to look. Keys: 1/2/3 mirrors, Z/X shoulder checks */}
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">
                    Look (hold)
                  </span>
                  <div className="flex items-center gap-1">
                    {(
                      [
                        ['shoulder_left', '◀ Shoulder', 'Over-the-shoulder blind-spot check, left (Z)'],
                        ['mirror_left', 'L Mirror', 'Left mirror (1)'],
                        ['mirror_rear', 'Rear', 'Rearview mirror (2)'],
                        ['mirror_right', 'R Mirror', 'Right mirror (3)'],
                        ['shoulder_right', 'Shoulder ▶', 'Over-the-shoulder blind-spot check, right (X)'],
                      ] as [LookTarget, string, string][]
                    ).map(([target, label, title]) => (
                      <button
                        key={target}
                        onPointerDown={(e) => {
                          e.currentTarget.setPointerCapture?.(e.pointerId);
                          onLook(target, true);
                        }}
                        onPointerUp={() => onLook(target, false)}
                        onPointerCancel={() => onLook(target, false)}
                        onLostPointerCapture={() => onLook(target, false)}
                        className="px-2.5 h-10 bg-slate-900 hover:bg-slate-800 active:bg-sky-600 rounded-xl text-slate-200 border border-slate-700 text-[11px] font-bold cursor-pointer select-none touch-none"
                        title={title}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Touch / Trackpad Driving Controls */}
                <div className="flex items-center gap-2">
                  <button
                    onMouseDown={() => onSteer(-1)}
                    onMouseUp={() => onSteer(0)}
                    onMouseLeave={() => onSteer(0)}
                    onTouchStart={() => onSteer(-1)}
                    onTouchEnd={() => onSteer(0)}
                    onTouchCancel={() => onSteer(0)}
                    className="w-11 h-11 bg-slate-900 hover:bg-slate-800 active:bg-sky-600 rounded-xl flex items-center justify-center text-slate-200 border border-slate-700 cursor-pointer select-none"
                    title="Steer Left (A / Left Arrow)"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>

                  <button
                    onMouseDown={() => onSteer(1)}
                    onMouseUp={() => onSteer(0)}
                    onMouseLeave={() => onSteer(0)}
                    onTouchStart={() => onSteer(1)}
                    onTouchEnd={() => onSteer(0)}
                    onTouchCancel={() => onSteer(0)}
                    className="w-11 h-11 bg-slate-900 hover:bg-slate-800 active:bg-sky-600 rounded-xl flex items-center justify-center text-slate-200 border border-slate-700 cursor-pointer select-none"
                    title="Steer Right (D / Right Arrow)"
                  >
                    <ArrowRight className="w-5 h-5" />
                  </button>

                  <button
                    onMouseDown={() => onThrottle(1)}
                    onMouseUp={() => onThrottle(0)}
                    onMouseLeave={() => onThrottle(0)}
                    onTouchStart={() => onThrottle(1)}
                    onTouchEnd={() => onThrottle(0)}
                    onTouchCancel={() => onThrottle(0)}
                    className="px-4 h-11 bg-emerald-950 hover:bg-emerald-900 active:bg-emerald-600 rounded-xl flex items-center gap-1.5 text-emerald-200 border border-emerald-700 font-bold text-xs uppercase cursor-pointer select-none"
                    title="Gas (W / Up Arrow)"
                  >
                    <ArrowUp className="w-4 h-4" />
                    <span>Gas</span>
                  </button>

                  <button
                    onMouseDown={() => onBrake(1)}
                    onMouseUp={() => onBrake(0)}
                    onMouseLeave={() => onBrake(0)}
                    onTouchStart={() => onBrake(1)}
                    onTouchEnd={() => onBrake(0)}
                    onTouchCancel={() => onBrake(0)}
                    className="px-4 h-11 bg-rose-950 hover:bg-rose-900 active:bg-rose-700 rounded-xl flex items-center gap-1.5 text-rose-200 border border-rose-700 font-bold text-xs uppercase cursor-pointer select-none"
                    title="Brake (S / Down Arrow)"
                  >
                    <ArrowDown className="w-4 h-4" />
                    <span>Brake</span>
                  </button>

                  <button
                    onMouseDown={() => onBrake(1.8)}
                    onMouseUp={() => onBrake(0)}
                    onMouseLeave={() => onBrake(0)}
                    onTouchStart={() => onBrake(1.8)}
                    onTouchEnd={() => onBrake(0)}
                    onTouchCancel={() => onBrake(0)}
                    className="px-3 h-11 bg-slate-900 hover:bg-slate-800 active:bg-rose-900 rounded-xl flex items-center text-slate-300 border border-slate-700 font-mono text-xs uppercase cursor-pointer select-none"
                    title="Emergency Brake (Space)"
                  >
                    <span>Space</span>
                  </button>
                </div>

                {/* Keyboard Shortcuts Hint */}
                <div className="hidden lg:flex flex-col text-right text-[11px] text-slate-400">
                  <span className="font-semibold text-slate-300">Quick Shortcuts:</span>
                  <span>[1/2/3] Mirrors • [Z/X] Shoulder check • [Q/E] Signal</span>
                  <span>[H] Horn • [L] Lights • [K] Wipers • [T] Dock</span>
                </div>
              </div>
            )}

            {/* Tab 2: Vehicle Controls (Signals, Lights, Wipers, Horn) */}
            {activeTab === 'car_controls' && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                {/* Left Blinker */}
                <button
                  onClick={() => onToggleTurnSignal('left')}
                  className={`p-3 rounded-2xl border text-xs font-bold flex flex-col items-center justify-center gap-1 cursor-pointer transition ${
                    controlsState.turnSignal === 'left'
                      ? 'bg-emerald-950 border-emerald-400 text-emerald-200 shadow-lg'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span className="text-base">⬅</span>
                  <span>Left Signal (Q)</span>
                </button>

                {/* Right Blinker */}
                <button
                  onClick={() => onToggleTurnSignal('right')}
                  className={`p-3 rounded-2xl border text-xs font-bold flex flex-col items-center justify-center gap-1 cursor-pointer transition ${
                    controlsState.turnSignal === 'right'
                      ? 'bg-emerald-950 border-emerald-400 text-emerald-200 shadow-lg'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span className="text-base">➡</span>
                  <span>Right Signal (E)</span>
                </button>

                {/* Hazard Flashers */}
                <button
                  onClick={onToggleHazards}
                  className={`p-3 rounded-2xl border text-xs font-bold flex flex-col items-center justify-center gap-1 cursor-pointer transition ${
                    controlsState.hazards
                      ? 'bg-rose-950 border-rose-500 text-rose-200 shadow-lg animate-pulse'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span className="text-base">⚠️</span>
                  <span>Hazards (F)</span>
                </button>

                {/* Headlights */}
                <button
                  onClick={onToggleHeadlights}
                  className={`p-3 rounded-2xl border text-xs font-bold flex flex-col items-center justify-center gap-1 cursor-pointer transition ${
                    controlsState.headlights
                      ? 'bg-sky-950 border-sky-400 text-sky-200 shadow-lg'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span className="text-base">💡</span>
                  <span>Headlights (L)</span>
                </button>

                {/* Wipers */}
                <button
                  onClick={onToggleWipers}
                  className={`p-3 rounded-2xl border text-xs font-bold flex flex-col items-center justify-center gap-1 cursor-pointer transition ${
                    controlsState.wipers
                      ? 'bg-sky-950 border-sky-400 text-sky-200 shadow-lg'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span className="text-base">🌧️</span>
                  <span>Wipers (K)</span>
                </button>

                {/* Car Horn Button */}
                <button
                  onMouseDown={onPressHorn}
                  onMouseUp={onReleaseHorn}
                  onMouseLeave={onReleaseHorn}
                  onTouchStart={onPressHorn}
                  onTouchEnd={onReleaseHorn}
                  onTouchCancel={onReleaseHorn}
                  className="col-span-2 sm:col-span-5 p-2.5 bg-slate-900 hover:bg-amber-950/60 active:bg-amber-600 border border-slate-800 rounded-xl text-slate-200 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition select-none"
                >
                  <span>📢</span>
                  <span>Press & Hold Horn (H or Click Steering Wheel)</span>
                </button>
              </div>
            )}

            {/* Tab 3: Car Radio */}
            {activeTab === 'radio' && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between bg-slate-900 p-3 rounded-2xl border border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                      FM
                    </div>
                    <div>
                      <div className="text-xs uppercase font-bold text-slate-400">Current Station</div>
                      <div className="text-sm font-bold text-white font-mono">
                        {controlsState.radioOn ? radioStations[controlsState.radioStation] : 'Power Off'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={onToggleRadioPower}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                        controlsState.radioOn
                          ? 'bg-rose-950 border border-rose-600/50 text-rose-200'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {controlsState.radioOn ? 'Turn Off' : 'Turn On'}
                    </button>
                    <button
                      onClick={onNextRadioStation}
                      disabled={!controlsState.radioOn}
                      className="px-4 py-1.5 bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-slate-950 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      Next Station ⏭
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {radioStations.map((st, idx) => (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-xl border text-xs font-medium ${
                        controlsState.radioOn && controlsState.radioStation === idx
                          ? 'bg-sky-950/80 border-sky-400 text-sky-200'
                          : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      <div className="text-[10px] uppercase font-bold text-slate-500">Preset {idx + 1}</div>
                      <div className="truncate font-semibold">{st}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tab 4: In-Car Smartphone */}
            {activeTab === 'phone' && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                    <Smartphone className="w-4 h-4 text-sky-400" />
                    <span>Mounted Smartphone Notifications</span>
                  </div>
                  <span className="text-[11px] text-amber-400 font-semibold">
                    Rule: Keep eyes on the road!
                  </span>
                </div>

                {activePhoneMessage || sentReply ? (
                  <div className="flex flex-col gap-2">
                    <IOSMessagesThread
                      contact={activePhoneMessage ? activePhoneMessage.sender : sentReply!.contact}
                      timeLabel={activePhoneMessage ? activePhoneMessage.timestamp : sentReply!.time}
                      received={activePhoneMessage ? activePhoneMessage.fullText : sentReply!.received}
                      sent={sentReply ? sentReply.text : null}
                    />
                    {activePhoneMessage && (
                      <div className="ios flex gap-2">
                        <button
                          onClick={() => onPhoneAction('ignore')}
                          className="ios-action flex-1"
                          style={{ color: '#007aff', background: 'rgba(246,246,248,0.9)' }}
                        >
                          Ignore (+10 Safety)
                        </button>
                        <button
                          onClick={handleReply}
                          className="ios-action flex-1"
                          style={{ color: '#ff3b30', background: 'rgba(246,246,248,0.9)' }}
                        >
                          Reply (-15 Safety)
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="ios ios-glass rounded-[18px] p-4 text-center text-[13px] ios-secondary">
                    No new messages. You are driving undistracted.
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
