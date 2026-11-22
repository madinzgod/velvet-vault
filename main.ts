// Velvet Vault — entry program for the make.fun best-heist-game
// bounty (Node 22, standard library only).
//
// The game itself is the static site in game/ (open game/index.html in
// a desktop browser; it plays fully offline). This program hands it
// in: it copies game/ and screenshots/ into the output directory and
// writes the judge's dossier there with buildDossier from the
// vendored make.fun library, capped exactly as the gate caps it.
//
//   MAKEFUN_OUTPUT_DIR=out node main.ts     # /output in the grader

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function countFiles(dir: string): number {
  let n = 0;
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    n += name.isDirectory() ? countFiles(join(dir, name.name)) : 1;
  }
  return n;
}

mkdirSync(outDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outDir, 'game'), { recursive: true });

const shotsFrom = join(repoRoot, 'screenshots');
const shotsTo = join(outDir, 'screenshots');
mkdirSync(shotsTo, { recursive: true });
if (existsSync(shotsFrom)) {
  // Mirror the gate's screenshot cap before copying: one image over
  // 256 KiB invalidates the whole entry, so fail loudly here instead.
  for (const name of readdirSync(shotsFrom)) {
    const bytes = statSync(join(shotsFrom, name)).size;
    if (bytes > 262144) throw new Error(`screenshot ${name} is ${bytes} bytes, over the 262144 cap`);
  }
  cpSync(shotsFrom, shotsTo, { recursive: true });
}

// The gate's own limits (see the competition's gate.json): the
// dossier text cap shapes the bytes; the rest refuse here what the
// scorer would refuse there — too many screenshots or one too heavy,
// too many game files or too many bytes in all.
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);

const gameFiles = countFiles(join(outDir, 'game'));
const shotFiles = existsSync(shotsTo) ? readdirSync(shotsTo).length : 0;
console.log(`velvet-vault: handed in ${gameFiles} game files and ${shotFiles} screenshots; dossier ${dossier.length} bytes`);
