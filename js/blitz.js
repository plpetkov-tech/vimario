// Daily fuse. One motion per room. The window shrinks. A miss ends the run.

const EASY = ["step", "end", "till"];
const MID = ["count", "comma", "back", "caret"];
const HARD = ["match", "star", "para", "skip", "write"];

export const BEATS = {
  step: {
    id: "step",
    name: "Step",
    hint: "One motion onto ~",
    teach: ["l", "w"],
    rows: ["@~"],
    goal: { x: 1, y: 0 },
    hit: "l",
    miss: "h",
  },
  end: {
    id: "end",
    name: "End",
    hint: "End of the word",
    teach: ["e"],
    rows: ["cat"],
    start: { x: 0, y: 0 },
    goal: { x: 2, y: 0 },
    hit: "e",
    miss: "w",
  },
  till: {
    id: "till",
    name: "Till",
    hint: "Land on ~. t stops short",
    teach: ["f", "t"],
    rows: ["go  m ~"],
    start: { x: 0, y: 0 },
    goal: { x: 6, y: 0 },
    hit: "f~",
    miss: "t~",
  },
  count: {
    id: "count",
    name: "Count",
    hint: "Five right, one motion",
    teach: ["l"],
    rows: ["@....X"],
    goal: { x: 5, y: 0 },
    hit: "5l",
    miss: "4l",
  },
  comma: {
    id: "comma",
    name: "Comma",
    hint: "The comma is lava",
    teach: ["W"],
    rows: ["hello, ~"],
    start: { x: 0, y: 0 },
    spikeChars: [","],
    goal: { x: 7, y: 0 },
    hit: "W",
    miss: "w",
  },
  back: {
    id: "back",
    name: "Back",
    hint: "Back onto ~",
    teach: ["b"],
    rows: ["~ cat"],
    start: { x: 2, y: 0 },
    goal: { x: 0, y: 0 },
    hit: "b",
    miss: "h",
  },
  caret: {
    id: "caret",
    name: "Caret",
    hint: "First text on the line",
    teach: ["^", "0"],
    rows: ["   cat"],
    start: { x: 5, y: 0 },
    goal: { x: 3, y: 0 },
    hit: "^",
    miss: "0",
  },
  match: {
    id: "match",
    name: "Match",
    hint: "Match, not the first )",
    teach: ["%"],
    rows: ["@((Q)Q)~"],
    spikeChars: ["Q"],
    goal: { x: 6, y: 0 },
    hit: "%",
    miss: "f)",
  },
  star: {
    id: "star",
    name: "Echo",
    hint: "The other door",
    teach: ["*"],
    rows: ["door``QQ``door"],
    start: { x: 0, y: 0 },
    spikeChars: ["Q"],
    goal: { x: 10, y: 0 },
    hit: "*",
    miss: "w",
  },
  para: {
    id: "para",
    name: "Blanks",
    hint: "Two blanks, one motion",
    teach: ["}"],
    rows: ["@ QQ", "", "~"],
    spikeChars: ["Q"],
    goal: { x: 0, y: 2 },
    hit: "2}",
    miss: "}",
  },
  skip: {
    id: "skip",
    name: "Skip",
    hint: "QQ is lava",
    teach: ["w"],
    rows: ["red``QQ``~"],
    start: { x: 0, y: 0 },
    spikeChars: ["Q"],
    goal: { x: 9, y: 0 },
    hit: "2w",
    miss: "w",
  },
  write: {
    id: "write",
    name: "Write",
    hint: "Stand on X. Then r~",
    teach: ["r"],
    rows: ["#X#"],
    start: { x: 1, y: 0 },
    byExit: true,
    hit: "r~",
    miss: "l",
  },
};

const RANKS = [
  [0, "CURSOR"],
  [400, "TYPIST"],
  [800, "MOTION"],
  [1200, "WORD"],
  [1600, "CARD"],
  [2200, "OVERTIME"],
  [3000, "NORMAL"],
];

function hash(text) {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(list, rnd) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const swap = copy[i];
    copy[i] = copy[j];
    copy[j] = swap;
  }
  return copy;
}

function deck(dateKey) {
  const rnd = mulberry32(hash(String(dateKey)));
  return {
    easy: shuffle(EASY, rnd),
    mid: shuffle(MID, rnd),
    hard: shuffle(HARD, rnd),
  };
}

export function beatIdAt(dateKey, index) {
  const parts = deck(dateKey);
  const card = [...parts.easy, ...parts.mid, ...parts.hard];
  if (index < card.length) return card[index];
  const extra = index - card.length;
  return parts.hard[extra % parts.hard.length];
}

export function cardIds(dateKey) {
  return Array.from({ length: 12 }, (_, index) => beatIdAt(dateKey, index));
}

export function fuseMs(index) {
  return Math.max(720, Math.round(4800 * 0.86 ** index));
}

export function pointsFor(index, left, fuse) {
  const speed = Math.round((50 * Math.max(0, left)) / fuse);
  const card = index === CARD_ROOMS - 1 ? 400 : 0;
  return 100 + speed + card;
}

export function rankFor(score) {
  let name = RANKS[0][1];
  for (const [need, title] of RANKS) if (score >= need) name = title;
  return name;
}

export function nextRank(score) {
  for (const [need, title] of RANKS) if (score < need) return { need, title };
  return null;
}

export function dayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function prevDay(key) {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() - 1);
  return dayKey(date);
}

export const CARD_ROOMS = 12;

export function emptyFuse() {
  return { lastDay: "", streak: 0, best: 0, days: {} };
}

export function nextCardIn(now = new Date()) {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const ms = next.getTime() - now.getTime();
  return { h: Math.floor(ms / 3600000), m: Math.floor((ms % 3600000) / 60000) };
}

export function applyRun(prev, date, score) {
  const save = {
    lastDay: prev?.lastDay || "",
    streak: prev?.streak || 0,
    best: prev?.best || 0,
    days: { ...(prev?.days || {}) },
  };
  const freshBest = score > save.best;
  save.best = Math.max(save.best, score);
  save.days[date] = Math.max(save.days[date] || 0, score);
  if (save.lastDay !== date) {
    save.streak = save.lastDay === prevDay(date) ? save.streak + 1 : 1;
    save.lastDay = date;
  }
  const keep = Object.keys(save.days).sort().slice(-14);
  save.days = Object.fromEntries(keep.map((day) => [day, save.days[day]]));
  return { save, freshBest };
}

export function judge(beat, state, result) {
  if (state.dead) return "miss";
  if (beat.byExit) return result.phaseClear ? "pass" : "miss";
  if (beat.goal && state.px === beat.goal.x && state.py === beat.goal.y) return "pass";
  return "miss";
}

export function buildLevel(beat) {
  const width = Math.max(...beat.rows.map((row) => row.length));
  const rows = beat.rows.map((row) => row.padEnd(width, " "));
  return {
    id: `fuse-${beat.id}`,
    world: 7,
    worldName: "Fuse",
    name: beat.name,
    blurb: beat.hint,
    objective: beat.hint,
    teach: beat.teach,
    par: 9,
    phases: [
      {
        kind: "maze",
        rows,
        intro: beat.hint,
        spikeChars: beat.spikeChars,
        start: beat.start,
        coins: [],
      },
    ],
  };
}

export function missLine(beat, state) {
  if (!state) return "Too slow. The window closed.";
  if (state.dead && state.message.startsWith(",")) return "Miss. The comma got you.";
  if (state.dead && state.message.includes("lava")) return "Miss. That cell is lava.";
  if (state.dead) return "Miss. That motion does not survive.";
  return `Miss. ${beat.hint}`;
}
