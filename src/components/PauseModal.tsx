/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Play, RotateCcw, Volume2, VolumeX, Camera, LogOut, X } from 'lucide-react';

interface PauseModalProps {
  onResume: () => void;
  onRestart: () => void;
  onQuitToTitle: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  cameraMode: 'cockpit' | 'hood';
  onToggleCamera: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  onResume,
  onRestart,
  onQuitToTitle,
  isMuted,
  onToggleMute,
  cameraMode,
  onToggleCamera,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 select-none animate-in fade-in duration-150">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-3xl p-6 text-slate-100 flex flex-col gap-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="text-xl font-black text-white">Game Paused</h2>
          <button
            onClick={onResume}
            className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col gap-2 pt-1">
          <button
            onClick={onResume}
            className="w-full py-3 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold rounded-xl flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-sky-500/20"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Resume Driving</span>
          </button>

          <button
            onClick={onRestart}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Restart Chapter</span>
          </button>

          <button
            onClick={onToggleCamera}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <Camera className="w-4 h-4 text-sky-400" />
            <span>Camera: {cameraMode === 'cockpit' ? 'First-Person Cockpit' : 'Hood Camera'}</span>
          </button>

          <button
            onClick={onToggleMute}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl flex items-center justify-center gap-2 transition cursor-pointer"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
            <span>Audio: {isMuted ? 'Muted' : 'Enabled'}</span>
          </button>

          <button
            onClick={onQuitToTitle}
            className="w-full py-2.5 bg-slate-800 hover:bg-rose-950/60 hover:text-rose-200 text-slate-400 font-semibold rounded-xl flex items-center justify-center gap-2 transition cursor-pointer mt-1"
          >
            <LogOut className="w-4 h-4" />
            <span>Quit to Title Screen</span>
          </button>
        </div>
      </div>
    </div>
  );
};
