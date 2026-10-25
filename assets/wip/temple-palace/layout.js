// The palace, as three maps. Prints each one's rows. node layout.js [ground|upper|stair]
// Ground floor: in from the court by the west door, a long gallery lined with statues, two side chambers off each side
// of it (2-wide openings: a door in a wall running east-west can't be drawn), the great hall to the east with two
// rows of columns, braziers, and the throne on a dais at its east end; in a niche in the hall's south wall the stair
// down; stairs up in the north-west chamber.
// Upper floor: the denizens' rooms (beds) and the servants' hall (cots, a long table) either side of a corridor.
// The stair down: a long stair passage with a few small rooms off it (cots, a table, barrels), the stair down to the
// ritual chamber at its end.
const which = process.argv[2] || 'ground';
const grid = (W, H) => Array.from({ length: H }, () => Array(W).fill('#'));
const rect = (g, x0, y0, x1, y1, ch) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y][x] = ch; };
const put = (g, list, ch) => { for (const [x, y] of list) g[y][x] = ch; };
const print = (g) => console.log(g.map((r) => `    - "${r.join('')}"`).join('\n'));

if (which === 'ground') {
  const g = grid(42, 32);
  rect(g, 2, 12, 17, 18, '.');                     // the gallery
  rect(g, 2, 2, 8, 9, '.'); rect(g, 11, 2, 17, 9, '.');      // north chambers
  rect(g, 2, 21, 8, 29, '.'); rect(g, 11, 21, 17, 29, '.');  // south chambers
  rect(g, 5, 10, 6, 11, '.'); rect(g, 14, 10, 15, 11, '.');  // openings north
  rect(g, 5, 19, 6, 20, '.'); rect(g, 14, 19, 15, 20, '.');  // openings south
  rect(g, 20, 3, 39, 27, '.');                     // the great hall
  rect(g, 18, 14, 19, 16, '.');                    // its opening from the gallery
  rect(g, 28, 28, 31, 29, '.');                    // the niche in its south wall
  rect(g, 34, 9, 38, 19, '|');                     // the dais
  g[15][1] = 'W';                                  // the west door, from the court
  put(g, [[3, 12], [7, 12], [11, 12], [3, 18], [7, 18], [11, 18]], 's');   // statues along the gallery
  put(g, [[24, 7], [28, 7], [32, 7], [24, 23], [28, 23], [32, 23]], 'c');  // columns
  put(g, [[22, 4], [22, 26], [37, 8], [37, 20]], 'b');                    // braziers
  g[14][37] = 'T';                                 // the throne
  g[29][30] = 'D';                                 // the stair down, at the back of the niche
  g[2][5] = 'U';                                   // the stairs up
  g[14][35] = 'k';                                 // the court of the throne
  g[15][26] = 'h';                                 // the hall guard
  g[25][6] = 'C'; g[5][15] = 'r';
  print(g);
} else if (which === 'upper') {
  const g = grid(34, 22);
  rect(g, 2, 9, 31, 11, '.');                      // the corridor
  rect(g, 2, 2, 8, 6, '.'); rect(g, 11, 2, 17, 6, '.'); rect(g, 20, 2, 31, 6, '.');     // the denizens' rooms
  rect(g, 2, 14, 17, 19, '.');                     // the servants' hall
  rect(g, 20, 14, 31, 19, '.');                    // the kitchen and store
  for (const x of [5, 14, 25]) rect(g, x, 7, x + 1, 8, '.');
  for (const x of [8, 27]) rect(g, x, 12, x + 1, 13, '.');
  g[10][2] = 'U';                                  // the stairs down (the ground floor's U)
  put(g, [[3, 3], [7, 3], [12, 3], [16, 3]], 'B'); // beds
  put(g, [[22, 3], [30, 3]], 'B');
  put(g, [[3, 15], [5, 15], [7, 15], [3, 19], [5, 19], [7, 19]], 'o');   // cots
  put(g, [[12, 16], [15, 16]], 't');               // the long table
  put(g, [[21, 15], [21, 18], [30, 15]], 'a');     // barrels
  g[17][26] = 't';
  g[4][26] = 'C';
  g[16][12 - 1] = 'q'; g[4][9 - 1] = 'z';
  print(g);
} else {
  const g = grid(22, 26);
  rect(g, 9, 2, 12, 23, '.');                      // the stair passage, north to south
  rect(g, 2, 5, 7, 9, '.'); rect(g, 14, 9, 19, 13, '.'); rect(g, 2, 16, 7, 20, '.');    // small rooms
  g[7][8] = '+'; g[11][13] = '+'; g[18][8] = '+';  // their doors, in walls running north-south
  g[2][10] = 'U';                                  // up to the palace (its D)
  g[23][11] = 'R';                                 // down to the ritual chamber (its S)
  put(g, [[3, 6], [5, 6]], 'o'); g[8][6] = 'a';
  g[11][16] = 't'; put(g, [[18, 10], [18, 12]], 'a');
  put(g, [[3, 17], [5, 17]], 'o'); g[19][3] = 'C';
  g[14][10] = 'g';
  print(g);
}
