// level.js — the Velvet Vault floor plan, v3: a denser hall built for
// the 2.5D renderer. Cases are big furniture now (150x88) with room
// for artifacts that fill them, statue plinths stand in the open
// floor, and the vault gate is flanked by stone posts. Everything is
// plain data in canvas pixels (1280x800, HUD bar on top), built by
// buildLevel() so main.js and the shot stager share one plan.

export const VIEW_W = 1280;
export const VIEW_H = 800;
export const HUD_H = 64;

function rect(x, y, w, h, kind, art) {
  const r = { x, y, w, h, kind };
  if (art) r.art = art;
  return r;
}

export function buildLevel() {
  // Solid geometry the thief and guards collide with and that blocks
  // sight: walls, the vault shell, display cases, plinths, gate posts.
  const solids = [
    // Outer walls of the hall. The north wall is a full 40px band so
    // its painted face (panels, paintings, pilasters) is never walked
    // over by a sprite.
    rect(0, HUD_H, VIEW_W, 40, 'wall'),
    rect(0, 776, VIEW_W, 24, 'wall'),
    rect(0, HUD_H, 24, 736, 'wall'),
    rect(1256, HUD_H, 24, 736, 'wall'),
    // The vault chamber (top right): west wall with a side-passage
    // gap, south wall with a wide front opening guarded by two stone
    // gate posts, north and east walls.
    rect(724, 122, 488, 18, 'vault'),
    rect(1194, 140, 18, 266, 'vault'),
    rect(724, 140, 18, 100, 'vault'),
    rect(724, 288, 18, 118, 'vault'),
    rect(724, 388, 190, 18, 'vault'),
    rect(1022, 388, 190, 18, 'vault'),
    rect(888, 378, 30, 30, 'post'),
    rect(1018, 378, 30, 30, 'post'),
    // Display cases: glass-topped cover the thief can break sight
    // with. Each carries the artifact the renderer draws standing
    // large under its glass.
    rect(96, 176, 150, 88, 'case', 'statue'),
    rect(352, 124, 150, 84, 'case', 'bust'),
    rect(560, 176, 150, 88, 'case', 'vase'),
    rect(352, 268, 150, 88, 'case', 'crown'),
    rect(96, 452, 150, 88, 'case', 'gems'),
    rect(352, 530, 88, 140, 'case', 'mask'),
    rect(872, 560, 150, 88, 'case', 'chalice'),
    rect(1086, 430, 150, 88, 'case', 'urn'),
    rect(1086, 560, 150, 88, 'case', 'ruby'),
    // Two low wide cases inside the vault itself: cover for the most
    // dangerous ten seconds of the heist, the grab and the way out.
    rect(786, 292, 84, 56, 'case', 'coins'),
    rect(1066, 292, 84, 56, 'case', 'emeralds'),
    // Freestanding statue plinths in the open floor: marble cylinders
    // a statue stands on, tall enough to break a sight line.
    rect(180, 610, 58, 58, 'plinth', 'statueGold'),
    rect(790, 640, 58, 58, 'plinth', 'statueStone'),
  ];

  // Pure dressing, never solid: the renderer reads these to furnish
  // the hall — pilasters, paintings and sconces on the north wall
  // face, warm light pools on the marble, potted plants, benches
  // along the south wall, brass rope posts flanking the carpet, and
  // the round rug under the diamond pedestal.
  const decor = {
    pilastersTop: [120, 470, 790, 1120],
    paintings: [
      { x: 290, scene: 'landscape' },
      { x: 990, scene: 'seascape' },
    ],
    sconces: [200, 540, 860, 1180],
    lightPools: [
      { x: 320, y: 300, r: 250 },
      { x: 640, y: 230, r: 210 },
      { x: 250, y: 570, r: 210 },
      { x: 968, y: 255, r: 195 },
      { x: 980, y: 630, r: 230 },
      { x: 640, y: 580, r: 190 },
    ],
    plants: [
      { x: 56, y: 148 }, { x: 56, y: 724 },
      { x: 1216, y: 724 }, { x: 300, y: 730 }, { x: 500, y: 724 }, { x: 840, y: 730 },
      { x: 764, y: 360 }, { x: 1150, y: 360 },
    ],
    benches: [
      { x: 170, y: 738, w: 120, h: 28 },
      { x: 950, y: 738, w: 120, h: 28 },
    ],
    ropePostsY: [470, 580, 690],
    medallions: [
      { x: 430, y: 468, r: 50 },
      { x: 905, y: 478, r: 36 },
    ],
    vaultRug: { x: 968, y: 238, rx: 122, ry: 57 },
    vaultDoor: { x: 1096, y: 131 },
  };

  // Decorative floor dressing that is not solid: the burgundy carpet
  // runner from the entrance to the vault, and the vault's inner
  // floor.
  const carpet = rect(565, 406, 150, 370, 'carpet');
  const vaultFloor = rect(742, 140, 452, 248, 'vaultfloor');

  const guards = [
    {
      name: 'Hall patrol',
      route: [
        [300, 690], [540, 690], [540, 415], [300, 415],
      ],
      speed: 76,
    },
    {
      name: 'East patrol',
      route: [
        [1040, 470], [1040, 700],
      ],
      speed: 84,
    },
    {
      name: 'Vault patrol',
      route: [
        [820, 470], [1010, 470],
      ],
      speed: 80,
    },
  ];

  const cameras = [
    { x: 150, y: 102, base: 1.15, sweep: 0.62, speed: 0.55, phase: 0.0, range: 250, half: 0.46 },
    { x: 1148, y: 152, base: 2.82, sweep: 0.5, speed: 0.42, phase: 2.1, range: 250, half: 0.46 },
  ];

  return {
    solids,
    carpet,
    vaultFloor,
    decor,
    guards,
    cameras,
    spawn: { x: 640, y: 706 },
    exit: rect(577, 726, 126, 50, 'exit'),
    loot: { x: 968, y: 190, r: 16, name: 'The Aurora Diamond' },
    pedestal: rect(928, 182, 80, 64, 'pedestal'),
  };
}
