import { readFileSync } from "node:fs";
import { WORLD_NODES, courseFrame, mazeFrame, roadDots } from "../js/render.js";

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL", msg);
  }
}

const toll = mazeFrame({ w: 11, h: 2 }, { x: 0, y: 0 });
assert(toll.scale === 2, "a short toll zooms to 2x");
assert(toll.camX === 0, "the toll starts with the left edge in frame");

const balcony = mazeFrame({ w: 7, h: 4 }, { x: 0, y: 0 });
assert(balcony.scale === 2, "a small balcony fits at 2x");
assert(balcony.camX === 0, "the balcony keeps the whole room in frame");

const line = mazeFrame({ w: 26, h: 3 }, { x: 8, y: 0 });
assert(line.scale === 2, "a long paragraph zooms");
assert(line.camX > 0, "the paragraph camera follows the cursor");

const hills = courseFrame({ w: 60, h: 14, kind: "course" }, { x: 10, y: 10 }, 10);
assert(hills.scale === 1, "outdoor courses stay on whole pixels");
assert(hills.camY === 8, "empty sky rows above the shelves are cropped");
assert(hills.camX === 3, "the course camera leads by seven tiles");
const ahead = hills.camX + 16;
assert(ahead >= 18, "the next shelf stays inside the course frame");

const boss = courseFrame({ w: 34, h: 14, kind: "boss" }, { x: 11, y: 10 }, 8);
assert(boss.scale === 1, "a boss keeps a wide frame");
assert(boss.camX === 4, "the boss camera still leads from the player");

assert(WORLD_NODES.length === 10, "ten worlds on the map");
for (const node of WORLD_NODES) {
  assert(node.x >= 32 && node.x <= 220, node.name + " stays on the map");
  assert(node.y >= 40 && node.y <= 176, node.name + " stays between the bars");
}
for (let i = 0; i < WORLD_NODES.length; i++) {
  for (let j = i + 1; j < WORLD_NODES.length; j++) {
    const a = WORLD_NODES[i];
    const b = WORLD_NODES[j];
    const hit = Math.abs(a.x - b.x) < 28 && Math.abs(a.y - b.y) < 28;
    assert(!hit, a.name + " overlaps " + b.name);
  }
}

function outsidePlate(dot, node) {
  return Math.abs(dot.x - node.x) > 16 || Math.abs(dot.y - node.y) > 18;
}
for (let i = 0; i < WORLD_NODES.length - 1; i++) {
  const a = WORLD_NODES[i];
  const b = WORLD_NODES[i + 1];
  const dots = roadDots(a, b);
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (len > 60) assert(dots.length >= 2, a.name + " path has stones");
  for (const dot of dots) {
    for (const node of WORLD_NODES) {
      assert(outsidePlate(dot, node), a.name + " path hits " + node.name);
    }
  }
}

const css = readFileSync(new URL("../css/style.css", import.meta.url), "utf8");
assert(css.includes("rgba(0, 0, 0, 0.07)"), "scanlines stay light over text");
assert(!css.includes("rgba(0, 0, 0, 0.18)"), "the old heavy scanline is gone");

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
assert(html.includes('id="commands"'), "the keypad sits in a disclosure");
assert(html.includes("<summary>Commands</summary>"), "keyboard players can leave commands collapsed");

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("frame ok");
