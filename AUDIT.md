# Vimario Audit (2026-10-02)

**First thing to do: rename the game and redraw the hero before you try to make money from it.** "Vimario", the red-cap, blue-overalls, mustached hero, a princess, `koopa: true`, Mushroom Plains and the flagpole all point straight at Nintendo, which enforces its trademarks hard. A free hobby page will probably go unnoticed. A paid game or a Steam page probably won't.

**How this was checked:** read the code (about 6,900 lines), ran `npm test` (all 33 playthroughs, the Timed checks and the framing checks pass), and drove the game in headless Chromium. That covered the title, the map, 9 levels, Timed mode and a phone-width screen. No console errors.

## Scores

| Area | Score | Short version |
|---|---|---|
| Creativity | **9/10** | Vim motions as the controller is a strong, original idea |
| Gameplay | **7/10** | Smart puzzles; the early levels don't play much like a platformer |
| Graphics | **6/10** | Clean NES look, but rooms are empty and it borrows too much from Mario |
| Engagement | **6/10** | Stars, par and a daily mode are good; no sharing, little feedback |
| Ready to sell | **3/10** | Nintendo-style branding, no analytics, layout broken on phones |

## Gameplay

- **Good:** each level teaches one motion and then tests it (`w`, `f/t`, `%`, `*`, `}`, `gU`, marks, `.`). Three stars (finish, secret coin, at or under par) give a reason to replay. The 3-tier `:hint` ladder is well designed. `u` undo still counts the key, which is a nice touch.
- **Weak:** on courses, `k` means jump, but in text rooms it means up. That contradicts the real Vim habit the game is trying to teach.
- **Weak:** many levels are solved in 3–7 keys (10-1 takes `we`). They are puzzles more than platforming, with no tension. Fire and the king only show up in world 10.
- **Weak:** the text is very short and hard to parse ("Holding one key dies once the pits start"). New players will stall.

## Graphics

- **Good:** the palette is consistent, each world has its own sky color, and there are particles, landing dust and a CRT bezel.
- **Weak:** text rooms (1-3, 1-4, 3-2, 8-2) are a dark strip on a huge empty background, about 70% blank screen.
- **Weak:** in 10-3 the princess sprite looks bigger than the hero, and the scale doesn't match.
- **Bug:** on phones the page scrolls sideways. At 390px wide the canvas renders 512px wide and the page is 562px. The cause is `fitScreen()` at `js/main.js:1025`: it measures `.tv`, whose width grows to fit the canvas itself. The goal and the timer text get cut off.

## Engagement

- **Good:** Timed mode (one motion per room, a shrinking window, a new card each day, ranks) is the best hook for bringing players back.
- **Missing:** a Share button. There is only a hint to type `?fuse=YYYY-MM-DD` into the URL. A Wordle-style result card (`Vimario Timed 10/02 🟩🟩🟩🟥 rank CURSOR`) would cost little and spread the game for free.
- **Missing:** a reward when you clear a world (cutscene, unlock or cosmetic), and any total progress beyond star counts.
- **Missing:** analytics, so there is no way to see which level players quit on.

## Making money (best option first)

1. **Free first worlds, then a one-time unlock (about $10–20).** Vim Adventures already proves people pay to learn Vim this way.
2. **Licenses for teams or bootcamps:** progress dashboards plus a "certified" completion card.
3. **Steam or itch.io release.** Needs the rebrand plus about 2× the content.
4. **Sponsors:** terminal and editor companies (Neovim distros, Warp, JetBrains IdeaVim) sponsoring a world.
5. **Donations or GitHub Sponsors:** easy to add now, earns little.

## Improvement ideas

### Quick wins (under 1 hour each)

1. Fix the phone layout: scale against the viewport width, not `.tv`.
2. A Share button for Timed results (copies an emoji grid).
3. Add Plausible or another privacy-friendly analytics script to see where players drop off.
4. Show the best key solution after a level is cleared ("par route").

### Bigger ideas

1. **Operator worlds:** `d`, `c`, `y` plus motions (`dw` breaks a bridge, `ci(` refills a bracket room). This is the Vim people most want to learn, and the game doesn't teach it yet.
2. **Ghost replays:** race your best key sequence, or a friend's.
3. **Level editor plus shared codes:** players make the content.
4. **Real-file mode:** paste your own code and the game builds a room from it.
5. **An original hero** (a cursor or a block caret character) and a new name. That fixes the legal risk and gives the game its own identity.

## Time estimates

- Phone fix plus share button: about 2 hours
- Rebrand and new sprites: 1–2 days
- One operator world (3 levels): about 1 day, using the existing `course()`/`buffer()` helpers
