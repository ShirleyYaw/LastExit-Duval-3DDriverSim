# Last Exit : Duval
### A Cinematic 3D Driving Simulator & Civic Responsibility Experience

> *“Don't drive like you have another life.”*

---

## 1. Project Overview & Civic Purpose

**Last Exit : Duval** is a cinematic, first-person 3D driving game. It pairs technical 3D game engineering with a vital social and civic message: everyday decisions on public roads have life-or-death consequences, and democratic participation—like jury service—demands responsibility and care for our fellow citizens.

### The Central Message:
Arcade video games allow infinite restarts and respawns. Real life does not. On public highways, a single moment of rushing, tailgating, or glancing down at a text message can end someone's life in an instant.

### Core Narrative Arc:
1. **Prologue (8:24 AM)**: You wake up late to an urgent notification: mandatory check-in for Florida Juror Summons #4812 begins at 8:45 AM at the Duval County Courthouse.
2. **Chapter 1: Drive to the Courthouse**: Morning highway drive on FL-408 East. Navigate traffic, resist distracting notifications from your boss, handle aggressive tailgaters safely, and reach the courthouse.
3. **Chapter 2: Jury Orientation**: Interactive civic session in Assembly Room 2B. Learn about Article III and the Sixth/Seventh Amendment constitutional right to an impartial trial by jury of peers, silence your phone, and reflect on community duty.
4. **Chapter 3: Drive Home**: Afternoon return trip through a sudden Florida rainstorm. Practice defensive driving on slick roads and encounter state trooper radar patrols.
5. **Chapter 4: Arrival at Home**: Pull into your driveway and talk to Mom. Her dialogue dynamically reflects your actual speed, safety choices, and citations.

---

## 2. Controls

| Action | Keyboard | Touch / On-Screen Controls |
| :--- | :--- | :--- |
| **Accelerate (Gas)** | `W` or `Up Arrow` | On-Screen **Gas** button |
| **Brake / Reverse** | `S` or `Down Arrow` | On-Screen **Brake** button |
| **Steer Left / Right** | `A` / `D` or `Left` / `Right Arrow` | On-Screen **Left / Right** buttons |
| **Emergency Stop** | `Spacebar` | On-Screen **Space** button |
| **Check Left Mirror** (hold) | `1` | Look pad: **L Mirror** |
| **Check Rearview Mirror** (hold) | `2` | Look pad: **Rear** |
| **Check Right Mirror** (hold) | `3` | Look pad: **R Mirror** |
| **Shoulder / Blind-Spot Check** (hold) | `Z` (left) / `X` (right) | Look pad: **Shoulder** buttons |
| **Look Around Freely** | Click and drag on the road view | Touch and drag |
| **Turn Signals** | `Q` (left) / `E` (right) | On-Screen signal buttons |
| **Hazards / Headlights / Wipers** | `F` / `L` / `K` | On-Screen toggles |
| **Horn** | `H` | On-Screen horn button |
| **Switch Camera** | `C` | Top HUD Camera button (Cockpit / Hood) |
| **Show / Hide Control Dock** | `T` | Dock chevron |
| **Pause Game** | `P` or `Escape` | Top HUD Pause button |

> Mirrors and head turns only work in **Cockpit** view. The Hood camera is an assist view with no mirrors and no defensive-driving scoring.

---

## 3. Key Technical Features

- **Three.js WebGL 3D Engine**:
  - Fully procedural environment with zero external 404 dependencies.
  - Multi-part composite 3D vehicles (3–12 sub-assemblies per model): Sedans, SUVs, Pickup Trucks, Delivery Vans, and Florida State Trooper Cruisers with synchronized red/blue emergency strobe lighting.
  - Procedural road streaming system with asphalt textures, rumble strips, double-yellow median, and dashed lane dividers.
  - Florida scenery: Royal palms, Neoclassical courthouse with pillars and pediment, roadside houses, gas stations, and overhead highway gantries.
- **First-Person Cockpit Realism**:
  - Detailed leatherette dashboard with instrument cluster binnacle.
  - Functioning speedometer dial needle and tachometer (RPM) needle.
  - Center 10-inch GPS infotainment screen with live updating route progress, turn prompts, and destination tracker.
  - Rotating steering wheel with spokes and central horn.
  - Rearview and side mirrors, A-pillar windshield framing, and subtle tinted glass.
  - Speed-dependent steering and camera inertia (subtle dip under braking, rise on acceleration, roll on turns).
- **Head Look & Working Mirrors (true defensive driving)**:
  - The driver's head pivots at the neck. Hold a key to glance at the left mirror, rearview mirror or right mirror (the view zooms in as your eyes focus), or turn over your shoulder to check the blind spot. Drag with the mouse or a finger to look around freely; your head springs back to center on release.
  - Three independent mirror cameras (rearview, driver side, passenger side) with realistic, limited fields of view. A car alongside you really is invisible in the mirrors and only shows up in a shoulder check.
  - Scripted traffic teaches the habit: a **blind-spot lurker** matches your speed beside your rear door, and an aggressive **tailgater** appears in your rearview mirror before you are asked how to respond.
  - A **defensive-driving monitor** scores what you actually do: turn signal before a lane change, mirror check, shoulder check, lane actually clear, the 3-second following distance, scanning your mirrors every 5-8 seconds, and keeping your eyes off the road for no more than about 2 seconds.
- **Realistic Cockpit & Instrument Cluster**:
  - Canvas-rendered analog speedometer (with the posted speed limit marked on the dial), tachometer with redline, gear display, turn-signal and hazard indicators, a following-gap readout and a mirror-scan timer.
  - Dash, tilted steering wheel, pillars, door trims, headrests and rear-window frame, windshield wipers that sweep in the glass plane, and rain droplets that build up until the wipers clear them.
- **iOS-Style Phone UI**:
  - Incoming texts, the juror summons alert and phone notifications use iOS Human Interface Guidelines styling: frosted-glass banners (`backdrop-filter: blur(25px)`), rounded corners, subtle drop shadows and Apple's system font stack (SF Pro on Apple devices, with sensible fallbacks elsewhere).
  - The in-car Phone tab is a Messages thread with `#e9e9eb` received bubbles and `#007aff` sent bubbles. Replying while driving shows a blue "Delivered" bubble (and costs Safety points).
  - Shared styles live in `src/index.css` (`.ios-*`) and components in `src/components/ios/IOSKit.tsx`.
- **Procedural Web Audio API Synthesizer**:
  - Dynamic RPM-mapped sawtooth/sub-bass engine sound generator.
  - Physical tire friction brake screech on hard deceleration.
  - Dual-tone turn signal clicks.
  - Resonant police siren wail with low-frequency oscillator (LFO).
  - Heavy white-noise and low-end distortion crash impact.
  - Procedural rain audio using filtered pink noise.
- **Mandatory "THERE IS NO RESTART" Collision Rule**:
  - Tight 3D AABB bounding box collision detection.
  - Colliding with another vehicle immediately terminates the run. There are no collision respawns. Players are presented with a sobering reflection on the permanence of highway decisions.
- **Dynamic Scoring & Branching Outcomes**:
  - Tracks defensive driving score, civic duty rating, speeding citations, near-misses, phone management choices, and road-rage de-escalation.
  - Fully customized Chapter 4 Mom dialogue matching your actual driving behavior.

---

## 4. Testing & Verification Report

The application was built and validated with the following test procedures:
1. **Compilation (`compile_applet`)**: Verified TypeScript builds cleanly without errors.
2. **Type Checking & Linting (`tsc --noEmit`)**: 100% clean check, all types and imports verified.
3. **Responsive Viewports**: Tested at desktop (1920x1080), laptop (1366x768), and tablet/mobile resolutions.
4. **WebGL Fallback / Software Detection**: Integrated detection of software vs hardware WebGL to adjust shadow maps and render pixel ratios automatically.
5. **Audio Context Restrictions**: Audio initialization strictly deferred to user click/interaction, conforming to browser autoplay security policies.
6. **Defensive-Driving Logic**: The head-look controller, the lane-change / scan / following-distance monitor and the scripted traffic behaviors are plain TypeScript modules (`src/game/lookController.ts`, `defensiveDriving.ts`, `trafficBehavior.ts`) with no 3D dependency, so they can be unit tested in Node.

---

## 5. 3-Minute Demonstration Video Guide

To record a walkthrough video demonstration:
1. **Minute 0:00 – 0:45 (The Problem & The Hook)**:
   - Introduce the dual theme: jury duty civic service and driver safety.
   - Show the Chapter 1 opening sequence (late alarm, summons alert, grabbing keys).
2. **Minute 0:45 – 1:45 (First-Person 3D Driving Simulator)**:
   - Highlight the 3D cockpit: working speedometer, tachometer, GPS navigation, and rotating steering wheel.
   - Show traffic navigation, receiving the urgent text message, and choosing the defensive option (leaving the phone alone).
   - Hold `2` to check the rearview mirror, then signal, check the left mirror (`1`), shoulder-check (`Z`) and change lanes. Point out that the car beside you is invisible in the mirrors but visible over your shoulder.
3. **Minute 1:45 – 2:30 (Courthouse & Civic Orientation)**:
   - Reach the Duval County Courthouse.
   - Walk into Juror Assembly Room 2B, power off your phone, and answer the judge's civic responsibility question.
4. **Minute 2:30 – 3:00 (Drive Home, Rain Storm & Mom's Ending)**:
   - Drive home during the afternoon storm with procedural rain particles.
   - Arrive safely in the driveway to hear Mom's personalized evaluation.
   - Conclude with the core takeaway: *“Don't drive like you have another life.”*
