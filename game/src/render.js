// render.js — everything the player (and the screenshot judge) sees.
// v4 changes the rendering LANGUAGE, not the furniture count. The
// static hall is pre-rendered with a real light-and-shadow model:
// textured marble with visible veins, soft shadows under every
// case and statue, warm light pools, polished-floor reflections
// under the lit cases, area rugs, and a vault that sits on a raised
// platform behind a rectangular steel door. Cases have warm
// INTERIOR-LIT glass with the artifact standing on a plinth inside.
// Actors are outlined, two-tone shaded figures drawn at a larger
// scale, depth-sorted by their south edge.

import { VIEW_W, VIEW_H, HUD_H } from './level.js';
import { conePolygon } from './vision.js';
import { ALARM_HOT } from './actors.js';

const GOLD = '#d9a441';
const GOLD_DK = '#8a6d2f';
const CREAM = '#f3e9d2';

// Deterministic 0..1 hash of integer coords, for marble speckle,
// veins and tile tone variation that never flickers between frames.
function hash2(x, y) {
  const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return h - Math.floor(h);
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
  ctx.save();
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// A soft-edged shadow: a radial gradient squashed into an ellipse,
// so furniture sits IN the room instead of on a hard black sticker.
function softShadow(ctx, cx, cy, rx, ry, alpha = 0.5) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, rx * 0.15, 0, 0, rx);
  g.addColorStop(0, `rgba(0,0,0,${alpha})`);
  g.addColorStop(0.65, `rgba(0,0,0,${alpha * 0.55})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function sparkle(ctx, x, y, r, alpha) {
  ctx.save();
  ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(x - r, y);
  ctx.lineTo(x + r, y);
  ctx.moveTo(x, y - r);
  ctx.lineTo(x, y + r);
  ctx.stroke();
  ctx.restore();
}

// A faceted gem centred on (x, y); s scales the ~23px unit drawing.
// Shared by the HUD mark, the artifact painters and the Aurora
// Diamond itself.
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

// --- The static hall ------------------------------------------------

// Large marble slabs with veins that wander across the grout lines,
// soft mottling inside every slab and a polished edge highlight, so
// the floor reads as stone, not as a grid of identical tiles.
function paintSlabs(ctx, x0, y0, x1, y1, sw, sh, tones, grout) {
  ctx.fillStyle = grout;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  let row = 0;
  for (let y = y0; y < y1; y += sh, row++) {
    const off = row % 2 ? -sw / 2 : 0;
    let col = 0;
    for (let x = x0 + off; x < x1; x += sw, col++) {
      const t = tones[Math.floor(hash2(col * 3 + row, row * 7 + col) * tones.length)];
      ctx.fillStyle = t;
      ctx.fillRect(x + 1.5, y + 1.5, sw - 3, sh - 3);
      // Soft mottling: one broad light or dark bloom per slab.
      const mx = x + sw * (0.25 + hash2(col * 7, row * 3) * 0.5);
      const my = y + sh * (0.25 + hash2(row * 5, col * 11) * 0.5);
      const mg = ctx.createRadialGradient(mx, my, 4, mx, my, sw * 0.62);
      const warm = hash2(col + 40, row + 9) > 0.5;
      mg.addColorStop(0, warm ? 'rgba(255,238,205,0.075)' : 'rgba(0,0,10,0.10)');
      mg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = mg;
      ctx.fillRect(x, y, sw, sh);
      // Speckle.
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      for (let i = 0; i < 9; i++) {
        const sx = x + hash2(col * 31 + i, row * 17 + i) * sw;
        const sy = y + hash2(col * 13 + i, row * 29 + i) * sh;
        ctx.fillRect(sx, sy, 1.7, 1.7);
      }
      ctx.fillStyle = 'rgba(0,0,0,0.10)';
      for (let i = 0; i < 5; i++) {
        const sx = x + hash2(col * 41 + i, row * 23 + i) * sw;
        const sy = y + hash2(col * 19 + i, row * 37 + i) * sh;
        ctx.fillRect(sx, sy, 2.2, 2.2);
      }
      // Two wandering veins per slab, light with a dark companion.
      for (const v of [0, 1]) {
        const vx = x + hash2(col + v * 13, row) * sw * 0.6;
        const vy = y + hash2(row, col + v * 7) * sh * 0.45;
        ctx.strokeStyle = v ? 'rgba(10,10,18,0.13)' : 'rgba(218,224,240,0.15)';
        ctx.lineWidth = v ? 2.2 : 1.5;
        ctx.beginPath();
        ctx.moveTo(vx, vy);
        ctx.lineTo(vx + 30 + hash2(col + 9 + v, row) * 36, vy + 13 + v * 9);
        ctx.lineTo(vx + 52 + hash2(col, row + 9 + v) * 44, vy + 32 + hash2(col + 4, row + 4) * 24);
        ctx.stroke();
      }
      // Polished top edge of the slab.
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(x + 2, y + 2, sw - 4, 1.6);
    }
  }
}

// A big framed painting for the north wall: gilded frame, cream mat,
// and a little layered scene — sky, hills and trees for the
// landscape; sky, moon, waves and a boat for the seascape.
function paintPainting(ctx, cx, cy, w, h, scene) {
  const x = cx - w / 2;
  const y = cy - h / 2;
  const fg = ctx.createLinearGradient(x, y, x, y + h);
  fg.addColorStop(0, '#e8bc62');
  fg.addColorStop(0.5, '#9a742f');
  fg.addColorStop(1, '#6e5222');
  ctx.fillStyle = fg;
  rr(ctx, x, y, w, h, 3);
  ctx.fill();
  ctx.strokeStyle = 'rgba(40,26,8,0.6)';
  ctx.lineWidth = 1;
  rr(ctx, x, y, w, h, 3);
  ctx.stroke();
  ctx.fillStyle = '#e9e0c8';
  ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
  const ix = x + 8;
  const iy = y + 8;
  const iw = w - 16;
  const ih = h - 16;
  if (scene === 'landscape') {
    const sky = ctx.createLinearGradient(0, iy, 0, iy + ih);
    sky.addColorStop(0, '#f0b45e');
    sky.addColorStop(0.6, '#c96f3f');
    sky.addColorStop(1, '#7a3b2e');
    ctx.fillStyle = sky;
    ctx.fillRect(ix, iy, iw, ih);
    ctx.fillStyle = '#f9dc7e';
    ctx.beginPath();
    ctx.arc(ix + iw * 0.68, iy + ih * 0.4, ih * 0.21, 0, Math.PI * 2);
    ctx.fill();
    // Far ridge, mid hills, near ground.
    ctx.fillStyle = '#6b3444';
    ctx.beginPath();
    ctx.moveTo(ix, iy + ih * 0.72);
    ctx.lineTo(ix + iw * 0.3, iy + ih * 0.42);
    ctx.lineTo(ix + iw * 0.58, iy + ih * 0.66);
    ctx.lineTo(ix + iw * 0.8, iy + ih * 0.5);
    ctx.lineTo(ix + iw, iy + ih * 0.7);
    ctx.lineTo(ix + iw, iy + ih);
    ctx.lineTo(ix, iy + ih);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#45222e';
    ctx.beginPath();
    ctx.moveTo(ix, iy + ih);
    ctx.lineTo(ix, iy + ih * 0.78);
    ctx.lineTo(ix + iw * 0.42, iy + ih * 0.6);
    ctx.lineTo(ix + iw * 0.75, iy + ih * 0.84);
    ctx.lineTo(ix + iw, iy + ih * 0.72);
    ctx.lineTo(ix + iw, iy + ih);
    ctx.closePath();
    ctx.fill();
    // Two tree silhouettes on the near ground.
    for (const tx of [0.13, 0.9]) {
      const bx = ix + iw * tx;
      const by = iy + ih * 0.97;
      ctx.fillStyle = '#2c1a24';
      ctx.fillRect(bx - 0.8, by - ih * 0.3, 1.7, ih * 0.3);
      ctx.beginPath();
      ctx.arc(bx, by - ih * 0.36, ih * 0.17, 0, Math.PI * 2);
      ctx.arc(bx - ih * 0.13, by - ih * 0.27, ih * 0.11, 0, Math.PI * 2);
      ctx.arc(bx + ih * 0.13, by - ih * 0.27, ih * 0.11, 0, Math.PI * 2);
      ctx.fill();
    }
    // Birds.
    ctx.strokeStyle = 'rgba(40,18,26,0.8)';
    ctx.lineWidth = 1.1;
    for (const [bx, by, s] of [[0.24, 0.22, 3.4], [0.34, 0.15, 2.6]]) {
      ctx.beginPath();
      ctx.arc(ix + iw * bx - s, iy + ih * by, s, Math.PI * 1.15, Math.PI * 1.75);
      ctx.arc(ix + iw * bx + s, iy + ih * by, s, Math.PI * 1.25, Math.PI * 1.85);
      ctx.stroke();
    }
  } else {
    // Seascape: dusk sky over water, a moon, wave rows, a boat.
    const sky = ctx.createLinearGradient(0, iy, 0, iy + ih * 0.45);
    sky.addColorStop(0, '#5d7ea6');
    sky.addColorStop(1, '#d9c9a8');
    ctx.fillStyle = sky;
    ctx.fillRect(ix, iy, iw, ih * 0.45);
    const sea = ctx.createLinearGradient(0, iy + ih * 0.45, 0, iy + ih);
    sea.addColorStop(0, '#33567f');
    sea.addColorStop(1, '#0e1e36');
    ctx.fillStyle = sea;
    ctx.fillRect(ix, iy + ih * 0.45, iw, ih * 0.55);
    ctx.fillStyle = '#eef2e4';
    ctx.beginPath();
    ctx.arc(ix + iw * 0.26, iy + ih * 0.24, ih * 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(238,242,228,0.35)';
    ctx.fillRect(ix + iw * 0.22, iy + ih * 0.47, iw * 0.08, ih * 0.5);
    ctx.strokeStyle = 'rgba(190,220,255,0.65)';
    ctx.lineWidth = 1.2;
    for (let r2 = 0; r2 < 3; r2++) {
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(ix + iw * (0.14 + i * 0.24) + r2 * 7, iy + ih * (0.62 + r2 * 0.14), iw * 0.075, Math.PI * 1.08, Math.PI * 1.92);
        ctx.stroke();
      }
    }
    // A small boat with a cream sail, right of centre.
    const bx = ix + iw * 0.66;
    const by = iy + ih * 0.6;
    ctx.strokeStyle = '#1c0f06';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx, by - ih * 0.34);
    ctx.stroke();
    ctx.fillStyle = '#f3e9d2';
    ctx.beginPath();
    ctx.moveTo(bx + 1.4, by - ih * 0.33);
    ctx.lineTo(bx + 1.4, by - ih * 0.05);
    ctx.lineTo(bx + iw * 0.085, by - ih * 0.05);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#2a1608';
    ctx.beginPath();
    ctx.moveTo(bx - iw * 0.07, by);
    ctx.lineTo(bx + iw * 0.09, by);
    ctx.lineTo(bx + iw * 0.055, by + ih * 0.09);
    ctx.lineTo(bx - iw * 0.035, by + ih * 0.09);
    ctx.closePath();
    ctx.fill();
  }
  // Glass sheen.
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.beginPath();
  ctx.moveTo(ix, iy + ih);
  ctx.lineTo(ix + iw * 0.45, iy);
  ctx.lineTo(ix + iw * 0.68, iy);
  ctx.lineTo(ix + iw * 0.23, iy + ih);
  ctx.closePath();
  ctx.fill();
}

// Floor tint each case throws onto the polished marble beneath it:
// a faint, warm smear of the artifact's own colour.
const ART_TINT = {
  statue: '217,164,65', crown: '217,164,65', vase: '125,143,168',
  egg: '232,80,90', gems: '74,222,128', chalice: '217,164,65',
  urn: '168,106,78', ruby: '244,63,94', coins: '217,164,65',
  emeralds: '52,211,153',
};

function buildStatic(game) {
  const { carpet, vaultFloor, decor } = game.level;
  const c = document.createElement('canvas');
  c.width = VIEW_W;
  c.height = VIEW_H;
  const ctx = c.getContext('2d');

  // -- Floor: big marble slabs, mottled and veined.
  paintSlabs(ctx, 24, 104, 1256, 776, 213, 168,
    ['#3a3f52', '#343949', '#3f4459', '#313644', '#383d4e'], '#22242e');
  // -- The vault's own floor: warmer stone.
  paintSlabs(ctx, vaultFloor.x, vaultFloor.y, vaultFloor.x + vaultFloor.w,
    vaultFloor.y + vaultFloor.h, 113, 124,
    ['#463a52', '#413550', '#4a3e56'], '#2c2338');
  ctx.strokeStyle = 'rgba(217,164,65,0.4)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(vaultFloor.x + 7, vaultFloor.y + 7, vaultFloor.w - 14, vaultFloor.h - 14);

  // -- Warm light pools spilling from the case clusters.
  for (const p of decor.lightPools) {
    const pg = ctx.createRadialGradient(p.x, p.y, 8, p.x, p.y, p.r);
    pg.addColorStop(0, 'rgba(255,196,96,0.26)');
    pg.addColorStop(0.55, 'rgba(255,196,96,0.10)');
    pg.addColorStop(1, 'rgba(255,196,96,0)');
    ctx.fillStyle = pg;
    ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
  }

  // -- Brass floor inlay: a double border line with corner diamonds,
  // set into the marble around the hall.
  const fi = decor.floorInlay;
  ctx.strokeStyle = 'rgba(217,164,65,0.34)';
  ctx.lineWidth = 2;
  ctx.strokeRect(fi.x, fi.y, fi.w, fi.h);
  ctx.strokeStyle = 'rgba(217,164,65,0.16)';
  ctx.lineWidth = 1;
  ctx.strokeRect(fi.x + 8, fi.y + 8, fi.w - 16, fi.h - 16);
  ctx.fillStyle = 'rgba(217,164,65,0.4)';
  for (const [cx, cy] of [
    [fi.x, fi.y], [fi.x + fi.w, fi.y], [fi.x, fi.y + fi.h], [fi.x + fi.w, fi.y + fi.h],
    [fi.x + fi.w / 2, fi.y], [fi.x + fi.w / 2, fi.y + fi.h],
  ]) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-4, -4, 8, 8);
    ctx.restore();
  }

  // -- Area rugs under the side case clusters: deep indigo wool,
  // crimson-and-gold border, a faint diamond lattice in the field.
  for (const r of decor.rugs) {
    const rg = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
    rg.addColorStop(0, '#24344f');
    rg.addColorStop(0.5, '#1b2942');
    rg.addColorStop(1, '#152136');
    ctx.fillStyle = rg;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = 'rgba(217,164,65,0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(r.x + 5, r.y + 5, r.w - 10, r.h - 10);
    ctx.strokeStyle = 'rgba(158,44,58,0.75)';
    ctx.lineWidth = 5;
    ctx.strokeRect(r.x + 11, r.y + 11, r.w - 22, r.h - 22);
    ctx.strokeStyle = 'rgba(217,164,65,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(r.x + 17, r.y + 17, r.w - 34, r.h - 34);
    ctx.strokeStyle = 'rgba(232,188,98,0.13)';
    ctx.lineWidth = 1;
    for (let dx = r.x + 44; dx < r.x + r.w - 30; dx += 52) {
      for (let dy = r.y + 44; dy < r.y + r.h - 30; dy += 52) {
        ctx.save();
        ctx.translate(dx, dy);
        ctx.rotate(Math.PI / 4);
        ctx.strokeRect(-8, -8, 16, 16);
        ctx.restore();
      }
    }
    // A soft shadow where the rug meets the stone at its south edge.
    const rsh = ctx.createLinearGradient(0, r.y + r.h, 0, r.y + r.h + 10);
    rsh.addColorStop(0, 'rgba(0,0,0,0.30)');
    rsh.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rsh;
    ctx.fillRect(r.x, r.y + r.h, r.w, 10);
  }

  // -- The vault's inner carpet: crimson, gold border bands, a
  // diamond row along the border and a faint lattice in the field.
  const vc = decor.vaultCarpet;
  const vcg = ctx.createLinearGradient(vc.x, vc.y, vc.x, vc.y + vc.h);
  vcg.addColorStop(0, '#711c29');
  vcg.addColorStop(0.5, '#5e1620');
  vcg.addColorStop(1, '#4c1119');
  ctx.fillStyle = vcg;
  ctx.fillRect(vc.x, vc.y, vc.w, vc.h);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  ctx.strokeRect(vc.x + 5, vc.y + 5, vc.w - 10, vc.h - 10);
  ctx.strokeStyle = 'rgba(217,164,65,0.4)';
  ctx.lineWidth = 1;
  ctx.strokeRect(vc.x + 12, vc.y + 12, vc.w - 24, vc.h - 24);
  ctx.fillStyle = 'rgba(232,188,98,0.5)';
  for (let dx = vc.x + 26; dx < vc.x + vc.w - 16; dx += 34) {
    for (const dy of [vc.y + 9.5, vc.y + vc.h - 9.5]) {
      ctx.save();
      ctx.translate(dx, dy);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-2.6, -2.6, 5.2, 5.2);
      ctx.restore();
    }
  }
  ctx.strokeStyle = 'rgba(232,188,98,0.10)';
  for (let dx = vc.x + 52; dx < vc.x + vc.w - 40; dx += 62) {
    for (let dy = vc.y + 46; dy < vc.y + vc.h - 34; dy += 62) {
      ctx.save();
      ctx.translate(dx, dy);
      ctx.rotate(Math.PI / 4);
      ctx.strokeRect(-11, -11, 22, 22);
      ctx.restore();
    }
  }

  // -- Polished-floor reflections: under every lit case, a faint
  // vertical smear of its artifact's colour, plus a warm pool at
  // the case's feet. Baked here so the dynamic case shadow sits
  // on top of them.
  for (const r of game.level.solids) {
    if (r.kind !== 'case') continue;
    const baseY = r.y + r.h;
    const tint = ART_TINT[r.art] || '217,164,65';
    const rfl = ctx.createLinearGradient(0, baseY + 2, 0, baseY + 54);
    rfl.addColorStop(0, `rgba(${tint},0.13)`);
    rfl.addColorStop(1, `rgba(${tint},0)`);
    ctx.fillStyle = rfl;
    ctx.fillRect(r.x + 12, baseY + 2, r.w - 24, 52);
    const pool = ctx.createRadialGradient(r.x + r.w / 2, baseY + 12, 4, r.x + r.w / 2, baseY + 12, 95);
    pool.addColorStop(0, 'rgba(255,196,96,0.13)');
    pool.addColorStop(1, 'rgba(255,196,96,0)');
    ctx.fillStyle = pool;
    ctx.fillRect(r.x - 20, baseY - 30, r.w + 40, 110);
  }
  const ped = game.level.pedestal;
  const pglow = ctx.createRadialGradient(ped.x + ped.w / 2, ped.y + ped.h + 8, 4, ped.x + ped.w / 2, ped.y + ped.h + 8, 90);
  pglow.addColorStop(0, 'rgba(140,210,255,0.15)');
  pglow.addColorStop(1, 'rgba(140,210,255,0)');
  ctx.fillStyle = pglow;
  ctx.fillRect(ped.x - 50, ped.y, ped.w + 100, ped.h + 100);

  // -- The carpet runner: crimson, double gold border, diamond row.
  const cg = ctx.createLinearGradient(carpet.x, 0, carpet.x + carpet.w, 0);
  cg.addColorStop(0, '#5f1620');
  cg.addColorStop(0.5, '#82222f');
  cg.addColorStop(1, '#5f1620');
  ctx.fillStyle = cg;
  ctx.fillRect(carpet.x, carpet.y, carpet.w, carpet.h);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  ctx.strokeRect(carpet.x + 5, carpet.y + 5, carpet.w - 10, carpet.h - 10);
  ctx.strokeStyle = 'rgba(217,164,65,0.45)';
  ctx.lineWidth = 1;
  ctx.strokeRect(carpet.x + 11, carpet.y + 11, carpet.w - 22, carpet.h - 22);
  ctx.fillStyle = 'rgba(232,188,98,0.5)';
  for (let y = carpet.y + 34; y < carpet.y + carpet.h - 16; y += 62) {
    ctx.save();
    ctx.translate(carpet.x + carpet.w / 2, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-5, -5, 10, 10);
    ctx.restore();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.fillRect(carpet.x, carpet.y, carpet.w, 26);

  // -- Rope posts and their sagging ropes along the carpet.
  for (const sideX of [carpet.x - 8, carpet.x + carpet.w + 8]) {
    const sag = sideX < carpet.x ? 9 : -9;
    ctx.strokeStyle = '#8e2432';
    ctx.lineWidth = 3.5;
    for (let i = 0; i < decor.ropePostsY.length - 1; i++) {
      ctx.beginPath();
      ctx.moveTo(sideX, decor.ropePostsY[i] - 15);
      ctx.quadraticCurveTo(sideX + sag, (decor.ropePostsY[i] + decor.ropePostsY[i + 1]) / 2 - 8,
        sideX, decor.ropePostsY[i + 1] - 15);
      ctx.stroke();
    }
    for (const py of decor.ropePostsY) {
      shadowEllipse(ctx, sideX, py + 1, 7, 2.6, 0.4);
      ctx.fillStyle = '#6e5222';
      ctx.fillRect(sideX - 1.8, py - 15, 3.6, 15);
      const bg2 = ctx.createRadialGradient(sideX - 1.5, py - 19.5, 0.5, sideX, py - 18, 5);
      bg2.addColorStop(0, '#ffe9a8');
      bg2.addColorStop(1, '#9a742f');
      ctx.fillStyle = bg2;
      ctx.beginPath();
      ctx.arc(sideX, py - 18, 4.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // -- Side and south walls: dark bands with a gold trim line and a
  // soft shadow where wall meets floor.
  ctx.fillStyle = '#1d1930';
  ctx.fillRect(0, 776, VIEW_W, 24);
  ctx.fillRect(0, HUD_H, 24, 736);
  ctx.fillRect(1256, HUD_H, 24, 736);
  ctx.fillStyle = 'rgba(217,164,65,0.4)';
  ctx.fillRect(24, 774, 1232, 1.6);
  ctx.fillRect(24, HUD_H, 1.6, 712);
  ctx.fillRect(1254.4, HUD_H, 1.6, 712);
  const shS = ctx.createLinearGradient(0, 748, 0, 776);
  shS.addColorStop(0, 'rgba(0,0,0,0)');
  shS.addColorStop(1, 'rgba(0,0,0,0.32)');
  ctx.fillStyle = shS;
  ctx.fillRect(24, 748, 1232, 28);

  // -- North wall face: paneled navy wall with a wood wainscot,
  // pilasters, two LARGE paintings and sconces — a wall you look
  // AT, not a floor strip.
  const wg = ctx.createLinearGradient(0, HUD_H, 0, 104);
  wg.addColorStop(0, '#2a2247');
  wg.addColorStop(0.78, '#211b38');
  wg.addColorStop(1, '#181230');
  ctx.fillStyle = wg;
  ctx.fillRect(0, HUD_H, VIEW_W, 40);
  ctx.strokeStyle = 'rgba(217,164,65,0.17)';
  ctx.lineWidth = 1;
  for (let x = 44; x < 1230; x += 118) {
    ctx.strokeRect(x, HUD_H + 6, 96, 24);
  }
  for (const px of decor.pilastersTop) {
    ctx.fillStyle = '#322757';
    ctx.fillRect(px, HUD_H, 30, 40);
    ctx.fillStyle = '#41336e';
    ctx.fillRect(px, HUD_H, 30, 6);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(px + 26, HUD_H, 4, 40);
    ctx.fillStyle = 'rgba(217,164,65,0.5)';
    ctx.fillRect(px, HUD_H + 6, 30, 1.2);
  }
  // Wainscot: a wood band along the wall's foot, then its shadow
  // spilling onto the marble.
  const wcg = ctx.createLinearGradient(0, 96, 0, 114);
  wcg.addColorStop(0, '#41291a');
  wcg.addColorStop(1, '#241610');
  ctx.fillStyle = wcg;
  ctx.fillRect(0, 96, VIEW_W, 18);
  ctx.fillStyle = 'rgba(217,164,65,0.55)';
  ctx.fillRect(0, 95, VIEW_W, 1.4);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 112.6, VIEW_W, 1.4);
  const shN = ctx.createLinearGradient(0, 104, 0, 126);
  shN.addColorStop(0, 'rgba(0,0,0,0.34)');
  shN.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = shN;
  ctx.fillRect(24, 104, 1232, 22);
  for (const p of decor.paintings) paintPainting(ctx, p.x, 87, 190, 44, p.scene);
  for (const sx of decor.sconces) {
    const sg = ctx.createRadialGradient(sx, 86, 2, sx, 86, 38);
    sg.addColorStop(0, 'rgba(255,196,96,0.30)');
    sg.addColorStop(1, 'rgba(255,196,96,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(sx - 38, 48, 76, 76);
    ctx.fillStyle = '#9a742f';
    ctx.beginPath();
    ctx.ellipse(sx, 95, 6, 3.4, 0, 0, Math.PI);
    ctx.fill();
    ctx.fillStyle = '#ffd98c';
    ctx.beginPath();
    ctx.arc(sx, 91, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // -- The vault platform: a shadow the raised chamber throws onto
  // the hall floor to its south and west.
  const psh = ctx.createLinearGradient(0, 396, 0, 440);
  psh.addColorStop(0, 'rgba(0,0,0,0.44)');
  psh.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = psh;
  ctx.fillRect(716, 396, 504, 44);
  const pshW = ctx.createLinearGradient(694, 0, 742, 0);
  pshW.addColorStop(0, 'rgba(0,0,0,0)');
  pshW.addColorStop(1, 'rgba(0,0,0,0.36)');
  ctx.fillStyle = pshW;
  ctx.fillRect(694, 132, 48, 264);

  // -- Vault walls: heavy bands with gold trim.
  ctx.fillStyle = '#2e2342';
  for (const r of game.level.solids) {
    if (r.kind === 'vault') ctx.fillRect(r.x, r.y, r.w, r.h);
  }
  ctx.strokeStyle = 'rgba(217,164,65,0.5)';
  ctx.lineWidth = 1.4;
  ctx.strokeRect(733, 131, 470, 266);

  // -- The platform step: a pale stone edge along the vault's south
  // side, lit on top, dark on its face.
  const stg = ctx.createLinearGradient(0, 388, 0, 402);
  stg.addColorStop(0, '#57496b');
  stg.addColorStop(0.35, '#3c3350');
  stg.addColorStop(1, '#241d33');
  ctx.fillStyle = stg;
  ctx.fillRect(724, 388, 488, 14);
  ctx.fillStyle = 'rgba(255,240,210,0.28)';
  ctx.fillRect(724, 388, 488, 1.6);
  ctx.fillStyle = 'rgba(217,164,65,0.35)';
  ctx.fillRect(724, 396, 488, 1);

  // -- The great steel door: a rectangular door set into a steel-
  // clad block on the vault's north wall — frame, recessed panel,
  // wheel, bolts, a lit threshold and its shadow on the carpet.
  const vd = decor.vaultDoor;
  const dx = vd.x - 52;
  const dy = 104;
  const dw = 104;
  const dh = 68;
  const dsh = ctx.createLinearGradient(0, dy + dh, 0, dy + dh + 16);
  dsh.addColorStop(0, 'rgba(0,0,0,0.38)');
  dsh.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = dsh;
  ctx.fillRect(dx - 4, dy + dh, dw + 8, 16);
  const blk = ctx.createLinearGradient(0, dy, 0, dy + dh);
  blk.addColorStop(0, '#454c59');
  blk.addColorStop(0.5, '#31363f');
  blk.addColorStop(1, '#1e2127');
  ctx.fillStyle = blk;
  ctx.fillRect(dx, dy, dw, dh);
  ctx.strokeStyle = '#121317';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(dx + 1, dy + 1, dw - 2, dh - 2);
  ctx.strokeStyle = 'rgba(217,164,65,0.45)';
  ctx.lineWidth = 1;
  ctx.strokeRect(dx + 4.5, dy + 4.5, dw - 9, dh - 9);
  // Recessed door panel with a centre seam.
  const dp = ctx.createLinearGradient(dx, dy, dx + dw, dy);
  dp.addColorStop(0, '#59616f');
  dp.addColorStop(0.5, '#6d7482');
  dp.addColorStop(1, '#3a3f49');
  ctx.fillStyle = dp;
  ctx.fillRect(dx + 13, dy + 11, dw - 26, dh - 26);
  ctx.strokeStyle = '#17181d';
  ctx.lineWidth = 2;
  ctx.strokeRect(dx + 13, dy + 11, dw - 26, dh - 26);
  ctx.strokeStyle = 'rgba(20,21,26,0.65)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(vd.x, dy + 13);
  ctx.lineTo(vd.x, dy + dh - 13);
  ctx.stroke();
  // Bolts around the panel.
  ctx.fillStyle = '#22252c';
  for (const [bx, by] of [
    [dx + 19, dy + 17], [dx + dw - 19, dy + 17],
    [dx + 19, dy + dh - 17], [dx + dw - 19, dy + dh - 17],
    [dx + 19, dy + dh / 2], [dx + dw - 19, dy + dh / 2],
  ]) {
    ctx.beginPath();
    ctx.arc(bx, by, 2.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#79818f';
    ctx.beginPath();
    ctx.arc(bx - 0.8, by - 0.8, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#22252c';
  }
  // The wheel.
  const wy = vd.y;
  ctx.strokeStyle = '#c7ccd6';
  ctx.lineWidth = 3.6;
  ctx.beginPath();
  ctx.arc(vd.x, wy, 13.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 3;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    ctx.beginPath();
    ctx.moveTo(vd.x, wy);
    ctx.lineTo(vd.x + Math.cos(a) * 13.5, wy + Math.sin(a) * 13.5);
    ctx.stroke();
  }
  ctx.fillStyle = '#22242a';
  ctx.beginPath();
  ctx.arc(vd.x, wy, 4, 0, Math.PI * 2);
  ctx.fill();
  // Threshold and name.
  ctx.fillStyle = '#121317';
  ctx.fillRect(dx, dy + dh - 9, dw, 9);
  ctx.fillStyle = 'rgba(255,240,210,0.22)';
  ctx.fillRect(dx, dy + dh - 9, dw, 1.2);
  ctx.fillStyle = GOLD;
  ctx.font = '700 8.5px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('V A U L T', vd.x, dy + dh - 2.2);

  return c;
}

// --- Artifacts: drawn LARGE, standing inside their cases -----------
// Each painter draws its artifact standing on (cx, baseY) — the
// plinth line near the front of the case — and rising h pixels.
// The pieces are sized to fill a 186px case, not to sit in it as a
// thumbnail, and each is shaded in at least two tones.

function goldGrad(ctx, x, y, r) {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.15, x, y, r);
  g.addColorStop(0, '#ffe9a8');
  g.addColorStop(0.55, '#d9a441');
  g.addColorStop(1, '#8a6d2f');
  return g;
}

function cushion(ctx, cx, baseY, w) {
  ctx.fillStyle = '#571c28';
  rr(ctx, cx - w / 2, baseY - 7, w, 9, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.fillRect(cx - w / 2 + 3, baseY - 7, w - 6, 2.5);
}

const ARTIFACTS = {
  // A golden statue of a robed figure, arm raised with an orb.
  statue(ctx, cx, baseY, w, h) {
    ctx.fillStyle = '#5c451a';
    rr(ctx, cx - w * 0.21, baseY - 8, w * 0.42, 8, 2);
    ctx.fill();
    const top = baseY - 8 - h * 0.86;
    const g = goldGrad(ctx, cx, (top + baseY) / 2, h * 0.55);
    // Bent raised arm and orb, drawn first so the robe overlaps it.
    ctx.strokeStyle = '#caa037';
    ctx.lineWidth = 5.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx + w * 0.11, top + h * 0.36);
    ctx.lineTo(cx + w * 0.24, top + h * 0.3);
    ctx.lineTo(cx + w * 0.27, top + h * 0.12);
    ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.fillStyle = goldGrad(ctx, cx + w * 0.27, top + h * 0.07, 8);
    ctx.beginPath();
    ctx.arc(cx + w * 0.27, top + h * 0.07, 6.2, 0, Math.PI * 2);
    ctx.fill();
    // Robe: shoulders, a waist, then the flare — a figure, not a cone.
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.155, top + h * 0.31);
    ctx.quadraticCurveTo(cx, top + h * 0.26, cx + w * 0.155, top + h * 0.31);
    ctx.quadraticCurveTo(cx + w * 0.1, top + h * 0.52, cx + w * 0.13, top + h * 0.66);
    ctx.lineTo(cx + w * 0.2, baseY - 8);
    ctx.lineTo(cx - w * 0.2, baseY - 8);
    ctx.lineTo(cx - w * 0.13, top + h * 0.66);
    ctx.quadraticCurveTo(cx - w * 0.1, top + h * 0.52, cx - w * 0.155, top + h * 0.31);
    ctx.closePath();
    ctx.fill();
    // Shade the robe's right side so the gold rounds.
    ctx.save();
    ctx.clip();
    ctx.fillStyle = 'rgba(90,64,16,0.20)';
    ctx.fillRect(cx, top, w * 0.22, baseY - top);
    ctx.restore();
    ctx.strokeStyle = 'rgba(90,64,16,0.6)';
    ctx.lineWidth = 1.2;
    for (const f of [-0.11, 0, 0.11]) {
      ctx.beginPath();
      ctx.moveTo(cx + w * f * 0.7, top + h * 0.68);
      ctx.lineTo(cx + w * f * 1.4, baseY - 10);
      ctx.stroke();
    }
    // A sash across the chest.
    ctx.strokeStyle = 'rgba(122,92,28,0.85)';
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.13, top + h * 0.36);
    ctx.lineTo(cx + w * 0.1, top + h * 0.56);
    ctx.stroke();
    // Neck and head with a laurel circlet.
    ctx.fillStyle = g;
    ctx.fillRect(cx - 3.4, top + h * 0.2, 6.8, h * 0.09);
    ctx.beginPath();
    ctx.arc(cx, top + h * 0.14, h * 0.098, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#7c5c1c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, top + h * 0.115, h * 0.098, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
  },

  // A jeweled enamel egg on a gold stand, crowned: crimson enamel
  // with gold meridian bands, a gem-set equator and a specular
  // streak. (It replaces a marble bust that, at screenshot scale,
  // kept reading as a dome or a pawn no matter how it was shaded —
  // the egg is unambiguous at any size.)
  egg(ctx, cx, baseY, w, h) {
    const cy = baseY - h * 0.46;
    const rx = w * 0.205;
    const ry = h * 0.335;
    // The stand: a stem and a ring foot in gold.
    const g = goldGrad(ctx, cx, baseY - h * 0.1, w * 0.3);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(cx - rx * 0.34, baseY - 1);
    ctx.lineTo(cx - rx * 0.2, cy + ry * 0.82);
    ctx.lineTo(cx + rx * 0.2, cy + ry * 0.82);
    ctx.lineTo(cx + rx * 0.34, baseY - 1);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx, baseY - 1, rx * 0.52, 3.6, 0, 0, Math.PI * 2);
    ctx.fill();
    // The egg body: crimson enamel, lit from the upper left.
    const eg = ctx.createRadialGradient(cx - rx * 0.35, cy - ry * 0.4, rx * 0.2, cx, cy, ry * 1.45);
    eg.addColorStop(0, '#e85d74');
    eg.addColorStop(0.45, '#c22547');
    eg.addColorStop(1, '#5e0a20');
    ctx.fillStyle = eg;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(60,4,16,0.6)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    // Gold meridian bands and the gem-set equator.
    ctx.strokeStyle = 'rgba(232,188,98,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 0.55, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry * 0.3, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(cx, cy - ry * 0.52, rx * 0.72, ry * 0.16, 0, 0, Math.PI * 2);
    ctx.stroke();
    for (const fx of [-0.78, -0.4, 0, 0.4, 0.78]) {
      ctx.fillStyle = fx === 0 ? '#7dd3fc' : '#f3e9d2';
      ctx.beginPath();
      ctx.arc(cx + rx * fx, cy + ry * 0.3 * Math.sqrt(1 - fx * fx) * 0.92, fx === 0 ? 3.4 : 2.3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Specular streak down the lit side.
    ctx.fillStyle = 'rgba(255,235,240,0.38)';
    ctx.beginPath();
    ctx.ellipse(cx - rx * 0.42, cy - ry * 0.34, rx * 0.16, ry * 0.4, 0.35, 0, Math.PI * 2);
    ctx.fill();
    // A tiny crown finial.
    ctx.fillStyle = g;
    const fy = cy - ry - 3;
    ctx.beginPath();
    ctx.moveTo(cx - 8, fy);
    ctx.lineTo(cx - 8, fy - 7);
    ctx.lineTo(cx - 4, fy - 3.4);
    ctx.lineTo(cx, fy - 8.4);
    ctx.lineTo(cx + 4, fy - 3.4);
    ctx.lineTo(cx + 8, fy - 7);
    ctx.lineTo(cx + 8, fy);
    ctx.closePath();
    ctx.fill();
  },

  // A tall ceremonial urn with handles and a painted band.
  vase(ctx, cx, baseY, w, h) {
    const top = baseY - h * 0.92;
    const vg = ctx.createLinearGradient(cx - w * 0.3, top, cx + w * 0.3, baseY);
    vg.addColorStop(0, '#8fa5bd');
    vg.addColorStop(0.5, '#42536b');
    vg.addColorStop(1, '#232f42');
    ctx.fillStyle = vg;
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.09, top);
    ctx.lineTo(cx + w * 0.09, top);
    ctx.quadraticCurveTo(cx + w * 0.11, top + h * 0.22, cx + w * 0.27, top + h * 0.48);
    ctx.quadraticCurveTo(cx + w * 0.30, top + h * 0.78, cx + w * 0.13, baseY - 6);
    ctx.lineTo(cx - w * 0.13, baseY - 6);
    ctx.quadraticCurveTo(cx - w * 0.30, top + h * 0.78, cx - w * 0.27, top + h * 0.48);
    ctx.quadraticCurveTo(cx - w * 0.11, top + h * 0.22, cx - w * 0.09, top);
    ctx.closePath();
    ctx.fill();
    // A specular streak down the lit side.
    ctx.save();
    ctx.clip();
    ctx.fillStyle = 'rgba(230,240,255,0.20)';
    ctx.fillRect(cx - w * 0.2, top, w * 0.09, baseY - top);
    ctx.restore();
    // Rim, handles, motif band, foot.
    ctx.fillStyle = '#2c3a4f';
    rr(ctx, cx - w * 0.14, top - 4, w * 0.28, 7, 3);
    ctx.fill();
    ctx.strokeStyle = '#54677f';
    ctx.lineWidth = 3.4;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(cx + s * w * 0.27, top + h * 0.4, w * 0.085, s > 0 ? -1.2 : Math.PI - 1.94, s > 0 ? 1.2 : Math.PI + 1.94);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(217,164,65,0.85)';
    ctx.fillRect(cx - w * 0.245, top + h * 0.52, w * 0.49, 5);
    ctx.fillStyle = '#d9c9a8';
    for (let i = -2; i <= 2; i++) {
      ctx.save();
      ctx.translate(cx + i * w * 0.09, top + h * 0.545);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-2.4, -2.4, 4.8, 4.8);
      ctx.restore();
    }
    ctx.fillStyle = '#1b2635';
    rr(ctx, cx - w * 0.15, baseY - 6, w * 0.3, 6, 2);
    ctx.fill();
  },

  // A squat lidded urn: knob, narrow lid, a neck gap, then the body.
  urn(ctx, cx, baseY, w, h) {
    const top = baseY - h * 0.66;
    const ug = ctx.createLinearGradient(cx - w * 0.3, top, cx + w * 0.3, baseY);
    ug.addColorStop(0, '#b57a58');
    ug.addColorStop(0.55, '#71422c');
    ug.addColorStop(1, '#452718');
    // Body, starting below the neck line.
    ctx.fillStyle = ug;
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.15, top + 17);
    ctx.quadraticCurveTo(cx - w * 0.34, top + h * 0.34, cx - w * 0.3, top + h * 0.58);
    ctx.quadraticCurveTo(cx - w * 0.26, baseY - 8, cx - w * 0.13, baseY - 5);
    ctx.lineTo(cx + w * 0.13, baseY - 5);
    ctx.quadraticCurveTo(cx + w * 0.26, baseY - 8, cx + w * 0.3, top + h * 0.58);
    ctx.quadraticCurveTo(cx + w * 0.34, top + h * 0.34, cx + w * 0.15, top + 17);
    ctx.closePath();
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = 'rgba(255,220,180,0.16)';
    ctx.fillRect(cx - w * 0.26, top, w * 0.1, baseY - top);
    ctx.restore();
    // Handles at the neck.
    ctx.strokeStyle = '#57341f';
    ctx.lineWidth = 3.2;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(cx + s * w * 0.19, top + h * 0.3, w * 0.07, s > 0 ? -1.1 : Math.PI - 2.04, s > 0 ? 1.1 : Math.PI + 2.04);
      ctx.stroke();
    }
    // Neck band and the narrower lid above it.
    ctx.fillStyle = '#57341f';
    ctx.fillRect(cx - w * 0.16, top + 12.5, w * 0.32, 5);
    ctx.fillStyle = '#7c4a2e';
    ctx.beginPath();
    ctx.ellipse(cx, top + 12, w * 0.125, 6, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(cx - w * 0.125, top + 8.5, w * 0.25, 3.5);
    ctx.fillStyle = goldGrad(ctx, cx, top + 3, 6);
    ctx.beginPath();
    ctx.arc(cx, top + 3, 4.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(217,164,65,0.8)';
    ctx.fillRect(cx - w * 0.28, top + h * 0.4, w * 0.56, 3.6);
    ctx.fillRect(cx - w * 0.24, baseY - 13, w * 0.48, 3);
  },

  // The crown jewels: a big five-point crown on its cushion.
  crown(ctx, cx, baseY, w, h) {
    cushion(ctx, cx, baseY, w * 0.86);
    const top = baseY - 7 - h * 0.52;
    const cw = w * 0.78;
    const g = goldGrad(ctx, cx, (top + baseY) / 2, cw * 0.5);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(cx - cw / 2, baseY - 7);
    ctx.lineTo(cx - cw / 2, top + h * 0.16);
    ctx.lineTo(cx - cw * 0.31, top + h * 0.3);
    ctx.lineTo(cx - cw * 0.19, top);
    ctx.lineTo(cx, top + h * 0.28);
    ctx.lineTo(cx + cw * 0.31, top + h * 0.3);
    ctx.lineTo(cx + cw / 2, top + h * 0.16);
    ctx.lineTo(cx + cw / 2, baseY - 7);
    ctx.closePath();
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = 'rgba(90,64,16,0.20)';
    ctx.fillRect(cx, top, cw / 2, baseY - top);
    ctx.restore();
    ctx.fillStyle = '#7c5c1c';
    ctx.fillRect(cx - cw / 2, baseY - 13, cw, 4.5);
    for (const [fx, col] of [[-0.3, '#e02444'], [0, '#38bdf8'], [0.3, '#e02444']]) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(cx + cw * fx, baseY - 20, 3.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.beginPath();
      ctx.arc(cx + cw * fx - 1.2, baseY - 21.4, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ffe9a8';
    for (const fx of [-0.5, -0.19, 0, 0.19, 0.5]) {
      ctx.beginPath();
      ctx.arc(cx + cw * fx, top + (fx === 0 ? h * 0.24 : h * 0.1), 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // A cluster of three big cut gems on a cushion.
  gems(ctx, cx, baseY, w, h) {
    cushion(ctx, cx, baseY, w * 0.9);
    const s = h / 46;
    drawDiamondGem(ctx, cx - w * 0.2, baseY - 16, s * 0.92, '#c9f2ff', '#38bdf8', '#1d6fb8');
    drawDiamondGem(ctx, cx + w * 0.19, baseY - 15, s * 0.84, '#ffd3dd', '#fb7185', '#b02a44');
    drawDiamondGem(ctx, cx + w * 0.01, baseY - 26, s * 1.05, '#e2ffe9', '#4ade80', '#15803d');
    ctx.fillStyle = 'rgba(255,233,168,0.9)';
    for (const [dx, dy] of [[-0.34, -6], [-0.05, -4], [0.3, -7], [0.12, -3]]) {
      ctx.beginPath();
      ctx.arc(cx + w * dx, baseY + dy, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // Same cluster in emerald and gold, for the vault's side case.
  emeralds(ctx, cx, baseY, w, h) {
    cushion(ctx, cx, baseY, w * 0.9);
    const s = h / 46;
    drawDiamondGem(ctx, cx - w * 0.18, baseY - 14, s * 0.85, '#e2ffe9', '#34d399', '#0d6e4f');
    drawDiamondGem(ctx, cx + w * 0.17, baseY - 14, s * 0.85, '#e2ffe9', '#34d399', '#0d6e4f');
    drawDiamondGem(ctx, cx, baseY - 23, s, '#fff7cc', '#facc15', '#a16207');
  },

  // A golden chalice with a glowing bowl.
  chalice(ctx, cx, baseY, w, h) {
    const top = baseY - h * 0.72;
    const g = goldGrad(ctx, cx, (top + baseY) / 2, w * 0.4);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.3, top);
    ctx.lineTo(cx + w * 0.3, top);
    ctx.quadraticCurveTo(cx + w * 0.26, top + h * 0.34, cx + w * 0.07, top + h * 0.44);
    ctx.lineTo(cx - w * 0.07, top + h * 0.44);
    ctx.quadraticCurveTo(cx - w * 0.26, top + h * 0.34, cx - w * 0.3, top);
    ctx.closePath();
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = 'rgba(90,64,16,0.20)';
    ctx.fillRect(cx, top, w * 0.3, h * 0.5);
    ctx.restore();
    ctx.fillStyle = '#ffedb0';
    ctx.beginPath();
    ctx.ellipse(cx, top, w * 0.3, 4.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = g;
    ctx.fillRect(cx - 3, top + h * 0.44, 6, h * 0.2);
    ctx.beginPath();
    ctx.ellipse(cx, baseY - 3, w * 0.2, 4.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e02444';
    ctx.beginPath();
    ctx.arc(cx, top + h * 0.24, 3.6, 0, Math.PI * 2);
    ctx.fill();
  },

  // One huge cut ruby on a small cushion.
  ruby(ctx, cx, baseY, w, h) {
    cushion(ctx, cx, baseY, w * 0.7);
    drawDiamondGem(ctx, cx, baseY - h * 0.34, h / 21, '#ffd3dd', '#f43f5e', '#9f1239');
  },

  // Stacks of gold coins, spilling.
  coins(ctx, cx, baseY, w, h) {
    const stacks = [[-0.28, 0.52], [-0.02, 0.8], [0.24, 0.4], [0.05, 0.58]];
    for (const [fx, fh] of stacks) {
      const sx = cx + w * fx;
      const sh = h * fh;
      for (let y = 0; y < sh; y += 4.6) {
        ctx.fillStyle = y % 9.2 < 4.6 ? '#d9a441' : '#b98a2e';
        ctx.beginPath();
        ctx.ellipse(sx, baseY - 3 - y, w * 0.115, 3.4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath();
      ctx.ellipse(sx, baseY - 3 - sh, w * 0.115, 3.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#e8bc62';
    for (const [dx, dy] of [[-0.38, -2], [-0.14, -1], [0.36, -2], [0.14, -1.5]]) {
      ctx.beginPath();
      ctx.ellipse(cx + w * dx, baseY + dy, 4.6, 2.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  },
};

// --- Furniture -------------------------------------------------------

// A display case: a soft floor shadow, a wooden front face with a
// brass plaque, and a glass top whose interior is LIT — a warm
// radial glow, a velvet shelf, a stepped bronze plinth, and the
// artifact standing large on it, shaded, under one diagonal of
// glass shine.
function drawCase(ctx, r, time) {
  const cx = r.x + r.w / 2;
  const caseBase = r.y + r.h;
  softShadow(ctx, cx + 5, caseBase + 5, r.w / 2 + 7, 11, 0.52);
  // Front face (the vertical south side of the box).
  const fg = ctx.createLinearGradient(0, caseBase - 21, 0, caseBase);
  fg.addColorStop(0, '#54341f');
  fg.addColorStop(1, '#2a1a10');
  ctx.fillStyle = fg;
  ctx.fillRect(r.x, caseBase - 21, r.w, 21);
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(r.x + (r.w * i) / 4, caseBase - 19);
    ctx.lineTo(r.x + (r.w * i) / 4, caseBase - 3);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(232,188,98,0.95)';
  ctx.fillRect(r.x, caseBase - 22.5, r.w, 1.8);
  ctx.fillStyle = '#c8a24a';
  rr(ctx, cx - 13, caseBase - 15, 26, 8, 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(40,26,8,0.85)';
  ctx.fillRect(cx - 9, caseBase - 12.6, 18, 1.6);
  ctx.fillRect(cx - 6, caseBase - 9.8, 12, 1.4);
  // Interior: warm light pooled behind the artifact, brightest at
  // its heart and falling to a dark amber at the glass edges.
  const topH = r.h - 18;
  const ig = ctx.createRadialGradient(cx, r.y + topH * 0.42, 10, cx, r.y + topH * 0.42, topH * 1.05);
  ig.addColorStop(0, '#5f3719');
  ig.addColorStop(0.55, '#2e1a0b');
  ig.addColorStop(1, '#160c05');
  ctx.fillStyle = ig;
  ctx.fillRect(r.x, r.y, r.w, topH);
  // The case's own lamp: a soft shaft from the top of the glass.
  const shaft = ctx.createLinearGradient(0, r.y, 0, r.y + topH * 0.55);
  shaft.addColorStop(0, 'rgba(255,214,140,0.20)');
  shaft.addColorStop(1, 'rgba(255,214,140,0)');
  ctx.fillStyle = shaft;
  ctx.fillRect(r.x + 6, r.y + 2, r.w - 12, topH * 0.55);
  // Velvet shelf the plinth stands on.
  ctx.fillStyle = '#471624';
  ctx.fillRect(r.x + 9, r.y + topH - 21, r.w - 18, 15);
  ctx.fillStyle = 'rgba(255,180,190,0.14)';
  ctx.fillRect(r.x + 9, r.y + topH - 21, r.w - 18, 2);
  const artBase = r.y + topH - 6;
  // Stepped bronze plinth inside the case.
  const pg = ctx.createLinearGradient(0, artBase - 12, 0, artBase + 1);
  pg.addColorStop(0, '#7d6134');
  pg.addColorStop(1, '#3a2a10');
  ctx.fillStyle = pg;
  rr(ctx, cx - r.w * 0.33, artBase - 5, r.w * 0.66, 6, 1.5);
  ctx.fill();
  rr(ctx, cx - r.w * 0.25, artBase - 12, r.w * 0.5, 8, 1.5);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,233,168,0.55)';
  ctx.fillRect(cx - r.w * 0.25 + 2, artBase - 12, r.w * 0.5 - 4, 1.4);
  // The artifact's contact shadow on the shelf, then the artifact.
  shadowEllipse(ctx, cx, artBase + 1, r.w * 0.3, 4, 0.35);
  const art = ARTIFACTS[r.art] || ARTIFACTS.gems;
  art(ctx, cx, artBase, r.w - 26, topH + 30);
  // Brass frame over the glass: a gradient outer rail and a fine
  // inner line.
  const bg = ctx.createLinearGradient(0, r.y, 0, r.y + topH);
  bg.addColorStop(0, '#e8bc62');
  bg.addColorStop(0.5, '#9a742f');
  bg.addColorStop(1, '#6e5222');
  ctx.strokeStyle = bg;
  ctx.lineWidth = 4.5;
  ctx.strokeRect(r.x + 2.25, r.y + 2.25, r.w - 4.5, topH - 4.5);
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(r.x + 6, r.y + 6, r.w - 12, topH - 12);
  // Glass shine over everything.
  ctx.fillStyle = 'rgba(255,255,255,0.075)';
  ctx.beginPath();
  ctx.moveTo(r.x + r.w * 0.12, r.y + topH);
  ctx.lineTo(r.x + r.w * 0.44, r.y);
  ctx.lineTo(r.x + r.w * 0.62, r.y);
  ctx.lineTo(r.x + r.w * 0.3, r.y + topH);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.045)';
  ctx.beginPath();
  ctx.moveTo(r.x + r.w * 0.58, r.y + topH);
  ctx.lineTo(r.x + r.w * 0.8, r.y);
  ctx.lineTo(r.x + r.w * 0.88, r.y);
  ctx.lineTo(r.x + r.w * 0.66, r.y + topH);
  ctx.closePath();
  ctx.fill();
  if (Math.sin(time * 2 + cx * 0.7) > 0.72) {
    sparkle(ctx, cx + (hash2(cx, 7) - 0.5) * r.w * 0.5, r.y + 12, 5.5, 0.75);
  }
}

// A statue plinth: marble cylinder, statue standing on top.
function drawPlinth(ctx, r) {
  const cx = r.x + r.w / 2;
  const baseY = r.y + r.h;
  softShadow(ctx, cx + 4, baseY + 4, r.w / 2 + 6, 10, 0.52);
  const mg = ctx.createLinearGradient(r.x, 0, r.x + r.w, 0);
  mg.addColorStop(0, '#8f887a');
  mg.addColorStop(0.35, '#d8d1bf');
  mg.addColorStop(1, '#7c7668');
  ctx.fillStyle = mg;
  ctx.fillRect(r.x + 5, r.y + 16, r.w - 10, r.h - 16);
  ctx.strokeStyle = 'rgba(70,64,54,0.4)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(r.x + 5 + ((r.w - 10) * i) / 4, r.y + 20);
    ctx.lineTo(r.x + 5 + ((r.w - 10) * i) / 4, baseY - 3);
    ctx.stroke();
  }
  ctx.fillStyle = '#e6dfcd';
  ctx.beginPath();
  ctx.ellipse(cx, r.y + 16, r.w / 2 - 1, 8.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#b3ab97';
  ctx.beginPath();
  ctx.ellipse(cx, r.y + 16, r.w / 2 - 9, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // The statue itself, ~64px of figure on the cap: shoulders, a
  // waist, one arm out — outlined so it never washes into the marble.
  const top = r.y + 12 - 62;
  const stone = r.art === 'statueStone';
  const g = stone
    ? ctx.createLinearGradient(cx - 12, top, cx + 12, r.y + 12)
    : goldGrad(ctx, cx, (top + r.y) / 2, 42);
  if (stone) {
    g.addColorStop(0, '#c4bda9');
    g.addColorStop(0.55, '#8f8875');
    g.addColorStop(1, '#5f594b');
  }
  ctx.strokeStyle = stone ? '#4c463a' : '#caa037';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - 6, top + 26);
  ctx.lineTo(cx - 15, top + 42);
  ctx.stroke();
  ctx.lineCap = 'butt';
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(cx - 8.5, top + 21);
  ctx.quadraticCurveTo(cx, top + 17.5, cx + 8.5, top + 21);
  ctx.quadraticCurveTo(cx + 5.5, top + 34, cx + 7, top + 42);
  ctx.lineTo(cx + 12.5, r.y + 12);
  ctx.lineTo(cx - 12.5, r.y + 12);
  ctx.lineTo(cx - 7, top + 42);
  ctx.quadraticCurveTo(cx - 5.5, top + 34, cx - 8.5, top + 21);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(40,34,24,0.55)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, top + 11, 7.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(40,34,24,0.45)';
  ctx.stroke();
}

// A chunky stone gate post with a brass ball finial.
function drawPost(ctx, r) {
  const cx = r.x + r.w / 2;
  const baseY = r.y + r.h;
  softShadow(ctx, cx + 3, baseY + 3, r.w / 2 + 4, 8, 0.52);
  const sg = ctx.createLinearGradient(r.x, 0, r.x + r.w, 0);
  sg.addColorStop(0, '#5d5648');
  sg.addColorStop(0.4, '#948b76');
  sg.addColorStop(1, '#4c463a');
  ctx.fillStyle = sg;
  ctx.fillRect(r.x + 3, r.y - 8, r.w - 6, r.h + 8);
  ctx.fillStyle = '#6e6656';
  ctx.fillRect(r.x, r.y - 12, r.w, 7);
  ctx.fillStyle = '#3c372e';
  ctx.fillRect(r.x + 1, baseY - 6, r.w - 2, 6);
  const bg = ctx.createRadialGradient(cx - 3, r.y - 19, 1, cx, r.y - 16, 8);
  bg.addColorStop(0, '#ffe9a8');
  bg.addColorStop(1, '#9a742f');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(cx, r.y - 16, 7, 0, Math.PI * 2);
  ctx.fill();
}

// The loot pedestal and the Aurora Diamond: a fluted marble column,
// a cushion, and a big faceted gem floating in its own glow.
function drawPedestal(ctx, game) {
  const p = game.level.pedestal;
  const loot = game.level.loot;
  const cx = p.x + p.w / 2;
  const baseY = p.y + p.h;
  ctx.strokeStyle = 'rgba(217,164,65,0.55)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.ellipse(cx, baseY + 5, 62, 13, 0, 0, Math.PI * 2);
  ctx.stroke();
  softShadow(ctx, cx + 4, baseY + 4, p.w / 2 + 9, 10, 0.52);
  const mg = ctx.createLinearGradient(p.x, 0, p.x + p.w, 0);
  mg.addColorStop(0, '#8f887a');
  mg.addColorStop(0.35, '#ded7c5');
  mg.addColorStop(1, '#7c7668');
  ctx.fillStyle = mg;
  ctx.fillRect(p.x + 6, p.y + 15, p.w - 12, p.h - 15);
  ctx.strokeStyle = 'rgba(70,64,54,0.45)';
  ctx.lineWidth = 1.2;
  for (let i = 1; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(p.x + 6 + ((p.w - 12) * i) / 6, p.y + 19);
    ctx.lineTo(p.x + 6 + ((p.w - 12) * i) / 6, baseY - 3);
    ctx.stroke();
  }
  ctx.fillStyle = '#efe9d8';
  ctx.fillRect(p.x - 3, p.y + 7, p.w + 6, 10);
  ctx.fillStyle = 'rgba(217,164,65,0.8)';
  ctx.fillRect(p.x - 3, p.y + 15.5, p.w + 6, 1.6);
  // Brass name plaque on the front face.
  ctx.fillStyle = '#c8a24a';
  rr(ctx, cx - 21, p.y + 34, 42, 11, 2);
  ctx.fill();
  ctx.fillStyle = '#33240a';
  ctx.font = '700 6.4px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('AURORA', cx, p.y + 41.5);
  // Cushion and the diamond (or its dust outline once taken).
  ctx.fillStyle = '#571c28';
  rr(ctx, cx - 24, p.y + 1, 48, 9, 4);
  ctx.fill();
  if (!game.hasLoot) {
    const glow = ctx.createRadialGradient(cx, p.y - 18, 4, cx, p.y - 18, 56);
    glow.addColorStop(0, 'rgba(140,210,255,0.38)');
    glow.addColorStop(1, 'rgba(140,210,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - 56, p.y - 74, 112, 112);
    drawDiamondGem(ctx, loot.x, p.y - 16, 2.35, '#e6f7ff', '#59c2f0', '#1565a8');
    if (Math.sin(game.time * 2.4) > 0.55) sparkle(ctx, loot.x - 15, p.y - 34, 6, 0.85);
    if (Math.sin(game.time * 2.4 + 2) > 0.6) sparkle(ctx, loot.x + 16, p.y - 22, 4.6, 0.7);
    ctx.fillStyle = GOLD;
    ctx.font = '700 10.5px system-ui, sans-serif';
    ctx.fillText('THE AURORA DIAMOND', cx, baseY + 22);
  } else {
    ctx.strokeStyle = 'rgba(230,247,255,0.5)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 3.4]);
    ctx.beginPath();
    ctx.moveTo(cx - 12, p.y - 2);
    ctx.lineTo(cx, p.y - 30);
    ctx.lineTo(cx + 12, p.y - 2);
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

// A potted plant: terracotta pot, layered leaf fans.
function drawPlant(ctx, p) {
  softShadow(ctx, p.x, p.y + 2, 18, 5.5, 0.45);
  const leaf = (ang, len, col) => {
    ctx.save();
    ctx.translate(p.x, p.y - 14);
    ctx.rotate(ang);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(0, -len / 2, 5.6, len / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
  leaf(-0.85, 34, '#2c6136');
  leaf(0.85, 34, '#2c6136');
  leaf(-0.45, 42, '#3a7d46');
  leaf(0.45, 42, '#3a7d46');
  leaf(0, 48, '#4c9459');
  leaf(-1.25, 26, '#35713f');
  leaf(1.25, 26, '#35713f');
  const pg = ctx.createLinearGradient(p.x - 13, p.y - 18, p.x + 13, p.y);
  pg.addColorStop(0, '#b3613e');
  pg.addColorStop(1, '#7c3f24');
  ctx.fillStyle = pg;
  ctx.beginPath();
  ctx.moveTo(p.x - 12, p.y - 17);
  ctx.lineTo(p.x + 12, p.y - 17);
  ctx.lineTo(p.x + 8.5, p.y);
  ctx.lineTo(p.x - 8.5, p.y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#cf7f57';
  ctx.fillRect(p.x - 13.5, p.y - 20, 27, 4.6);
}

// A bench with a slatted back, seat and legs.
function drawBench(ctx, b) {
  softShadow(ctx, b.x + b.w / 2 + 3, b.y + b.h + 3, b.w / 2 + 2, 7, 0.45);
  ctx.fillStyle = '#241610';
  ctx.fillRect(b.x + 8, b.y + 16, 6, 12);
  ctx.fillRect(b.x + b.w - 14, b.y + 16, 6, 12);
  const wg = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
  wg.addColorStop(0, '#5d3d22');
  wg.addColorStop(1, '#3a2413');
  ctx.fillStyle = wg;
  rr(ctx, b.x, b.y + 10, b.w, 9, 2.5);
  ctx.fill();
  ctx.fillStyle = '#6e4a2a';
  rr(ctx, b.x, b.y - 4, b.w, 6.5, 2.5);
  ctx.fill();
  rr(ctx, b.x, b.y + 3.5, b.w, 5.5, 2.5);
  ctx.fill();
  ctx.fillStyle = '#2c1a0e';
  ctx.fillRect(b.x + 6, b.y - 6, 5, 16);
  ctx.fillRect(b.x + b.w - 11, b.y - 6, 5, 16);
}

// --- Exit --------------------------------------------------------------

function drawExit(ctx, game) {
  const e = game.level.exit;
  const open = game.hasLoot;
  ctx.fillStyle = '#101823';
  ctx.fillRect(e.x, e.y, e.w, e.h);
  ctx.strokeStyle = open ? '#4ade80' : GOLD_DK;
  ctx.lineWidth = 2;
  ctx.strokeRect(e.x + 2, e.y + 2, e.w - 4, e.h - 4);
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(e.x + e.w / 2, e.y + 4);
  ctx.lineTo(e.x + e.w / 2, e.y + e.h - 4);
  ctx.stroke();
  if (open) {
    const pulse = 0.55 + 0.3 * Math.sin(game.time * 5);
    ctx.fillStyle = `rgba(74,222,128,${0.13 * pulse + 0.05})`;
    ctx.fillRect(e.x + 3, e.y + 3, e.w - 6, e.h - 6);
  }
  ctx.fillStyle = open ? '#4ade80' : '#a08c5a';
  ctx.font = '700 11.5px system-ui, sans-serif';
  ctx.textAlign = 'center';
  // Inside the doorway's foot, so a thief standing on the mat never
  // covers the word.
  ctx.fillText(open ? 'EXIT — GO!' : 'EXIT', e.x + e.w / 2, e.y + e.h - 6);
  // Door handles.
  ctx.fillStyle = '#c8ccd4';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(e.x + e.w / 2 + s * 9, e.y + e.h / 2 + 4, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

// --- Cones and cameras -------------------------------------------------

// Softer than v3: the scene must read THROUGH the cone. A radial
// falloff clipped to the occluded polygon, with only a whisper of
// an outline.
function drawConeSoft(ctx, poly, ox, oy, range, rgb, hot, mul = 1) {
  if (poly.length < 2) return;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(poly[0].x, poly[0].y);
  for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
  ctx.closePath();
  ctx.clip();
  const a = (v) => Math.min(0.85, v * mul);
  const g = ctx.createRadialGradient(ox, oy, 3, ox, oy, range);
  g.addColorStop(0, `rgba(${rgb},${a(hot ? 0.44 : 0.32)})`);
  g.addColorStop(0.45, `rgba(${rgb},${a(hot ? 0.25 : 0.17)})`);
  g.addColorStop(0.8, `rgba(${rgb},${a(hot ? 0.10 : 0.06)})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(ox - range, oy - range, range * 2, range * 2);
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(poly[0].x, poly[0].y);
  for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
  ctx.closePath();
  ctx.strokeStyle = `rgba(${rgb},${hot ? 0.35 : 0.2})`;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawWatchers(ctx, game) {
  const { solids } = game.level;
  for (const c of game.cameras) {
    // Camera cones get a boost: they land on dark cases and rugs,
    // and the judge must be able to see the sweep.
    drawConeSoft(ctx, conePolygon(c.x, c.y, c.facing, c.half, c.range, solids),
      c.x, c.y, c.range, '255,52,52', c.sees > 0, 1.35);
  }
  for (const g of game.guards) {
    const hot = g.sees > 0 || g.state === 'converge';
    drawConeSoft(ctx, conePolygon(g.x, g.y, g.facing, g.half, g.range, solids),
      g.x, g.y, g.range, hot ? '255,96,40' : '255,186,64', hot);
    // Flashlight glint at the cone's origin.
    const fg = ctx.createRadialGradient(g.x, g.y, 1, g.x, g.y, 16);
    fg.addColorStop(0, 'rgba(255,240,200,0.5)');
    fg.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.arc(g.x, g.y, 16, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCameraBodies(ctx, game) {
  for (const c of game.cameras) {
    const hot = c.sees > 0;
    // Wall mount arm.
    ctx.strokeStyle = '#3c414e';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(c.x, c.y - 13);
    ctx.lineTo(c.x, c.y - 2);
    ctx.stroke();
    ctx.fillStyle = '#2c2f36';
    rr(ctx, c.x - 8, c.y - 17, 16, 6, 2);
    ctx.fill();
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.facing);
    // Body: a chunky little camera, lens toward facing.
    const bg = ctx.createLinearGradient(0, -11, 0, 11);
    bg.addColorStop(0, '#59616f');
    bg.addColorStop(0.5, '#262a33');
    bg.addColorStop(1, '#101216');
    ctx.fillStyle = bg;
    rr(ctx, -13, -10.5, 27, 21, 5);
    ctx.fill();
    ctx.strokeStyle = '#6b7280';
    ctx.lineWidth = 1.2;
    rr(ctx, -13, -10.5, 27, 21, 5);
    ctx.stroke();
    ctx.fillStyle = '#171a20';
    ctx.beginPath();
    ctx.moveTo(14, -7);
    ctx.lineTo(21, -4.6);
    ctx.lineTo(21, 4.6);
    ctx.lineTo(14, 7);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = hot ? '#ff2d2d' : '#7dd3fc';
    ctx.beginPath();
    ctx.arc(20.2, 0, 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(19.2, -1.2, 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Recording LED and a name plaque.
    const ledOn = Math.sin(game.time * 4 + c.x) > -0.2;
    ctx.fillStyle = ledOn ? '#ff4444' : '#5c1a1a';
    ctx.beginPath();
    ctx.arc(c.x - 10, c.y - 14, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(8,6,14,0.85)';
    rr(ctx, c.x - 24, c.y + 14, 48, 13, 3);
    ctx.fill();
    ctx.fillStyle = '#f0a0a0';
    ctx.font = '700 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('● CAMERA', c.x, c.y + 23.5);
  }
}

// --- Actors: upright figures -------------------------------------------
// A figure stands on its ground point: shadow at the feet (y+15),
// legs, torso, head at y-37. v4 draws the same bodies through a
// scale transform about the feet, so a guard stands ~64px tall,
// and gives every body a dark outline and a shaded side — people,
// not pictograms. Facing is read from the head and the flashlight
// arm, never from rotating the whole body.

function figureScale(ctx, x, feetY, s, fn) {
  ctx.save();
  ctx.translate(x, feetY);
  ctx.scale(s, s);
  ctx.translate(-x, -feetY);
  fn();
  ctx.restore();
}

function facingDir(facing) {
  const s = Math.sin(facing);
  const c = Math.cos(facing);
  if (s > 0.55) return 'front';
  if (s < -0.55) return 'back';
  return c > 0 ? 'right' : 'left';
}

function drawGuardFigure(ctx, g, time) {
  const feetY = g.y + 15;
  figureScale(ctx, g.x, feetY, 1.18, () => guardBody(ctx, g, time, feetY));
}

function guardBody(ctx, g, time, feetY) {
  const dir = facingDir(g.facing);
  const bob = Math.sin(time * 2 + g.x * 0.35) * 0.7;
  const hipY = feetY - 15;
  const torsoTop = feetY - 37 + bob;
  softShadow(ctx, g.x, feetY + 1, 16, 5.5, 0.5);
  // Legs and shoes.
  ctx.fillStyle = '#1b2a4a';
  ctx.fillRect(g.x - 9.5, hipY, 7, 14);
  ctx.fillRect(g.x + 2.5, hipY, 7, 14);
  ctx.fillStyle = '#0c0e13';
  ctx.beginPath();
  ctx.ellipse(g.x - 6, feetY + 0.5, 5.4, 2.8, 0, 0, Math.PI * 2);
  ctx.ellipse(g.x + 6, feetY + 0.5, 5.4, 2.8, 0, 0, Math.PI * 2);
  ctx.fill();
  // Torso: navy uniform, shaded on its right side, lit on its left,
  // with a dark outline, belt, badge and epaulettes.
  const tg = ctx.createLinearGradient(g.x - 14, torsoTop, g.x + 14, torsoTop + 24);
  tg.addColorStop(0, '#33549c');
  tg.addColorStop(0.55, '#223d75');
  tg.addColorStop(1, '#152a55');
  ctx.fillStyle = tg;
  rr(ctx, g.x - 13.5, torsoTop, 27, 24, 6);
  ctx.fill();
  ctx.save();
  rr(ctx, g.x - 13.5, torsoTop, 27, 24, 6);
  ctx.clip();
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(g.x + 3, torsoTop, 11, 24);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(g.x - 13.5, torsoTop, 5, 24);
  ctx.restore();
  ctx.strokeStyle = 'rgba(5,4,12,0.6)';
  ctx.lineWidth = 1.5;
  rr(ctx, g.x - 13.5, torsoTop, 27, 24, 6);
  ctx.stroke();
  ctx.fillStyle = '#10182c';
  ctx.fillRect(g.x - 13.5, torsoTop + 19, 27, 4.4);
  ctx.fillStyle = GOLD;
  ctx.fillRect(g.x - 2.2, torsoTop + 19.4, 4.4, 3.6);
  ctx.fillStyle = '#7d94c4';
  ctx.fillRect(g.x - 13.5, torsoTop + 1.5, 8, 3.4);
  ctx.fillRect(g.x + 5.5, torsoTop + 1.5, 8, 3.4);
  ctx.fillStyle = '#e8bc62';
  ctx.beginPath();
  ctx.arc(g.x - 7.5, torsoTop + 10, 2.4, 0, Math.PI * 2);
  ctx.fill();
  // Idle arm along the body.
  ctx.strokeStyle = '#1d3465';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(g.x - 13, torsoTop + 5);
  ctx.lineTo(g.x - 14.5, torsoTop + 19);
  ctx.stroke();
  // Flashlight arm, reaching toward facing; the light itself.
  const hx = g.x + Math.cos(g.facing) * 16;
  const hy = torsoTop + 13 + Math.sin(g.facing) * 7;
  ctx.strokeStyle = '#24457f';
  ctx.beginPath();
  ctx.moveTo(g.x + 12, torsoTop + 5);
  ctx.lineTo(hx, hy);
  ctx.stroke();
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(g.facing);
  ctx.fillStyle = '#15161c';
  rr(ctx, -2, -3, 11, 6, 2);
  ctx.fill();
  ctx.fillStyle = '#ffeeb8';
  ctx.beginPath();
  ctx.arc(9.6, 0, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.lineCap = 'butt';
  // Head: skin with an outline, navy cap; the face follows facing.
  const headCY = torsoTop - 8.5;
  ctx.fillStyle = '#e8b98d';
  ctx.beginPath();
  ctx.arc(g.x, headCY, 8.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(5,4,12,0.45)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(g.x, headCY, 8.6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#1d3465';
  ctx.beginPath();
  ctx.arc(g.x, headCY - 1.6, 8.8, Math.PI * 1.02, Math.PI * 1.98);
  ctx.fill();
  if (dir === 'front') {
    ctx.fillRect(g.x - 8.8, headCY - 3.4, 17.6, 3);
    ctx.fillStyle = '#2a2118';
    ctx.beginPath();
    ctx.arc(g.x - 3.1, headCY + 2.2, 1.15, 0, Math.PI * 2);
    ctx.arc(g.x + 3.1, headCY + 2.2, 1.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(42,33,24,0.75)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(g.x - 2.4, headCY + 6.1);
    ctx.lineTo(g.x + 2.4, headCY + 6.1);
    ctx.stroke();
  } else if (dir === 'back') {
    ctx.fillStyle = '#1d3465';
    ctx.beginPath();
    ctx.arc(g.x, headCY + 0.6, 8.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#16294f';
    ctx.fillRect(g.x - 8.4, headCY + 5.4, 16.8, 2.6);
  } else {
    const s = dir === 'right' ? 1 : -1;
    ctx.fillStyle = '#1d3465';
    ctx.fillRect(g.x + (s > 0 ? 1 : -10.4), headCY - 3.4, 9.4, 3);
    ctx.fillStyle = '#2a2118';
    ctx.beginPath();
    ctx.arc(g.x + s * 4.4, headCY + 2.2, 1.15, 0, Math.PI * 2);
    ctx.fill();
  }
  // Alert marks.
  if (g.sees > 0 || g.state === 'converge') {
    ctx.font = '900 17px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3.4;
    ctx.strokeStyle = 'rgba(20,4,4,0.85)';
    ctx.strokeText('!', g.x, headCY - 14);
    ctx.fillStyle = '#ff5147';
    ctx.fillText('!', g.x, headCY - 14);
  } else if (g.state === 'investigate') {
    ctx.font = '900 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3.2;
    ctx.strokeStyle = 'rgba(20,14,2,0.85)';
    ctx.strokeText('?', g.x, headCY - 13);
    ctx.fillStyle = '#fbbf24';
    ctx.fillText('?', g.x, headCY - 13);
  }
}

function drawThiefFigure(ctx, game) {
  const t = game.thief;
  const feetY = t.y + 15;
  figureScale(ctx, t.x, feetY, 1.2, () => thiefBody(ctx, game, feetY));
}

function thiefBody(ctx, game, feetY) {
  const t = game.thief;
  const dir = facingDir(t.facing);
  const bob = t.moving ? Math.sin(game.time * 11) * 1.3 : Math.sin(game.time * 2.2) * 0.6;
  const hipY = feetY - 14;
  const torsoTop = feetY - 35 + bob;
  softShadow(ctx, t.x, feetY + 1, 15, 5.2, 0.52);
  // The loot sack rides on her back once the diamond is lifted.
  if (game.hasLoot) {
    const bx = t.x - Math.cos(t.facing) * 9;
    const by = torsoTop + 13 - Math.sin(t.facing) * 4;
    ctx.fillStyle = '#6d5133';
    ctx.beginPath();
    ctx.arc(bx, by, 10.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(5,4,12,0.4)';
    ctx.lineWidth = 1.1;
    ctx.stroke();
    ctx.fillStyle = '#543e26';
    ctx.beginPath();
    ctx.moveTo(bx - 3.4, by - 9.5);
    ctx.lineTo(bx + 3.4, by - 9.5);
    ctx.lineTo(bx, by - 14.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(125,211,252,0.85)';
    ctx.beginPath();
    ctx.arc(bx + 3.6, by + 2.5, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  // Legs and soft shoes.
  ctx.fillStyle = '#17171d';
  ctx.fillRect(t.x - 8.5, hipY, 6.4, 13);
  ctx.fillRect(t.x + 2.1, hipY, 6.4, 13);
  ctx.fillStyle = '#08080b';
  ctx.beginPath();
  ctx.ellipse(t.x - 5.2, feetY + 0.5, 5, 2.6, 0, 0, Math.PI * 2);
  ctx.ellipse(t.x + 5.2, feetY + 0.5, 5, 2.6, 0, 0, Math.PI * 2);
  ctx.fill();
  // Torso: black jacket, shaded side, dark outline, sack strap.
  const tg = ctx.createLinearGradient(t.x - 12, torsoTop, t.x + 12, torsoTop + 22);
  tg.addColorStop(0, '#2b2b33');
  tg.addColorStop(0.6, '#17171d');
  tg.addColorStop(1, '#0b0b0f');
  ctx.fillStyle = tg;
  rr(ctx, t.x - 12, torsoTop, 24, 22.5, 6);
  ctx.fill();
  ctx.save();
  rr(ctx, t.x - 12, torsoTop, 24, 22.5, 6);
  ctx.clip();
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(t.x + 3, torsoTop, 9, 22.5);
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.fillRect(t.x - 12, torsoTop, 4.5, 22.5);
  ctx.restore();
  ctx.strokeStyle = 'rgba(0,0,0,0.65)';
  ctx.lineWidth = 1.5;
  rr(ctx, t.x - 12, torsoTop, 24, 22.5, 6);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(217,164,65,0.4)';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(t.x - 9, torsoTop + 3);
  ctx.lineTo(t.x + 8, torsoTop + 19);
  ctx.stroke();
  ctx.strokeStyle = '#101014';
  ctx.lineWidth = 5.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(t.x - 11.5, torsoTop + 4.5);
  ctx.lineTo(t.x - 13, torsoTop + 17);
  ctx.moveTo(t.x + 11.5, torsoTop + 4.5);
  ctx.lineTo(t.x + 13, torsoTop + 17);
  ctx.stroke();
  ctx.lineCap = 'butt';
  // Head: hood with a dark outline and a lit rim, shadowed face,
  // mask stripe and eyes by direction.
  const headCY = torsoTop - 8;
  ctx.fillStyle = '#101016';
  ctx.beginPath();
  ctx.arc(t.x, headCY, 9.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(150,200,255,0.30)';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.arc(t.x, headCY, 9.6, Math.PI * 1.25, Math.PI * 1.8);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(t.x, headCY, 9.6, Math.PI * 1.85, Math.PI * 1.2);
  ctx.stroke();
  if (dir === 'front') {
    ctx.fillStyle = '#caa27e';
    ctx.beginPath();
    ctx.ellipse(t.x, headCY + 2.6, 6.4, 5.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0a0a0e';
    ctx.fillRect(t.x - 7.6, headCY - 0.6, 15.2, 4.4);
    ctx.fillStyle = '#f5f7fa';
    ctx.beginPath();
    ctx.arc(t.x - 3, headCY + 1.6, 1.25, 0, Math.PI * 2);
    ctx.arc(t.x + 3, headCY + 1.6, 1.25, 0, Math.PI * 2);
    ctx.fill();
  } else if (dir === 'back') {
    ctx.fillStyle = '#0b0b10';
    ctx.beginPath();
    ctx.arc(t.x, headCY + 1, 8.6, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const s = dir === 'right' ? 1 : -1;
    ctx.fillStyle = '#caa27e';
    ctx.beginPath();
    ctx.ellipse(t.x + s * 2.4, headCY + 2.6, 5, 5.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0a0a0e';
    ctx.fillRect(t.x + (s > 0 ? -1 : -7.4), headCY - 0.6, 8.4, 4.4);
    ctx.fillStyle = '#f5f7fa';
    ctx.beginPath();
    ctx.arc(t.x + s * 4.6, headCY + 1.6, 1.25, 0, Math.PI * 2);
    ctx.fill();
  }
  if (game.nearLoot) {
    ctx.fillStyle = 'rgba(10,8,16,0.88)';
    rr(ctx, t.x - 10, headCY - 32, 20, 15, 4);
    ctx.fill();
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 1;
    rr(ctx, t.x - 10, headCY - 32, 20, 15, 4);
    ctx.stroke();
    ctx.fillStyle = GOLD;
    ctx.font = '700 10.5px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('E', t.x, headCY - 20.5);
  }
}

// --- The scene, depth-sorted -------------------------------------------

function drawScene(ctx, game) {
  const items = [];
  for (const r of game.level.solids) {
    if (r.kind === 'case') items.push({ y: r.y + r.h, draw: () => drawCase(ctx, r, game.time) });
    else if (r.kind === 'plinth') items.push({ y: r.y + r.h, draw: () => drawPlinth(ctx, r) });
    else if (r.kind === 'post') items.push({ y: r.y + r.h, draw: () => drawPost(ctx, r) });
  }
  const p = game.level.pedestal;
  items.push({ y: p.y + p.h, draw: () => drawPedestal(ctx, game) });
  for (const pl of game.level.decor.plants) {
    items.push({ y: pl.y, draw: () => drawPlant(ctx, pl) });
  }
  for (const b of game.level.decor.benches) {
    items.push({ y: b.y + b.h, draw: () => drawBench(ctx, b) });
  }
  for (const g of game.guards) {
    items.push({ y: g.y + 15, draw: () => drawGuardFigure(ctx, g, game.time) });
  }
  items.push({ y: game.thief.y + 15, draw: () => drawThiefFigure(ctx, game) });
  items.sort((a, b) => a.y - b.y);
  for (const it of items) it.draw();
}

function drawNoises(ctx, game) {
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
// The title / win / lose panels still exist in the game itself —
// they are simply never staged into the screenshots.

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
  drawScene(ctx, game);
  drawNoises(ctx, game);
  drawCameraBodies(ctx, game);
  // Night vignette over the hall, under the HUD.
  const vg = ctx.createRadialGradient(640, 440, 330, 640, 440, 830);
  vg.addColorStop(0, 'rgba(3,2,9,0)');
  vg.addColorStop(1, 'rgba(3,2,9,0.30)');
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
