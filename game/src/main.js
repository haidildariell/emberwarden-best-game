// EMBERWARDEN — bootstrap, fixed-step loop, screen state machine, audio wiring.
// One job: glue. Simulation lives in world.js, drawing in render.js.
import { createWorld, startRun, update, nextWave, buyUpgrade } from './world.js';
import { render, shopCardRects } from './render.js';
import { setupShot } from './shots.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(location.search);
const shotScene = params.get('shot');
const shotSeed = Number(params.get('seed') || 7);

function fitCanvas() {
  canvas.width = 1280;
  canvas.height = 720;
}
fitCanvas();

const input = new Input(canvas);
const audio = new AudioSys();

let world;
if (shotScene) {
  // Screenshot mode: one deterministic frame, then signal readiness.
  world = setupShot(shotScene, shotSeed);
  window.__emberwarden = world;
  render(ctx, world);
  window.__shotReady = true;
} else {
  world = createWorld();
  window.__emberwarden = world;
  world.phase = 'title';

  const SOUNDS = {
    shoot: () => audio.shoot(), hit: () => audio.hit(), kill: () => audio.kill(),
    pickup: () => audio.pickup(), hurt: () => audio.hurt(), buy: () => audio.buy(),
    wave: () => audio.wave(), boss: () => audio.boss(), win: () => audio.win(),
    lose: () => audio.lose(), spit: () => audio.tone(300, 0.12, 'square', 0.07, 500),
    deny: () => audio.tone(140, 0.15, 'square', 0.12, 90),
  };
  function drainEvents() {
    for (const e of world.events) (SOUNDS[e] || (() => {}))();
    world.events.length = 0;
  }

  function startAudioOnce() {
    if (audio.ensure()) audio.startMusic();
  }

  let last = performance.now();
  let acc = 0;
  const STEP = 1 / 60;

  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25;
    acc += dt;

    // --- global keys ---
    if (input.consumePressed('KeyM')) {
      audio.ensure();
      const muted = audio.toggleMute();
      if (!muted && !audio.musicOn) audio.startMusic();
    }
    if (input.consumePressed('KeyP') || input.consumePressed('Escape')) {
      if (world.phase === 'play') world.phase = 'paused';
      else if (world.phase === 'paused') world.phase = 'play';
    }

    // --- screen state machine ---
    if (world.phase === 'title') {
      world.time += dt;
      if (input.consumePressed('Enter') || input.mouse.clicked) {
        startAudioOnce();
        startRun(world);
      }
    } else if (world.phase === 'shop') {
      world.time += dt;
      if (input.consumePressed('Digit1')) buyUpgrade(world, 0);
      if (input.consumePressed('Digit2')) buyUpgrade(world, 1);
      if (input.consumePressed('Digit3')) buyUpgrade(world, 2);
      if (input.mouse.clicked) {
        const rects = shopCardRects(world);
        for (const r of rects) {
          if (input.mouse.x >= r.x && input.mouse.x <= r.x + r.w &&
              input.mouse.y >= r.y && input.mouse.y <= r.y + r.h) {
            buyUpgrade(world, r.idx);
            break;
          }
        }
      }
      if (input.consumePressed('Enter') || input.consumePressed('Space')) {
        nextWave(world);
        world.phase = 'play';
      }
    } else if (world.phase === 'over' || world.phase === 'win') {
      world.time += dt;
      if (input.consumePressed('KeyR') || input.consumePressed('Enter') || input.mouse.clicked) {
        startRun(world);
      }
    } else if (world.phase === 'paused') {
      // frozen world, still render
    } else if (world.phase === 'play') {
      if (input.mouse.clicked) startAudioOnce();
      if (input.wasPressed('Space')) startAudioOnce();
      while (acc >= STEP) {
        update(world, STEP, input);
        drainEvents();
        acc -= STEP;
      }
    }

    render(ctx, world);
    input.endFrame();
  }
  requestAnimationFrame(frame);
}
