/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { DrivingDecisionEvent } from '../types/game';
import { AlertTriangle, Smartphone, ShieldCheck, Flame } from 'lucide-react';
import { IOSNotification } from './ios/IOSKit';

interface EventModalProps {
  event: DrivingDecisionEvent;
  onSelectOption: (optionId: string, impact: 'safe' | 'risky' | 'reckless') => void;
}

export const EventModal: React.FC<EventModalProps> = ({ event, onSelectOption }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-slate-900 border-2 border-amber-500/80 rounded-2xl shadow-2xl p-6 text-slate-100 flex flex-col gap-4">
        {/* Header Badge */}
        <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
          <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl">
            {event.sender ? <Smartphone className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-amber-400">
              Active Driving Decision
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white">{event.title}</h2>
          </div>
        </div>

        {/* Incoming text, shown like a native iPhone notification */}
        {event.sender && (
          <IOSNotification
            icon="messages"
            title={event.sender}
            body={event.description.match(/["“]([^"”]+)["”]/)?.[1] ?? 'New message'}
            time="now"
          />
        )}

        {/* Description / Scenario */}
        <p className="text-slate-200 text-sm leading-relaxed">{event.description}</p>

        {/* Prompt */}
        <div className="text-xs font-bold uppercase tracking-wider text-slate-400 pt-1">
          {event.prompt}
        </div>

        {/* Options */}
        <div className="flex flex-col gap-2.5 pt-1">
          {event.options.map((opt) => (
            <button
              key={opt.id}
              onClick={() => onSelectOption(opt.id, opt.impact)}
              className={`group text-left p-4 rounded-xl border transition-all duration-150 flex items-start gap-3.5 cursor-pointer ${
                opt.impact === 'safe'
                  ? 'bg-emerald-950/40 hover:bg-emerald-900/60 border-emerald-600/50 hover:border-emerald-400 text-emerald-100'
                  : opt.impact === 'risky'
                  ? 'bg-amber-950/40 hover:bg-amber-900/60 border-amber-600/50 hover:border-amber-400 text-amber-100'
                  : 'bg-rose-950/40 hover:bg-rose-900/60 border-rose-600/50 hover:border-rose-400 text-rose-100'
              }`}
            >
              <div className="mt-0.5 p-1.5 rounded-lg shrink-0">
                {opt.impact === 'safe' ? (
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                ) : opt.impact === 'risky' ? (
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                ) : (
                  <Flame className="w-5 h-5 text-rose-400" />
                )}
              </div>
              <div className="flex-1">
                <div className="font-semibold text-sm group-hover:underline">{opt.text}</div>
                <div className="text-xs opacity-80 mt-0.5">{opt.description}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
