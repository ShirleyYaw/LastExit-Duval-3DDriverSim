/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

class SoundManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineSubOsc: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;

  // Radio Station Synthesizers
  private radioGain: GainNode | null = null;
  private radioOscs: OscillatorNode[] = [];
  private radioInterval: number | null = null;
  private currentRadioStation: number = -1; // -1: off

  // Turn signal state
  private turnSignalInterval: number | null = null;
  private turnSignalTickTock: boolean = false;

  // Horn
  private hornOsc1: OscillatorNode | null = null;
  private hornOsc2: OscillatorNode | null = null;
  private hornGain: GainNode | null = null;

  // Alarm clock
  private alarmInterval: number | null = null;

  private sirenOsc: OscillatorNode | null = null;
  private sirenGain: GainNode | null = null;
  private sirenLfo: OscillatorNode | null = null;
  private rainNode: AudioNode | null = null;
  private rainGain: GainNode | null = null;

  private isMuted: boolean = false;
  private volume: number = 0.75;
  private isEngineRunning: boolean = false;
  private isSirenActive: boolean = false;

  public init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    } catch (e) {
      console.warn('Web Audio API not supported', e);
    }
  }

  public resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime, 0.05);
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime, 0.05);
    }
  }

  // --- ENGINE ---
  public startEngine() {
    this.init();
    if (!this.ctx || !this.masterGain || this.isEngineRunning) return;
    this.resume();

    try {
      const now = this.ctx.currentTime;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.setValueAtTime(0.01, now);
      this.engineGain.gain.linearRampToValueAtTime(0.22, now + 0.3);

      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.setValueAtTime(140, now);
      this.engineFilter.Q.setValueAtTime(3.0, now);

      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.setValueAtTime(45, now);

      this.engineSubOsc = this.ctx.createOscillator();
      this.engineSubOsc.type = 'triangle';
      this.engineSubOsc.frequency.setValueAtTime(22.5, now);

      this.engineOsc.connect(this.engineFilter);
      this.engineSubOsc.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.masterGain);

      this.engineOsc.start();
      this.engineSubOsc.start();
      this.isEngineRunning = true;
    } catch (e) {
      console.warn('Engine audio error', e);
    }
  }

  public updateEnginePitch(speedMph: number, isAccelerating: boolean) {
    if (!this.ctx || !this.isEngineRunning || !this.engineOsc || !this.engineFilter || !this.engineGain) return;
    const now = this.ctx.currentTime;

    const baseFreq = 42 + (speedMph / 100) * 110 + (isAccelerating ? 15 : 0);
    this.engineOsc.frequency.setTargetAtTime(baseFreq, now, 0.1);
    if (this.engineSubOsc) {
      this.engineSubOsc.frequency.setTargetAtTime(baseFreq * 0.5, now, 0.1);
    }

    const cutoff = 130 + (speedMph / 100) * 380 + (isAccelerating ? 70 : 0);
    this.engineFilter.frequency.setTargetAtTime(cutoff, now, 0.12);

    const gainVol = 0.18 + Math.min(speedMph / 80, 0.18) + (isAccelerating ? 0.08 : 0);
    this.engineGain.gain.setTargetAtTime(gainVol, now, 0.1);
  }

  public stopEngine() {
    if (!this.isEngineRunning || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      if (this.engineGain) {
        this.engineGain.gain.linearRampToValueAtTime(0.001, now + 0.2);
      }
      setTimeout(() => {
        try {
          this.engineOsc?.stop();
          this.engineOsc?.disconnect();
          this.engineSubOsc?.stop();
          this.engineSubOsc?.disconnect();
          this.engineFilter?.disconnect();
          this.engineGain?.disconnect();
        } catch (_) {}
        this.engineOsc = null;
        this.engineSubOsc = null;
        this.engineFilter = null;
        this.engineGain = null;
        this.isEngineRunning = false;
      }, 250);
    } catch (_) {
      this.isEngineRunning = false;
    }
  }

  // --- CAR HORN ---
  public startHorn() {
    this.init();
    if (!this.ctx || !this.masterGain || this.hornGain) return;
    this.resume();

    try {
      const now = this.ctx.currentTime;
      this.hornGain = this.ctx.createGain();
      this.hornGain.gain.setValueAtTime(0.35, now);
      this.hornGain.connect(this.masterGain);

      // American sedan dual horn frequencies: ~415 Hz and ~500 Hz
      this.hornOsc1 = this.ctx.createOscillator();
      this.hornOsc1.type = 'sawtooth';
      this.hornOsc1.frequency.setValueAtTime(415, now);

      this.hornOsc2 = this.ctx.createOscillator();
      this.hornOsc2.type = 'sawtooth';
      this.hornOsc2.frequency.setValueAtTime(495, now);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1200, now);

      this.hornOsc1.connect(filter);
      this.hornOsc2.connect(filter);
      filter.connect(this.hornGain);

      this.hornOsc1.start();
      this.hornOsc2.start();
    } catch (_) {}
  }

  public stopHorn() {
    if (!this.hornGain || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      this.hornGain.gain.linearRampToValueAtTime(0.001, now + 0.05);
      setTimeout(() => {
        try {
          this.hornOsc1?.stop();
          this.hornOsc1?.disconnect();
          this.hornOsc2?.stop();
          this.hornOsc2?.disconnect();
          this.hornGain?.disconnect();
        } catch (_) {}
        this.hornOsc1 = null;
        this.hornOsc2 = null;
        this.hornGain = null;
      }, 60);
    } catch (_) {
      this.hornGain = null;
    }
  }

  // --- TURN SIGNAL BLINKER CLICKS ---
  public startTurnSignal() {
    if (this.turnSignalInterval) return;
    this.init();
    this.resume();

    this.turnSignalTickTock = false;
    const playClick = () => {
      if (!this.ctx || !this.masterGain) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      // Alternating tick vs tock pitch
      const freq = this.turnSignalTickTock ? 850 : 1150;
      this.turnSignalTickTock = !this.turnSignalTickTock;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.04);
    };

    playClick();
    this.turnSignalInterval = window.setInterval(playClick, 450); // ~75 clicks/min
  }

  public stopTurnSignal() {
    if (this.turnSignalInterval) {
      clearInterval(this.turnSignalInterval);
      this.turnSignalInterval = null;
    }
  }

  // --- MORNING ALARM BUZZ (BEEP BEEP BEEP) ---
  public startAlarmClock() {
    if (this.alarmInterval) return;
    this.init();
    this.resume();

    const beep = () => {
      if (!this.ctx || !this.masterGain) return;
      const now = this.ctx.currentTime;
      for (let i = 0; i < 4; i++) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(880, now + i * 0.12);
        gain.gain.setValueAtTime(0.18, now + i * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.07);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now + i * 0.12);
        osc.stop(now + i * 0.12 + 0.08);
      }
    };

    beep();
    this.alarmInterval = window.setInterval(beep, 1200);
  }

  public stopAlarmClock() {
    if (this.alarmInterval) {
      clearInterval(this.alarmInterval);
      this.alarmInterval = null;
    }
  }

  // --- CAR RADIO (PROCEDURAL STATIONS) ---
  public setRadioStation(station: number, vol: number = 0.5) {
    this.init();
    if (!this.ctx || !this.masterGain) return;
    this.resume();

    this.stopRadio();
    if (station < 0) return; // Radio off

    this.currentRadioStation = station;
    const now = this.ctx.currentTime;
    this.radioGain = this.ctx.createGain();
    this.radioGain.gain.setValueAtTime(0.01, now);
    this.radioGain.gain.linearRampToValueAtTime(vol * 0.22, now + 0.3);
    this.radioGain.connect(this.masterGain);

    if (station === 0) {
      // Station 0: FL Civic News / Talk Radio (simulated voice formant cadence)
      let wordStep = 0;
      this.radioInterval = window.setInterval(() => {
        if (!this.ctx || !this.radioGain) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const filt = this.ctx.createBiquadFilter();
        const g = this.ctx.createGain();

        const formants = [260, 320, 220, 280, 190];
        const pitch = formants[wordStep % formants.length];
        wordStep++;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(pitch, t);
        filt.type = 'bandpass';
        filt.frequency.setValueAtTime(900, t);
        filt.Q.setValueAtTime(4, t);

        g.gain.setValueAtTime(0.12, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

        osc.connect(filt);
        filt.connect(g);
        g.connect(this.radioGain!);

        osc.start(t);
        osc.stop(t + 0.2);
      }, 220);

    } else if (station === 1) {
      // Station 1: 80s Synthwave / Lo-Fi Highway Chill
      const chords = [
        [164.81, 220.00, 261.63], // E minor
        [146.83, 196.00, 246.94], // D major
        [130.81, 164.81, 196.00], // C major
        [146.83, 220.00, 293.66], // D sus
      ];
      let chordIdx = 0;

      const playChord = () => {
        if (!this.ctx || !this.radioGain) return;
        const t = this.ctx.currentTime;
        const chord = chords[chordIdx % chords.length];
        chordIdx++;

        chord.forEach((freq) => {
          const osc = this.ctx!.createOscillator();
          const filter = this.ctx!.createBiquadFilter();
          const g = this.ctx!.createGain();

          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, t);
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(650, t);

          g.gain.setValueAtTime(0.07, t);
          g.gain.linearRampToValueAtTime(0.001, t + 1.8);

          osc.connect(filter);
          filter.connect(g);
          g.connect(this.radioGain!);

          osc.start(t);
          osc.stop(t + 1.9);
        });
      };

      playChord();
      this.radioInterval = window.setInterval(playChord, 1800);

    } else if (station === 2) {
      // Station 2: Pop / Classic Rock Arpeggio (98.5 The Beat)
      const notes = [261.63, 329.63, 392.00, 523.25, 440.00, 392.00, 329.63, 293.66];
      let noteIdx = 0;
      this.radioInterval = window.setInterval(() => {
        if (!this.ctx || !this.radioGain) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(notes[noteIdx % notes.length], t);
        noteIdx++;

        g.gain.setValueAtTime(0.12, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

        osc.connect(g);
        g.connect(this.radioGain!);

        osc.start(t);
        osc.stop(t + 0.24);
      }, 250);

    } else {
      // Station 3: Classical Piano 102.3
      const classicalChords = [
        [220.0, 277.18, 329.63, 440.0], // A major
        [196.0, 246.94, 293.66, 392.0], // G major
        [174.61, 220.0, 261.63, 349.23], // F major
        [164.81, 207.65, 246.94, 329.63], // E major
      ];
      let cIdx = 0;
      const playClassical = () => {
        if (!this.ctx || !this.radioGain) return;
        const t = this.ctx.currentTime;
        const c = classicalChords[cIdx % classicalChords.length];
        cIdx++;

        c.forEach((freq, i) => {
          const osc = this.ctx!.createOscillator();
          const g = this.ctx!.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, t + i * 0.08);

          g.gain.setValueAtTime(0.08, t + i * 0.08);
          g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 1.2);

          osc.connect(g);
          g.connect(this.radioGain!);

          osc.start(t + i * 0.08);
          osc.stop(t + i * 0.08 + 1.3);
        });
      };
      playClassical();
      this.radioInterval = window.setInterval(playClassical, 2200);
    }
  }

  public stopRadio() {
    if (this.radioInterval) {
      clearInterval(this.radioInterval);
      this.radioInterval = null;
    }
    if (this.radioGain && this.ctx) {
      try {
        this.radioGain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
        setTimeout(() => {
          this.radioGain?.disconnect();
          this.radioGain = null;
        }, 120);
      } catch (_) {
        this.radioGain = null;
      }
    }
    this.currentRadioStation = -1;
  }

  // --- BRAKE SCREECH, CRASH, CHIME, SIREN, RAIN ---
  public playBrakeScreech() {
    this.init();
    if (!this.ctx || !this.masterGain) return;
    this.resume();

    try {
      const now = this.ctx.currentTime;
      const bufferSize = this.ctx.sampleRate * 0.4;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.7));
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2200, now);
      filter.frequency.exponentialRampToValueAtTime(800, now + 0.35);
      filter.Q.setValueAtTime(5, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      noise.start();
    } catch (_) {}
  }

  public playCrashSound() {
    this.init();
    if (!this.ctx || !this.masterGain) return;
    this.resume();
    this.stopEngine();
    this.stopSiren();
    this.stopRadio();
    this.stopTurnSignal();
    this.stopHorn();

    try {
      const now = this.ctx.currentTime;
      const bufferSize = Math.floor(this.ctx.sampleRate * 1.4);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1800, now);
      filter.frequency.exponentialRampToValueAtTime(100, now + 1.2);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.75, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.3);

      const subOsc = this.ctx.createOscillator();
      subOsc.type = 'sawtooth';
      subOsc.frequency.setValueAtTime(110, now);
      subOsc.frequency.exponentialRampToValueAtTime(20, now + 0.8);

      const subGain = this.ctx.createGain();
      subGain.gain.setValueAtTime(0.65, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      subOsc.connect(subGain);
      subGain.connect(this.masterGain);

      noise.start();
      subOsc.start();
      subOsc.stop(now + 1.0);
    } catch (_) {}
  }

  public playPhoneChime() {
    this.init();
    if (!this.ctx || !this.masterGain) return;
    this.resume();

    try {
      const now = this.ctx.currentTime;
      const notes = [587.33, 880];
      notes.forEach((freq, idx) => {
        if (!this.ctx || !this.masterGain) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);
        gain.gain.setValueAtTime(0.001, now + idx * 0.12);
        gain.gain.linearRampToValueAtTime(0.25, now + idx * 0.12 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.35);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 0.4);
      });
    } catch (_) {}
  }

  public playPhoneBuzz() {
    this.init();
    if (!this.ctx || !this.masterGain) return;
    this.resume();

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(90, now);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.2);
    } catch (_) {}
  }

  public startSiren() {
    this.init();
    if (!this.ctx || !this.masterGain || this.isSirenActive) return;
    this.resume();

    try {
      const now = this.ctx.currentTime;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.setValueAtTime(0.01, now);
      this.sirenGain.gain.linearRampToValueAtTime(0.22, now + 0.5);

      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'sine';
      this.sirenOsc.frequency.setValueAtTime(750, now);

      this.sirenLfo = this.ctx.createOscillator();
      this.sirenLfo.frequency.setValueAtTime(1.8, now);

      const lfoGain = this.ctx.createGain();
      lfoGain.gain.setValueAtTime(220, now);

      this.sirenLfo.connect(lfoGain);
      lfoGain.connect(this.sirenOsc.frequency);

      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.masterGain);

      this.sirenLfo.start();
      this.sirenOsc.start();
      this.isSirenActive = true;
    } catch (_) {}
  }

  public stopSiren() {
    if (!this.isSirenActive || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      if (this.sirenGain) {
        this.sirenGain.gain.linearRampToValueAtTime(0.001, now + 0.5);
      }
      setTimeout(() => {
        try {
          this.sirenOsc?.stop();
          this.sirenOsc?.disconnect();
          this.sirenLfo?.stop();
          this.sirenLfo?.disconnect();
          this.sirenGain?.disconnect();
        } catch (_) {}
        this.sirenOsc = null;
        this.sirenLfo = null;
        this.sirenGain = null;
        this.isSirenActive = false;
      }, 550);
    } catch (_) {
      this.isSirenActive = false;
    }
  }

  public playButtonClick() {
    this.init();
    if (!this.ctx || !this.masterGain) return;
    this.resume();

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(650, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.04);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.06);
    } catch (_) {}
  }

  /** Soft positive "ding" (good defensive-driving habit). */
  public playScanChime() {
    this.init();
    if (!this.ctx || !this.masterGain) return;
    this.resume();
    try {
      const now = this.ctx.currentTime;
      for (const [f, t] of [[880, 0], [1320, 0.09]] as const) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now + t);
        gain.gain.setValueAtTime(0.0001, now + t);
        gain.gain.exponentialRampToValueAtTime(0.12, now + t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.22);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now + t);
        osc.stop(now + t + 0.25);
      }
    } catch (_) {}
  }

  /** Double beep used for defensive-driving warnings. */
  public playWarningBeep() {
    this.init();
    if (!this.ctx || !this.masterGain) return;
    this.resume();
    try {
      const now = this.ctx.currentTime;
      for (const t of [0, 0.16]) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(520, now + t);
        gain.gain.setValueAtTime(0.0001, now + t);
        gain.gain.exponentialRampToValueAtTime(0.09, now + t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.12);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now + t);
        osc.stop(now + t + 0.14);
      }
    } catch (_) {}
  }

  /** Another driver leaning on their horn (does not touch the player's horn). */
  public playNpcHonk() {
    this.init();
    if (!this.ctx || !this.masterGain) return;
    this.resume();
    try {
      const now = this.ctx.currentTime;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.16, now + 0.02);
      gain.gain.setValueAtTime(0.16, now + 0.32);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
      gain.connect(this.masterGain);
      for (const f of [392, 494]) {
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(f, now);
        osc.connect(gain);
        osc.start(now);
        osc.stop(now + 0.45);
      }
    } catch (_) {}
  }

  public startRainSound() {
    this.init();
    if (!this.ctx || !this.masterGain || this.rainNode) return;
    this.resume();

    try {
      const now = this.ctx.currentTime;
      const bufferSize = this.ctx.sampleRate * 2;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        data[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = data[i];
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, now);

      this.rainGain = this.ctx.createGain();
      this.rainGain.gain.setValueAtTime(0.01, now);
      this.rainGain.gain.linearRampToValueAtTime(0.18, now + 0.8);

      noise.connect(filter);
      filter.connect(this.rainGain);
      this.rainGain.connect(this.masterGain);

      noise.start();
      this.rainNode = noise;
    } catch (_) {}
  }

  public stopRainSound() {
    if (!this.rainGain || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      this.rainGain.gain.linearRampToValueAtTime(0.001, now + 0.5);
      setTimeout(() => {
        try {
          (this.rainNode as any)?.stop?.();
          this.rainNode?.disconnect();
          this.rainGain?.disconnect();
        } catch (_) {}
        this.rainNode = null;
        this.rainGain = null;
      }, 550);
    } catch (_) {
      this.rainNode = null;
    }
  }
}

export const soundManager = new SoundManager();
