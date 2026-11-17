// Deterministic screenshot scenes (?shot=start|play|late|end&seed=n).
// One job: set up a fixed, lively frame for each scene — no wall clock,
// no input, seeded RNG only — so screenshots are real renders of the game.
import { makeRand } from './random.js';
import { createWorld, startRun, nextWave } from './world.js';
import { ENEMIES } from './config.js';

function placeEnemies(w, list) {
  // list: [kind, angleDeg, dist]
  for (const [kind, ang, dist] of list) {
    const def = ENEMIES[kind];
    const a = (ang * Math.PI) / 180;
    const e = {
      kind, x: 640 + Math.cos(a) * dist, y: 360 + Math.sin(a) * dist,
      vx: 0, vy: 0, hp: def.hp * (kind === 'dreadlord' ? 1 : 1.6),
      maxHp: def.hp * (kind === 'dreadlord' ? 1 : 1.6),
      speed: def.speed, radius: def.radius, dmg: def.dmg,
      fireT: 1.5, t: ang, flash: 0, spawnT: 0,
    };
    if (kind === 'dreadlord') w.boss = e;
    w.enemies.push(e);
  }
}

function scatter(w, n, what) {
  for (let i = 0; i < n; i++) {
    const a = w.rand.range(0, Math.PI * 2);
    const d = w.rand.range(60, 320);
    const x = 640 + Math.cos(a) * d, y = 360 + Math.sin(a) * d;
    if (what === 'ember') {
      w.pickups.push({ x, y, vx: 0, vy: 0, value: 5, t: w.rand.range(0, 2) });
    } else if (what === 'spark') {
      w.particles.push({
        x, y, vx: w.rand.range(-120, 120), vy: w.rand.range(-120, 120),
        life: w.rand.range(0.3, 0.8), maxLife: 0.8,
        color: w.rand.pick(['#ffd166', '#ff8a3c', '#8b7ff0']), size: w.rand.range(2, 5),
      });
    }
  }
}

export function setupShot(scene, seed) {
  const rand = makeRand(seed || 7);
  const w = createWorld(rand);
  w.time = 12.5; // fixed simulated time: stable star twinkle + glow
  if (scene === 'start') {
    w.phase = 'title';
    w.best = 1240;
    return w;
  }
  if (scene === 'end') {
    startRun(w);
    w.wave = 7;
    w.score = 4860; w.kills = 132; w.embers = 85;
    w.stats = { shots: 640, hits: 402, earned: 930 };
    w.player.hp = 0; w.player.alive = false;
    w.phase = 'over';
    w.banner = ''; w.bannerT = 0;
    w.time = 40;
    placeEnemies(w, [['shade', 20, 200], ['wisp', 160, 260], ['brute', 300, 300]]);
    return w;
  }
  // play / late: a live combat frame.
  startRun(w);
  if (scene === 'late') {
    w.wave = 8;
    w.score = 9210; w.kills = 248; w.embers = 210;
    w.stats = { shots: 1500, hits: 980, earned: 2100 };
    const p = w.player;
    p.damage *= 1.25 ** 3; p.fireInterval *= 0.85 ** 3; p.projectiles = 3; p.pierce = 1;
    p.maxHp = 150; p.hp = 112; p.magnet *= 1.45 ** 2; p.speed *= 1.12;
    p.upgrades = { dmg: 3, rate: 3, multi: 2, pierce: 1, heart: 2, magnet: 2 };
    p.x = 560; p.y = 400; p.angle = -0.5;
    placeEnemies(w, [
      ['brute', 10, 240], ['brute', 200, 280], ['shade', 40, 180], ['shade', 90, 220],
      ['shade', 140, 160], ['shade', 250, 200], ['wisp', 70, 260], ['wisp', 300, 230],
      ['spitter', 170, 300], ['spitter', 330, 290],
    ]);
    // Player bolts mid-flight toward the pack.
    for (let i = 0; i < 7; i++) {
      const a = -0.5 + (i - 3) * 0.07;
      w.bullets.push({
        x: 590 + Math.cos(a) * (40 + i * 26), y: 395 + Math.sin(a) * (40 + i * 26),
        vx: Math.cos(a) * 560, vy: Math.sin(a) * 560,
        dmg: 20, radius: 5, pierce: 1, hitSet: new Set(),
      });
    }
    w.enemyBullets.push(
      { x: 700, y: 300, vx: -160, vy: 60, dmg: 8, radius: 7 },
      { x: 760, y: 420, vx: -170, vy: -40, dmg: 8, radius: 7 },
    );
    w.banner = 'WAVE 8';
    w.bannerT = 1.5;
  } else {
    // play: wave 3, early action, cover shot.
    w.wave = 3;
    w.score = 1240; w.kills = 41; w.embers = 55;
    w.stats = { shots: 210, hits: 130, earned: 260 };
    const p = w.player;
    p.x = 520; p.y = 380; p.angle = -0.35;
    p.damage *= 1.25; p.upgrades = { dmg: 1 };
    placeEnemies(w, [
      ['shade', 15, 210], ['shade', 75, 250], ['wisp', 130, 200],
      ['spitter', 190, 290], ['shade', 320, 240],
    ]);
    for (let i = 0; i < 4; i++) {
      const a = -0.35 + (i - 1.5) * 0.08;
      w.bullets.push({
        x: 545 + Math.cos(a) * (40 + i * 30), y: 375 + Math.sin(a) * (40 + i * 30),
        vx: Math.cos(a) * 560, vy: Math.sin(a) * 560,
        dmg: 15, radius: 5, pierce: 0, hitSet: new Set(),
      });
    }
    w.banner = 'WAVE 3';
    w.bannerT = 1.2;
  }
  scatter(w, 14, 'ember');
  scatter(w, 26, 'spark');
  // A few floaters for feedback.
  w.floaters.push(
    { x: 700, y: 300, text: '15', color: '#ffd166', life: 0.7, maxLife: 0.9 },
    { x: 760, y: 340, text: '+5', color: '#ffb347', life: 0.6, maxLife: 0.9 },
  );
  return w;
}
