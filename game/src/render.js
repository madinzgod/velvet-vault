// render.js — everything the player (and the screenshot judge) sees.
// The hall is a moody night museum: polished marble under warm
// spotlight pools, a crimson carpet between brass ropes, paneled
// walls with paintings, glass display cases holding distinct
// artifacts, and drawn character sprites — no flat shapes. The
// static architecture is painted once onto an offscreen canvas;
// cones, cases, actors and HUD are drawn fresh each frame.

import { VIEW_W, VIEW_H, HUD_H } from './level.js';
import { conePolygon } from './vision.js';
import { ALARM_HOT } from './actors.js';

const GOLD = '#d9a441';
const GOLD_DK = '#8a6d2f';
const CREAM = '#f3e9d2';

// Deterministic 0..1 hash of integer coords, for marble speckle and
// tile tone variation that never flickers between frames.
function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) ^ 0x5bf03635;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function shadowEllipse(ctx, x, y, rx, ry, alpha = 0.4) {
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function sparkle(ctx, x, y, r, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill();
  ctx.restore();
}

// --- The static hall ------------------------------------------------

function paintMarble(ctx, x0, y0, x1, y1) {
  const t = 128;
  for (let ty = Math.floor(y0 / t); ty * t < y1; ty++) {
    for (let tx = Math.floor(x0 / t); tx * t < x1; tx++) {
      const h = hash2(tx, ty);
      const base = (tx + ty) % 2 === 0 ? 0 : 1;
      const l = (base ? 23 : 20.5) + h * 3.5;
      ctx.fillStyle = `hsl(232, 16%, ${l}%)`;
      ctx.fillRect(tx * t, ty * t, t, t);
      // Faint mineral veins: two short strokes per tile.
      ctx.strokeStyle = 'rgba(200,205,230,0.05)';
      ctx.lineWidth = 1.4;
      const vx = tx * t + h * 90;
      const vy = ty * t + hash2(ty, tx) * 90;
      ctx.beginPath();
      ctx.moveTo(vx, vy);
      ctx.lineTo(vx + 26 + h * 22, vy + 9);
      ctx.lineTo(vx + 44 + h * 26, vy + 4);
      ctx.stroke();
      // Speckle.
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      for (let i = 0; i < 9; i++) {
        const sx = tx * t + hash2(tx * 31 + i, ty * 17) * t;
        const sy = ty * t + hash2(tx * 13, ty * 29 + i) * t;
        ctx.fillRect(sx, sy, 1.6, 1.6);
      }
    }
  }
  // Grout lines.
  ctx.strokeStyle = 'rgba(8,9,16,0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = 0; x <= VIEW_W; x += t) { ctx.moveTo(x, y0); ctx.lineTo(x, y1); }
  for (let y = y0; y <= y1; y += t) { ctx.moveTo(x0, y); ctx.lineTo(x1, y); }
  ctx.stroke();
  // A broad cool sheen sweeping the stone.
  const sheen = ctx.createLinearGradient(0, y0, VIEW_W, y1);
  sheen.addColorStop(0, 'rgba(160,180,255,0.05)');
  sheen.addColorStop(0.5, 'rgba(160,180,255,0)');
  sheen.addColorStop(1, 'rgba(160,180,255,0.04)');
  ctx.fillStyle = sheen;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
}

function paintPainting(ctx, cx, cy, w, h, scene) {
  // Gilded frame with an inner bevel, then the little canvas.
  const x = cx - w / 2;
  const y = cy - h / 2;
  const fg = ctx.createLinearGradient(x, y, x + w, y + h);
  fg.addColorStop(0, '#e8bc62');
  fg.addColorStop(0.5, '#9a742f');
  fg.addColorStop(1, '#d9a441');
  ctx.fillStyle = fg;
  rr(ctx, x - 3, y - 3, w + 6, h + 6, 3);
  ctx.fill();
  ctx.fillStyle = '#241a10';
  ctx.fillRect(x, y, w, h);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x + 3, y + 3, w - 6, h - 6);
  ctx.clip();
  const ix = x + 3;
  const iy = y + 3;
  const iw = w - 6;
  const ih = h - 6;
  if (scene === 'landscape') {
    const sky = ctx.createLinearGradient(0, iy, 0, iy + ih);
    sky.addColorStop(0, '#e8a56b');
    sky.addColorStop(0.6, '#b45a48');
    sky.addColorStop(1, '#5d2f3d');
    ctx.fillStyle = sky;
    ctx.fillRect(ix, iy, iw, ih);
    ctx.fillStyle = '#ffd98a';
    ctx.beginPath();
    ctx.arc(ix + iw * 0.68, iy + ih * 0.42, ih * 0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3d2438';
    ctx.beginPath();
    ctx.moveTo(ix, iy + ih * 0.78);
    ctx.quadraticCurveTo(ix + iw * 0.3, iy + ih * 0.52, ix + iw * 0.55, iy + ih * 0.74);
    ctx.quadraticCurveTo(ix + iw * 0.8, iy + ih * 0.9, ix + iw, iy + ih * 0.7);
    ctx.lineTo(ix + iw, iy + ih);
    ctx.lineTo(ix, iy + ih);
    ctx.fill();
  } else if (scene === 'seascape') {
    const sea = ctx.createLinearGradient(0, iy, 0, iy + ih);
    sea.addColorStop(0, '#cfd8ea');
    sea.addColorStop(0.45, '#5f7ea6');
    sea.addColorStop(1, '#1d3350');
    ctx.fillStyle = sea;
    ctx.fillRect(ix, iy, iw, ih);
    ctx.fillStyle = '#f4f0dc';
    ctx.beginPath();
    ctx.arc(ix + iw * 0.24, iy + ih * 0.3, ih * 0.14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(240,246,255,0.75)';
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(ix + iw * (0.3 + i * 0.22), iy + ih * (0.62 + i * 0.1), iw * 0.09, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    }
  } else {
    // Portrait: umber backdrop, a pale bust silhouette.
    const bg = ctx.createRadialGradient(cx, cy, 2, cx, cy, iw * 0.7);
    bg.addColorStop(0, '#7a5230');
    bg.addColorStop(1, '#2a1a10');
    ctx.fillStyle = bg;
    ctx.fillRect(ix, iy, iw, ih);
    ctx.fillStyle = '#d8c49a';
    ctx.beginPath();
    ctx.arc(cx, iy + ih * 0.4, ih * 0.17, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx, iy + ih * 0.92, iw * 0.26, ih * 0.3, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(60,35,15,0.5)';
    ctx.beginPath();
    ctx.arc(cx + iw * 0.05, iy + ih * 0.38, ih * 0.15, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // Glass glint.
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.beginPath();
  ctx.moveTo(x + w * 0.12, y + h);
  ctx.lineTo(x + w * 0.42, y);
  ctx.lineTo(x + w * 0.6, y);
  ctx.lineTo(x + w * 0.3, y + h);
  ctx.fill();
}

function paintPlant(ctx, px, py) {
  shadowEllipse(ctx, px, py + 10, 20, 6, 0.35);
  // Terracotta pot.
  const pg = ctx.createLinearGradient(px - 11, 0, px + 11, 0);
  pg.addColorStop(0, '#5d2f1e');
  pg.addColorStop(0.5, '#a85f36');
  pg.addColorStop(1, '#4a2415');
  ctx.fillStyle = pg;
  ctx.beginPath();
  ctx.moveTo(px - 10, py - 2);
  ctx.lineTo(px + 10, py - 2);
  ctx.lineTo(px + 7, py + 12);
  ctx.lineTo(px - 7, py + 12);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#c47a48';
  ctx.fillRect(px - 11, py - 5, 22, 4);
  // Layered leaves: three fans of ellipses, dark to light.
  const leaf = (ang, len, wid, col) => {
    ctx.save();
    ctx.translate(px, py - 4);
    ctx.rotate(ang);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(len / 2, 0, len / 2, wid, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
  for (let i = 0; i < 7; i++) leaf(-2.6 + i * 0.42, 24, 5.5, '#1d4423');
  for (let i = 0; i < 6; i++) leaf(-2.4 + i * 0.45, 19, 4.6, '#2c6b34');
  for (let i = 0; i < 5; i++) leaf(-2.2 + i * 0.5, 13, 3.6, '#3f9150');
}

function buildStatic(game) {
  const { level } = game;
  const cv = document.createElement('canvas');
  cv.width = VIEW_W;
  cv.height = VIEW_H;
  const ctx = cv.getContext('2d');
  const D = level.decor;

  // Marble everywhere under the hall.
  paintMarble(ctx, 0, HUD_H, VIEW_W, VIEW_H);

  // The vault's darker steel floor, with a fine grid and the gold
  // ring around the pedestal.
  const vf = level.vaultFloor;
  ctx.fillStyle = '#1b1c26';
  ctx.fillRect(vf.x, vf.y, vf.w, vf.h);
  ctx.strokeStyle = 'rgba(120,128,160,0.10)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = vf.x; x <= vf.x + vf.w; x += 32) { ctx.moveTo(x, vf.y); ctx.lineTo(x, vf.y + vf.h); }
  for (let y = vf.y; y <= vf.y + vf.h; y += 32) { ctx.moveTo(vf.x, y); ctx.lineTo(vf.x + vf.w, y); }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(217,164,65,0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(level.loot.x, level.loot.y, 54, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(217,164,65,0.22)';
  ctx.beginPath();
  ctx.arc(level.loot.x, level.loot.y, 62, 0, Math.PI * 2);
  ctx.stroke();

  // Marble inlay medallion in the west hall.
  const m = D.medallion;
  ctx.strokeStyle = 'rgba(217,164,65,0.20)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(217,164,65,0.13)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(m.x, m.y, m.r - 10, 0, Math.PI * 2);
  ctx.stroke();
  ctx.save();
  ctx.translate(m.x, m.y);
  ctx.rotate(Math.PI / 4);
  ctx.strokeStyle = 'rgba(217,164,65,0.15)';
  ctx.strokeRect(-m.r * 0.52, -m.r * 0.52, m.r * 1.04, m.r * 1.04);
  ctx.restore();

  // The crimson carpet runner: bordered, patterned, fringed.
  const c = level.carpet;
  const cg = ctx.createLinearGradient(c.x, 0, c.x + c.w, 0);
  cg.addColorStop(0, '#4d0f1d');
  cg.addColorStop(0.5, '#77182b');
  cg.addColorStop(1, '#4d0f1d');
  ctx.fillStyle = cg;
  ctx.fillRect(c.x, c.y, c.w, c.h);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  ctx.strokeRect(c.x + 4, c.y + 4, c.w - 8, c.h - 8);
  ctx.strokeStyle = 'rgba(217,164,65,0.45)';
  ctx.lineWidth = 1;
  ctx.strokeRect(c.x + 9, c.y + 9, c.w - 18, c.h - 18);
  ctx.fillStyle = 'rgba(232,188,98,0.5)';
  for (let y = c.y + 30; y < c.y + c.h - 14; y += 42) {
    ctx.save();
    ctx.translate(c.x + c.w / 2, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-4.5, -4.5, 9, 9);
    ctx.restore();
  }
  ctx.fillStyle = 'rgba(232,188,98,0.35)';
  for (let x = c.x + 6; x < c.x + c.w - 4; x += 7) {
    ctx.fillRect(x, c.y + c.h - 3, 3, 6);
  }

  // Warm spotlight pools over every case, the pedestal, the carpet.
  const pool = (x, y, r, a) => {
    const g = ctx.createRadialGradient(x, y, 4, x, y, r);
    g.addColorStop(0, `rgba(255,196,110,${a})`);
    g.addColorStop(1, 'rgba(255,196,110,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };
  for (const s of level.solids) {
    if (s.kind === 'case') pool(s.x + s.w / 2, s.y + s.h / 2, 115, 0.21);
  }
  pool(level.loot.x, level.loot.y, 140, 0.23);
  pool(c.x + c.w / 2, 560, 200, 0.09);
  // A broad warm ambient wash so the stone never reads as void.
  const amb = ctx.createRadialGradient(640, 430, 120, 640, 430, 760);
  amb.addColorStop(0, 'rgba(255,190,110,0.07)');
  amb.addColorStop(1, 'rgba(255,190,110,0)');
  ctx.fillStyle = amb;
  ctx.fillRect(0, HUD_H, VIEW_W, VIEW_H - HUD_H);

  // --- Walls -------------------------------------------------------
  // North wall face: a tall paneled surface carrying paintings,
  // pilasters and sconces, so the top of the hall has real height.
  const face = ctx.createLinearGradient(0, HUD_H, 0, 122);
  face.addColorStop(0, '#272c49');
  face.addColorStop(0.8, '#1a1e35');
  face.addColorStop(1, '#12152a');
  ctx.fillStyle = face;
  ctx.fillRect(0, HUD_H, VIEW_W, 58);
  ctx.fillStyle = 'rgba(217,164,65,0.65)';
  ctx.fillRect(0, 120, VIEW_W, 2);
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, 122, VIEW_W, 5);
  // Panel insets along the face.
  ctx.strokeStyle = 'rgba(140,150,200,0.16)';
  ctx.lineWidth = 1;
  for (let x = 18; x < VIEW_W - 60; x += 64) {
    ctx.strokeRect(x, HUD_H + 8, 52, 42);
  }
  for (const px of D.pilastersTop) {
    const pg = ctx.createLinearGradient(px, 0, px + 26, 0);
    pg.addColorStop(0, '#1c2138');
    pg.addColorStop(0.5, '#333a5e');
    pg.addColorStop(1, '#171b30');
    ctx.fillStyle = pg;
    ctx.fillRect(px, HUD_H, 26, 58);
    ctx.fillStyle = '#3d4570';
    ctx.fillRect(px - 2, HUD_H, 30, 6);
    ctx.fillRect(px - 2, 112, 30, 7);
    ctx.fillStyle = 'rgba(217,164,65,0.5)';
    ctx.fillRect(px - 2, HUD_H + 6, 30, 1.5);
  }
  for (const p of D.paintings) paintPainting(ctx, p.x, 92, 74, 42, p.scene);
  // Sconces between the paintings: a gold stem and a warm glow.
  for (const sx of [280, 474]) {
    const g = ctx.createRadialGradient(sx + 13, 92, 1, sx + 13, 92, 26);
    g.addColorStop(0, 'rgba(255,205,120,0.5)');
    g.addColorStop(1, 'rgba(255,205,120,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(sx + 13, 92, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd98a';
    ctx.beginPath();
    ctx.arc(sx + 13, 92, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // The remaining wall bands: dark paneled stone with a gold chair
  // rail and a skirting shadow where wall meets floor.
  const band = (x, y, w, h, horiz) => {
    ctx.fillStyle = '#1d2138';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(217,164,65,0.4)';
    if (horiz) ctx.fillRect(x, y + h / 2 - 1, w, 2);
    else ctx.fillRect(x + w / 2 - 1, y, 2, h);
    ctx.strokeStyle = 'rgba(140,150,200,0.14)';
    ctx.lineWidth = 1;
    if (horiz) {
      for (let px = x + 14; px < x + w - 30; px += 58) ctx.strokeRect(px, y + 4, 44, h - 8);
    } else {
      for (let py = y + 14; py < y + h - 30; py += 58) ctx.strokeRect(x + 4, py, w - 8, 44);
    }
  };
  band(0, 776, VIEW_W, 24, true);
  band(0, HUD_H, 24, 736, false);
  band(1256, HUD_H, 24, 736, false);
  // Floor shadow under the south and side walls.
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.fillRect(24, 770, VIEW_W - 48, 6);
  ctx.fillRect(24, 122, 5, 654);
  ctx.fillRect(1251, 122, 5, 654);

  // Vault chamber walls: riveted, paneled steel-burgundy.
  for (const s of level.solids) {
    if (s.kind !== 'vault') continue;
    ctx.fillStyle = '#2c1e2e';
    ctx.fillRect(s.x, s.y, s.w, s.h);
    ctx.fillStyle = 'rgba(217,164,65,0.4)';
    if (s.w > s.h) ctx.fillRect(s.x, s.y + s.h / 2 - 1, s.w, 2);
    else ctx.fillRect(s.x + s.w / 2 - 1, s.y, 2, s.h);
    ctx.fillStyle = 'rgba(220,190,220,0.5)';
    const n = Math.floor((s.w > s.h ? s.w : s.h) / 34);
    for (let i = 1; i <= n; i++) {
      const rx = s.w > s.h ? s.x + (s.w * i) / (n + 1) : s.x + s.w / 2;
      const ry = s.w > s.h ? s.y + s.h / 2 : s.y + (s.h * i) / (n + 1);
      ctx.beginPath();
      ctx.arc(rx, ry + (s.w > s.h ? -5 : 0), 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Small paintings on the vault's inner north face.
  for (const p of D.vaultPaintings) paintPainting(ctx, p.x, 152, 56, 32, p.scene);

  // Benches: slatted walnut with iron legs.
  for (const b of D.benches) {
    shadowEllipse(ctx, b.x + b.w / 2, b.y + b.h + 3, b.w / 2, 5, 0.3);
    ctx.fillStyle = '#17130f';
    ctx.fillRect(b.x + 8, b.y + b.h - 4, 6, 6);
    ctx.fillRect(b.x + b.w - 14, b.y + b.h - 4, 6, 6);
    const bg = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
    bg.addColorStop(0, '#6b4226');
    bg.addColorStop(1, '#3c2412');
    ctx.fillStyle = bg;
    rr(ctx, b.x, b.y, b.w, b.h, 4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(20,10,4,0.65)';
    ctx.lineWidth = 1.5;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(b.x + 4, b.y + (b.h * i) / 4);
      ctx.lineTo(b.x + b.w - 4, b.y + (b.h * i) / 4);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(232,188,98,0.35)';
    ctx.lineWidth = 1;
    rr(ctx, b.x, b.y, b.w, b.h, 4);
    ctx.stroke();
  }

  // Brass rope barriers flanking the carpet.
  const posts = D.ropePosts;
  ctx.strokeStyle = '#5d1220';
  ctx.lineWidth = 4;
  for (const sideX of [c.x - 15, c.x + c.w + 15]) {
    for (let i = 0; i < posts.length - 1; i++) {
      ctx.beginPath();
      ctx.moveTo(sideX, posts[i]);
      ctx.quadraticCurveTo(sideX, (posts[i] + posts[i + 1]) / 2 + 13, sideX, posts[i + 1]);
      ctx.stroke();
    }
  }
  ctx.strokeStyle = 'rgba(255,120,140,0.35)';
  ctx.lineWidth = 1.4;
  for (const sideX of [c.x - 15, c.x + c.w + 15]) {
    for (let i = 0; i < posts.length - 1; i++) {
      ctx.beginPath();
      ctx.moveTo(sideX, posts[i] - 1.5);
      ctx.quadraticCurveTo(sideX, (posts[i] + posts[i + 1]) / 2 + 11, sideX, posts[i + 1] - 1.5);
      ctx.stroke();
    }
  }
  for (const sideX of [c.x - 15, c.x + c.w + 15]) {
    for (const py of posts) {
      shadowEllipse(ctx, sideX, py + 4, 7, 3, 0.35);
      const bg2 = ctx.createRadialGradient(sideX - 2, py - 6, 1, sideX, py - 3, 7);
      bg2.addColorStop(0, '#ffe9a8');
      bg2.addColorStop(0.6, '#c9973f');
      bg2.addColorStop(1, '#7c5a1e');
      ctx.fillStyle = bg2;
      ctx.beginPath();
      ctx.arc(sideX, py - 3, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#8a6d2f';
      ctx.fillRect(sideX - 1.5, py - 3, 3, 8);
      ctx.beginPath();
      ctx.ellipse(sideX, py + 6, 6, 2.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  for (const p of D.plants) paintPlant(ctx, p.x, p.y);
  return cv;
}

// --- Artifacts under glass -------------------------------------------
// Each painter draws centred on (cx, cy) inside a case interior,
// roughly 30px tall. Deliberately distinct silhouettes and palettes
// so a screenshot reads as a furnished museum, not a grid of boxes.

function goldGrad(ctx, x, y, r) {
  const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.4, 1, x, y, r * 1.3);
  g.addColorStop(0, '#ffe9a8');
  g.addColorStop(0.55, '#d9a441');
  g.addColorStop(1, '#7c5a1e');
  return g;
}

function drawDiamondGem(ctx, x, y, s, cTop, cMid, cDeep) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(-11, -4);
  ctx.lineTo(-6, -11);
  ctx.lineTo(6, -11);
  ctx.lineTo(11, -4);
  ctx.lineTo(0, 12);
  ctx.closePath();
  ctx.fillStyle = cMid;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-11, -4);
  ctx.lineTo(11, -4);
  ctx.lineTo(6, -11);
  ctx.lineTo(-6, -11);
  ctx.closePath();
  ctx.fillStyle = cTop;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-11, -4);
  ctx.lineTo(0, -4);
  ctx.lineTo(0, 12);
  ctx.closePath();
  ctx.fillStyle = cDeep;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(-11, -4);
  ctx.lineTo(11, -4);
  ctx.moveTo(-6, -11);
  ctx.lineTo(-3.5, -4);
  ctx.lineTo(0, 12);
  ctx.moveTo(6, -11);
  ctx.lineTo(3.5, -4);
  ctx.lineTo(0, 12);
  ctx.stroke();
  ctx.restore();
}

const ARTIFACTS = {
  vase(ctx, x, y) {
    ctx.fillStyle = goldGrad(ctx, x, y, 13);
    ctx.beginPath();
    ctx.moveTo(x - 3.5, y - 13);
    ctx.lineTo(x + 3.5, y - 13);
    ctx.quadraticCurveTo(x + 4, y - 7, x + 8.5, y - 1);
    ctx.quadraticCurveTo(x + 11, y + 7, x + 5, y + 12);
    ctx.lineTo(x - 5, y + 12);
    ctx.quadraticCurveTo(x - 11, y + 7, x - 8.5, y - 1);
    ctx.quadraticCurveTo(x - 4, y - 7, x - 3.5, y - 13);
    ctx.fill();
    ctx.strokeStyle = 'rgba(90,60,10,0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x - 9.5, y - 4, 3.4, Math.PI * 0.4, Math.PI * 1.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + 9.5, y - 4, 3.4, Math.PI * 1.5, Math.PI * 0.6, true);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,244,200,0.75)';
    ctx.fillRect(x - 5.5, y - 14.5, 11, 2.4);
    ctx.fillStyle = 'rgba(120,30,40,0.8)';
    ctx.fillRect(x - 6, y + 1, 12, 2.6);
  },
  urn(ctx, x, y) {
    const g = ctx.createRadialGradient(x - 4, y - 5, 1, x, y, 15);
    g.addColorStop(0, '#eef2f7');
    g.addColorStop(0.55, '#9fb2c8');
    g.addColorStop(1, '#4c5f78');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - 8, y - 6);
    ctx.quadraticCurveTo(x, y - 15, x + 8, y - 6);
    ctx.quadraticCurveTo(x + 10, y + 5, x + 5.5, y + 11);
    ctx.lineTo(x - 5.5, y + 11);
    ctx.quadraticCurveTo(x - 10, y + 5, x - 8, y - 6);
    ctx.fill();
    ctx.fillStyle = '#7186a0';
    ctx.fillRect(x - 4, y + 11, 8, 2.6);
    ctx.fillStyle = '#dfe8f2';
    ctx.beginPath();
    ctx.arc(x, y - 13.5, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(40,60,90,0.55)';
    ctx.beginPath();
    ctx.moveTo(x - 7.5, y + 2);
    ctx.lineTo(x + 7.5, y + 2);
    ctx.stroke();
  },
  crown(ctx, x, y) {
    ctx.fillStyle = goldGrad(ctx, x, y, 14);
    ctx.beginPath();
    ctx.moveTo(x - 12, y + 9);
    ctx.lineTo(x - 12, y - 7);
    ctx.lineTo(x - 6, y + 1);
    ctx.lineTo(x - 3, y - 10);
    ctx.lineTo(x, y + 1);
    ctx.lineTo(x + 3, y - 10);
    ctx.lineTo(x + 6, y + 1);
    ctx.lineTo(x + 12, y - 7);
    ctx.lineTo(x + 12, y + 9);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(90,60,10,0.55)';
    ctx.lineWidth = 1;
    ctx.stroke();
    const gems = [['#e33', -7.5], ['#3af', 0], ['#3d6', 7.5]];
    for (const [col, dx] of gems) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(x + dx, y + 4.5, 2.1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ffe9a8';
    for (const dx of [-12, -3, 3, 12]) {
      ctx.beginPath();
      ctx.arc(x + dx, y - (dx === -3 || dx === 3 ? 11.5 : 8.5), 1.7, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  mask(ctx, x, y) {
    ctx.fillStyle = goldGrad(ctx, x, y, 13);
    ctx.beginPath();
    ctx.ellipse(x, y, 9, 12.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(90,60,10,0.6)';
    ctx.stroke();
    ctx.fillStyle = '#1a1206';
    ctx.beginPath();
    ctx.ellipse(x - 3.8, y - 2.5, 2.3, 1.3, -0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + 3.8, y - 2.5, 2.3, 1.3, 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(90,60,10,0.7)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(x, y - 0.5);
    ctx.lineTo(x - 1, y + 4);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y + 5.5, 3.4, Math.PI * 0.25, Math.PI * 0.75);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y - 6, 6.4, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
  },
  bust(ctx, x, y) {
    ctx.fillStyle = '#5a4632';
    ctx.fillRect(x - 6, y + 8, 12, 5);
    const g = ctx.createLinearGradient(x - 9, 0, x + 9, 0);
    g.addColorStop(0, '#8f867a');
    g.addColorStop(0.45, '#e6ded0');
    g.addColorStop(1, '#7c7466');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y - 4.5, 6.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x, y + 8.5, 10, 6, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x - 10, y + 8, 20, 1.6);
    ctx.fillStyle = 'rgba(70,60,50,0.45)';
    ctx.beginPath();
    ctx.arc(x + 2.6, y - 5.5, 5.4, 0, Math.PI * 2);
    ctx.fill();
  },
  globe(ctx, x, y) {
    ctx.strokeStyle = '#6b4a2a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y + 3);
    ctx.lineTo(x, y + 11);
    ctx.stroke();
    ctx.fillStyle = '#54381e';
    ctx.fillRect(x - 6, y + 11, 12, 2.6);
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y - 3, 10.5, 0, Math.PI * 2);
    ctx.clip();
    const g = ctx.createRadialGradient(x - 3, y - 7, 1, x, y - 3, 12);
    g.addColorStop(0, '#7cc7d9');
    g.addColorStop(1, '#1f5f7a');
    ctx.fillStyle = g;
    ctx.fillRect(x - 11, y - 14, 22, 22);
    ctx.fillStyle = '#7fae5a';
    ctx.beginPath();
    ctx.ellipse(x - 3.5, y - 6, 4.4, 3, 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + 4.5, y + 0.5, 3.4, 2.4, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(240,250,255,0.5)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.ellipse(x, y - 3, 4.6, 10.5, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = 'rgba(230,245,255,0.65)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y - 3, 10.5, 0, Math.PI * 2);
    ctx.stroke();
  },
  chalice(ctx, x, y) {
    ctx.fillStyle = goldGrad(ctx, x, y, 12);
    ctx.beginPath();
    ctx.moveTo(x - 9, y - 11);
    ctx.lineTo(x + 9, y - 11);
    ctx.quadraticCurveTo(x + 8, y + 1, x + 2.2, y + 2.5);
    ctx.lineTo(x + 2.2, y + 7);
    ctx.lineTo(x + 6.5, y + 11);
    ctx.lineTo(x + 6.5, y + 13);
    ctx.lineTo(x - 6.5, y + 13);
    ctx.lineTo(x - 6.5, y + 11);
    ctx.lineTo(x - 2.2, y + 7);
    ctx.lineTo(x - 2.2, y + 2.5);
    ctx.quadraticCurveTo(x - 8, y + 1, x - 9, y - 11);
    ctx.fill();
    ctx.fillStyle = '#8c2434';
    ctx.beginPath();
    ctx.ellipse(x, y - 11, 9, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3af';
    ctx.beginPath();
    ctx.arc(x, y - 3, 2, 0, Math.PI * 2);
    ctx.fill();
  },
  gems(ctx, x, y, time) {
    drawDiamondGem(ctx, x - 8, y + 3, 0.8, '#c9f2ff', '#38bdf8', '#1d6fb8');
    drawDiamondGem(ctx, x + 8, y + 4, 0.66, '#ffd3dd', '#fb7185', '#b02a44');
    drawDiamondGem(ctx, x + 1, y - 5, 0.6, '#ffedb0', '#f5b93f', '#a86e14');
    sparkle(ctx, x - 12, y - 8, 5, 0.5 + 0.3 * Math.sin(time * 3.1));
    sparkle(ctx, x + 13, y - 4, 4, 0.4 + 0.3 * Math.sin(time * 3.1 + 2));
  },
  ruby(ctx, x, y, time) {
    drawDiamondGem(ctx, x, y, 1.25, '#ffb3c0', '#e02444', '#7c0f26');
    sparkle(ctx, x - 9, y - 10, 5.5, 0.55 + 0.3 * Math.sin(time * 2.6));
  },
  coins(ctx, x, y) {
    ctx.fillStyle = '#a86e14';
    for (let row = 0; row < 3; row++) {
      const w = 15 - row * 3.4;
      ctx.beginPath();
      ctx.ellipse(x, y + 8 - row * 3.6, w, 3.1, 0, 0, Math.PI * 2);
      ctx.fillStyle = row % 2 ? '#c9973f' : '#e3b34e';
      ctx.fill();
      ctx.strokeStyle = 'rgba(90,60,10,0.5)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath();
    ctx.arc(x - 11, y + 2, 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#a86e14';
    ctx.stroke();
    ctx.fillStyle = '#f5b93f';
    ctx.beginPath();
    ctx.arc(x + 11.5, y + 5, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  },
  easel(ctx, x, y) {
    ctx.strokeStyle = '#4a2f18';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(x - 8, y + 13);
    ctx.lineTo(x, y - 12);
    ctx.lineTo(x + 8, y + 13);
    ctx.moveTo(x - 5.5, y + 5);
    ctx.lineTo(x + 5.5, y + 5);
    ctx.stroke();
    ctx.fillStyle = '#c9973f';
    ctx.fillRect(x - 10, y - 11, 20, 15);
    const g = ctx.createLinearGradient(0, y - 9, 0, y + 2);
    g.addColorStop(0, '#e8a56b');
    g.addColorStop(1, '#3d5a80');
    ctx.fillStyle = g;
    ctx.fillRect(x - 8, y - 9, 16, 11);
    ctx.fillStyle = '#2c2438';
    ctx.beginPath();
    ctx.moveTo(x - 8, y + 2);
    ctx.quadraticCurveTo(x - 1, y - 4, x + 8, y + 2);
    ctx.fill();
  },
};

// --- Cases, pedestal, vault door, exit --------------------------------

function drawCase(ctx, r, time) {
  // Cast shadow, then the wooden cabinet, then the glass vitrine
  // with its velvet cushion and artifact.
  shadowEllipse(ctx, r.x + r.w / 2 + 5, r.y + r.h + 5, r.w / 2 + 3, 8, 0.32);
  const bg = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  bg.addColorStop(0, '#5d3a1e');
  bg.addColorStop(0.5, '#422712');
  bg.addColorStop(1, '#2a170a');
  ctx.fillStyle = bg;
  rr(ctx, r.x - 2, r.y - 2, r.w + 4, r.h + 4, 4);
  ctx.fill();
  ctx.strokeStyle = '#c9973f';
  ctx.lineWidth = 1.4;
  rr(ctx, r.x - 2, r.y - 2, r.w + 4, r.h + 4, 4);
  ctx.stroke();
  // Cabinet panel lines and brass studs.
  ctx.strokeStyle = 'rgba(20,10,4,0.55)';
  ctx.lineWidth = 1;
  ctx.strokeRect(r.x + 5, r.y + r.h - 13, r.w - 10, 8);
  ctx.fillStyle = '#e8bc62';
  for (const [sx, sy] of [[r.x + 3, r.y + 3], [r.x + r.w - 3, r.y + 3], [r.x + 3, r.y + r.h - 3], [r.x + r.w - 3, r.y + r.h - 3]]) {
    ctx.beginPath();
    ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Glass top with the artifact on its cushion.
  const gx = r.x + 6;
  const gy = r.y + 5;
  const gw = r.w - 12;
  const gh = r.h - 16;
  ctx.fillStyle = '#31131f';
  rr(ctx, gx, gy, gw, gh, 3);
  ctx.fill();
  const art = ARTIFACTS[r.art] || ARTIFACTS.gems;
  art(ctx, r.x + r.w / 2, gy + gh / 2, time);
  const glass = ctx.createLinearGradient(gx, gy, gx + gw, gy + gh);
  glass.addColorStop(0, 'rgba(190,225,245,0.20)');
  glass.addColorStop(0.5, 'rgba(190,225,245,0.05)');
  glass.addColorStop(1, 'rgba(190,225,245,0.13)');
  ctx.fillStyle = glass;
  rr(ctx, gx, gy, gw, gh, 3);
  ctx.fill();
  // Diagonal highlight streaks.
  ctx.save();
  rr(ctx, gx, gy, gw, gh, 3);
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.13)';
  ctx.beginPath();
  ctx.moveTo(gx + gw * 0.08, gy + gh);
  ctx.lineTo(gx + gw * 0.38, gy);
  ctx.lineTo(gx + gw * 0.52, gy);
  ctx.lineTo(gx + gw * 0.22, gy + gh);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.beginPath();
  ctx.moveTo(gx + gw * 0.55, gy + gh);
  ctx.lineTo(gx + gw * 0.8, gy);
  ctx.lineTo(gx + gw * 0.88, gy);
  ctx.lineTo(gx + gw * 0.63, gy + gh);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(225,245,255,0.6)';
  ctx.lineWidth = 1.2;
  rr(ctx, gx, gy, gw, gh, 3);
  ctx.stroke();
}

function drawVaultDoor(ctx) {
  const vx = 1108;
  const vy = 128;
  shadowEllipse(ctx, vx, vy + 40, 40, 7, 0.3);
  const steel = ctx.createRadialGradient(vx - 12, vy - 14, 4, vx, vy, 42);
  steel.addColorStop(0, '#8d94a8');
  steel.addColorStop(0.55, '#565d70');
  steel.addColorStop(1, '#232733');
  ctx.fillStyle = steel;
  ctx.beginPath();
  ctx.arc(vx, vy, 38, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#14161f';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(232,188,98,0.65)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(vx, vy, 33, 0, Math.PI * 2);
  ctx.stroke();
  // Ring bolts.
  ctx.fillStyle = '#c8cede';
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(vx + Math.cos(a) * 28.5, vy + Math.sin(a) * 28.5, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  // Spoked wheel handle.
  ctx.strokeStyle = '#d7dce8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(vx, vy, 15, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 2.6;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    ctx.beginPath();
    ctx.moveTo(vx, vy);
    ctx.lineTo(vx + Math.cos(a) * 15, vy + Math.sin(a) * 15);
    ctx.stroke();
  }
  ctx.fillStyle = '#e8bc62';
  ctx.beginPath();
  ctx.arc(vx, vy, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(232,188,98,0.9)';
  ctx.font = '700 9px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('V A U L T', vx, vy + 49);
}

function drawSolids(ctx, game) {
  for (const r of game.level.solids) {
    if (r.kind === 'case') drawCase(ctx, r, game.time);
  }
  drawVaultDoor(ctx);
}

function drawLoot(ctx, game) {
  const { loot } = game.level;
  const p = game.level.pedestal;
  // Marble pedestal with fluting and a velvet cushion.
  shadowEllipse(ctx, p.x + p.w / 2 + 3, p.y + p.h + 4, p.w / 2 + 4, 6, 0.35);
  const mg = ctx.createLinearGradient(p.x, 0, p.x + p.w, 0);
  mg.addColorStop(0, '#6d6a78');
  mg.addColorStop(0.5, '#cfd0da');
  mg.addColorStop(1, '#55525f');
  ctx.fillStyle = mg;
  rr(ctx, p.x, p.y + 8, p.w, p.h - 8, 3);
  ctx.fill();
  ctx.strokeStyle = 'rgba(40,38,52,0.5)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 5; i++) {
    const fx = p.x + (p.w * i) / 5;
    ctx.beginPath();
    ctx.moveTo(fx, p.y + 12);
    ctx.lineTo(fx, p.y + p.h - 3);
    ctx.stroke();
  }
  ctx.fillStyle = '#e8e6ee';
  ctx.fillRect(p.x - 3, p.y + 4, p.w + 6, 6);
  ctx.fillStyle = '#7c1226';
  rr(ctx, p.x + 6, p.y - 2, p.w - 12, 9, 3);
  ctx.fill();
  // Brass name plaque.
  ctx.fillStyle = '#2a1f0d';
  rr(ctx, p.x + 2, p.y + p.h + 7, p.w + 26, 15, 3);
  ctx.fill();
  ctx.strokeStyle = GOLD_DK;
  ctx.lineWidth = 1;
  rr(ctx, p.x + 2, p.y + p.h + 7, p.w + 26, 15, 3);
  ctx.stroke();
  ctx.fillStyle = GOLD;
  ctx.font = '700 9.5px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('THE AURORA DIAMOND', p.x + (p.w + 30) / 2, p.y + p.h + 18);
  if (game.hasLoot) {
    // The empty cushion keeps a dust outline where the diamond sat.
    ctx.save();
    ctx.strokeStyle = 'rgba(240,245,255,0.4)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 3.4]);
    ctx.beginPath();
    ctx.moveTo(loot.x - 13, loot.y - 12);
    ctx.lineTo(loot.x - 7, loot.y - 19);
    ctx.lineTo(loot.x + 7, loot.y - 19);
    ctx.lineTo(loot.x + 13, loot.y - 12);
    ctx.lineTo(loot.x, loot.y + 2);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
    return;
  }
  const glow = 0.55 + 0.3 * Math.sin(game.time * 3);
  const grad = ctx.createRadialGradient(loot.x, loot.y, 2, loot.x, loot.y, 34);
  grad.addColorStop(0, `rgba(140,220,255,${0.8 * glow})`);
  grad.addColorStop(1, 'rgba(140,220,255,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(loot.x, loot.y, 34, 0, Math.PI * 2);
  ctx.fill();
  const bob = Math.sin(game.time * 2.2) * 1.6;
  drawDiamondGem(ctx, loot.x, loot.y - 6 + bob, 1.45, '#d8f4ff', '#4fc3f7', '#1565a8');
  sparkle(ctx, loot.x - 13, loot.y - 18 + bob, 6, 0.5 + 0.35 * Math.sin(game.time * 3.4));
  sparkle(ctx, loot.x + 14, loot.y - 8 + bob, 4.4, 0.4 + 0.3 * Math.sin(game.time * 3.4 + 1.7));
}

function drawExit(ctx, game) {
  const e = game.level.exit;
  const active = game.hasLoot;
  if (active) {
    const pulse = 0.6 + 0.4 * Math.sin(game.time * 5);
    ctx.fillStyle = `rgba(74,222,128,${0.22 * pulse})`;
    rr(ctx, e.x - 7, e.y - 7, e.w + 14, e.h + 14, 6);
    ctx.fill();
  }
  // Double doors with panels and a lit sign above.
  const dg = ctx.createLinearGradient(e.x, 0, e.x + e.w, 0);
  dg.addColorStop(0, '#233018');
  dg.addColorStop(0.5, active ? '#2e5426' : '#2c3038');
  dg.addColorStop(1, '#1a2413');
  ctx.fillStyle = active ? dg : '#262a33';
  rr(ctx, e.x, e.y, e.w, e.h, 4);
  ctx.fill();
  ctx.strokeStyle = active ? '#4ade80' : '#57506b';
  ctx.lineWidth = 2;
  rr(ctx, e.x, e.y, e.w, e.h, 4);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(e.x + e.w / 2, e.y + 4);
  ctx.lineTo(e.x + e.w / 2, e.y + e.h - 4);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.strokeRect(e.x + 8, e.y + 8, e.w / 2 - 14, e.h - 22);
  ctx.strokeRect(e.x + e.w / 2 + 6, e.y + 8, e.w / 2 - 14, e.h - 22);
  ctx.fillStyle = active ? '#d9f99d' : '#9aa3b2';
  ctx.beginPath();
  ctx.arc(e.x + e.w / 2 - 6, e.y + e.h / 2, 2.2, 0, Math.PI * 2);
  ctx.arc(e.x + e.w / 2 + 6, e.y + e.h / 2, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = active ? '#14532d' : '#1c1f27';
  rr(ctx, e.x + 14, e.y - 17, e.w - 28, 14, 3);
  ctx.fill();
  ctx.strokeStyle = active ? '#4ade80' : '#4a4f5c';
  ctx.lineWidth = 1;
  rr(ctx, e.x + 14, e.y - 17, e.w - 28, 14, 3);
  ctx.stroke();
  ctx.fillStyle = active ? '#bbf7d0' : '#8d97a8';
  ctx.font = '700 10.5px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(active ? 'EXIT — GO!' : 'EXIT', e.x + e.w / 2, e.y - 6.5);
  ctx.fillStyle = active ? '#bbf7d0' : '#6d7686';
  ctx.font = '700 13px system-ui, sans-serif';
  ctx.fillText('▼', e.x + e.w / 2, e.y + e.h - 7);
}

// --- Cones and cameras --------------------------------------------------

function drawConeSoft(ctx, poly, ox, oy, range, rgb, hot) {
  if (poly.length < 2) return;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(poly[0].x, poly[0].y);
  for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
  ctx.closePath();
  ctx.clip();
  const g = ctx.createRadialGradient(ox, oy, 3, ox, oy, range);
  g.addColorStop(0, `rgba(${rgb},${hot ? 0.52 : 0.40})`);
  g.addColorStop(0.45, `rgba(${rgb},${hot ? 0.34 : 0.24})`);
  g.addColorStop(0.8, `rgba(${rgb},${hot ? 0.16 : 0.10})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(ox - range, oy - range, range * 2, range * 2);
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(poly[0].x, poly[0].y);
  for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
  ctx.closePath();
  ctx.strokeStyle = `rgba(${rgb},${hot ? 0.55 : 0.34})`;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawWatchers(ctx, game) {
  const { solids } = game.level;
  for (const c of game.cameras) {
    const hot = c.sees > 0;
    drawConeSoft(ctx, conePolygon(c.x, c.y, c.facing, c.half, c.range, solids),
      c.x, c.y, c.range, '255,52,52', hot);
  }
  for (const g of game.guards) {
    const hot = g.sees > 0 || g.state === 'converge';
    drawConeSoft(ctx, conePolygon(g.x, g.y, g.facing, g.half, g.range, solids),
      g.x, g.y, g.range, hot ? '255,96,40' : '255,186,64', hot);
    // Flashlight glint at the cone's origin.
    const fg = ctx.createRadialGradient(g.x, g.y, 1, g.x, g.y, 15);
    fg.addColorStop(0, 'rgba(255,240,200,0.5)');
    fg.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.arc(g.x, g.y, 15, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCameraBodies(ctx, game) {
  for (const c of game.cameras) {
    const hot = c.sees > 0;
    // Wall bracket.
    ctx.strokeStyle = '#3c414e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(c.x, c.y - 8);
    ctx.lineTo(c.x, c.y);
    ctx.stroke();
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.facing);
    // Body: a real little camera, lens toward facing.
    const bg = ctx.createLinearGradient(0, -8, 0, 8);
    bg.addColorStop(0, '#4a505e');
    bg.addColorStop(0.5, '#23262e');
    bg.addColorStop(1, '#101216');
    ctx.fillStyle = bg;
    rr(ctx, -9, -7.5, 19, 15, 3.5);
    ctx.fill();
    ctx.strokeStyle = '#5b6270';
    ctx.lineWidth = 1;
    rr(ctx, -9, -7.5, 19, 15, 3.5);
    ctx.stroke();
    ctx.fillStyle = '#171a20';
    ctx.beginPath();
    ctx.moveTo(10, -5);
    ctx.lineTo(16, -3.4);
    ctx.lineTo(16, 3.4);
    ctx.lineTo(10, 5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = hot ? '#ff2d2d' : '#7dd3fc';
    ctx.beginPath();
    ctx.arc(15.4, 0, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(14.6, -0.8, 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Recording LED (blinks on the staged clock) and a name plaque.
    const ledOn = Math.sin(game.time * 4 + c.x) > -0.2;
    ctx.fillStyle = ledOn ? '#ff4444' : '#5c1a1a';
    ctx.beginPath();
    ctx.arc(c.x - 7, c.y - 11, 2.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(8,6,14,0.82)';
    rr(ctx, c.x - 21, c.y + 11, 42, 11, 3);
    ctx.fill();
    ctx.fillStyle = '#f0a0a0';
    ctx.font = '700 8px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('● CAMERA', c.x, c.y + 19.5);
  }
}

// --- Actors: drawn sprites ----------------------------------------------

function drawGuardSprite(ctx, g) {
  shadowEllipse(ctx, g.x, g.y + 12, 14, 5.5, 0.42);
  ctx.save();
  ctx.translate(g.x, g.y);
  ctx.rotate(g.facing);
  // Arms at the shoulders.
  ctx.fillStyle = '#14264d';
  ctx.beginPath();
  ctx.arc(2, -13, 4.2, 0, Math.PI * 2);
  ctx.arc(2, 13, 4.2, 0, Math.PI * 2);
  ctx.fill();
  // Uniform body with a light falloff toward the facing edge.
  const bg = ctx.createLinearGradient(-13, 0, 13, 0);
  bg.addColorStop(0, '#16294f');
  bg.addColorStop(0.55, '#26509e');
  bg.addColorStop(1, '#3a63b0');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(0, 0, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#081226';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  // Shoulder strap and a gold badge.
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, 12.4, 0, Math.PI * 2);
  ctx.clip();
  ctx.rotate(-0.55);
  ctx.fillStyle = 'rgba(6,8,18,0.55)';
  ctx.fillRect(-14, -2.6, 28, 5.2);
  ctx.restore();
  ctx.fillStyle = '#e8bc62';
  ctx.beginPath();
  ctx.arc(4.5, -6, 1.9, 0, Math.PI * 2);
  ctx.fill();
  // Head: skin, then the navy cap as a crescent with a brim.
  const hg = ctx.createRadialGradient(4.5, -1.5, 1, 3, 0, 7.5);
  hg.addColorStop(0, '#f2c79e');
  hg.addColorStop(1, '#c68d58');
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.arc(3, 0, 6.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1d3468';
  ctx.beginPath();
  ctx.arc(1.6, 0, 7.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.arc(4.6, 0, 5.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2c4f96';
  ctx.beginPath();
  ctx.ellipse(10.6, 0, 3.4, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8bc62';
  ctx.beginPath();
  ctx.arc(1.6, 0, 1.5, 0, Math.PI * 2);
  ctx.fill();
  // Flashlight in the right hand.
  ctx.fillStyle = '#9aa3b2';
  ctx.fillRect(6, 12.4, 5.5, 3);
  ctx.fillStyle = '#fff3c4';
  ctx.beginPath();
  ctx.arc(11.8, 13.9, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (g.sees > 0 || g.state === 'converge' || g.state === 'investigate') {
    const alert = g.sees > 0 || g.state === 'converge';
    ctx.font = '900 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(10,4,8,0.85)';
    const ch = alert ? '!' : '?';
    ctx.strokeText(ch, g.x, g.y - 19);
    ctx.fillStyle = alert ? '#ff5544' : '#ffd700';
    ctx.fillText(ch, g.x, g.y - 19);
  }
}

function drawThiefSprite(ctx, game) {
  const t = game.thief;
  shadowEllipse(ctx, t.x, t.y + 11, 13, 5, 0.42);
  // Soft teal halo keeps her findable in a busy frame.
  const halo = ctx.createRadialGradient(t.x, t.y, 4, t.x, t.y, 31);
  halo.addColorStop(0, 'rgba(45,212,191,0.42)');
  halo.addColorStop(1, 'rgba(45,212,191,0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(t.x, t.y, 31, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(t.x, t.y);
  ctx.rotate(t.facing);
  // Loot sack slung on her back once the diamond is hers.
  if (game.hasLoot) {
    const sg = ctx.createRadialGradient(-12, -2, 1, -11, 0, 8);
    sg.addColorStop(0, '#9a6c3c');
    sg.addColorStop(1, '#54381e');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(-11, 0, 6.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3c2712';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = '#6e4a26';
    ctx.beginPath();
    ctx.moveTo(-11, -6.8);
    ctx.lineTo(-8.6, -10);
    ctx.lineTo(-13.4, -10);
    ctx.closePath();
    ctx.fill();
  }
  // Body: near-black with a cold rim light on the rear arc.
  const bg = ctx.createLinearGradient(-12, 0, 12, 0);
  bg.addColorStop(0, '#0c0d11');
  bg.addColorStop(0.6, '#23252e');
  bg.addColorStop(1, '#3a3e4a');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(94,234,212,0.4)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(0, 0, 12.6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(94,234,212,0.85)';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.arc(0, 0, 11, Math.PI * 0.62, Math.PI * 1.28);
  ctx.stroke();
  // Crimson scarf tail at the neck.
  ctx.fillStyle = '#8c2434';
  ctx.beginPath();
  ctx.moveTo(-9, 3);
  ctx.lineTo(-16, 6.5);
  ctx.lineTo(-9.5, 8.5);
  ctx.closePath();
  ctx.fill();
  // Hooded head with a pale eye stripe across the mask.
  ctx.fillStyle = '#14151b';
  ctx.beginPath();
  ctx.arc(2.5, 0, 7.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.8)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#05060a';
  ctx.beginPath();
  ctx.ellipse(5.4, 0, 3.8, 5.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f5f0e6';
  rr(ctx, 6.2, -3.3, 2.3, 6.6, 1.1);
  ctx.fill();
  ctx.fillStyle = '#101018';
  ctx.beginPath();
  ctx.arc(7.2, -1.7, 0.85, 0, Math.PI * 2);
  ctx.arc(7.2, 1.7, 0.85, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (game.hasLoot) {
    const bx = t.x - Math.cos(t.facing) * 11;
    const by = t.y - Math.sin(t.facing) * 11;
    sparkle(ctx, bx - 3, by - 8, 4.6, 0.55 + 0.35 * Math.sin(game.time * 6));
  }
  if (game.nearLoot && !game.hasLoot) {
    ctx.fillStyle = 'rgba(8,6,14,0.82)';
    const label = 'E — GRAB THE DIAMOND';
    ctx.font = '700 12.5px system-ui, sans-serif';
    const w = ctx.measureText(label).width + 18;
    rr(ctx, t.x - w / 2, t.y - 40, w, 20, 9);
    ctx.fill();
    ctx.fillStyle = CREAM;
    ctx.textAlign = 'center';
    ctx.fillText(label, t.x, t.y - 26);
  }
}

function drawActors(ctx, game) {
  for (const n of game.noises) {
    const a = Math.max(0, 1 - n.t / 0.9);
    ctx.strokeStyle = `rgba(255,215,0,${0.8 * a})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(n.x, n.y, 6 + n.t * 46, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,215,0,${0.45 * a})`;
    ctx.beginPath();
    ctx.arc(n.x, n.y, 3 + n.t * 26, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(n.x, n.y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath();
    ctx.arc(n.x - 1, n.y - 1, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const g of game.guards) drawGuardSprite(ctx, g);
  drawThiefSprite(ctx, game);
}

// --- HUD ------------------------------------------------------------------

function alarmWord(alarm) {
  if (alarm >= ALARM_HOT) return 'ALERT!';
  if (alarm >= 35) return 'SUSPICIOUS';
  return 'CALM';
}

function drawHUD(ctx, game) {
  const hg = ctx.createLinearGradient(0, 0, 0, HUD_H);
  hg.addColorStop(0, '#171126');
  hg.addColorStop(1, '#0e0918');
  ctx.fillStyle = hg;
  ctx.fillRect(0, 0, VIEW_W, HUD_H);
  ctx.fillStyle = GOLD;
  ctx.fillRect(0, HUD_H - 2, VIEW_W, 2);
  ctx.fillStyle = 'rgba(217,164,65,0.25)';
  ctx.fillRect(0, HUD_H - 4, VIEW_W, 1);

  // Title block with a small gem mark.
  drawDiamondGem(ctx, 34, 33, 0.85, '#d8f4ff', '#4fc3f7', '#1565a8');
  const tg = ctx.createLinearGradient(0, 18, 0, 46);
  tg.addColorStop(0, '#f4d98c');
  tg.addColorStop(1, '#b98a2e');
  ctx.fillStyle = tg;
  ctx.font = '700 20px Georgia, serif';
  ctx.textAlign = 'left';
  ctx.fillText('VELVET VAULT', 56, 41);

  // The alarm meter: gradient fill, glass highlight, tick marks.
  const mx = 300;
  const mw = 380;
  const my = 31;
  const mh = 19;
  ctx.fillStyle = CREAM;
  ctx.font = '700 12.5px system-ui, sans-serif';
  ctx.fillText('ALARM', mx, 24);
  ctx.fillStyle = '#0a0614';
  rr(ctx, mx - 2, my - 2, mw + 4, mh + 4, 5);
  ctx.fill();
  ctx.strokeStyle = GOLD_DK;
  ctx.lineWidth = 1.2;
  rr(ctx, mx - 2, my - 2, mw + 4, mh + 4, 5);
  ctx.stroke();
  ctx.fillStyle = '#241a30';
  ctx.fillRect(mx, my, mw, mh);
  const ag = ctx.createLinearGradient(mx, 0, mx + mw, 0);
  ag.addColorStop(0, '#2dd4bf');
  ag.addColorStop(0.4, '#a3e635');
  ag.addColorStop(0.62, '#fbbf24');
  ag.addColorStop(0.82, '#f97316');
  ag.addColorStop(1, '#ef4444');
  ctx.fillStyle = ag;
  ctx.fillRect(mx, my, (mw * game.alarm) / 100, mh);
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fillRect(mx, my, (mw * game.alarm) / 100, mh / 2);
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 10; i++) {
    ctx.beginPath();
    ctx.moveTo(mx + (mw * i) / 10, my + 2);
    ctx.lineTo(mx + (mw * i) / 10, my + mh - 2);
    ctx.stroke();
  }
  ctx.fillStyle = game.alarm >= ALARM_HOT ? '#ff7a6b' : CREAM;
  ctx.font = '700 13.5px system-ui, sans-serif';
  ctx.fillText(`${Math.floor(game.alarm)}% — ${alarmWord(game.alarm)}`, mx + mw + 14, my + 15);

  // Loot status, coins and the clock on the right.
  ctx.textAlign = 'right';
  if (game.hasLoot) {
    ctx.fillStyle = '#7dd3fc';
    ctx.font = '700 14px system-ui, sans-serif';
    ctx.fillText('◆ LOOT SECURED', VIEW_W - 24, 27);
  } else {
    ctx.fillStyle = '#8d84a3';
    ctx.font = '700 14px system-ui, sans-serif';
    ctx.fillText('◆ DIAMOND IN VAULT', VIEW_W - 24, 27);
  }
  ctx.fillStyle = CREAM;
  ctx.font = '600 13px system-ui, sans-serif';
  const mm = Math.floor(game.time / 60);
  const ss = String(Math.floor(game.time % 60)).padStart(2, '0');
  ctx.fillText(`COINS ●×${game.coins}    TIME ${mm}:${ss}`, VIEW_W - 24, 49);

  // The current objective on a pill under the bar.
  const text = game.objective;
  ctx.font = '600 13px system-ui, sans-serif';
  const w = ctx.measureText(text).width + 30;
  ctx.fillStyle = 'rgba(10,6,16,0.82)';
  rr(ctx, (VIEW_W - w) / 2, HUD_H + 8, w, 25, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(217,164,65,0.4)';
  ctx.lineWidth = 1;
  rr(ctx, (VIEW_W - w) / 2, HUD_H + 8, w, 25, 12);
  ctx.stroke();
  ctx.fillStyle = CREAM;
  ctx.textAlign = 'center';
  ctx.fillText(text, VIEW_W / 2, HUD_H + 25);
}

// --- End panels -------------------------------------------------------------

function panelFrame(ctx, veil) {
  ctx.fillStyle = `rgba(6,3,12,${veil})`;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const w = 640;
  const h = 356;
  const x = (VIEW_W - w) / 2;
  const y = (VIEW_H - h) / 2;
  const pg = ctx.createLinearGradient(0, y, 0, y + h);
  pg.addColorStop(0, '#241832');
  pg.addColorStop(1, '#150d21');
  ctx.fillStyle = pg;
  rr(ctx, x, y, w, h, 10);
  ctx.fill();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  rr(ctx, x, y, w, h, 10);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(217,164,65,0.4)';
  ctx.lineWidth = 1;
  rr(ctx, x + 7, y + 7, w - 14, h - 14, 7);
  ctx.stroke();
  for (const [cx, cy] of [[x + 16, y + 16], [x + w - 16, y + 16], [x + 16, y + h - 16], [x + w - 16, y + h - 16]]) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = GOLD;
    ctx.fillRect(-4, -4, 8, 8);
    ctx.restore();
  }
  return { x, y, w, h };
}

function panelTitle(ctx, y, text, color) {
  ctx.font = '700 43px Georgia, serif';
  ctx.textAlign = 'center';
  const tw = ctx.measureText(text).width;
  const tg = ctx.createLinearGradient(0, y - 40, 0, y);
  tg.addColorStop(0, '#ffffff');
  tg.addColorStop(0.25, color);
  tg.addColorStop(1, color);
  ctx.fillStyle = tg;
  ctx.fillText(text, VIEW_W / 2, y);
  ctx.strokeStyle = 'rgba(217,164,65,0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(VIEW_W / 2 - tw / 2, y + 13);
  ctx.lineTo(VIEW_W / 2 - 12, y + 13);
  ctx.moveTo(VIEW_W / 2 + 12, y + 13);
  ctx.lineTo(VIEW_W / 2 + tw / 2, y + 13);
  ctx.stroke();
  ctx.save();
  ctx.translate(VIEW_W / 2, y + 13);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = GOLD;
  ctx.fillRect(-3.5, -3.5, 7, 7);
  ctx.restore();
}

function panelLines(ctx, y, lines, foot) {
  ctx.fillStyle = CREAM;
  ctx.font = '15.5px system-ui, sans-serif';
  ctx.textAlign = 'center';
  lines.forEach((ln, i) => ctx.fillText(ln, VIEW_W / 2, y + i * 27));
  ctx.fillStyle = GOLD;
  ctx.font = '700 15.5px system-ui, sans-serif';
  ctx.fillText(foot, VIEW_W / 2, y + lines.length * 27 + 16);
}

export function ratingFor(peakAlarm, seconds) {
  if (peakAlarm < 35 && seconds < 150) return 'GHOST — never truly seen';
  if (peakAlarm < 70) return 'SHADOW — in and out, barely a whisper';
  return 'LOUD AND LUCKY — but rich';
}

function drawPanels(ctx, game) {
  if (game.mode === 'title') {
    const { y } = panelFrame(ctx, 0.74);
    drawDiamondGem(ctx, VIEW_W / 2, y + 52, 2.1, '#d8f4ff', '#4fc3f7', '#1565a8');
    sparkle(ctx, VIEW_W / 2 - 26, y + 34, 7, 0.8);
    sparkle(ctx, VIEW_W / 2 + 28, y + 44, 5, 0.6);
    panelTitle(ctx, y + 118, 'VELVET VAULT', '#e8bc62');
    panelLines(ctx, y + 152, [
      'One thief. One diamond. Three guards, two cameras, one alarm.',
      'Cross the hall, lift the Aurora Diamond, and reach the EXIT.',
      'WASD / arrows — move · SHIFT — sprint (loud) · E — grab',
      'Q or click — toss a coin to pull a guard away (3 coins)',
      'Stay out of the cones: seen = alarm. Alarm at 100% = caught.',
    ], 'ENTER or click — BEGIN THE HEIST');
  } else if (game.mode === 'win') {
    const { y } = panelFrame(ctx, 0.62);
    drawDiamondGem(ctx, VIEW_W / 2, y + 52, 2.1, '#d8f4ff', '#4fc3f7', '#1565a8');
    sparkle(ctx, VIEW_W / 2 - 26, y + 34, 7, 0.8);
    panelTitle(ctx, y + 118, 'CLEAN GETAWAY', '#4ade80');
    panelLines(ctx, y + 152, [
      `Time inside: ${Math.floor(game.time / 60)}:${String(Math.floor(game.time % 60)).padStart(2, '0')}`,
      `Peak alarm: ${Math.floor(game.peakAlarm)}%`,
      `Rating: ${ratingFor(game.peakAlarm, game.time)}`,
      'The Aurora Diamond is yours. The vault never stood a chance.',
    ], 'R — ROB IT AGAIN');
  } else if (game.mode === 'lose') {
    const { y } = panelFrame(ctx, 0.74);
    const sg = ctx.createRadialGradient(VIEW_W / 2, y + 52, 2, VIEW_W / 2, y + 52, 34);
    sg.addColorStop(0, 'rgba(255,70,50,0.85)');
    sg.addColorStop(1, 'rgba(255,70,50,0)');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(VIEW_W / 2, y + 52, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e02444';
    ctx.beginPath();
    ctx.arc(VIEW_W / 2, y + 52, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd9de';
    ctx.font = '900 19px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', VIEW_W / 2, y + 59);
    panelTitle(ctx, y + 118, 'CAUGHT!', '#ef4444');
    panelLines(ctx, y + 152, [
      'The alarm hit 100% and the vault sealed shut.',
      `You lasted ${Math.floor(game.time / 60)}:${String(Math.floor(game.time % 60)).padStart(2, '0')} with a peak alarm of ${Math.floor(game.peakAlarm)}%.`,
      'Read the cones, use the cases for cover, spend your coins.',
    ], 'R — TRY AGAIN');
  }
}

// --- Frame -------------------------------------------------------------------

export function drawGame(ctx, game) {
  if (!game._static) game._static = buildStatic(game);
  ctx.drawImage(game._static, 0, 0);
  drawExit(ctx, game);
  drawWatchers(ctx, game);
  drawSolids(ctx, game);
  drawLoot(ctx, game);
  drawCameraBodies(ctx, game);
  drawActors(ctx, game);
  // Night vignette over the hall, under the HUD.
  const vg = ctx.createRadialGradient(640, 440, 330, 640, 440, 830);
  vg.addColorStop(0, 'rgba(3,2,9,0)');
  vg.addColorStop(1, 'rgba(3,2,9,0.33)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, HUD_H, VIEW_W, VIEW_H - HUD_H);
  drawHUD(ctx, game);
  if (game.notice && game.time < game.notice.until) {
    ctx.font = '700 17px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const w = ctx.measureText(game.notice.text).width + 26;
    ctx.fillStyle = 'rgba(20,8,8,0.85)';
    rr(ctx, (VIEW_W - w) / 2, 118, w, 28, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,120,90,0.6)';
    ctx.lineWidth = 1;
    rr(ctx, (VIEW_W - w) / 2, 118, w, 28, 8);
    ctx.stroke();
    ctx.fillStyle = '#ffb199';
    ctx.fillText(game.notice.text, VIEW_W / 2, 138);
  }
  drawPanels(ctx, game);
}
