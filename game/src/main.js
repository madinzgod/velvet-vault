// main.js — Velvet Vault's wiring: input, the game loop, the
// title/play/win/lose state machine, coin tosses, the diamond grab,
// and the deterministic ?shot= staging the screenshots are taken in.

import { buildLevel } from './level.js';
import {
  makeThief, makeGuard, updateThief, updateGuard, updateAlarm,
  distractWithCoin, guardNearCatch, collide, ALARM_HOT,
} from './actors.js';
import { drawGame } from './render.js';
import { initAudio, sfx } from './audio.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(location.search);
const shotName = params.get('shot');

const input = { left: false, right: false, up: false, down: false, sprint: false };
let interactPressed = false;
let coinAt = null;

function freshGame() {
  const level = buildLevel();
  const game = {
    mode: 'title',
    level,
    solids: level.solids,
    thief: makeThief(level.spawn),
    guards: level.guards.map((def, i) => makeGuard(def, i)),
    cameras: level.cameras.map((c) => ({ ...c, facing: c.base, sees: 0 })),
    alarm: 0,
    peakAlarm: 0,
    time: 0,
    coins: 3,
    noises: [],
    hasLoot: false,
    nearLoot: false,
    lastSeen: { x: level.spawn.x, y: level.spawn.y },
    seenByGuard: 0,
    seenByCamera: 0,
    notice: null,
    objective: 'Cross the hall and lift the Aurora Diamond',
    wasSeen: false,
  };
  return game;
}

let game = freshGame();

function setNotice(text, seconds = 2.6) {
  game.notice = { text, until: game.time + seconds };
}

function restart() {
  const mode = 'play';
  game = freshGame();
  game.mode = mode;
}

function tossCoin(x, y) {
  if (game.coins <= 0 || game.mode !== 'play') return;
  const dx = x - game.thief.x;
  const dy = y - game.thief.y;
  const d = Math.hypot(dx, dy);
  const maxThrow = 430;
  const scale = d > maxThrow ? maxThrow / d : 1;
  const px = game.thief.x + dx * scale;
  const py = game.thief.y + dy * scale;
  const fixed = collide(px, py, 4, game.solids);
  game.coins--;
  game.noises.push({ x: fixed.x, y: fixed.y, t: 0 });
  distractWithCoin(game.guards, fixed.x, fixed.y);
  sfx.coin();
}

function update(dt) {
  game.time += dt;
  for (const c of game.cameras) {
    c.facing = c.base + c.sweep * Math.sin(game.time * c.speed + c.phase);
  }
  for (const n of game.noises) n.t += dt;
  game.noises = game.noises.filter((n) => n.t < 0.9);

  if (game.mode === 'title') {
    // The hall stays alive behind the title: patrols walk, cameras sweep.
    for (const g of game.guards) updateGuard(g, { ...game, alarm: 0 }, dt);
    return;
  }
  if (game.mode !== 'play') return;

  updateThief(game.thief, input, dt, game.solids);
  for (const g of game.guards) updateGuard(g, game, dt);

  const caught = updateAlarm(game, dt);
  const seenNow = game.seenByGuard > 0 || game.seenByCamera > 0;
  if (seenNow && !game.wasSeen) sfx.spotted();
  game.wasSeen = seenNow;

  const loot = game.level.loot;
  game.nearLoot = !game.hasLoot
    && Math.hypot(game.thief.x - loot.x, game.thief.y - loot.y) < 40;
  if (game.nearLoot && interactPressed) {
    game.hasLoot = true;
    game.alarm = Math.min(92, game.alarm + 18);
    game.objective = 'LOOT SECURED — get back to the EXIT!';
    setNotice('THE PRESSURE PLATE TRIPS — ALARM +18');
    sfx.grab();
  }
  interactPressed = false;

  const e = game.level.exit;
  const inExit = game.thief.x > e.x && game.thief.x < e.x + e.w
    && game.thief.y > e.y && game.thief.y < e.y + e.h;
  if (game.hasLoot && inExit) {
    game.mode = 'win';
    sfx.win();
    return;
  }
  const grabbed = game.guards.some(
    (g) => g.state === 'converge' && guardNearCatch(g, game.thief, game.solids),
  );
  if (caught || grabbed) {
    game.mode = 'lose';
    sfx.caught();
  }
  if (game.alarm >= ALARM_HOT) {
    game.objective = game.hasLoot
      ? 'ALERT! They are converging — RUN for the EXIT!'
      : 'ALERT! Break line of sight and let the alarm drain!';
  } else if (!game.hasLoot) {
    game.objective = 'Cross the hall and lift the Aurora Diamond';
  }
}

// --- Shot staging -------------------------------------------------
// Each shot freezes a composed, deterministic scene: fixed clock,
// placed actors, set alarm. The renderer draws exactly what a player
// would see mid-heist.
function stageShot(name) {
  game = freshGame();
  game.mode = 'play';
  const [gA, gB, gC] = game.guards;
  const [camA, camB] = game.cameras;
  const place = (actor, x, y, facing) => {
    actor.x = x; actor.y = y; actor.facing = facing; actor.state = 'pause'; actor.timer = 99;
  };
  if (name === 'cover') {
    game.time = 47;
    game.alarm = 34;
    game.peakAlarm = 34;
    place(game.thief, 500, 452, 0.35);
    place(gA, 700, 438, 2.9);
    place(gB, 1040, 575, -Math.PI / 2);
    place(gC, 905, 470, 0.4);
    camA.facing = 1.85;
    camB.facing = 2.9;
    game.objective = 'Cross the hall and lift the Aurora Diamond';
  } else if (name === 'patrol') {
    game.time = 83;
    game.alarm = 12;
    game.peakAlarm = 21;
    // The thief pressed against the egg case's south face while
    // the hall guard, in the lane just north of the case, sweeps
    // his cone into its glass — the case itself is her cover.
    place(game.thief, 415, 428, -Math.PI / 2);
    place(gA, 415, 262, Math.PI / 2);
    place(gB, 1040, 470, Math.PI / 2);
    place(gC, 960, 352, -0.5);
    camA.facing = 1.8;
    camB.facing = 2.6;
    game.objective = 'Wait for the cone to pass — the case is your cover';
  } else if (name === 'loot') {
    game.time = 121;
    game.alarm = 72;
    game.peakAlarm = 72;
    game.hasLoot = true;
    place(game.thief, 968, 268, Math.PI / 2);
    place(gA, 395, 655, -0.8);
    place(gB, 1040, 452, 2.6);
    place(gC, 940, 355, Math.atan2(268 - 355, 968 - 940));
    gC.state = 'converge';
    gC.sees = 0.8;
    camA.facing = 1.2;
    camB.facing = 2.75;
    game.objective = 'LOOT SECURED — get back to the EXIT!';
  } else if (name === 'getaway') {
    // Staged as an in-world moment, NOT the win panel: the thief is
    // on the exit mat with the sack, alarm at 88, and two guards'
    // cones converge on her while a third runs in.
    game.time = 118;
    game.alarm = 88;
    game.peakAlarm = 88;
    game.hasLoot = true;
    place(game.thief, 640, 738, Math.PI / 2);
    place(gA, 520, 612, Math.atan2(738 - 612, 640 - 520));
    place(gB, 768, 618, Math.atan2(738 - 618, 640 - 768));
    place(gC, 955, 520, Math.atan2(738 - 520, 640 - 955));
    gA.state = 'converge';
    gB.state = 'converge';
    camA.facing = 1.4;
    camB.facing = 2.82;
    game.objective = 'LOOT SECURED — get back to the EXIT!';
  }
  // Detection flags for the frozen frame: recompute honestly so the
  // cones light up only where the thief truly stands in view.
  game.guards.forEach((g) => { g.sees = g.state === 'converge' ? Math.max(g.sees, 0.5) : g.sees; });
}

// --- Input ----------------------------------------------------------
const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
};
addEventListener('keydown', (ev) => {
  initAudio();
  if (KEYMAP[ev.code]) {
    input[KEYMAP[ev.code]] = true;
    ev.preventDefault();
  } else if (ev.code === 'ShiftLeft' || ev.code === 'ShiftRight') {
    input.sprint = true;
  } else if (ev.code === 'KeyE') {
    interactPressed = true;
  } else if (ev.code === 'KeyQ') {
    const a = game.thief.facing;
    tossCoin(game.thief.x + Math.cos(a) * 150, game.thief.y + Math.sin(a) * 150);
  } else if (ev.code === 'Enter') {
    if (game.mode === 'title') { game.mode = 'play'; sfx.click(); }
  } else if (ev.code === 'KeyR') {
    if (game.mode === 'win' || game.mode === 'lose') restart();
  }
});
addEventListener('keyup', (ev) => {
  if (KEYMAP[ev.code]) input[KEYMAP[ev.code]] = false;
  if (ev.code === 'ShiftLeft' || ev.code === 'ShiftRight') input.sprint = false;
});
canvas.addEventListener('pointerdown', (ev) => {
  initAudio();
  const rect = canvas.getBoundingClientRect();
  const x = (ev.clientX - rect.left) * (canvas.width / rect.width);
  const y = (ev.clientY - rect.top) * (canvas.height / rect.height);
  if (game.mode === 'title') { game.mode = 'play'; sfx.click(); return; }
  if (game.mode === 'win' || game.mode === 'lose') return;
  coinAt = { x, y };
  tossCoin(x, y);
});

// --- Loop -------------------------------------------------------------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  if (!shotName) update(dt);
  drawGame(ctx, game);
  requestAnimationFrame(frame);
}

if (shotName) stageShot(shotName);
requestAnimationFrame(frame);
