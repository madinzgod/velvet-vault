// level.js — the Velvet Vault floor plan: walls, display cases, patrol
// routes, camera mounts, the loot pedestal and the getaway door.
// Everything is plain data in canvas pixels (1280x800, HUD bar on top),
// built by buildLevel() so main.js and the shot stager share one plan.

export const VIEW_W = 1280;
export const VIEW_H = 800;
export const HUD_H = 64;

function rect(x, y, w, h, kind) {
  return { x, y, w, h, kind };
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
    rect(150, 300, 96, 54, 'case'),
    rect(150, 520, 96, 54, 'case'),
    rect(330, 190, 96, 54, 'case'),
    rect(330, 470, 54, 96, 'case'),
    rect(470, 300, 96, 54, 'case'),
    rect(520, 600, 96, 54, 'case'),
    rect(560, 180, 96, 54, 'case'),
    rect(880, 560, 96, 54, 'case'),
    rect(1064, 596, 96, 54, 'case'),
    // Two low plinths inside the vault itself: cover for the most
    // dangerous ten seconds of the heist, the grab and the way out.
    rect(800, 296, 64, 44, 'case'),
    rect(1072, 296, 64, 44, 'case'),
  ];

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
    guards,
    cameras,
    spawn: { x: 640, y: 706 },
    exit: rect(596, 724, 88, 50, 'exit'),
    loot: { x: 968, y: 216, r: 16, name: 'The Aurora Diamond' },
    pedestal: rect(940, 196, 56, 44, 'pedestal'),
  };
}
