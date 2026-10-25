/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/** In-game minutes pass 10x faster than real seconds (1 minute per 6 s). */
export const GAME_SECONDS_PER_MINUTE = 6;
export const DRIVE_TIME_LIMIT_SEC = 180;

/** Morning clock starts at 8:24 AM; formats like "8:41 AM". */
export function formatGameClock(elapsedSec: number): string {
  const total = 8 * 60 + 24 + Math.floor(Math.max(0, elapsedSec) / GAME_SECONDS_PER_MINUTE);
  const h24 = Math.floor(total / 60);
  const m = total % 60;
  const suffix = h24 >= 12 ? 'PM' : 'AM';
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${m < 10 ? '0' : ''}${m} ${suffix}`;
}
