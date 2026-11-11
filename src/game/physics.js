// Synergy's body. One fixed step, pure: the game, the planner and the level
// check all run this exact function, so a jump that works in the checker works
// on a phone.

import { T, SOLID, ONEWAY, BALL, EMPTY, tileAt } from './level.js';

export const DT = 1 / 120;
export const RUN = 86, JUMP = 206, GRAV = 560, FALL = 300, BOUNCE = 330, CUT = 80;
export const ACC_GROUND = 1500, ACC_AIR = 1000, COYOTE = .09, BUFFER = .12;
export const HW = 4, HH = 18;          // half width, height: an 8 x 18 box with x at the centre and y at the feet
export const EV = { JUMP:1, LAND:2, BOUNCE:4, BONK:8 };

export const newBody = (x, y) => ({ x, y, vx:0, vy:0, ground:true, coy:COYOTE, buf:0, held:false, cut:false, sprung:false, face:1 });

const EPS = 1e-4;
export function blocked(f, x, y) {            // would the box at (x, y) overlap a solid tile
  const c0 = Math.floor((x - HW) / T), c1 = Math.floor((x + HW - EPS) / T);
  const r0 = Math.floor((y - HH) / T), r1 = Math.floor((y - EPS) / T);
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (tileAt(f, c, r) === SOLID) return true;
  return false;
}

// input: { dir:-1|0|1, jump:boolean }. Returns a bitmask of EV.
export function step(p, input, f) {
  let ev = 0;
  const dir = input.dir, acc = (p.ground ? ACC_GROUND : ACC_AIR) * DT, want = dir * RUN;
  p.vx += Math.max(-acc, Math.min(acc, want - p.vx));
  if (dir) p.face = dir;

  if (input.jump && !p.held) p.buf = BUFFER;
  p.held = input.jump;
  p.buf -= DT; p.coy = p.ground ? COYOTE : p.coy - DT;
  if (p.buf > 0 && p.coy > 0) { p.vy = -JUMP; p.ground = false; p.buf = 0; p.coy = 0; p.cut = false; p.sprung = false; ev |= EV.JUMP; }
  // Let go early for a short hop. A bounce off a ball always runs its full height.
  if (!input.jump && !p.cut && !p.sprung && p.vy < -CUT) { p.vy = -CUT; p.cut = true; }
  p.vy = Math.min(FALL, p.vy + GRAV * DT);

  // sideways, stopping flush against walls
  const nx = p.x + p.vx * DT;
  if (blocked(f, nx, p.y)) {
    if (p.vx > 0) p.x = Math.floor((nx + HW - EPS) / T) * T - HW;
    else if (p.vx < 0) p.x = (Math.floor((nx - HW) / T) + 1) * T + HW;
    p.vx = 0;
  } else p.x = nx;

  // up and down
  const was = p.ground, py = p.y, ny = p.y + p.vy * DT;
  p.ground = false;
  if (p.vy >= 0) {
    const r = Math.floor(ny / T), top = r * T;
    let hit = EMPTY;
    if (py <= top + EPS && ny >= top) {
      const c0 = Math.floor((p.x - HW) / T), c1 = Math.floor((p.x + HW - EPS) / T);
      for (let c = c0; c <= c1; c++) { const k = tileAt(f, c, r); if (k === SOLID || k === ONEWAY) hit = SOLID; else if (k === BALL && hit === EMPTY) hit = BALL; }
    }
    if (hit === SOLID) { p.y = top; p.vy = 0; p.ground = true; p.cut = false; p.sprung = false; if (!was) ev |= EV.LAND; }
    else if (hit === BALL) { p.y = top; p.vy = -BOUNCE; p.sprung = true; p.cut = false; ev |= EV.BOUNCE; }
    else p.y = ny;
  } else if (blocked(f, p.x, ny)) {
    p.y = (Math.floor((ny - HH) / T) + 1) * T + HH; p.vy = 0; ev |= EV.BONK;
  } else p.y = ny;
  return ev;
}

// Can a body stand centred on this cell: floor underneath, room for the box above.
export function standable(f, cx, cy) {
  const k = tileAt(f, cx, cy);
  return (k === SOLID || k === ONEWAY) && !blocked(f, cx * T + T / 2, cy * T);
}
