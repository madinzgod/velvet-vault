// vision.js — sight geometry: ray casting against the level's solid
// rectangles, vision-cone polygons with real occlusion, and the
// line-of-sight test the alarm model uses. Pure functions, no state.

// Nearest hit distance of the ray (ox,oy)+t*(dx,dy) against one rect,
// or Infinity when the ray misses. Slab test; the rect's interior
// blocks sight, its faces stop the ray.
function rayRect(ox, oy, dx, dy, r) {
  let tmin = 0;
  let tmax = Infinity;
  if (Math.abs(dx) < 1e-9) {
    if (ox < r.x || ox > r.x + r.w) return Infinity;
  } else {
    let t1 = (r.x - ox) / dx;
    let t2 = (r.x + r.w - ox) / dx;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
  }
  if (Math.abs(dy) < 1e-9) {
    if (oy < r.y || oy > r.y + r.h) return Infinity;
  } else {
    let t1 = (r.y - oy) / dy;
    let t2 = (r.y + r.h - oy) / dy;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
  }
  if (tmax < tmin) return Infinity;
  return tmin;
}

export function rayDistance(ox, oy, angle, maxDist, solids) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let best = maxDist;
  for (const r of solids) {
    const t = rayRect(ox, oy, dx, dy, r);
    if (t < best) best = t;
  }
  return best;
}

// The visible polygon of a cone: a fan of rays across the arc, each
// stopped by the first solid it meets, so cases and walls carve real
// shadows out of the light.
export function conePolygon(x, y, facing, halfAngle, range, solids, steps = 38) {
  const pts = [{ x, y }];
  for (let i = 0; i <= steps; i++) {
    const a = facing - halfAngle + (2 * halfAngle * i) / steps;
    const d = rayDistance(x, y, a, range, solids);
    pts.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d });
  }
  return pts;
}

// Segment vs rect: does the straight line from (x1,y1) to (x2,y2)
// pass through the rect's interior?
function segmentHitsRect(x1, y1, x2, y2, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-9) return false;
  const t = rayRect(x1, y1, dx / dist, dy / dist, r);
  return t < dist - 1;
}

export function lineOfSight(x1, y1, x2, y2, solids) {
  for (const r of solids) {
    if (segmentHitsRect(x1, y1, x2, y2, r)) return false;
  }
  return true;
}

// How strongly a watcher sees the thief: 0 when out of range, out of
// arc or behind cover; otherwise a 0..1 intensity that grows as the
// thief gets closer to the watcher.
export function detection(watcher, thief, solids) {
  const dx = thief.x - watcher.x;
  const dy = thief.y - watcher.y;
  const dist = Math.hypot(dx, dy);
  if (dist > watcher.range) return 0;
  let diff = Math.atan2(dy, dx) - watcher.facing;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  if (Math.abs(diff) > watcher.half) return 0;
  if (!lineOfSight(watcher.x, watcher.y, thief.x, thief.y, solids)) return 0;
  const closeness = 1 - dist / watcher.range;
  const centred = 1 - Math.abs(diff) / watcher.half;
  return Math.min(1, 0.25 + closeness * 0.55 + centred * 0.35);
}
