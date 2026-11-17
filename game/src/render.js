// Render: every pixel of EMBERWARDEN. One job: draw the world state.
// Canvas is 1280x720 logical; the page scales it to the window.
import { ENEMIES, UPGRADES, upgradeCost, BOSS_WAVE } from './config.js';

const BG_GRAD = ['#0b0e1a', '#141126', '#1c1430'];

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawBackground(ctx, w) {
  const g = ctx.createLinearGradient(0, 0, 0, 720);
  g.addColorStop(0, BG_GRAD[0]); g.addColorStop(0.6, BG_GRAD[1]); g.addColorStop(1, BG_GRAD[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1280, 720);
  // Stars.
  ctx.save();
  for (let i = 0; i < 90; i++) {
    const x = (i * 137.5) % 1280, y = (i * 89.3) % 720;
    const tw = 0.35 + 0.3 * Math.sin(w.time * 1.5 + i);
    ctx.globalAlpha = Math.max(0.08, tw);
    ctx.fillStyle = '#cdd6ff';
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.restore();
  // The lighthouse beacon at the centre of the arena: soft radial glow.
  const pulse = 0.10 + 0.03 * Math.sin(w.time * 2);
  const rg = ctx.createRadialGradient(640, 360, 20, 640, 360, 340);
  rg.addColorStop(0, `rgba(255, 179, 71, ${pulse + 0.12})`);
  rg.addColorStop(1, 'rgba(255, 179, 71, 0)');
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, 1280, 720);
  // Faint arena ring.
  ctx.strokeStyle = 'rgba(255, 179, 71, 0.10)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(640, 360, 300, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(640, 360, 180, 0, Math.PI * 2); ctx.stroke();
}

function drawPickups(ctx, w) {
  for (const pk of w.pickups) {
    const bob = Math.sin(pk.t * 6) * 2;
    ctx.save();
    ctx.shadowColor = '#ffb347'; ctx.shadowBlur = 12;
    ctx.fillStyle = '#ffb347';
    ctx.beginPath(); ctx.arc(pk.x, pk.y + bob, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff3d6';
    ctx.beginPath(); ctx.arc(pk.x - 1, pk.y + bob - 1, 2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

function drawPlayer(ctx, w) {
  const p = w.player;
  if (!p || !p.alive) return;
  ctx.save();
  if (p.iframes > 0 && Math.floor(w.time * 14) % 2 === 0) ctx.globalAlpha = 0.45;
  ctx.translate(p.x, p.y);
  // Lantern glow.
  const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 90);
  glow.addColorStop(0, 'rgba(255, 200, 90, 0.35)');
  glow.addColorStop(1, 'rgba(255, 200, 90, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(0, 0, 90, 0, Math.PI * 2); ctx.fill();
  // Cloak body.
  ctx.rotate(p.angle);
  ctx.fillStyle = '#2b3a67';
  ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-12, -13); ctx.lineTo(-8, 0); ctx.lineTo(-12, 13); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ffd166';
  ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff3d6';
  ctx.beginPath(); ctx.arc(3, -2, 3.5, 0, Math.PI * 2); ctx.fill();
  // Lantern flame in hand.
  ctx.fillStyle = '#ff8a3c';
  ctx.beginPath(); ctx.arc(14, 8, 5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // HP bar above the player.
  const bw = 44;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(p.x - bw / 2, p.y - p.radius - 14, bw, 6);
  ctx.fillStyle = p.hp / p.maxHp > 0.35 ? '#7fe08b' : '#ff5c5c';
  ctx.fillRect(p.x - bw / 2, p.y - p.radius - 14, bw * (p.hp / p.maxHp), 6);
}

function drawEnemy(ctx, e) {
  ctx.save();
  ctx.translate(e.x, e.y);
  if (e.spawnT > 0) {
    ctx.globalAlpha = 0.4 + 0.4 * Math.sin(e.spawnT * 30);
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(0, 0, e.radius + 8, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    return;
  }
  const def = ENEMIES[e.kind];
  ctx.shadowColor = def.glow; ctx.shadowBlur = 16;
  ctx.fillStyle = e.flash > 0 ? '#ffffff' : def.color;
  if (e.kind === 'shade') {
    ctx.beginPath(); ctx.arc(0, 0, e.radius, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = '#1a1030';
    ctx.beginPath(); ctx.arc(-5, -3, 3, 0, Math.PI * 2); ctx.arc(5, -3, 3, 0, Math.PI * 2); ctx.fill();
  } else if (e.kind === 'wisp') {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + e.t * 2;
      const r = i % 2 === 0 ? e.radius : e.radius * 0.55;
      ctx[i === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath(); ctx.fill();
  } else if (e.kind === 'spitter') {
    ctx.beginPath(); ctx.arc(0, 0, e.radius, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = '#d8ffd8';
    ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
  } else if (e.kind === 'brute') {
    rr(ctx, -e.radius, -e.radius, e.radius * 2, e.radius * 2, 8); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = '#2b0f08';
    ctx.fillRect(-12, -6, 8, 4); ctx.fillRect(4, -6, 8, 4);
    ctx.fillRect(-10, 8, 20, 4);
  } else if (e.kind === 'dreadlord') {
    ctx.beginPath(); ctx.arc(0, 0, e.radius, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#ff8aa5'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, e.radius - 10, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#1a0208';
    ctx.beginPath(); ctx.arc(-14, -8, 6, 0, Math.PI * 2); ctx.arc(14, -8, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff3b6b';
    ctx.beginPath(); ctx.arc(-14, -8, 2.5, 0, Math.PI * 2); ctx.arc(14, -8, 2.5, 0, Math.PI * 2); ctx.fill();
    // Crown spikes.
    ctx.fillStyle = def.color;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 14 - 6, -e.radius + 8); ctx.lineTo(i * 14, -e.radius - 12); ctx.lineTo(i * 14 + 6, -e.radius + 8);
      ctx.closePath(); ctx.fill();
    }
  }
  ctx.restore();
  // HP bar for tough enemies.
  if (e.maxHp > 30 && e.hp < e.maxHp) {
    const bw = e.radius * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(e.x - bw / 2, e.y - e.radius - 12, bw, 5);
    ctx.fillStyle = '#ff5c5c';
    ctx.fillRect(e.x - bw / 2, e.y - e.radius - 12, bw * Math.max(0, e.hp / e.maxHp), 5);
  }
}

function drawBullets(ctx, w) {
  for (const b of w.bullets) {
    ctx.save();
    ctx.shadowColor = '#ffd166'; ctx.shadowBlur = 10;
    ctx.fillStyle = '#ffd166';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff8e0';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.radius * 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  for (const b of w.enemyBullets) {
    ctx.save();
    ctx.shadowColor = '#7fe08b'; ctx.shadowBlur = 10;
    ctx.fillStyle = '#a5f2a5';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

function drawParticles(ctx, w) {
  for (const pt of w.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawFloaters(ctx, w) {
  ctx.textAlign = 'center';
  ctx.font = 'bold 15px system-ui, sans-serif';
  for (const f of w.floaters) {
    ctx.globalAlpha = Math.max(0, f.life / f.maxLife);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

function drawHUD(ctx, w) {
  const p = w.player;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  // Top-left: score + best.
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillText(`SCORE ${w.score}`, 20, 38);
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillStyle = '#b9c0e0';
  ctx.fillText(`BEST ${Math.max(w.best, w.score)}`, 20, 60);
  // Top-center: wave.
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd166';
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.fillText(w.wave >= BOSS_WAVE ? `WAVE ${w.wave} — DREADLORD` : `WAVE ${w.wave}`, 640, 38);
  ctx.fillStyle = '#b9c0e0';
  ctx.font = '14px system-ui, sans-serif';
  const left = w.enemies.length + w.spawnQueue.length;
  ctx.fillText(w.phase === 'shop' ? 'SHOP — spend your embers' : `${left} foes remain`, 640, 60);
  // Top-right: embers.
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffb347';
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.fillText(`⬢ ${w.embers}`, 1260, 38);
  ctx.fillStyle = '#b9c0e0';
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillText(`KILLS ${w.kills}`, 1260, 60);
  // Bottom-left: HP bar.
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  rr(ctx, 20, 676, 260, 22, 6); ctx.fill();
  ctx.fillStyle = p.hp / p.maxHp > 0.35 ? '#7fe08b' : '#ff5c5c';
  const frac = Math.max(0, p.hp / p.maxHp);
  if (frac > 0) { rr(ctx, 20, 676, 260 * frac, 22, 6); ctx.fill(); }
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.fillText(`HP ${Math.ceil(p.hp)} / ${p.maxHp}`, 30, 692);
  // Bottom-right: upgrades owned (single line).
  const owned = Object.entries(p.upgrades).filter(([, n]) => n > 0);
  ctx.textAlign = 'right';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillStyle = '#b9c0e0';
  if (owned.length) {
    ctx.fillText(owned.map(([id, n]) => {
      const u = UPGRADES.find((x) => x.id === id);
      return `${u.icon} ${u.name} ×${n}`;
    }).join('   '), 1260, 692);
  }
  // Boss bar.
  if (w.boss) {
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    rr(ctx, 440, 78, 400, 14, 5); ctx.fill();
    ctx.fillStyle = '#ff3b6b';
    rr(ctx, 440, 78, 400 * Math.max(0, w.boss.hp / w.boss.maxHp), 14, 5); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText('DREADLORD', 640, 72);
  }
  // Wave banner.
  if (w.bannerT > 0 && w.banner) {
    const a = Math.min(1, w.bannerT);
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 44px system-ui, sans-serif';
    ctx.shadowColor = '#ff8a3c'; ctx.shadowBlur = 24;
    ctx.fillText(w.banner, 640, 200);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }
  // Controls hint.
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(185,192,224,0.75)';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText('WASD move · mouse aim · hold click / Space to fire · P pause · M mute', 640, 714);
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(8, 10, 24, 0.82)';
  rr(ctx, x, y, w, h, 14); ctx.fill();
  ctx.strokeStyle = 'rgba(255, 179, 71, 0.35)';
  ctx.lineWidth = 2;
  rr(ctx, x, y, w, h, 14); ctx.stroke();
}

function drawTitle(ctx, w) {
  ctx.fillStyle = 'rgba(5, 7, 16, 0.55)';
  ctx.fillRect(0, 0, 1280, 720);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd166';
  ctx.font = 'bold 84px system-ui, sans-serif';
  ctx.shadowColor = '#ff8a3c'; ctx.shadowBlur = 34;
  ctx.fillText('EMBERWARDEN', 640, 220);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  ctx.font = '22px system-ui, sans-serif';
  ctx.fillText('The last lighthouse is dying. Hold the light through 10 waves.', 640, 268);
  ctx.fillStyle = '#b9c0e0';
  ctx.font = '17px system-ui, sans-serif';
  ctx.fillText('WASD / arrows — move      Mouse — aim      Hold click or Space — fire', 640, 318);
  ctx.fillText('Slay shadows, gather embers, buy upgrades between waves.', 640, 346);
  ctx.fillText('Wave 10: the Dreadlord. Survive it and the dawn is yours.', 640, 374);
  if (w.best > 0) {
    ctx.fillStyle = '#7fe08b';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText(`BEST SCORE ${w.best}`, 640, 420);
  }
  const pulse = 0.65 + 0.35 * Math.sin(w.time * 3);
  ctx.globalAlpha = pulse;
  ctx.fillStyle = '#ffd166';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillText('CLICK OR PRESS ENTER TO BEGIN', 640, 480);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#8b93b8';
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillText('Sound on for the full experience · M mutes · P pauses', 640, 660);
}

function drawShop(ctx, w) {
  ctx.fillStyle = 'rgba(5, 7, 16, 0.45)';
  ctx.fillRect(0, 0, 1280, 720);
  panel(ctx, 190, 96, 900, 528);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd166';
  ctx.font = 'bold 36px system-ui, sans-serif';
  ctx.fillText('WAVE CLEARED', 640, 156);
  ctx.fillStyle = '#ffffff';
  ctx.font = '19px system-ui, sans-serif';
  ctx.fillText(`You hold ⬢ ${w.embers} embers — spend them, Warden.`, 640, 192);
  const cards = w.shop;
  const cw = 260, ch = 240, gap = 24;
  const total = cards.length * cw + (cards.length - 1) * gap;
  const x0 = 640 - total / 2;
  cards.forEach((u, i) => {
    const x = x0 + i * (cw + gap), y = 230;
    const stacks = w.player.upgrades[u.id] || 0;
    const cost = upgradeCost(u, stacks, w.wave);
    const afford = w.embers >= cost;
    ctx.fillStyle = afford ? 'rgba(255, 179, 71, 0.12)' : 'rgba(255,255,255,0.05)';
    rr(ctx, x, y, cw, ch, 12); ctx.fill();
    ctx.strokeStyle = afford ? '#ffb347' : 'rgba(185,192,224,0.35)';
    ctx.lineWidth = 2;
    rr(ctx, x, y, cw, ch, 12); ctx.stroke();
    ctx.fillStyle = '#ffd166';
    ctx.font = '44px system-ui, sans-serif';
    ctx.fillText(u.icon, x + cw / 2, y + 66);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText(u.name, x + cw / 2, y + 108);
    ctx.fillStyle = '#b9c0e0';
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillText(u.desc, x + cw / 2, y + 138);
    ctx.fillStyle = stacks > 0 ? '#7fe08b' : '#8b93b8';
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText(stacks > 0 ? `owned ×${stacks}  (max ${u.max})` : `new  (max ${u.max})`, x + cw / 2, y + 166);
    ctx.fillStyle = afford ? '#ffb347' : '#ff5c5c';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText(`⬢ ${cost}`, x + cw / 2, y + 202);
    ctx.fillStyle = '#8b93b8';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText(`press ${i + 1}`, x + cw / 2, y + 224);
  });
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px system-ui, sans-serif';
  const pulse = 0.65 + 0.35 * Math.sin(w.time * 3);
  ctx.globalAlpha = pulse;
  ctx.fillText('PRESS ENTER — NEXT WAVE', 640, 540);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#8b93b8';
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillText('Click a card or press 1 / 2 / 3 to buy', 640, 570);
}

function drawPaused(ctx) {
  ctx.fillStyle = 'rgba(5, 7, 16, 0.6)';
  ctx.fillRect(0, 0, 1280, 720);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 52px system-ui, sans-serif';
  ctx.fillText('PAUSED', 640, 330);
  ctx.fillStyle = '#b9c0e0';
  ctx.font = '19px system-ui, sans-serif';
  ctx.fillText('Press P or Esc to resume', 640, 372);
}

function drawEnd(ctx, w, won) {
  ctx.fillStyle = won ? 'rgba(10, 26, 12, 0.55)' : 'rgba(16, 5, 10, 0.6)';
  ctx.fillRect(0, 0, 1280, 720);
  panel(ctx, 340, 150, 600, 420);
  ctx.textAlign = 'center';
  ctx.fillStyle = won ? '#7fe08b' : '#ff5c5c';
  ctx.font = 'bold 52px system-ui, sans-serif';
  ctx.fillText(won ? 'DAWN BREAKS' : 'THE LIGHT DIES', 640, 228);
  ctx.fillStyle = '#ffffff';
  ctx.font = '19px system-ui, sans-serif';
  ctx.fillText(won ? 'The Dreadlord is ash. The lighthouse burns on.' : 'The shadows take the lighthouse… this time.', 640, 268);
  const acc = w.stats.shots ? Math.round((100 * w.stats.hits) / w.stats.shots) : 0;
  const rows = [
    ['SCORE', String(w.score)],
    ['BEST', String(Math.max(w.best, w.score))],
    ['WAVE REACHED', String(w.wave)],
    ['FOES SLAIN', String(w.kills)],
    ['EMBERS EARNED', String(w.stats.earned)],
    ['ACCURACY', `${acc}%`],
  ];
  ctx.font = '18px system-ui, sans-serif';
  rows.forEach(([k, v], i) => {
    const y = 312 + i * 30;
    ctx.fillStyle = '#b9c0e0';
    ctx.textAlign = 'right';
    ctx.fillText(k, 610, y);
    ctx.fillStyle = '#ffd166';
    ctx.textAlign = 'left';
    ctx.fillText(v, 670, y);
  });
  const pulse = 0.65 + 0.35 * Math.sin(w.time * 3);
  ctx.globalAlpha = pulse;
  ctx.fillStyle = '#ffd166';
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PRESS R TO PLAY AGAIN', 640, 528);
  ctx.globalAlpha = 1;
}

export function render(ctx, w) {
  ctx.save();
  if (w.shake > 0.3) {
    ctx.translate((Math.random() - 0.5) * w.shake, (Math.random() - 0.5) * w.shake);
  }
  drawBackground(ctx, w);
  if (w.phase !== 'title') {
    drawPickups(ctx, w);
    for (const e of w.enemies) drawEnemy(ctx, e);
    drawBullets(ctx, w);
    drawPlayer(ctx, w);
    drawParticles(ctx, w);
    drawFloaters(ctx, w);
    drawHUD(ctx, w);
  }
  if (w.phase === 'title') drawTitle(ctx, w);
  else if (w.phase === 'shop') drawShop(ctx, w);
  else if (w.phase === 'paused') drawPaused(ctx);
  else if (w.phase === 'over') drawEnd(ctx, w, false);
  else if (w.phase === 'win') drawEnd(ctx, w, true);
  ctx.restore();
}

// Shop card hit-boxes, shared with main.js for mouse clicks.
export function shopCardRects(w) {
  const cards = w.shop;
  const cw = 260, ch = 240, gap = 24;
  const total = cards.length * cw + (cards.length - 1) * gap;
  const x0 = 640 - total / 2;
  return cards.map((u, i) => ({ x: x0 + i * (cw + gap), y: 230, w: cw, h: ch, idx: i }));
}
