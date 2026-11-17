// EMBERWARDEN — config: tuning numbers, enemy kinds, upgrade pool.
// One job: constants. No logic, no imports.
export const VIEW_W = 1280;
export const VIEW_H = 720;

export const PLAYER_BASE = {
  radius: 16,
  speed: 265,
  maxHp: 100,
  fireInterval: 0.22, // seconds between shots
  damage: 12,
  bulletSpeed: 560,
  bulletRadius: 5,
  projectiles: 1,
  pierce: 0,
  magnet: 90,
  contactIframes: 0.7,
};

export const ENEMIES = {
  shade:     { name: 'Shade',     hp: 18,  speed: 118, radius: 14, dmg: 10, score: 10, cost: 1, color: '#8b7ff0', glow: '#5a4fd0' },
  wisp:      { name: 'Wisp',      hp: 10,  speed: 205, radius: 10, dmg: 7,  score: 15, cost: 2, color: '#ff9de2', glow: '#c44a9e' },
  spitter:   { name: 'Spitter',   hp: 26,  speed: 82,  radius: 15, dmg: 8,  score: 20, cost: 3, color: '#7fe08b', glow: '#3d9e4a' },
  brute:     { name: 'Brute',     hp: 95,  speed: 58,  radius: 24, dmg: 18, score: 40, cost: 5, color: '#ff8a5c', glow: '#c44a1e' },
  dreadlord: { name: 'Dreadlord', hp: 900, speed: 46, radius: 44, dmg: 25, score: 500, cost: 0, color: '#ff3b6b', glow: '#8a0f2e' },
};

// Wave composition: points budget grows; kinds unlock as waves rise.
export function waveBudget(wave) { return 5 + wave * 4; }
export function waveKinds(wave) {
  const kinds = ['shade'];
  if (wave >= 2) kinds.push('wisp');
  if (wave >= 3) kinds.push('spitter');
  if (wave >= 5) kinds.push('brute');
  return kinds;
}
export const BOSS_WAVE = 10;
export const WIN_WAVE = 10; // clearing wave 10 wins the run

// Upgrade pool. cost grows with wave and with stacks owned.
export const UPGRADES = [
  { id: 'dmg',   name: 'Ember Rounds',  icon: '▲', max: 5, base: 25, desc: '+25% bolt damage',        apply: (p) => { p.damage *= 1.25; } },
  { id: 'rate',  name: 'Rapid Wick',    icon: '≫', max: 5, base: 25, desc: '+18% fire rate',          apply: (p) => { p.fireInterval *= 0.85; } },
  { id: 'speed', name: 'Swift Boots',   icon: '»', max: 4, base: 20, desc: '+12% move speed',         apply: (p) => { p.speed *= 1.12; } },
  { id: 'heart', name: 'Lantern Heart', icon: '♥', max: 5, base: 30, desc: '+25 max HP, heal 25',     apply: (p) => { p.maxHp += 25; p.hp = Math.min(p.maxHp, p.hp + 25); } },
  { id: 'multi', name: 'Twin Flame',    icon: '✦', max: 3, base: 60, desc: '+1 bolt per shot',        apply: (p) => { p.projectiles += 1; } },
  { id: 'pierce',name: 'Piercing Light',icon: '⇢', max: 2, base: 45, desc: 'Bolts pierce +1 enemy',    apply: (p) => { p.pierce += 1; } },
  { id: 'magnet',name: 'Magnet Coil',   icon: '◎', max: 3, base: 20, desc: '+45% ember pickup radius', apply: (p) => { p.magnet *= 1.45; } },
  { id: 'regen', name: 'Kindling',      icon: '✚', max: 3, base: 35, desc: 'Regenerate 1.2 HP / sec',  apply: (p) => { p.regen = (p.regen || 0) + 1.2; } },
];
export function upgradeCost(u, stacks, wave) {
  return Math.round((u.base + wave * 4 + stacks * 12) / 5) * 5;
}
