import { schema, table, t, SenderError } from 'spacetimedb/server';

// Must match the character names in the game
const CHARACTERS = ['POYO', 'REMUS', 'CONDOR', 'OCT4N5'];

const spacetimedb = schema({
  // PUBLIC: one row per player. The leaderboard is this table sorted by bestScore.
  player: table(
    { public: true },
    {
      identity: t.identity().primaryKey(),
      name: t.string(),
      bestScore: t.u32(),
      character: t.string(),
      online: t.bool(),
      updatedAt: t.timestamp(),
    }
  ),

  // PRIVATE: the run each player has in progress.
  run: table(
    { public: false },
    {
      identity: t.identity().primaryKey(),
      startedAt: t.timestamp(),
    }
  ),
});
export default spacetimedb;

// Highest score anyone could possibly reach in `seconds` (matches the game's speed curve)
function maxPossibleScore(seconds: number): number {
  const RAMP = 55.6;
  if (seconds <= RAMP) return 36 * seconds + 0.54 * seconds * seconds;
  return 36 * RAMP + 0.54 * RAMP * RAMP + 96 * (seconds - RAMP);
}

export const init = spacetimedb.init(_ctx => {
  // Called when the module is initially published
});

export const onConnect = spacetimedb.clientConnected(ctx => {
  const existing = ctx.db.player.identity.find(ctx.sender);
  if (existing) {
    ctx.db.player.identity.update({ ...existing, online: true });
  } else {
    ctx.db.player.insert({
      identity: ctx.sender,
      name: 'PLAYER',
      bestScore: 0,
      character: 'POYO',
      online: true,
      updatedAt: ctx.timestamp,
    });
  }
});

export const onDisconnect = spacetimedb.clientDisconnected(ctx => {
  const existing = ctx.db.player.identity.find(ctx.sender);
  if (existing) {
    ctx.db.player.identity.update({ ...existing, online: false });
  }
});

export const setName = spacetimedb.reducer({ name: t.string() }, (ctx, { name }) => {
  const clean = name.trim();
  if (clean.length < 1 || clean.length > 12) {
    throw new SenderError('Name must be 1 to 12 characters');
  }
  const player = ctx.db.player.identity.find(ctx.sender);
  if (!player) throw new SenderError('Player not found');
  ctx.db.player.identity.update({ ...player, name: clean, updatedAt: ctx.timestamp });
});

export const startRun = spacetimedb.reducer(ctx => {
  const existing = ctx.db.run.identity.find(ctx.sender);
  if (existing) {
    ctx.db.run.identity.update({ identity: ctx.sender, startedAt: ctx.timestamp });
  } else {
    ctx.db.run.insert({ identity: ctx.sender, startedAt: ctx.timestamp });
  }
});

export const submitRun = spacetimedb.reducer(
  { score: t.u32(), character: t.string() },
  (ctx, { score, character }) => {
    const run = ctx.db.run.identity.find(ctx.sender);
    if (!run) throw new SenderError('No active run');
    const player = ctx.db.player.identity.find(ctx.sender);
    if (!player) throw new SenderError('Player not found');
    if (!CHARACTERS.includes(character)) throw new SenderError('Unknown character');

    const seconds =
      Number(ctx.timestamp.microsSinceUnixEpoch - run.startedAt.microsSinceUnixEpoch) / 1_000_000;

    ctx.db.run.identity.delete(ctx.sender);

    // 25% slack (+50) for network delay; anything beyond is impossible
    const limit = Math.floor(maxPossibleScore(seconds) * 1.25) + 50;
    if (score > limit) {
      console.info(`Rejected score ${score} after ${seconds.toFixed(1)}s from ${player.name}`);
      return;
    }

    if (score > player.bestScore) {
      ctx.db.player.identity.update({
        ...player,
        bestScore: score,
        character,
        updatedAt: ctx.timestamp,
      });
    }
  }
);