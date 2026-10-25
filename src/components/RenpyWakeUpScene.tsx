/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { soundManager } from '../audio/soundManager';
import { Bell, ChevronRight } from 'lucide-react';
import { IOSNotification } from './ios/IOSKit';
import wakeupImg from '../scenes/wakeup.png';
import momImg from '../scenes/mom.png';

interface RenpyWakeUpSceneProps {
  onComplete: () => void;
}

interface DialogueNode {
  speaker: string;
  text: string;
  choices?: { text: string; action: () => void }[];
}

export const RenpyWakeUpScene: React.FC<RenpyWakeUpSceneProps> = ({ onComplete }) => {
  // Blinking stages: 'closed' -> 'first_flutter' -> 'reclose' -> 'fully_open'
  const [blinkStage, setBlinkStage] = useState<'closed' | 'flutter_1' | 'closed_again' | 'awake'>('closed');
  const [alarmActive, setAlarmActive] = useState<boolean>(true);
  const [dialogueIndex, setDialogueIndex] = useState<number>(0);
  const [displayedText, setDisplayedText] = useState<string>('');
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [hasStarted, setHasStarted] = useState<boolean>(false);

  const dialogueList: DialogueNode[] = [
    {
      speaker: 'You (Thoughts)',
      text: 'Ugh... what is that sound? My head feels heavy. Morning light is burning through my eyelids...',
    },
    {
      speaker: 'Alarm Clock',
      text: '8:24 AM — BEEP BEEP BEEP! BEEP BEEP BEEP!',
    },
    {
      speaker: 'Mom',
      text: 'Honey! Wake up! Your alarm has been going off for fifteen minutes!',
    },
    {
      speaker: 'Mom',
      text: 'Didn’t you say you have mandatory JURY DUTY this morning at the Duval County Courthouse?!',
      choices: [
        {
          text: '“Wait... jury duty?! Today is October 24th?!”',
          action: () => handleAdvance(4),
        },
        {
          text: '“Check my phone notifications quickly.”',
          action: () => handleAdvance(4),
        },
      ],
    },
    {
      speaker: 'Phone Notification',
      text: 'FLORIDA JURY SERVICES: Mandatory appearance required. Check-in starts at 8:45 AM. Assembly Room 2B. Failure to appear may result in court citations.',
    },
    {
      speaker: 'Mom',
      text: 'Court check-in is in 20 minutes! Highway 408 is going to be packed with morning commuters.',
    },
    {
      speaker: 'You',
      text: 'I overslept! I need to grab my wallet, summons card, and get on the road right now!',
    },
    {
      speaker: 'Mom',
      text: 'Here are the car keys to the sedan. And listen to me very carefully...',
    },
    {
      speaker: 'Mom',
      text: 'No appointment, no summons, and no job on earth is worth your life. If traffic is bad, stay calm and drive defensively. Don’t drive like you have another life out there.',
    },
    {
      speaker: 'You',
      text: 'I will, Mom. I promise. One life. Let’s get to the courthouse safely.',
      choices: [
        {
          text: 'Grab Keys & Enter Cockpit',
          action: () => handleFinish(),
        },
      ],
    },
  ];

  // Start waking sequence
  const startWakeSequence = () => {
    setHasStarted(true);
    soundManager.init();
    soundManager.startAlarmClock();

    setTimeout(() => setBlinkStage('flutter_1'), 1100);
    setTimeout(() => setBlinkStage('closed_again'), 2400);
    setTimeout(() => {
      setBlinkStage('awake');
      soundManager.stopAlarmClock();
      setAlarmActive(false);
    }, 3600);
  };

  // Typewriter effect for dialogue
  useEffect(() => {
    if (blinkStage !== 'awake') return;

    const currentLine = dialogueList[dialogueIndex];
    if (!currentLine) return;

    setIsTyping(true);
    setDisplayedText('');
    let charIndex = 0;

    const timer = setInterval(() => {
      if (charIndex < currentLine.text.length) {
        setDisplayedText(currentLine.text.slice(0, charIndex + 1));
        charIndex++;
      } else {
        setIsTyping(false);
        clearInterval(timer);
      }
    }, 24);

    return () => clearInterval(timer);
  }, [dialogueIndex, blinkStage]);

  const handleAdvance = (nextIdx?: number) => {
    soundManager.playButtonClick();
    if (isTyping) {
      setDisplayedText(dialogueList[dialogueIndex].text);
      setIsTyping(false);
      return;
    }

    const currentLine = dialogueList[dialogueIndex];
    if (currentLine.choices && nextIdx === undefined) return; // Wait for choice click

    const next = nextIdx !== undefined ? nextIdx : dialogueIndex + 1;
    if (next < dialogueList.length) {
      setDialogueIndex(next);
    } else {
      handleFinish();
    }
  };

  const handleFinish = () => {
    soundManager.playButtonClick();
    soundManager.stopAlarmClock();
    onComplete();
  };

  const speaker = dialogueList[dialogueIndex].speaker;
  const momSpeaking = speaker === 'Mom';

  return (
    <div className="px-ui px-scanlines fixed inset-0 z-50 bg-black select-none overflow-hidden flex flex-col justify-between">
      {/* Pre-start overlay to satisfy browser autoplay restriction */}
      {!hasStarted && (
        <div
          className="px-scene absolute inset-0 z-50 flex flex-col items-center justify-center p-6 text-center"
          style={{ backgroundImage: `url(${wakeupImg})` }}
        >
          <div className="absolute inset-0 bg-[#0d0a1f]/75" />
          <div className="relative flex flex-col items-center">
            <div className="w-16 h-16 bg-[#ffb347] border-4 border-[#17122b] flex items-center justify-center text-[#17122b] mb-5 animate-pulse">
              <Bell className="w-8 h-8" />
            </div>
            <span className="px-title text-[10px] text-[#ffb347] mb-3">Prologue</span>
            <h2 className="px-title text-xl sm:text-2xl text-[#f4e9c8] mb-4 leading-relaxed">
              8:24 AM<br />Monday Morning
            </h2>
            <p className="text-[#f4e9c8]/80 text-lg max-w-md mb-8 leading-snug">
              Your alarm is ringing across your bedroom. Open your eyes to begin.
            </p>
            <button onClick={startWakeSequence} className="px-btn">
              Wake Up
            </button>
          </div>
        </div>
      )}

      {/* Bedroom pixel-art backdrop */}
      <div
        className={`px-scene px-scene-dim absolute inset-0 z-0 transition-all duration-1000 ${
          blinkStage === 'awake' ? 'filter-none' : 'blur-md'
        }`}
        style={{ backgroundImage: `url(${wakeupImg})` }}
      >
        {alarmActive && hasStarted && (
          <div className="absolute bottom-40 left-6 sm:left-16 px-tag animate-bounce">Buzzing!</div>
        )}

        {/* Mom portrait (appears once she is in the conversation) */}
        {blinkStage === 'awake' && dialogueIndex >= 2 && (
          <img
            src={momImg}
            alt="Mom"
            className={`px-art absolute bottom-0 right-2 sm:right-20 h-[52vh] sm:h-[68vh] max-h-[640px] w-auto object-contain pointer-events-none transition-all duration-300 animate-in fade-in slide-in-from-right-8 ${
              momSpeaking ? 'brightness-100' : 'brightness-75'
            }`}
            style={{ filter: `drop-shadow(6px 6px 0 rgba(0,0,0,0.45)) brightness(${momSpeaking ? 1 : 0.75})` }}
          />
        )}
      </div>

      {/* Eyelids */}
      <div
        className={`absolute top-0 left-0 right-0 bg-neutral-950 transition-all duration-700 ease-in-out z-30 pointer-events-none ${
          blinkStage === 'closed' ? 'h-1/2' : blinkStage === 'flutter_1' ? 'h-1/6' : blinkStage === 'closed_again' ? 'h-1/2' : 'h-0'
        }`}
      />
      <div
        className={`absolute bottom-0 left-0 right-0 bg-neutral-950 transition-all duration-700 ease-in-out z-30 pointer-events-none ${
          blinkStage === 'closed' ? 'h-1/2' : blinkStage === 'flutter_1' ? 'h-1/6' : blinkStage === 'closed_again' ? 'h-1/2' : 'h-0'
        }`}
      />

      {/* Top header / skip */}
      <div className="relative z-40 p-4 flex justify-between items-center">
        <span className="px-tag">Prologue: The Awakening</span>
        <button onClick={handleFinish} className="px-btn px-btn-sky !text-[10px] !py-2 !px-3">
          Skip Intro
        </button>
      </div>

      {/* Dialogue box */}
      {blinkStage === 'awake' && (
        <div className="relative z-40 p-4 sm:p-6 w-full max-w-4xl mx-auto mb-2 sm:mb-4 animate-in fade-in duration-300">
          {dialogueList[dialogueIndex].choices && (
            <div className="flex flex-col gap-3 mb-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
              {dialogueList[dialogueIndex].choices!.map((c, i) => (
                <button key={i} onClick={c.action} className="px-btn px-btn-sky flex items-center justify-between gap-3 w-full">
                  <span>{c.text}</span>
                  <ChevronRight className="w-4 h-4 shrink-0" />
                </button>
              ))}
            </div>
          )}

          <div
            onClick={() => handleAdvance()}
            className={speaker === 'Phone Notification' ? 'cursor-pointer' : 'px-panel p-5 pt-6 cursor-pointer relative'}
          >
            {speaker === 'Phone Notification' ? (
              (() => {
                const full = dialogueList[dialogueIndex].text;
                const split = full.indexOf(': ');
                const title = split > 0 ? full.slice(0, split) : 'Notification';
                const typedBody = displayedText.length > split + 2 ? displayedText.slice(split + 2) : '';
                return (
                  <IOSNotification
                    icon="jury"
                    title={title.toLowerCase().replace(/\b\w/g, (ch) => ch.toUpperCase())}
                    time="now"
                    body={
                      <>
                        {typedBody}
                        {isTyping && <span className="inline-block w-0.5 h-4 bg-black/60 ml-0.5 align-middle animate-pulse" />}
                      </>
                    }
                  />
                );
              })()
            ) : (
              <>
                <div className="px-tag absolute -top-4 left-4">{speaker}</div>
                <div className="text-[#f4e9c8] text-xl sm:text-2xl leading-snug min-h-[64px]">
                  {displayedText}
                  {isTyping && <span className="inline-block w-3 h-5 bg-[#ffb347] ml-1 align-middle px-blink" />}
                </div>
              </>
            )}

            {!isTyping && !dialogueList[dialogueIndex].choices && (
              <div className="flex justify-end pt-1">
                <span className="px-title text-[9px] text-[#ffb347] px-blink">NEXT ▼</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
