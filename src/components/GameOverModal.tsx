/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AlertOctagon, RotateCcw, ShieldAlert } from 'lucide-react';
import { DrivingStats } from '../types/game';

interface GameOverModalProps {
  stats: DrivingStats;
  vehicleHitType: string;
  onRestartNewRun: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  stats,
  vehicleHitType,
  onRestartNewRun,
}) => {
  return (
    <div className="px-ui px-static px-scanlines fixed inset-0 z-50 bg-[#0a0508] flex items-center justify-center p-4 select-none overflow-y-auto">
      <div className="px-flash absolute inset-0 bg-white pointer-events-none z-[70]" />
      <div
        className="px-panel px-shake relative w-full max-w-xl max-h-[94vh] overflow-y-auto p-5 sm:p-8 flex flex-col gap-6"
        style={{ borderColor: '#ff6b6b' }}
      >
        {/* Solemn Header */}
        <div className="flex flex-col items-center text-center gap-3 border-b border-neutral-800 pb-5">
          <div className="w-14 h-14 rounded-full bg-rose-950/60 border border-rose-600/50 flex items-center justify-center text-rose-500">
            <AlertOctagon className="w-8 h-8" />
          </div>
          <div className="flex flex-col">
            <span className="px-title text-[10px] text-rose-400">
              Fatal Vehicle Impact
            </span>
            <h1 className="px-title text-xl sm:text-2xl text-[#f4e9c8] mt-3 leading-relaxed">
              THERE IS NO RESTART.
            </h1>
          </div>
        </div>

        {/* Core Moral Message */}
        <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-5 text-center flex flex-col gap-3">
          <p className="text-base text-neutral-200 leading-relaxed px-font text-lg">
            “Every decision on the road can affect a real life.”
          </p>
          <div className="h-px w-24 bg-neutral-700 mx-auto" />
          <p className="text-xl font-black text-rose-400 tracking-tight">
            “Don't drive like you have another life.”
          </p>
          <p className="text-xs text-neutral-400 leading-normal">
            In reality, video games offer save points and respawns. On real highways, a single moment of rushing, tailgating, or distracted driving alters lives forever.
          </p>
        </div>

        {/* Telemetry Summary at Time of Crash */}
        <div className="bg-neutral-900/60 border border-neutral-800/80 rounded-xl p-3.5 flex flex-col gap-2 text-xs">
          <div className="flex justify-between text-neutral-400 border-b border-neutral-800 pb-1.5">
            <span>Vehicle Impact:</span>
            <span className="font-semibold text-neutral-200 capitalize">Collision with {vehicleHitType}</span>
          </div>
          <div className="flex justify-between text-neutral-400 border-b border-neutral-800 pb-1.5">
            <span>Speed Recorded:</span>
            <span className="font-semibold text-rose-400 font-mono">{Math.round(stats.speedMph)} MPH</span>
          </div>
          <div className="flex justify-between text-neutral-400 border-b border-neutral-800 pb-1.5">
            <span>Distance Reached:</span>
            <span className="font-semibold text-neutral-200 font-mono">
              {stats.distanceDrivenMiles.toFixed(1)} / {stats.totalDistanceMiles.toFixed(1)} miles
            </span>
          </div>
          <div className="flex justify-between text-neutral-400 border-b border-neutral-800 pb-1.5">
            <span>Previous Near-Misses:</span>
            <span className="font-semibold text-amber-400 font-mono">{stats.nearMisses}</span>
          </div>
          <div className="flex justify-between text-neutral-400 border-b border-neutral-800 pb-1.5">
            <span>Last Mirror / Blind-Spot Check:</span>
            <span className="font-semibold text-neutral-200 font-mono">
              {stats.mirrorChecks + stats.shoulderChecks === 0
                ? 'never'
                : `${Math.round(stats.secondsSinceScan)}s before impact`}
            </span>
          </div>
          <div className="flex justify-between text-neutral-400">
            <span>Mirror checks / Shoulder checks:</span>
            <span className="font-semibold text-neutral-200 font-mono">
              {stats.mirrorChecks} / {stats.shoulderChecks}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-center pt-2">
          <button
            onClick={onRestartNewRun}
            className="px-btn px-btn-red w-full flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Begin Fresh Run</span>
          </button>
        </div>
      </div>
    </div>
  );
};
