# KEDARMAN

A browser maze chase for Square44. The player is **Kedar Karippail**, Head of Client Service. His photo sits in the yellow body, and the mouth opens and closes while he moves.

v1 has one classic-style board, pellets, four quadrant power marks, four ghosts, lives, scoring, and win / lose screens.

## Play

From the repo folder, either open the file or start a static server.

```bash
# macOS
open index.html

# Linux
xdg-open index.html

# Windows
start index.html

# or a tiny server — then visit the URL it prints
npx serve .
python3 -m http.server 8080
```

No install and no build. It is HTML, CSS, and JavaScript.

### Controls

- Arrow keys or WASD to turn
- P or Esc to pause, M to mute
- On a phone, swipe the board or use the pad

Pellets are 10. Quadrant marks are 50 and send the ghosts running. Eating a frightened ghost scores 200, then 400, 800, 1600. The Square44 **44** that appears under the pen is worth 440. Clearing a board scores 1000 × the level and starts a faster one. One extra life at 3,000 points. Best score stays in this browser.

## GitHub Pages

1. Push `main`.
2. On GitHub: **Settings → Pages → Build and deployment → Deploy from a branch**.
3. Branch `main`, folder **`/ (root)`**, then Save.

The game is then at:

`https://mathijsaliet.github.io/kedarman/`

## Collaborating on v2 and v3

v1 stays on `main`, which is also what Pages serves. Lut and Boe can each branch from that without breaking the live game.

```bash
git checkout main
git pull
git checkout -b v2-lut    # Lut
git checkout -b v3-boe    # Boe
```

Swap the names if you want a different split. Open a pull request back into `main` when a version is ready. Keep `main` playable.

A useful split:

- **v2 — Lut.** New boards and level pacing. The maze is the string table in `js/maze.js` (`KM.MAP`, 28 columns). Spawns are `KM.PAC_START`, `KM.GHOSTS`, and `KM.BONUS`. Speed and frightened time are `levelScale()` and `frightSeconds()` in `js/game.js`.
- **v3 — Boe.** Ghost personalities, audio, and extras. Chase rules are `targetFor()` in `js/game.js`. Sounds are `js/audio.js`. The face wedge is `drawKedar()`.

`KM.debug` is on the page for local checks:

- `KM.debug.state()` — mode, score, pellet count, positions
- `KM.debug.win()` — clear the board
- `KM.debug.kill()` — lose the last life
- `KM.debug.moveTo(col, row)` and `KM.debug.fright()` — drop Kedar on a tile, or start a power-pellet scare

Add `?play=1` to skip the title screen.

## Layout

| Path | What it is |
| --- | --- |
| `index.html` | Cabinet, score, screens, touch pad |
| `css/style.css` | Layout and Square44 colours |
| `js/maze.js` | Board, tile size, spawns |
| `js/audio.js` | Chomp, siren, stingers |
| `js/game.js` | Movement, ghosts, drawing, game states |
| `assets/kedar.jpg` | Kedar’s photo, cropped onto the player at runtime |
| `assets/fonts/` | Bungee and Outfit (SIL Open Font License) |

Colours follow Square44: copper `#C57D3A`, alabaster `#F9F9F9`, near-black `#0B0B0B`. Quadrant pellets use copper, cream, coral, and teal.

## License

[MIT](LICENSE). The bundled fonts stay under the [SIL Open Font License](assets/fonts/OFL.txt).
