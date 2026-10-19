// Wallpaper modes and pure helpers (L486–494, L594, L608).
import { own } from '../core/own.js'

export const CITY_H = 180

export const MODES={
  night:{name:'Montréal by night',cap:'mont-royal · 11:48 pm',sky:[[11,16,48],[38,48,106],[78,60,124]],hill:'#1b2142',tree:'#141a36',far:'#262d58',bld:'#10152c',edge:'#1f2850',win:'#ffd98a',dark:'#0a0e20',water:[[24,30,66],[8,10,26]],quay:'#2a2f4a',bridge:'#2f5a50',rim:'#ff7ac0',gond:'#ffd98a',spark:'#ffd98a',snow:1,lit:.42},
  golden:{name:'Golden hour',cap:'vieux-port · 7:12 pm',sky:[[62,42,112],[217,87,122],[255,184,96]],hill:'#4a2a5c',tree:'#3a1f4a',far:'#6c3c6c',bld:'#3a1f4a',edge:'#5a3360',win:'#ffcf7a',dark:'#2a1638',water:[[200,84,112],[58,36,86]],quay:'#2a1638',bridge:'#2d4a40',rim:'#ffd6a0',gond:'#ffcf7a',spark:'#ffe2a0',snow:.35,lit:.22},
  day:{name:'Snow day',cap:'parc olympique · 2:05 pm',sky:[[63,134,224],[140,196,255],[223,240,255]],hill:'#e8f0fa',tree:'#4f7a62',far:'#c3d1e4',bld:'#7f92ab',edge:'#a9b9cd',win:'#d9eeff',dark:'#5d6f88',water:[[96,148,206],[52,98,150]],quay:'#e2eaf4',bridge:'#3f7a5a',rim:'#5d6f88',gond:'#e8452e',spark:'#ffffff',snow:.55,lit:.3},
};
export const CROSS=['#ffffff','#b07cff','#ff5a6a','#5fe08a','#6ab8ff'];
export const RAC=[["........GG","......GGGG","KGKGGGGKWK",".GGGGGGGGG","..G.G..G.G"],["........GG","......GGGG","KGKGGGGKWK",".GGGGGGGGG","...GG...GG"]];
export const RPAL={G:'#8d939c',K:'#2a2a30',W:'#ffffff'};
export const BOAT=["......WW......","....WWWWWW....","..RRRRRRRRRR..","KKKKKKKKKKKKKK",".KKKKKKKKKKKK."];

export const MODE_KEYS = Object.keys(MODES)

/** True only for real mode keys (never inherited Object.prototype members; fix B1). */
export const isMode = (k) => typeof k === 'string' && own(MODES, k) !== undefined

/** Montréal-time wallpaper (L608): 7–16 day, 17–19 golden, otherwise night. Hour 12 if the zone is invalid. */
export function autoWp(date = new Date(), tz = 'America/Toronto') {
  let h = 12
  try {
    const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hourCycle: 'h23' })
    const n = parseInt(fmt.format(date), 10)
    if (Number.isFinite(n)) h = n % 24
  } catch {
    h = 12
  }
  return h >= 7 && h < 17 ? 'day' : h >= 17 && h < 20 ? 'golden' : 'night'
}

/** Pixel-city canvas width for an OS of w×h (L594). */
export const clampWidth = (w, h) => Math.max(160, Math.min(420, Math.round((CITY_H * (w || 900)) / (h || 675))))
