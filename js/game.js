/* KEDARMAN v1
   Movement is integer-pixel so actors land on tile centers exactly.
   Ghost personalities live in targetFor(). Levels speed up in levelScale().
   Mouth animation is drawKedar() — the photo is clipped to a wedge. */
(function () {
  "use strict";

  const KM = (window.KM = window.KM || {});
  const TILE = KM.TILE;
  const COLS = KM.COLS;
  const ROWS = KM.ROWS;
  const W = COLS * TILE;
  const H = ROWS * TILE;
  const DOOR_R = KM.DOOR_ROW;

  const DIR_LIST = [
    { name: "up", x: 0, y: -1 },
    { name: "left", x: -1, y: 0 },
    { name: "down", x: 0, y: 1 },
    { name: "right", x: 1, y: 0 },
  ];
  const DIR = {
    up: DIR_LIST[0],
    left: DIR_LIST[1],
    down: DIR_LIST[2],
    right: DIR_LIST[3],
  };

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const hero = document.getElementById("hero");
  const heroCtx = hero.getContext("2d");
  const stage = document.getElementById("stage");
  const overlay = document.getElementById("overlay");
  const scoreEl = document.getElementById("score");
  const highEl = document.getElementById("high");
  const levelEl = document.getElementById("level");
  const livesEl = document.getElementById("lives");
  const pauseBtn = document.getElementById("pause-btn");
  const muteBtn = document.getElementById("mute-btn");
  const actionBtn = document.getElementById("ov-action");
  const secondaryBtn = document.getElementById("ov-secondary");

  const face = new Image();
  face.src = "assets/kedar.jpg";
  face.onload = function () {
    renderLives();
  };

  let grid = [];
  let state = "title";
  let points = 0;
  let high = 0;
  let lives = 3;
  let level = 1;
  let extraAwarded = false;
  let pelletsEaten = 0;
  let pelletsAtLife = 0;
  let sincePellet = 0;
  let frightTimer = 0;
  let combo = 0;
  let modeIndex = 0;
  let modeTime = 0;
  let globalMode = "scatter";
  let readyT = 0;
  let deathAnim = 0;
  let simT = 0;
  let chompT = 0;
  let sirenAcc = 0;
  let sirenTick = 0;
  let bonus = null;
  let popups = [];
  let lastFrame = 0;

  const MODE_PATTERN = [
    ["scatter", 7],
    ["chase", 20],
    ["scatter", 7],
    ["chase", 20],
    ["scatter", 5],
    ["chase", 1e9],
  ];

  const pac = {
    x: 0,
    y: 0,
    dir: { x: 0, y: 0, name: "left" },
    facing: DIR.left,
    next: null,
    acc: 0,
  };
  const ghosts = [];

  try {
    high = parseInt(localStorage.getItem("kedarman-high") || "0", 10) || 0;
  } catch (err) {
    high = 0;
  }

  function cell(c, r) {
    if (r < 0 || r >= ROWS) return null;
    const cc = ((c % COLS) + COLS) % COLS;
    return grid[r][cc];
  }

  function tileOf(ent) {
    let c = Math.floor(ent.x / TILE);
    let r = Math.floor(ent.y / TILE);
    if (c < 0) c += COLS;
    if (c >= COLS) c -= COLS;
    return { c: c, r: r };
  }

  function posMod(n, m) {
    return ((n % m) + m) % m;
  }

  function atCenter(ent) {
    return posMod(ent.x, TILE) === TILE / 2 && posMod(ent.y, TILE) === TILE / 2;
  }

  function passable(c, r, who) {
    const ch = cell(c, r);
    if (ch == null || ch === "#" || ch === " ") return false;
    if (ch === "-" || ch === "=") {
      if (who === "pac") return false;
      return who.mode === "eaten" || who.mode === "exit" || who.mode === "house";
    }
    return true;
  }

  function opposite(d) {
    if (d.x === 1) return DIR.left;
    if (d.x === -1) return DIR.right;
    if (d.y === 1) return DIR.up;
    if (d.y === -1) return DIR.down;
    return DIR.left;
  }

  function inTunnel(ent) {
    const t = tileOf(ent);
    return t.r === KM.TUNNEL_ROW && (t.c <= 5 || t.c >= 22);
  }

  function pelletsLeft() {
    let n = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const ch = grid[r][c];
        if (ch === "." || ch === "o") n++;
      }
    }
    return n;
  }

  function levelScale() {
    return Math.min(1.42, 1 + (level - 1) * 0.07);
  }

  function frightSeconds() {
    return Math.max(2.2, 6.4 - (level - 1) * 0.5);
  }

  function modeDuration(base) {
    if (base > 1000) return base;
    return Math.max(2.5, base * Math.max(0.45, 1 - (level - 1) * 0.1));
  }

  function loadMap() {
    grid = KM.MAP.map(function (row) {
      return row.split("");
    });
    for (let i = 0; i < grid.length; i++) {
      if (grid[i].length !== COLS) {
        console.error("KEDARMAN maze row " + i + " has length " + grid[i].length);
      }
    }
  }

  function place(ent, c, r) {
    ent.x = c * TILE + TILE / 2;
    ent.y = r * TILE + TILE / 2;
    ent.acc = 0;
  }

  function resetGhost(def) {
    let g = null;
    for (let i = 0; i < ghosts.length; i++) {
      if (ghosts[i].name === def.name) g = ghosts[i];
    }
    if (!g) {
      g = { name: def.name, color: def.color };
      ghosts.push(g);
    }
    place(g, def.start.c, def.start.r);
    g.home = def.home;
    g.exitC = def.exitC;
    g.release = def.release;
    g.scatter = def.scatter;
    g.phase = def.phase;
    g.mode = def.out ? "scatter" : "house";
    g.dir = def.out ? DIR.left : { x: 0, y: 0, name: "up" };
    g.facing = def.out ? DIR.left : DIR.up;
    g.stuck = 0;
    g.respawnHold = 0;
  }

  function resetActors() {
    pelletsAtLife = pelletsEaten;
    sincePellet = 0;
    frightTimer = 0;
    combo = 0;
    modeIndex = 0;
    modeTime = 0;
    globalMode = "scatter";
    bonus = null;
    place(pac, KM.PAC_START.c, KM.PAC_START.r);
    pac.dir = { x: 0, y: 0, name: "left" };
    pac.facing = DIR.left;
    pac.next = null;
    for (let i = 0; i < KM.GHOSTS.length; i++) resetGhost(KM.GHOSTS[i]);
  }

  function beginBoard() {
    loadMap();
    pelletsEaten = 0;
    popups = [];
    resetActors();
    state = "ready";
    readyT = 1.5;
    chompT = 0;
    hideOverlay();
    pauseBtn.textContent = "Pause";
    updateHud();
    renderLives();
  }

  function startGame() {
    points = 0;
    lives = 3;
    level = 1;
    extraAwarded = false;
    beginBoard();
    KM.audio.ensure();
  }

  function nextLevel() {
    level += 1;
    beginBoard();
  }

  function beginPlay() {
    state = "playing";
    if (pac.next && (pac.next.x || pac.next.y)) {
      pac.dir = pac.next;
      pac.facing = pac.next;
      pac.next = null;
    } else if (!pac.dir.x && !pac.dir.y) {
      pac.dir = DIR.left;
      pac.facing = DIR.left;
    }
    KM.audio.ensure();
    KM.audio.ready();
  }

  function pause() {
    if (state !== "playing") return;
    state = "pause";
    showScreen("pause");
    pauseBtn.textContent = "Resume";
  }

  function resume() {
    if (state !== "pause") return;
    state = "playing";
    hideOverlay();
    pauseBtn.textContent = "Pause";
    KM.audio.ensure();
  }

  function die() {
    if (state !== "playing") return;
    state = "dying";
    deathAnim = 0;
    lives -= 1;
    renderLives();
    updateHud();
    KM.audio.death();
  }

  function finishDeath() {
    if (lives <= 0) {
      state = "over";
      showScreen("over");
      return;
    }
    resetActors();
    state = "ready";
    readyT = 1.4;
  }

  function clearBoard() {
    if (state === "win") return;
    addPoints(1000 * level);
    state = "win";
    showScreen("win");
    KM.audio.win();
  }

  function addPoints(n) {
    points += n;
    if (points > high) {
      high = points;
      try {
        localStorage.setItem("kedarman-high", String(high));
      } catch (err) {
        /* ignore */
      }
    }
    if (!extraAwarded && points >= 3000) {
      extraAwarded = true;
      lives += 1;
      renderLives();
      KM.audio.extra();
      popups.push({ x: pac.x, y: pac.y - 18, text: "1UP", ttl: 1.3 });
    }
    updateHud();
  }

  function fmt(n) {
    return String(n).padStart(6, "0");
  }

  function updateHud() {
    scoreEl.textContent = fmt(points);
    highEl.textContent = fmt(high);
    levelEl.textContent = String(level);
  }

  function renderLives() {
    livesEl.innerHTML = "";
    for (let i = 0; i < lives; i++) {
      const c = document.createElement("canvas");
      c.width = 64;
      c.height = 64;
      c.className = "life";
      drawKedar(c.getContext("2d"), 32, 32, 29, DIR.right, 0.42);
      livesEl.appendChild(c);
    }
  }

  function hideOverlay() {
    overlay.hidden = true;
  }

  function showScreen(mode) {
    const title = document.getElementById("ov-title");
    const sub = document.getElementById("ov-sub");
    const body = document.getElementById("ov-body");
    const scoreLine = document.getElementById("ov-score");
    const fine = document.getElementById("ov-fine");
    overlay.hidden = false;
    secondaryBtn.hidden = true;
    scoreLine.hidden = true;
    fine.hidden = mode !== "title";
    hero.hidden = false;

    if (mode === "title") {
      title.textContent = "KEDARMAN";
      sub.textContent = "Kedar Karippail · Head of Client Service";
      body.textContent = "Eat every pellet. Quadrant marks turn the ghosts around.";
      actionBtn.textContent = "PLAY";
    } else if (mode === "pause") {
      title.textContent = "PAUSED";
      sub.textContent = "The board is holding.";
      body.textContent = "P or Esc resumes.";
      actionBtn.textContent = "RESUME";
    } else if (mode === "win") {
      title.textContent = "BOARD CLEAR";
      sub.textContent = "Level " + level + " is clear.";
      body.textContent = "Same halls. Faster ghosts.";
      scoreLine.hidden = false;
      scoreLine.textContent = "Score " + fmt(points) + "   ·   Best " + fmt(high);
      actionBtn.textContent = "NEXT BOARD";
      secondaryBtn.hidden = false;
    } else if (mode === "over") {
      title.textContent = "GAME OVER";
      sub.textContent = "The ghosts caught Kedar.";
      body.textContent = "Quadrant marks are the window. Use them.";
      scoreLine.hidden = false;
      scoreLine.textContent = "Score " + fmt(points) + "   ·   Best " + fmt(high);
      actionBtn.textContent = "TRY AGAIN";
      secondaryBtn.hidden = false;
    }
  }

  function setDir(name) {
    const d = DIR[name];
    if (!d) return;
    if (state === "title") {
      startGame();
      pac.next = d;
      pac.facing = d;
      return;
    }
    if (state === "over" || state === "win" || state === "pause") return;
    pac.next = d;
    pac.facing = d;
    if (pac.dir && (pac.dir.x || pac.dir.y) && d.x === -pac.dir.x && d.y === -pac.dir.y) {
      pac.dir = d;
      pac.facing = d;
      pac.next = null;
    }
  }

  function toggleMute() {
    KM.audio.setMuted(!KM.audio.muted);
    muteBtn.textContent = KM.audio.muted ? "Muted" : "Sound on";
    muteBtn.setAttribute("aria-pressed", KM.audio.muted ? "true" : "false");
    if (!KM.audio.muted) KM.audio.ensure();
  }

  function applyReverse(ent) {
    if (!ent.next || !ent.dir) return;
    if (!ent.dir.x && !ent.dir.y) return;
    if (ent.next.x === -ent.dir.x && ent.next.y === -ent.dir.y) {
      ent.dir = ent.next;
      ent.facing = ent.next;
      ent.next = null;
    }
  }

  function choosePac(ent) {
    const t = tileOf(ent);
    const open = function (d) {
      return d && (d.x || d.y) && passable(t.c + d.x, t.r + d.y, "pac");
    };
    if (open(ent.next)) {
      const d = ent.next;
      ent.next = null;
      return d;
    }
    if (open(ent.dir)) return ent.dir;
    return null;
  }

  /* Chase targets. Pinky's "up" offset copies the famous arcade overflow.
     Inky aims at the point twice the vector from Blinky to two tiles ahead. */
  function targetFor(g) {
    if (g.mode === "exit") return { c: g.exitC, r: DOOR_R - 1 };
    if (g.mode === "eaten") {
      const t = tileOf(g);
      const ch = cell(t.c, t.r);
      const inside = ch === "=" || ch === "-";
      const doorstep = t.r === DOOR_R - 1 && (t.c === 13 || t.c === 14);
      if (inside || doorstep) return { c: g.home.c, r: g.home.r };
      return { c: g.exitC, r: DOOR_R - 1 };
    }
    if (g.mode === "scatter") return g.scatter;

    const p = tileOf(pac);
    if (g.name === "Blinky") return p;
    if (g.name === "Pinky") {
      let ox = pac.facing.x * 4;
      let oy = pac.facing.y * 4;
      if (pac.facing.name === "up") ox -= 4;
      return { c: p.c + ox, r: p.r + oy };
    }
    if (g.name === "Inky") {
      let ox = pac.facing.x * 2;
      let oy = pac.facing.y * 2;
      if (pac.facing.name === "up") ox -= 2;
      const ax = p.c + ox;
      const ay = p.r + oy;
      const b = tileOf(ghosts[0]);
      return { c: ax + (ax - b.c), r: ay + (ay - b.r) };
    }
    const here = tileOf(g);
    const dist = Math.hypot(p.c - here.c, p.r - here.r);
    if (dist < 8) return g.scatter;
    return p;
  }

  function chooseGhost(g) {
    const t = tileOf(g);
    const opts = [];
    for (let i = 0; i < DIR_LIST.length; i++) {
      const d = DIR_LIST[i];
      if (g.dir && (g.dir.x || g.dir.y) && d.x === -g.dir.x && d.y === -g.dir.y) continue;
      if (passable(t.c + d.x, t.r + d.y, g)) opts.push(d);
    }
    if (!opts.length) {
      if (g.dir && (g.dir.x || g.dir.y)) {
        const back = opposite(g.dir);
        if (passable(t.c + back.x, t.r + back.y, g)) return back;
      }
      return null;
    }
    if (g.mode === "frightened") return opts[(Math.random() * opts.length) | 0];
    const target = targetFor(g);
    let best = opts[0];
    let bestD = Infinity;
    for (let i = 0; i < opts.length; i++) {
      const d = opts[i];
      const nc = t.c + d.x;
      const nr = t.r + d.y;
      const dist = (nc - target.c) * (nc - target.c) + (nr - target.r) * (nr - target.r);
      if (dist < bestD) {
        bestD = dist;
        best = d;
      }
    }
    return best;
  }

  function arrived(g) {
    const t = tileOf(g);
    if (g.mode === "exit") {
      const ch = cell(t.c, t.r);
      if (t.r < DOOR_R && ch !== "-" && ch !== "=" && ch !== "#" && ch !== " " && ch != null) {
        g.mode = frightTimer > 0 ? "frightened" : globalMode;
      }
    } else if (g.mode === "eaten" && t.c === g.home.c && t.r === g.home.r) {
      g.mode = "house";
      g.dir = { x: 0, y: 0, name: "up" };
      g.facing = DIR.up;
      g.respawnHold = 0.75;
      return "housed";
    }
    return "go";
  }

  function nudge(ent, chooser, who) {
    if (who === "pac") applyReverse(ent);
    if (atCenter(ent)) {
      if (who !== "pac" && arrived(ent) === "housed") return false;
      const next = chooser(ent);
      if (!next) {
        if (who === "pac") ent.dir = { x: 0, y: 0, name: ent.facing.name };
        return false;
      }
      ent.dir = next;
      ent.facing = next;
      const t = tileOf(ent);
      const body = who === "pac" ? "pac" : ent;
      if (!passable(t.c + next.x, t.r + next.y, body)) return false;
    } else if (!ent.dir || (!ent.dir.x && !ent.dir.y)) {
      return false;
    }
    ent.x += ent.dir.x;
    ent.y += ent.dir.y;
    const span = COLS * TILE;
    if (ent.x < 0) ent.x += span;
    if (ent.x >= span) ent.x -= span;
    return true;
  }

  function stepEntity(ent, dt, speed, chooser, who) {
    ent.acc += speed * dt;
    if (ent.acc > 36) ent.acc = 36;
    let guard = 0;
    while (ent.acc >= 1 && guard++ < 40) {
      ent.acc -= 1;
      if (!nudge(ent, chooser, who)) {
        ent.acc = 0;
        return;
      }
    }
  }

  function startFright() {
    frightTimer = frightSeconds();
    combo = 0;
    for (let i = 0; i < ghosts.length; i++) {
      const g = ghosts[i];
      if (g.mode === "chase" || g.mode === "scatter" || g.mode === "frightened") {
        g.mode = "frightened";
        if (g.dir && (g.dir.x || g.dir.y)) {
          g.dir = opposite(g.dir);
          g.facing = g.dir;
        }
      }
    }
  }

  function updateFright(dt) {
    if (frightTimer <= 0) return;
    frightTimer -= dt;
    if (frightTimer > 0) return;
    frightTimer = 0;
    combo = 0;
    for (let i = 0; i < ghosts.length; i++) {
      if (ghosts[i].mode === "frightened") ghosts[i].mode = globalMode;
    }
  }

  function updateMode(dt) {
    if (frightTimer > 0) return;
    modeTime += dt;
    const row = MODE_PATTERN[modeIndex];
    if (modeTime >= modeDuration(row[1]) && modeIndex < MODE_PATTERN.length - 1) {
      modeIndex += 1;
      modeTime = 0;
      globalMode = MODE_PATTERN[modeIndex][0];
      for (let i = 0; i < ghosts.length; i++) {
        const g = ghosts[i];
        if (g.mode === "chase" || g.mode === "scatter") {
          g.mode = globalMode;
          if (g.dir && (g.dir.x || g.dir.y)) {
            g.dir = opposite(g.dir);
            g.facing = g.dir;
          }
        }
      }
    }
  }

  function updateHoused(dt) {
    let idleUsed = false;
    for (let i = 0; i < ghosts.length; i++) {
      const g = ghosts[i];
      if (g.mode !== "house") continue;
      if (g.respawnHold > 0) {
        g.respawnHold -= dt;
        continue;
      }
      const earned = pelletsEaten - pelletsAtLife >= g.release;
      const idle = sincePellet >= 4 && !idleUsed;
      if (earned || idle) {
        g.mode = "exit";
        g.dir = DIR.up;
        g.facing = DIR.up;
        if (idle && !earned) {
          idleUsed = true;
          sincePellet = 0;
        }
      }
    }
  }

  function maybeSpawnBonus() {
    if (bonus) return;
    if (pelletsEaten !== 70 && pelletsEaten !== 160) return;
    bonus = { c: KM.BONUS.c, r: KM.BONUS.r, ttl: 9 };
  }

  function tryEat() {
    const t = tileOf(pac);
    const ch = grid[t.r][t.c];
    if (ch !== "." && ch !== "o") return;
    const cx = t.c * TILE + TILE / 2;
    const cy = t.r * TILE + TILE / 2;
    if (Math.abs(pac.x - cx) > TILE * 0.45 || Math.abs(pac.y - cy) > TILE * 0.45) return;
    grid[t.r][t.c] = "e";
    pelletsEaten += 1;
    sincePellet = 0;
    if (ch === ".") {
      addPoints(10);
      KM.audio.chomp();
    } else {
      addPoints(50);
      startFright();
      KM.audio.power();
      popups.push({ x: pac.x, y: pac.y - 16, text: "+50", ttl: 0.9 });
    }
    maybeSpawnBonus();
    if (pelletsLeft() === 0) clearBoard();
  }

  function updateBonus(dt) {
    if (!bonus) return;
    bonus.ttl -= dt;
    const bx = bonus.c * TILE + TILE / 2;
    const by = bonus.r * TILE + TILE / 2;
    let dx = pac.x - bx;
    const span = COLS * TILE;
    if (dx > span / 2) dx -= span;
    if (dx < -span / 2) dx += span;
    if (Math.hypot(dx, pac.y - by) < TILE * 0.6) {
      addPoints(440);
      popups.push({ x: bx, y: by - 12, text: "+440", ttl: 1.2 });
      KM.audio.bonus();
      bonus = null;
      return;
    }
    if (bonus.ttl <= 0) bonus = null;
  }

  function actorDist(a, b) {
    let dx = a.x - b.x;
    const span = COLS * TILE;
    if (dx > span / 2) dx -= span;
    if (dx < -span / 2) dx += span;
    return Math.hypot(dx, a.y - b.y);
  }

  function eatGhost(g) {
    const pts = 200 * Math.pow(2, combo);
    combo += 1;
    addPoints(pts);
    popups.push({ x: g.x, y: g.y - 14, text: String(pts), ttl: 1.15 });
    g.mode = "eaten";
    if (g.dir && (g.dir.x || g.dir.y)) {
      g.dir = opposite(g.dir);
      g.facing = g.dir;
    }
    KM.audio.eat();
  }

  function collide() {
    let deadly = false;
    const edible = [];
    for (let i = 0; i < ghosts.length; i++) {
      const g = ghosts[i];
      if (g.mode === "eaten" || g.mode === "house" || g.mode === "exit") continue;
      if (actorDist(pac, g) >= TILE * 0.68) continue;
      if (g.mode === "frightened") edible.push(g);
      else deadly = true;
    }
    if (deadly) {
      die();
      return;
    }
    for (let i = 0; i < edible.length; i++) eatGhost(edible[i]);
  }

  function elroyMul() {
    const left = pelletsLeft();
    if (left <= 15) return 1.18;
    if (left <= 40) return 1.08;
    return 1;
  }

  function stepPac(dt) {
    let speed = 132 * levelScale();
    if (inTunnel(pac)) speed *= 0.62;
    stepEntity(pac, dt, speed, choosePac, "pac");
  }

  function stepGhosts(dt) {
    for (let i = 0; i < ghosts.length; i++) {
      const g = ghosts[i];
      if (g.mode === "house") continue;
      let speed;
      if (g.mode === "eaten") speed = 220;
      else if (g.mode === "frightened") speed = 76;
      else {
        speed = 120 * levelScale();
        if (g.name === "Blinky") speed *= elroyMul();
      }
      if (inTunnel(g) && g.mode !== "eaten") speed *= 0.58;
      const x0 = g.x;
      const y0 = g.y;
      stepEntity(g, dt, speed, chooseGhost, g);
      if (g.x === x0 && g.y === y0) g.stuck += dt;
      else g.stuck = 0;
      if (g.stuck > 2.4 && g.mode !== "house") {
        if (g.dir && (g.dir.x || g.dir.y)) {
          g.dir = opposite(g.dir);
          g.facing = g.dir;
        }
        g.stuck = 0;
      }
    }
  }

  function tickPopups(dt) {
    for (let i = 0; i < popups.length; i++) {
      popups[i].ttl -= dt;
      popups[i].y -= 26 * dt;
    }
    popups = popups.filter(function (p) {
      return p.ttl > 0;
    });
  }

  function update(dt) {
    simT += dt;
    tickPopups(dt);
    if (state === "ready") {
      readyT -= dt;
      if (readyT <= 0) beginPlay();
      return;
    }
    if (state === "dying") {
      deathAnim += dt / 1.05;
      if (deathAnim >= 1) finishDeath();
      return;
    }
    if (state !== "playing") return;

    updateFright(dt);
    updateMode(dt);
    sincePellet += dt;
    updateHoused(dt);
    stepPac(dt);
    tryEat();
    if (state !== "playing") return;
    updateBonus(dt);
    stepGhosts(dt);
    if (state !== "playing") return;
    collide();

    if (pac.dir.x || pac.dir.y) chompT += dt * 8.2;

    sirenAcc += dt;
    const interval = frightTimer > 0 ? 0.14 : 0.36;
    if (sirenAcc >= interval) {
      sirenAcc = 0;
      sirenTick ^= 1;
      KM.audio.siren(frightTimer > 0, sirenTick);
    }
  }

  function dirAngle(d) {
    const name = d && d.name;
    if (name === "down") return Math.PI / 2;
    if (name === "left") return Math.PI;
    if (name === "up") return -Math.PI / 2;
    return 0;
  }

  function drawKedar(context, x, y, radius, facing, mouth) {
    const ang = dirAngle(facing);
    const open = Math.max(0, Math.min(mouth || 0, Math.PI * 0.9));
    context.save();
    context.beginPath();
    if (open < 0.045) context.arc(x, y, radius, 0, Math.PI * 2);
    else {
      context.moveTo(x, y);
      context.arc(x, y, radius, ang + open, ang + Math.PI * 2 - open);
      context.closePath();
    }
    context.fillStyle = "#ffd23a";
    context.shadowColor = "rgba(0,0,0,0.45)";
    context.shadowBlur = Math.max(2, radius * 0.16);
    context.shadowOffsetY = Math.max(1, radius * 0.05);
    context.fill();
    context.shadowColor = "transparent";
    context.shadowBlur = 0;
    context.shadowOffsetY = 0;

    if (face.complete && face.naturalWidth) {
      const inner = Math.max(1, radius - Math.max(1.2, radius * 0.07));
      context.save();
      context.beginPath();
      if (open < 0.045) context.arc(x, y, inner, 0, Math.PI * 2);
      else {
        context.moveTo(x, y);
        context.arc(x, y, inner, ang + open, ang + Math.PI * 2 - open);
        context.closePath();
      }
      context.clip();
      const crop = KM.FACE;
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(
        face,
        crop.x,
        crop.y,
        crop.size,
        crop.size,
        x - inner,
        y - inner,
        inner * 2,
        inner * 2
      );
      context.restore();
    }

    context.beginPath();
    if (open < 0.045) context.arc(x, y, Math.max(1, radius - 0.6), 0, Math.PI * 2);
    else context.arc(x, y, Math.max(1, radius - 0.6), ang + open, ang + Math.PI * 2 - open);
    context.strokeStyle = "rgba(197, 125, 58, 0.95)";
    context.lineWidth = Math.max(1, radius * 0.05);
    context.stroke();
    context.restore();
  }

  function strokeWalls(color, width) {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (let r = 0; r < ROWS; r++) {
      let c = 0;
      while (c < COLS) {
        if (grid[r][c] !== "#") {
          c++;
          continue;
        }
        const start = c;
        while (c < COLS && grid[r][c] === "#") c++;
        const y = r * TILE + TILE / 2;
        const x1 = start * TILE + TILE / 2;
        const x2 = (c - 1) * TILE + TILE / 2;
        ctx.moveTo(x1, y);
        ctx.lineTo(x2 === x1 ? x2 + 0.01 : x2, y);
      }
    }
    for (let c = 0; c < COLS; c++) {
      let r = 0;
      while (r < ROWS) {
        if (grid[r][c] !== "#") {
          r++;
          continue;
        }
        const start = r;
        while (r < ROWS && grid[r][c] === "#") r++;
        const x = c * TILE + TILE / 2;
        const y1 = start * TILE + TILE / 2;
        const y2 = (r - 1) * TILE + TILE / 2;
        ctx.moveTo(x, y1);
        ctx.lineTo(x, y2 === y1 ? y2 + 0.01 : y2);
      }
    }
    ctx.stroke();
  }

  function drawMaze() {
    ctx.fillStyle = "#070708";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#14121c";
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (grid[r][c] === "=") ctx.fillRect(c * TILE, r * TILE, TILE, TILE);
      }
    }
    strokeWalls("#e0a45c", TILE * 1.06);
    strokeWalls("#140f0c", TILE * 0.82);
    strokeWalls("#3c2c1c", TILE * 0.16);
  }

  function drawDoor() {
    const x = 13 * TILE + 3;
    const y = DOOR_R * TILE + TILE / 2 - 3;
    ctx.fillStyle = "#f6d7c8";
    ctx.fillRect(x, y, TILE * 2 - 6, 6);
    ctx.fillStyle = "#c57d3a";
    ctx.fillRect(x, y + 5, TILE * 2 - 6, 2);
  }

  function drawPower(x, y) {
    const pulse = 1 + Math.sin(simT * 5) * 0.12;
    const radius = 8.3 * pulse;
    const colors = ["#c57d3a", "#f4e4cc", "#e25b45", "#1f6f6a"];
    const gap = 0.08;
    for (let i = 0; i < 4; i++) {
      const a0 = -Math.PI / 2 + i * (Math.PI / 2) + gap;
      const a1 = -Math.PI / 2 + (i + 1) * (Math.PI / 2) - gap;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.arc(x, y, radius, a0, a1);
      ctx.closePath();
      ctx.fillStyle = colors[i];
      ctx.fill();
    }
  }

  function drawPellets() {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const ch = grid[r][c];
        if (ch !== "." && ch !== "o") continue;
        const x = c * TILE + TILE / 2;
        const y = r * TILE + TILE / 2;
        if (ch === ".") {
          ctx.fillStyle = "#ffe14a";
          ctx.beginPath();
          ctx.arc(x, y, 2.8, 0, Math.PI * 2);
          ctx.fill();
        } else {
          drawPower(x, y);
        }
      }
    }
  }

  function drawBonus() {
    if (!bonus) return;
    const x = bonus.c * TILE + TILE / 2;
    const y = bonus.r * TILE + TILE / 2;
    const s = 15 + Math.sin(simT * 6) * 1.2;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(simT * 2) * 0.06);
    roundBox(-s / 2, -s / 2, s, s, 3);
    ctx.fillStyle = "#f7f1e8";
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "#c57d3a";
    ctx.stroke();
    ctx.fillStyle = "#c57d3a";
    ctx.font = "700 9px Outfit, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("44", 0, 0.5);
    ctx.restore();
  }

  function roundBox(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawEyes(x, y, r, facing) {
    const dx = (facing && facing.x ? facing.x : 0) * r * 0.18;
    const dy = (facing && facing.y ? facing.y : 0) * r * 0.18;
    for (let side = -1; side <= 1; side += 2) {
      const ex = x + side * r * 0.32;
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.ellipse(ex, y, r * 0.22, r * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#17192b";
      ctx.beginPath();
      ctx.arc(ex + dx, y + dy, r * 0.11, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawGhost(g) {
    const x = g.x;
    let y = g.y;
    if (g.mode === "house") y += Math.sin(simT * 3 + g.phase) * 3.4;
    const r = TILE * 0.42;
    if (g.mode === "eaten") {
      drawEyes(x, y - 1, r, g.facing);
      return;
    }
    let color = g.color;
    const frightened = g.mode === "frightened";
    if (frightened) {
      const flash = frightTimer < 2 && Math.floor(simT * 8) % 2 === 0;
      color = flash ? "#f6efe4" : "#2c3e9e";
    }
    const foot = y + r * 0.9;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, Math.PI, 0, false);
    ctx.lineTo(x + r, foot);
    const waves = 3;
    const wob = Math.floor(simT * 8 + g.phase) % 2;
    const w = (r * 2) / waves;
    for (let i = 0; i < waves; i++) {
      const xStart = x + r - i * w;
      const lift = (i % 2 === wob ? 1 : -1) * r * 0.26;
      ctx.quadraticCurveTo(xStart - w / 2, foot + lift, xStart - w, foot);
    }
    ctx.closePath();
    ctx.fill();

    if (frightened) {
      const ink = color === "#f6efe4" ? "#2c3e9e" : "#f6efe4";
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.arc(x - r * 0.28, y - r * 0.02, 2.1, 0, Math.PI * 2);
      ctx.arc(x + r * 0.28, y - r * 0.02, 2.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.6;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x - r * 0.4, y + r * 0.34);
      ctx.lineTo(x - r * 0.2, y + r * 0.5);
      ctx.lineTo(x, y + r * 0.34);
      ctx.lineTo(x + r * 0.2, y + r * 0.5);
      ctx.lineTo(x + r * 0.4, y + r * 0.34);
      ctx.stroke();
    } else {
      drawEyes(x, y - r * 0.06, r, g.facing);
    }
  }

  function drawPopups() {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "15px Bungee, Impact, sans-serif";
    for (let i = 0; i < popups.length; i++) {
      const p = popups[i];
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(7,7,8,0.8)";
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillStyle = "#f7f1e8";
      ctx.fillText(p.text, p.x, p.y);
    }
  }

  function drawBanner() {
    if (state !== "ready") return;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const y = 20 * TILE + 8;
    ctx.font = "16px Bungee, Impact, sans-serif";
    ctx.lineWidth = 5;
    ctx.strokeStyle = "rgba(7,7,8,0.88)";
    ctx.strokeText("LEVEL " + level, W / 2, y - 30);
    ctx.fillStyle = "#c57d3a";
    ctx.fillText("LEVEL " + level, W / 2, y - 30);
    ctx.font = "40px Bungee, Impact, sans-serif";
    ctx.lineWidth = 7;
    ctx.strokeStyle = "rgba(7,7,8,0.88)";
    ctx.strokeText("READY!", W / 2, y);
    ctx.fillStyle = "#f4e4cc";
    ctx.fillText("READY!", W / 2, y);
    ctx.restore();
  }

  function drawHero() {
    if (overlay.hidden) return;
    heroCtx.clearRect(0, 0, hero.width, hero.height);
    const calm = state === "over" || state === "pause";
    const mouth = calm ? 0.2 : 0.08 + Math.abs(Math.sin(simT * 4.4)) * 0.72;
    const facing = state === "over" ? DIR.left : DIR.right;
    drawKedar(heroCtx, 128, 132, 108, facing, mouth);
  }

  function syncCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const bw = Math.round(W * dpr);
    const bh = Math.round(H * dpr);
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
  }

  function render() {
    syncCanvas();
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (state === "dying" && deathAnim < 0.4) {
      const mag = (1 - deathAnim / 0.4) * 5;
      ctx.translate(Math.sin(deathAnim * 80) * mag, 0);
    }
    drawMaze();
    if (frightTimer > 0 && (state === "playing" || state === "dying")) {
      ctx.fillStyle = "rgba(40, 64, 160, 0.08)";
      ctx.fillRect(0, 0, W, H);
    }
    drawPellets();
    drawBonus();
    for (let i = 0; i < ghosts.length; i++) drawGhost(ghosts[i]);
    drawDoor();

    let mouth = 0;
    let radius = TILE * 0.5;
    if (state === "dying") {
      const t = Math.min(1, deathAnim);
      mouth = 0.2 + t * Math.PI * 0.72;
      radius *= 1 - t * 0.22;
    } else if (state === "playing" && (pac.dir.x || pac.dir.y)) {
      // Stay open while moving so the bite reads, then shut when he stops.
      mouth = 0.28 + Math.abs(Math.sin(chompT)) * 0.48;
    }
    drawKedar(ctx, pac.x, pac.y, radius, pac.facing, mouth);
    drawPopups();
    drawBanner();
    ctx.restore();
    drawHero();
  }

  function frame(now) {
    if (!lastFrame) lastFrame = now;
    const dt = Math.min(0.034, (now - lastFrame) / 1000);
    lastFrame = now;
    update(dt);
    render();
    requestAnimationFrame(frame);
  }

  function onKey(e) {
    const map = {
      ArrowLeft: "left",
      ArrowRight: "right",
      ArrowUp: "up",
      ArrowDown: "down",
      a: "left",
      A: "left",
      d: "right",
      D: "right",
      w: "up",
      W: "up",
      s: "down",
      S: "down",
    };
    if (map[e.key]) {
      e.preventDefault();
      setDir(map[e.key]);
      return;
    }
    if (e.key === "p" || e.key === "P" || e.key === "Escape") {
      e.preventDefault();
      if (state === "playing") pause();
      else if (state === "pause") resume();
      return;
    }
    if (e.key === "m" || e.key === "M") {
      e.preventDefault();
      toggleMute();
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (state === "title" || state === "over") startGame();
      else if (state === "win") nextLevel();
      else if (state === "pause") resume();
    }
  }

  window.addEventListener("keydown", onKey, { passive: false });

  actionBtn.addEventListener("click", function () {
    KM.audio.ensure();
    if (state === "title" || state === "over") startGame();
    else if (state === "pause") resume();
    else if (state === "win") nextLevel();
  });

  secondaryBtn.addEventListener("click", function () {
    state = "title";
    showScreen("title");
    pauseBtn.textContent = "Pause";
  });

  pauseBtn.addEventListener("click", function () {
    if (state === "playing" || state === "ready") {
      if (state === "ready") beginPlay();
      pause();
    } else if (state === "pause") resume();
  });

  muteBtn.addEventListener("click", function () {
    toggleMute();
  });

  const pad = document.getElementById("dpad");
  const buttons = pad.querySelectorAll("button");
  for (let i = 0; i < buttons.length; i++) {
    buttons[i].addEventListener("pointerdown", function (e) {
      e.preventDefault();
      setDir(buttons[i].getAttribute("data-dir"));
    });
  }

  let swipe = null;
  stage.addEventListener("pointerdown", function (e) {
    if (e.target.closest("button")) return;
    swipe = { x: e.clientX, y: e.clientY };
    if (state === "title" && !e.target.closest(".card")) startGame();
  });
  stage.addEventListener("pointerup", function (e) {
    if (!swipe) return;
    const dx = e.clientX - swipe.x;
    const dy = e.clientY - swipe.y;
    swipe = null;
    if (Math.hypot(dx, dy) < 28) return;
    if (state !== "playing" && state !== "ready" && state !== "dying") return;
    if (Math.abs(dx) > Math.abs(dy)) setDir(dx > 0 ? "right" : "left");
    else setDir(dy > 0 ? "down" : "up");
  });

  muteBtn.textContent = KM.audio.muted ? "Muted" : "Sound on";
  muteBtn.setAttribute("aria-pressed", KM.audio.muted ? "true" : "false");

  loadMap();
  resetActors();
  updateHud();
  renderLives();
  showScreen("title");

  if (/\bplay=1\b/.test(location.search)) startGame();

  KM.debug = {
    state: function () {
      return {
        state: state,
        points: points,
        lives: lives,
        level: level,
        pellets: pelletsLeft(),
        eaten: pelletsEaten,
        fright: frightTimer,
        pac: (function () {
          const t = tileOf(pac);
          return {
            x: pac.x,
            y: pac.y,
            c: t.c,
            r: t.r,
            ch: grid[t.r][t.c],
            dir: pac.dir && pac.dir.name,
            facing: pac.facing && pac.facing.name,
          };
        })(),
        ghosts: ghosts.map(function (g) {
          return { name: g.name, mode: g.mode, x: g.x, y: g.y };
        }),
        face: !!(face.complete && face.naturalWidth),
      };
    },
    win: function () {
      if (state !== "playing") state = "playing";
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (grid[r][c] === "." || grid[r][c] === "o") grid[r][c] = "e";
        }
      }
      clearBoard();
    },
    kill: function () {
      if (state !== "playing") state = "playing";
      lives = 1;
      renderLives();
      die();
    },
    moveTo: function (c, r) {
      place(pac, c, r);
      pac.dir = { x: 0, y: 0, name: pac.facing.name };
      pac.next = null;
    },
    fright: function () {
      startFright();
    },
  };

  requestAnimationFrame(frame);
})();
