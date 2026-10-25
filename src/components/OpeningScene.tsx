/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Bell, Key, ArrowRight, Shield, Clock, Compass } from 'lucide-react';
import { soundManager } from '../audio/soundManager';
import { IOSNotification } from './ios/IOSKit';

interface OpeningSceneProps {
  onStartDrive: () => void;
}

export const OpeningScene: React.FC<OpeningSceneProps> = ({ onStartDrive }) => {
  const [step, setStep] = useState<number>(0);

  const handleNext = () => {
    soundManager.playButtonClick();
    if (step < 2) {
      setStep(step + 1);
    } else {
      onStartDrive();
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-2xl bg-slate-900/90 border border-slate-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md flex flex-col gap-6 text-slate-100 animate-in fade-in zoom-in-95 duration-300">
        {/* Progress tracker */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-widest text-sky-400">Chapter 1: The Summons</span>
            <span className="text-xs text-slate-500">•</span>
            <span className="text-xs text-slate-400">Step {step + 1} of 3</span>
          </div>
          <button
            onClick={onStartDrive}
            className="text-xs font-medium text-slate-400 hover:text-white underline cursor-pointer"
          >
            Skip to Drive
          </button>
        </div>

        {/* Step 0: Waking up late */}
        {step === 0 && (
          <div className="flex flex-col gap-4 animate-in fade-in duration-200">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <Clock className="w-7 h-7" />
              </div>
              <div>
                <div className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Morning Alarm • 8:24 AM</div>
                <h2 className="text-2xl font-black text-white tracking-tight">You overslept!</h2>
              </div>
            </div>

            <p className="text-slate-300 text-sm leading-relaxed">
              Golden Florida morning light streams across your bedroom blinds. You reach over to check your buzzing phone, and your heart drops.
            </p>

            {/* iPhone lock screen with the juror summons alert */}
            <div
              className="ios relative rounded-[28px] overflow-hidden px-4 pt-5 pb-4 flex flex-col items-center gap-3"
              style={{
                background: 'linear-gradient(160deg, #1d4f91 0%, #6a3fa0 48%, #e0825a 100%)',
                boxShadow: '0 10px 30px rgba(0,0,0,0.35), inset 0 0 0 0.5px rgba(255,255,255,0.25)',
              }}
            >
              <div className="text-white/85 text-[13px] font-semibold tracking-wide">Monday, October 24</div>
              <div className="text-white text-[64px] leading-[64px] font-light tracking-tight" style={{ textShadow: '0 2px 12px rgba(0,0,0,0.25)' }}>
                8:24
              </div>
              <IOSNotification
                className="w-full mt-1"
                icon="jury"
                title="Florida Jury Services"
                time="now"
                body={
                  <>
                    <span className="font-semibold">Official Juror Summons #4812.</span> Mandatory appearance required today at the Orange County Courthouse, Juror Assembly Room 2B. Check-in starts at 8:45 AM. Court convenes at 9:00 AM sharp.
                  </>
                }
              />
            </div>

            <div className="bg-sky-950/40 border border-sky-800/40 rounded-xl p-3 text-xs text-sky-200">
              💡 <span className="font-semibold">The Dilemma:</span> You have roughly 35 minutes to navigate Florida morning highway traffic. The clock is ticking, but speeding and reckless maneuvers risk your life and everyone sharing the road.
            </div>
          </div>
        )}

        {/* Step 1: Grabbing keys & Mindset */}
        {step === 1 && (
          <div className="flex flex-col gap-4 animate-in fade-in duration-200">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
                <Key className="w-7 h-7" />
              </div>
              <div>
                <div className="text-xs font-semibold text-sky-400 uppercase tracking-wider">Preparation • 8:26 AM</div>
                <h2 className="text-2xl font-black text-white tracking-tight">Keys in Hand</h2>
              </div>
            </div>

            <p className="text-slate-300 text-sm leading-relaxed">
              You grab your wallet, jury summons card, and car keys off the kitchen counter. Mom calls out from the doorway:
            </p>

            <blockquote className="border-l-4 border-amber-400 pl-4 py-1 text-slate-200 italic text-sm">
              “I know you're running late for jury duty, but please remember: nothing is worth risking an accident. Take care of yourself out there.”
            </blockquote>

            <p className="text-slate-300 text-sm leading-relaxed">
              Her words echo as you step out into the warm Florida morning air and unlock your sedan in the driveway.
            </p>
          </div>
        )}

        {/* Step 2: Cockpit startup & Rules */}
        {step === 2 && (
          <div className="flex flex-col gap-4 animate-in fade-in duration-200">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <Shield className="w-7 h-7" />
              </div>
              <div>
                <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Engine Ignition • 8:28 AM</div>
                <h2 className="text-2xl font-black text-white tracking-tight">Behind the Wheel</h2>
              </div>
            </div>

            <p className="text-slate-300 text-sm leading-relaxed">
              You click your seatbelt into place and press the push-button ignition. The engine roars to life and the digital dashboard instruments light up.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700">
                <span className="font-bold text-sky-300 block mb-1"> Destination</span>
                <span>Orange County Courthouse (3.5 miles down FL-408 East)</span>
              </div>
              <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700">
                <span className="font-bold text-rose-300 block mb-1">Core Law of the Road</span>
                <span className="font-semibold text-white">One Life: Collisions immediately end the run.</span>
              </div>
            </div>

            <div className="p-3 bg-amber-950/40 rounded-xl border border-amber-700/50 text-xs text-amber-200">
              <span className="font-bold">Golden Rule:</span> “Don't drive like you have another life.”
            </div>
          </div>
        )}

        {/* Action Button */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          <div className="flex items-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={`w-2.5 h-2.5 rounded-full transition-all ${
                  i === step ? 'bg-sky-400 w-6' : 'bg-slate-700'
                }`}
              />
            ))}
          </div>

          <button
            onClick={handleNext}
            className="px-6 py-3 bg-sky-500 hover:bg-sky-400 active:bg-sky-600 text-slate-950 font-bold text-sm rounded-xl flex items-center gap-2 transition cursor-pointer shadow-lg shadow-sky-500/20"
          >
            <span>{step === 2 ? 'Start Driving' : 'Continue'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
