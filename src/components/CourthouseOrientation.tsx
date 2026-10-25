/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Landmark, Smartphone, Volume2, Shield, Award, ArrowRight, CheckCircle2 } from 'lucide-react';
import { DrivingStats } from '../types/game';
import { soundManager } from '../audio/soundManager';
import juryImg from '../scenes/jury.jpg';

interface CourthouseOrientationProps {
  stats: DrivingStats;
  onCompleteOrientation: (decisions: {
    putPhoneAway: boolean;
    listenedAttentively: boolean;
    civicReflectionAnswer: string;
  }) => void;
}

export const CourthouseOrientation: React.FC<CourthouseOrientationProps> = ({
  stats,
  onCompleteOrientation,
}) => {
  const [stage, setStage] = useState<'arrival' | 'phone_choice' | 'reflection' | 'dismissal'>('arrival');
  const [putPhoneAway, setPutPhoneAway] = useState<boolean>(true);
  const [listenedAttentively, setListenedAttentively] = useState<boolean>(true);
  const [civicReflectionAnswer, setCivicReflectionAnswer] = useState<string>('');

  const arrivedOnTime = stats.arrivedOnTime;

  const handlePhoneDecision = (silenced: boolean) => {
    soundManager.playButtonClick();
    setPutPhoneAway(silenced);
    setStage('reflection');
  };

  const handleReflectionDecision = (choice: string) => {
    soundManager.playButtonClick();
    setCivicReflectionAnswer(choice);
    setListenedAttentively(choice !== 'bored');
    setStage('dismissal');
  };

  const handleFinish = () => {
    soundManager.playButtonClick();
    onCompleteOrientation({
      putPhoneAway,
      listenedAttentively,
      civicReflectionAnswer,
    });
  };

  return (
    <div
      className="px-ui px-scene px-scanlines fixed inset-0 z-40 flex items-end justify-center p-3 sm:p-6 select-none"
      style={{ backgroundImage: `url(${juryImg})` }}
    >
      <div className="relative px-panel w-full max-w-3xl max-h-[64vh] overflow-y-auto p-5 sm:p-6 flex flex-col gap-4 animate-in fade-in duration-300">
        {/* Header with Judicial seal vibe */}
        <div className="flex items-center justify-between border-b border-stone-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-xl">
              <Landmark className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-amber-400">
                Chapter 2: Civic Duty in Action
              </div>
              <h2 className="text-xl font-bold text-stone-100">Duval County Courthouse • Assembly Room 2B</h2>
            </div>
          </div>
          <div className="text-right">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
              arrivedOnTime ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-600/40' : 'bg-amber-950/80 text-amber-300 border border-amber-600/40'
            }`}>
              {arrivedOnTime ? 'Checked In On Time' : 'Arrived Safely • Checked In'}
            </span>
          </div>
        </div>

        {/* Stage 1: Arrival & Reception */}
        {stage === 'arrival' && (
          <div className="flex flex-col gap-4 animate-in fade-in duration-200">
            <p className="text-stone-300 text-sm leading-relaxed">
              You walk up the wide granite steps past the American and Florida state flags, pass through the security magnetometer, and take a seat on the wooden juror benches.
            </p>

            <div className="bg-stone-800/80 border border-stone-700 rounded-2xl p-4 flex gap-4 items-start">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0 font-bold text-sm">
                JC
              </div>
              <div className="text-sm">
                <div className="font-bold text-amber-300">Jury Coordinator Henderson:</div>
                <div className="text-stone-300 mt-1">
                  {arrivedOnTime ? (
                    <span>“Good morning everyone. Thank you for reporting promptly. Your presence here today is the bedrock of our constitutional right to an impartial trial by jury under the Sixth and Seventh Amendments.”</span>
                  ) : (
                    <span>“Welcome, jurors. For those who experienced delays on the highway, we are glad you drove with patience and arrived safely. Protecting human life always comes first.”</span>
                  )}
                </div>
              </div>
            </div>

            <p className="text-stone-400 text-xs italic">
              Coordinator Henderson prepares to begin the orientation video. First, she reminds everyone about courtroom etiquette.
            </p>

            <button
              onClick={() => {
                soundManager.playButtonClick();
                setStage('phone_choice');
              }}
              className="mt-2 w-full py-3 bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Continue Orientation</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Stage 2: Phone Choice */}
        {stage === 'phone_choice' && (
          <div className="flex flex-col gap-4 animate-in fade-in duration-200">
            <div className="flex items-center gap-3 text-amber-400">
              <Smartphone className="w-5 h-5" />
              <h3 className="font-bold text-base text-stone-100">Courtroom Focus & Distractions</h3>
            </div>

            <p className="text-stone-300 text-sm leading-relaxed">
              Coordinator Henderson asks all jurors to power off their phones:
              <span className="italic text-stone-200 block mt-1">
                “Electronic devices in the courtroom jeopardize deliberations and fair hearings. Please ensure your device cannot ring or distract the court.”
              </span>
            </p>

            <div className="flex flex-col gap-3 pt-2">
              <button
                onClick={() => handlePhoneDecision(true)}
                className="text-left p-4 rounded-xl border border-emerald-600/50 bg-emerald-950/40 hover:bg-emerald-900/60 transition cursor-pointer flex items-start gap-3.5 group"
              >
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-emerald-200 text-sm group-hover:underline">
                    Power down phone completely and store in pocket
                  </div>
                  <div className="text-xs text-emerald-300/80 mt-0.5">
                    Demonstrate complete respect for the legal proceedings and fellow citizens.
                  </div>
                </div>
              </button>

              <button
                onClick={() => handlePhoneDecision(false)}
                className="text-left p-4 rounded-xl border border-amber-600/50 bg-amber-950/40 hover:bg-amber-900/60 transition cursor-pointer flex items-start gap-3.5 group"
              >
                <Volume2 className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-amber-200 text-sm group-hover:underline">
                    Switch to vibrate mode in case friends text
                  </div>
                  <div className="text-xs text-amber-300/80 mt-0.5">
                    Leaves you vulnerable to distractions during legal proceedings.
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Stage 3: Civic Reflection Question */}
        {stage === 'reflection' && (
          <div className="flex flex-col gap-4 animate-in fade-in duration-200">
            <div className="flex items-center gap-3 text-amber-400">
              <Award className="w-5 h-5" />
              <h3 className="font-bold text-base text-stone-100">Civic Responsibility Question</h3>
            </div>

            <p className="text-stone-300 text-sm leading-relaxed">
              The presiding judge enters the bench to address the juror pool:
              <span className="italic text-stone-200 block mt-1">
                “When you consider your obligations today—both on the highway getting here, and in this courtroom—what connects them?”
              </span>
            </p>

            <div className="flex flex-col gap-2.5 pt-1">
              <button
                onClick={() => handleReflectionDecision('protection')}
                className="text-left p-3.5 rounded-xl border border-stone-700 bg-stone-800/80 hover:bg-amber-950/60 hover:border-amber-500/60 transition cursor-pointer text-sm"
              >
                <span className="font-semibold text-amber-200 block">
                  “Both are about protecting the lives and constitutional rights of our neighbors.”
                </span>
                <span className="text-xs text-stone-400 mt-0.5 block">
                  A high understanding of shared social responsibility and public safety.
                </span>
              </button>

              <button
                onClick={() => handleReflectionDecision('compliance')}
                className="text-left p-3.5 rounded-xl border border-stone-700 bg-stone-800/80 hover:bg-amber-950/60 hover:border-amber-500/60 transition cursor-pointer text-sm"
              >
                <span className="font-semibold text-amber-200 block">
                  “Following the rules avoids fines and tickets.”
                </span>
                <span className="text-xs text-stone-400 mt-0.5 block">
                  Focuses on legal compliance rather than empathy.
                </span>
              </button>

              <button
                onClick={() => handleReflectionDecision('bored')}
                className="text-left p-3.5 rounded-xl border border-stone-700 bg-stone-800/80 hover:bg-amber-950/60 hover:border-amber-500/60 transition cursor-pointer text-sm"
              >
                <span className="font-semibold text-stone-300 block">
                  “I just want to get this over with and go back to bed.”
                </span>
                <span className="text-xs text-stone-500 mt-0.5 block">
                  Disengaged from community responsibility.
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Stage 4: Orientation Dismissal & Transition to Drive Home */}
        {stage === 'dismissal' && (
          <div className="flex flex-col gap-4 animate-in fade-in duration-200">
            <div className="p-4 bg-amber-950/40 border border-amber-600/40 rounded-2xl">
              <div className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-1">
                Jury Service Completed
              </div>
              <p className="text-stone-200 text-sm leading-relaxed">
                After a thorough orientation and docket call, your juror panel is placed on call for tomorrow's trial and dismissed for the afternoon.
              </p>
            </div>

            <p className="text-stone-300 text-sm leading-relaxed">
              As you step outside the courthouse, the afternoon sky has darkened. Rain clouds have rolled in over Florida, making the asphalt slick. You walk to your car in the parking lot. You feel fatigued from the early wake-up, but you must stay vigilant on the drive home.
            </p>

            <button
              onClick={handleFinish}
              className="mt-2 w-full py-3.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20"
            >
              <span>Begin Chapter 3: Drive Home</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
