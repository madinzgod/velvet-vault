// actors.js — the thief, the guards and the alarm. Guards walk their
// patrol routes, break off to investigate coin noise or a glimpse of
// the thief, and converge when the alarm runs hot. The alarm rises
// while any guard or camera holds the thief in view and drains while
// she is hidden; at 100 the heist is over.

import { detection, lineOfSight } from './vision.js';

export const GUARD_SIGHT = { range: 178, half: 0.62 };
export const ALARM_HOT = 70;

// Circle vs the level's solids: push the circle out along the
// shallowest axis so actors slide along walls and cases.
export function collide(px, py, radius, solids) {
  let x = px;
  let y = py;
  for (const r of solids) {
    const nx = Math.max(r.x, Math.min(x, r.x + r.w));
    const ny = Math.max(r.y, Math.min(y, r.y + r.h));
    const dx = x - nx;
    const dy = y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 >= radius * radius) continue;
    if (d2 > 1e-9) {
      const d = Math.sqrt(d2);
      x = nx + (dx / d) * radius;
      y = ny + (dy / d) * radius;
    } else {
      // Centre inside the rect: leave through the nearest face.
      const left = x - r.x;
      const right = r.x + r.w - x;
      const top = y - r.y;
      const bottom = r.y + r.h - y;
      const m = Math.min(left, right, top, bottom);
      if (m === left) x = r.x - radius;
      else if (m === right) x = r.x + r.w + radius;
      else if (m === top) y = r.y - radius;
      else y = r.y + r.h + radius;
    }
  }
  return { x, y };
}

function moveToward(actor, tx, ty, speed, dt, solids) {
  const dx = tx - actor.x;
  const dy = ty - actor.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 2) return true;
  const step = Math.min(dist, speed * dt);
  const nx = actor.x + (dx / dist) * step;
  const ny = actor.y + (dy / dist) * step;
  const fixed = collide(nx, ny, actor.r, solids);
  actor.x = fixed.x;
  actor.y = fixed.y;
  actor.facing = Math.atan2(dy, dx);
  return dist <= step + 2;
}

export function makeThief(spawn) {
  return {
    x: spawn.x, y: spawn.y, r: 12,
    facing: -Math.PI / 2,
    speed: 172, sprintSpeed: 258,
    sprinting: false, moving: false,
  };
}

export function updateThief(thief, input, dt, solids) {
  let mx = 0;
  let my = 0;
  if (input.left) mx -= 1;
  if (input.right) mx += 1;
  if (input.up) my -= 1;
  if (input.down) my += 1;
  thief.moving = mx !== 0 || my !== 0;
  thief.sprinting = thief.moving && input.sprint;
  if (!thief.moving) return;
  const len = Math.hypot(mx, my);
  const speed = thief.sprinting ? thief.sprintSpeed : thief.speed;
  const nx = thief.x + (mx / len) * speed * dt;
  const ny = thief.y + (my / len) * speed * dt;
  const fixed = collide(nx, ny, thief.r, solids);
  thief.x = fixed.x;
  thief.y = fixed.y;
  thief.facing = Math.atan2(my, mx);
}

export function makeGuard(def, index) {
  const [x, y] = def.route[0];
  return {
    name: def.name,
    x, y, r: 13,
    facing: index % 2 ? Math.PI : 0,
    route: def.route,
    wp: 1 % def.route.length,
    speed: def.speed,
    state: 'patrol', // patrol | pause | investigate | converge
    timer: 0,
    tx: x, ty: y,
    sees: 0,
    range: GUARD_SIGHT.range,
    half: GUARD_SIGHT.half,
  };
}

function nearestWaypoint(guard) {
  let best = 0;
  let bd = Infinity;
  guard.route.forEach(([x, y], i) => {
    const d = (x - guard.x) ** 2 + (y - guard.y) ** 2;
    if (d < bd) { bd = d; best = i; }
  });
  return best;
}

export function updateGuard(guard, game, dt) {
  const { solids, thief } = game;
  guard.sees = detection(guard, thief, solids);

  // While the thief is in view the guard tracks her with his eyes:
  // the cone follows the player, which is both tenser and fairer —
  // what you see sweeping toward you is exactly what can catch you.
  if (guard.sees > 0 && guard.state !== 'converge') {
    guard.facing = Math.atan2(thief.y - guard.y, thief.x - guard.x);
  }

  if (game.alarm >= ALARM_HOT && guard.sees > 0) {
    guard.state = 'converge';
    guard.tx = thief.x;
    guard.ty = thief.y;
  } else if (guard.state === 'converge' && guard.sees === 0) {
    guard.state = 'investigate';
    guard.timer = 1.4;
  }

  switch (guard.state) {
    case 'patrol': {
      const [tx, ty] = guard.route[guard.wp];
      if (moveToward(guard, tx, ty, guard.speed, dt, solids)) {
        guard.wp = (guard.wp + 1) % guard.route.length;
        guard.state = 'pause';
        guard.timer = 0.95;
      }
      break;
    }
    case 'pause': {
      guard.timer -= dt;
      guard.facing += Math.sin(game.time * 1.7 + guard.x) * 0.35 * dt;
      if (guard.timer <= 0) guard.state = 'patrol';
      break;
    }
    case 'investigate': {
      if (moveToward(guard, guard.tx, guard.ty, guard.speed * 1.45, dt, solids)) {
        guard.timer -= dt;
        guard.facing += Math.sin(game.time * 2.3 + guard.y) * 0.8 * dt;
        if (guard.timer <= 0) {
          guard.wp = nearestWaypoint(guard);
          guard.state = 'patrol';
        }
      }
      break;
    }
    case 'converge': {
      moveToward(guard, guard.tx, guard.ty, guard.speed * 1.7, dt, solids);
      break;
    }
  }
}

// A tossed coin: guards close enough to hear it leave their routes
// and walk to the noise point.
export function distractWithCoin(guards, x, y) {
  let heard = 0;
  for (const g of guards) {
    if (Math.hypot(g.x - x, g.y - y) < 300 && g.state !== 'converge') {
      g.state = 'investigate';
      g.tx = x;
      g.ty = y;
      g.timer = 1.6;
      heard++;
    }
  }
  return heard;
}

// One alarm tick: combine every watcher's detection of the thief.
// Guards fill the meter faster up close; sprinting is louder and
// fills it faster still. Returns what the HUD and renderer need.
export function updateAlarm(game, dt) {
  const { thief, guards, cameras, solids } = game;
  let guardSeen = 0;
  for (const g of guards) guardSeen = Math.max(guardSeen, g.sees);
  let camSeen = 0;
  for (const c of cameras) {
    c.sees = detection(c, thief, solids);
    camSeen = Math.max(camSeen, c.sees);
  }
  game.seenByGuard = guardSeen;
  game.seenByCamera = camSeen;

  if (guardSeen > 0 || camSeen > 0) {
    let rate = guardSeen * 34 + camSeen * 15;
    if (thief.sprinting) rate *= 1.55;
    game.alarm = Math.min(100, game.alarm + rate * dt);
    if (guardSeen > 0) {
      game.lastSeen.x = thief.x;
      game.lastSeen.y = thief.y;
    }
  } else {
    game.alarm = Math.max(0, game.alarm - 7.5 * dt);
  }
  game.peakAlarm = Math.max(game.peakAlarm, game.alarm);
  return game.alarm >= 100;
}

export function guardNearCatch(guard, thief, solids) {
  return Math.hypot(guard.x - thief.x, guard.y - thief.y) < 24
    && lineOfSight(guard.x, guard.y, thief.x, thief.y, solids);
}
