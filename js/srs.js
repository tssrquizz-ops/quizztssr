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

// ============================================================
// TIMER ADAPTATIF
// ============================================================
var MECH_TIMERS={qcm:1.0,tf:0.6,fill:1.0,calc:1.5,debug:1.2,type:1.2,slider:1.0,word:1.8,scramble:2.0,order:3.5,match:3.0,multiblank:2.5,categorize:3.0,hotspot:4.0};
var MECH_MIN_TIMER={order:30,match:25,categorize:30,hotspot:40,multiblank:20,word:18,scramble:15,calc:12,debug:12,type:12};
function getQTimer(q,baseTimer){
  if(!baseTimer||baseTimer===0) return 0;
  var mult=MECH_TIMERS[q.t]||1.0;
  var minT=MECH_MIN_TIMER[q.t]||0;
  return Math.max(Math.round(baseTimer*mult),minT,baseTimer);
}

// ============================================================
// RÉGLAGES
// ============================================================
function openSettingsScreen(){
  showScreen('settings');
  var ss=document.getElementById('stoggle-settings'); if(ss) ss.classList.toggle('on',soundOn);
  var ls=document.getElementById('lofi-btn-settings'); if(ls) ls.textContent=lofiOn?'ON':'OFF';
  document.querySelectorAll('.settings-theme-btn').forEach(function(b){
    b.classList.toggle('sel', b.getAttribute('data-vt')===vTheme);
  });
  var em=document.getElementById('settings-email-display');
  if(em&&window._fbUser) em.textContent=window._fbUser.email||'—';
}

function pickVTSettings(btn){
  if(typeof playThemeChange==='function') playThemeChange();
  document.querySelectorAll('.settings-theme-btn').forEach(function(b){b.classList.remove('sel');});
  btn.classList.add('sel');
  vTheme=btn.getAttribute('data-vt');
  lsSet('tssr5_vt',vTheme);
  applyBody();
  if(window.fbSaveUserData) setTimeout(window.fbSaveUserData,500);
}

function toggleSound(){
  soundOn=!soundOn;
  lsSet('tssr5_sound',soundOn);
  ['stoggle','stoggle-menu','stoggle-settings'].forEach(function(id){
    var t=document.getElementById(id); if(t) t.classList.toggle('on',soundOn);
  });
  if(window.fbSaveUserData) setTimeout(window.fbSaveUserData,500);
}

// ============================================================
// PROFIL
// ============================================================
var AVATARS=['😊','😎','🤓','🧑‍💻','👨‍💻','👩‍💻','🦊','🐺','🐸','🤖','👾','🎯','🔥','⚡','🌙','🎮','📡','🛡️','🗺️','💡','🔑','🏆','💎','⚙️','🧠','🦁','🐉','🦅','🌊','🚀','🎭','🎲','🧩','📚','🖥️'];
var PROFILE_TITLES=[
  {min:0,   label:'DÉBUTANT',      cls:'title-debutant'},
  {min:10,  label:'TECHNICIEN',    cls:'title-technicien'},
  {min:30,  label:'INTERMÉDIAIRE', cls:'title-intermediaire'},
  {min:60,  label:'EXPERT',        cls:'title-expert'},
  {min:100, label:'TSSR CERTIFIÉ', cls:'title-tssr'},
];
var PROFILE_THEMES=[
  {id:'vt-dark',    dot:'#5b8fff',label:'DARK'},
  {id:'vt-light',   dot:'#0070b0',label:'LIGHT'},
  {id:'vt-slate',   dot:'#4488ff',label:'SLATE'},
  {id:'vt-paper',   dot:'#a07000',label:'PAPER'},
  {id:'vt-midnight',dot:'#8866ff',label:'NIGHT'},
  {id:'vt-warm',    dot:'#ff8860',label:'WARM'},
];

function getProfileTitle(n){
  var t=PROFILE_TITLES[0];
  for(var i=PROFILE_TITLES.length-1;i>=0;i--){ if(n>=PROFILE_TITLES[i].min){t=PROFILE_TITLES[i];break;} }
  return t;
}
function getMasteredCount(){
  if(typeof loadQDB==='function') loadQDB();
  var now=Date.now(),count=0;
  Object.keys(CATS).forEach(function(k){
    if(k==='mix') return;
    CATS[k].qs.forEach(function(q){
      var r=typeof getQRecord==='function'?getQRecord(q):{seen:0,streak:0,nextReview:0};
      if(r.seen>0&&r.streak>=3&&now<r.nextReview) count++;
    });
  });
  return count;
}
function loadProfileData(){ return lsGet('tssr5_profile',{avatar:'😊',pseudo:'',promo:''}); }

function updateMenuProfile(){
  var data=loadProfileData();
  var mastered=getMasteredCount();
  var title=getProfileTitle(mastered);
  var ma=document.getElementById('menu-avatar');
  var mp=document.getElementById('menu-pseudo');
  var mt=document.getElementById('menu-title-badge');
  if(ma) ma.textContent=data.avatar||'😊';
  if(mp) mp.textContent=data.pseudo||(window._fbUser?(window._fbUser.displayName||window._fbUser.email.split('@')[0]):'');
  if(mt){mt.textContent=title.label;mt.className=title.cls;}
}

