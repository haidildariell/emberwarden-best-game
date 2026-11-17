// capture.mjs — screenshot + play-test driver for EMBERWARDEN.
// Node 22 stdlib only (built-in WebSocket client) + the box's headless Chrome.
// Loads game/ via file:// (this box's Chromium blocks loopback HTTP), drives
// Chrome over CDP, waits for window.__shotReady, saves JPEG screenshots, then
// play-tests the live game with scripted input and reports console errors.
// Usage: node capture.mjs
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const CHROME = '/opt/meta-chromium/chrome';
// This box's Chromium is a Hatch build: it refuses to start without a
// WebGL domain policy file + its SHA-256 (see chrome-webgl-policy.txt).
const POLICY_FILE = join(here, 'chrome-webgl-policy.txt');
const POLICY_SHA = createHash('sha256').update(readFileSync(POLICY_FILE)).digest('hex');
const CDP_PORT = 9333;
const GAME_URL = `file://${join(here, 'game', 'index.html')}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, method = 'GET') {
  const res = await fetch(url, { method });
  return res.json();
}

class CDP {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 0;
    this.pending = new Map();
    this.events = [];
    this.ready = new Promise((res, rej) => {
      this.ws.onopen = res;
      this.ws.onerror = rej;
    });
    this.ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      if (data.id && this.pending.has(data.id)) {
        const { res, rej } = this.pending.get(data.id);
        this.pending.delete(data.id);
        data.error ? rej(new Error(JSON.stringify(data.error))) : res(data.result);
      } else if (data.method) {
        this.events.push(data);
      }
    };
  }
  async call(method, params = {}) {
    await this.ready;
    const id = ++this.id;
    const p = new Promise((res, rej) => this.pending.set(id, { res, rej }));
    this.ws.send(JSON.stringify({ id, method, params }));
    return p;
  }
  async evalJs(expression) {
    const r = await this.call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    return r?.result?.value;
  }
  consoleErrors() {
    return this.events.filter((e) =>
      (e.method === 'Runtime.exceptionThrown') ||
      (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error') ||
      (e.method === 'Log.entryAdded' && e.params.entry.level === 'error' &&
        !/favicon/.test(e.params.entry.text || '')));
  }
}

async function main() {
  let chrome = null;
  try {
    chrome = spawn(CHROME, [
      '--headless=new', '--no-sandbox', '--disable-gpu', '--no-proxy-server',
      '--allow-file-access-from-files',
      `--hatch-webgl-allowed-domains-file=${POLICY_FILE}`,
      `--hatch-webgl-allowed-domains-sha256=${POLICY_SHA}`,
      '--user-data-dir=/tmp/emberwarden-chrome',
      `--remote-debugging-port=${CDP_PORT}`,
      '--window-size=1280,720', '--hide-scrollbars', 'about:blank',
    ], { stdio: 'ignore' });
    await sleep(2500);
    const target = await getJson(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, 'PUT');
    const cdp = new CDP(target.webSocketDebuggerUrl);
    await cdp.call('Runtime.enable');
    await cdp.call('Page.enable');
    await cdp.call('Log.enable');

    const shots = [
      ['play', '1-cover.jpg'],
      ['start', '2-start.jpg'],
      ['late', '3-action.jpg'],
      ['end', '4-end.jpg'],
    ];
    mkdirSync(join(here, 'screenshots'), { recursive: true });
    for (const [scene, file] of shots) {
      await cdp.call('Page.navigate', { url: `${GAME_URL}?shot=${scene}&seed=7` });
      let ready = false;
      for (let i = 0; i < 40; i++) {
        await sleep(250);
        try { ready = await cdp.evalJs('window.__shotReady === true'); } catch { /* retry */ }
        if (ready) break;
      }
      if (!ready) throw new Error(`shot ${scene} never became ready`);
      await sleep(300);
      const shot = await cdp.call('Page.captureScreenshot', { format: 'jpeg', quality: 82 });
      const buf = Buffer.from(shot.data, 'base64');
      writeFileSync(join(here, 'screenshots', file), buf);
      console.log(`${file}: ${buf.length} bytes`);
    }

    // --- live play test: start, move, shoot, pause ---
    await cdp.call('Page.navigate', { url: GAME_URL });
    await sleep(1500);
    console.log('phase after load:', await cdp.evalJs('window.__emberwarden.phase'));
    await cdp.call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await cdp.call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await sleep(500);
    console.log('phase after Enter:', await cdp.evalJs('window.__emberwarden.phase'));
    await cdp.call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 900, y: 300 });
    await cdp.call('Input.dispatchMouseEvent', { type: 'mousePressed', x: 900, y: 300, button: 'left', clickCount: 1 });
    for (const code of ['KeyW', 'KeyD', 'KeyS', 'KeyA', 'KeyW']) {
      const vk = { KeyW: 87, KeyD: 68, KeyS: 83, KeyA: 65 }[code];
      await cdp.call('Input.dispatchKeyEvent', { type: 'keyDown', key: code, code, windowsVirtualKeyCode: vk });
      await sleep(1100);
      await cdp.call('Input.dispatchKeyEvent', { type: 'keyUp', key: code, code, windowsVirtualKeyCode: vk });
    }
    await cdp.call('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 900, y: 300, button: 'left', clickCount: 1 });
    const st = await cdp.evalJs(`JSON.stringify({phase: window.__emberwarden.phase, wave: window.__emberwarden.wave, score: window.__emberwarden.score, shots: window.__emberwarden.stats.shots, enemies: window.__emberwarden.enemies.length, hp: Math.round(window.__emberwarden.player.hp)})`);
    console.log('state after 6s play:', st);
    await cdp.call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'p', code: 'KeyP', windowsVirtualKeyCode: 80 });
    await cdp.call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'p', code: 'KeyP', windowsVirtualKeyCode: 80 });
    await sleep(300);
    console.log('phase after P:', await cdp.evalJs('window.__emberwarden.phase'));
    await cdp.call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'p', code: 'KeyP', windowsVirtualKeyCode: 80 });
    await cdp.call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'p', code: 'KeyP', windowsVirtualKeyCode: 80 });
    await sleep(300);
    console.log('phase after P again:', await cdp.evalJs('window.__emberwarden.phase'));

    const errs = cdp.consoleErrors();
    console.log('console errors:', errs.length);
    for (const e of errs) console.log(JSON.stringify(e).slice(0, 500));
    if (errs.length) process.exitCode = 2;
  } finally {
    if (chrome) chrome.kill();
  }
}

main().catch((e) => { console.error('CAPTURE FAILED:', e.message); process.exitCode = 1; });
