// level.js — the Velvet Vault floor plan: walls, display cases, patrol
// routes, camera mounts, the loot pedestal and the getaway door.
// Everything is plain data in canvas pixels (1280x800, HUD bar on top),
// built by buildLevel() so main.js and the shot stager share one plan.

export const VIEW_W = 1280;
export const VIEW_H = 800;
export const HUD_H = 64;

function rect(x, y, w, h, kind, art) {
  const r = { x, y, w, h, kind };
  if (art) r.art = art;
  return r;
}

export function buildLevel() {
  // Solid geometry the thief and guards collide with and that blocks sight.
  const solids = [
    // Outer walls of the hall.
    rect(0, HUD_H, VIEW_W, 24, 'wall'),
    rect(0, 776, VIEW_W, 24, 'wall'),
    rect(0, HUD_H, 24, 736, 'wall'),
    rect(1256, HUD_H, 24, 736, 'wall'),
    // The vault chamber (top right): west wall with a side-passage gap,
    // south wall with a wide front opening, north and east walls.
    rect(724, 116, 18, 120, 'vault'),
    rect(724, 284, 18, 120, 'vault'),
    rect(724, 386, 192, 18, 'vault'),
    rect(1016, 386, 196, 18, 'vault'),
    rect(724, 116, 488, 18, 'vault'),
    rect(1194, 116, 18, 288, 'vault'),
    // Display cases: glass-topped cover the thief can break sight with.
    // Each carries the artifact the renderer draws under its glass.
    rect(150, 300, 96, 54, 'case', 'vase'),
    rect(150, 520, 96, 54, 'case', 'gems'),
    rect(330, 190, 96, 54, 'case', 'crown'),
    rect(330, 470, 54, 96, 'case', 'mask'),
    rect(470, 300, 96, 54, 'case', 'bust'),
    rect(520, 600, 96, 54, 'case', 'urn'),
    rect(560, 180, 96, 54, 'case', 'globe'),
    rect(880, 560, 96, 54, 'case', 'chalice'),
    rect(1064, 596, 96, 54, 'case', 'ruby'),
    rect(180, 150, 96, 54, 'case', 'easel'),
    rect(64, 640, 96, 54, 'case', 'mask'),
    // Two low plinths inside the vault itself: cover for the most
    // dangerous ten seconds of the heist, the grab and the way out.
    rect(800, 296, 64, 44, 'case', 'coins'),
    rect(1072, 296, 64, 44, 'case', 'vase'),
  ];

  // Pure dressing, never solid: the renderer reads these to furnish
  // the hall — pilasters and paintings on the north wall face, potted
  // plants in the corners, benches along the south wall, brass rope
  // posts flanking the carpet, and a marble inlay medallion.
  const decor = {
    pilastersTop: [86, 280, 474, 668],
    paintings: [
      { x: 196, scene: 'landscape' },
      { x: 390, scene: 'portrait' },
      { x: 584, scene: 'seascape' },
    ],
    vaultPaintings: [
      { x: 838, scene: 'portrait' },
      { x: 1028, scene: 'landscape' },
    ],
    plants: [
      { x: 56, y: 132 }, { x: 56, y: 716 },
      { x: 1204, y: 716 }, { x: 764, y: 360 }, { x: 1170, y: 360 },
    ],
    benches: [
      { x: 176, y: 736, w: 116, h: 26 },
      { x: 896, y: 736, w: 116, h: 26 },
    ],
    ropePosts: [428, 516, 604, 692],
    medallion: { x: 330, y: 382, r: 56 },
  };

  // Decorative floor dressing that is not solid: the burgundy carpet
  // runner from the entrance to the vault, and the vault's inner floor.
  const carpet = rect(588, 404, 104, 372, 'carpet');
  const vaultFloor = rect(742, 134, 452, 252, 'vaultfloor');

  const guards = [
    {
      name: 'Hall patrol',
      route: [
        [250, 668], [640, 668], [640, 420], [250, 420],
      ],
      speed: 76,
    },
    {
      name: 'East patrol',
      route: [
        [1030, 460], [1030, 690],
      ],
      speed: 84,
    },
    {
      name: 'Vault patrol',
      route: [
        [820, 470], [1120, 470],
      ],
      speed: 80,
    },
  ];

  const cameras = [
    { x: 128, y: 100, base: 1.15, sweep: 0.62, speed: 0.55, phase: 0.0, range: 250, half: 0.46 },
    { x: 968, y: 150, base: Math.PI / 2, sweep: 0.70, speed: 0.42, phase: 2.1, range: 245, half: 0.46 },
  ];

  return {
    solids,
    carpet,
    vaultFloor,
    decor,
    guards,
    cameras,
    spawn: { x: 640, y: 706 },
    exit: rect(596, 724, 88, 50, 'exit'),
    loot: { x: 968, y: 216, r: 16, name: 'The Aurora Diamond' },
    pedestal: rect(940, 196, 56, 44, 'pedestal'),
  };
}
