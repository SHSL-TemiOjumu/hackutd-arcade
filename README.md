# hackutd-arcade
A HackUTD-themed endless runner arcade game controlled by an Arduino Uno Q

**Play:** https://shsl-temiojumu.github.io/hackutd-arcade/

## Global leaderboard (SpacetimeDB)

The game has a worldwide leaderboard, player names and a live online count, powered by
[SpacetimeDB](https://spacetimedb.com) on Maincloud (database `poyodash-7x6t7`).

| Folder / file | What it is |
|---|---|
| `index.html`, `assets/` | The game itself (this is what GitHub Pages serves) |
| `assets/leaderboard.js` | Connects to the database, draws the leaderboard, submits scores |
| `assets/bindings.iife.js` | Generated connection code (built from `tools/`, don't edit by hand) |
| `spacetimedb/` | Server module: the `player` table and `setName` / `startRun` / `submitRun` reducers |
| `tools/` | Generates and bundles `bindings.iife.js` |

### After changing the server code

```bash
spacetime publish poyodash-7x6t7 --server maincloud   # from the repo root
cd tools
npm install          # first time only
npm run generate     # refresh the TypeScript bindings
npm run bindings     # rebuild assets/bindings.iife.js
```

### Run locally

Serve the repo root with any static server, e.g. `npx serve .`, then open the address it prints.
