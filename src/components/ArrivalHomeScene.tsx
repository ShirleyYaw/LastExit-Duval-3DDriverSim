/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Home, ShieldCheck, Award, AlertTriangle, RotateCcw, CheckCircle2 } from 'lucide-react';
import { DrivingStats } from '../types/game';
import { soundManager } from '../audio/soundManager';
import momImg from '../scenes/mom.png';

interface ArrivalHomeSceneProps {
  stats: DrivingStats;
  onRestart: () => void;
}

export const ArrivalHomeScene: React.FC<ArrivalHomeSceneProps> = ({
  stats,
  onRestart,
}) => {
  // Determine Mom's dynamic response based on actual driving metrics
  const hasSpeedingTickets = stats.speedingViolations > 0;
  const isHighSafety = stats.defensiveDrivingScore >= 80 && stats.speedingViolations === 0;
  const wasLate = !stats.arrivedOnTime;
  const resistedDistractions = stats.phoneDistractionsResisted > stats.phoneDistractionsEngaged;

  let momDialogue = '';
  let outcomeTitle = '';
  let grade = 'A';

  if (isHighSafety && !wasLate) {
    outcomeTitle = 'Exemplary Citizen & Defensive Driver';
    grade = 'A+';
    momDialogue = `“You made it home! I was thinking about you all morning. You got to the courthouse right on time, fulfilled your civic duty as an American juror, and navigated that afternoon rain storm with complete poise. You showed real maturity today. I'm truly proud of you.”`;
  } else if (isHighSafety && wasLate) {
    outcomeTitle = 'Safe & Accountable Citizen';
    grade = 'A-';
    momDialogue = `“I'm so relieved to see you pull in safely. You woke up late, but instead of speeding like a maniac through highway traffic, you kept your cool and protected everyone sharing the road. The jury clerk understood, and everyone is safe. That's what really matters.”`;
  } else if (hasSpeedingTickets) {
    outcomeTitle = 'Risky Driving with Consequences';
    grade = 'C+';
    momDialogue = `“You're back, but the state trooper clocked you speeding on FL-408! Sweetie, you could have caused a fatal collision. No jury duty appointment, no job, and no hurry in the world is worth risking your life. You only get one life.”`;
  } else {
    outcomeTitle = 'Completed Journey';
    grade = 'B';
    momDialogue = `“You made it back through the storm. Today had plenty of stress—between jury duty summons and highway traffic—but you navigated it. Remember to always keep your eyes on the road and stay patient.”`;
  }

  return (
    <div className="fixed inset-0 z-40 bg-gradient-to-b from-slate-950 via-slate-900 to-emerald-950/40 flex items-center justify-center p-4 select-none overflow-y-auto">
      <div className="w-full max-w-2xl bg-slate-900 border border-emerald-600/40 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col gap-6 text-slate-100 my-8 animate-in fade-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-xl">
              <Home className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-emerald-400">
                Chapter 4: Home Safe & Sound
              </div>
              <h2 className="text-2xl font-black text-white">{outcomeTitle}</h2>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase font-bold text-slate-400">Final Grade</span>
            <span className="text-2xl font-black text-emerald-400 font-mono">{grade}</span>
          </div>
        </div>

        {/* Narrative & Mom Dialogue */}
        <div className="flex flex-col gap-3">
          <p className="text-slate-300 text-sm leading-relaxed">
            You pull smoothly into your home driveway and turn off the engine. The sound of rain tapping against the car hood fades as you step onto the porch. Mom opens the front door and smiles.
          </p>

          <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-4 flex gap-4 items-center shadow-inner">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 border-2 border-emerald-400/50 overflow-hidden flex items-center justify-center shrink-0 shadow-md">
              <img src={momImg} alt="Mom" className="w-full h-full object-cover object-top scale-125 translate-y-1" />
            </div>
            <div className="text-sm">
              <div className="font-bold text-emerald-300">Mom:</div>
              <p className="text-slate-200 mt-1 leading-relaxed italic">{momDialogue}</p>
            </div>
          </div>
        </div>

        {/* Civic & Driving Telemetry Report Card */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-sky-400" />
              <span>Driving & Civic Evaluation Report</span>
            </span>
            <span className="text-xs text-sky-400 font-mono">
              Total: {stats.distanceDrivenMiles.toFixed(1)} Miles Driven
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
            <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
              <div className="text-[10px] uppercase text-slate-400">Defensive Score</div>
              <div className="text-lg font-black text-emerald-400 font-mono">{stats.defensiveDrivingScore}%</div>
            </div>
            <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
              <div className="text-[10px] uppercase text-slate-400">Civic Duty</div>
              <div className="text-lg font-black text-sky-400 font-mono">{stats.civicResponsibilityScore}%</div>
            </div>
            <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
              <div className="text-[10px] uppercase text-slate-400">Speed Violations</div>
              <div className={`text-lg font-black font-mono ${stats.speedingViolations > 0 ? 'text-rose-400' : 'text-slate-200'}`}>
                {stats.speedingViolations}
              </div>
            </div>
            <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
              <div className="text-[10px] uppercase text-slate-400">Near Misses</div>
              <div className="text-lg font-black text-amber-400 font-mono">{stats.nearMisses}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
            <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
              <div className="text-[10px] uppercase text-slate-400">Mirror Checks</div>
              <div className="text-lg font-black text-sky-300 font-mono">{stats.mirrorChecks}</div>
            </div>
            <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
              <div className="text-[10px] uppercase text-slate-400">Shoulder Checks</div>
              <div className="text-lg font-black text-sky-300 font-mono">{stats.shoulderChecks}</div>
            </div>
            <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
              <div className="text-[10px] uppercase text-slate-400">Clean Lane Changes</div>
              <div className="text-lg font-black text-emerald-400 font-mono">{stats.safeLaneChanges}</div>
            </div>
            <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
              <div className="text-[10px] uppercase text-slate-400">Unsafe Lane Changes</div>
              <div className={`text-lg font-black font-mono ${stats.unsafeLaneChanges > 0 ? 'text-rose-400' : 'text-slate-200'}`}>
                {stats.unsafeLaneChanges}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 pt-1 text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Jury Service: Verified Attendance & Completed Civic Orientation</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Phone Management: {resistedDistractions ? 'Resisted all mid-drive phone distractions' : 'Looked at notifications'}</span>
            </div>
          </div>
        </div>

        {/* Central Moral Quote */}
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-center">
          <div className="text-xs uppercase font-bold text-amber-400 tracking-widest mb-1">
            Core Moral Theme
          </div>
          <div className="text-lg font-black text-white italic">
            “Don't drive like you have another life.”
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Every choice on the highway protects or endangers a real human life.
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-center pt-2">
          <button
            onClick={onRestart}
            className="w-full sm:w-auto px-8 py-3.5 bg-sky-500 hover:bg-sky-400 active:bg-sky-600 text-slate-950 font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-sky-500/20"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Play Again</span>
          </button>
        </div>
      </div>
    </div>
  );
};
