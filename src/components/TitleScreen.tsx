/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Play,
  HelpCircle,
  Volume2,
  VolumeX,
  Compass,
  ArrowRight,
  Shield,
  Clock,
  Sparkles,
} from 'lucide-react';
import { soundManager } from '../audio/soundManager';
import { GameChapter } from '../types/game';
import wakeupImg from '../scenes/wakeup.png';

interface TitleScreenProps {
  onStartGame: (chapter?: GameChapter) => void;
  isMuted: boolean;
  onToggleMute: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  onStartGame,
  isMuted,
  onToggleMute,
}) => {
  const [showControlsModal, setShowControlsModal] = useState(false);

  return (
    <div
      className="px-ui px-scene px-scene-dim px-scanlines fixed inset-0 z-40 flex flex-col justify-between p-6 sm:p-12 select-none overflow-y-auto"
      style={{ backgroundImage: `url(${wakeupImg})` }}
    >
      {/* Top Header Bar */}
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-2 px-3.5 py-1.5 bg-sky-500/10 border border-sky-500/30 rounded-full text-sky-400 text-xs font-semibold">
          <Sparkles className="w-4 h-4" />
          <span>Cinematic Civic Experience</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              soundManager.playButtonClick();
              setShowControlsModal(true);
            }}
            className="px-3.5 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 flex items-center gap-2 transition cursor-pointer"
          >
            <HelpCircle className="w-4 h-4 text-sky-400" />
            <span>Controls</span>
          </button>

          <button
            onClick={onToggleMute}
            className="p-2 bg-slate-800/80 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 transition cursor-pointer"
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>
        </div>
      </div>

      {/* Hero Title Section */}
      <div className="relative max-w-3xl my-auto py-8">
        <div className="flex items-center gap-2 text-sky-400 text-xs font-bold uppercase tracking-widest mb-3">
          <Sparkles className="w-4 h-4" />
          <span>Cinematic 3D Driving Simulator & Civic Experience</span>
        </div>

        <h1
          className="px-title text-3xl sm:text-5xl md:text-6xl text-[#f4e9c8] leading-[1.35]"
          style={{ textShadow: '4px 4px 0 #17122b' }}
        >
          LAST EXIT :
          <br />
          <span className="text-[#ffb347]">DUVAL</span>
        </h1>

        <p className="text-2xl sm:text-3xl px-font text-[#ffd98a] mt-5 leading-relaxed max-w-xl">
          “Don't drive like you have another life.”
        </p>

        <p className="text-sm sm:text-base text-slate-300 mt-2 max-w-2xl leading-relaxed">
          You woke up late with an urgent jury summons. Navigate morning Florida highway traffic in realistic first-person 3D, report to the courthouse, and make it home alive. There are no respawns on real roads.
        </p>

        {/* Primary CTA Buttons */}
        <div className="flex flex-wrap items-center gap-4 mt-8">
          <button
            onClick={() => {
              soundManager.playButtonClick();
              onStartGame('INTRO');
            }}
            className="px-btn px-btn-sky flex items-center gap-3"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>Start Driving</span>
          </button>
        </div>
      </div>

      {/* Chapter Select / Quick Launch Bar */}
      <div className="relative border-t-4 border-[#f4e9c8]/30 pt-4 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-300">Quick Chapter Select:</span>
          <button
            onClick={() => onStartGame('DRIVE_TO_COURTHOUSE')}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-sky-300 rounded-lg border border-slate-700 transition cursor-pointer"
          >
            Ch. 1 Drive to Courthouse
          </button>
          <button
            onClick={() => onStartGame('ORIENTATION')}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-lg border border-slate-700 transition cursor-pointer"
          >
            Ch. 2 Jury Orientation
          </button>
          <button
            onClick={() => onStartGame('DRIVE_HOME')}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-emerald-300 rounded-lg border border-slate-700 transition cursor-pointer"
          >
            Ch. 3 Drive Home (Rain)
          </button>
        </div>

        <div className="text-[11px] text-slate-500">
          Built with Three.js • Web Audio API • 100% Procedural
        </div>
      </div>

      {/* Controls Modal */}
      {showControlsModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="w-full max-w-md max-h-[92vh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-3xl p-6 text-slate-100 flex flex-col gap-4 shadow-2xl">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Compass className="w-5 h-5 text-sky-400" />
              <span>How to Drive & Controls</span>
            </h3>

            <div className="flex flex-col gap-2.5 text-xs text-slate-300">
              <div className="p-2.5 bg-sky-950/50 border border-sky-700/50 rounded-xl flex flex-col gap-1.5">
                <span className="font-bold text-sky-300">Defensive driving: look before you move</span>
                <div className="flex justify-between">
                  <span className="font-semibold text-white">Check mirrors (hold)</span>
                  <span className="font-mono text-sky-300">1 left · 2 rearview · 3 right</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-white">Blind-spot shoulder check (hold)</span>
                  <span className="font-mono text-sky-300">Z left · X right</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-white">Look around freely</span>
                  <span className="font-mono text-sky-300">Click &amp; drag / touch drag</span>
                </div>
                <span className="text-[11px] text-slate-400 leading-snug">
                  Signal, check your mirror, then shoulder-check your blind spot before changing lanes. Mirrors cannot see everything.
                </span>
              </div>
              <div className="flex justify-between p-2.5 bg-slate-800 rounded-xl">
                <span className="font-semibold text-white">Accelerate (Gas)</span>
                <span className="font-mono text-sky-300">W / Up Arrow</span>
              </div>
              <div className="flex justify-between p-2.5 bg-slate-800 rounded-xl">
                <span className="font-semibold text-white">Brake / Reverse</span>
                <span className="font-mono text-sky-300">S / Down Arrow</span>
              </div>
              <div className="flex justify-between p-2.5 bg-slate-800 rounded-xl">
                <span className="font-semibold text-white">Steer Left & Right</span>
                <span className="font-mono text-sky-300">A / D or Left / Right Arrows</span>
              </div>
              <div className="flex justify-between p-2.5 bg-slate-800 rounded-xl">
                <span className="font-semibold text-white">Emergency Stop</span>
                <span className="font-mono text-sky-300">Spacebar</span>
              </div>
              <div className="flex justify-between p-2.5 bg-slate-800 rounded-xl">
                <span className="font-semibold text-white">Switch Camera (Cockpit/Hood)</span>
                <span className="font-mono text-sky-300">C</span>
              </div>
              <div className="flex justify-between p-2.5 bg-slate-800 rounded-xl">
                <span className="font-semibold text-white">Turn Signals</span>
                <span className="font-mono text-sky-300">Q (left) / E (right)</span>
              </div>
              <div className="flex justify-between p-2.5 bg-slate-800 rounded-xl">
                <span className="font-semibold text-white">Horn</span>
                <span className="font-mono text-sky-300">H</span>
              </div>
              <div className="flex justify-between p-2.5 bg-slate-800 rounded-xl">
                <span className="font-semibold text-white">Hide / Show Control Dock</span>
                <span className="font-mono text-sky-300">T</span>
              </div>
              <div className="flex justify-between p-2.5 bg-slate-800 rounded-xl">
                <span className="font-semibold text-white">Pause</span>
                <span className="font-mono text-sky-300">P / Escape</span>
              </div>
            </div>

            <div className="p-3 bg-amber-950/40 rounded-xl border border-amber-600/40 text-xs text-amber-200">
              On mobile or touch devices, use the on-screen steering and throttle buttons in the bottom control dock.
            </div>

            <button
              onClick={() => setShowControlsModal(false)}
              className="mt-2 w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition cursor-pointer text-sm"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
