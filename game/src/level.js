// level.js — the Velvet Vault floor plan, v4: fewer, BIGGER cases
// (186px wide instead of 150) so each artifact can stand large in a
// lit interior, area rugs under the side clusters, statue plinths
// filling the south band, and a vault chamber that sits on a raised
// platform. Everything is plain data in canvas pixels (1280x800,
// HUD bar on top), built by buildLevel() so main.js and the shot
// stager share one plan.

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
    // with. Eight big ones in the hall — each carries the artifact
    // the renderer draws standing large in its lit interior.
    rect(84, 168, 186, 104, 'case', 'statue'),
    rect(322, 146, 186, 104, 'case', 'crown'),
    rect(530, 168, 180, 104, 'case', 'vase'),
    rect(322, 296, 186, 104, 'case', 'egg'),
    rect(84, 478, 186, 104, 'case', 'gems'),
    rect(836, 548, 180, 104, 'case', 'chalice'),
    rect(1072, 404, 168, 104, 'case', 'urn'),
    rect(1072, 548, 168, 104, 'case', 'ruby'),
    // Two low wide cases inside the vault itself: cover for the most
    // dangerous ten seconds of the heist, the grab and the way out.
    rect(790, 296, 92, 60, 'case', 'coins'),
    rect(1054, 296, 92, 60, 'case', 'emeralds'),
    // Freestanding statue plinths in the open floor: marble cylinders
    // a statue stands on, tall enough to break a sight line. The
    // third one fills the south band between the carpet and the
    // west rug.
    rect(180, 618, 58, 58, 'plinth', 'statueGold'),
    rect(790, 640, 58, 58, 'plinth', 'statueStone'),
    rect(452, 684, 56, 56, 'plinth', 'statueGold'),
    rect(424, 548, 56, 56, 'plinth', 'statueStone'),
  ];

  // Pure dressing, never solid: the renderer reads these to furnish
  // the hall — pilasters, large paintings and sconces on the north
  // wall face, warm light pools on the marble, area rugs under the
  // case clusters, potted plants, benches along the south wall,
  // brass rope posts flanking the carpet, a brass floor inlay, the
  // vault's patterned carpet and its steel door.
  const decor = {
    pilastersTop: [120, 470, 790, 1120],
    paintings: [
      { x: 265, scene: 'landscape' },
      { x: 1015, scene: 'seascape' },
    ],
    sconces: [200, 540, 860, 1180],
    lightPools: [
      { x: 177, y: 292, r: 165 },
      { x: 415, y: 270, r: 165 },
      { x: 620, y: 292, r: 160 },
      { x: 415, y: 420, r: 150 },
      { x: 177, y: 602, r: 165 },
      { x: 926, y: 672, r: 160 },
      { x: 1156, y: 528, r: 150 },
      { x: 1156, y: 672, r: 150 },
      { x: 968, y: 272, r: 185 },
      { x: 640, y: 590, r: 200 },
    ],
    rugs: [
      { x: 58, y: 146, w: 246, h: 462 },
      { x: 824, y: 392, w: 428, h: 298 },
    ],
    plants: [
      { x: 56, y: 148 }, { x: 56, y: 724 },
      { x: 1216, y: 724 }, { x: 300, y: 730 }, { x: 500, y: 724 }, { x: 840, y: 730 },
      { x: 764, y: 360 }, { x: 1150, y: 360 },
      { x: 1228, y: 168 },
    ],
    benches: [
      { x: 170, y: 738, w: 120, h: 28 },
      { x: 950, y: 738, w: 120, h: 28 },
    ],
    ropePostsY: [470, 580, 690],
    floorInlay: { x: 42, y: 122, w: 1196, h: 636 },
    vaultCarpet: { x: 766, y: 166, w: 404, h: 196 },
    vaultDoor: { x: 1080, y: 137 },
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
    { x: 1168, y: 170, base: 2.82, sweep: 0.5, speed: 0.42, phase: 2.1, range: 250, half: 0.46 },
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
