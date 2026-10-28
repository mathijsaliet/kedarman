/* KEDARMAN board.
   One character per tile, 28 columns by 31 rows.
   # wall   . pellet   o quadrant pellet
   e empty floor   = ghost house   - door
   space is outside the maze (not walkable)
   Keep every row the same width. v2 mazes can replace KM.MAP. */
(function () {
  const KM = (window.KM = window.KM || {});

  KM.TILE = 24;
  KM.COLS = 28;
  KM.ROWS = 31;
  KM.TUNNEL_ROW = 14;
  KM.DOOR_ROW = 12;

  KM.FACE = { x: 160, y: 8, size: 480 };

  KM.PAC_START = { c: 13, r: 23 };
  KM.BONUS = { c: 13, r: 17 };

  KM.GHOSTS = [
    {
      name: "Blinky",
      color: "#ff4d4d",
      start: { c: 13, r: 11 },
      home: { c: 14, r: 14 },
      exitC: 13,
      release: 0,
      out: true,
      scatter: { c: 25, r: -3 },
      phase: 0,
    },
    {
      name: "Pinky",
      color: "#ff8ec8",
      start: { c: 13, r: 13 },
      home: { c: 13, r: 13 },
      exitC: 13,
      release: 0,
      out: false,
      scatter: { c: 2, r: -3 },
      phase: 1.2,
    },
    {
      name: "Inky",
      color: "#4aefe6",
      start: { c: 11, r: 14 },
      home: { c: 11, r: 14 },
      exitC: 13,
      release: 30,
      out: false,
      scatter: { c: 27, r: 33 },
      phase: 2.1,
    },
    {
      name: "Clyde",
      color: "#ffb347",
      start: { c: 15, r: 14 },
      home: { c: 15, r: 14 },
      exitC: 14,
      release: 60,
      out: false,
      scatter: { c: 0, r: 33 },
      phase: 3.3,
    },
  ];

  KM.MAP = [
    "############################",
    "#............##............#",
    "#.####.#####.##.#####.####.#",
    "#o####.#####.##.#####.####o#",
    "#.####.#####.##.#####.####.#",
    "#..........................#",
    "#.####.##.########.##.####.#",
    "#.####.##.########.##.####.#",
    "#......##....##....##......#",
    "######.#####e##e#####.######",
    "     #.#####e##e#####.#     ",
    "     #.##eeeeeeeeee##.#     ",
    "     #.##e###--###e##.#     ",
    "######.##e#======#e##.######",
    "eeeeee.eee#======#eee.eeeeee",
    "######.##e#======#e##.######",
    "     #.##e########e##.#     ",
    "     #.##eeeeeeeeee##.#     ",
    "     #.##e########e##.#     ",
    "######.##e########e##.######",
    "#............##............#",
    "#.####.#####.##.#####.####.#",
    "#.####.#####.##.#####.####.#",
    "#o..##.......ee.......##..o#",
    "###.##.##.########.##.##.###",
    " ##.##.##.########.##.##.## ",
    "#......##....##....##......#",
    "#.##########.##.##########.#",
    "#.##########.##.##########.#",
    "#..........................#",
    "############################",
  ];
})();
