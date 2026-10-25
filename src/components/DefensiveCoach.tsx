/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Eye, Info, ShieldAlert, ShieldCheck, TriangleAlert } from 'lucide-react';
import { DriverAwarenessSnapshot, DrivingFeedback, GazeZone } from '../types/game';

interface DefensiveCoachProps {
  driverState: DriverAwarenessSnapshot;
  feedback: DrivingFeedback[];
  cameraMode: 'cockpit' | 'hood';
}

const GAZE_LABEL: Record<GazeZone, string> = {
  road: '',
  other: 'Looking away from the road',
  mirror_left: 'Left mirror',
  mirror_rear: 'Rearview mirror',
  mirror_right: 'Right mirror',
  shoulder_left: 'Left blind-spot check',
  shoulder_right: 'Right blind-spot check',
};

const KIND_STYLE: Record<DrivingFeedback['kind'], { box: string; icon: string }> = {
  good: { box: 'border-emerald-500/70 bg-emerald-950/90', icon: 'text-emerald-400' },
  info: { box: 'border-sky-500/60 bg-slate-900/90', icon: 'text-sky-400' },
  warn: { box: 'border-amber-500/70 bg-amber-950/90', icon: 'text-amber-400' },
  bad: { box: 'border-rose-500/80 bg-rose-950/90', icon: 'text-rose-400' },
};

function KindIcon({ kind, className }: { kind: DrivingFeedback['kind']; className: string }) {
  if (kind === 'good') return <ShieldCheck className={className} />;
  if (kind === 'warn') return <TriangleAlert className={className} />;
  if (kind === 'bad') return <ShieldAlert className={className} />;
  return <Info className={className} />;
}

export const DefensiveCoach: React.FC<DefensiveCoachProps> = ({ driverState, feedback, cameraMode }) => {
  const { gazeZone, eyesOffRoadSec, secondsSinceScan, followGapSec, elapsedSec } = driverState;
  const looking = gazeZone !== 'road';
  const eyesWarn = eyesOffRoadSec > 0.8;
  const eyesDanger = eyesOffRoadSec > 2.0;
  const showHint = cameraMode === 'cockpit' && elapsedSec < 18;

  const scanColor =
    secondsSinceScan < 8 ? 'text-emerald-300' : secondsSinceScan < 14 ? 'text-amber-300' : 'text-rose-300';
  const gapColor =
    followGapSec === null
      ? 'text-slate-400'
      : followGapSec < 1.3
      ? 'text-rose-300'
      : followGapSec < 2.5
      ? 'text-amber-300'
      : 'text-emerald-300';

  return (
    <>
      {/* Gaze indicator + awareness chips (top centre) */}
      <div className="pointer-events-none flex flex-col items-center gap-1.5">
        {looking && (
          <div
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold border shadow-md ${
              eyesDanger
                ? 'bg-rose-950/90 border-rose-500 text-rose-200'
                : 'bg-slate-900/85 border-sky-500/60 text-sky-200'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{GAZE_LABEL[gazeZone]}</span>
            {eyesWarn && <span className="font-mono">{eyesOffRoadSec.toFixed(1)}s off road</span>}
          </div>
        )}

        {cameraMode === 'cockpit' && (
          <div className="flex items-center gap-3 px-3 py-1 rounded-full bg-slate-950/70 border border-slate-800 text-[10px] font-mono uppercase tracking-wide">
            <span className="text-slate-400">
              Scan <span className={scanColor}>{Math.floor(secondsSinceScan)}s</span>
            </span>
            <span className="text-slate-400">
              Gap <span className={gapColor}>{followGapSec === null ? '--' : `${followGapSec.toFixed(1)}s`}</span>
            </span>
          </div>
        )}

        {showHint && (
          <div className="mt-1 max-w-md text-center bg-slate-900/85 border border-slate-700/70 rounded-2xl px-4 py-2 text-[11px] leading-relaxed text-slate-200 shadow-lg">
            <div className="font-bold text-sky-300 mb-0.5">Drive defensively: look before you move</div>
            <div>
              Hold <b>1</b> left mirror · <b>2</b> rearview · <b>3</b> right mirror
            </div>
            <div>
              Hold <b>Z</b> / <b>X</b> to shoulder-check your blind spot · or drag to look around
            </div>
          </div>
        )}
      </div>

      {/* Coaching toasts (left side) */}
      <div className="pointer-events-none absolute left-3.5 top-28 flex w-72 flex-col gap-2">
        {feedback.map((fb) => {
          const style = KIND_STYLE[fb.kind];
          return (
            <div
              key={fb.id}
              className={`rounded-xl border px-3 py-2 shadow-xl text-slate-100 ${style.box}`}
            >
              <div className="flex items-start gap-2">
                <KindIcon kind={fb.kind} className={`w-4 h-4 mt-0.5 shrink-0 ${style.icon}`} />
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold">{fb.title}</span>
                    {fb.scoreDelta !== 0 && (
                      <span
                        className={`text-[10px] font-mono font-bold ${
                          fb.scoreDelta > 0 ? 'text-emerald-300' : 'text-rose-300'
                        }`}
                      >
                        {fb.scoreDelta > 0 ? '+' : ''}
                        {fb.scoreDelta}
                      </span>
                    )}
                  </div>
                  {fb.detail && <div className="mt-0.5 text-[11px] leading-snug text-slate-300">{fb.detail}</div>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};
