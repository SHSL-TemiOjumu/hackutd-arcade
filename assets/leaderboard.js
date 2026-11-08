// PoyoDash x SpacetimeDB: global leaderboard, player names, live online count.
// Drop this in assets/ and load it AFTER the game script and AFTER bindings.iife.js.
// It wraps the game's own functions, so index.html needs no other edits.
(function () {
  // ===== SET THIS =====
  const HOST = 'https://maincloud.spacetimedb.com';
  const DB_NAME = 'poyodash-7x6t7';          // the name you used in `spacetime publish`
  // ====================

  const NET = {
    conn: null, myId: null, status: 'connecting',
    rows: [], online: 0, myName: 'PLAYER', myBest: 0, myRank: 0
  };

  // ---------- talking to the server ----------
  function call(name, args) {
    if (!NET.conn) return;
    try {
      const r = NET.conn.reducers[name](args || {});
      if (r && r.catch) r.catch(e => console.warn('[net]', name, 'failed:', e));
    } catch (e) { console.warn('[net]', name, 'error:', e); }
  }

  function startRun() { call('startRun', {}); }

  function submitRun() {
    call('submitRun', {
      score: Math.max(0, Math.floor(score)),
      character: String(CHARACTERS[selected].name).toUpperCase().trim()
    });
  }

  function askName() {
    if (NET.status !== 'online') { alert('The leaderboard is offline right now.'); return; }
    const n = window.prompt('Pick a name for the leaderboard (1-12 characters):',
                            NET.myName === 'PLAYER' ? '' : NET.myName);
    if (n === null) return;
    const clean = n.trim().slice(0, 12);
    if (clean) call('setName', { name: clean });
  }

  // ---------- keeping a local, sorted copy of the table ----------
  function refresh() {
    if (!NET.conn) return;
    try {
      const all = [];
      for (const p of NET.conn.db.player.iter()) all.push(p);
      NET.online = all.filter(p => p.online).length;
      NET.rows = all.filter(p => Number(p.bestScore) > 0)
                    .sort((a, b) => Number(b.bestScore) - Number(a.bestScore));
      const me = all.find(p => p.identity.toHexString() === NET.myId);
      NET.myName = me ? me.name : 'PLAYER';
      NET.myBest = me ? Number(me.bestScore) : 0;
      const idx = NET.rows.findIndex(p => p.identity.toHexString() === NET.myId);
      NET.myRank = idx >= 0 ? idx + 1 : 0;
    } catch (e) { console.warn('[net] refresh error:', e); }
  }

  function connect() {
    try {
      if (typeof DbConnection === 'undefined') {
        NET.status = 'offline';
        console.warn('[net] bindings.iife.js did not load, running without a leaderboard');
        return;
      }
      const KEY = HOST + '/' + DB_NAME + '/auth_token';
      let token = null;
      try { token = localStorage.getItem(KEY); } catch (e) {}

      let b = DbConnection.builder()
        .withUri(HOST)
        .withDatabaseName(DB_NAME)
        .withToken(token)
        .onConnect((conn, identity, tok) => {
          NET.conn = conn;
          NET.myId = identity.toHexString();
          NET.status = 'online';
          try { localStorage.setItem(KEY, tok); } catch (e) {}
          console.log('[net] connected as', NET.myId);
          conn.db.player.onInsert(refresh);
          conn.db.player.onUpdate(refresh);
          conn.db.player.onDelete(refresh);
          conn.subscriptionBuilder()
            .onApplied(refresh)
            .subscribe(typeof tables !== 'undefined' ? tables.player : ['SELECT * FROM player']);
        });
      if (typeof b.onDisconnect === 'function') {
        b = b.onDisconnect(() => { NET.conn = null; NET.status = 'offline'; console.warn('[net] disconnected'); });
      }
      if (typeof b.onConnectError === 'function') {
        b = b.onConnectError((ctx, err) => { NET.status = 'offline'; console.warn('[net] connect error:', err); });
      }
      b.build();
    } catch (e) {
      NET.status = 'offline';
      console.error('[net] could not connect:', e);
    }
  }

  // ---------- drawing ----------
  function plate(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function layout() {
    const stripY = GROUND + (H - GROUND) / 2;
    const w = 165, h = 40, gap = 16;
    return {
      stripY,
      board: { x: W / 2 - w - gap / 2, y: stripY - h / 2, w, h },
      name:  { x: W / 2 + gap / 2,     y: stripY - h / 2, w, h }
    };
  }

  function drawPlate(r, label) {
    ctx.save();
    plate(r.x, r.y, r.w, r.h, 10);
    ctx.fillStyle = 'rgba(42, 29, 77, 0.95)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#5a46a0';
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + 1);
    ctx.restore();
  }

  function drawTitleNet() {
    const L = layout();
    drawPlate(L.board, '🏆 LEADERBOARD');
    drawPlate(L.name, 'NAME: ' + String(NET.myName).toUpperCase().slice(0, 12));
    ctx.save();
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const on = NET.status === 'online';
    ctx.fillStyle = on ? '#6dff9c' : '#8f82c9';
    ctx.fillText(on ? '● ' + NET.online + ' ONLINE' : '○ OFFLINE', SAFE_L + 14, 22);
    ctx.restore();
  }

  function drawOverNet() {
    if (NET.status !== 'online') return;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#c9b8ff';
    ctx.font = '16px monospace';
    const t = NET.myRank
      ? 'WORLD RANK #' + NET.myRank + '   ·   YOUR BEST ' + NET.myBest
      : 'FINISH A RUN TO JOIN THE LEADERBOARD';
    // sits between the game's SCORE/BEST lines (up to 0.68) and "PRESS JUMP TO RETRY" (0.86)
    ctx.fillText(t, W / 2, GROUND * 0.77);
    ctx.restore();
  }

  function drawBoard() {
    ctx.save();
    ctx.fillStyle = 'rgba(8, 10, 30, 0.94)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px monospace';
    ctx.fillText('WORLD LEADERBOARD', W / 2, 32);

    const x0 = W / 2 - 230, x1 = W / 2 + 230, top = 50, rowH = 19;
    const n = Math.max(3, Math.min(10, Math.floor((GROUND - top - 22) / rowH)));
    ctx.font = '14px monospace';

    const message = (t) => {
      ctx.fillStyle = '#c9b8ff';
      ctx.textAlign = 'center';
      ctx.fillText(t, W / 2, GROUND * 0.5);
    };

    if (NET.status !== 'online') {
      message("OFFLINE - CAN'T REACH THE LEADERBOARD");
    } else if (!NET.rows.length) {
      message('NO SCORES YET - BE THE FIRST!');
    } else {
      const row = (p, i, y) => {
        const mine = p.identity.toHexString() === NET.myId;
        if (mine) {
          ctx.fillStyle = 'rgba(199, 125, 255, 0.22)';
          ctx.fillRect(x0, y - 14, x1 - x0, rowH - 1);
        }
        ctx.textAlign = 'left';
        ctx.fillStyle = mine ? '#ffffff' : '#d8ccff';
        ctx.fillText('#' + (i + 1), x0 + 8, y);
        if (p.online) {
          ctx.fillStyle = '#6dff9c';
          ctx.beginPath(); ctx.arc(x0 + 52, y - 5, 3, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = mine ? '#ffffff' : '#d8ccff';
        ctx.fillText(String(p.name).toUpperCase().slice(0, 12), x0 + 64, y);
        ctx.fillStyle = '#8f82c9';
        ctx.fillText(String(p.character).slice(0, 8), x0 + 210, y);
        ctx.fillStyle = mine ? '#ffffff' : '#d8ccff';
        ctx.textAlign = 'right';
        ctx.fillText(String(Number(p.bestScore)), x1 - 8, y);
      };
      NET.rows.slice(0, n).forEach((p, i) => row(p, i, top + 16 + i * rowH));
      if (NET.myRank > n) row(NET.rows[NET.myRank - 1], NET.myRank - 1, top + 16 + n * rowH + 6);
    }

    ctx.fillStyle = '#8f82c9';
    ctx.font = '13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('TAP ANYWHERE OR PRESS JUMP TO GO BACK', W / 2, layout().stripY + 4);
    ctx.restore();
  }

  // ---------- hooks into the game (wraps the game's own functions) ----------
  const _start = start, _confirm = confirmChar, _update = update, _draw = draw, _jump = jump;

  start = function () { _start(); startRun(); };                 // restart after game over
  confirmChar = function () { _confirm(); startRun(); };         // begin from character select

  update = function (dt) {                                        // detect the moment of death
    const was = state;
    _update(dt);
    if (was === 'play' && state === 'over') submitRun();
  };

  jump = function () {                                            // JUMP leaves the leaderboard
    if (state === 'board') { state = 'ready'; return; }
    _jump();
  };

  draw = function () {
    _draw();
    if (state === 'board') drawBoard();
    else if (state === 'ready') drawTitleNet();
    else if (state === 'over') drawOverNet();
  };

  // taps on the title-screen plates (runs before the game's own canvas tap handler)
  document.addEventListener('pointerdown', function (e) {
    if (e.target !== cv) return;
    if (state === 'board') { state = 'ready'; e.stopPropagation(); return; }
    if (state !== 'ready') return;
    // use the game's own screen->canvas conversion (it measures the real canvas size, which iOS needs)
    const p = canvasPoint(e);
    const L = layout();
    const hit = (r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
    if (hit(L.board)) { state = 'board'; e.stopPropagation(); }
    else if (hit(L.name)) { askName(); e.stopPropagation(); }
  }, true);

  connect();
})();
