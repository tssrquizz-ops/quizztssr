// ─── srs.js — Révision Ciblée (répétition espacée) ───
// ============================================================
// SYSTÈME SRS — Répétition Espacée (Spaced Repetition System)
// ============================================================
var QDB = {};  // {hash: {seen, correct, streak, ease, nextReview}}

function getQHash(q) {
  var s = (q.q || '').slice(0, 40);
  var h = 0;
  for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0x7fffffff;
  return 'q' + h;
}

function loadQDB() {
  QDB = lsGet('tssr5_qdb', {});
}

function saveQDB() {
  lsSet('tssr5_qdb', QDB);
}

function getQRecord(q) {
  loadQDB();
  var h = getQHash(q);
  if (!QDB[h]) QDB[h] = {seen:0, correct:0, streak:0, ease:2.5, nextReview:0};
  return QDB[h];
}

function updateQSRS(q, ok) {
  var h = getQHash(q);
  var r = getQRecord(q);
  r.seen++;
  if (ok) {
    r.correct++;
    r.streak++;
    var ease = Math.max(1.3, Math.min(r.ease + (ok ? 0.1 : -0.2), 3.0));
    r.ease = ease;
    var interval = Math.round(Math.min(r.streak * ease, 21));
    r.nextReview = Date.now() + interval * 86400000;
  } else {
    r.streak = 0;
    r.ease = Math.max(1.3, r.ease - 0.2);
    r.nextReview = Date.now() + 600000; // retry in 10 min
  }
  QDB[h] = r;
  saveQDB();
}

function getSRSStatus(q) {
  var r = getQRecord(q);
  if (r.seen === 0) return 'new';
  var now = Date.now();
  if (now >= r.nextReview) return r.streak === 0 ? 'hard' : 'due';
  return 'ok';
}

function getSRSLabel(q) {
  var s = getSRSStatus(q);
  var labels = {new:'NOUVEAU', due:'À REVOIR', ok:'MAÎTRISÉ', hard:'DIFFICILE'};
  return '<span class="srs-badge srs-'+s+'">'+labels[s]+'</span>';
}

function getDuePool(pool) {
  loadQDB();
  var now = Date.now();
  return pool.filter(function(q) {
    var r = getQRecord(q);
    return r.seen === 0 || now >= r.nextReview;
  }).sort(function(a, b) {
    var ra = getQRecord(a), rb = getQRecord(b);
    // Unseen first, then most overdue, then hardest
    if (ra.seen === 0 && rb.seen > 0) return -1;
    if (rb.seen === 0 && ra.seen > 0) return 1;
    return (ra.nextReview - rb.nextReview) || (ra.ease - rb.ease);
  });
}

function showSRSScreen() {
  loadQDB();
  showScreen('srs');
  var now = Date.now();
  var totalSeen = 0, totalDue = 0, totalNew = 0, totalMastered = 0;
  var allQs = [];
  Object.keys(CATS).forEach(function(catId) {
    if (catId === 'mix') return;
    CATS[catId].qs.forEach(function(q) { allQs.push({q:q, cat:catId}); });
  });

  allQs.forEach(function(item) {
    var r = getQRecord(item.q);
    if (r.seen === 0) { totalNew++; return; }
    totalSeen++;
    if (now >= r.nextReview) totalDue++;
    else if (r.streak >= 3) totalMastered++;
  });

  var el2 = function(id) { return document.getElementById(id); };
  if (el2('srs-total')) el2('srs-total').textContent = totalSeen;
  if (el2('srs-due')) el2('srs-due').textContent = totalDue;
  if (el2('srs-new')) el2('srs-new').textContent = totalNew;
  if (el2('srs-mastered')) el2('srs-mastered').textContent = totalMastered;

  // Category rows
  var rows = document.getElementById('srs-cat-rows');
  if (!rows) return;
  rows.innerHTML = '';
  Object.keys(CATS).forEach(function(catId) {
    if (catId === 'mix') return;
    var cat = CATS[catId];
    var due = 0, seen = 0;
    cat.qs.forEach(function(q) {
      var r = getQRecord(q);
      if (r.seen > 0) { seen++; if (now >= r.nextReview) due++; }
    });
    var pct = cat.qs.length > 0 ? Math.round(seen / cat.qs.length * 100) : 0;
    var row = document.createElement('div');
    row.className = 'srs-cat-row';
    row.innerHTML =
      '<span class="srs-cat-name">' + cat.icon + ' ' + cat.label + '</span>' +
      (due > 0 ? '<span class="srs-cat-due">'+due+' à revoir</span>' : '') +
      '<div class="srs-cat-bar"><div class="srs-cat-fill" style="width:'+pct+'%"></div></div>' +
      '<span style="font-family:monospace;font-size:8px;color:var(--dim);">'+pct+'%</span>';
    row.onclick = (function(cid){ return function(){
      selCat = cid;
      selMode = 'srs_mode';
      startSRSSession(cid);
    }; })(catId);
    rows.appendChild(row);
  });
}

function startSRSSession(catId) {
  var cat = CATS[catId] || CATS['mix'];
  var pool = catId === 'mix' ? [] : cat.qs;
  if (catId === 'mix') {
    Object.keys(CATS).forEach(function(k) { if (k !== 'mix') CATS[k].qs.forEach(function(q){ pool.push(q); }); });
  }
  var due = getDuePool(pool);
  if (due.length === 0) {
    alert('Aucune question à revoir pour l\'instant !');
    return;
  }
  session = due.slice(0, Math.min(20, due.length));
  selMode = 'chill'; // SRS uses chill mode mechanics
  correct = 0; combo = 1; maxCombo = 1; errors = []; idx = 0; paused = false;
  bonusStreak = 0; lives = 5; jokers = 3; qTimes = [];
  sStats = {cat: catId, mode:'srs', maxCombo:0, mechs:new Set(), streak:streakD.current};
  applyBody();
  el('gbadge').textContent = '🔁 CIBLÉE · ' + (cat.label || 'MIX').toUpperCase() + ' · ' + due.length + ' dues';
  el('htotal').textContent = session.length;
  var sh = el('score-hud'); if (sh) sh.style.display = 'grid';
  el('jokers-row').style.display = 'flex';
  el('jcount').textContent = jokers;
  buildDots();
  showScreen('game');
  showQ();
}

// ============================================================
// STATS PAR QUESTION — Tab dans les résultats
// ============================================================
function buildQStatsTab() {
  var tab = document.getElementById('tab-qstats');
  if (!tab) return;
  loadQDB();
  var rows = session.map(function(q) {
    var r = getQRecord(q);
    var rate = r.seen > 0 ? Math.round(r.correct / r.seen * 100) : null;
    var col = rate === null ? 'var(--dim)' : rate >= 80 ? '#4ade80' : rate >= 50 ? '#fbbf24' : '#f87171';
    var status = getSRSStatus(q);
    var statusLabels = {new:'⭐ Nouveau', due:'🔄 À revoir', ok:'✅ Maîtrisé', hard:'🔥 Difficile'};
    return '<div class="qstat-row">' +
      '<div class="qstat-q">' + q.q.slice(0, 80) + (q.q.length > 80 ? '…' : '') + '</div>' +
      '<div class="qstat-rate" style="color:' + col + '">' + (rate !== null ? rate + '%' : 'Jamais') + '</div>' +
      '<div class="qstat-seen">' + r.seen + ' vues</div>' +
      '<div class="qstat-streak" title="' + statusLabels[status] + '">' + statusLabels[status] + '</div>' +
      '</div>';
  });
  tab.innerHTML = rows.join('') || '<div style="padding:16px;text-align:center;font-size:10px;color:var(--dim)">Pas encore de données pour ces questions</div>';
}


// ============================================================
// SKIP QUESTION
// ============================================================
function skipQuestion(){
  if(answered) return;
  clearInterval(timerInt);
  answered = true;
  updDot(idx, 'pdot');
  var fbk = el('fbk');
  fbk.className = 'fbk show';
  fbk.style.cssText = 'border:1.5px solid #ff9800;background:rgba(255,152,0,.08);color:#cc7700;display:block;';
  fbk.innerHTML = '⏭ Question passée.';
  el('nextbtn').className = 'next-btn show';
}
