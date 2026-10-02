// Thirty-three courses. Early pits punish a held l. Later worlds change the rule.

function course(w, h, draw) {
  const g = Array.from({ length: h }, () => Array.from({ length: w }, () => "."));
  const signs = [];
  const questions = [];
  const api = {
    plot(x, y, ch) {
      g[y][x] = ch;
    },
    fill(x, y, ww, hh, ch) {
      for (let j = 0; j < hh; j++) for (let i = 0; i < ww; i++) g[y + j][x + i] = ch;
    },
    ground(y) {
      api.fill(0, y, w, h - y, "#");
    },
    pit(x, y) {
      for (let j = y; j < h; j++) g[j][x] = ".";
    },
    sign(x, y, text) {
      g[y][x] = "S";
      signs.push({ x, y, text });
    },
    ask(x, y, item, extra = {}) {
      g[y][x] = "?";
      questions.push({ x, y, item, ...extra });
    },
  };
  draw(api);
  return { rows: g.map((row) => row.join("")), signs, questions };
}

function buffer(rows, extra = {}) {
  const w = Math.max(...rows.map((r) => r.length));
  const padded = rows.map((r) => r.padEnd(w, " "));
  return { kind: "maze", rows: padded, ...extra };
}

function at(rows, ch, nth = 0) {
  let seen = 0;
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      if (rows[y][x] === ch) {
        if (seen === nth) return { x, y };
        seen += 1;
      }
    }
  }
  throw new Error(`missing ${ch} #${nth}`);
}

export function zigzagLegs(rows, cols) {
  const legs = [];
  for (let c = 0; c < cols; c++) {
    legs.push([c % 2 === 0 ? "d" : "u", rows - 1]);
    if (c !== cols - 1) legs.push(["r", 2]);
  }
  return legs;
}

export function trailKeys(legs) {
  const map = { r: "l", l: "h", d: "j", u: "k" };
  return legs.map(([dir, n]) => (n > 1 ? String(n) : "") + map[dir]).join("");
}

export function snakeMaze(legs) {
  const cells = [];
  let x = 0;
  let y = 0;
  cells.push([x, y]);
  const dirs = { r: [1, 0], l: [-1, 0], d: [0, 1], u: [0, -1] };
  for (const [dir, n] of legs) {
    const [dx, dy] = dirs[dir];
    for (let i = 0; i < n; i++) {
      x += dx;
      y += dy;
      cells.push([x, y]);
    }
  }
  const minX = Math.min(...cells.map((c) => c[0]));
  const minY = Math.min(...cells.map((c) => c[1]));
  const maxX = Math.max(...cells.map((c) => c[0]));
  const maxY = Math.max(...cells.map((c) => c[1]));
  const grid = Array.from({ length: maxY - minY + 3 }, () => Array.from({ length: maxX - minX + 3 }, () => "#"));
  cells.forEach(([cx, cy], index) => {
    const gx = cx - minX + 1;
    const gy = cy - minY + 1;
    let ch = ".";
    if (index === 0) ch = "@";
    else if (index === cells.length - 1) ch = "~";
    else if (index % 11 === 6) ch = "*";
    grid[gy][gx] = ch;
  });
  return grid.map((row) => row.join(""));
}

function stairs(a, x) {
  a.fill(x + 1, 10, 1, 4, "#");
  a.fill(x + 2, 9, 1, 5, "#");
  a.fill(x + 3, 8, 1, 6, "#");
  a.fill(x + 4, 7, 1, 7, "#");
  a.fill(x + 5, 7, 1, 7, "#");
  a.plot(x + 5, 6, "F");
  a.plot(x + 5, 5, "F");
  a.plot(x + 5, 4, "F");
}

function gauntlet(segments, sign) {
  const start = 2;
  const end = start + segments * 9;
  const width = end + 10;
  return {
    kind: "course",
    goal: "flag",
    intro: sign,
    ...course(width, 14, (a) => {
      a.ground(11);
      a.plot(start, 10, "@");
      a.sign(start + 2, 10, sign);
      let s = start;
      for (let i = 0; i < segments; i++) {
        a.plot(s + 5, 10, "G");
        a.pit(s + 8, 11);
        a.plot(s + 9, 10, "C");
        s += 9;
      }
      stairs(a, end);
    }),
  };
}

function chain(kinds, sign, back = false) {
  const w = 5;
  const width = 4 + kinds.length * (w + 3);
  let lastEnd = 1;
  const built = course(width, 14, (a) => {
    let x = 1;
    kinds.forEach((kind, i) => {
      a.fill(x, 11, w, 3, kind === "spike" ? "^" : "#");
      if (i === 0) {
        if (!back) a.plot(2, 10, "@");
        a.sign(3, 10, sign);
      }
      if (back && i === kinds.length - 1) a.sign(x + 1, 10, sign);
      if (/^[a-z]$/.test(kind)) {
        a.plot(x, 10, kind);
        a.plot(x + w - 1, 10, "C");
      } else if (kind.endsWith("!")) {
        a.plot(x, 10, kind[0]);
        a.plot(x + w - 1, 10, "F");
      } else if (kind === "flag") {
        a.plot(x, 10, "C");
        a.plot(x + w - 1, 10, "F");
      } else if (kind === "safe") {
        a.plot(back && i === kinds.length - 1 ? x : x + w - 1, 10, "C");
      }
      lastEnd = x + w - 1;
      x += w + 3;
    });
  });
  return {
    kind: "course",
    goal: "flag",
    intro: sign,
    ...(back ? { start: { x: lastEnd, y: 10 } } : {}),
    ...built,
  };
}

function wordSkip(sign) {
  const kinds = ["start", "spike", "safe", "spike", "safe", "spike", "flag"];
  const w = 5;
  const width = 4 + kinds.length * (w + 3);
  return {
    kind: "course",
    goal: "flag",
    intro: sign,
    ...course(width, 14, (a) => {
      let x = 1;
      for (const kind of kinds) {
        a.fill(x, 11, w, 3, kind === "spike" ? "^" : "#");
        if (kind === "start") {
          a.plot(2, 10, "@");
          a.sign(3, 10, sign);
        } else if (kind === "safe" || kind === "flag") {
          a.plot(x, 10, "C");
          if (kind === "flag") a.plot(x + w - 1, 10, "F");
        }
        x += w + 3;
      }
    }),
  };
}

function matchCourse(sign) {
  const kinds = ["open", "spike", "pair", "spike", "pair", "spike", "close"];
  const w = 5;
  const width = 4 + kinds.length * (w + 3);
  return {
    kind: "course",
    goal: "flag",
    intro: sign,
    start: { x: 1, y: 10 },
    ...course(width, 14, (a) => {
      let x = 1;
      for (const kind of kinds) {
        a.fill(x, 11, w, 3, kind === "spike" ? "^" : "#");
        if (kind === "open") {
          a.plot(x, 10, "(");
          a.sign(x + 2, 10, sign);
        } else if (kind === "pair") {
          a.plot(x, 10, ")");
          a.plot(x + 2, 10, "C");
          a.plot(x + w - 1, 10, "(");
        } else if (kind === "close") {
          a.plot(x, 10, ")");
          a.plot(x + 2, 10, "C");
          a.plot(x + w - 1, 10, "F");
        }
        x += w + 3;
      }
    }),
  };
}

function hall(legs, sign) {
  return buffer(snakeMaze(legs), { intro: sign });
}

const wordMaze = ["@``the``QQ``quick``QQ``fox", "``jumps``QQ``over``QQ``dog", "``and``QQ``the``lazy``~"];
const wordMazeRows = wordMaze.map((row) => row.padEnd(Math.max(...wordMaze.map((r) => r.length)), " "));

const lineRoom = ["    red````blue", "    gold````jade", "    mint````plum", "    ink````exit~"].map((row, _i, all) =>
  row.padEnd(Math.max(...all.map((r) => r.length)), " "),
);

const findHall = ["@", " ", " ", " ", " ", " ", "go   mQ  mQ  mQ  mQ  mQ ~"];
const findHallRows = findHall.map((row) => row.padEnd(findHall[findHall.length - 1].length, " "));

const findLong = ["@    mQ   mQ   mQ   mQ   mQ   mQ ~"];

const searchRows = [
  "the prince sleeps here",
  "a principle of motion",
  "the princess waits west",
  "print the princess now",
  "the princess is here~",
];

const doorRows = ["############", "@  +  D    ~", "############"];

function lineCoins(rows) {
  const coins = [];
  rows.forEach((row, y) => {
    const chars = [...row];
    const first = chars.findIndex((ch) => ch !== " ");
    const last = chars.length - 1;
    if (y < rows.length - 1 && first >= 0 && first !== last) coins.push({ x: first, y });
    coins.push({ x: last, y });
  });
  return coins;
}

const PLAINS = "Mushroom Plains";
const HILLS = "Word Hills";
const CAVE = "Line Cave";
const CASTLE = "Insert Castle";
const MARSH = "Match Marsh";
const EDIT = "Edit Outpost";
const LIBRARY = "Case Library";
const HALL = "Mark Hall";
const CHORD = "Chord Keep";
const KEEP = "Lava Keep";
const LOUD = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const shoutRows = ["@ THE", "   ~"];
const stackRows = ["@  THE", "  CAT~"];
const bridgeRows = ["@ red", "   ~"];
const balconyRows = ["@    D~", "#     #", "# +   #", "#######"];
const lockRows = ["@ + + +D~"];
const galleryRows = ["@    D~", "#     #", "# + + #", "#######"];
const gateRows = ["@ THE", "  ~"];
const sideRows = ["@ CAT", "~"];
const braceRows = ["@(Q)~"];
const braceNest = ["@((Q)Q)((Q)Q)~"];

const commaRow = ["@``hello,``world,``big,``words,``end~"];
const nestRow = ["@((Q)Q)((Q)Q)~"];
const backRow = ["~``red``QQ``blue``QQ``green@"];
const editRow = ["#@``QQ``X#"];
const doorDoom = ["@``door``QQ``doom``QQ``door``~"];
const doorTrip = ["@``door``QQ``door``QQ``door``~"];
const pageRows = ["@ The QQ fox", "", "jumps QQ high", "", "over QQ home ~"];

const chainA = ["safe", "spike", "safe", "spike", "safe", "spike", "spike", "flag"];
const chainB = ["safe", "spike", "spike", "safe", "spike", "safe", "spike", "spike", "flag"];
const chainC = ["safe", "spike", "c", "spike", "a", "spike", "t!"];
const chainD = ["safe", "spike", "c", "spike", "a", "spike", "s", "spike", "t!"];

export const LEVELS = [
  {
    id: "1-1",
    world: 1,
    worldName: PLAINS,
    name: "First Walk",
    blurb: "A bug, one pit, the flag.",
    objective: "Reach the flag. A bug blocks the walk, and a one-tile hole sits after it. :hint if you stall.",
    teach: ["h", "j", "k", "l"],
    hints: [
      "A bug stands in the walk. A one-tile hole is just after it.",
      "k jumps. It also stomps a bug. l walks. A number repeats: 2l.",
      "2l k l k 4l",
    ],
    par: 16,
    phases: [
      {
        kind: "course",
        goal: "flag",
        intro: "Walk. The bug and the hole are the whole course.",
        ...course(24, 14, (a) => {
          a.ground(11);
          a.plot(2, 10, "@");
          a.sign(3, 10, "l walks. k jumps.");
          a.plot(6, 10, "G");
          a.pit(8, 11);
          a.plot(9, 10, "C");
          a.plot(13, 10, "F");
        }),
      },
    ],
  },
  {
    id: "1-2",
    world: 1,
    worldName: PLAINS,
    name: "The Leap",
    blurb: "The same distance, one command.",
    objective: "Reach the flag. This hole is wider than a jump. The coin on the first shelf is optional.",
    teach: ["l", "w", "e"],
    allowWord: true,
    secret: 1,
    hints: [
      "k hops two tiles. This hole is three.",
      "w jumps to the next platform. e runs to the end of the one you are on.",
      "6l takes the coin, then w e. w e skips the coin and still finishes.",
    ],
    par: 10,
    phases: [
      {
        kind: "course",
        goal: "flag",
        intro: "Walk the first shelf if you want the coin. The gap wants w.",
        ...course(28, 14, (a) => {
          a.fill(1, 11, 8, 3, "#");
          a.fill(12, 11, 5, 3, "#");
          a.plot(2, 10, "@");
          a.sign(3, 10, "Wide gap. w jumps to the next word.");
          a.plot(8, 10, "C");
          a.plot(16, 10, "F");
        }),
      },
    ],
  },
  {
    id: "1-3",
    world: 1,
    worldName: PLAINS,
    name: "Word Heist",
    blurb: "A vault, a gem, and a door that moves.",
    objective: "Reach the exit. The gem under the first word is optional. Taking it changes the vault.",
    teach: ["w", "j", "l"],
    allowWord: true,
    secret: 1,
    hints: [
      "The top line leads out. The gem is stored under red. A pit sits in front of the top exit.",
      "w crosses a word and jumps the pit. j changes lines. l walks one character.",
      "ww leaves the gem behind. wjj4lj takes it. The old exit seals, and a hatch opens on the right.",
    ],
    par: 12,
    phases: [
      buffer(["@ red ` ~", "#       #", "# gem   #", "#########"], {
        intro: "The exit is on this line. Something is stored below.",
        checkpoints: [{ x: 2, y: 0 }],
        gem: { close: [{ x: 8, y: 0 }], open: [{ x: 6, y: 3, ch: "~" }] },
        coins: [{ ...at(["@ red ` ~", "#       #", "# gem   #", "#########"], "g"), gem: true }],
      }),
    ],
  },
  {
    id: "1-4",
    world: 1,
    worldName: PLAINS,
    name: "Bug King",
    blurb: "He shows the opening, then swings.",
    objective: "Cross the broken line. Strike the letter he leaves open. Step onto red and he deletes you.",
    teach: ["w", "b"],
    allowWord: true,
    secret: 2,
    hints: [
      "The line is words and an exit. On the king, red is a swing and the letter is the opening. It switches sides.",
      "w advances to the next platform. b retreats to the previous one.",
      "www crosses the line. On the king: w, then bb, then ww.",
    ],
    par: 14,
    phases: [
      buffer(["@ let  bug ` ~"], {
        intro: "A real line. w jumps a word. The pit catches a walk.",
        coins: [at(["@ let  bug ` ~"], "b"), at(["@ let  bug ` ~"], "~")],
      }),
      {
        kind: "boss",
        goal: "boss",
        intro: "Red bites. Strike the letter. b retreats.",
        boss: {
          x: 18,
          y: 8,
          w: 4,
          h: 2,
          letters: ["c", "a", "t"],
          dance: {
            left: { x: 1, y: 10, w: 5 },
            right: { x: 17, y: 10, w: 5 },
          },
        },
        ...course(34, 14, (a) => {
          a.fill(1, 11, 5, 3, "^");
          a.fill(9, 11, 5, 3, "#");
          a.fill(17, 11, 5, 3, "#");
          a.fill(25, 11, 5, 3, "^");
          a.plot(11, 10, "@");
          a.sign(12, 10, "Red bites. Strike the letter. b retreats.");
          a.plot(17, 10, "c");
        }),
      },
    ],
  },

  {
    id: "2-1",
    world: 2,
    worldName: HILLS,
    name: "Word Leap",
    blurb: "Red shelves are spikes. Coins sit at the far end.",
    objective: "Reach the flag. Red shelves are spikes. Coins sit at the end of the safe shelves.",
    teach: ["w", "e"],
    hints: [
      "Red shelves are spikes. A coin sits at the far end of each safe shelf. The flag is the end of the last shelf.",
      "w jumps to the next shelf. A count skips shelves. e runs to the end of the shelf you are on.",
      "e2we2we3we takes the first coins. e3we2we3we takes the rest. Skipping e still reaches the flag.",
    ],
    par: 26,
    phases: [
      chain(chainA, "Red shelves are spikes. Coins sit at the far end of the safe ones."),
      chain(chainB, "Some gaps are two red shelves wide."),
    ],
  },
  {
    id: "2-2",
    world: 2,
    worldName: HILLS,
    name: "The Paragraph",
    blurb: "QQ is a word, and it is lava.",
    objective: "Cross the paragraph. QQ burns. Coins sit on the way to the exit.",
    teach: ["w", "e", "b"],
    hints: [
      "QQ is a word, and it is lava. Pits sit between some words. The exit is the end of the last line.",
      "w jumps to the next word. A count skips words.",
      "w2w2ww2w2ww2ww2w.",
    ],
    par: 22,
    phases: [
      buffer(wordMazeRows, {
        intro: "QQ burns. Pits catch a walk.",
        spikeChars: ["Q"],
        checkpoints: [at(wordMazeRows, "t")],
        coins: [at(wordMazeRows, "q"), at(wordMazeRows, "d"), at(wordMazeRows, "~")],
      }),
    ],
  },
  {
    id: "2-3",
    world: 2,
    worldName: HILLS,
    name: "The Toll",
    blurb: "A gem that closes the way you came.",
    objective: "Reach the exit. The gem at the end of the first word is optional. Taking it moves the door.",
    teach: ["w", "e", "b", "j"],
    hints: [
      "The exit is past two lava words. A gem sits at the end of the first word. A hatch is hidden under that word.",
      "w jumps to the next word. e reaches the end of the word. b returns to its start. j changes lines.",
      "w2w leaves the gem. webj takes it. The old exit seals, and a hatch opens underneath.",
    ],
    par: 8,
    phases: [
      buffer(["@ safe QQ ~", "#########"], {
        intro: "The exit is past the lava. The gem is optional.",
        spikeChars: ["Q"],
        checkpoints: [{ x: 2, y: 0 }],
        gem: { close: [{ x: 10, y: 0 }], open: [{ x: 2, y: 1, ch: "~" }] },
        coins: [{ x: 5, y: 0, gem: true }],
      }),
    ],
  },
  {
    id: "2-4",
    world: 2,
    worldName: HILLS,
    name: "Look Back",
    blurb: "The coin is on the word behind you.",
    objective: "The exit is ahead. A coin sits on the word behind you. A walk falls in the pits.",
    teach: ["w", "b", "e"],
    hints: [
      "You stand on a word. The exit is ahead of you. The coin is the end of the word behind you. Pits sit between the words.",
      "w jumps to the next word. b jumps to the previous word. e reaches the end of the word.",
      "w leaves the coin. beww takes it.",
    ],
    par: 8,
    phases: [
      buffer(["gold ` next ` ~"], {
        intro: "The exit is ahead. The coin is behind you.",
        start: { x: 7, y: 0 },
        checkpoints: [{ x: 0, y: 0 }],
        coins: [{ x: 3, y: 0 }],
      }),
    ],
  },
  {
    id: "3-1",
    world: 3,
    worldName: CAVE,
    name: "End of the Line",
    blurb: "Each line starts late and ends at a coin.",
    objective: "Each line has a coin on its first letter and a coin at its end. The last end is the door.",
    teach: ["0", "^", "$"],
    hints: [
      "The lines are indented. Coins sit on the first letter and the last character. The door is the end of the last line.",
      "^ jumps to the first character. $ jumps to the end. j moves down.",
      "^$j^$j^$j^$. $j$j$j$ still finishes, and leaves the first letters.",
    ],
    par: 14,
    phases: [
      buffer(lineRoom, {
        intro: "Each line starts late and ends at a coin. The last end is the door.",
        coins: lineCoins(lineRoom),
        start: { x: 0, y: 0 },
      }),
    ],
  },
  {
    id: "3-2",
    world: 3,
    worldName: CAVE,
    name: "Finders",
    blurb: "A mark sits just before each lava.",
    objective: "A sentence sits below you. Lava breaks it up. The marks before the lava are coins. The exit is at the end.",
    teach: ["f", "t", ";", "j"],
    hints: [
      "Go down to the sentence. Q burns. An m sits before each Q. ~ is the exit.",
      "j moves down. t stops before a character. ; repeats that find. f lands on a character.",
      "6jtQ;;;;f~ takes every m. 6jf~ leaves them.",
    ],
    par: 16,
    phases: [
      buffer(findHallRows, {
        intro: "The sentence is below. Q burns. The m before it is safe.",
        spikeChars: ["Q"],
        checkpoints: [{ x: 0, y: 6 }],
        coins: [0, 1, 2, 3, 4].map((n) => at(findHallRows, "m", n)),
      }),
    ],
  },
  {
    id: "3-3",
    world: 3,
    worldName: CAVE,
    name: "Find Leap",
    blurb: "Letters mark the safe shelves.",
    objective: "Reach the flag. Red shelves burn. Letters mark the safe shelves, and coins sit at their ends.",
    teach: ["f", "e", "w"],
    hints: [
      "The letters are c, then a, then t. Red is a spike. Coins sit at the end of the first shelf and of each letter.",
      "f lands on a letter. e runs to the end of the shelf. w lands on the next shelf, red included.",
      "efcefaefte takes the coins. fcfafte reaches the flag without them.",
    ],
    par: 16,
    phases: [
      chain(chainC, "Red burns. The letters are safe shelves. Coins sit at the ends."),
    ],
  },
  {
    id: "3-4",
    world: 3,
    worldName: CAVE,
    name: "About Face",
    blurb: "The exit is behind you.",
    objective: "The exit is behind you. Lava sits on both sides. The marks in front of the lava are optional.",
    teach: ["0", "t", ",", "f"],
    hints: [
      "You are in the middle of the line. The exit is at column zero. Q burns. An m sits beside each Q.",
      "0 jumps to column zero. t stops before a character. , repeats that find backward.",
      "0 leaves now. tQ,0 takes both marks.",
    ],
    par: 8,
    phases: [
      buffer(["~ Qm  go  mQ"], {
        intro: "The exit is behind you. Q burns.",
        start: { x: 6, y: 0 },
        spikeChars: ["Q"],
        checkpoints: [{ x: 10, y: 0 }],
        coins: [{ x: 3, y: 0 }, { x: 10, y: 0 }],
      }),
    ],
  },
  {
    id: "4-1",
    world: 4,
    worldName: CASTLE,
    name: "King Insert",
    blurb: "Several lines mention a princess. One ends at a door.",
    objective: "Find the line that ends at the door. Then strike the letter he leaves open.",
    teach: ["/", "n", "f"],
    hints: [
      "Several lines talk about a princess. One of them ends in ~. On the king, strike the letter he names.",
      "/ searches. n repeats it. f lands on a character.",
      "/princess, Enter, n, n, f~. Then fc fa ft.",
    ],
    par: 28,
    phases: [
      buffer(searchRows, {
        intro: "Find the line that ends at the door.",
        start: { x: 0, y: 0 },
        coins: [at(searchRows, "~")],
      }),
      {
        kind: "boss",
        goal: "boss",
        intro: "Strike the letter he leaves open.",
        boss: { x: 14, y: 8, w: 4, h: 2, letters: ["c", "a", "t"] },
        pickups: [{ x: 12, y: 10 }],
        ...course(22, 14, (a) => {
          a.ground(11);
          a.plot(2, 10, "@");
          a.sign(3, 10, "Strike the letter he leaves open.");
          a.plot(6, 10, "c");
          a.plot(9, 10, "a");
          a.plot(12, 10, "t");
        }),
      },
    ],
  },
  {
    id: "4-2",
    world: 4,
    worldName: CASTLE,
    name: "The Door",
    blurb: "A mark on the ground is holding the door.",
    objective: "The door is shut. A mark on the ground is holding it. The exit is past the door.",
    teach: ["x", "l"],
    hints: [
      "A + holds the door shut. The exit is on the same line, past the door.",
      "x deletes the character under the cursor. l walks.",
      "3lx8l.",
    ],
    par: 12,
    phases: [
      buffer(doorRows, {
        intro: "The door stays shut while + remains.",
        checkpoints: [{ x: 3, y: 1 }],
        coins: [at(doorRows, "~")],
      }),
    ],
  },
  {
    id: "4-3",
    world: 4,
    worldName: CASTLE,
    name: "The Feint",
    blurb: "The nearest letter is not the one he wants.",
    objective: "Delete the king. He names the letter. The nearest letter is a lie, and red shelves are spikes.",
    teach: ["f", "F", "e"],
    hints: [
      "He asks for a letter. The first shelf ahead is a different letter. Red is a spike. Coins sit at the end of the real shelves.",
      "f lands on a letter ahead. F finds one behind you. e runs to the end of the shelf.",
      "efcefaeFseft takes the coins. fcfaFsft deletes him and leaves the coins.",
    ],
    par: 18,
    phases: [
      {
        ...chain(
          ["safe", "spike", "s", "spike", "c", "spike", "a", "spike", "t!"],
          "He names the letter. The nearest one is a lie. Red is a spike.",
        ),
        kind: "boss",
        goal: "boss",
        boss: { x: 8, y: 8, w: 4, h: 2, letters: ["c", "a", "s", "t"] },
      },
    ],
  },
  {
    id: "5-1",
    world: 5,
    worldName: MARSH,
    name: "Comma Trail",
    blurb: "Commas burn.",
    objective: "Reach the exit. Commas burn. Coins sit inside the words.",
    teach: ["W", "w"],
    hints: [
      "A comma is lava. Each word ends with one. The exit is a small step after the last word.",
      "w stops at punctuation. W jumps the whole WORD, comma included.",
      "wWWWWw.",
    ],
    par: 12,
    phases: [
      buffer(commaRow, {
        intro: "Commas burn. The exit is past the last word.",
        spikeChars: [","],
        coins: [at(commaRow, "w", 0), at(commaRow, "b"), at(commaRow, "w", 1), at(commaRow, "~")],
      }),
    ],
  },
  {
    id: "5-2",
    world: 5,
    worldName: MARSH,
    name: "Brackets",
    blurb: "The first closing bracket is a trap.",
    objective: "Reach the flag, then the exit. The first closing bracket you can see is sitting in lava.",
    teach: ["%", "e", "l"],
    hints: [
      "You start on an open bracket. A closing bracket between red shelves, or between Q, is not your match.",
      "% jumps to the matching bracket. e reaches the end of a platform. l walks one character.",
      "%e%e%e then %l%l.",
    ],
    par: 16,
    phases: [
      matchCourse("The first closing bracket is a trap."),
      buffer(nestRow, {
        intro: "The first closing bracket sits in lava.",
        spikeChars: ["Q"],
        coins: [at(nestRow, ")", 1), at(nestRow, ")", 3), at(nestRow, "~")],
      }),
    ],
  },
  {
    id: "5-3",
    world: 5,
    worldName: MARSH,
    name: "Rewind",
    blurb: "You are facing the wrong way.",
    objective: "The exit is behind you. Lava sits between the words.",
    teach: ["b", "e"],
    hints: [
      "You start on the right. Red shelves and QQ burn. Coins sit on the safe words.",
      "b jumps to the previous word. A count skips words. e reaches the end of a word.",
      "b2be3be then b2b2bb.",
    ],
    par: 18,
    phases: [
      chain(["flag", "spike", "safe", "spike", "safe"], "You are facing the wrong way. Red burns.", true),
      buffer(backRow, {
        intro: "QQ burns. The exit is behind you.",
        spikeChars: ["Q"],
        coins: [at(backRow, "g"), at(backRow, "b"), at(backRow, "r"), at(backRow, "~")],
      }),
    ],
  },
  {
    id: "6-1",
    world: 6,
    worldName: EDIT,
    name: "Typo",
    blurb: "The exit has not been written.",
    objective: "The exit is missing. Lava sits in front of the letter where it belongs.",
    teach: ["r", "w"],
    hints: [
      "X is where the exit should be. QQ is lava.",
      "w jumps a word. A count skips one. r replaces the character under the cursor.",
      "2wr~.",
    ],
    par: 10,
    phases: [
      buffer(editRow, {
        intro: "X is not the exit until you write one.",
        spikeChars: ["Q"],
        coins: [at(editRow, "X")],
      }),
    ],
  },
  {
    id: "6-2",
    world: 6,
    worldName: EDIT,
    name: "Echo",
    blurb: "One word is safe. The other burns.",
    objective: "Reach the exit. One word is a trap. The safe word shows up again.",
    teach: ["*", "w"],
    hints: [
      "doom burns. door appears again. The next room is three doors, then the exit.",
      "* jumps to the next copy of the word under the cursor.",
      "w*w then w**w.",
    ],
    par: 12,
    phases: [
      buffer(doorDoom, {
        intro: "doom burns. door appears again.",
        spikeChars: ["Q"],
        coins: [at(doorDoom, "d", 0), at(doorDoom, "d", 2), at(doorDoom, "~")],
      }),
      buffer(doorTrip, {
        intro: "The same word, three times. The exit is after the last one.",
        spikeChars: ["Q"],
        coins: [0, 1, 2].map((n) => at(doorTrip, "d", n)).concat([at(doorTrip, "~")]),
      }),
    ],
  },
  {
    id: "6-3",
    world: 6,
    worldName: EDIT,
    name: "Paragraphs",
    blurb: "Blank lines break the page.",
    objective: "Three paragraphs. The exit is in the last one. Lava words sit inside them.",
    teach: ["}", "w"],
    hints: [
      "Blank lines separate the paragraphs. QQ burns. The exit is the last word.",
      "} jumps to the next blank line. w jumps a word. A count skips one.",
      "}}}2ww.",
    ],
    par: 12,
    phases: [
      buffer(pageRows, {
        intro: "Blank lines break the page. QQ burns.",
        spikeChars: ["Q"],
        coins: [
          { x: 0, y: 1 },
          { x: 0, y: 3 },
          { x: 8, y: 4 },
          { x: 13, y: 4 },
        ],
      }),
    ],
  },
  {
    id: "7-1",
    world: 7,
    worldName: LIBRARY,
    name: "The Shout",
    blurb: "Capitals burn.",
    objective: "The capital word burns. The exit is one line down. Stepping on the capital is a coin.",
    teach: ["g", "u", "w", "j", "l"],
    hints: [
      "T H E burns. The exit is on the next line.",
      "guu lowercases the whole line. w jumps a word. j and l step.",
      "guuwjl.",
    ],
    par: 12,
    phases: [
      buffer(shoutRows, {
        intro: "Capitals burn. The exit is one line down.",
        spikeChars: LOUD,
        coins: [at(shoutRows, "T"), at(shoutRows, "~")],
      }),
    ],
  },
  {
    id: "7-2",
    world: 7,
    worldName: LIBRARY,
    name: "Two Pages",
    blurb: "Quieting one line leaves the next one loud.",
    objective: "Each line burns until that line is quiet. A coin sits on the first capital. The exit ends the second line.",
    teach: ["g", "u", "0", "j"],
    hints: [
      "Quieting the line you are on does nothing to the next line. The second line is still loud.",
      "guu lowercases a line. 0 returns to column zero. j moves down. w jumps a word.",
      "guuw0jguuww.",
    ],
    par: 16,
    phases: [
      buffer(stackRows, {
        intro: "Only this line gets quiet. The next line is still loud.",
        spikeChars: LOUD,
        checkpoints: [at(stackRows, "T")],
        coins: [at(stackRows, "T"), at(stackRows, "~")],
      }),
    ],
  },
  {
    id: "7-3",
    world: 7,
    worldName: LIBRARY,
    name: "Loud Bridge",
    blurb: "The whispered word burns.",
    objective: "The whispered word burns. The exit is one line down. The word itself is a coin once it is safe.",
    teach: ["g", "U", "w"],
    hints: [
      "red burns while it stays quiet. The exit is on the next line.",
      "gUw uppercases the next word.",
      "gUwwjl.",
    ],
    par: 12,
    phases: [
      buffer(bridgeRows, {
        intro: "The quiet word burns. The exit is one line down.",
        spikeChars: ["r", "e", "d"],
        coins: [at(bridgeRows, "r"), at(bridgeRows, "~")],
      }),
    ],
  },
  {
    id: "8-1",
    world: 8,
    worldName: HALL,
    name: "Balcony",
    blurb: "The lock is downstairs. The door is up here.",
    objective: "The door is shut. The lock is downstairs. You will want a way back up.",
    teach: ["m", "'", "x", "f"],
    hints: [
      "A + downstairs holds the door. The exit is upstairs, past the door.",
      "ma remembers this spot. x deletes +. 'a jumps back. f lands on a character.",
      "maljjlx'af~.",
    ],
    par: 16,
    phases: [
      buffer(balconyRows, {
        intro: "The lock is downstairs. The door is up here.",
        checkpoints: [{ x: 1, y: 0 }, { x: 1, y: 2 }],
        coins: [at(balconyRows, "+"), at(balconyRows, "~")],
      }),
    ],
  },
  {
    id: "8-2",
    world: 8,
    worldName: HALL,
    name: "Repeater",
    blurb: "Three locks, then the door.",
    objective: "Three locks hold the door. The exit is past them.",
    teach: [".", "x", "w"],
    hints: [
      "Each + holds the door. The exit is at the end of the line.",
      "x deletes the lock under you. . repeats that delete. w jumps to the next lock.",
      "wxw.w.w.",
    ],
    par: 12,
    phases: [
      buffer(lockRows, {
        intro: "Three locks, then the door.",
        coins: [0, 1, 2].map((n) => at(lockRows, "+", n)).concat([at(lockRows, "~")]),
      }),
    ],
  },
  {
    id: "8-3",
    world: 8,
    worldName: HALL,
    name: "The Gallery",
    blurb: "Two locks downstairs. The door is upstairs.",
    objective: "The door upstairs is shut. Two locks are downstairs. You will want a way back.",
    teach: ["m", "'", ".", "x", "f"],
    hints: [
      "Two + marks hold the door. They are on the bottom line. The exit is upstairs, past the door.",
      "ma remembers. x deletes. . repeats that delete. 'a jumps back. f lands on a character.",
      "maljjlxw.'af~.",
    ],
    par: 18,
    phases: [
      buffer(galleryRows, {
        intro: "Two locks downstairs. The door is upstairs.",
        checkpoints: [{ x: 1, y: 2 }],
        coins: [at(galleryRows, "+", 0), at(galleryRows, "+", 1), at(galleryRows, "~")],
      }),
    ],
  },
  {
    id: "9-1",
    world: 9,
    worldName: CHORD,
    name: "Loud Exit",
    blurb: "One exit is past the capitals. The next is behind them.",
    objective: "Capitals burn. The first exit is past them. The second exit is behind them. Stepping on a capital is optional.",
    teach: ["g", "u", "w", "0", "b"],
    hints: [
      "A capital word burns. The first exit is one line down. The second exit is at column zero, behind another capital word.",
      "guu lowercases the line you are on. w jumps to the next word. A count skips words. 0 is column zero. b jumps back.",
      "guuwj then guub0 takes the capitals. 2w then 0 leaves them.",
    ],
    par: 16,
    phases: [
      buffer(["@ THE", "  ~  "], {
        intro: "Capitals burn. The exit is one line down.",
        spikeChars: LOUD,
        coins: [{ x: 2, y: 0 }, { x: 2, y: 1 }],
      }),
      buffer(["~  THE @"], {
        intro: "The exit is behind the capital word.",
        spikeChars: LOUD,
        coins: [{ x: 3, y: 0 }, { x: 0, y: 0 }],
      }),
    ],
  },
  {
    id: "9-2",
    world: 9,
    worldName: CHORD,
    name: "Brace Step",
    blurb: "The match is safe. The bracket you can see is not.",
    objective: "Reach the exit. A bracket you can see is sitting in lava. Its real match is safe. Then step through.",
    teach: ["%", "l"],
    hints: [
      "You stand on an open bracket. A closing bracket between the lava is not its match. The second room has two nests.",
      "% jumps to the match. l walks one character.",
      "%l then %l%l.",
    ],
    par: 12,
    phases: [
      buffer(braceRows, {
        intro: "The match is safe. The bracket in the lava is not.",
        spikeChars: ["Q"],
        coins: [at(braceRows, ")"), at(braceRows, "~")],
      }),
      buffer(braceNest, {
        intro: "Two nests. The first closing bracket is lava.",
        spikeChars: ["Q"],
        coins: [at(braceNest, ")", 1), at(braceNest, ")", 3), at(braceNest, "~")],
      }),
    ],
  },
  {
    id: "9-3",
    world: 9,
    worldName: CHORD,
    name: "Quiet Lock",
    blurb: "The lock sits past a letter that burns.",
    objective: "A shut door hides the exit. The lock is downstairs, past a letter that burns. The letter is optional.",
    teach: ["m", "'", "g", "u", "x", "f"],
    hints: [
      "The door is shut. Downstairs, T burns, and + holds the door. The exit is upstairs once the door opens.",
      "guu quiets a line. x deletes + and opens the door. ma remembers a spot and 'a returns. f lands on a character.",
      "maljjguuwwx'af~ takes the letter. maljjf+x'af~ skips it and still opens the door.",
    ],
    par: 22,
    phases: [
      buffer(["@    D~", "#     #", "# T + #", "#######"], {
        intro: "The door is shut. The letter downstairs burns.",
        spikeChars: ["T"],
        checkpoints: [{ x: 1, y: 2 }],
        coins: [{ x: 2, y: 2 }],
      }),
    ],
  },
  {
    id: "10-1",
    world: 10,
    worldName: KEEP,
    name: "Grey Bridge",
    blurb: "Grey brick holds. The pool does not.",
    objective: "Cross to the flag. Grey brick is the floor. The pools are lava. A coin on the first brick is optional.",
    teach: ["w", "e", "l"],
    hints: [
      "The first brick ends before a pool. The flag is on the far brick.",
      "w jumps to the next brick. e runs to the end of the brick you are on. l walks.",
      "ewe takes the coin. we leaves it and still reaches the flag.",
    ],
    par: 8,
    phases: [
      {
        kind: "course",
        goal: "flag",
        intro: "Grey brick holds. The pool does not.",
        ...course(28, 14, (a) => {
          a.fill(0, 11, 8, 3, "#");
          a.fill(8, 11, 4, 3, "V");
          a.fill(12, 11, 16, 3, "#");
          a.plot(2, 10, "@");
          a.sign(3, 10, "Grey brick holds. The pool does not.");
          a.plot(6, 10, "C");
          a.plot(24, 10, "F");
        }),
      },
    ],
  },
  {
    id: "10-2",
    world: 10,
    worldName: KEEP,
    name: "Fire Hall",
    blurb: "Fire moves when you move.",
    objective: "Reach the flag along the brick. Fire travels the hall and moves when you do. The coin in the hall is optional.",
    teach: ["w", "e", "b", "l"],
    hints: [
      "Fire sits on the long brick. It steps when you step, and it turns around at the ends.",
      "w jumps onto the brick. e runs to its end. l walks one brick. b goes back.",
      "wwe leaves the coin on the fire brick. wllllwe takes it, then jumps off.",
    ],
    par: 10,
    phases: [
      {
        kind: "course",
        goal: "flag",
        intro: "Fire moves when you move.",
        fires: [{ x: 8, y: 10, dir: 1 }],
        checkpoints: [{ x: 7, y: 10 }],
        ...course(28, 14, (a) => {
          a.fill(0, 11, 5, 3, "#");
          a.fill(5, 11, 2, 3, "V");
          a.fill(7, 11, 8, 3, "#");
          a.fill(15, 11, 2, 3, "V");
          a.fill(17, 11, 8, 3, "#");
          a.plot(2, 10, "@");
          a.sign(3, 10, "Fire moves when you move.");
          a.plot(11, 10, "C");
          a.plot(22, 10, "F");
        }),
      },
    ],
  },
  {
    id: "10-3",
    world: 10,
    worldName: KEEP,
    name: "The Keep",
    blurb: "The princess is behind the king.",
    objective: "The princess stands on the far brick. The king blocks the bridge and throws fire when you move. Get behind him.",
    teach: ["w", "e", "b"],
    hints: [
      "He stands on the bridge. Fire comes back toward you. The princess is the flag on the last brick.",
      "w jumps to the next brick. When he is in the air, the bridge under him is open. e reaches the end.",
      "wwwe reaches her. e first takes nothing you need.",
    ],
    par: 12,
    phases: [
      {
        kind: "boss",
        goal: "flag",
        intro: "He throws fire. The princess is behind him.",
        boss: { x: 14, y: 9, w: 4, h: 2, koopa: true },
        princess: { x: 30, y: 10 },
        checkpoints: [{ x: 9, y: 10 }],
        ...course(32, 14, (a) => {
          a.fill(0, 11, 6, 3, "#");
          a.fill(6, 11, 3, 3, "V");
          a.fill(9, 11, 14, 3, "#");
          a.fill(23, 11, 3, 3, "V");
          a.fill(26, 11, 6, 3, "#");
          a.plot(2, 10, "@");
          a.sign(3, 10, "The princess is behind him.");
          a.plot(28, 10, "C");
          a.plot(30, 10, "F");
        }),
      },
    ],
  },
];

export function getLevel(id) {
  return LEVELS.find((level) => level.id === id);
}

export function worldEdge(idx) {
  const here = LEVELS[idx];
  const next = LEVELS[idx + 1];
  if (!here || !next || next.world === here.world) return null;
  return { done: here.worldName, next: next.worldName };
}
