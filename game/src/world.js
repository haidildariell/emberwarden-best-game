// World: game state, waves, spawning, combat, economy, shop, boss.
// One job: simulation. No drawing, no DOM, no audio calls (returns events).
import { PLAYER_BASE, ENEMIES, UPGRADES, waveBudget, waveKinds, BOSS_WAVE, WIN_WAVE, upgradeCost } from './config.js';
import { liveRand } from './random.js';

export function createWorld(rand) {
  return {
    rand: rand || liveRand,
    phase: 'title', // title | play | shop | paused | over | win
    time: 0,
    wave: 0,
    score: 0,
    kills: 0,
    embers: 0,
    best: Number(localStorage.getItem('emberwarden-best') || 0),
    shake: 0,
    banner: '',
    bannerT: 0,
    spawnQueue: [],
    spawnT: 0,
    waveActive: false,
    boss: null,
    shop: [],
    shopBought: new Set(),
    player: null,
    bullets: [],
    enemyBullets: [],
    enemies: [],
    particles: [],
    pickups: [],
    floaters: [],
    stats: { shots: 0, hits: 0, earned: 0 },
    events: [], // consumed by main for sound
  };
}

export function newPlayer(x, y) {
  return {
    x, y, vx: 0, vy: 0, angle: -Math.PI / 2,
    hp: PLAYER_BASE.maxHp, ...PLAYER_BASE,
    regen: 0, fireT: 0, iframes: 0, alive: true,
    upgrades: {}, // id -> stacks
  };
}

export function startRun(w) {
  w.player = newPlayer(640, 360);
  w.bullets = []; w.enemyBullets = []; w.enemies = [];
  w.particles = []; w.pickups = []; w.floaters = [];
  w.score = 0; w.kills = 0; w.embers = 0; w.wave = 0;
  w.stats = { shots: 0, hits: 0, earned: 0 };
  w.phase = 'play';
  w.boss = null;
  nextWave(w);
}

function edgeSpawn(w) {
  const m = 30, r = w.rand;
  const side = r.int(0, 3);
  if (side === 0) return { x: r.range(m, 1280 - m), y: -m };
  if (side === 1) return { x: r.range(m, 1280 - m), y: 720 + m };
  if (side === 2) return { x: -m, y: r.range(m, 720 - m) };
  return { x: 1280 + m, y: r.range(m, 720 - m) };
}

export function nextWave(w) {
  w.wave++;
  w.waveActive = true;
  w.spawnQueue = [];
  const kinds = waveKinds(w.wave);
  let budget = waveBudget(w.wave);
  while (budget > 0) {
    const kind = w.rand.pick(kinds);
    const def = ENEMIES[kind];
    if (def.cost > budget) { budget--; continue; }
    w.spawnQueue.push(kind);
    budget -= def.cost;
  }
  // Shuffle the queue a little.
  for (let i = w.spawnQueue.length - 1; i > 0; i--) {
    const j = w.rand.int(0, i);
    [w.spawnQueue[i], w.spawnQueue[j]] = [w.spawnQueue[j], w.spawnQueue[i]];
  }
  w.spawnT = 0;
  if (w.wave === BOSS_WAVE) {
    w.banner = 'THE DREADLORD AWAKENS';
    w.events.push('boss');
  } else {
    w.banner = `WAVE ${w.wave}`;
    w.events.push('wave');
  }
  w.bannerT = 2.2;
}

function spawnEnemy(w, kind) {
  const def = ENEMIES[kind];
  const hpScale = 1 + (w.wave - 1) * 0.12;
  const p = edgeSpawn(w);
  const e = {
    kind, x: p.x, y: p.y, vx: 0, vy: 0,
    hp: def.hp * hpScale, maxHp: def.hp * hpScale,
    speed: def.speed * w.rand.range(0.9, 1.1),
    radius: def.radius, dmg: def.dmg,
    fireT: w.rand.range(1, 2.5), t: w.rand.range(0, 10),
    flash: 0, spawnT: 0.35,
  };
  w.enemies.push(e);
  if (kind === 'dreadlord') w.boss = e;
}

function spawnBoss(w) {
  const def = ENEMIES.dreadlord;
  const e = {
    kind: 'dreadlord', x: 640, y: -60, vx: 0, vy: 0,
    hp: def.hp, maxHp: def.hp, speed: def.speed,
    radius: def.radius, dmg: def.dmg,
    fireT: 2, t: 0, flash: 0, spawnT: 0.5, radialT: 3,
  };
  w.enemies.push(e);
  w.boss = e;
}

function burst(w, x, y, color, n, speed, size = 3, life = 0.5) {
  for (let i = 0; i < n; i++) {
    const a = w.rand.range(0, Math.PI * 2);
    const s = w.rand.range(speed * 0.3, speed);
    w.particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: w.rand.range(life * 0.5, life), maxLife: life,
      color, size: w.rand.range(size * 0.6, size * 1.4),
    });
  }
}

export function addFloater(w, x, y, text, color) {
  w.floaters.push({ x, y, text, color, life: 0.9, maxLife: 0.9 });
}

function damageEnemy(w, e, dmg, kx, ky) {
  e.hp -= dmg;
  e.flash = 0.08;
  addFloater(w, e.x, e.y - e.radius - 6, String(Math.round(dmg)), '#ffd166');
  if (e.hp <= 0) killEnemy(w, e);
  else w.events.push('hit');
}

function killEnemy(w, e) {
  e.dead = true;
  w.kills++;
  const def = ENEMIES[e.kind];
  const gain = def.score * (1 + (w.wave - 1) * 0.1);
  w.score += Math.round(gain);
  w.events.push('kill');
  w.shake = Math.min(10, w.shake + (e.kind === 'brute' ? 6 : 3));
  burst(w, e.x, e.y, def.color, e.kind === 'brute' ? 26 : 14, 220, 4, 0.6);
  burst(w, e.x, e.y, '#ffd166', 8, 160, 3, 0.4);
  // Ember drops: brutes drop more, boss drops a shower.
  const drops = e.kind === 'dreadlord' ? 14 : e.kind === 'brute' ? 5 : e.kind === 'spitter' ? 2 : 1;
  for (let i = 0; i < drops; i++) {
    w.pickups.push({
      x: e.x + w.rand.range(-14, 14), y: e.y + w.rand.range(-14, 14),
      vx: w.rand.range(-40, 40), vy: w.rand.range(-40, 40),
      value: e.kind === 'dreadlord' ? 15 : 5, t: 0,
    });
  }
  if (e.kind === 'dreadlord') {
    w.boss = null;
    w.events.push('win');
  }
}

function hurtPlayer(w, dmg, sx, sy) {
  const p = w.player;
  if (!p.alive || p.iframes > 0) return;
  p.hp -= dmg;
  p.iframes = PLAYER_BASE.contactIframes;
  w.shake = Math.min(14, w.shake + 7);
  burst(w, p.x, p.y, '#ff5c5c', 16, 240, 4, 0.5);
  addFloater(w, p.x, p.y - 26, `-${dmg}`, '#ff5c5c');
  w.events.push('hurt');
  if (p.hp <= 0) {
    p.hp = 0; p.alive = false;
    w.phase = 'over';
    burst(w, p.x, p.y, '#ffd166', 60, 380, 5, 1.0);
    burst(w, p.x, p.y, '#ff8a5c', 40, 280, 4, 0.9);
    w.events.push('lose');
    if (w.score > w.best) {
      w.best = w.score;
      localStorage.setItem('emberwarden-best', String(w.best));
    }
  }
}

function firePlayer(w) {
  const p = w.player;
  const n = p.projectiles;
  const spread = 0.14;
  for (let i = 0; i < n; i++) {
    const off = (i - (n - 1) / 2) * spread;
    const a = p.angle + off;
    w.bullets.push({
      x: p.x + Math.cos(a) * (p.radius + 8),
      y: p.y + Math.sin(a) * (p.radius + 8),
      vx: Math.cos(a) * p.bulletSpeed, vy: Math.sin(a) * p.bulletSpeed,
      dmg: p.damage, radius: p.bulletRadius, pierce: p.pierce, hitSet: new Set(),
    });
  }
  w.stats.shots += n;
  w.events.push('shoot');
}

export function openShop(w) {
  // Wave-clear bonus.
  const bonus = 15 + w.wave * 5;
  w.embers += bonus;
  w.stats.earned += bonus;
  addFloater(w, w.player.x, w.player.y - 40, `+${bonus} embers`, '#ffb347');
  // Roll 3 distinct upgrades that are not maxed.
  const avail = UPGRADES.filter((u) => (w.player.upgrades[u.id] || 0) < u.max);
  const picks = [];
  const pool = [...avail];
  while (picks.length < 3 && pool.length) {
    picks.push(pool.splice(w.rand.int(0, pool.length - 1), 1)[0]);
  }
  w.shop = picks;
  w.phase = 'shop';
  w.banner = 'WAVE CLEARED — SPEND EMBERS';
  w.bannerT = 2.5;
}

export function buyUpgrade(w, idx) {
  const u = w.shop[idx];
  if (!u) return false;
  const stacks = w.player.upgrades[u.id] || 0;
  const cost = upgradeCost(u, stacks, w.wave);
  if (w.embers < cost) { w.events.push('deny'); return false; }
  w.embers -= cost;
  w.player.upgrades[u.id] = stacks + 1;
  u.apply(w.player);
  w.events.push('buy');
  burst(w, w.player.x, w.player.y, '#ffd166', 20, 200, 3, 0.5);
  addFloater(w, w.player.x, w.player.y - 40, u.name, '#7fe08b');
  // Remove bought card, keep the rest.
  w.shop.splice(idx, 1);
  return true;
}

export function update(w, dt, input) {
  w.time += dt;
  if (w.bannerT > 0) w.bannerT -= dt;
  w.shake = Math.max(0, w.shake - dt * 26);
  const p = w.player;
  if (!p) return;

  // --- particles & floaters always tick ---
  for (const pt of w.particles) {
    pt.x += pt.vx * dt; pt.y += pt.vy * dt;
    pt.vx *= 0.92; pt.vy *= 0.92; pt.life -= dt;
  }
  w.particles = w.particles.filter((pt) => pt.life > 0);
  for (const f of w.floaters) { f.y -= 34 * dt; f.life -= dt; }
  w.floaters = w.floaters.filter((f) => f.life > 0);

  if (w.phase === 'shop') {
    // Embers drift to the player even in the shop.
    updatePickups(w, dt);
    return;
  }
  if (w.phase !== 'play') return;

  // --- player movement ---
  const mv = input.moveVector();
  p.vx = mv.x * p.speed;
  p.vy = mv.y * p.speed;
  p.x = Math.max(p.radius, Math.min(1280 - p.radius, p.x + p.vx * dt));
  p.y = Math.max(p.radius, Math.min(720 - p.radius, p.y + p.vy * dt));
  // Aim at the mouse (canvas coords == world coords at 1280x720).
  const mx = input.mouse.x, my = input.mouse.y;
  if (mx !== 0 || my !== 0) p.angle = Math.atan2(my - p.y, mx - p.x);
  if (p.iframes > 0) p.iframes -= dt;
  if (p.regen) p.hp = Math.min(p.maxHp, p.hp + p.regen * dt);

  // --- firing ---
  p.fireT -= dt;
  const wantFire = input.mouse.down || input.down('Space');
  if (wantFire && p.fireT <= 0) {
    p.fireT = p.fireInterval;
    firePlayer(w);
  }

  // --- spawning ---
  if (w.wave === BOSS_WAVE && !w.boss && w.spawnQueue.length === 0 && !w.enemies.some((e) => e.kind === 'dreadlord')) {
    spawnBoss(w);
  }
  if (w.spawnQueue.length) {
    w.spawnT -= dt;
    if (w.spawnT <= 0) {
      w.spawnT = Math.max(0.25, 0.9 - w.wave * 0.05);
      spawnEnemy(w, w.spawnQueue.shift());
    }
  }

  // --- enemies ---
  for (const e of w.enemies) {
    e.t += dt;
    if (e.flash > 0) e.flash -= dt;
    if (e.spawnT > 0) { e.spawnT -= dt; continue; }
    const dx = p.x - e.x, dy = p.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d, uy = dy / d;
    if (e.kind === 'shade') {
      e.x += ux * e.speed * dt; e.y += uy * e.speed * dt;
    } else if (e.kind === 'wisp') {
      const zig = Math.sin(e.t * 6) * 0.7;
      e.x += (ux - uy * zig) * e.speed * dt;
      e.y += (uy + ux * zig) * e.speed * dt;
    } else if (e.kind === 'spitter') {
      if (d > 260) { e.x += ux * e.speed * dt; e.y += uy * e.speed * dt; }
      else if (d < 180) { e.x -= ux * e.speed * dt; e.y -= uy * e.speed * dt; }
      e.fireT -= dt;
      if (e.fireT <= 0 && d < 520) {
        e.fireT = 2.2;
        w.enemyBullets.push({
          x: e.x, y: e.y, vx: ux * 230, vy: uy * 230,
          dmg: e.dmg, radius: 7,
        });
        w.events.push('spit');
      }
    } else if (e.kind === 'brute') {
      e.x += ux * e.speed * dt; e.y += uy * e.speed * dt;
    } else if (e.kind === 'dreadlord') {
      e.x += ux * e.speed * dt; e.y += uy * e.speed * dt;
      e.radialT -= dt;
      if (e.radialT <= 0) {
        e.radialT = 3.2;
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2 + e.t;
          w.enemyBullets.push({
            x: e.x + Math.cos(a) * e.radius, y: e.y + Math.sin(a) * e.radius,
            vx: Math.cos(a) * 170, vy: Math.sin(a) * 170, dmg: 12, radius: 7,
          });
        }
        w.events.push('spit');
      }
      // Boss trickles shades.
      if (w.rand.chance(dt * 0.7) && w.enemies.length < 14) spawnEnemy(w, 'shade');
    }
    // Contact damage.
    if (d < e.radius + p.radius) hurtPlayer(w, e.dmg, e.x, e.y);
  }

  // --- player bullets ---
  for (const b of w.bullets) {
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.x < -20 || b.x > 1300 || b.y < -20 || b.y > 740) { b.dead = true; continue; }
    for (const e of w.enemies) {
      if (e.dead || e.spawnT > 0 || b.hitSet.has(e)) continue;
      const dx = e.x - b.x, dy = e.y - b.y;
      if (dx * dx + dy * dy < (e.radius + b.radius) ** 2) {
        b.hitSet.add(e);
        w.stats.hits++;
        damageEnemy(w, e, b.dmg, b.vx, b.vy);
        burst(w, b.x, b.y, '#ffb347', 4, 120, 2, 0.3);
        if (b.pierce > 0) { b.pierce--; } else { b.dead = true; }
        break;
      }
    }
  }
  w.bullets = w.bullets.filter((b) => !b.dead);
  w.enemies = w.enemies.filter((e) => !e.dead);

  // --- enemy bullets ---
  for (const b of w.enemyBullets) {
    b.x += b.vx * dt; b.y += b.vy * dt;
    const dx = p.x - b.x, dy = p.y - b.y;
    if (dx * dx + dy * dy < (p.radius + b.radius) ** 2) {
      b.dead = true;
      hurtPlayer(w, b.dmg, b.x, b.y);
      continue;
    }
    if (b.x < -20 || b.x > 1300 || b.y < -20 || b.y > 740) b.dead = true;
  }
  w.enemyBullets = w.enemyBullets.filter((b) => !b.dead);

  updatePickups(w, dt);

  // --- wave clear ---
  if (w.waveActive && w.spawnQueue.length === 0 && w.enemies.length === 0) {
    w.waveActive = false;
    if (w.wave >= WIN_WAVE) {
      w.phase = 'win';
      w.events.push('win');
      if (w.score > w.best) {
        w.best = w.score;
        localStorage.setItem('emberwarden-best', String(w.best));
      }
    } else {
      openShop(w);
    }
  }
}

function updatePickups(w, dt) {
  const p = w.player;
  if (!p) return;
  for (const pk of w.pickups) {
    pk.t += dt;
    const dx = p.x - pk.x, dy = p.y - pk.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < p.magnet) {
      const pull = 520 * (1 - d / (p.magnet * 2.2));
      pk.x += (dx / d) * pull * dt;
      pk.y += (dy / d) * pull * dt;
    } else {
      pk.x += pk.vx * dt; pk.y += pk.vy * dt;
      pk.vx *= 0.9; pk.vy *= 0.9;
    }
    if (d < p.radius + 12) {
      pk.dead = true;
      w.embers += pk.value;
      w.stats.earned += pk.value;
      w.events.push('pickup');
      burst(w, pk.x, pk.y, '#ffb347', 3, 90, 2, 0.25);
    }
  }
  w.pickups = w.pickups.filter((pk) => !pk.dead);
}
