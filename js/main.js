import { createAudio } from "./audio.js";
import { applyRun, BEATS, beatIdAt, buildLevel, CARD_ROOMS, dayKey, emptyFuse, fuseMs, judge, missLine, nextRank, pointsFor, rankFor, shareCard } from "./blitz.js";
import { LEVELS, worldEdge } from "./levels.js";
import { advancePhase, createGame, ensureLevel, enterPhase, step } from "./logic.js";
import { draw, screenScale } from "./render.js";
import { createParser, feed, parserDisplay } from "./vim.js";

const SAVE_KEY = "vimario-save-v2";
const audio = createAudio();
const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const els = {
  kicker: document.querySelector("#kicker"),
  lvname: document.querySelector("#lvname"),
  objective: document.querySelector("#objective"),
  hint: document.querySelector("#hint"),
  keys: document.querySelector("#keys"),
  par: document.querySelector("#par"),
  coins: document.querySelector("#coins"),
  deaths: document.querySelector("#deaths"),
  teach: document.querySelector("#teach"),
  mode: document.querySelector("#mode"),
  cmd: document.querySelector("#cmd"),
  lesson: document.querySelector("#lesson"),
  modal: document.querySelector("#modal"),
  card: document.querySelector("#modal-card"),
  mute: document.querySelector("#mute"),
  worlds: document.querySelector("#worlds"),
  share: document.querySelector("#share"),
  statA: document.querySelector("#stat-a"),
  statB: document.querySelector("#stat-b"),
  statC: document.querySelector("#stat-c"),
  statD: document.querySelector("#stat-d"),
};

const view = {
  screen: "boot",
  bootAt: performance.now(),
  menu: 0,
  mapIndex: 0,
  mapWorld: 1,
  mapDepth: "world",
  level: null,
  state: null,
  parser: createParser(),
  undo: [],
  queue: [],
  phaseSnap: null,
  particles: [],
  shake: 0,
  anim: null,
  paused: false,
  modal: null,
  insertFlash: 0,
  deadUntil: 0,
  deadTimer: 0,
  holdClear: false,
  wrote: false,
  endCmd: "",
  save: loadSave(),
  levels: LEVELS,
  menuItems: [],
  cam: 0,
  fuseRun: null,
  fuseOut: null,
};

function loadSave() {
  const blank = { unlocked: 1, stars: {}, best: {}, seenLetter: false, mute: false, fuse: emptyFuse() };
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return blank;
    const parsed = JSON.parse(raw);
    return { ...blank, ...parsed, fuse: { ...emptyFuse(), ...(parsed.fuse || {}) } };
  } catch {
    return blank;
  }
}

function persist() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(view.save));
}

function totals() {
  const stars = Object.values(view.save.stars).reduce((sum, n) => sum + n, 0);
  const best = Object.values(view.save.best).reduce((sum, n) => sum + n, 0);
  view.save.starsTotal = stars;
  view.save.bestTotal = best;
}

function menuItems() {
  const items = ["START"];
  if (view.save.unlocked > 1 || Object.keys(view.save.stars).length) items.push("CONTINUE");
  items.push("TIMED", "CONTROLS");
  return items;
}

function popcount(n) {
  let count = 0;
  let bits = n;
  while (bits) {
    count += bits & 1;
    bits >>= 1;
  }
  return count;
}

function rate(state, level) {
  let bits = 1;
  const secret = level.secret ?? level.totalCoins;
  if (secret === 0 || state.coins >= secret) bits |= 2;
  if (state.keystrokes <= level.par) bits |= 4;
  return bits;
}

function syncMusic() {
  if (view.save.mute) return;
  if (view.screen === "boot" || view.screen === "title" || view.screen === "letter" || view.screen === "fuse" || view.screen === "fuseout") audio.song("title");
  else if (view.screen === "map") audio.song("map");
  else if (view.screen === "ending") audio.song("clear");
  else if (view.screen === "play" && view.state) {
    if (view.state.kind === "maze") audio.song("maze");
    else if (view.state.kind === "boss" || view.level.world === 4) audio.song("castle");
    else if (view.level.world === 3) audio.song("night");
    else audio.song("overworld");
  }
}

function checkpoint() {
  view.phaseSnap = structuredClone(view.state);
}

function startLevel(index) {
  view.fuseRun = null;
  const level = LEVELS[index];
  ensureLevel(level);
  view.level = level;
  view.state = createGame(level);
  view.parser = createParser();
  view.undo = [];
  view.queue = [];
  view.anim = null;
  view.holdClear = false;
  view.paused = false;
  view.deadTimer = 0;
  view.modal = null;
  view.hintTier = 0;
  view.checkpoint = null;
  view.openFx = null;
  view.particles = [];
  view.screen = "play";
  hideModal();
  checkpoint();
  syncMusic();
  canvas.focus();
}

function toMap() {
  view.paused = false;
  view.modal = null;
  view.queue = [];
  hideModal();
  view.screen = "map";
  view.mapIndex = Math.max(0, Math.min(view.save.unlocked - 1, view.mapIndex));
  syncMusic();
}

function openLetter() {
  view.screen = "letter";
  view.modal = "letter";
  showModal(`<p class="kicker">A letter</p>
    <h2>Dear Vimario</h2>
    <p>King Insert locked Princess Normal inside a buffer. Arrows will not open it.</p>
    <p><b>h</b> left &nbsp; <b>l</b> right &nbsp; <b>j</b> down &nbsp; <b>k</b> up</p>
    <p>Courses play like a side-scroller. Pipes drop you into a buffer, where the floor is text and the motions are real.</p>
    <p>Enter starts the map.</p>`);
}

function openCodex() {
  view.modal = "codex";
  const blocks = [
    ["Move", "h left, l right, j down, k up. On a course, k jumps and j drops."],
    ["Repeat", "A number repeats. 4l moves four right. 2w skips one word."],
    ["Words", "w next word, b start of a word, e end of a word. On a course, a platform is a word."],
    ["Lines", "0 column zero, ^ first non-blank, $ end of the line."],
    ["Find", "fx lands on x. tx stops before x. ; repeats. , reverses."],
    ["Search", "/word then Enter. n next match. N previous. G last line, gg first, 4G line 4."],
    ["Delete", "x deletes the character under the cursor."],
    ["WORD", "W B E jump a WORD. The comma sticks to the word. w stops on it. W does not."],
    ["Match", "% jumps to the bracket that matches the one under the cursor."],
    ["Replace", "r then one character replaces the cell you stand on. r~ on X writes the exit."],
    ["More", "* searches for the word under the cursor. } jumps to the next blank line. { jumps back."],
    ["Case", "guu lowercases the line. gUw uppercases one word."],
    ["Marks", "ma remembers the cursor. 'a jumps back. . repeats the last x or r."],
    ["Gems", "Some coins seal the way you came and open a hatch. :hint shows the obstacle, then the command family, then one route."],
    ["Commands", ":help opens the controls. :retry reloads the level. :q returns to the map. :mute silences the tune. Esc pauses."],
  ];
  showModal(`<p class="kicker">Controls</p><h2>Motions</h2>${blocks
    .map(([name, text]) => `<h3>${name}</h3><p>${text}</p>`)
    .join("")}<p>Esc closes this.</p>`);
}

function showModal(html) {
  els.card.innerHTML = html;
  els.modal.hidden = false;
}

function hideModal() {
  els.modal.hidden = true;
  els.card.innerHTML = "";
}

function finishLevel() {
  const level = view.level;
  const state = view.state;
  const bits = rate(state, level);
  const stars = popcount(bits);
  const idx = LEVELS.findIndex((item) => item.id === level.id);
  view.save.bits = view.save.bits || {};
  view.save.bits[level.id] = (view.save.bits[level.id] || 0) | bits;
  view.save.stars[level.id] = Math.max(view.save.stars[level.id] || 0, popcount(view.save.bits[level.id]));
  if (view.save.best[level.id] == null || state.keystrokes < view.save.best[level.id]) view.save.best[level.id] = state.keystrokes;
  if (view.save.unlocked < idx + 2) view.save.unlocked = Math.min(LEVELS.length, idx + 2);
  persist();
  view.queue = [];
  view.paused = false;
  if (idx === LEVELS.length - 1) {
    view.screen = "ending";
    view.wrote = false;
    view.endCmd = "";
    view.modal = null;
    hideModal();
    syncMusic();
    return;
  }
  view.modal = "clear";
  const starText = "★".repeat(stars) + "☆".repeat(3 - stars);
  showModal(`<p class="kicker">Course clear</p>
    <h2>${level.id} ${level.name}</h2>
    <p class="stars">${starText}</p>
    <p>Keys ${state.keystrokes} &nbsp; par ${level.par}<br>
    Coins ${state.coins}/${level.totalCoins} &nbsp; deaths ${state.deaths}</p>
    <p>Finish ${bits & 1 ? "yes" : "no"}. Secret ${bits & 2 ? "yes" : "no"}. Under par ${bits & 4 ? "yes" : "no"}.</p>
    ${level.id === "1-4" ? "<p>The stacks past this king are open. That was the whole first adventure.</p>" : ""}
    <button id="next" type="button">Next</button>`);
  document.querySelector("#next").addEventListener("click", afterClear);
  audio.song("clear");
}

function goMapAfterClear() {
  view.modal = null;
  hideModal();
  const idx = LEVELS.findIndex((item) => item.id === view.level.id);
  view.mapIndex = Math.min(view.save.unlocked - 1, idx + 1);
  view.mapWorld = LEVELS[view.mapIndex].world;
  view.mapDepth = "course";
  view.screen = "map";
  syncMusic();
}

function showWorldClear(done, nextName) {
  view.modal = "world";
  showModal(`<p class="kicker">World clear</p>
    <h2>${done}</h2>
    <p>${nextName} is open.</p>
    <button id="next" type="button">Map</button>`);
  document.querySelector("#next").addEventListener("click", afterClear);
}

function afterClear() {
  if (view.modal === "world") {
    goMapAfterClear();
    return;
  }
  if (view.modal !== "clear") return;
  const idx = LEVELS.findIndex((item) => item.id === view.level.id);
  const edge = worldEdge(idx);
  if (edge) {
    showWorldClear(edge.done, edge.next);
    return;
  }
  goMapAfterClear();
}

function revive() {
  const keys = view.state?.keystrokes || 0;
  const deaths = (view.state?.deaths || 0) + 1;
  const snap = view.checkpoint || view.phaseSnap;
  const idx = LEVELS.findIndex((item) => item.id === view.level?.id);
  if (!snap) {
    if (idx >= 0) startLevel(idx);
    return;
  }
  view.state = structuredClone(snap);
  view.state.dead = false;
  view.state.keystrokes = keys;
  view.state.deaths = deaths;
  view.state.message = "The buffer reloaded.";
  view.anim = null;
  view.queue = [];
  view.undo = [];
  view.deadTimer = 0;
  view.deadUntil = 0;
  view.parser = createParser();
}

function pixel(x, y) {
  const frame = view.frame || { scale: 1, camX: view.cam || 0, camY: 0, ox: 0, oy: 16 };
  return {
    x: frame.ox + (x - frame.camX) * 16 * frame.scale + 8 * frame.scale,
    y: frame.oy + (y - frame.camY) * 16 * frame.scale + 8 * frame.scale,
  };
}

function burst(x, y, color) {
  const p = pixel(x, y);
  for (let i = 0; i < 5; i++) {
    view.particles.push({
      x: p.x,
      y: p.y,
      vx: (Math.random() - 0.5) * 2,
      vy: -Math.random() * 2,
      born: performance.now(),
      color,
      life: 300,
    });
  }
  view.particles = view.particles.filter((item) => performance.now() - item.born < (item.life || 300));
}

function landDust() {
  const p = pixel(view.state.px, view.state.py + 0.65);
  for (let i = 0; i < 4; i++) {
    view.particles.push({
      x: p.x + (i - 1.5) * 3,
      y: p.y,
      vx: (i - 1.5) * 0.7,
      vy: -0.25,
      born: performance.now(),
      color: "#e6d2b0",
      life: 260,
    });
  }
}

function react(result, snap) {
  for (const event of result.events) {
    if (event.t === "coin") {
      audio.play("coin");
      burst(event.x, event.y, "#f8d030");
    } else if (event.t === "stomp") audio.play("stomp");
    else if (event.t === "bump" || event.t === "break") audio.play(event.t === "break" ? "break" : "bump");
    else if (event.t === "die") audio.play("die");
    else if (event.t === "pipe") audio.play("pipe");
    else if (event.t === "grow" || event.t === "hit") audio.play(event.t);
    else if (event.t === "jump") audio.play("jump");
    else if (event.t === "flag") audio.play("flag");
    else if (event.t === "check") view.checkpoint = structuredClone(view.state);
    else if (event.t === "open") view.openFx = { until: performance.now() + 420, cells: event.cells || [] };
    else if (event.t === "insert") view.insertFlash = performance.now() + 500;
  }
  if (result.events.some((event) => event.t === "die" || event.t === "bump")) view.shake = 7;
  else if (result.events.some((event) => event.t === "jump" || event.t === "hit")) view.shake = 3;
  const move = result.events.find((event) => event.path);
  if (move) {
    const dur = Math.min(460, 50 * move.path.length + 70);
    const t0 = performance.now();
    view.anim = {
      points: [{ x: snap.px, y: snap.py }, ...move.path],
      t0,
      dur,
      until: t0 + dur,
      kind: move.t,
    };
  }
  if (view.state.dead) {
    view.queue = [];
    view.deadUntil = performance.now() + 700;
    view.deadTimer = performance.now() + 760;
    view.holdClear = false;
  } else if (result.phaseClear) {
    view.queue = [];
    view.holdClear = true;
  }
}

function colon(cmd) {
  if (view.fuseRun && (cmd.name === "quit" || cmd.name === "map")) {
    view.fuseRun = null;
    view.paused = false;
    view.screen = "title";
    syncMusic();
    return;
  }
  if (view.fuseRun && cmd.name === "retry") {
    startFuse();
    return;
  }
  if (cmd.name === "help") {
    freezeFuse();
    openCodex();
  }
  else if (cmd.name === "quit" || cmd.name === "map") toMap();
  else if (cmd.name === "retry") startLevel(LEVELS.findIndex((item) => item.id === view.level.id));
  else if (cmd.name === "mute") toggleMute();
  else if (cmd.name === "hint") {
    const hints = view.level?.hints || [];
    const tier = view.hintTier || 0;
    if (!hints.length) view.state.message = "No hint on this course.";
    else {
      view.state.message = hints[Math.min(tier, hints.length - 1)];
      view.state.lesson = tier === 0 ? "What is in the way." : tier === 1 ? "Which family of command." : "One way through.";
      if (tier < hints.length) view.hintTier = tier + 1;
    }
  }
  else if (cmd.name === "wq") view.state.message = "Nothing to write yet. Clear the castle, then :wq.";
  else view.state.message = "Not a command. Try :help, :hint, :retry, :q, or :mute.";
}

function freezeFuse() {
  if (!view.fuseRun || view.fuseRun.frozen) return;
  view.fuseRun.left = Math.max(0, view.fuseRun.deadline - performance.now());
  view.fuseRun.frozen = true;
}

function thawFuse() {
  if (!view.fuseRun?.frozen) return;
  view.fuseRun.deadline = performance.now() + (view.fuseRun.left ?? view.fuseRun.fuse);
  view.fuseRun.frozen = false;
}

function mountBeat(index) {
  const beat = view.fuseRun.practice ? BEATS[view.fuseRun.beatId] : BEATS[beatIdAt(view.fuseRun.date, index)];
  const ms = view.fuseRun.practice ? 86400000 : fuseMs(index);
  view.fuseRun.index = index;
  view.fuseRun.beat = beat;
  view.fuseRun.fuse = ms;
  view.fuseRun.pendingPass = false;
  view.fuseRun.frozen = false;
  view.fuseRun.deadline = performance.now() + ms;
  view.level = buildLevel(beat);
  ensureLevel(view.level);
  view.state = createGame(view.level);
  view.parser = createParser();
  view.undo = [];
  view.queue = [];
  view.anim = null;
  view.holdClear = false;
  view.paused = false;
  view.deadTimer = 0;
  view.deadUntil = 0;
  view._teach = "";
  view.screen = "play";
  hideModal();
}

function fuseDate() {
  try {
    const picked = new URLSearchParams(location.search).get("fuse");
    if (picked && /^\d{4}-\d{2}-\d{2}$/.test(picked)) return picked;
  } catch {
    /* tests and odd hosts have no location */
  }
  return dayKey(new Date());
}

function startFuse() {
  const date = fuseDate();
  view.shareNote = "";
  view.fuseOut = null;
  view.fuseRun = { date, index: 0, score: 0, cardClear: false, marks: [] };
  mountBeat(0);
  syncMusic();
  canvas.focus();
}

function endFuse(reason, won) {
  const run = view.fuseRun;
  if (!run) return;
  const record = applyRun(view.save.fuse, run.date, run.score);
  view.save.fuse = record.save;
  persist();
  view.fuseOut = {
    reason,
    hint: run.beat?.hint || "",
    score: run.score,
    best: record.save.best,
    streak: record.save.streak,
    rank: rankFor(record.save.best),
    next: nextRank(record.save.best),
    fresh: record.freshBest,
    cleared: won ? run.index + 1 : run.index,
    card: won || run.cardClear,
    won: Boolean(won),
    date: run.date,
    beatId: run.beat?.id || "",
    marks: [...(run.marks || []), ...(won ? [] : ["miss"])],
  };
  view.fuseRun = null;
  view.queue = [];
  view.paused = false;
  view.holdClear = false;
  view.deadTimer = 0;
  view.parser = createParser();
  view.screen = "fuseout";
  syncMusic();
}

function disqualify(reason) {
  endFuse(reason, false);
}

function applyFuse(cmd) {
  if (cmd.op === "colon") return colon(cmd);
  if (cmd.op === "undo") {
    disqualify("Undo ends the run.");
    return;
  }
  const beat = view.fuseRun.beat;
  const snap = structuredClone(view.state);
  view.state.keystrokes += cmd.keystrokes || 1;
  const result = step(view.state, view.level, cmd);
  react(result, snap);
  view.holdClear = false;
  view.deadTimer = 0;
  if (judge(beat, view.state, result) === "pass") {
    const left = Math.max(0, view.fuseRun.deadline - performance.now());
    view.fuseRun.score += pointsFor(view.fuseRun.index, left, view.fuseRun.fuse);
    view.state.dead = false;
    view.state.phaseClear = false;
    if (view.fuseRun.practice) {
      view.practiceNote = "That motion works. Enter runs today's card.";
      view.fuseRun = null;
      view.screen = "fuse";
      syncMusic();
      return;
    }
    if (view.fuseRun.index === CARD_ROOMS - 1) view.fuseRun.cardClear = true;
    view.fuseRun.marks = view.fuseRun.marks || [];
    view.fuseRun.marks.push("pass");
    view.fuseRun.pendingPass = true;
    return;
  }
  if (view.fuseRun.practice) {
    view.state.dead = false;
    view.state.message = missLine(beat, view.state);
    mountBeat(0);
    return;
  }
  disqualify(missLine(beat, view.state));
}

function apply(cmd) {
  if (view.fuseRun) return applyFuse(cmd);
  if (cmd.op === "colon") return colon(cmd);
  if (cmd.op === "undo") {
    view.state.keystrokes += cmd.keystrokes || 1;
    if (!view.undo.length) {
      view.state.message = "Nothing to undo.";
      return;
    }
    const keys = view.state.keystrokes;
    const deaths = view.state.deaths;
    view.state = structuredClone(view.undo.pop());
    view.state.keystrokes = keys;
    view.state.deaths = deaths;
    view.state.message = "Undone.";
    view.anim = null;
    return;
  }
  const snap = structuredClone(view.state);
  view.state.keystrokes += cmd.keystrokes || 1;
  const result = step(view.state, view.level, cmd);
  if (result.changed) view.undo.push(snap);
  if (view.undo.length > 30) view.undo.shift();
  react(result, snap);
}

function pump(now) {
  if (view.screen !== "play" || view.modal || view.paused) return;
  if (view.fuseRun?.pendingPass && !(view.anim && now < view.anim.until)) {
    view.anim = null;
    mountBeat(view.fuseRun.index + 1);
    return;
  }
  if (!view.fuseRun && view.deadTimer && now > view.deadTimer) revive();
  if (view.anim && now < view.anim.until) return;
  if (view.anim && (view.anim.kind === "jump" || view.anim.kind === "dash")) landDust();
  view.anim = null;
  if (view.fuseRun && !view.fuseRun.practice && !view.queue.length && now >= view.fuseRun.deadline) {
    disqualify("Too slow. The window closed.");
    return;
  }
  if (view.holdClear) {
    view.holdClear = false;
    const won = advancePhase(view.state, view.level);
    if (won) finishLevel();
    else {
      view.checkpoint = null;
      checkpoint();
      view.undo = [];
      view.parser = createParser();
      syncMusic();
    }
    return;
  }
  if (!view.queue.length || view.state.dead) return;
  apply(view.queue.shift());
}

function titleKey(key) {
  const items = menuItems();
  if (key === "j" || key === "ArrowDown") view.menu = Math.min(items.length - 1, view.menu + 1);
  else if (key === "k" || key === "ArrowUp") view.menu = Math.max(0, view.menu - 1);
  else if (key === "Enter" || key === "l") choose(items[view.menu]);
}

function choose(item) {
  if (item === "CONTROLS") return openCodex();
  if (item === "TIMED") {
    view.fuseRun = null;
    view.fuseOut = null;
    view.screen = "fuse";
    syncMusic();
    return;
  }
  if (item === "CONTINUE") {
    view.mapIndex = Math.max(0, Math.min(LEVELS.length - 1, view.save.unlocked - 1));
    view.mapWorld = LEVELS[view.mapIndex].world;
    view.mapDepth = "course";
  } else {
    view.mapIndex = 0;
    view.mapWorld = 1;
    view.mapDepth = "world";
  }
  if (!view.save.seenLetter) openLetter();
  else {
    view.screen = "map";
    syncMusic();
  }
}

function levelsIn(world) {
  return LEVELS.map((level, index) => ({ level, index })).filter((row) => row.level.world === world && row.index < view.save.unlocked);
}

function mapKey(key) {
  if (view.mapDepth !== "course") {
    const openWorlds = [...new Set(LEVELS.slice(0, view.save.unlocked).map((level) => level.world))];
    const at = Math.max(0, openWorlds.indexOf(view.mapWorld || 1));
    if (key === "h" || key === "k") view.mapWorld = openWorlds[Math.max(0, at - 1)] || 1;
    else if (key === "l" || key === "j") view.mapWorld = openWorlds[Math.min(openWorlds.length - 1, at + 1)] || view.mapWorld;
    else if (key === "Enter") {
      const rows = levelsIn(view.mapWorld);
      if (!rows.length) return;
      view.mapDepth = "course";
      view.mapIndex = rows[rows.length - 1].index;
    } else if (key === "Escape") {
      view.screen = "title";
      syncMusic();
    }
    return;
  }
  const rows = levelsIn(view.mapWorld);
  const at = Math.max(0, rows.findIndex((row) => row.index === view.mapIndex));
  if (key === "k" || key === "h") view.mapIndex = rows[Math.max(0, at - 1)].index;
  else if (key === "j" || key === "l") view.mapIndex = rows[Math.min(rows.length - 1, at + 1)].index;
  else if (key === "Enter") startLevel(view.mapIndex);
  else if (key === "Escape") view.mapDepth = "world";
}

function endingKey(key) {
  if (view.wrote && (key === "Enter" || key === "Escape")) {
    view.screen = "map";
    view.mapIndex = LEVELS.length - 1;
    view.mapWorld = LEVELS[view.mapIndex].world;
    view.mapDepth = "course";
    syncMusic();
    return;
  }
  if (!view.endCmd && key === "Escape") {
    view.screen = "map";
    syncMusic();
    return;
  }
  if (!view.endCmd && key === ":") {
    view.endCmd = ":";
    return;
  }
  if (!view.endCmd) return;
  if (key === "Enter") {
    view.wrote = view.endCmd === ":wq";
    if (view.wrote) audio.play("flag");
    else view.endCmd = "";
    if (!view.wrote) view.stateMessage = "The last command is :wq";
    view.endCmd = view.wrote ? ":wq" : "";
    return;
  }
  if (key === "Backspace") {
    view.endCmd = view.endCmd.slice(0, -1);
    return;
  }
  if (key === "Escape") {
    view.endCmd = "";
    return;
  }
  if (key.length === 1) view.endCmd += key;
}

function onKey(key) {
  audio.unlock();
  if (view.save.mute) audio.setMuted(true);
  if (view.screen === "boot") {
    view.screen = "title";
    syncMusic();
    return;
  }
  if (view.modal === "letter") {
    if (key === "Enter" || key === "Escape") {
      view.save.seenLetter = true;
      persist();
      view.modal = null;
      hideModal();
      view.screen = "map";
      syncMusic();
    }
    return;
  }
  if (view.modal === "codex") {
    if (key === "Escape" || key === "Enter") {
      view.modal = null;
      hideModal();
      thawFuse();
    }
    return;
  }
  if (view.modal === "clear" || view.modal === "world") {
    if (key === "Enter" || key === " ") afterClear();
    return;
  }
  if (view.screen === "title") return titleKey(key);
  if (view.screen === "fuse") {
    if (key === "Enter" || key === "l") startFuse();
    else if (key === "Escape") {
      view.screen = "title";
      syncMusic();
    }
    return;
  }
  if (view.screen === "fuseout") {
    if (key === "p" && view.fuseOut?.beatId) {
      view.fuseRun = { date: "practice", index: 0, score: 0, cardClear: false, practice: true, beatId: view.fuseOut.beatId };
      view.fuseOut = null;
      mountBeat(0);
      syncMusic();
    } else if (key === "c") copyShare();
    else if (key === "Enter" || key === "l") startFuse();
    else if (key === "Escape") {
      view.screen = "title";
      syncMusic();
    }
    return;
  }
  if (view.screen === "map") return mapKey(key);
  if (view.screen === "ending") return endingKey(key);
  if (view.screen !== "play") return;
  if (view.paused) {
    if (key === "Enter" || key === "Escape") {
      view.paused = false;
      thawFuse();
      return;
    }
    if (view.fuseRun) return;
  }
  const fed = feed(view.parser, key);
  if (fed.type === "pause") {
    if (view.fuseRun && !view.paused) freezeFuse();
    view.paused = !view.paused;
    if (view.fuseRun && !view.paused) thawFuse();
    return;
  }
  if (fed.type === "command") {
    fed.command.keystrokes = fed.keystrokes;
    if (view.paused && fed.command.op !== "colon") return;
    if (view.queue.length >= 8) return;
    view.queue.push(fed.command);
  }
}

function toggleMute() {
  view.save.mute = !view.save.mute;
  audio.setMuted(view.save.mute);
  if (!view.save.mute) syncMusic();
  else audio.stop();
  persist();
  els.mute.textContent = view.save.mute ? "Sound off" : "Sound on";
}

const PAD = {
  h: ["h", "l"],
  j: ["j"],
  k: ["k"],
  l: ["h", "l"],
  w: ["w"],
  b: ["b"],
  e: ["e"],
  0: ["0", "^", "$"],
  $: ["0", "^", "$"],
  u: ["u"],
  G: ["G", "gg"],
  W: ["W"],
  "%": ["%"],
  r: ["r"],
  "*": ["*"],
  "}": ["}", "{"],
  "'": ["'", "m"],
  ".": ["."],
};

function syncPad() {
  const playing = view.screen === "play" && view.level;
  const tags = new Set(playing ? view.level.teach || [] : ["h", "j", "k", "l"]);
  if (playing) tags.add("u");
  document.querySelectorAll("#pad [data-k]").forEach((btn) => {
    const key = btn.dataset.k;
    if (key === "retry") {
      btn.hidden = !playing;
      return;
    }
    const need = PAD[key] || [key];
    btn.hidden = !need.some((tag) => tags.has(tag));
  });
}

function teachRows() {
  return [
    [["h", "l"], "<kbd>h l</kbd> left and right"],
    [["j"], "<kbd>j</kbd> down, or drop"],
    [["k"], "<kbd>k</kbd> up, jump, or bump"],
    [["w", "b", "e"], "<kbd>w b e</kbd> word motions"],
    [["0", "^", "$"], "<kbd>0 ^ $</kbd> start, first text, end"],
    [["f", "t", "F", ";", ","], "<kbd>f t ;</kbd> find, till, repeat"],
    [["G", "gg"], "<kbd>G gg</kbd> last line, first line"],
    [["/", "n", "N"], "<kbd>/</kbd> search. n next. N back"],
    [["x"], "<kbd>x</kbd> delete under the cursor"],
    [["W", "B", "E"], "<kbd>W</kbd> WORD, skips punctuation"],
    [["%"], "<kbd>%</kbd> matching bracket"],
    [["r"], "<kbd>r</kbd> replace this character"],
    [["*"], "<kbd>*</kbd> next copy of this word"],
    [["}", "{"], "<kbd>}</kbd> next blank line"],
    [["g", "u", "U"], "<kbd>guu</kbd> quiet line, <kbd>gUw</kbd> shout word"],
    [["m", "'"], "<kbd>ma</kbd> mark, <kbd>'a</kbd> return"],
    [["."], "<kbd>.</kbd> repeat the last x or r"],
  ];
}

function statLabels(a, b, c, d) {
  if (els.statA) els.statA.textContent = a;
  if (els.statB) els.statB.textContent = b;
  if (els.statC) els.statC.textContent = c;
  if (els.statD) els.statD.textContent = d;
}

function updateDom() {
  totals();
  view.menuItems = menuItems();
  if (els.share) els.share.hidden = view.screen !== "fuseout";
  const playing = view.screen === "play" && view.state && view.level;
  const fuseSave = view.save.fuse || emptyFuse();
  if (view.screen === "fuse" || view.screen === "fuseout") {
    const out = view.fuseOut;
    const today = dayKey(new Date());
    const todayScore = fuseSave.days?.[today];
    statLabels("Score", "Best", "Streak", "Rank");
    els.kicker.textContent = "Timed";
    els.lvname.textContent = view.screen === "fuseout" ? "Disqualified" : "Today's card";
    els.objective.textContent =
      view.screen === "fuseout"
        ? `${out?.reason || "Miss."} Enter runs it again. Esc returns to the title.`
        : "One motion per room. The bar shrinks. A miss ends the run. Room 12 pays a bonus, then overtime.";
    els.hint.textContent =
      view.screen === "fuseout"
        ? view.shareNote || out?.hint || "Same card until midnight. C copies the result."
        : (view.practiceNote || "A new card after midnight. Add ?fuse=YYYY-MM-DD to share today's card.");
    els.keys.textContent = String(view.screen === "fuseout" ? out?.score ?? 0 : todayScore ?? 0);
    els.par.textContent = String(fuseSave.best || 0);
    els.coins.textContent = String(fuseSave.streak || 0);
    els.deaths.textContent = rankFor(fuseSave.best || 0);
    if (els.share && view.screen === "fuseout" && !view.shareNote) els.share.textContent = "Copy result";
    if (view._teach !== "fuse-lobby") {
      view._teach = "fuse-lobby";
      els.teach.innerHTML = [
        "<li>The bar is the window. It gets shorter every clear.</li>",
        "<li>Wrong motion or lava ends the run. No retry inside it.</li>",
        "<li>Room 12 pays the card bonus. Overtime stays fast.</li>",
        "<li>Esc pauses. :q leaves without saving the run.</li>",
      ].join("");
    }
  } else if (!playing) {
    els.kicker.textContent = view.screen === "map" ? "Select a course" : "Normal mode";
    els.lvname.textContent = view.screen === "ending" ? "Princess Normal" : "Vimario";
    els.objective.textContent =
      view.screen === "map"
        ? view.mapDepth === "course"
          ? "j and k choose a course. Enter starts it. Esc goes back to the worlds."
          : "h and l choose a world. Enter opens its courses."
        : view.screen === "ending"
          ? "Type :wq to write the buffer and leave."
          : "A side-scroller that only moves when you type a vim motion.";
    els.hint.textContent = "j is down. k is up. Arrows do nothing.";
    statLabels("Keys", "Par", "Coins", "Deaths");
    els.keys.textContent = "—";
    els.par.textContent = "—";
    els.coins.textContent = "—";
    els.deaths.textContent = "—";
  } else if (view.fuseRun) {
    const level = view.level;
    const run = view.fuseRun;
    statLabels("Score", "Beat", "Streak", "Best");
    els.kicker.textContent = "Timed";
    els.lvname.textContent = run.beat.name;
    els.objective.textContent = level.objective;
    els.hint.textContent = run.cardClear ? "Overtime. The window stays short." : "One motion. Room 12 clears the card.";
    els.keys.textContent = String(run.score);
    els.par.textContent = String(run.index + 1);
    els.coins.textContent = String(fuseSave.streak || 0);
    els.deaths.textContent = String(fuseSave.best || 0);
    if (view._teach !== level.id) {
      view._teach = level.id;
      const tags = new Set(level.teach);
      const rows = teachRows();
      els.teach.innerHTML = rows
        .filter(([need]) => need.some((tag) => tags.has(tag)))
        .map(([, html]) => `<li>${html}</li>`)
        .join("");
    }
  } else {
    const level = view.level;
    const state = view.state;
    els.kicker.textContent = `World ${level.world} · ${level.worldName}`;
    els.lvname.textContent = `${level.id} ${level.name}`;
    els.objective.textContent = level.objective;
    els.hint.textContent = view.fileWarning || state.hint || state.message || level.blurb;
    els.keys.textContent = String(state.keystrokes);
    els.par.textContent = String(level.par);
    els.coins.textContent = `${state.coins}/${level.totalCoins}`;
    statLabels("Keys", "Par", "Coins", "Deaths");
    els.deaths.textContent = String(state.deaths);
    if (view._teach !== level.id) {
      view._teach = level.id;
      const tags = new Set(level.teach);
      const rows = teachRows();
      els.teach.innerHTML = rows
        .filter(([need]) => need.some((tag) => tags.has(tag)))
        .map(([, html]) => `<li>${html}</li>`)
        .join("");
    }
  }
  const mode = view.paused
    ? "PAUSED"
    : view.screen === "ending"
      ? "WRITE"
      : view.screen === "fuse" || view.screen === "fuseout" || view.fuseRun
        ? "TIMED"
        : playing && view.state.kind === "maze"
          ? "BUFFER"
          : playing && view.state.kind === "boss"
            ? "BOSS"
            : "NORMAL";
  els.mode.textContent = mode;
  const typed = view.screen === "ending" ? view.endCmd : view.screen === "play" ? parserDisplay(view.parser) : "";
  els.cmd.textContent = typed || "—";
  els.lesson.textContent = playing ? view.state.lesson || view.state.message || "Esc pauses. :help opens the controls." : "Esc pauses during a course. :help opens the controls.";
  els.worlds.querySelectorAll("li").forEach((li, i) => {
    li.classList.toggle("now", playing && view.level.world === i + 1);
  });
  syncPad();
}

function frame(now) {
  try {
    view.menuItems = menuItems();
    if (view.screen === "boot" && now - view.bootAt > 1700) {
      view.screen = "title";
      syncMusic();
    }
    pump(now);
    draw(ctx, view, now);
    updateDom();
  } catch (err) {
    console.error(err);
  }
  requestAnimationFrame(frame);
}

window.addEventListener("keydown", (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.target.id === "type") return;
  const watch = [" ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "/", "?"];
  if (watch.includes(event.key) || event.key.length === 1 || event.key === "Backspace" || event.key === "Escape" || event.key === "Enter") {
    event.preventDefault();
  }
  onKey(event.key);
});

document.body.addEventListener("click", (event) => {
  const key = event.target.dataset?.k;
  if (!key) return;
  audio.unlock();
  if (key === "help") {
    if (view.screen !== "play") openCodex();
    else {
      for (const ch of ":help") onKey(ch);
      onKey("Enter");
    }
    return;
  }
  if (key === "retry") {
    if (view.screen === "play") {
      for (const ch of ":retry") onKey(ch);
      onKey("Enter");
    }
    return;
  }
  onKey(key);
});

document.querySelector("#type").addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  const text = event.target.value;
  event.target.value = "";
  for (const ch of text) onKey(ch);
  onKey("Enter");
});

els.mute.addEventListener("click", () => {
  audio.unlock();
  toggleMute();
});

els.share?.addEventListener("click", () => {
  copyShare();
});

canvas.addEventListener("click", () => {
  audio.unlock();
  if (!view.save.mute) syncMusic();
  canvas.focus();
});

if (location.protocol === "file:") view.fileWarning = "This page needs a server. Run python3 -m http.server 8765";

const commands = document.querySelector("#commands");
if (commands && window.matchMedia("(pointer: coarse), (max-width: 700px)").matches) commands.open = true;

els.mute.textContent = view.save.mute ? "Sound off" : "Sound on";
audio.setMuted(view.save.mute);

function fitScreen() {
  canvas.style.width = "256px";
  canvas.style.height = "240px";
  const tv = document.querySelector(".tv");
  const bezel = 28;
  const column = (tv?.clientWidth || 256) - bezel;
  const viewport = document.documentElement.clientWidth - 40 - bezel;
  const scale = screenScale(Math.min(column, viewport));
  canvas.style.width = `${256 * scale}px`;
  canvas.style.height = `${240 * scale}px`;
}

function shareText() {
  const out = view.fuseOut;
  if (!out) return "";
  return shareCard(out.date, out.marks || [], out.rank);
}

async function copyShare() {
  const text = shareText();
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    view.shareNote = "Copied.";
    if (els.share) els.share.textContent = "Copied";
  } catch {
    view.shareNote = text;
    if (els.share) els.share.textContent = "Copy failed. The line is above.";
  }
}

fitScreen();
window.addEventListener("resize", fitScreen);

window.__vimario = { view, startLevel, onKey, enterPhase };
requestAnimationFrame(frame);
