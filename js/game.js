// ─── game.js — Moteur de jeu, state, scoring, modes ───
function lsGet(k,d){try{var v=localStorage.getItem(k);return v!==null?JSON.parse(v):d;}catch(e){return d;}}
function lsSet(k,v){try{localStorage.setItem(k,JSON.stringify(v));if(window._fbUser&&window.fbSaveUserData){clearTimeout(window._fbSaveTimer);window._fbSaveTimer=setTimeout(window.fbSaveUserData,2000);}}catch(e){}}
// ─── Variables globales d'état ───
var vTheme=(function(){try{
  var t=localStorage.getItem('tssr5_vt')||'vt-light';
  if(t!=='vt-dark' && t!=='vt-light'){
    t='vt-light';
    try{localStorage.setItem('tssr5_vt',t);}catch(e){}
  }
  return t;
}catch(e){return 'vt-light';}})();
var selCat='reseau', selMode='chill', selDiff='all';
var soundOn=true, jokersEnabled=true;
var currentUI=(function(){try{return localStorage.getItem('tssr5_ui')||'ui-neon';}catch(e){return 'ui-neon';}})();
var session=[], idx=0, correct=0, lives=5, combo=1, maxCombo=1;
var errors=[], answered=false, timerInt=null, timeLeft=20, paused=false;
var betOn=false, bonusStreak=0;
var jokers=3, isBonus=false;
var orderItems=[], reviewBank=[];
var sStats={cat:'',mode:'',maxCombo:0,mechs:new Set(),streak:0};
var qTimes=[], rpgPoints=0;

// ─── Constantes modes & couleurs ───
var MODE_COLORS={
  chill:'#38bdf8', speed:'#22d3ee', survie:'#fb923c', blitz:'#ef4444',
  exam:'#a78bfa', erreurs:'#f472b6', chrono:'#fbbf24', mort:'#dc2626',
  marathon:'#4ade80', inverse:'#c084fc', speedrun:'#fbbf24', boss:'#ef4444',
  rpg:'#fbbf24', flash:'#34d399', duel:'#38bdf8', discussion:'#60a5fa',
  mix:'#e879f9', chaos:'#c026d3'
};
var MODES={
  chill:{timer:0,lives:5,tmax:0},
  speed:{timer:20,lives:5,tmax:20},
  survie:{timer:20,lives:3,tmax:20},
  blitz:{timer:10,lives:1,tmax:10},
  exam:{timer:0,lives:99,tmax:0,count:20},
  erreurs:{timer:0,lives:5,tmax:0},
  chrono:{timer:0,lives:99,tmax:0,timeLimit:180},
  mort:{timer:0,lives:1,tmax:0},
  marathon:{timer:0,lives:99,tmax:0,allQ:true},
  inverse:{timer:0,lives:5,tmax:0},
  speedrun:{timer:0,lives:99,tmax:0},
  boss:{timer:0,lives:3,tmax:0,bossMode:true},
  rpg:{timer:0,lives:5,tmax:0,rpgMode:true},
  chaos:{timer:15,lives:3,tmax:15,chaosMode:true}
};
var DS=['','FACILE ★','MOYEN ★★','DIFFICILE ★★★'];
var DS_COLORS=['','#4ade80','#ff9800','#f87171'];
var MECH_INFO={qcm:{label:'QCM',cls:'mp-qcm',hint:'A·B·C·D / Espace'},match:{label:'ASSOCIER',cls:'mp-word',hint:'Clique gauche puis droite'},tf:{label:'VRAI / FAUX',cls:'mp-tf',hint:'← Vrai  /  Faux →'},fill:{label:'COMPLÉTER',cls:'mp-fill',hint:'Clique sur la réponse'},order:{label:'REMETTRE EN ORDRE',cls:'mp-order',hint:'▲▼ ou glisse puis VALIDER'},calc:{label:'CALCUL',cls:'mp-calc',hint:'Clique sur ta réponse'},debug:{label:'TROUVER L\'ERREUR',cls:'mp-debug',hint:'A·B·C·D / Espace'},word:{label:'SÉLECTIONNER',cls:'mp-word',hint:'Clique les bons mots puis VALIDER'},type:{label:'SAISIE LIBRE',cls:'mp-fill',hint:'Tape ta réponse + Entrée'},slider:{label:'CURSEUR',cls:'mp-calc',hint:'Glisse le curseur puis confirme'},scramble:{label:'ANAGRAMME',cls:'mp-order',hint:'Clique les tuiles dans l\'ordre'},multiblank:{label:'MULTI-TROUS',cls:'mp-fill',hint:'Remplis chaque blanc'},categorize:{label:'CATÉGORISER',cls:'mp-word',hint:'Clique chip → colonne'},hotspot:{label:'SCHÉMA RÉSEAU',cls:'mp-calc',hint:'Identifie les zones'}};

// ─── Constantes discussion / CONF ───
var CONF_GOOD_ANSWER=['Exactement !','Parfait !','Très bien !','Correct !','Bonne réponse !','Oui, c\'est ça !','Tu as raison.','Absolument !'];
var CONF_BAD_ANSWER=['Non, pas tout à fait.','Ce n\'est pas ça.','Raté !','Incorrect.','Pas exactement.','Non, désolé.','Mauvaise réponse.'];
var CONF_GOOD_ACTION=['Super !','Bien joué !','Parfait !','Continue comme ça !','Excellent !'];
var CONF_NEUTRAL=['Hmm…','Intéressant.','Je vois.','D\'accord.','Notons ça.'];
var CONF_BAD_PISTE=['Mauvaise piste !','Pas dans cette direction.','Essaie encore.','Non, ce n\'est pas là.'];
var BONNE_PISTE=['Tu chauffes !','Bonne direction !','Continue !','Tu y es presque !'];
var MAUVAISE_PISTE=['Tu refroidis.','Mauvaise piste.','Cherche ailleurs.'];
var MECH_TIMERS={qcm:20,tf:15,fill:25,order:30,calc:20,debug:25,word:25,type:30,slider:20,scramble:30,multiblank:35,categorize:30,hotspot:25};
var MECH_MIN_TIMER=8;




var hsD=lsGet('tssr5_hs',{}),stD=lsGet('tssr5_stats',{}),xpD=lsGet('tssr5_xp',{total:0,level:1}),bdD=lsGet('tssr5_badges',[]);
var streakD=lsGet('tssr5_streak',{current:0,best:0,lastDate:''});
var savedVT=lsGet('tssr5_vt','vt-light');
var savedSound=lsGet('tssr5_sound',false);
var savedJokers=lsGet('tssr5_jokers',true);
var selQCount=lsGet('tssr5_qcount',10);

function el(id){return document.getElementById(id);}
/** Texte utilisateur / Firestore → fragment HTML échappé */
function escapeUserHtml(s){
  if(window.safeText) return window.safeText(String(s==null?'':s));
  var d=document.createElement('div'); d.textContent=String(s==null?'':s); return d.innerHTML;
}
/** Énoncés & contenus éditoriaux (HTML limité : gras, code, etc.) */
function safeQuestionHtml(s){
  if(window.safeHTML) return window.safeHTML(String(s==null?'':s));
  return escapeUserHtml(s);
}
/** Réponse attendue affichée dans le feedback (qcm, calc {v,sub}, tf) */
function fmtAnswerForHtml(q){
  if(!q.opts||q.opts[q.a]===undefined){
    return escapeUserHtml(q.a===true||q.a===false?(q.a?'VRAI':'FAUX'):String(q.a));
  }
  var o=q.opts[q.a];
  if(typeof o==='object'&&o&&o.v!==undefined){
    return safeQuestionHtml(String(o.v))+(o.sub?'<span class="calc-sub">'+escapeUserHtml(o.sub)+'</span>':'');
  }
  return safeQuestionHtml(String(o));
}
// Audio
var audioCtx=null;
function getAC(){if(!audioCtx)audioCtx=new(window.AudioContext||window.webkitAudioContext)();return audioCtx;}
function beep(f,d,t,v){if(!soundOn)return;try{var ac=getAC();var o=ac.createOscillator();var g=ac.createGain();o.connect(g);g.connect(ac.destination);o.type=t||'square';o.frequency.value=f;g.gain.setValueAtTime(v||0.15,ac.currentTime);g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+d);o.start(ac.currentTime);o.stop(ac.currentTime+d);}catch(e){}}
function playOk(){beep(523,.05);setTimeout(function(){beep(659,.05);},60);setTimeout(function(){beep(784,.12);},120);}
function playErr(){beep(200,.08,'sawtooth',.12);setTimeout(function(){beep(150,.12,'sawtooth',.1);},80);}
function playNext(){beep(440,.04,'sine',.07);}
function playBonus(){beep(880,.06);setTimeout(function(){beep(1100,.06);},70);setTimeout(function(){beep(1320,.15);},140);}
function playRankSound(rank){
  if(!soundOn)return;
  if(rank==='S'){// fanfare montante
    [523,659,784,1047,1319].forEach(function(f,i){setTimeout(function(){beep(f,.1,'sine',.2);},i*70);});
    setTimeout(function(){beep(1568,.4,'sine',.25);},400);
  } else if(rank==='A'){
    [523,659,784,1047].forEach(function(f,i){setTimeout(function(){beep(f,.1,'sine',.18);},i*70);});
  } else if(rank==='B'){
    beep(523,.08,'sine',.15);setTimeout(function(){beep(659,.15,'sine',.15);},100);
  } else if(rank==='C'){
    beep(440,.1,'triangle',.12);setTimeout(function(){beep(392,.15,'triangle',.1);},120);
  } else { // D — son triste
    [330,311,294,277].forEach(function(f,i){setTimeout(function(){beep(f,.12,'sawtooth',.1);},i*100);});
  }
}

// ====== STREAK ======
function updateStreak(){
  var d = new Date();
  var today = d.toDateString();
  d.setDate(d.getDate() - 1);
  var yesterday = d.toDateString();

  if(streakD.lastDate === today){
    // already played today, no change
  } else if(streakD.lastDate === yesterday){
    // played yesterday → increment
    streakD.current++;
    if(streakD.current > streakD.best) streakD.best = streakD.current;
  } else if(streakD.lastDate !== today){
    // missed days → reset
    streakD.current = 1;
  }
  streakD.lastDate = today;
  lsSet('tssr5_streak', streakD);
  
  syncStreakUI();
}

function syncStreakUI(){
  var sn = document.getElementById('streak-num'); if(sn) sn.textContent = streakD.current + ' jour' + (streakD.current > 1 ? 's' : '');
  
  var sb = document.getElementById('streak-best');
  if(sb) {
    if(!streakD.best || streakD.best === 0) {
      sb.textContent = "Ton record se construit ici";
      sb.classList.add('no-record');
    } else {
      sb.textContent = 'Best: ' + streakD.best + 'j';
      sb.classList.remove('no-record');
    }
  }
  
  var ps = document.getElementById('prof-streak'); if(ps) ps.textContent = streakD.current || 0;
  var sts = document.getElementById('st-streak'); if(sts) sts.textContent = streakD.current + 'j';
  
  // Flame animation
  var flame = document.getElementById('streak-fire-emoji');
  if(flame) {
    if(streakD.current > 0) {
      flame.classList.add('active');
    } else {
      flame.classList.remove('active');
    }
  }
  
  // Milestone logic
  var sm = document.getElementById('streak-milestone');
  if(sm) {
    var milestones = [3, 7, 15, 30, 50, 100];
    var next = milestones.find(function(m) { return m > streakD.current; }) || (streakD.current + 5);
    if(milestones.indexOf(streakD.current) >= 0) {
      sm.innerHTML = '🏆 Palier atteint (' + streakD.current + 'j) !';
      sm.classList.add('achieved');
    } else {
      sm.innerHTML = '🎯 Prochain palier : ' + next + 'j';
      sm.classList.remove('achieved');
    }
  }
  
  buildStreakCalendar();
}

function buildStreakCalendar(){
  var container = document.getElementById('streak-calendar');
  if(!container) return;
  container.innerHTML = '';
  
  var today = new Date();
  var todayStr = today.toDateString();
  var yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  var yesterdayStr = yesterday.toDateString();
  
  var isStreakActive = (streakD.lastDate === todayStr || streakD.lastDate === yesterdayStr);
  
  var days = [];
  for(var i = 6; i >= 0; i--) {
    var d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d);
  }
  
  days.forEach(function(day) {
    var dayStr = day.toDateString();
    var label = ['D', 'L', 'M', 'M', 'J', 'V', 'S'][day.getDay()];
    var isToday = (dayStr === todayStr);
    
    var played = false;
    if(isStreakActive && streakD.lastDate) {
      var last = new Date(streakD.lastDate);
      var diffTime = last - day;
      if(diffTime >= 0) {
        var diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
        played = (diffDays >= 0 && diffDays < streakD.current);
      }
    }
    
    var dayDiv = document.createElement('div');
    dayDiv.className = 'streak-day' + (played ? ' done' : '') + (isToday ? ' today' : '');
    dayDiv.innerHTML = '<span class="sd-lbl">' + label + '</span>' + 
                       (played ? '<span class="sd-check">✓</span>' : '');
    container.appendChild(dayDiv);
  });
}

function applyBody(){
  var catCls=CATS[selCat]?CATS[selCat].cat:'cat-mix';
  if(!vTheme) vTheme=lsGet('tssr5_vt','vt-light');
  if(!currentUI) currentUI=lsGet('tssr5_ui','ui-neon');
  var uiCls=currentUI||window.uiStyle||lsGet('tssr5_ui','ui-neon')||'ui-neon';
  var body=document.body;
  // Retirer uniquement les classes thème et cat — préserver le reste
  ['vt-dark','vt-light','vt-slate','vt-paper','vt-midnight','vt-warm'].forEach(function(c){body.classList.remove(c);});
  ['cat-reseau','cat-cisco','cat-vlan','cat-stp','cat-routage','cat-secu','cat-windows','cat-dns',
   'cat-ntfs','cat-hyperv','cat-raid','cat-cmd','cat-mix','cat-ad','cat-ps','cat-mbr','cat-wlan',
   'cat-sauvegarde','cat-abe','cat-fsrm','cat-groupes_ad'].forEach(function(c){body.classList.remove(c);});
  body.classList.add(vTheme,catCls);
  if(!body.classList.contains(uiCls)) body.classList.add(uiCls);
  // Override --acc avec la couleur du mode si en jeu
  var modeCol=selMode&&MODE_COLORS[selMode]?MODE_COLORS[selMode]:null;
  if(modeCol&&document.getElementById('screen-game')&&document.getElementById('screen-game').classList.contains('active')){
    document.documentElement.style.setProperty('--acc',modeCol);
    var a2=modeCol+'20'; document.documentElement.style.setProperty('--a2',a2);
  } else {
    document.documentElement.style.removeProperty('--acc');
    document.documentElement.style.removeProperty('--a2');
  }
}

function buildCatGrid(){
  var g=el('cat-grid');if(!g)return;g.innerHTML='';
  Object.keys(CATS).forEach(function(id){
    var c=CATS[id];var hs=hsD[id]||0;var st=stD[id]||{played:0,correct:0};
    var pct=st.played>0?Math.round(st.correct/st.played*100):0;
    var d=document.createElement('div');d.className='ccard'+(id===selCat?' sel':'');
    d.innerHTML='<span class="cqc">'+c.qs.length+'Q</span><span class="cicon">'+c.icon+'</span><span class="cname">'+c.label+'</span><div class="cdesc">'+c.desc+'</div><div class="cstat"><div class="cstat-fill" style="width:'+pct+'%"></div></div><div class="cstat-lbl">'+(st.played>0?pct+'% · Best '+hs+'/10':'Pas encore joué')+'</div>';
    (function(catId,card){card.onclick=function(){document.querySelectorAll('.ccard').forEach(function(x){x.classList.remove('sel');});card.classList.add('sel');selCat=catId;applyBody();};})(id,d);
    g.appendChild(d);
  });
}

function buildBadges(){
  var row=el('badges-row');if(!row)return;row.innerHTML='';
  var unlocked = [];
  BDEFS.forEach(function(b){
    if(bdD.indexOf(b.id)>=0){
      unlocked.push(b);
    }
  });
  
  var html = '';
  // Unlocked section
  if(unlocked.length > 0) {
    html += '<div class="badge-section-title">Tes badges (' + unlocked.length + ')</div>';
    html += '<div class="badge-subgrid">';
    unlocked.forEach(function(b){
      html += '<div class="bdg bdg-unlocked" title="' + b.desc + '"><span>' + b.icon + '</span><span class="bl">' + b.name + '</span></div>';
    });
    html += '</div>';
  } else {
    html += '<div class="badge-section-title">Tes badges (0)</div>';
    html += '<div style="font-size:10px;color:var(--text2);margin-bottom:12px;opacity:0.8;font-style:italic;">Joue pour débloquer tes premiers badges !</div>';
  }
  row.innerHTML = html;
}


// Sérialise une question pour Firestore (gère qcm, tf, debug)
function buildOnlineQData(q, idx2) {
  var opts = [];
  if (q.t === 'tf') {
    opts = ['VRAI', 'FAUX'];
  } else if (q.opts) {
    // Convertir les opts objets {v,sub} en strings simples
    opts = q.opts.map(function(o){
      return (o && typeof o === 'object') ? (o.v || String(o)) : String(o);
    });
  }
  // Inclure le setup si présent (questions calc)
  var qText = q.q;
  if (q.setup) qText = q.q + '\n\n' + q.setup;
  return {
    idx: idx2,
    q: qText,
    opts: opts,
    a: q.t === 'tf' ? (q.a === true ? 0 : 1) : (typeof q.a === 'number' ? q.a : 0),
    x: q.x || '',
    t: q.t || 'qcm',
    shuffleSeed: Math.floor(Math.random() * 999999)
  };
}

// Menu principal

// ============================================================
// PANNEAU ADMIN (Firestore : collection admins/{uid})
// ============================================================
async function openAdminPanel(){
  if (!window._fbUser) {
    alert('Tu dois être connecté.');
    return;
  }
  var isAdmin = typeof window.fbCheckAdmin === 'function' ? await window.fbCheckAdmin() : false;
  if (!isAdmin) {
    alert("Accès refusé : tu n'es pas administrateur dans Firestore (collection 'admins').");
    return;
  }
  showAdminPanel();
}

function showAdminPanel(){
  var existing=document.getElementById('admin-panel-ovl');
  if(existing){existing.style.display='flex';loadAdminData();return;}
  var ovl=document.createElement('div');
  ovl.id='admin-panel-ovl';
  ovl.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';

  var box=document.createElement('div');
  box.style.cssText='background:var(--bg2);border:1.5px solid var(--border2);border-radius:12px;width:100%;max-width:600px;max-height:85vh;display:flex;flex-direction:column;overflow:hidden;';

  var header=document.createElement('div');
  header.style.cssText='display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--border);';
  header.innerHTML='<span style="font-family:monospace;font-size:11px;color:#f87171;letter-spacing:2px;">🔑 PANNEAU ADMIN</span>';
  var closeBtn=document.createElement('button');
  closeBtn.textContent='✕';
  closeBtn.style.cssText='background:none;border:none;color:var(--text2);font-size:18px;cursor:pointer;';
  closeBtn.onclick=function(){ ovl.style.display='none'; };
  header.appendChild(closeBtn);

  var body2=document.createElement('div');
  body2.id='admin-panel-body';
  body2.style.cssText='padding:16px 20px;overflow-y:auto;flex:1;';
  body2.innerHTML='\u003cdiv style="font-family:monospace;font-size:8px;color:var(--dim);letter-spacing:2px;margin-bottom:10px;"\u003eUTILISATEURS\u003c/div\u003e'+
'      \u003cdiv id="admin-users-list"\u003eChargement...\u003c/div\u003e'+
'      \u003cdiv style="font-family:monospace;font-size:8px;color:var(--dim);letter-spacing:2px;margin:16px 0 10px;"\u003ePROMOS\u003c/div\u003e'+
'      \u003cdiv id="admin-promos-list"\u003eChargement...\u003c/div\u003e'+
'      \u003cdiv style="font-family:monospace;font-size:8px;color:var(--dim);letter-spacing:2px;margin:16px 0 10px;"\u003eBASE DE DONNÉES\u003c/div\u003e'+
'      \u003cbutton id="admin-sync-qs-btn" style="background:var(--acc);color:var(--bg);border:none;border-radius:6px;padding:10px 16px;font-family:monospace;font-size:9px;cursor:pointer;width:100%;letter-spacing:1px;margin-bottom:8px;"\u003e📤 SYNCHRONISER LES QUESTIONS VERS FIRESTORE\u003c/button\u003e'+
'      \u003cbutton id="admin-export-reports-btn" style="background:var(--panel);color:var(--text);border:1.5px solid var(--border2);border-radius:6px;padding:10px 16px;font-family:monospace;font-size:9px;cursor:pointer;width:100%;letter-spacing:1px;margin-bottom:5px;"\u003e📥 EXPORTER VOTES & RAPPORTS DE BUG (JSON)\u003c/button\u003e'+
'      \u003cdiv id="admin-sync-qs-status" style="font-family:monospace;font-size:9px;color:var(--text2);margin-top:6px;display:none;"\u003e\u003c/div\u003e';


  var syncBtn = body2.querySelector('#admin-sync-qs-btn');
  if (syncBtn) {
    syncBtn.onclick = async function() {
      if (!confirm('Voulez-vous vraiment synchroniser toutes les questions en mémoire vers la collection "questions" de Firestore ?\n(Les documents existants seront écrasés)')) return;
      var statusEl = body2.querySelector('#admin-sync-qs-status');
      statusEl.style.display = 'block';
      statusEl.style.color = 'var(--text2)';
      statusEl.textContent = '⏳ Préparation de la synchronisation...';
      syncBtn.disabled = true;
      try {
        var db      = window._fbDb;
        var docFn   = window._fbDoc;
        var batchFn = window._fbWriteBatch;
        if (!db || !docFn || !batchFn) throw new Error('Firebase non initialisé.');

        // Collecter toutes les questions depuis CATS en mémoire
        var allQs = [];
        Object.keys(window.CATS).forEach(function(k) {
          if (k === 'mix') return;
          var cat = window.CATS[k];
          (cat.qs || []).forEach(function(q) {
            var copy = Object.assign({}, q);
            delete copy._cat;
            allQs.push(copy);
          });
        });

        if (!allQs.length) { throw new Error('Aucune question en mémoire.'); }

        // Envoi par lots de 400
        var BATCH_SIZE = 400;
        var totalBatches = Math.ceil(allQs.length / BATCH_SIZE);
        for (var b = 0; b < totalBatches; b++) {
          var chunk = allQs.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);
          var batch = batchFn(db);
          chunk.forEach(function(q, i) {
            var globalIdx = b * BATCH_SIZE + i;
            batch.set(docFn(db, 'questions', 'q_' + globalIdx), q);
          });
          statusEl.textContent = '⏳ Envoi lot ' + (b + 1) + '/' + totalBatches
            + ' (' + Math.min((b + 1) * BATCH_SIZE, allQs.length) + '/' + allQs.length + ' questions)...';
          await batch.commit();
        }

        statusEl.textContent = '✅ ' + allQs.length + ' questions synchronisées en ' + totalBatches + ' lot(s) !';
        statusEl.style.color = '#4ade80';
      } catch(err) {
        statusEl.textContent = '❌ Erreur : ' + err.message;
        statusEl.style.color = '#f87171';
        console.error('Sync failed:', err);
      } finally {
        syncBtn.disabled = false;
      }
    };
  }




  var exportReportsBtn = body2.querySelector('#admin-export-reports-btn');
  if (exportReportsBtn) {
    exportReportsBtn.onclick = async function() {
      var statusEl = body2.querySelector('#admin-sync-qs-status');
      statusEl.style.display = 'block';
      statusEl.style.color = 'var(--text2)';
      statusEl.textContent = '⏳ Récupération des rapports et des notes...';
      exportReportsBtn.disabled = true;
      try {
        var db = window._fbDb;
        if (!db) throw new Error('Firebase non initialisé.');

        // Récupérer les rapports de bug
        var reportsSnap = await window._fbGetDocs(window._fbCollection(db, 'reports'));
        var bugReports = [];
        reportsSnap.forEach(function(doc) {
          bugReports.push(Object.assign({ id: doc.id }, doc.data()));
        });

        // Récupérer les notes de questions
        var statsSnap = await window._fbGetDocs(window._fbCollection(db, 'question_stats'));
        var questionRatings = [];
        statsSnap.forEach(function(doc) {
          questionRatings.push(Object.assign({ id: doc.id }, doc.data()));
        });

        var exportData = {
          exportedAt: new Date().toISOString(),
          bugReports: bugReports,
          questionRatings: questionRatings
        };

        var json = JSON.stringify(exportData, null, 2);
        var blob = new Blob([json], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'quizztssr_votes_reports_' + new Date().toISOString().slice(0,10) + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        statusEl.textContent = '✅ Export terminé : ' + bugReports.length + ' rapport(s) et ' + questionRatings.length + ' note(s).';
        statusEl.style.color = '#4ade80';
      } catch(err) {
        statusEl.textContent = '❌ Erreur d\'export: ' + err.message;
        statusEl.style.color = '#f87171';
        console.error('Export failed:', err);
      } finally {
        exportReportsBtn.disabled = false;
      }
    };
  }

  box.appendChild(header);
  box.appendChild(body2);
  ovl.appendChild(box);
  document.body.appendChild(ovl);
  if (typeof window.injectImportUI === 'function') { window.injectImportUI(); }
  loadAdminData();
}

async function loadAdminData(){
  if(!window._fbGetDocs)return;
  var ul=document.getElementById('admin-users-list');
  var pl=document.getElementById('admin-promos-list');

  // Utilisateurs
  try{
    var us=await window._fbGetDocs(window._fbQuery(window._fbCollection(window._fbDb,'leaderboard'),window._fbLimit(100)));
    var users=[];
    us.forEach(function(d){users.push(Object.assign({uid:d.id},d.data()));});
    if(ul){
      ul.innerHTML='';
      users.forEach(function(u){
        var row=document.createElement('div');
        row.style.cssText='display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:var(--panel);border-radius:6px;margin-bottom:5px;';
        var info=document.createElement('div');
        info.innerHTML='<span style="font-family:monospace;font-size:10px;">'+escapeUserHtml(u.pseudo||'Anonyme')+'</span>'+
          '<span style="font-family:monospace;font-size:8px;color:var(--text2);margin-left:8px;">'+escapeUserHtml(u.email||'')+'</span>';
        var btn=document.createElement('button');
        btn.textContent='SUPPRIMER';
        btn.style.cssText='background:none;border:1px solid #f87171;border-radius:4px;color:#f87171;font-family:monospace;font-size:7px;padding:3px 8px;cursor:pointer;';
        (function(uid,pseudo){ btn.onclick=function(){ adminDelUser(uid,pseudo); }; })(u.uid, u.pseudo||'cet user');
        row.appendChild(info);
        row.appendChild(btn);
        ul.appendChild(row);
      });
      if(!users.length) ul.textContent='Aucun utilisateur';
    }
  }catch(e){ if(ul) ul.textContent='Erreur: '+e.message; }

  // Promos
  try{
    var ps=await window._fbGetDocs(window._fbQuery(window._fbCollection(window._fbDb,'promos'),window._fbLimit(50)));
    var promos=[];
    ps.forEach(function(d){promos.push(Object.assign({code:d.id},d.data()));});
    if(pl){
      pl.innerHTML='';
      promos.forEach(function(p){
        var row=document.createElement('div');
        row.style.cssText='display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:var(--panel);border-radius:6px;margin-bottom:5px;';
        var info=document.createElement('div');
        info.innerHTML='<span style="font-family:monospace;font-size:10px;">'+escapeUserHtml(p.name||p.code)+'</span>'+
          '<span style="font-family:monospace;font-size:8px;color:var(--acc);margin-left:8px;letter-spacing:2px;">'+escapeUserHtml(p.code)+'</span>'+
          '<span style="font-family:monospace;font-size:8px;color:var(--text2);margin-left:6px;">'+(p.members?p.members.length:0)+' membres</span>';
        var btn=document.createElement('button');
        btn.textContent='SUPPRIMER';
        btn.style.cssText='background:none;border:1px solid #f87171;border-radius:4px;color:#f87171;font-family:monospace;font-size:7px;padding:3px 8px;cursor:pointer;';
        (function(code,name){ btn.onclick=function(){ adminDelPromo(code,name); }; })(p.code, p.name||p.code);
        row.appendChild(info);
        row.appendChild(btn);
        pl.appendChild(row);
      });
      if(!promos.length) pl.textContent='Aucune promo';
    }
  }catch(e){ if(pl) pl.textContent='Erreur: '+e.message; }
}

async function adminDelUser(uid,pseudo){
  if(!confirm('Supprimer du leaderboard : '+String(pseudo||'?')+' ?'))return;
  try{await window._fbDeleteDoc(window._fbDoc(window._fbDb,'leaderboard',uid));alert('Supprimé.');loadAdminData();}
  catch(e){alert('Erreur: '+e.message);}
}
async function adminDelPromo(code,name){
  if(!confirm('Supprimer la promo "'+String(name||'?')+'" ?'))return;
  try{await window._fbDeleteDoc(window._fbDoc(window._fbDb,'promos',code));alert('Promo supprimée.');loadAdminData();}
  catch(e){alert('Erreur: '+e.message);}
}


// ── Toggle Dark / Light ──
function toggleDarkLight(){
  vTheme = (vTheme === 'vt-dark') ? 'vt-light' : 'vt-dark';
  // Sauvegarder UNIQUEMENT en localStorage — indépendant de Firebase
  try{ localStorage.setItem('tssr5_vt', vTheme); }catch(e){}
  applyBody();
  _updateThemeBtns();
  // PAS de fbSaveUserData ici — le thème est local only
}

function _updateThemeBtns(){
  var isDark = (vTheme === 'vt-dark' || !vTheme);
  var icon  = isDark ? '🌙' : '☀️';
  var label = isDark ? 'MODE SOMBRE' : 'MODE CLAIR';
  ['theme-toggle-btn','settings-theme-toggle'].forEach(function(id){
    var btn=document.getElementById(id); if(btn) btn.querySelector ? null : null;
  });
  var t1=document.getElementById('theme-toggle-btn');
  if(t1) t1.textContent = icon;
  var t2=document.getElementById('settings-theme-icon');
  if(t2) t2.textContent = icon;
  var t3=document.getElementById('settings-theme-label');
  if(t3) t3.textContent = label;
  // Switch logo selon le thème
  var logoImg = document.getElementById('menu-logo-img');
  if(logoImg) logoImg.src = isDark ? 'LOGO_TSSRQUIZZ_DARK.png' : 'LOGO_TSSRQUIZZ.png';
}

function openMainMenu(){
  var o=document.getElementById('main-menu-ovl');
  var p=document.getElementById('main-menu-panel');
  if(o) o.classList.add('open');
  if(p) p.classList.add('open');
}
function closeMainMenu(){
  var o=document.getElementById('main-menu-ovl');
  var p=document.getElementById('main-menu-panel');
  if(o) o.classList.remove('open');
  if(p) p.classList.remove('open');
}

function updateMenuTopbar(){
  var user=window._fbUser;
  var avatarEl=document.getElementById('menu-avatar-top');
  var nameEl=document.getElementById('menu-username-top');
  var mmLogin=document.getElementById('mm-login-btn');
  var mmLogout=document.getElementById('mm-logout-btn');
  var mmUser=document.getElementById('mm-user-info');
  var profile={}; try{profile=JSON.parse(localStorage.getItem('tssr5_profile')||'{}');}catch(e){}
  if(user){
    if(avatarEl) avatarEl.textContent=profile.avatar||'👤';
    if(nameEl) nameEl.textContent=profile.pseudo||user.displayName||user.email.split('@')[0]||'';
    if(mmLogin) mmLogin.style.display='none';
    if(mmLogout) mmLogout.style.display='block';
    if(mmUser) mmUser.textContent=user.email||'';
  } else {
    if(avatarEl) avatarEl.textContent=profile.avatar||'👤';
    if(nameEl) nameEl.textContent=profile.pseudo||'';
    if(mmLogin) mmLogin.style.display='block';
    if(mmLogout) mmLogout.style.display='none';
    if(mmUser) mmUser.textContent='';
  }
}

// Promo
function openCreatePromo(){ showScreen('promo'); setTimeout(function(){ var b=document.getElementById('promo-tab-create'); if(b) promoSwitchTab('create'); },100); }
function openJoinPromo(){ showScreen('promo'); setTimeout(function(){ promoSwitchTab('join'); },100); }
function promoSwitchTab(tab){
  var isCreate = tab==='create';
  var tc=document.getElementById('promo-tab-create'),tj=document.getElementById('promo-tab-join');
  var pc=document.getElementById('promo-panel-create'),pj=document.getElementById('promo-panel-join');
  if(tc){tc.style.background=isCreate?'var(--acc)':'transparent';tc.style.color=isCreate?'var(--bg)':'var(--text2)';}
  if(tj){tj.style.background=isCreate?'transparent':'var(--acc)';tj.style.color=isCreate?'var(--text2)':'var(--bg)';}
  if(pc) pc.style.display=isCreate?'block':'none';
  if(pj) pj.style.display=isCreate?'none':'block';
  if(!isCreate) loadPromoList();
}
function promoCreate(){
  if(!window._fbUser){alert('Tu dois être connecté pour créer une promo.');return;}
  var name=(document.getElementById('promo-create-name').value||'').trim();
  if(!name){alert('Donne un nom à ta promo.');return;}
  var code='';var chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for(var i=0;i<6;i++) code+=chars[Math.floor(Math.random()*chars.length)];
  var db=window._fbDb,doc2=window._fbDoc,setDoc2=window._fbSetDoc;
  if(!db){alert('Firebase non connecté.');return;}
  setDoc2(doc2(db,'promos',code),{
    name:name,
    school:(document.getElementById('promo-create-school').value||'').trim(),
    ownerUid:window._fbUser.uid,
    ownerEmail:window._fbUser.email,
    members:[window._fbUser.uid],
    createdAt:window._fbServerTs?window._fbServerTs():new Date().toISOString(),
    code:code
  }).then(function(){
    var r=document.getElementById('promo-create-result');
    var c=document.getElementById('promo-code-display');
    if(c) c.textContent=code;
    if(r) r.style.display='block';
    var profile={}; try{profile=JSON.parse(localStorage.getItem('tssr5_profile')||'{}');}catch(e){}
    profile.promo=name; profile.promoCode=code;
    localStorage.setItem('tssr5_profile',JSON.stringify(profile));
    if(window.fbSaveUserData) window.fbSaveUserData();
  }).catch(function(e){ alert('Erreur: '+e.message); });
}
function promoCodeCopy(){
  var code=document.getElementById('promo-code-display').textContent;
  navigator.clipboard.writeText(code).then(function(){
    var el2=document.getElementById('promo-copied'); if(el2){el2.style.opacity='1';setTimeout(function(){el2.style.opacity='0';},1500);}
  });
}

function selectAndJoinPromo(el){
  var code = el.getAttribute('data-code')||'';
  var inp = document.getElementById('promo-join-code');
  if(inp){ inp.value = code; }
  promoJoin();
}

function promoJoin(){
  if(!window._fbUser){alert('Tu dois être connecté pour rejoindre une promo.');return;}
  var code=(document.getElementById('promo-join-code').value||'').trim().toUpperCase();
  if(code.length!==6){alert('Code invalide (6 caractères).');return;}
  var db=window._fbDb,docFn=window._fbDoc,getDocFn=window._fbGetDoc,updateDocFn=window._fbUpdateDoc;
  getDocFn(docFn(db,'promos',code)).then(function(snap){
    if(!snap.exists()){
      var r=document.getElementById('promo-join-result');
      if(r){r.textContent='❌ Promo introuvable.';r.style.display='block';r.style.color='#f87171';}
      return;
    }
    var data=snap.data();
    var members=data.members||[];
    if(members.indexOf(window._fbUser.uid)<0) members.push(window._fbUser.uid);
    updateDocFn(docFn(db,'promos',code),{members:members}).then(function(){
      var profile={}; try{profile=JSON.parse(localStorage.getItem('tssr5_profile')||'{}');}catch(e){}
      profile.promo=data.name; profile.promoCode=code;
      localStorage.setItem('tssr5_profile',JSON.stringify(profile));
      if(window.fbSaveUserData) window.fbSaveUserData();
      var r=document.getElementById('promo-join-result');
      if(r){r.textContent='✅ Tu as rejoint "'+data.name+'" !';r.style.display='block';r.style.color='#4ade80';}
    });
  }).catch(function(e){
    var r=document.getElementById('promo-join-result');
    if(r){r.textContent='❌ Erreur: '+e.message;r.style.display='block';r.style.color='#f87171';}
  });
}
async function loadPromoList(){
  var list=document.getElementById('promo-list'); if(!list) return;
  if(!window._fbGetDocs){
    list.innerHTML='<div style="font-family:monospace;font-size:9px;color:var(--text2);padding:10px;">Connecte-toi pour voir les promos</div>';
    return;
  }
  list.innerHTML='<div style="font-family:monospace;font-size:9px;color:var(--text2);padding:10px;">⏳ Chargement...</div>';
  try{
    var snap=await window._fbGetDocs(window._fbQuery(window._fbCollection(window._fbDb,'promos'),window._fbLimit(20)));
    var promos=[];
    snap.forEach(function(d){ promos.push(Object.assign({id:d.id},d.data())); });
    if(!promos.length){
      list.innerHTML='<div style="font-family:monospace;font-size:9px;color:var(--text2);padding:10px;text-align:center;">Aucune promo disponible. Crée la première !</div>';
      return;
    }
    var myUid=window._fbUser?window._fbUser.uid:null;
    var myProfile={}; try{myProfile=JSON.parse(localStorage.getItem('tssr5_profile')||'{}');}catch(e){}
    list.innerHTML=promos.map(function(p){
      var members=p.members||[];
      var isIn=myUid&&members.indexOf(myUid)>=0;
      var isOwner=myUid&&p.ownerUid===myUid;
      var codeEsc=escapeUserHtml(p.code||'');
      return '<div style="background:var(--panel);border:1.5px solid '+(isIn?'var(--acc)':'var(--border2)')+';border-radius:10px;padding:14px 16px;margin-bottom:8px;">'+
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">'+
          '<div>'+
            '<div style="font-family:monospace;font-size:11px;color:var(--text);">'+escapeUserHtml(p.name||'')+'</div>'+
            (p.school?'<div style="font-family:monospace;font-size:8px;color:var(--text2);">'+escapeUserHtml(p.school)+'</div>':'')+
          '</div>'+
          '<div style="display:flex;align-items:center;gap:8px;">'+
            '<div style="font-family:monospace;font-size:13px;color:var(--acc);letter-spacing:3px;">'+codeEsc+'</div>'+
            (isIn?
              '<span style="font-family:monospace;font-size:8px;color:var(--acc);border:1px solid var(--acc);border-radius:4px;padding:3px 7px;">'+(isOwner?'ADMIN':'MEMBRE')+'</span>':
              '<button onclick="selectAndJoinPromo(this)" data-code="'+codeEsc+'" style="background:var(--acc);border:none;border-radius:6px;padding:6px 12px;font-family:monospace;font-size:8px;color:var(--bg);cursor:pointer;letter-spacing:1px;">REJOINDRE</button>'
            )+
          '</div>'+
        '</div>'+
        '<div style="font-family:monospace;font-size:8px;color:var(--text2);">👥 '+members.length+' membre'+(members.length>1?'s':'')+
        (p.ownerEmail?' · Admin: '+escapeUserHtml(p.ownerEmail):'')+
        '</div>'+
      '</div>';
    }).join('');
  }catch(e){list.innerHTML='<div style="font-family:monospace;font-size:9px;color:#f87171;padding:10px;">Erreur: '+escapeUserHtml(e.message)+'</div>';}
}


// ============================================================
// LAUNCHER V2 — fonctions
// ============================================================
var wizSelCats = ['mix'];
var wizTimer   = 0;
var wizLives   = 5;

function wizShowStep(name){
  ['1','quiz','duel'].forEach(function(s){
    var el2 = document.getElementById('wiz-step-'+s);
    if(el2) el2.style.display = (s === String(name)) ? 'block' : 'none';
  });
}

function wizPickMode(mode){
  if(mode === 'srs'){ closeLaunchSheet(); showSRSScreen(); return; }
  if(mode === 'rpg'){ closeLaunchSheet(); launchRPGDirect(); return; }
  if(mode === 'duel'){ wizShowStep('duel'); return; }
  wizSelCats = ['mix'];
  wizShowStep('quiz');
  buildSheetCats();
  var jt = document.getElementById('jtoggle'); if(jt) jt.classList.toggle('on', jokersEnabled);
  var st = document.getElementById('stoggle'); if(st) st.classList.toggle('on', soundOn);
}

function wizPickTimer(btn){
  document.querySelectorAll('[data-timer]').forEach(function(b){ b.classList.remove('sel'); });
  btn.classList.add('sel');
  wizTimer = parseInt(btn.getAttribute('data-timer'));
}

function wizPickLives(btn){
  document.querySelectorAll('[data-lives]').forEach(function(b){ b.classList.remove('sel'); });
  btn.classList.add('sel');
  wizLives = parseInt(btn.getAttribute('data-lives'));
}

function wizLaunchQuiz(){
  var ovl = document.getElementById('launch-ovl');
  if(ovl) ovl.classList.remove('open');
  if(!wizSelCats || !wizSelCats.length) wizSelCats = ['mix'];
  var pool = [];

  // Construire le pool selon la sélection
  if(wizSelCats.length === 1 && wizSelCats[0] === 'mix'){
    // Mix global : toutes catégories
    selCat = 'mix';
    Object.keys(CATS).forEach(function(k){
      if(k !== 'mix') CATS[k].qs.forEach(function(q){ pool.push(Object.assign({},q,{_cat:CATS[k].label})); });
    });
  } else if(wizSelCats.length > 1){
    // Multi-catégories (groupe entier ou sélection manuelle)
    selCat = wizSelCats[0];
    wizSelCats.forEach(function(k){
      var c = CATS[k];
      if(c && c.qs) c.qs.forEach(function(q){ pool.push(Object.assign({},q,{_cat:c.label})); });
    });
  } else {
    // Catégorie unique
    selCat = wizSelCats[0];
    pool = (CATS[selCat] ? CATS[selCat].qs : []).map(function(q){ return Object.assign({},q); });
  }

  // Filtrer par difficulté
  if(selDiff && selDiff !== 'all'){
    var d = parseInt(selDiff);
    pool = pool.filter(function(q){ return !q.d || q.d === d; });
  }
  if(!pool.length){ alert('Aucune question disponible.'); return; }
  var count = selQCount === 9999 ? pool.length : Math.min(selQCount, pool.length);
  session = freshShuffle(pool).slice(0, count);
  markShown(session);
  correct=0; combo=1; maxCombo=1; errors=[]; idx=0; paused=false;
  bonusStreak=0; isBonus=false; qTimes=[]; rpgPoints=0; betOn=false;
  lives = wizLives;
  jokers = 3;
  selMode = 'chill';
  window._customTimer = wizTimer;
  sStats = {cat:selCat, mode:'quiz', maxCombo:0, mechs:new Set(), streak:streakD.current};
  updateStreak();
  applyBody();

  // Badge : affiche le groupe si groupe entier, la catégorie si une seule, sinon MIX
  var badgeLabel;
  if(wizSelCats.length === 1 && wizSelCats[0] !== 'mix'){
    badgeLabel = CATS[selCat] ? CATS[selCat].label : selCat;
  } else if(wizSelGroup && window.GROUPS && window.GROUPS[wizSelGroup]){
    badgeLabel = window.GROUPS[wizSelGroup].label;
  } else {
    badgeLabel = 'MIX';
  }
  el('gbadge').textContent = '🎯 QUIZ · ' + badgeLabel.toUpperCase();

  var sh = el('score-hud'); if(sh) sh.style.display = 'grid';
  el('htotal').textContent = session.length;
  el('jokers-row').style.display = 'flex';
  el('jcount').textContent = jokers;
  buildDots();
  showScreen('game');
  dynDiffStreak=0; dynDiffLevel=0;
  showQ();
}


// ============================================================
// LAUNCH SHEET — open/close
// ============================================================
function openLaunchSheet(){
  var ovl=document.getElementById('launch-ovl');
  if(!ovl) return;
  ovl.classList.add('open');
  wizShowStep('1');
  buildSheetModes();
}
function closeLaunchSheet(e){
  if(e&&e.target!==e.currentTarget) return;
  var ovl=document.getElementById('launch-ovl');
  if(ovl) ovl.classList.remove('open');
}

async function initMenu(){
  if (window.fbQuestionsPromise) {
    await window.fbQuestionsPromise;
  }
  if (window._fbUser && typeof cleanUserOldDuels === 'function') {
    cleanUserOldDuels(window._fbUser.uid);
  }
  vTheme=lsGet('tssr5_vt','vt-light');
  soundOn=lsGet('tssr5_sound',true);
  jokersEnabled=lsGet('tssr5_jokers',true);
  selQCount=lsGet('tssr5_qcount',10);
  currentUI=lsGet('tssr5_ui','ui-neon');

  // Streak
  syncStreakUI();

  // Sync sound toggles
  var stm=document.getElementById('stoggle-menu'); if(stm) stm.classList.toggle('on',soundOn);
  var st=el('stoggle'); if(st) st.classList.toggle('on',soundOn);

  // Build UI
  buildBadges();
  applyBody();
  applyUI();
  _updateThemeBtns(); // applique le thème UI (arcade/paper/terminal/minimal)
  buildDailyWidget();
  buildQuickStats();
  buildLiveLobbiesWidget();
  if(typeof updateMenuTopbar==='function') updateMenuTopbar();

  // Auto-open daily challenge pop-up if not done yet today and not shown in this session
  if (!dailyPopupShownThisSession) {
    var today = new Date().toDateString();
    var q = getDailyQuestion();
    if (q && !dailyData[today]) {
      dailyPopupShownThisSession = true;
      setTimeout(function() {
        openDailyScreen();
      }, 300);
    }
  }
}

function buildLiveLobbiesWidget(){
  var w = document.getElementById('live-lobbies-widget');
  if(!w) return;
  if(!window._fbDb || !window._fbGetDocs || !window._fbCollection || !window._fbQuery || !window._fbWhere){
    w.innerHTML = ''; return;
  }
  // One-shot fetch (pas de listener temps-réel pour ne pas confliceter avec unsubLobby)
  var q = window._fbQuery(
    window._fbCollection(window._fbDb, 'duels'),
    window._fbWhere('status', '==', 'waiting')
  );
  window._fbGetDocs(q).then(function(snap){
    var sessions = [];
    var now = Date.now();
    snap.forEach(function(doc){
      var d = doc.data();
      if(d.isPublic === false) return;
      var createdMs = 0;
      if(d.createdAt){
        if(typeof d.createdAt.toDate === 'function') createdMs = d.createdAt.toDate().getTime();
        else if(d.createdAt.seconds !== undefined) createdMs = d.createdAt.seconds * 1000;
        else { var parsed = Date.parse(d.createdAt); if(!isNaN(parsed)) createdMs = parsed; }
      }
      if(createdMs > 0 && (now - createdMs) > 15 * 60 * 1000) return;
      sessions.push(d);
    });

    if(sessions.length === 0){ w.innerHTML = ''; return; }

    var rows = sessions.map(function(d){
      var pCount = d.players ? Object.keys(d.players).length : 1;
      var hostName = (d.players && d.players[d.host]) ? escapeUserHtml(d.players[d.host].pseudo) : 'Joueur';
      var isFull = pCount >= 5;
      var dot = isFull
        ? '<span style="width:7px;height:7px;border-radius:50%;background:#ef4444;display:inline-block;flex-shrink:0;"></span>'
        : '<span style="width:7px;height:7px;border-radius:50%;background:#22c55e;display:inline-block;flex-shrink:0;animation:pulse-dot 1.4s infinite;"></span>';
      var btn = isFull
        ? '<span style="font-size:9px;font-family:monospace;color:var(--text2);letter-spacing:1px;">PLEIN</span>'
        : '<button onclick="joinOnlineSession(\''+d.code+'\');showScreen(\'online-duel\')" '
          + 'style="background:var(--primary);color:#000;border:none;border-radius:20px;padding:4px 12px;font-size:9px;font-weight:bold;cursor:pointer;font-family:monospace;letter-spacing:1px;white-space:nowrap;">REJOINDRE</button>';
      return '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 12px;border-radius:8px;background:var(--bg3);border:1px solid var(--border2);">'
        + '<div style="display:flex;align-items:center;gap:8px;min-width:0;">'
          + dot
          + '<span style="font-weight:bold;color:var(--text);font-size:0.85rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:120px;">' + hostName + '</span>'
          + '<span style="font-size:9px;color:var(--text2);font-family:monospace;">'+pCount+'/5</span>'
        + '</div>'
        + btn
        + '</div>';
    }).join('');

    w.innerHTML = '<div style="background:var(--bg2);border:1.5px solid var(--border2);border-radius:12px;padding:12px 14px;">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">'
        + '<div style="display:flex;align-items:center;gap:7px;">'
          + '<span style="font-size:1rem;">⚔️</span>'
          + '<span style="font-family:monospace;font-size:9px;letter-spacing:2px;color:var(--acc);font-weight:bold;">SALONS OUVERTS</span>'
        + '</div>'
        + '<span style="background:var(--a2,rgba(99,102,241,.15));color:var(--acc);border-radius:20px;padding:2px 9px;font-size:9px;font-family:monospace;font-weight:bold;">' + sessions.length + '</span>'
      + '</div>'
      + '<div style="display:flex;flex-direction:column;gap:6px;">'+rows+'</div>'
      + '</div>'
      + '<style>@keyframes pulse-dot{0%,100%{opacity:1}50%{opacity:.3}}</style>';
  }).catch(function(){ w.innerHTML = ''; });
}

function pickVT(e){document.querySelectorAll('.vtbtn').forEach(function(x){x.classList.remove('sel');});e.classList.add('sel');vTheme=e.getAttribute('data-vt');lsSet('tssr5_vt',vTheme);applyBody();}

function pickDiff(e){document.querySelectorAll('.diffbtn').forEach(function(x){x.classList.remove('sel');});e.classList.add('sel');selDiff=e.getAttribute('data-diff');}
function pickMode(e){document.querySelectorAll('.mcard').forEach(function(x){x.classList.remove('sel');});e.classList.add('sel');selMode=e.getAttribute('data-mode');}

function toggleJokers(){jokersEnabled=!jokersEnabled;el('jtoggle').classList.toggle('on',jokersEnabled);lsSet('tssr5_jokers',jokersEnabled);}
function pickQCount(e){selQCount=parseInt(e.getAttribute('data-n'));lsSet('tssr5_qcount',selQCount);document.querySelectorAll('.qcbtn').forEach(function(b){b.classList.remove('sel');});e.classList.add('sel');}
function showScreen(n){
  document.querySelectorAll('.screen').forEach(function(s){
    s.classList.remove('active');
    s.style.display='none';
  });
  var target=document.getElementById('screen-'+n);
  if(!target){ console.warn('showScreen: screen-'+n+' introuvable'); return; }
  target.classList.add('active');
  target.style.display = (n==='menu') ? '' : 'flex';
  try{window.scrollTo(0,0);}catch(e){}
  // Lobby: start listening when entering online-duel screen, stop when leaving
  if(n === 'online-duel') {
    if(typeof loadOpenSessions === 'function') loadOpenSessions();
  } else {
    if(typeof unsubLobby !== 'undefined' && unsubLobby) { unsubLobby(); unsubLobby = null; }
  }
}

function copyOnlineCode(){
  var code = document.getElementById('online-code-num');
  if(!code) return;
  navigator.clipboard && navigator.clipboard.writeText(code.textContent).then(function(){
    var c = document.getElementById('online-copied');
    if(c){c.classList.add('show');setTimeout(function(){c.classList.remove('show');},2000);}
  });
}
function goMenu(){
  clearInterval(timerInt);paused=false;el('povl').classList.remove('show');
  var sh=el('score-hud'); if(sh) sh.style.display='grid';
  var jr=el('jokers-row'); if(jr) jr.style.display='none';
  betOn=false;stopChaosMode&&stopChaosMode();dismissEvent&&dismissEvent();
  document.documentElement.style.removeProperty('--acc');
  document.documentElement.style.removeProperty('--a2');
  // Hide RPG overlay if open
  var rpgOvl=document.getElementById('rpg-overlay');if(rpgOvl)rpgOvl.classList.remove('show');
  initMenu();showScreen('menu');
}
function shuffle(a){
  var b=a.slice();
  // Use crypto.getRandomValues for better randomness
  var arr=new Uint32Array(b.length);
  (window.crypto||window.msCrypto).getRandomValues(arr);
  for(var i=b.length-1;i>0;i--){
    var j=arr[i]%(i+1);
    var t=b[i];b[i]=b[j];b[j]=t;
  }
  return b;
}
// Track shown questions to avoid repetition within a session
var _shownQids={};
// Variables globales nouvelles features
var matchMatched=[],lofiOn=false,lofiNodes=[],srElapsed=0;
function freshShuffle(pool){
  // Prefer questions not seen recently
  var unseen=pool.filter(function(q){return !_shownQids[q.q];});
  var seen=pool.filter(function(q){return !!_shownQids[q.q];});
  // shuffle each group separately
  var mixed=shuffle(unseen).concat(shuffle(seen));
  return mixed;
}
function markShown(session){
  session.forEach(function(q){_shownQids[q.q]=1;});
  // cap at 500 entries
  var keys=Object.keys(_shownQids);
  if(keys.length>500){var del=keys.slice(0,keys.length-500);del.forEach(function(k){delete _shownQids[k];});}
}






// ============================================================
// TIMER ADAPTATIF
// ============================================================


// ============================================================
// RÉGLAGES
// ============================================================






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
  if(mp) mp.textContent=data.pseudo||(window._fbUser?(window._fbUser.displayName||(window._fbUser.email?window._fbUser.email.split('@')[0]:'Joueur')):'Invité');
  if(mt){mt.textContent=title.label;mt.className=title.cls;}
}

function openProfileScreen(){
  loadProfileScreen();
  var scr=document.getElementById('screen-profile');
  if(scr){scr.classList.add('active');scr.style.display='flex';}
}
function closeProfileScreen(){
  var scr=document.getElementById('screen-profile');
  if(scr){scr.classList.remove('active');scr.style.display='none';}
}
window.openProfileScreen=openProfileScreen;
window.closeProfileScreen=closeProfileScreen;

function loadProfileScreen(){
  var data=loadProfileData();
  var mastered=getMasteredCount();
  var title=getProfileTitle(mastered);
  var av=document.getElementById('profile-avatar-display'); if(av) av.textContent=data.avatar||'😊';
  var nm=document.getElementById('profile-name-display'); if(nm) nm.textContent=data.pseudo||(window._fbUser?(window._fbUser.displayName||window._fbUser.email):'—');
  var tb=document.getElementById('profile-title-display'); if(tb){tb.textContent=title.label;tb.className='profile-title-badge '+title.cls;}
  var pr=document.getElementById('profile-promo-display'); if(pr) pr.textContent=data.promo||'';
  var badges=lsGet('tssr5_badges',[]);
  var pm=document.getElementById('prof-mastered'); if(pm) pm.textContent=mastered;
  var ps=document.getElementById('prof-streak'); if(ps) ps.textContent=streakD.current||0;
  var pb=document.getElementById('prof-badges'); if(pb) pb.textContent=badges.length;
  var pi=document.getElementById('prof-pseudo-input'); if(pi) pi.value=data.pseudo||'';
  var ri=document.getElementById('prof-promo-input'); if(ri) ri.value=data.promo||'';
  buildProfileThemeRow();
}

function buildProfileThemeRow(){
  var row=document.getElementById('prof-theme-row'); if(!row) return;
  row.innerHTML='';
  PROFILE_THEMES.forEach(function(t){
    var btn=document.createElement('button');
    var isSel=(vTheme===t.id);
    btn.style.cssText='display:flex;align-items:center;gap:5px;padding:6px 10px;border-radius:5px;cursor:pointer;font-family:monospace;font-size:7px;letter-spacing:1px;border:1.5px solid '+(isSel?'var(--acc)':'var(--border2)')+';background:'+(isSel?'var(--a2)':'var(--panel)')+';color:'+(isSel?'var(--acc)':'var(--text2)')+';transition:all .12s;';
    btn.innerHTML='<span style="width:8px;height:8px;border-radius:50%;background:'+t.dot+';display:inline-block;"></span>'+t.label;
    (function(tid){btn.onclick=function(){vTheme=tid;lsSet('tssr5_vt',vTheme);applyBody();buildProfileThemeRow();if(window.fbSaveUserData)setTimeout(window.fbSaveUserData,500);};})(t.id);
    row.appendChild(btn);
  });
}

function saveProfile(){
  var pseudo=(document.getElementById('prof-pseudo-input').value||'').trim();
  var promo=(document.getElementById('prof-promo-input').value||'').trim();
  var data=loadProfileData();
  if(pseudo) data.pseudo=pseudo;
  data.promo=promo;
  lsSet('tssr5_profile',data);
  if(window.fbSaveUserData) window.fbSaveUserData();
  updateMenuProfile();
  var msg=document.getElementById('prof-save-msg');
  if(msg){msg.style.display='block';setTimeout(function(){msg.style.display='none';},2500);}
}

function openAvatarPicker(){
  var data=loadProfileData();
  var grid=document.getElementById('avatar-grid'); if(!grid) return;
  grid.innerHTML='';
  AVATARS.forEach(function(a){
    var d=document.createElement('div');
    d.className='avatar-opt'+(a===(data.avatar||'😊')?' selected':'');
    d.textContent=a;
    d.onclick=function(){
      var profile=loadProfileData(); profile.avatar=a;
      lsSet('tssr5_profile',profile);
      var av=document.getElementById('profile-avatar-display'); if(av) av.textContent=a;
      updateMenuProfile();
      if(window.fbSaveUserData) window.fbSaveUserData();
      setTimeout(closeAvatarPicker,400);
    };
    grid.appendChild(d);
  });
  document.getElementById('avatar-picker').classList.add('show');
}
function closeAvatarPicker(){ document.getElementById('avatar-picker').classList.remove('show'); }

// ============================================================
// LEADERBOARD
// ============================================================
var _lbData=[], _lbTab='mastered';

async function loadLeaderboard(){
  if(!window._fbGetDocs||!window._fbCollection){
    document.getElementById('lb-list').innerHTML='<div style="text-align:center;padding:24px;font-family:monospace;font-size:9px;color:var(--text2);">⚠️ Firebase non connecté</div>';
    return;
  }
  document.getElementById('lb-list').innerHTML='<div style="text-align:center;padding:24px;font-family:monospace;font-size:9px;color:var(--text2);">⏳ Chargement...</div>';
  try{
    var snap=await window._fbGetDocs(window._fbQuery(window._fbCollection(window._fbDb,'leaderboard'),window._fbLimit(50)));
    _lbData=[];
    snap.forEach(function(d){ _lbData.push(Object.assign({uid:d.id},d.data())); });
    renderLeaderboard();
  }catch(err){
    document.getElementById('lb-list').innerHTML='<div style="text-align:center;padding:24px;font-family:monospace;font-size:9px;color:#dc2626;">❌ '+escapeUserHtml(err.message)+'</div>';
  }
}

function lbSwitchTab(tab){
  _lbTab=tab;
  document.querySelectorAll('.lb-tab').forEach(function(b){b.classList.remove('active');});
  var btn=document.getElementById('lb-tab-'+tab); if(btn) btn.classList.add('active');
  renderLeaderboard();
}

function renderLeaderboard(){
  var myUid=window._fbUser?window._fbUser.uid:null;
  var sorted=_lbData.slice().sort(function(a,b){
    if(_lbTab==='rate'){
      var ra=a.totalPlayed>0?Math.round((a.totalCorrect||0)/a.totalPlayed*100):0;
      var rb=b.totalPlayed>0?Math.round((b.totalCorrect||0)/b.totalPlayed*100):0;
      return rb-ra;
    }
    return (b[_lbTab]||0)-(a[_lbTab]||0);
  });
  var rankIcons={1:'🥇',2:'🥈',3:'🥉'};
  var scoreLabels={mastered:'maîtrisés',rate:'% réussite',streak:'j. streak',badges:'badges'};
  var myRank=sorted.findIndex(function(x){return x.uid===myUid;})+1;
  var bannerEl=document.getElementById('lb-my-rank-banner');
  if(bannerEl) bannerEl.innerHTML=myRank>0?'<div class="lb-my-rank">Tu es #'+myRank+' sur '+sorted.length+' joueurs — '+(sorted[myRank-1][_lbTab]||0)+' '+scoreLabels[_lbTab]+'</div>':'';
  var list=document.getElementById('lb-list');
  if(!sorted.length){list.innerHTML='<div style="text-align:center;padding:24px;font-family:monospace;font-size:9px;color:var(--text2);">Aucun joueur pour l\'instant</div>';return;}
  list.innerHTML=sorted.map(function(user,i){
    var rank=i+1,isMe=user.uid===myUid;
    var rankDisp=rankIcons[rank]||('<span style="font-size:11px;color:var(--dim);">#'+rank+'</span>');
    return '<div class="lb-row'+(isMe?' lb-me':'')+'">'+
      '<div class="lb-rank">'+(rankDisp)+'</div>'+
      '<div class="lb-avatar">'+escapeUserHtml(user.avatar||'😊')+'</div>'+
      '<div class="lb-info"><div class="lb-pseudo">'+escapeUserHtml(user.pseudo||'Anonyme')+(isMe?' <span style="font-size:8px;color:var(--acc);">← toi</span>':'')+
      '</div><div style="font-size:9px;color:var(--text2);">'+escapeUserHtml(user.promo||'')+'</div>'+
      '<div style="font-family:monospace;font-size:7px;color:var(--dim);margin-top:2px;">'+escapeUserHtml(user.title||'')+'</div></div>'+
      '<div class="lb-score"><span class="lb-score-val">'+
      (_lbTab==='rate' && user.totalPlayed>0 ? Math.round((user.totalCorrect||0)/(user.totalPlayed||1)*100)+'%<br><span style="font-size:8px;color:var(--dim)">('+user.totalPlayed+' q.)</span>' : (user[_lbTab]||0))+
      '</span><span class="lb-score-lbl">'+scoreLabels[_lbTab]+'</span></div>'+
    '</div>';
  }).join('');
}

function showLeaderboard(){ openOverlay('leaderboard'); loadLeaderboard(); }

// ============================================================
// OBJECTIFS
// ============================================================
function getQuestsData(){return lsGet('tssr5_quests',{daily:{date:'',played:0,correct:0,srs:0},weekly:{week:0,played:0,cats:[]}});}
function saveQuestsData(d){lsSet('tssr5_quests',d);}
function getWeekNum(){var d=new Date();var s=new Date(d.getFullYear(),0,1);return Math.ceil(((d-s)/86400000+s.getDay()+1)/7);}

function updateQuestProgress(type,amount){
  var d=getQuestsData();
  var today=new Date().toDateString(),week=getWeekNum();
  if(d.daily.date!==today) d.daily={date:today,played:0,correct:0,srs:0};
  if(d.weekly.week!==week) d.weekly={week:week,played:0,cats:[]};
  if(type==='played')   d.daily.played  +=(amount||1);
  if(type==='correct')  d.daily.correct +=(amount||1);
  if(type==='srs')      d.daily.srs     +=(amount||1);
  if(type==='weekly_played') d.weekly.played+=(amount||1);
  if(type==='weekly_cat'&&amount&&d.weekly.cats.indexOf(amount)<0) d.weekly.cats.push(amount);
  saveQuestsData(d);
}

function buildQuestsScreen(){
  var d=getQuestsData();
  var today=new Date().toDateString(),week=getWeekNum();
  if(d.daily.date!==today) d.daily={date:today,played:0,correct:0,srs:0};
  if(d.weekly.week!==week) d.weekly={week:week,played:0,cats:[]};
  var badges=lsGet('tssr5_badges',[]);
  var mastered=getMasteredCount();

  var DAILY=[
    {icon:'⚡',name:'Révision express',desc:'Joue 10 questions aujourd\'hui',reward:'+50 XP',prog:Math.min(d.daily.played,10),total:10,done:d.daily.played>=10},
    {icon:'🎯',name:'Révision ciblée',desc:'Réponds à 5 questions en révision ciblée',reward:'+30 XP',prog:Math.min(d.daily.srs,5),total:5,done:d.daily.srs>=5},
    {icon:'🔥',name:'Précision',desc:'Enchaîne 5 bonnes réponses',reward:'+40 XP',prog:Math.min(maxCombo||0,5),total:5,done:(maxCombo||0)>=5},
    {icon:'📅',name:'Streak',desc:'Maintiens ton streak quotidien',reward:'+20 XP',prog:Math.min(streakD.current||0,1),total:1,done:(streakD.current||0)>=1},
  ];
  var WEEKLY=[
    {icon:'📚',name:'Explorateur',desc:'Joue dans 4 catégories différentes',reward:'+200 XP',prog:Math.min(d.weekly.cats.length,4),total:4,done:d.weekly.cats.length>=4},
    {icon:'💪',name:'Persévérance',desc:'Joue 50 questions cette semaine',reward:'+150 XP',prog:Math.min(d.weekly.played,50),total:50,done:d.weekly.played>=50},
    {icon:'💎',name:'Maîtrise',desc:'Atteins 20 questions maîtrisées',reward:'+300 XP',prog:Math.min(mastered,20),total:20,done:mastered>=20},
    {icon:'🏅',name:'Collectionneur',desc:'Débloque 5 badges',reward:'+100 XP',prog:Math.min(badges.length,5),total:5,done:badges.length>=5},
  ];

  function renderQ(q){
    var pct=Math.round(q.prog/q.total*100);
    return '<div class="quest-card'+(q.done?' quest-done':'')+'">'+
      '<div class="quest-icon">'+q.icon+'</div>'+
      '<div class="quest-info"><div class="quest-name">'+q.name+'</div><div class="quest-desc">'+q.desc+'</div>'+
      '<div class="quest-prog-bar"><div class="quest-prog-fill" style="width:'+pct+'%"></div></div>'+
      '<div style="font-family:monospace;font-size:8px;color:var(--dim);margin-top:3px;">'+q.prog+' / '+q.total+'</div></div>'+
      (q.done?'<div style="font-size:18px;">✅</div>':'<div class="quest-reward">'+q.reward+'</div>')+
    '</div>';
  }

  var doneD=DAILY.filter(function(q){return q.done;}).length;
  var doneW=WEEKLY.filter(function(q){return q.done;}).length;
  var content=document.getElementById('quests-content');
  if(!content) return;
  content.innerHTML=
    '<div style="font-family:monospace;font-size:8px;color:var(--dim);letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;">📅 AUJOURD\'HUI ('+doneD+'/'+DAILY.length+')</div>'+
    DAILY.map(renderQ).join('')+
    '<div style="font-family:monospace;font-size:8px;color:var(--dim);letter-spacing:2px;text-transform:uppercase;margin:16px 0 8px;">📆 CETTE SEMAINE ('+doneW+'/'+WEEKLY.length+')</div>'+
    WEEKLY.map(renderQ).join('');
}
function showQuestsScreen(){buildQuestsScreen();openOverlay('quests');}


// ============================================================
// SYSTÈME OVERLAY PANELS
// ============================================================
function openOverlay(name){
  // Essayer d'abord un vrai overlay, sinon fallback sur screen
  var el2=document.getElementById('overlay-'+name);
  if(el2){
    el2.classList.add('show');
    document.body.style.overflow='hidden';
  } else {
    // Fallback : utiliser showScreen
    showScreen(name);
  }
  // Charger les données
  if(name==='profile') loadProfileScreen();
  if(name==='leaderboard') loadLeaderboard();
  if(name==='quests') buildQuestsScreen();
  if(name==='settings') openSettingsScreen();
}

function closeOverlay(name){
  var el2=document.getElementById('overlay-'+name);
  if(el2){ el2.classList.remove('show'); document.body.style.overflow=''; }
  // Aussi vérifier screen
  var sc=document.getElementById('screen-'+name);
  if(sc&&sc.classList.contains('active')) goMenu();
}

function openSettingsScreen(){
  showScreen('settings');
  _updateThemeBtns();
  var ss=document.getElementById('stoggle-settings'); if(ss) ss.classList.toggle('on',soundOn);
  var ls=document.getElementById('lofi-btn-settings'); if(ls) ls.textContent=lofiOn?'ON':'OFF';
  document.querySelectorAll('.settings-theme-btn').forEach(function(b){
    b.classList.toggle('sel',b.getAttribute('data-vt')===vTheme);
  });
  var curUI=currentUI||lsGet('tssr5_ui','ui-neon')||'ui-neon';
  document.querySelectorAll('.settings-da-btn').forEach(function(b){
    b.classList.toggle('sel',b.getAttribute('data-ui')===curUI);
  });
  var em=document.getElementById('settings-email-display');
  if(em&&window._fbUser) em.textContent=window._fbUser.email||'—';
}

function pickUISettings(btn){
  if(typeof playThemeChange==='function') playThemeChange();
  document.querySelectorAll('.settings-da-btn').forEach(function(b){b.classList.remove('sel');});
  btn.classList.add('sel');
  var ui=btn.getAttribute('data-ui');
  if(typeof switchUI==='function'){ switchUI(ui); }
  else { window.uiStyle=ui; lsSet('tssr5_ui',ui); applyBody(); }
  if(window.fbSaveUserData) setTimeout(window.fbSaveUserData,500);
}
window.pickUISettings=pickUISettings;

function pickVTSettings(btn){
  if(typeof playThemeChange==='function') playThemeChange();
  document.querySelectorAll('.settings-theme-btn').forEach(function(b){b.classList.remove('sel');});
  btn.classList.add('sel');
  vTheme=btn.getAttribute('data-vt');
  lsSet('tssr5_vt',vTheme);
  applyBody();
  if(window.fbSaveUserData) setTimeout(window.fbSaveUserData,500);
}

// Override toggleSound pour syncer settings overlay
function toggleSound(){
  soundOn=!soundOn;
  lsSet('tssr5_sound',soundOn);
  ['stoggle','stoggle-menu','stoggle-settings'].forEach(function(id){
    var t=document.getElementById(id); if(t) t.classList.toggle('on',soundOn);
  });
  if(window.fbSaveUserData) setTimeout(window.fbSaveUserData,500);
}

// ============================================================
// SKIP QUESTION — bouton de secours
// ============================================================
function skipQuestion(){
  if(answered) return;
  clearInterval(timerInt);
  answered=true;
  updDot(idx,'pdot');
  var fbk=el('fbk');
  fbk.className='fbk show';
  fbk.style.cssText='border:1.5px solid #ff9800;background:rgba(255,152,0,.08);color:#cc7700;display:block;';
  fbk.innerHTML='⏭ Question passée.';
  el('nextbtn').className='next-btn show';
}

// ============================================================
// TIMER ADAPTATIF
// ============================================================
var MECH_TIMERS={qcm:1.0,tf:0.6,fill:1.0,calc:1.5,debug:1.2,type:1.2,slider:1.0,word:1.8,scramble:2.0,order:3.5,match:3.0,multiblank:2.5,categorize:3.0,hotspot:4.0};
var MECH_MIN_TIMER={order:30,match:25,categorize:30,hotspot:40,multiblank:20,word:18,scramble:15,calc:12,debug:12,type:12};
function getQTimer(q,baseTimer){
  if(!baseTimer||baseTimer===0)return 0;
  var mult=MECH_TIMERS[q.t]||1.0;
  var minT=MECH_MIN_TIMER[q.t]||0;
  return Math.max(Math.round(baseTimer*mult),minT,baseTimer);
}

// ============================================================
// DUEL EN LIGNE V2 — Multijoueur (jusqu'à 5) + Lobby
// ============================================================
var onlineSession={
  code:null, uid:null, role:null, // 'host' ou 'guest'
  unsubscribe:null,
  config:null,            // { mode, qPerRound, totalRounds, target, speedBonus }
  qIdx:0,                 // index global dans la pool
  roundIdx:0,
  questionsPool:[],       // chez le host
  qStartTs:0,             // timestamp local start question
  myAnswered:false,       // bool
  revealing:false,        // bool guard
  isPaused:false,         // pause collective
  perRoundScores:{}       // map uid -> [score_round1, score_round2,...]
};
var unsubLobby = null;

var ONLINE_MODES={
  rounds:  { label:'🏁 MODE ROUNDS',     desc:'Enchaînez 3 rounds de questions. Le score du dernier round reste secret jusqu\'à la fin ! 🔥' }
};

function genSessionCode(){
  var chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var code='';
  for(var i=0;i<6;i++) code+=chars[Math.floor(Math.random()*chars.length)];
  return code;
}

function _onlineUpdate(payload){
  if(!onlineSession.code) return Promise.resolve();
  return window._fbUpdateDoc(window._fbDoc(window._fbDb,'duels',onlineSession.code),payload);
}

async function createOnlineSession(){
  if(!window._fbSetDoc||!window._fbUser){
    showOnlineError('Tu dois être connecté pour jouer en ligne.');return;
  }
  var code=genSessionCode();
  onlineSession.code=code;
  onlineSession.role='host';
  onlineSession.uid=window._fbUser.uid;
  onlineSession.localCategories = [];
  onlineSession.localCount = 10;
  onlineSession.localSpeedBonus = false;

  var profile=lsGet('tssr5_profile',{});
  var pseudo=profile.pseudo||(window._fbUser.email?window._fbUser.email.split('@')[0]:'Joueur');
  var isPrivate=document.getElementById('online-private-cb')?document.getElementById('online-private-cb').checked:false;

  var players = {};
  players[window._fbUser.uid] = { uid:window._fbUser.uid, pseudo:pseudo, score:0, ready:false, vote:null, answer:null, role:'host' };

  try{
    await window._fbSetDoc(window._fbDoc(window._fbDb,'duels',code),{
      code:code,
      host: window._fbUser.uid,
      players: players,
      isPublic: !isPrivate,
      status:'waiting',
      qIdx:0, roundIdx:0,
      currentQ:null,
      config: {
        mode: 'rounds',
        qPerRound: 10,
        totalRounds: 3,
        speedBonus: false,
        categories: []
      },
      reveal:false,
      cat:selCat||'mix',
      createdAt:window._fbServerTs?window._fbServerTs():new Date().toISOString()
    });
    var box=document.getElementById('online-code-box');
    var num=document.getElementById('online-code-num');
    if(box) box.style.display='block';
    if(num) num.textContent=code;
    var setupCtrl=document.getElementById('online-setup-controls');
    if(setupCtrl) setupCtrl.style.display='none';
    document.getElementById('online-create-btn').style.display='none';
    document.getElementById('online-waiting').style.display='flex';
    listenOnlineSession(code);
  }catch(err){
    var c=err.code||err.message||'';
    if((c+'').indexOf('permission')>-1) showOnlineError('⚠️ Règles Firestore non déployées. Voir /FIRESTORE_SETUP.md');
    else showOnlineError('Erreur : '+(err.message||err));
  }
}

async function joinOnlineSession(forcedCode){
  if(!window._fbUser){showOnlineError('Tu dois être connecté.');return;}
  var code = forcedCode;
  if(!code) {
    var inp=document.getElementById('online-join-input');
    code=(inp?inp.value:'').trim().toUpperCase();
  }
  if(code.length!==6){showOnlineError('Code invalide (6 caractères).');return;}

  var profile=lsGet('tssr5_profile',{});
  var pseudo=profile.pseudo||(window._fbUser.email?window._fbUser.email.split('@')[0]:'Joueur');

  try{
    var docRef=window._fbDoc(window._fbDb,'duels',code);
    var snap=await window._fbGetDoc(docRef);
    if(!snap.exists()){showOnlineError('Session introuvable. Vérifie le code.');return;}
    var data=snap.data();
    if(data.status!=='waiting'){showOnlineError('Cette session a déjà commencé.');return;}
    
    var pCount = data.players ? Object.keys(data.players).length : 0;
    var alreadyIn = data.players && data.players[window._fbUser.uid];
    if(!alreadyIn && pCount >= 10){
      showOnlineError('Cette session est pleine (10 joueurs max).');return;
    }

    onlineSession.code=code;
    onlineSession.role= (data.host === window._fbUser.uid) ? 'host' : 'guest';
    onlineSession.uid=window._fbUser.uid;
    onlineSession.localCategories = (data.config && data.config.categories) ? data.config.categories.slice() : [];
    onlineSession.localCount = (data.config && data.config.qPerRound) ? data.config.qPerRound : 10;
    onlineSession.localSpeedBonus = (data.config && data.config.speedBonus) ? !!data.config.speedBonus : false;

    if(!alreadyIn){
      var upd = {};
      upd['players.'+window._fbUser.uid] = { uid:window._fbUser.uid, pseudo:pseudo, score:0, ready:false, vote:null, answer:null, role:onlineSession.role };
      await window._fbUpdateDoc(docRef, upd);
    }
    
    // Switch to waiting view
    var setupCtrl=document.getElementById('online-setup-controls');
    if(setupCtrl) setupCtrl.style.display='none';
    document.getElementById('online-create-btn').style.display='none';
    var box=document.getElementById('online-code-box');
    if(box) box.style.display='none';
    document.getElementById('online-waiting').style.display='flex';
    var wMsg = document.getElementById('online-waiting-msg');
    if(wMsg) wMsg.textContent="En attente de l'hôte...";
    
    listenOnlineSession(code);
  }catch(err){
    var c=err.code||err.message||'';
    if((c+'').indexOf('permission')>-1) showOnlineError('⚠️ Règles Firestore non déployées. Voir /FIRESTORE_SETUP.md');
    else showOnlineError('Erreur : '+(err.message||err));
  }
}

async function cleanUserOldDuels(uid) {
  if (!window._fbDb || !window._fbCollection || !window._fbGetDocs || !window._fbDeleteDoc) return;
  try {
    var q = window._fbQuery(
      window._fbCollection(window._fbDb, 'duels'),
      window._fbWhere('host', '==', uid)
    );
    var snap = await window._fbGetDocs(q);
    snap.forEach(function(docRef) {
      var d = docRef.data();
      if (d.status !== 'finished') {
        window._fbDeleteDoc(window._fbDoc(window._fbDb, 'duels', docRef.id)).catch(function(){});
      }
    });
  } catch (e) {
    console.warn('Failed to clean up old duels:', e);
  }
}
window.cleanUserOldDuels = cleanUserOldDuels;

function loadOpenSessions(){
  if(unsubLobby) unsubLobby();
  if(!window._fbDb || !window._fbCollection) return;
  var listArea = document.getElementById('online-lobby-list');
  if(!listArea) return;
  listArea.innerHTML = '<div style="text-align:center;color:var(--text2);font-size:0.85rem;padding:10px;">Recherche...</div>';

  // Use single where to avoid needing a composite Firestore index
  var q = window._fbQuery(window._fbCollection(window._fbDb, 'duels'), window._fbWhere('status', '==', 'waiting'));
  unsubLobby = window._fbOnSnapshot(q, function(snap) {
    var sessions = [];
    var now = Date.now();
    snap.forEach(function(doc){
      var d = doc.data();
      if(d.isPublic === false) return;

      // Filter out sessions older than 15 minutes
      var createdMs = 0;
      if (d.createdAt) {
        if (typeof d.createdAt.toDate === 'function') {
          createdMs = d.createdAt.toDate().getTime();
        } else if (d.createdAt.seconds !== undefined) {
          createdMs = d.createdAt.seconds * 1000;
        } else {
          var parsed = Date.parse(d.createdAt);
          if (!isNaN(parsed)) {
            createdMs = parsed;
          }
        }
      }
      // If a session is older than 15 minutes, consider it abandoned
      if (createdMs > 0 && (now - createdMs) > 15 * 60 * 1000) {
        return;
      }

      sessions.push(d);
    });

    if(sessions.length === 0){
      listArea.innerHTML = '<div style="text-align:center;color:var(--text2);font-size:0.85rem;padding:10px;">Aucune session publique en attente.</div>';
      return;
    }
    var html = '';
    sessions.forEach(function(d){
      var pCount = d.players ? Object.keys(d.players).length : 1;
      var hostName = 'Joueur';
      if(d.players && d.players[d.host]) hostName = d.players[d.host].pseudo;
      var isFull = pCount >= 5;
      var btnHtml = isFull
        ? '<button disabled style="background:var(--border2);color:var(--text2);border:none;border-radius:6px;padding:5px 10px;cursor:not-allowed;">Plein</button>'
        : '<button onclick="joinOnlineSession(\''+d.code+'\')" style="background:var(--primary);color:#000;border:none;border-radius:6px;padding:5px 10px;cursor:pointer;font-weight:bold;">Rejoindre</button>';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg3);padding:10px;border-radius:8px;border:1px solid var(--border2);">'
            + '<div><span style="font-weight:bold;color:var(--text);">'+hostName+'</span> <span style="color:var(--text2);font-size:0.8rem;">('+pCount+'/10 joueurs)</span></div>'
            + btnHtml + '</div>';
    });
    listArea.innerHTML = html;
  }, function(err){
    console.warn('lobby error', err);
    listArea.innerHTML = '<div style="text-align:center;color:var(--error);font-size:0.8rem;padding:10px;">Erreur lobby: '+err.code+'</div>';
  });
}

function listenOnlineSession(code){
  if(unsubLobby) { unsubLobby(); unsubLobby = null; }
  if(!window._fbDb||!window._fbDoc) return;
  if(typeof window._fbOnSnapshot==='function'){
    var ref=window._fbDoc(window._fbDb,'duels',code);
    var unsub=window._fbOnSnapshot(ref, function(snap){
      if(!onlineSession.code){ if(unsub) unsub(); return; }
      if(!snap.exists()){ if(unsub) unsub(); return; }
      handleOnlineSessionUpdate(snap.data());
    }, function(err){
      console.warn('onSnapshot error',err);
      showOnlineError('Connexion : '+(err.message||err.code||'erreur'));
    });
    onlineSession.unsubscribe=unsub;
  }
}

function cancelOnlineSession(){
  if(onlineSession.unsubscribe) onlineSession.unsubscribe();
  if(onlineSession.code && onlineSession.role==='host' && window._fbDeleteDoc){
    window._fbDeleteDoc(window._fbDoc(window._fbDb,'duels',onlineSession.code)).catch(function(){});
  }
  // Stopper tous les timers online en cours
  if(window._onlineTimerInt){ clearTimeout(window._onlineTimerInt); window._onlineTimerInt=null; }
  if(window._onlineForceRevealInt){ clearTimeout(window._onlineForceRevealInt); window._onlineForceRevealInt=null; }
  onlineSession={code:null,uid:null,role:null,status:null,unsubscribe:null,config:null,qIdx:0,roundIdx:0,questionsPool:[],qStartTs:0,myAnswered:false,revealing:false,isPaused:false,perRoundScores:{},localCategories:[],localCount:10,localSpeedBonus:false};
  
  // Reset all panels
  var setupPanel = document.getElementById('online-setup-panel');
  if(setupPanel) setupPanel.style.display='block';
  var setupCtrl = document.getElementById('online-setup-controls');
  if(setupCtrl) setupCtrl.style.display='block';
  var createBtn = document.getElementById('online-create-btn');
  if(createBtn) createBtn.style.display='block';
  var codeBox = document.getElementById('online-code-box');
  if(codeBox) codeBox.style.display='none';
  var waitingEl = document.getElementById('online-waiting');
  if(waitingEl) waitingEl.style.display='none';
  var lobbyArea = document.getElementById('online-lobby-area');
  if(lobbyArea) lobbyArea.style.display='block';
  var joinInput = document.getElementById('online-join-input');
  if(joinInput) joinInput.value='';
  var roster = document.getElementById('online-player-roster');
  if(roster) roster.innerHTML='';
  var hBtn = document.getElementById('online-host-start-btn');
  if(hBtn) hBtn.style.display='none';
  ['vote','round','game','finish'].forEach(function(x){
    var e=document.getElementById('online-'+x+'-panel'); if(e) e.style.display='none';
  });
  showScreen('menu');
}


function handleOnlineSessionUpdate(data){
  if(data){
    if(data.status) onlineSession.status = data.status;
    if(data.config) onlineSession.config = data.config;
    if(data.qIdx !== undefined) onlineSession.qIdx = data.qIdx;
    if(data.roundIdx !== undefined) onlineSession.roundIdx = data.roundIdx;
    // ── Pause collective ──
    if(data.paused !== undefined){
      onlineSession.isPaused = !!data.paused;
      var _povl = document.getElementById('online-povl');
      if(_povl) _povl.classList.toggle('show', !!data.paused);
    }
  }
  var isHost=onlineSession.role==='host';
  var playersList = data.players ? Object.values(data.players) : [];
  
  // 1. WAITING
  if(data.status==='waiting'){ 
    _showOnlinePanel('setup');
    // Show the waiting section
    var wSection = document.getElementById('online-waiting');
    if(wSection) wSection.style.display='flex';
    // Hide lobby (we're now in a session)
    var lobbyArea = document.getElementById('online-lobby-area');
    if(lobbyArea) lobbyArea.style.display='none';

    var wMsg = document.getElementById('online-waiting-msg');
    var hBtn = document.getElementById('online-host-start-btn');

    // Build player roster
    var rosterEl = document.getElementById('online-player-roster');
    if(rosterEl) {
      var rHtml = '<div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:10px;">';
      playersList.forEach(function(p){
        var crown = p.uid === data.host ? ' 👑' : '';
        rHtml += '<div style="background:var(--bg3);border:1px solid var(--border2);border-radius:8px;padding:6px 12px;font-size:0.85rem;color:var(--text);">'+p.pseudo+crown+'</div>';
      });
      rHtml += '</div>';
      rosterEl.innerHTML = rHtml;
    }

    // Render configuration panel inside the lobby/waiting area
    renderLobbyConfigPanel(data, isHost);

    if(isHost) {
      if(playersList.length > 1) {
        if(wMsg) wMsg.textContent = playersList.length + '/10 joueurs – Prêts à commencer !';
        if(hBtn) {
          hBtn.style.display='block';
          hBtn.onclick = hostManualStart;
        }
      } else {
        if(wMsg) wMsg.textContent = 'En attente de joueurs... (1/10)';
        if(hBtn) hBtn.style.display='none';
      }
    } else {
      if(wMsg) wMsg.textContent = playersList.length + ' joueur(s) présent(s) – En attente de l\'hôte...';
      if(hBtn) hBtn.style.display='none';
    }
    return; 
  }

  // 3. STARTING — host génère la pool
  if(data.status==='starting'){
    _showOnlinePanel('round');
    renderRoundRecap(data, true /*starting*/);
    if(isHost){ hostGenerateQuestionsAndStart(data); }
    return;
  }

  // 4. ROUND_END
  if(data.status==='round_end'){
    _showOnlinePanel('round');
    renderRoundRecap(data, false);
    return;
  }

  // 5. PLAYING
  if(data.status==='playing'){
    _showOnlinePanel('game');
    onlineSession._hostStarting = false; // Reset guard for future use
    onlineSession.status = 'playing'; // Needed by resolveCommon to detect online mode
    onlineSession.config=data.config;
    onlineSession.qIdx=data.qIdx||0;
    onlineSession.roundIdx=data.roundIdx||0;
    renderOnlineHUD(data);
    
    var curQ=data.currentQ;
    var needRerender = !window._lastRenderedQ || 
                       window._lastRenderedQ.qIdx !== (data.qIdx || 0) || 
                       window._lastRenderedQ.roundIdx !== (data.roundIdx || 0);
    if(curQ && needRerender){
      window._lastRenderedQ = {
        idx: curQ.idx,
        qIdx: data.qIdx || 0,
        roundIdx: data.roundIdx || 0
      };
      onlineSession.qStartTs = Date.now();
      onlineSession.myAnswered=false;
      onlineSession.revealing=false;
      renderOnlineQuestion(curQ);
    }
    
    var allAnswered = playersList.every(function(p){ return p.answer != null; });
    if((allAnswered || data.reveal) && !onlineSession.revealing){
      onlineSession.revealing=true;
      revealOnlineQuestion(data);
      if(isHost){
        // Fetch fresh data so all player answers are included when advancing
        setTimeout(async function(){
          try {
            var freshSnap = await window._fbGetDoc(window._fbDoc(window._fbDb,'duels',onlineSession.code));
            hostAdvance(freshSnap.exists() ? freshSnap.data() : data);
          } catch(e){ hostAdvance(data); }
        }, 3000);
      }
    }
    return;
  }

  // 6. FINISHED
  if(data.status==='finished'){
    _showOnlinePanel('finish');
    buildOnlineFinish(data);
    return;
  }
}

function _showOnlinePanel(id){
  ['setup','vote','round','game','finish'].forEach(function(x){
    var e=document.getElementById('online-'+x+'-panel');
    if(e) e.style.display = (x===id)?'block':'none';
  });
}

async function hostManualStart(){
  if(onlineSession.role!=='host')return;
  
  var qInput = document.getElementById('online-q-count');
  var speedCb = document.getElementById('online-speed-bonus');
  
  var qCount = qInput ? parseInt(qInput.value) || 10 : 10;
  if (qCount < 1) qCount = 1;
  if (qCount > 100) qCount = 100;
  
  var cats = onlineSession.localCategories || [];
  if (cats.length === 0) {
    showOnlineError('⚠️ Sélectionnez au moins une catégorie avant de commencer !');
    return;
  }
  
  var cfg = {
    mode: 'rounds',
    qPerRound: qCount,
    totalRounds: 3,
    speedBonus: speedCb ? !!speedCb.checked : false,
    categories: cats
  };
  
  try {
    await _onlineUpdate({
      config: cfg,
      status: 'starting'
    });
  } catch(e) {
    showOnlineError('Erreur de lancement : ' + (e.message || e));
  }
}

// Update config to Firestore on UI change
window.updateOnlineConfigFromUI = function() {
  if (onlineSession.role !== 'host') return;
  var qInput = document.getElementById('online-q-count');
  var speedCb = document.getElementById('online-speed-bonus');
  
  var qCount = qInput ? parseInt(qInput.value) || 10 : 10;
  if (qCount < 1) qCount = 1;
  if (qCount > 100) qCount = 100;
  
  var cats = onlineSession.localCategories || [];
  
  var cfg = {
    mode: 'rounds',
    qPerRound: qCount,
    totalRounds: 3,
    speedBonus: speedCb ? !!speedCb.checked : false,
    categories: cats
  };
  
  _onlineUpdate({ config: cfg });
};

// Render config panel directly inside waiting screen (lobby)
function renderLobbyConfigPanel(data, isHost) {
  var container = document.getElementById('online-waiting-config');
  if (!container) return;

  var cfg = data.config || {};
  var qCount = cfg.qPerRound || 10;
  var speedBonus = !!cfg.speedBonus;
  var cats = cfg.categories || [];
  
  // Keep localCategories synchronized with Firebase configuration
  if (!onlineSession.localCategories || (cats.length > 0 && onlineSession.localCategories.length === 0)) {
    onlineSession.localCategories = cats.slice();
  }

  var activeCats = Object.keys(CATS).filter(function(k){ return k !== 'mix' && CATS[k] && CATS[k].qs && CATS[k].qs.length > 0; });
  var selCount = cats.length;
  var totalCount = activeCats.length;

  var html = '';

  // Presentation card
  html += '<div style="background:var(--bg2);border:1.5px solid var(--border2);border-radius:12px;padding:12px;margin-bottom:15px;text-align:center;box-shadow:inset 0 1px 3px rgba(0,0,0,0.2);">';
  html += '  <div style="font-weight:bold;color:var(--acc);margin-bottom:4px;font-size:0.95rem;font-family:var(--font-title);">🏁 MODE ROUNDS</div>';
  html += '  <div style="font-size:0.8rem;color:var(--text2);line-height:1.4;">' + ONLINE_MODES.rounds.desc + '</div>';
  html += '</div>';

  if (isHost) {
    // Input for questions count
    html += '<div style="margin-bottom:15px;text-align:left;">';
    html += '  <div style="font-size:0.85rem;color:var(--text2);margin-bottom:6px;font-weight:bold;font-family:monospace;letter-spacing:0.5px;">NOMBRE DE QUESTIONS PAR ROUND :</div>';
    html += '  <input type="number" id="online-q-count" min="1" max="50" value="' + qCount + '" ';
    html += '         onchange="updateOnlineConfigFromUI()" ';
    html += '         style="width:100%;padding:10px 12px;border-radius:8px;border:1.5px solid var(--border);background:var(--panel);color:var(--text);font-weight:bold;font-size:1rem;box-sizing:border-box;outline:none;transition:border-color 0.15s;" ';
    html += '         onfocus="this.style.borderColor=\'var(--acc)\'" onblur="this.style.borderColor=\'var(--border)\'">';
    html += '</div>';

    // Categories selector
    html += '<div style="margin-bottom:15px;text-align:left;">';
    html += '  <div style="font-size:0.85rem;color:var(--text2);margin-bottom:6px;font-weight:bold;font-family:monospace;letter-spacing:0.5px;">CHOIX DES CATÉGORIES :</div>';
    html += '  <button onclick="openOnlineCategoryPopup()" ';
    html += '          style="width:100%;padding:12px 14px;border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;background:var(--panel);border:1.5px solid var(--border);color:var(--text);font-family:monospace;font-size:11px;letter-spacing:1px;transition:border-color 0.15s;" ';
    html += '          onmouseover="this.style.borderColor=\'var(--acc)\'" onmouseout="this.style.borderColor=\'var(--border)\'">';
    html += '    <span>📁 SÉLECTIONNER</span>';
    var badgeColor = selCount === 0 ? 'var(--text2)' : 'var(--bg)';
    var badgeBg = selCount === 0 ? 'var(--border)' : 'var(--acc)';
    html += '    <span style="background:' + badgeBg + ';color:' + badgeColor + ';border-radius:20px;padding:2px 8px;font-size:10px;font-weight:bold;">' + selCount + ' / ' + totalCount + '</span>';
    html += '  </button>';
    html += '</div>';

    // Speed bonus
    html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:15px;text-align:left;">';
    var sbCheck = speedBonus ? 'checked' : '';
    html += '  <label style="color:var(--text);cursor:pointer;display:flex;align-items:center;gap:8px;font-size:0.9rem;user-select:none;">';
    html += '    <input type="checkbox" id="online-speed-bonus" ' + sbCheck + ' onchange="updateOnlineConfigFromUI()" style="accent-color:var(--acc);width:18px;height:18px;">';
    html += '    Bonus de vitesse (score dégressif selon le temps)';
    html += '  </label>';
    html += '</div>';
  } else {
    // Guest view: read-only
    html += '<div style="margin-bottom:15px;text-align:left;background:var(--bg3);border:1px solid var(--border2);border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:8px;">';
    
    html += '  <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.85rem;color:var(--text2);">';
    html += '    <span>Questions par round :</span>';
    html += '    <span style="font-weight:bold;color:var(--text);">' + qCount + '</span>';
    html += '  </div>';

    html += '  <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.85rem;color:var(--text2);">';
    html += '    <span>Catégories :</span>';
    html += '    <span style="font-weight:bold;color:var(--text);">' + selCount + ' / ' + totalCount + '</span>';
    html += '  </div>';

    html += '  <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.85rem;color:var(--text2);">';
    html += '    <span>Bonus de vitesse :</span>';
    html += '    <span style="font-weight:bold;color:' + (speedBonus ? 'var(--acc)' : 'var(--text2)') + '">' + (speedBonus ? 'ACTIVÉ 👍' : 'DÉSACTIVÉ ✕') + '</span>';
    html += '  </div>';

    html += '</div>';
  }

  container.innerHTML = html;
}

// ─── POPUP CATÉGORIES EN LIGNE ───
// Navigation 2 niveaux : liste des groupes => clic => cats du groupe
window.openOnlineCategoryPopup = function(){
  var old = document.getElementById('online-cats-overlay');
  if(old) old.remove();

  var GROUPS = window.GROUPS || {};
  var activeCats = Object.keys(CATS).filter(function(k){ return k!=='mix' && CATS[k] && CATS[k].qs && CATS[k].qs.length>0; });
  if(!onlineSession.localCategories) onlineSession.localCategories = [];
  var popSel = onlineSession.localCategories.slice();

  // ── OVERLAY ──
  var overlay = document.createElement('div');
  overlay.id = 'online-cats-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.6);backdrop-filter:blur(6px);';

  // ── POPUP CARD ──
  var popup = document.createElement('div');
  popup.style.cssText = 'position:relative;width:min(94vw,480px);max-height:88vh;display:flex;flex-direction:column;background:var(--panel);border:1.5px solid var(--border2);border-radius:16px;box-shadow:0 24px 64px rgba(0,0,0,.6);overflow:hidden;';

  // ── HEADER (dynamique selon le niveau) ──
  var header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid var(--border);background:var(--bg2);flex-shrink:0;';

  var hdLeft = document.createElement('div');
  var hdTitle = document.createElement('div');
  hdTitle.style.cssText = 'font-size:12px;font-weight:bold;color:var(--acc);';
  hdTitle.textContent = '\ud83d\udcc1 GROUPES DE CAT\u00c9GORIES';
  var hdSub = document.createElement('div');
  hdSub.style.cssText = 'font-size:8px;color:var(--text2);font-family:monospace;margin-top:2px;';
  hdSub.textContent = 'Clique sur un groupe pour choisir les cat\u00e9gories';
  hdLeft.appendChild(hdTitle);
  hdLeft.appendChild(hdSub);

  var closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.style.cssText = 'background:none;border:1px solid var(--border2);border-radius:6px;color:var(--text2);font-size:12px;cursor:pointer;padding:4px 8px;';
  closeBtn.onclick = function(){ overlay.remove(); };
  header.appendChild(hdLeft);
  header.appendChild(closeBtn);
  popup.appendChild(header);

  // ── CORPS (scrollable) ──
  var body = document.createElement('div');
  body.style.cssText = 'overflow-y:auto;flex:1;padding:10px 12px;';
  popup.appendChild(body);

  // ── NIVEAU 1 : liste des groupes ──
  function showGroupLevel(){
    hdTitle.textContent = '\ud83d\udcc1 GROUPES DE CAT\u00c9GORIES';
    hdSub.textContent = 'Clique sur un groupe pour choisir les cat\u00e9gories';
    hdSub.onclick = null; hdSub.style.cursor = ''; hdSub.style.color = 'var(--text2)';
    body.innerHTML = '';

    var allSel = activeCats.every(function(c){ return popSel.indexOf(c) > -1; });
    var mixCard = document.createElement('div');
    mixCard.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 12px;cursor:pointer;border-radius:10px;margin-bottom:8px;transition:all .13s;'
      + 'background:' + (allSel ? 'var(--a2)' : 'var(--panel)') + ';'
      + 'border:' + (allSel ? '1.5px solid var(--acc)' : '1px dashed var(--acc)') + ';';
    var sc = popSel.length, tc = activeCats.length;
    mixCard.innerHTML = '<span style="font-size:20px">\ud83c\udfb2</span>'
      + '<div style="flex:1"><div style="font-family:monospace;font-size:10px;font-weight:bold;color:var(--acc);">TOUT \u2014 MIX COMPLET</div>'
      + '<div style="font-family:monospace;font-size:8px;color:var(--text2);">' + tc + ' cat\u00e9gories disponibles</div></div>'
      + '<span style="font-family:monospace;font-size:9px;padding:3px 8px;border-radius:12px;background:' + (allSel?'rgba(0,168,90,.15)':'var(--bg2)') + ';color:' + (allSel?'var(--acc)':'var(--text2)') + ';">' + sc + '/' + tc + '</span>';
    mixCard.onclick = function(){
      if(activeCats.every(function(c){ return popSel.indexOf(c) > -1; })){
        popSel.length = 0;
      } else {
        popSel.length = 0; activeCats.forEach(function(c){ popSel.push(c); });
      }
      showGroupLevel();
    };
    body.appendChild(mixCard);

    var sep = document.createElement('div');
    sep.style.cssText = 'font-family:monospace;font-size:7px;color:var(--dim);letter-spacing:2px;text-align:center;padding:4px 0 8px;text-transform:uppercase;';
    sep.textContent = 'ou choisir par groupe';
    body.appendChild(sep);

    var GROUPS = window.GROUPS || {};
    var hasGroups = Object.keys(GROUPS).length > 0;
    if(hasGroups){
      Object.keys(GROUPS).forEach(function(groupId){
        var grp = GROUPS[groupId];
        var gCats = (grp.cats||[]).filter(function(c){ return activeCats.indexOf(c) > -1; });
        if(gCats.length === 0) return;
        var groupTotal = 0;
        gCats.forEach(function(c){ if(CATS[c] && CATS[c].qs) groupTotal += CATS[c].qs.length; });
        var gSelCount = gCats.filter(function(c){ return popSel.indexOf(c) > -1; }).length;
        var allGrpSel = gSelCount === gCats.length && gCats.length > 0;
        var icon = grp.label ? grp.label.split(' ')[0] : '\ud83d\udcc1';

        var grpCard = document.createElement('div');
        grpCard.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 12px;cursor:pointer;border-radius:10px;margin-bottom:6px;transition:all .13s;'
          + 'background:' + (allGrpSel ? 'var(--a2)' : 'var(--panel)') + ';'
          + 'border:' + (allGrpSel ? '1.5px solid var(--acc)' : '1px solid var(--border)') + ';';
        grpCard.innerHTML = '<span style="font-size:20px">' + icon + '</span>'
          + '<div style="flex:1;min-width:0;">'
            + '<div style="font-family:monospace;font-size:10px;font-weight:bold;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (grp.label||groupId) + '</div>'
            + '<div style="font-family:monospace;font-size:8px;color:var(--text2);">' + groupTotal + ' Q \u00b7 ' + gCats.length + ' cat.</div>'
          + '</div>'
          + '<span style="font-family:monospace;font-size:9px;padding:3px 8px;border-radius:12px;background:' + (allGrpSel?'rgba(0,168,90,.15)':'var(--bg2)') + ';color:' + (allGrpSel?'var(--acc)':'var(--text2)') + ';">' + gSelCount + '/' + gCats.length + '</span>'
          + '<span style="color:var(--text2);font-size:16px;margin-left:4px;">\u203a</span>';
        (function(gId, gCatsLocal, grpData){
          grpCard.onclick = function(){ showCatLevel(gId, gCatsLocal, grpData); };
        })(groupId, gCats, grp);
        body.appendChild(grpCard);
      });
    } else {
      // Pas de groupes : aller direct aux cats
      showCatLevel('all', activeCats, {label:'Toutes les cat\u00e9gories'});
    }
  }

  // ── NIVEAU 2 : cats d'un groupe ──
  function showCatLevel(groupId, gCats, grpData){
    hdTitle.textContent = (grpData.label||groupId);
    hdSub.style.cursor = 'pointer'; hdSub.style.color = 'var(--acc)';
    hdSub.textContent = '\u25c4 Retour aux groupes';
    hdSub.onclick = function(){ showGroupLevel(); };
    body.innerHTML = '';

    // Bouton tout/d\u00e9tout le groupe
    var allGrpSel = gCats.every(function(c){ return popSel.indexOf(c) > -1; });
    var gSelCount = gCats.filter(function(c){ return popSel.indexOf(c) > -1; }).length;
    var groupAllBtn = document.createElement('div');
    groupAllBtn.style.cssText = 'display:flex;align-items:center;gap:10px;padding:9px 12px;cursor:pointer;border-radius:9px;margin-bottom:8px;transition:all .13s;'
      + 'background:' + (allGrpSel?'var(--a2)':'var(--panel)') + ';'
      + 'border:' + (allGrpSel?'1.5px solid var(--acc)':'1px dashed var(--acc)') + ';';
    groupAllBtn.innerHTML = '<span style="font-size:16px">\u26a1</span>'
      + '<div style="flex:1"><div style="font-family:monospace;font-size:9px;font-weight:bold;color:var(--acc);">TOUT LE GROUPE</div></div>'
      + '<span style="font-family:monospace;font-size:9px;padding:2px 8px;border-radius:10px;background:' + (allGrpSel?'rgba(0,168,90,.15)':'var(--bg2)') + ';color:' + (allGrpSel?'var(--acc)':'var(--text2)') + ';">' + gSelCount + '/' + gCats.length + '</span>';
    groupAllBtn.onclick = function(){
      if(gCats.every(function(c){ return popSel.indexOf(c) > -1; })){
        gCats.forEach(function(c){ var i=popSel.indexOf(c); if(i>-1) popSel.splice(i,1); });
      } else {
        gCats.forEach(function(c){ if(popSel.indexOf(c)===-1) popSel.push(c); });
      }
      showCatLevel(groupId, gCats, grpData);
    };
    body.appendChild(groupAllBtn);

    var sep2 = document.createElement('div');
    sep2.style.cssText = 'font-family:monospace;font-size:7px;color:var(--dim);letter-spacing:2px;text-align:center;padding:2px 0 8px;text-transform:uppercase;';
    sep2.textContent = 'ou cat\u00e9gorie par cat\u00e9gorie';
    body.appendChild(sep2);

    var catGrid = document.createElement('div');
    catGrid.style.cssText = 'display:grid;grid-template-columns:repeat(2,1fr);gap:6px;';
    gCats.forEach(function(catId){
      var c = CATS[catId]; if(!c) return;
      var isSel = popSel.indexOf(catId) > -1;
      var cCard = document.createElement('div');
      cCard.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 10px;cursor:pointer;border-radius:8px;min-height:42px;box-sizing:border-box;transition:all .12s;'
        + 'background:' + (isSel?'var(--a2)':'var(--panel)') + ';'
        + 'border:' + (isSel?'1.5px solid var(--acc)':'1px solid var(--border)') + ';';
      cCard.innerHTML = '<span style="font-size:15px;flex-shrink:0;">' + (c.icon||'\ud83d\udcc1') + '</span>'
        + '<div style="flex:1;min-width:0;">'
          + '<div style="font-family:monospace;font-size:8px;font-weight:bold;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (c.label||catId) + '</div>'
          + '<div style="font-family:monospace;font-size:7px;color:var(--dim);">' + (c.qs?c.qs.length:0) + ' Q</div>'
        + '</div>'
        + (isSel ? '<span style="font-size:11px;color:var(--acc);">\u2713</span>' : '');
      (function(cId){
        cCard.onclick = function(){
          var idx = popSel.indexOf(cId);
          if(idx > -1){ popSel.splice(idx, 1); }
          else { popSel.push(cId); }
          showCatLevel(groupId, gCats, grpData);
        };
      })(catId);
      catGrid.appendChild(cCard);
    });
    body.appendChild(catGrid);
  }

  showGroupLevel();


  // ── FOOTER ──
  var footer = document.createElement('div');
  footer.style.cssText = 'display:flex;gap:8px;padding:10px 12px;border-top:1px solid var(--border);flex-shrink:0;background:var(--bg2);';

  var cancelFBtn = document.createElement('button');
  cancelFBtn.textContent = '✕ Annuler';
  cancelFBtn.style.cssText = 'flex:1;padding:10px;border-radius:8px;background:var(--panel);border:1.5px solid var(--border2);color:var(--text2);font-family:monospace;font-size:9px;cursor:pointer;';
  cancelFBtn.onclick = function(){ overlay.remove(); };

  var confirmFBtn = document.createElement('button');
  confirmFBtn.textContent = '✓ CONFIRMER';
  confirmFBtn.style.cssText = 'flex:2;padding:10px;border-radius:8px;background:var(--acc);border:none;color:var(--bg);font-family:monospace;font-size:10px;cursor:pointer;font-weight:bold;';
  confirmFBtn.onclick = function(){
    onlineSession.localCategories = popSel.slice();
    overlay.remove();
    if (onlineSession.role === 'host') {
      updateOnlineConfigFromUI();
    } else {
      var d = {status: onlineSession.status || 'waiting', players:{}};
      handleOnlineSessionUpdate(d);
    }
  };

  footer.appendChild(cancelFBtn);
  footer.appendChild(confirmFBtn);
  popup.appendChild(footer);

  overlay.appendChild(popup);
  document.body.appendChild(overlay);
};

// ─── STARTING ───
async function hostGenerateQuestionsAndStart(data){
  // Guard: only run once per 'starting' transition
  if(onlineSession._hostStarting) return;
  onlineSession._hostStarting = true;

  try {
    var cfg = data.config;
    if(!cfg){ console.warn('No config found!'); return; }

    var totalQ = 0;
    if(cfg.mode==='rounds') totalQ = cfg.qPerRound * cfg.totalRounds;
    if(totalQ < 1) totalQ = 10;

    // Build from selected categories
    var selectedCats = cfg.categories || [];
    if (selectedCats.length === 0) {
      selectedCats = Object.keys(CATS).filter(function(k){ return k !== 'mix' && CATS[k] && CATS[k].qs && CATS[k].qs.length > 0; });
    }

    var allQs = [];
    var okTypes = ['qcm','debug','tf','fill','calc','type','match','order','word','slider','scramble','multiblank','categorize','hotspot'];
    selectedCats.forEach(function(c){
      if(CATS[c] && CATS[c].qs){
        CATS[c].qs.forEach(function(q){
          if(q && okTypes.indexOf(q.t) !== -1){
            allQs.push({ c: c, q: q });
          }
        });
      }
    });

    var pool = shuffle(allQs).slice(0, totalQ);

    if(pool.length === 0){
      showOnlineError('Aucune question disponible ! Vérifiez les catégories.');
      onlineSession._hostStarting = false;
      return;
    }

    onlineSession.questionsPool = pool;

    var firstQ = pool[0];
    if(!firstQ || !firstQ.q){
      throw new Error("La première question du pool est invalide.");
    }

    // Store only serializable fields to avoid Firestore errors
    var qObj = {
      q: firstQ.q.q || '',
      a: firstQ.q.a !== undefined ? firstQ.q.a : 0,
      w: firstQ.q.w || [],
      t: firstQ.q.t || 'qcm',
      d: firstQ.q.d !== undefined ? firstQ.q.d : 1,
      idx: firstQ.q.idx !== undefined ? firstQ.q.idx : 0,
      x: firstQ.q.x || '',
      opts: firstQ.q.opts || null
    };
    if (firstQ.q.aliases) qObj.aliases = firstQ.q.aliases;
    var extraFields = [
      'items', 'pairs', 'words', 'correct',
      'min', 'max', 'step', 'unit', 'tolerance',
      'word', 'hint', 'code', 'blank',
      'blanks', 'text', 'categories', 'image', 'zones', 'setup'
    ];
    extraFields.forEach(function(f){
      if(firstQ.q[f] !== undefined) qObj[f] = firstQ.q[f];
    });
    var upd = {
      status: 'playing',
      qIdx: 0, roundIdx: 0,
      currentQ: {
        cat: firstQ.c || 'mix',
        idx: firstQ.q.idx !== undefined ? firstQ.q.idx : 0,
        obj: qObj
      },
      reveal: false
    };
    Object.keys(data.players).forEach(function(uid){
      upd['players.'+uid+'.score'] = 0;
      upd['players.'+uid+'.answer'] = null;
    });

    setTimeout(function(){ _onlineUpdate(upd); }, 3000);
  } catch(err) {
    console.error('hostGenerateQuestionsAndStart error:', err);
    showOnlineError('Erreur de démarrage : ' + (err.message || err));
    onlineSession._hostStarting = false;
  }
}

// ─── ROUND RECAP ───
function renderRoundRecap(data, starting){
  var area=document.getElementById('online-round-area');
  if(!area)return;
  var html='';
  if(starting){
    html+='<div style="font-size:2rem;font-weight:900;text-align:center;color:var(--primary);margin-top:20vh;font-family:var(--font-title);letter-spacing:2px;text-transform:uppercase;">PRÉPAREZ-VOUS</div>';
    if(data.config) html+='<div style="text-align:center;color:var(--text2);margin-top:10px;">Mode : '+ONLINE_MODES[data.config.mode].label+'</div>';
  } else {
    html+='<div style="font-size:1.8rem;font-weight:900;text-align:center;color:var(--text);margin-top:10vh;font-family:var(--font-title);">FIN DU ROUND '+(data.roundIdx+1)+'</div>';
    var players = Object.values(data.players).sort(function(a,b){return b.score - a.score;});
    
    html+='<div style="display:flex;flex-direction:column;gap:15px;margin-top:30px;">';
    players.forEach(function(p, idx){
      var crown = idx===0 ? '👑 ' : '';
      html+='<div style="display:flex;justify-content:space-between;background:var(--bg3);padding:15px;border-radius:12px;border:1px solid '+(idx===0?'var(--primary)':'var(--border)')+';">'
          + '<div style="font-weight:bold;color:var(--text);">'+crown+p.pseudo+'</div>'
          + '<div style="color:var(--primary);font-weight:900;">'+p.score+' pts</div>'
          + '</div>';
    });
    html+='</div>';
    
    if(onlineSession.role==='host'){
      html+='<div style="text-align:center;margin-top:30px;"><button onclick="hostNextRound()" style="background:var(--primary);color:#000;padding:12px 30px;border-radius:30px;border:none;font-weight:bold;cursor:pointer;">ROND SUIVANT →</button></div>';
    } else {
      html+='<div style="text-align:center;margin-top:30px;color:var(--text2);font-size:0.9rem;">En attente de l\'hôte...</div>';
    }
  }
  area.innerHTML=html;
}

window.hostNextRound = function(){
  if(onlineSession.role!=='host')return;
  var pool = onlineSession.questionsPool;
  var nIdx = onlineSession.qIdx; // already set to next question by hostAdvance
  function makeSafeQ(entry){
    var raw = entry.q;
    var safe = {
      q: raw.q || '',
      a: raw.a !== undefined ? raw.a : 0,
      w: raw.w || [],
      t: raw.t || 'qcm',
      d: raw.d !== undefined ? raw.d : 1,
      idx: raw.idx !== undefined ? raw.idx : 0,
      x: raw.x || '',
      opts: raw.opts || null
    };
    if (raw.aliases) safe.aliases = raw.aliases;
    var extraFields = [
      'items', 'pairs', 'words', 'correct',
      'min', 'max', 'step', 'unit', 'tolerance',
      'word', 'hint', 'code', 'blank',
      'blanks', 'text', 'categories', 'image', 'zones', 'setup'
    ];
    extraFields.forEach(function(f){
      if(raw[f] !== undefined) safe[f] = raw[f];
    });
    return safe;
  }
  var nextQ = pool && pool[nIdx] ? {
    cat: pool[nIdx].c || 'mix',
    idx: pool[nIdx].q.idx !== undefined ? pool[nIdx].q.idx : nIdx,
    obj: makeSafeQ(pool[nIdx])
  } : null;
  var upd = {status:'playing', reveal:false, qIdx: nIdx, roundIdx: onlineSession.roundIdx};
  if(nextQ) upd.currentQ = nextQ;
  _onlineUpdate(upd);
}

// ─── IN GAME ───
function renderOnlineHUD(data){
  var hud=document.getElementById('online-hud');
  if(!hud)return;
  var myUid = window._fbUser ? window._fbUser.uid : null;
  var players = Object.values(data.players).sort(function(a,b){return b.score - a.score;});
  var c = data.config || {};
  var qIdx = (data.qIdx||0) + 1;
  var totalQ = c.mode==='qbq' ? (c.qPerRound||'?')
              : c.mode==='rounds' ? (c.qPerRound||5) * (c.totalRounds||3)
              : c.mode==='course' ? '\u221e'
              : '?';

  var mePlayer = players.find(function(p){ return p.uid === myUid; }) || players[0];
  var themPlayers = players.filter(function(p){ return p.uid !== myUid; });

  var meFlagHtml = mePlayer && mePlayer.answer!=null
    ? '<span class="ohud-flag ok">\u2713 R\u00e9pondu</span>'
    : '<span class="ohud-flag wait">\u23f3</span>';

  var themHtml = themPlayers.map(function(p){
    var flag = p.answer!=null ? '<span class="ohud-flag ok">\u2713</span>' : '<span class="ohud-flag wait">\u23f3</span>';
    return '<div class="ohud-side ohud-them">'
      + '<div class="ohud-score">'+p.score+'</div>'
      + '<div class="ohud-name">'+escapeUserHtml(p.pseudo)+'</div>'
      + flag
      + '</div>';
  }).join('');

  hud.innerHTML =
    '<div class="ohud-side ohud-me">'
      + '<div class="ohud-score">'+(mePlayer ? mePlayer.score : 0)+'</div>'
      + '<div class="ohud-name">'+escapeUserHtml(mePlayer ? mePlayer.pseudo : 'Moi')+'</div>'
      + meFlagHtml
    + '</div>'
    + '<div class="ohud-mid">'
      + '<div class="ohud-mid-q">'+qIdx+' / '+totalQ+'</div>'
      + '<div class="ohud-mid-round">'+(c.mode==='rounds'?'ROUND '+((data.roundIdx||0)+1):'DUEL')+'</div>'
    + '</div>'
    + themHtml;
}

function renderOnlineQuestion(q){
  if (window._onlineTimerInt) {
    clearTimeout(window._onlineTimerInt);
    window._onlineTimerInt = null;
  }
  var area=document.getElementById('online-question-area');
  if(!area) return;
  var obj=q.obj;
  var tbar=document.querySelector('#online-game-panel .tbar');
  if(tbar){ tbar.style.transition='none'; tbar.style.width='100%'; tbar.style.background='var(--acc)'; }

  var m = obj.t;
  var mi = MECH_INFO[m] || MECH_INFO.qcm;
  window._curOnlineQ = obj;
  area.innerHTML = '';

  // Pill row (type de mécanique)
  var pillRow = document.createElement('div');
  pillRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:8px;max-width:1040px;margin-left:auto;margin-right:auto;';
  var pill = document.createElement('div');
  pill.className = 'mech-pill ' + mi.cls;
  pill.textContent = mi.label;
  pillRow.appendChild(pill);
  if(obj.d){
    var diffPill = document.createElement('span');
    diffPill.className = 'qdiff';
    diffPill.textContent = DS[obj.d] || '';
    pillRow.appendChild(diffPill);
  }
  area.appendChild(pillRow);

  // Question card (même DA que quiz solo)
  var card = document.createElement('div');
  card.className = 'qcard online-qcard';
  var qtxt = document.createElement('div');
  qtxt.className = 'qtext';
  qtxt.innerHTML = safeQuestionHtml(obj.q) + (q.cat ? '<span class="qcat-tag">[' + escapeUserHtml(q.cat) + ']</span>' : '');
  card.appendChild(qtxt);
  area.appendChild(card);

  // Afficher le code pour fill/debug si présent
  if ((m === 'fill' || m === 'debug') && obj.code) {
    var pre = document.createElement('pre');
    pre.className = m === 'debug' ? 'debug-code' : 'fill-code';
    var escHtmlOnline = function(s){return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');};
    if (m === 'fill' && obj.blank) {
      var safeCode = escHtmlOnline(obj.code);
      var safeBlank = escHtmlOnline(obj.blank);
      pre.innerHTML = safeCode.replace(safeBlank, '<span class="fill-blank" style="background:var(--primary);color:#000;padding:0 4px;border-radius:4px;">'+safeBlank+'</span>');
    } else {
      pre.textContent = obj.code;
    }
    area.appendChild(pre);
  }

  // Options — mêmes classes que quiz solo
  // Format: obj.opts = tableau de toutes les options, obj.a = INDEX de la bonne réponse
  if(m === 'qcm' || m === 'debug'){
    var o = obj.opts ? obj.opts.slice() : [obj.a].concat(obj.w || []);
    shuffle(o);
    window._curOnlineOpts = o;
    var wrap = document.createElement('div');
    wrap.className = 'opts';
    wrap.id = 'online-opts';
    ['A','B','C','D'].forEach(function(k, i){
      if(o[i] === undefined || o[i] === null) return;
      var b = document.createElement('button');
      b.className = 'opt';
      b.id = 'oopt' + i;
      b.innerHTML = '<span class="okey">' + k + '</span><span>' + safeQuestionHtml(String(o[i])) + '</span>';
      b.onclick = (function(idx){ return function(){ onlineAnswer(idx); }; })(i);
      wrap.appendChild(b);
    });
    area.appendChild(wrap);

  } else if(m === 'tf'){
    window._curOnlineOpts = ['Vrai','Faux'];
    var tfRow = document.createElement('div');
    tfRow.className = 'tf-row';
    tfRow.id = 'online-opts';
    var bT = document.createElement('button');
    bT.className = 'tf-btn tf-true'; bT.id = 'oopt0';
    bT.innerHTML = '✅<span class="tf-lbl">VRAI</span>';
    bT.onclick = function(){ onlineAnswer(0); };
    var bF = document.createElement('button');
    bF.className = 'tf-btn tf-false'; bF.id = 'oopt1';
    bF.innerHTML = '❌<span class="tf-lbl">FAUX</span>';
    bF.onclick = function(){ onlineAnswer(1); };
    tfRow.appendChild(bT); tfRow.appendChild(bF);
    area.appendChild(tfRow);

  } else if(m === 'fill' || m === 'calc' || m === 'type'){
    // Fill/calc with chips if opts available, else text input (always text input for type)
    var hasOpts = (m !== 'type') && (
      (m === 'calc' && obj.opts && obj.opts.length > 0) || 
      (m === 'fill' && obj.opts && obj.opts.length > 0)
    );
    if(hasOpts){
      var fillOpts = document.createElement('div');
      fillOpts.className = (m === 'fill') ? 'fill-opts' : 'calc-opts';
      fillOpts.id = 'online-opts';
      var optList = obj.opts.map(function(o, i){ return {v:o, i:i}; });
      shuffle(optList);
      window._curOnlineOpts = optList;
      optList.forEach(function(opt, i){
        var b = document.createElement('button');
        b.className = (m === 'fill') ? 'fill-opt' : 'calc-opt';
        b.id = 'oopt' + i;
        b.textContent = (typeof opt.v === 'object') ? String(opt.v.v||opt.v) : String(opt.v);
        b.setAttribute('data-idx', opt.i);
        b.onclick = (function(idx){ return function(){ onlineAnswer('chip_'+idx); }; })(opt.i);
        fillOpts.appendChild(b);
      });
      area.appendChild(fillOpts);
    } else {
      var inpWrap = document.createElement('div');
      inpWrap.id = 'online-opts';
      var inp = document.createElement('input');
      inp.type = 'text';
      inp.id = 'oopt-input';
      inp.className = 'fill-code';
      inp.placeholder = 'Réponse...';
      inp.style.cssText = 'width:100%;padding:14px;border-radius:8px;border:1.5px solid var(--border2);background:var(--bg2);color:var(--text);font-size:1.1rem;text-align:center;font-weight:bold;margin-bottom:10px;outline:none;box-sizing:border-box;';
      inp.onkeydown = function(e){ if(e.key==='Enter') onlineAnswer('input'); };
      var vbtn = document.createElement('button');
      vbtn.className = 'validate-btn';
      vbtn.textContent = '✓ VALIDER';
      vbtn.onclick = function(){ onlineAnswer('input'); };
      inpWrap.appendChild(inp);
      inpWrap.appendChild(vbtn);
      area.appendChild(inpWrap);
    }

  } else if (['match', 'order', 'word', 'slider', 'scramble', 'multiblank', 'categorize', 'hotspot'].indexOf(m) > -1) {
    // Rendu en utilisant la mécanique du mode solo
    window.answered = false;
    var container = document.createElement('div');
    container.id = 'online-opts';
    area.appendChild(container);
    switch(m){
      case 'order':      renderOrder(obj, container); break;
      case 'word':       renderWord(obj, container); break;
      case 'match':      renderMatch(obj, container); break;
      case 'slider':     renderSlider(obj, container); break;
      case 'scramble':   renderScramble(obj, container); break;
      case 'multiblank': renderMultiblank(obj, container); break;
      case 'categorize': renderCategorize(obj, container); break;
      case 'hotspot':    renderHotspot(obj, container); break;
    }
  } else {
    // Fallback: QCM-style with opts
    var fallbackOpts = [obj.a].concat(obj.w || []);
    shuffle(fallbackOpts);
    window._curOnlineOpts = fallbackOpts;
    var fwrap = document.createElement('div');
    fwrap.className = 'opts';
    fwrap.id = 'online-opts';
    ['A','B','C','D'].forEach(function(k, i){
      if(!fallbackOpts[i]) return;
      var b = document.createElement('button');
      b.className = 'opt';
      b.id = 'oopt' + i;
      b.innerHTML = '<span class="okey">' + k + '</span><span>' + safeQuestionHtml(String(fallbackOpts[i])) + '</span>';
      b.onclick = (function(idx){ return function(){ onlineAnswer(idx); }; })(i);
      fwrap.appendChild(b);
    });
    area.appendChild(fwrap);
  }

  // Skip button
  var skipBtn = document.createElement('button');
  skipBtn.className = 'skip-btn';
  skipBtn.textContent = '⏭ PASSER';
  skipBtn.style.cssText = 'display:block;margin:15px auto 0;background:none;border:1.5px solid var(--border2);color:var(--text2);font-family:var(--font-title);font-size:0.8rem;padding:8px 16px;border-radius:20px;cursor:pointer;transition:all 0.2s;';
  skipBtn.onclick = function(){
    if(!onlineSession.myAnswered && !onlineSession.revealing){
      onlineAnswer('__skip__');
    }
  };
  area.appendChild(skipBtn);

  // Waiting feedback placeholder
  var feedWait = document.createElement('div');
  feedWait.id = 'online-feedback';
  feedWait.className = 'online-feedback';
  area.appendChild(feedWait);

  // feedback row (like/dislike/report)
  var fRow = document.createElement('div');
  fRow.className = 'q-feedback-row';
  fRow.innerHTML = `
    <button class="q-f-btn bug" onclick="reportBug(window._curOnlineQ)" title="Signaler un problème">⚠️ Bug</button>
    <div class="q-f-votes">
      <button class="q-f-btn vote" onclick="voteQ(window._curOnlineQ, 1)" title="Utile">👍</button>
      <button class="q-f-btn vote" onclick="voteQ(window._curOnlineQ, -1)" title="Pas utile">👎</button>
    </div>
  `;
  area.appendChild(fRow);

  // Timer pausable (setInterval vérifie isPaused chaque 100ms)
  setTimeout(function(){
    var timer = getQTimer(obj, 20);
    var totalMs = timer * 1000;
    var elapsedMs = 0;
    var forceElapsedMs = 0;
    var forceTotalMs = (timer + 3) * 1000;
    var TICK = 100;

    // Barre visuelle : mise à jour manuelle chaque tick
    if(tbar){ tbar.style.transition = 'none'; tbar.style.width = '100%'; tbar.style.background = 'var(--acc)'; }

    if(window._onlineTimerInt) { clearInterval(window._onlineTimerInt); window._onlineTimerInt = null; }
    if(window._onlineForceRevealInt) { clearInterval(window._onlineForceRevealInt); window._onlineForceRevealInt = null; }

    window._onlineTimerInt = setInterval(function(){
      if(onlineSession.isPaused) return; // ⏸ Ne pas avancer si en pause
      elapsedMs += TICK;
      var pct = Math.max(0, 100 - (elapsedMs / totalMs * 100));
      if(tbar){ tbar.style.transition = 'none'; tbar.style.width = pct + '%'; }
      if(elapsedMs >= totalMs + 500){
        clearInterval(window._onlineTimerInt); window._onlineTimerInt = null;
        if(!onlineSession.myAnswered && !onlineSession.revealing){
          onlineAnswer('__timeout__');
        }
      }
    }, TICK);

    // Hôte : force reveal après timer+3s (ne compte pas pendant la pause)
    if(onlineSession.role === 'host'){
      window._onlineForceRevealInt = setInterval(function(){
        if(onlineSession.isPaused) return;
        forceElapsedMs += TICK;
        if(forceElapsedMs >= forceTotalMs){
          clearInterval(window._onlineForceRevealInt); window._onlineForceRevealInt = null;
          if(!onlineSession.revealing){ _onlineUpdate({ reveal: true }); }
        }
      }, TICK);
    }
  }, 50);
}

window.onlineAnswer = function(val){
  if(onlineSession.myAnswered || onlineSession.revealing) return;
  onlineSession.myAnswered=true;

  if (window._onlineTimerInt) {
    clearInterval(window._onlineTimerInt);
    window._onlineTimerInt = null;
  }
  if (window._onlineForceRevealInt) {
    clearInterval(window._onlineForceRevealInt);
    window._onlineForceRevealInt = null;
  }

  var skip = document.querySelector('.skip-btn');
  if (skip) skip.style.display = 'none';

  var obj = window._curOnlineQ;
  var ansText = '';
  var isCorrect = false;
  
  var valIsBool = (typeof val === 'boolean');
  var isTimeout = (val === '__timeout__');
  var isSkip = (val === '__skip__');

  if (isTimeout || isSkip) {
    isCorrect = false;
    ansText = isTimeout ? 'Temps écoulé' : 'Passé';
    
    // Disable inputs
    var allOpts = document.querySelectorAll('#online-opts .opt, #online-opts button, #online-opts input');
    allOpts.forEach(function(btn){ btn.disabled = true; });
    var inp = document.getElementById('oopt-input');
    if (inp) inp.disabled = true;

  } else if (valIsBool) {
    isCorrect = val;
    ansText = val ? 'Correct' : 'Incorrect';

  } else if(obj.t === 'qcm' || obj.t === 'debug'){
    var o = window._curOnlineOpts;
    ansText = typeof val === 'number' ? String(o[val]) : '';
    // Mark selected button visually
    var b = document.getElementById('oopt'+val);
    if(b) b.classList.add('chosen');
    // Disable all opts immediately (show pending state)
    var allOpts = document.querySelectorAll('#online-opts .opt');
    allOpts.forEach(function(btn){ btn.disabled = true; });

  } else if(obj.t === 'tf'){
    var o2 = window._curOnlineOpts;
    ansText = typeof val === 'number' ? String(o2[val]) : '';
    var b2 = document.getElementById('oopt'+val);
    if(b2) { b2.style.borderColor = 'var(--acc)'; b2.style.boxShadow = '0 0 0 2px var(--acc)'; }
    var b0 = document.getElementById('oopt0'); if(b0) b0.disabled=true;
    var b1 = document.getElementById('oopt1'); if(b1) b1.disabled=true;

  } else if(typeof val === 'string' && val.startsWith('chip_')){
    var chipIdx = parseInt(val.replace('chip_',''));
    // Find which chip has data-idx matching chipIdx
    var chips = document.querySelectorAll('#online-opts [data-idx]');
    chips.forEach(function(c){ c.disabled=true; if(+c.getAttribute('data-idx')===chipIdx) c.style.borderColor='var(--acc)'; });
    // Resolve text: find the entry
    var entry = (window._curOnlineOpts||[]).find(function(e){ return e.i===chipIdx; });
    ansText = entry ? String(entry.v && entry.v.v !== undefined ? entry.v.v : entry.v) : '';

  } else {
    var inp = document.getElementById('oopt-input');
    ansText = inp ? inp.value.trim() : '';
  }

  var elapsed = (Date.now() - onlineSession.qStartTs)/1000;
  var maxT = getQTimer(obj,20);
  
  var isCorrect = false;
  var valIsBool = (typeof val === 'boolean');
  if (valIsBool) {
    isCorrect = val;
    ansText = val ? 'Correct' : 'Incorrect';
  } else if(obj.t==='tf'){
    var correctIsVrai = (obj.a === true || obj.a === 'true' || obj.a === 'Vrai' || obj.a === 'VRAI');
    isCorrect = (ansText === 'Vrai') === correctIsVrai;
  } else if (obj.t === 'type') {
    // Saisie libre (type) : comparaison insensible aux accents/majuscules/ponctuation
    var accepted = [];
    if (Array.isArray(obj.a)) {
      accepted = obj.a.map(String);
    } else if (obj.a !== undefined && obj.a !== null) {
      accepted = [String(obj.a)];
    }
    if (obj.aliases && Array.isArray(obj.aliases)) {
      accepted = accepted.concat(obj.aliases.map(String));
    }
    var safeNormalizeStr = function(s) {
      if (typeof normalizeStr === 'function') return normalizeStr(s);
      return String(s).toLowerCase().trim();
    };
    var nVal = safeNormalizeStr(ansText);
    isCorrect = accepted.some(function(a){ return safeNormalizeStr(a) === nVal; });
    } else if (!valIsBool) {
      // Pour qcm/debug/fill/calc : obj.a est un INDEX dans obj.opts quand obj.opts existe
      var rawCorrect = (obj.opts && obj.a !== undefined && obj.opts[obj.a] !== undefined)
        ? obj.opts[obj.a]
        : obj.a;
      // calc: opts entries are objects {v: value} — extract .v
      var correctTxt = (rawCorrect !== null && typeof rawCorrect === 'object' && rawCorrect.v !== undefined)
        ? String(rawCorrect.v)
        : String(rawCorrect);

      if(obj.t === 'qcm' || obj.t === 'debug'){
        isCorrect = (ansText === correctTxt);
      } else {
        // fill/calc : case-insensitive
        var altAnswers = [correctTxt.toLowerCase()];
        if(obj.w && obj.w.length) obj.w.forEach(function(s){ altAnswers.push(String(s).toLowerCase()); });
        isCorrect = altAnswers.indexOf(ansText.toLowerCase()) > -1;
      }
    }

  var pts = 0;
  if(isCorrect){
    pts = 100;
    if(onlineSession.config.speedBonus){
      var timeBonus = Math.max(0, maxT - elapsed);
      pts += Math.floor((timeBonus/maxT)*50); // jusqu'à +50
    }
  }

  var upd = {};
  upd['players.'+window._fbUser.uid+'.answer'] = {
    txt: ansText,
    ok: isCorrect,
    pts: pts
  };
  _onlineUpdate(upd);
}

function revealOnlineQuestion(data){
  if (window._onlineTimerInt) {
    clearTimeout(window._onlineTimerInt);
    window._onlineTimerInt = null;
  }
  if (window._onlineForceRevealInt) {
    clearTimeout(window._onlineForceRevealInt);
    window._onlineForceRevealInt = null;
  }
  
  var skip = document.querySelector('.skip-btn');
  if (skip) skip.style.display = 'none';

  var tbar = document.querySelector('#online-game-panel .tbar');
  if(tbar){ tbar.style.transition='none'; tbar.style.width='0%'; }

  var obj = data.currentQ ? data.currentQ.obj : window._curOnlineQ;
  if(!obj) return;
  var players = Object.values(data.players);
  var myUid = window._fbUser ? window._fbUser.uid : null;
  var mePlayer = players.find(function(p){ return p.uid === myUid; });
  var myOk = mePlayer && mePlayer.answer ? mePlayer.answer.ok : false;

  // ── Reveal options with standard .ok / .err classes ──
  if(obj.t === 'qcm' || obj.t === 'debug'){
    var correctRevealTxt = (obj.opts && obj.a !== undefined && obj.opts[obj.a] !== undefined)
      ? String(obj.opts[obj.a]) : String(obj.a);
    var opts = document.querySelectorAll('#online-opts .opt');
    opts.forEach(function(b){
      b.disabled = true;
      // Get the text from the <span> (second child, not okey span)
      var spans = b.querySelectorAll('span');
      var txt = spans.length > 1 ? spans[1].textContent : b.textContent;
      var isGood = (txt === correctRevealTxt);
      if(isGood){ b.classList.remove('err'); b.classList.add('ok'); }
      else if(b.classList.contains('chosen')){ b.classList.add('err'); }
      else { b.style.opacity = '0.45'; }

      // Badge with players who chose this option
      players.forEach(function(p){
        if(p.answer && String(p.answer.txt) === txt){
          var badge = document.createElement('span');
          badge.textContent = p.pseudo;
          badge.style.cssText = 'display:inline-block;font-size:9px;font-family:monospace;background:var(--bg2);border:1px solid var(--border2);border-radius:6px;padding:1px 6px;margin-left:6px;color:var(--text2);';
          b.appendChild(badge);
        }
      });
    });

  } else if(obj.t === 'tf'){
    var b0r = document.getElementById('oopt0');
    var b1r = document.getElementById('oopt1');
    var correctIsVrai = (obj.a === true || obj.a === 'true' || obj.a === 'Vrai' || obj.a === 'VRAI');
    if(b0r){ b0r.disabled=true; b0r.classList.add(correctIsVrai ? 'ok' : 'err'); if(!correctIsVrai) b0r.style.opacity='0.5'; }
    if(b1r){ b1r.disabled=true; b1r.classList.add(!correctIsVrai ? 'ok' : 'err'); if(correctIsVrai) b1r.style.opacity='0.5'; }

  } else {
    // Text/chip answer — highlight correct
    var chips = document.querySelectorAll('#online-opts [data-idx]');
    if(chips.length){
      chips.forEach(function(c){
        c.disabled = true;
        var cIdx = +c.getAttribute('data-idx');
        if(cIdx === obj.a){ c.classList.add('ok'); }
        else if(c.style.borderColor.indexOf('acc') > -1 || c.classList.contains('chosen')){ c.classList.add('err'); }
        else { c.style.opacity = '0.45'; }
      });
    }
  }

  // ── Result feedback box (same style as ofeed) ──
  var feedEl = document.getElementById('online-feedback');
  if(!feedEl){
    feedEl = document.createElement('div');
    feedEl.id = 'online-feedback';
    feedEl.className = 'online-feedback';
    var area2 = document.getElementById('online-question-area');
    if(area2) area2.appendChild(feedEl);
  }
  var resultLabel = myOk ? '✅ Bonne réponse !' : '❌ Raté !';
  var resultColor = myOk ? '#00a85a' : '#dc2626';
  var scoresHtml = players.map(function(p){
    var pts = p.answer ? (p.answer.pts||0) : 0;
    var okIcon = p.answer && p.answer.ok ? '✓' : '✗';
    var col = p.answer && p.answer.ok ? '#00a85a' : '#dc2626';
    return '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px;color:var(--text);">'
      + '<span><span style="color:'+col+';font-weight:700;">'+okIcon+'</span> '+escapeUserHtml(p.pseudo)+'</span>'
      + '<span style="color:'+col+';font-weight:700;">+'+pts+' pts</span>'
      + '</div>';
  }).join('');

  var expectedHtml = '';
  if (!myOk) {
    var expectedVal = '';
    if (obj.t === 'tf') {
      var correctIsVrai = (obj.a === true || obj.a === 'true' || obj.a === 'Vrai' || obj.a === 'VRAI');
      expectedVal = correctIsVrai ? 'Vrai' : 'Faux';
    } else if (obj.t === 'qcm' || obj.t === 'debug') {
      expectedVal = (obj.opts && obj.a !== undefined && obj.opts[obj.a] !== undefined)
        ? String(obj.opts[obj.a]) : String(obj.a);
    } else if (obj.t === 'type') {
      var correctAns = Array.isArray(obj.a) ? obj.a[0] : obj.a;
      expectedVal = String(correctAns);
    } else if (obj.t === 'calc') {
      var rawCorrect = (obj.opts && obj.a !== undefined && obj.opts[obj.a] !== undefined)
        ? obj.opts[obj.a] : obj.a;
      expectedVal = (rawCorrect !== null && typeof rawCorrect === 'object' && rawCorrect.v !== undefined)
        ? String(rawCorrect.v) : String(rawCorrect);
    } else if (obj.t === 'order') {
      expectedVal = Array.isArray(obj.items) ? obj.items.join(' ➔ ') : String(obj.a);
    } else if (obj.t === 'scramble') {
      expectedVal = String(obj.word || obj.a);
    } else if (obj.t === 'match') {
      expectedVal = Array.isArray(obj.pairs) ? obj.pairs.map(function(p){ return p.l + ' = ' + p.r; }).join(', ') : String(obj.a);
    } else if (obj.t === 'word') {
      expectedVal = Array.isArray(obj.correct) ? obj.correct.join(', ') : String(obj.a);
    } else if (obj.t === 'categorize') {
      expectedVal = Array.isArray(obj.items) ? obj.items.map(function(it){ return it.name + ' (' + it.cat + ')'; }).join(', ') : String(obj.a);
    } else {
      var rawCorrect = (obj.opts && obj.a !== undefined && obj.opts[obj.a] !== undefined)
        ? obj.opts[obj.a] : obj.a;
      expectedVal = String(rawCorrect);
    }
    expectedHtml = '<div style="margin-top:8px;font-size:14px;color:var(--text2);text-align:center;">✓ Réponse attendue : <strong style="color:var(--primary);">' + escapeUserHtml(expectedVal) + '</strong></div>';
  }

  feedEl.innerHTML =
    '<div class="ofeed-result" style="color:'+resultColor+';border-color:'+resultColor+';">'+resultLabel+'</div>'
    + expectedHtml
    + (obj.x ? '<div class="ofeed-exp">'+safeQuestionHtml(obj.x)+'</div>' : '')
    + '<div style="margin-top:12px;background:var(--panel);border:1.5px solid var(--border);border-radius:10px;padding:10px 14px;">'
      + scoresHtml
    + '</div>';
}

function hostAdvance(data){
  if(onlineSession.role!=='host')return;
  var upd = {};
  var players = Object.values(data.players);

  players.forEach(function(p){
    var pts = (p.answer && p.answer.pts) ? p.answer.pts : 0;
    upd['players.'+p.uid+'.score'] = (p.score||0) + pts;
    upd['players.'+p.uid+'.answer'] = null;
  });

  var c = data.config;
  if(c.mode==='course'){
    var winner = players.find(function(p){ return (p.score + ((p.answer&&p.answer.pts)?p.answer.pts:0)) >= (c.target*100); });
    if(winner) { upd.status='finished'; _onlineUpdate(upd); return; }
  }

  // Helper: build a safe, serializable question object
  function makeSafeQ(entry){
    var raw = entry.q;
    var safe = {
      q: raw.q || '',
      a: raw.a !== undefined ? raw.a : 0,
      w: raw.w || [],
      t: raw.t || 'qcm',
      d: raw.d !== undefined ? raw.d : 1,
      idx: raw.idx !== undefined ? raw.idx : 0,
      x: raw.x || '',
      opts: raw.opts || null
    };
    if (raw.aliases) safe.aliases = raw.aliases;
    var extraFields = [
      'items', 'pairs', 'words', 'correct',
      'min', 'max', 'step', 'unit', 'tolerance',
      'word', 'hint', 'code', 'blank',
      'blanks', 'text', 'categories', 'image', 'zones', 'setup'
    ];
    extraFields.forEach(function(f){
      if(raw[f] !== undefined) safe[f] = raw[f];
    });
    return safe;
  }

  var nIdx = (data.qIdx||0) + 1;
  var pool = onlineSession.questionsPool;

  if(c.mode==='qbq'){
    if(nIdx >= c.qPerRound || nIdx >= pool.length) {
      upd.status='finished';
    } else {
      upd.qIdx = nIdx;
      upd.currentQ = {
        cat: pool[nIdx].c || 'mix',
        idx: pool[nIdx].q.idx !== undefined ? pool[nIdx].q.idx : 0,
        obj: makeSafeQ(pool[nIdx])
      };
      upd.reveal = false;
    }
  } else if(c.mode==='rounds') {
    if(nIdx % c.qPerRound === 0){
      var nRound = (data.roundIdx||0) + 1;
      if(nRound >= c.totalRounds) { upd.status='finished'; }
      else { upd.status='round_end'; upd.roundIdx=nRound; upd.qIdx=nIdx; }
    } else if(nIdx >= pool.length) {
      upd.status='finished';
    } else {
      upd.qIdx = nIdx;
      upd.currentQ = {
        cat: pool[nIdx].c || 'mix',
        idx: pool[nIdx].q.idx !== undefined ? pool[nIdx].q.idx : 0,
        obj: makeSafeQ(pool[nIdx])
      };
      upd.reveal = false;
    }
  } else if(c.mode==='course') {
    if(nIdx >= pool.length) {
      upd.status = 'finished';
    } else {
      upd.qIdx = nIdx;
      upd.currentQ = {
        cat: pool[nIdx].c || 'mix',
        idx: pool[nIdx].q.idx !== undefined ? pool[nIdx].q.idx : 0,
        obj: makeSafeQ(pool[nIdx])
      };
      upd.reveal = false;
    }
  }

  _onlineUpdate(upd);
}

function buildOnlineFinish(data){
  var area=document.getElementById('online-finish-area');
  if(!area)return;
  var players = Object.values(data.players).sort(function(a,b){return b.score - a.score;});
  var html='<div style="text-align:center;font-size:2rem;font-weight:900;color:var(--primary);margin-bottom:30px;font-family:var(--font-title);letter-spacing:1px;text-transform:uppercase;">CLASSEMENT</div>';
  
  html+='<div style="display:flex;flex-direction:column;gap:12px;">';
  players.forEach(function(p, idx){
    var bg = idx===0 ? 'background:linear-gradient(135deg, rgba(255,184,0,0.2) 0%, rgba(255,140,0,0.1) 100%);border:1px solid var(--primary);' : 'background:var(--bg3);border:1px solid var(--border2);';
    var medal = idx===0 ? '🏆' : (idx===1 ? '🥈' : (idx===2 ? '🥉' : (idx+1)+'ème'));
    
    html+='<div style="display:flex;align-items:center;justify-content:space-between;padding:15px;border-radius:12px;'+bg+'">'
        + '<div style="display:flex;align-items:center;gap:15px;">'
        + '<div style="font-size:1.5rem;width:30px;text-align:center;">'+medal+'</div>'
        + '<div style="font-size:1.2rem;font-weight:bold;color:var(--text);">'+p.pseudo+'</div>'
        + '</div>'
        + '<div style="font-size:1.5rem;font-weight:900;color:var(--primary);">'+p.score+' <span style="font-size:0.8rem;color:var(--text2);font-weight:normal;">pts</span></div>'
        + '</div>';
  });
  html+='</div>';

  html+='<button class="online-cta-create" style="margin-top:40px;" onclick="cancelOnlineSession()">RETOUR AU MENU</button>';
  area.innerHTML=html;
}

function showOnlineError(msg){
  var e=document.getElementById('online-error-area');
  if(e){ e.textContent=msg; e.style.display='block'; setTimeout(function(){e.style.display='none';},4000); }
}
// Adapter wizLaunch pour le mode online
var _origWizLaunch=typeof wizLaunch==='function'?wizLaunch:null;

function startGame(){
  if(selMode==='flash'){startFlash();return;}
  if(selMode==='duel'){showScreen('duel-setup');return;}
  if(selMode==='discussion'){showScreen('discussion');return;}
  if(selMode==='rpg'){startRPGNarrative();return;}
  if(selMode==='online_duel'){
    var ovl=document.getElementById('launch-ovl');if(ovl)ovl.classList.remove('open');
    showScreen('online-duel');
    return;
  }
  if(selMode==='chaos'){startChaosMode();return;}
  updateStreak();
  if(selCat==='_multi'){return;} // pool already built by wizLaunch
  var cat=CATS[selCat]||CATS['mix'],cfg=MODES[selMode]||MODES['chill'];
  lives=cfg.lives===99?99:cfg.lives;
  correct=0;combo=1;maxCombo=1;errors=[];idx=0;paused=false;
  bonusStreak=0;isBonus=false;qTimes=[];rpgPoints=0;betOn=false;
  jokers=3;
  sStats={cat:selCat,mode:selMode,maxCombo:0,mechs:new Set(),streak:streakD.current};

  var pool;
  if(selMode==='erreurs'&&reviewBank.length>0){
    pool=reviewBank;
  } else {
    pool=selDiff==='all'?cat.qs:cat.qs.filter(function(q){return q.d===parseInt(selDiff);});
    if(pool.length===0)pool=cat.qs;
  }
  var count=selMode==='exam'?20:selMode==='marathon'?99999:Math.min(selQCount,9999);
  // Use freshShuffle to avoid showing same questions repeatedly
  var mixed=freshShuffle(pool);
  session=mixed.slice(0,Math.min(count,pool.length));
  markShown(session);

  applyBody();
  el('gbadge').textContent=cat.label.toUpperCase()+' · '+selMode.toUpperCase();
  // Chrono mode: 3-minute global countdown
  if(selMode==='chrono'){
    var cd=document.getElementById('chrono-display');
    if(cd) cd.style.display='block';
    var chronoLeft=180;
    var chronoInt=setInterval(function(){
      chronoLeft--;
      var m=Math.floor(chronoLeft/60), s=chronoLeft%60;
      var cd2=document.getElementById('chrono-display');
      if(cd2) cd2.textContent=m+':'+(s<10?'0':'')+s;
      if(chronoLeft<=30&&cd2) cd2.style.color='#dc2626';
      if(chronoLeft<=0){clearInterval(chronoInt);showResults();}
    },1000);
    // Store so we can clear it
    window._chronoInt=chronoInt;
  } else {
    var cd3=document.getElementById('chrono-display');
    if(cd3) cd3.style.display='none';
    if(window._chronoInt) clearInterval(window._chronoInt);
  }
  var shud=el('score-hud'); if(shud) shud.style.display=(selMode==='duel'||selMode==='flash'||selMode==='discussion')?'none':'grid';
  var srHud=document.getElementById('speedrun-hud'); if(srHud) srHud.style.display=selMode==='speedrun'?'flex':'none';
  var bossWrap=document.getElementById('boss-bar-wrap'); if(bossWrap) bossWrap.style.display=selMode==='boss'?'block':'none';
  if(selMode==='speedrun'){var srRec=document.getElementById('sr-record');var srB=lsGet('tssr5_sr_best',{});if(srRec)srRec.textContent=srB[selCat]?'Best: '+srB[selCat].toFixed(1)+'s':'';}
  dynDiffStreak=0;dynDiffLevel=0;
  el('hrecord').textContent=(hsD[selCat]||0)+'/'+count;
  el('htotal').textContent=session.length;
  // jokers
  el('jokers-row').style.display=jokersEnabled&&(selMode==='qcm'||true)?'flex':'none';
  el('jcount').textContent=jokers;
  el('joker-btn').disabled=false;
  // exam mode class
  var gameDiv=el('screen-game');
  if(selMode==='exam')gameDiv.classList.add('exam-mode');
  else gameDiv.classList.remove('exam-mode');
  // pause btn hide for blitz
  el('pause-btn').style.display=selMode==='blitz'?'none':'block';

  buildDots();showScreen('game');showQ();
}

function startReview(){
  selMode='erreurs';
  document.querySelectorAll('.mcard').forEach(function(x){x.classList.remove('sel');if(x.getAttribute('data-mode')==='erreurs')x.classList.add('sel');});
  startGame();
}

function buildDots(){
  var c=el('pdots');c.innerHTML='';
  for(var i=0;i<session.length;i++){var d=document.createElement('div');d.className='pdot'+(i===0?' dcur':'');d.id='dot'+i;c.appendChild(d);}
}
function updDot(i,s){var d=el('dot'+i);if(d){d.className='pdot '+s;}}
function updScore(){el('hcorrect').textContent=correct;el('hprog').textContent=(idx+1)+'/'+session.length;
  if(selMode==='boss') updateBossBar();
}

// ====== JOKER ======
function useJoker(){
  if(jokers<=0||answered)return;
  var q=session[idx];
  if(q.t!=='qcm'&&q.t!=='debug')return;
  jokers--;el('jcount').textContent=jokers;
  if(jokers===0){el('joker-btn').disabled=true;}
  // Eliminate 2 wrong answers
  var btns=Array.from(document.querySelectorAll('.opt:not(:disabled)'));
  var wrong=btns.filter(function(b){return +b.getAttribute('data-orig')!==q.a;});
  var toElim=shuffle(wrong).slice(0,2);
  toElim.forEach(function(b){b.classList.add('elim');b.disabled=true;});
}

// ====== SHOW Q ======
function showQ(){
  answered=false;orderItems=[];
  startQTimer();
  if(selMode==='speedrun'&&idx===0) initSpeedrun();
  if(selMode!=='exam'&&selMode!=='duel'){
    maybeFireEvent();
    maybeChaos();
    maybeShowBet();
  }
  var cfg=MODES[selMode],q=session[idx];
  var mi=MECH_INFO[q.t]||MECH_INFO.qcm;
  sStats.mechs.add(q.t);

  // bonus check — every 5 consecutive correct
  isBonus=(bonusStreak>0&&bonusStreak%5===0);
  if(isBonus)playBonus();

  el('fbk').className='fbk';el('nextbtn').className='next-btn';
  el('hint-txt').textContent=mi.hint;
  updScore();
  updLives();
  updDot(idx,'pdot dcur');

  var area=el('question-area');area.innerHTML='';

  // pill row
  var pillRow=document.createElement('div');pillRow.style.cssText='display:flex;align-items:center;gap:8px;margin-bottom:8px;';
  var pill=document.createElement('div');pill.className='mech-pill '+mi.cls;pill.textContent=mi.label;
  pillRow.appendChild(pill);
  if(isBonus){var bb=document.createElement('div');bb.className='bonus-badge';bb.textContent='⭐ BONUS QUESTION';pillRow.appendChild(bb);}
  area.appendChild(pillRow);

  // card
  var card=document.createElement('div');card.className='qcard'+(isBonus?' bonus-card':'');card.id='qcard';
  var qdiff=document.createElement('span');qdiff.className='qdiff';qdiff.textContent=DS[q.d]||'';
  var qnum=document.createElement('div');qnum.className='qnum';
  var srsHtml=getSRSLabel(q);
  qnum.innerHTML='Question '+(idx+1)+(isBonus?' ★':'')+'  '+srsHtml;
  var qtxt=document.createElement('div');qtxt.className='qtext';qtxt.innerHTML=safeQuestionHtml(q.q)+(q._cat?'<span class="qcat-tag">['+escapeUserHtml(q._cat)+']</span>':'');
  card.appendChild(qdiff);card.appendChild(qnum);card.appendChild(qtxt);
  area.appendChild(card);

  // render mechanic
  // Mode inversé — on remplace le rendu normal
  if(selMode==='inverse'&&(q.t==='qcm'||q.t==='debug'||q.t==='fill'||q.t==='tf')){
    renderInverse(q,area);
  } else {
    switch(q.t){
      case 'qcm':    renderQCM(q,area);break;
      case 'tf':     renderTF(q,area);break;
      case 'fill':   renderFill(q,area);break;
      case 'order':  renderOrder(q,area);break;
      case 'calc':   renderCalc(q,area);break;
      case 'debug':  renderDebug(q,area);break;
      case 'word':   renderWord(q,area);break;
      case 'match':  renderMatch(q,area);break;
      case 'type':    renderType(q,area);break;
      case 'slider':  renderSlider(q,area);break;
      case 'scramble': renderScramble(q,area);break;
      case 'multiblank': renderMultiblank(q,area);break;
      case 'categorize': renderCategorize(q,area);break;
      case 'hotspot': renderHotspot(q,area);break;
      default:       renderQCM(q,area);
    }
  }

  // feedback row
  var fRow = document.createElement('div');
  fRow.className = 'q-feedback-row';
  fRow.innerHTML = `
    <button class="q-f-btn bug" onclick="reportBug(session[idx])" title="Signaler un problème">⚠️ Bug</button>
    <div class="q-f-votes">
      <button class="q-f-btn vote" onclick="voteQ(session[idx], 1)" title="Utile">👍</button>
      <button class="q-f-btn vote" onclick="voteQ(session[idx], -1)" title="Pas utile">👎</button>
    </div>
  `;
  area.appendChild(fRow);

  // timer — support _customTimer depuis le launcher quiz
  var _timerBase = (window._customTimer !== undefined && window._customTimer !== null) ? window._customTimer : cfg.timer;
  var _tmaxBase  = (window._customTimer !== undefined && window._customTimer !== null) ? window._customTimer : cfg.tmax;
  clearInterval(timerInt);var tb=el('tbar');
  if(_timerBase===0){tb.style.width='100%';tb.style.background='#00d87a';}
  else{
    var adaptedTimer=(selMode==='chaos'&&window._chaosTimerOverride)?window._chaosTimerOverride:getQTimer(q,_tmaxBase);
    timeLeft=adaptedTimer;tb.style.width='100%';tb.style.background='#00d87a';
    timerInt=setInterval(function(){if(paused)return;timeLeft-=0.1;var p=(timeLeft/adaptedTimer)*100;
      tb.style.width=p+'%';if(p<50)tb.style.background='#ff9800';if(p<20)tb.style.background='#dc2626';
      updateTimerDrama(p,timeLeft);
      if(timeLeft<=0){clearInterval(timerInt);if(!answered)expireQ(q);}},100);}
}

// ====== MECHANICS ======
function renderQCM(q,area){
  var shuffled=shuffle(q.opts.map(function(t,i){return{t:t,i:i};}));
  var wrap=document.createElement('div');wrap.className='opts';
  ['A','B','C','D'].forEach(function(k,i){
    var b=document.createElement('button');b.className='opt';
    var raw=shuffled[i].t;
    var optHtml=(typeof raw==='object'&&raw&&raw.v!==undefined)
      ? safeQuestionHtml(String(raw.v))+(raw.sub?'<span class="calc-sub">'+escapeUserHtml(raw.sub)+'</span>':'')
      : safeQuestionHtml(String(raw));
    b.innerHTML='<span class="okey">'+k+'</span><span>'+optHtml+'</span>';
    b.setAttribute('data-orig',shuffled[i].i);
    b.onclick=function(){if(!answered)resolveQCM(shuffled[i].i,b,q,wrap);};
    wrap.appendChild(b);
  });
  area.appendChild(wrap);
}
function resolveQCM(origIdx,btn,q,wrap){
  clearInterval(timerInt);answered=true;
  wrap.querySelectorAll('.opt').forEach(function(b){b.disabled=true;});
  wrap.querySelectorAll('.opt').forEach(function(b){if(+b.getAttribute('data-orig')===q.a)b.classList.add('ok');});
  var ok=origIdx===q.a;
  btn.classList.add(ok?'ok':'err');
  if(!ok)errors.push({q:q.q,yours:q.opts[origIdx],correct:q.opts[q.a],x:q.x,orig:q,mech:q.t});
  resolveCommon(ok,q);
}

function renderTF(q,area){
  var row=document.createElement('div');row.className='tf-row';
  var bT=document.createElement('button');bT.className='tf-btn tf-true';bT.innerHTML='✅<span class="tf-lbl">VRAI</span>';
  var bF=document.createElement('button');bF.className='tf-btn tf-false';bF.innerHTML='❌<span class="tf-lbl">FAUX</span>';
  bT.onclick=function(){if(!answered)resolveTF(true,q,bT,bF);};
  bF.onclick=function(){if(!answered)resolveTF(false,q,bT,bF);};
  row.appendChild(bT);row.appendChild(bF);area.appendChild(row);
}
function resolveTF(val,q,bT,bF){
  clearInterval(timerInt);answered=true;bT.disabled=true;bF.disabled=true;
  var ok=val===q.a;
  (val?bT:bF).classList.add(ok?'ok':'err');
  if(!ok){(q.a?bT:bF).classList.add('ok');errors.push({q:q.q,yours:val?'VRAI':'FAUX',correct:q.a?'VRAI':'FAUX',x:q.x,orig:q,mech:q.t});}
  resolveCommon(ok,q);
}

function renderFill(q,area){
  var code=document.createElement('pre');code.className='fill-code';
  // Échapper HTML puis injecter le blank
  function escHtml(s){return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
  var safeCode=escHtml(q.code||'');
  var safeBlank=escHtml(q.blank||'___');
  var blankHtml='<span class="fill-blank" id="fill-blank">'+safeBlank+'</span>';
  code.innerHTML=safeCode.replace(safeBlank,blankHtml);
  var opts=document.createElement('div');opts.className='fill-opts';
  var shuffled=shuffle(q.opts.map(function(t,i){return{t:t,i:i};}));
  shuffled.forEach(function(opt){
    var b=document.createElement('button');b.className='fill-opt';b.textContent=opt.t;b.setAttribute('data-orig',opt.i);
    b.onclick=function(){if(!answered)resolveFill(opt.i,opt.t,b,q,opts);};
    opts.appendChild(b);
  });
  area.appendChild(code);area.appendChild(opts);
}
function resolveFill(origIdx,val,btn,q,optsEl){
  clearInterval(timerInt);answered=true;
  optsEl.querySelectorAll('.fill-opt').forEach(function(b){b.disabled=true;});
  optsEl.querySelectorAll('.fill-opt').forEach(function(b){if(+b.getAttribute('data-orig')===q.a)b.classList.add('ok');});
  var ok=origIdx===q.a;btn.classList.add(ok?'ok':'err');
  var blank=document.getElementById('fill-blank');if(blank){blank.textContent=val;blank.classList.add(ok?'ok-fill':'err-fill');}
  if(!ok)errors.push({q:q.q,yours:q.opts[origIdx],correct:q.opts[q.a],x:q.x,orig:q,mech:q.t});
  resolveCommon(ok,q);
}

function renderOrder(q,area){
  orderItems=shuffle(q.items.slice());
  var intro=document.createElement('div');intro.className='order-intro';intro.textContent='Utilise ▲▼ ou glisse-dépose pour réordonner :';
  var list=document.createElement('div');list.className='order-items';list.id='order-list';
  renderOrderList(list,q);
  var vbtn=document.createElement('button');vbtn.className='validate-btn';vbtn.textContent='✓ VALIDER L\'ORDRE';vbtn.onclick=function(){validateOrder(q,list);};
  area.appendChild(intro);area.appendChild(list);area.appendChild(vbtn);
}
function renderOrderList(list,q){
  list.innerHTML='';
  orderItems.forEach(function(item,i){
    var d=document.createElement('div');d.className='order-item';d.setAttribute('data-idx',i);d.setAttribute('draggable','true');
    var num=document.createElement('span');num.className='order-num';num.textContent=(i+1)+'.';
    var txt=document.createElement('span');txt.textContent=item;txt.style.flex='1';
    var arrows=document.createElement('span');arrows.className='order-arrows';
    var up=document.createElement('button');up.className='oarrow';up.textContent='▲';up.type='button';
    var dn=document.createElement('button');dn.className='oarrow';dn.textContent='▼';dn.type='button';
    (function(idx){
      up.onclick=function(e){e.stopPropagation();if(idx>0){var t=orderItems[idx];orderItems[idx]=orderItems[idx-1];orderItems[idx-1]=t;renderOrderList(list,q);}};
      dn.onclick=function(e){e.stopPropagation();if(idx<orderItems.length-1){var t=orderItems[idx];orderItems[idx]=orderItems[idx+1];orderItems[idx+1]=t;renderOrderList(list,q);}};
    })(i);
    arrows.appendChild(up);arrows.appendChild(dn);
    d.appendChild(num);d.appendChild(txt);d.appendChild(arrows);
    d.addEventListener('dragstart',function(){this.classList.add('dragging');});
    d.addEventListener('dragend',function(){this.classList.remove('dragging');list.querySelectorAll('.order-item').forEach(function(x){x.classList.remove('over');});});
    d.addEventListener('dragover',function(e){e.preventDefault();list.querySelectorAll('.order-item').forEach(function(x){x.classList.remove('over');});this.classList.add('over');});
    d.addEventListener('drop',function(e){e.preventDefault();this.classList.remove('over');
      var from=parseInt(document.querySelector('.order-item.dragging').getAttribute('data-idx'));
      var to=parseInt(this.getAttribute('data-idx'));
      if(from!==to){var t=orderItems[from];orderItems[from]=orderItems[to];orderItems[to]=t;renderOrderList(list,q);}});
    list.appendChild(d);
  });
}
function validateOrder(q,list){
  if(answered)return;answered=true;clearInterval(timerInt);
  var ok=JSON.stringify(orderItems)===JSON.stringify(q.items);
  list.querySelectorAll('.order-item').forEach(function(d,i){
    d.style.cursor='default';d.setAttribute('draggable','false');
    d.querySelectorAll('.oarrow').forEach(function(b){b.disabled=true;b.style.opacity='.2';});
    d.classList.add(orderItems[i]===q.items[i]?'correct-pos':'wrong-pos');
  });
  if(!ok)errors.push({q:q.q,yours:'Ordre incorrect',correct:q.items.join(' → '),x:q.x,orig:q,mech:q.t});
  resolveCommon(ok,q);
}

function renderCalc(q,area){
  var setup=document.createElement('div');setup.className='calc-setup';setup.textContent=q.setup;
  var opts=document.createElement('div');opts.className='calc-opts';
  var shuffled=shuffle(q.opts.map(function(o,i){return{v:o.v,sub:o.sub,i:i};}));
  shuffled.forEach(function(opt){
    var b=document.createElement('button');b.className='calc-opt';
    b.innerHTML=safeQuestionHtml(String(opt.v))+'<span class="calc-sub">'+escapeUserHtml(opt.sub||'')+'</span>';
    b.setAttribute('data-orig',opt.i);
    b.onclick=function(){if(!answered)resolveCalc(opt.i,b,q,opts);};
    opts.appendChild(b);
  });
  area.appendChild(setup);area.appendChild(opts);
}
function resolveCalc(origIdx,btn,q,optsEl){
  clearInterval(timerInt);answered=true;
  optsEl.querySelectorAll('.calc-opt').forEach(function(b){b.disabled=true;});
  optsEl.querySelectorAll('.calc-opt').forEach(function(b){if(+b.getAttribute('data-orig')===q.a)b.classList.add('ok');});
  var ok=origIdx===q.a;btn.classList.add(ok?'ok':'err');
  if(!ok)errors.push({q:q.q,yours:q.opts[origIdx].v,correct:q.opts[q.a].v,x:q.x,orig:q,mech:q.t});
  resolveCommon(ok,q);
}

function renderDebug(q,area){
  var code=document.createElement('pre');code.className='debug-code';
  function escHtml(s){return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
  var html='';
  (q.code||'').split('\n').forEach(function(l){
    var safe=escHtml(l);
    html+=l===q.errorLine?'<span class="error-line">'+safe+'</span>\n':safe+'\n';
  });
  code.innerHTML=html;
  area.appendChild(code);
  renderQCM(q,area);
}

function renderWord(q,area){
  var intro=document.createElement('div');intro.className='word-intro';intro.textContent='Clique sur les bons éléments (plusieurs réponses possibles), puis valide :';
  var cloud=document.createElement('div');cloud.className='word-cloud';cloud.id='word-cloud';
  var selected=[];
  var shuffledWords=shuffle(q.words.slice());
  shuffledWords.forEach(function(w){
    var chip=document.createElement('button');chip.className='word-chip';chip.textContent=w;
    chip.onclick=function(){
      if(answered)return;
      var idx2=selected.indexOf(w);
      if(idx2>-1){selected.splice(idx2,1);chip.classList.remove('selected');}
      else{selected.push(w);chip.classList.add('selected');}
    };
    cloud.appendChild(chip);
  });
  var vbtn=document.createElement('button');vbtn.className='validate-btn';vbtn.textContent='✓ VALIDER LA SÉLECTION';
  vbtn.onclick=function(){validateWord(q,cloud,selected);};
  area.appendChild(intro);area.appendChild(cloud);area.appendChild(vbtn);
}
function validateWord(q,cloud,selected){
  if(answered)return;answered=true;clearInterval(timerInt);
  var correct_set=q.correct.slice().sort().join('|');
  var user_set=selected.slice().sort().join('|');
  var ok=correct_set===user_set;
  cloud.querySelectorAll('.word-chip').forEach(function(chip){
    chip.disabled=true;
    var w=chip.textContent;
    var isCorrect=q.correct.indexOf(w)>-1;
    var isSelected=selected.indexOf(w)>-1;
    if(isCorrect&&isSelected)chip.classList.add('ok');
    else if(!isCorrect&&isSelected)chip.classList.add('err');
    else if(isCorrect&&!isSelected)chip.classList.add('missed');
    chip.classList.remove('selected');
  });
  if(!ok)errors.push({q:q.q,yours:selected.join(', ')||'(rien)',correct:q.correct.join(', '),x:q.x,orig:q,mech:q.t});
  resolveCommon(ok,q);
}

// ====== COMMON ======
function resolveCommon(ok,q){
  // En mode duel en ligne : déléguer à onlineAnswer (si pas encore répondu)
  if(window.onlineSession && window.onlineSession.code &&
     (window.onlineSession.status === 'playing') &&
     !window.onlineSession.myAnswered && !window.onlineSession.revealing){
    onlineAnswer(ok);
    return;
  }
  // Duel local — types libres (order/slider/scramble/match/categorize/multiblank)
  if(selMode === 'duel' && window._duelFreeformActive) {
    window._duelFreeformActive = false;
    duelResolveResult(ok, q);
    return;
  }
  // Temps de réponse
  var qt=typeof qStartTime!=='undefined'&&qStartTime>0?(Date.now()-qStartTime)/1000:0;
  if(qt>0){qTimes.push(Math.round(qt*100)/100);qStartTime=0;}
  if(ok){
    correct++;bonusStreak++;
    combo++;if(combo>maxCombo){maxCombo=combo;sStats.maxCombo=combo;}
    flash('g');playOk();animCorrect();
    updDot(idx,'pdot dok');
    if(bonusStreak>0&&bonusStreak%5===0){showBonusToast();}
    checkEasterEgg(bonusStreak);
    updateQSRS(q, true); // SRS update
    updateQuestProgress('played'); updateQuestProgress('correct');
    updateQuestProgress('srs'); updateQuestProgress('weekly_played');
    if(selCat) updateQuestProgress('weekly_cat', selCat);
    if(selMode==='rpg'&&typeof resolveRPG==='function') resolveRPG(true);
    if(betOn&&typeof resolveBet==='function') resolveBet(true);
  } else {
    bonusStreak=0;combo=1;
    if(lives!==99)lives--;
    flash('r');playErr();animWrong();
    updDot(idx,'pdot derr');
    updateStreakFlame(0);
    updateQSRS(q, false); // SRS update
    updateQuestProgress('played'); updateQuestProgress('weekly_played');
    if(selCat) updateQuestProgress('weekly_cat', selCat);
    if(selMode==='rpg'&&typeof resolveRPG==='function') resolveRPG(false);
    if(betOn&&typeof resolveBet==='function') resolveBet(false);
  }
  el('hcombo').textContent='x'+combo;
  updateStreakFlame(bonusStreak);
  if(typeof updateDynDiff==='function') updateDynDiff(ok);
  updScore();updLives();
  // Feedback avec temps
  var timeBadge='';
  if(selMode!=='exam'&&qt>0){
    if(qt<5) timeBadge='<span class="time-badge time-fast">⚡ '+qt.toFixed(1)+'s</span>';
    else if(qt<12) timeBadge='<span class="time-badge time-ok">⏱ '+qt.toFixed(1)+'s</span>';
    else timeBadge='<span class="time-badge time-slow">🐢 '+qt.toFixed(1)+'s</span>';
  }
  showFB(ok,q,timeBadge);
  el('nextbtn').className='next-btn show';
  if(lives===0)setTimeout(gameOver,1600);
}

function updateStreakFlame(streak){
  var fl=document.getElementById('streak-flame');
  var em=document.getElementById('sf-emoji');
  var ct=document.getElementById('sf-count');
  if(!fl) return;
  if(streak<=0){fl.classList.remove('show','big','huge');return;}
  fl.classList.add('show');
  fl.classList.remove('big','huge');
  ct.textContent='x'+streak;
  if(streak>=15){em.textContent='🌋';fl.classList.add('huge');}
  else if(streak>=10){em.textContent='💥';fl.classList.add('huge');}
  else if(streak>=5){em.textContent='🔥';fl.classList.add('big');}
  else{em.textContent='🔥';}
  // hide after wrong answer
}
function showBonusToast(){
  var t=document.createElement('div');t.className='bonus-toast';t.textContent='🔥 '+bonusStreak+' bonnes réponses d\'affilée !';
  document.body.appendChild(t);setTimeout(function(){t.remove();},1500);
}

function expireQ(q){
  answered=true;bonusStreak=0;combo=1;if(lives!==99)lives--;
  flash('r');playErr();updDot(idx,'pdot derr');
  errors.push({q:q.q,yours:'(temps écoulé)',correct:q.opts?q.opts[q.a]:String(q.a),x:q.x,orig:q,mech:q.t});
  updScore();updLives();
  showFB(false,q,true);
  el('nextbtn').className='next-btn show';
  if(lives===0)setTimeout(gameOver,1600);
}

function showFB(ok,q,timeout,timeBadge){
  var fb=el('fbk');
  var caHtml=fmtAnswerForHtml(q);
  if(selMode==='exam')return; // no feedback in exam mode
  var lastT=qTimes.length>0?qTimes[qTimes.length-1]:0;
  var tb2=selMode!=='exam'?getTimeBadge(lastT):'';
  var xHtml=safeQuestionHtml(q.x||'');
  if(ok){fb.className='fbk show fok';fb.innerHTML='&#9989; Bonne réponse !'+tb2+'<div class="fexp">'+xHtml+'</div>';}
  else if(timeout){fb.className='fbk show ferr';fb.innerHTML='&#9203; Temps écoulé !'+(timeBadge||'')+'<br><span class="fans">&#10003; '+caHtml+'</span><div class="fexp">'+xHtml+'</div>';}
  else{fb.className='fbk show ferr';fb.innerHTML='&#10060; Mauvaise réponse !'+(timeBadge||'')+'<br><span class="fans">&#10003; '+caHtml+'</span><div class="fexp">'+xHtml+'</div>';}
}

function updLives(){
  if(lives===99){el('hlives').textContent='∞';return;}
  var max=MODES[selMode].lives,l=Math.max(0,lives);
  el('hlives').textContent='❤'.repeat(l)+'🖤'.repeat(Math.max(0,max-l));
}

function flash(t){var e=el('flash');e.className='flash f'+t;e.style.opacity='1';setTimeout(function(){e.style.opacity='0';},140);}
function togglePause(){paused=!paused;el('povl').classList.toggle('show',paused);}
window.toggleOnlinePause = function(){
  // Si en session active, syncer la pause sur Firestore (pause collective)
  if(onlineSession.code && window._fbUpdateDoc && window._fbDoc && window._fbDb){
    var newPaused = !onlineSession.isPaused;
    window._fbUpdateDoc(
      window._fbDoc(window._fbDb,'duels',onlineSession.code),
      {paused: newPaused}
    ).catch(function(){});
    // Mise à jour optimiste locale
    onlineSession.isPaused = newPaused;
    var _e = document.getElementById('online-povl');
    if(_e) _e.classList.toggle('show', newPaused);
  } else {
    // Hors session (ex: menu) : simple toggle
    var _e = document.getElementById('online-povl');
    if(_e) _e.classList.toggle('show');
  }
};

function next(){
  if(selMode==='duel'){showDuelQ();return;}
  if(lives===0)return;
  idx++;if(idx>=session.length)showResults();else{playNext();showQ();}
}

function gameOver(){
  clearInterval(timerInt);saveStats();
  el('go-score').textContent=correct+' / '+session.length;
  var goMsg = selMode==='mort' ? 'Mort subite. 1 erreur = terminé !' : 'Plus de vies — '+(Math.round(correct/session.length*100))+'% de réussite.';
  el('go-sub').textContent=goMsg;
  showScreen('gameover');
}

function saveStats(){
  var pct_h=session.length>0?Math.round(correct/session.length*100):0;
  var hs=hsD[selCat]||0;
  if(correct>hs){hsD[selCat]=correct;lsSet('tssr5_hs',hsD);}
  if(!stD[selCat])stD[selCat]={played:0,correct:0};
  stD[selCat].played+=session.length;stD[selCat].correct+=correct;
  lsSet('tssr5_stats',stD);
  reviewBank=errors.map(function(e){return e.orig;}).filter(Boolean);
  if(selMode!=='duel') saveToHistory(selCat,pct_h,correct,session.length);
  var nb=[];
  BDEFS.forEach(function(b){if(bdD.indexOf(b.id)<0&&b.chk(sStats,errors,correct,session.length,selMode)){bdD.push(b.id);nb.push(b);}});
  lsSet('tssr5_badges',bdD);
  return nb;
}

function showResults(){
  clearInterval(timerInt);
  if(selMode==='speedrun'){var newRec=stopSpeedrun();if(newRec){var el2=document.getElementById('sr-record');if(el2){el2.textContent='🏆 NOUVEAU RECORD !';el2.className='sr-new-record';}}}
  var nb=saveStats();showScreen('results');
  var pct=Math.round(correct/session.length*100);
  showTimeSummary();
  var rank,col,rfill;
  if(pct>=90){rank='S';col='#00a85a';rfill='#00a85a';}
  else if(pct>=75){rank='A';col='var(--acc)';rfill='var(--acc)';}
  else if(pct>=60){rank='B';col='#ff9800';rfill='#ff9800';}
  else if(pct>=40){rank='C';col='#ff9800';rfill='#ff9800';}
  else{rank='D';col='#dc2626';rfill='#dc2626';}
  setTimeout(function(){playRankSound(rank);},400);
  if(rank==='S') setTimeout(function(){launchConfetti();},600);
  el('resrank').textContent=rank;el('resrank').style.color=col;
  el('res-correct').textContent=correct;el('res-total').textContent=session.length;
  el('res-correct').style.color=col;
  setTimeout(function(){el('result-fill').style.width=pct+'%;background:'+rfill;},100);
  el('btnrev').style.display=errors.length>0?'inline-block':'none';

  // badges
  var rb=el('res-badges');rb.innerHTML='';
  nb.forEach(function(b){var d=document.createElement('div');d.className='bunlk';d.innerHTML='<span class="bui">'+b.icon+'</span><span class="bun">BADGE : '+b.name+'</span><div class="bud">'+b.desc+'</div>';rb.appendChild(d);});

  // exam mode: full reveal
  var examSum=el('exam-summary');
  if(selMode==='exam'){
    examSum.style.display='block';
    examSum.innerHTML='<div style="font-family:\'Press Start 2P\',monospace;font-size:9px;color:var(--text2);margin-bottom:12px">RÉSULTATS DÉTAILLÉS — EXAMEN</div>'+session.map(function(q,i){
      var err=errors.filter(function(x){return x.q===q.q;});var ok=err.length===0;
      var caH=fmtAnswerForHtml(q);
      return '<div class="exam-q-row"><span class="eq-icon">'+(ok?'✅':'❌')+'</span><div><div class="eq-q">Q'+(i+1)+'. '+safeQuestionHtml(q.q)+'</div>'+(ok?'<div class="eq-ans eq-ok">✓ Bonne réponse : '+caH+'</div>':'<div class="eq-ans eq-err">✗ Ta réponse : '+escapeUserHtml(err[0]?err[0].yours:'?')+'</div><div class="eq-ans eq-ok">✓ Bonne réponse : '+caH+'</div>')+'<div class="eq-exp">'+safeQuestionHtml(q.x||'')+'</div></div></div>';
    }).join('');
    el('res-tabs').style.display='none';
    el('tab-recap').style.display='none';
    el('tab-errors').style.display='none';
  } else {
    examSum.style.display='none';
    el('res-tabs').style.display='flex';
    el('tab-recap').style.display='';
    el('tab-errors').style.display='';
  }

  var ML={qcm:'QCM',tf:'V/F',fill:'Compléter',order:'Ordre',calc:'Calcul',debug:'Débug',word:'Sélection'};
  el('tab-recap').innerHTML=session.map(function(q){var e=errors.filter(function(x){return x.q===q.q;}).length>0;return '<div class="rrow"><span>'+(e?'❌':'✅')+'</span><span>'+safeQuestionHtml(q.q)+'</span><span class="rmech">'+(ML[q.t]||q.t)+'</span></div>';}).join('');
  buildQStatsTab();
  el('tab-errors').innerHTML=errors.length===0?'<div style="text-align:center;padding:24px;font-family:\'Press Start 2P\',monospace;font-size:10px;color:#00a85a">PARFAIT !</div>':errors.map(function(e){return '<div class="ecard"><div class="eq2">'+safeQuestionHtml(e.q)+'</div><div class="ey">&#10007; '+escapeUserHtml(e.yours)+'</div><div class="ec">&#10003; '+escapeUserHtml(String(e.correct))+'</div><div class="ex">'+safeQuestionHtml(e.x||'')+'</div></div>';}).join('');
}

function switchTab(tab,ev){
  document.querySelectorAll('.rtab').forEach(function(t){t.classList.remove('active');});
  document.querySelectorAll('.tbody').forEach(function(t){t.classList.remove('active');});
  ev.target.classList.add('active');el('tab-'+tab).classList.add('active');
}


// ===================== FLASHCARDS =====================
var flashDeck=[], flashIdx=0, flashFlipped=false, flashSelCat='reseau', flashSelDiff='all';
var flashBad=[], flashOk=[], flashGood=[];
var flashCurQ=null;

function buildFlashDeck(cat,diff){
  var pool=CATS[cat].qs;
  if(diff!=='all') pool=pool.filter(function(q){return q.d===parseInt(diff);});
  if(pool.length===0) pool=CATS[cat].qs;
  return freshShuffle(pool);
}

function getFlashAnswer(q){
  if(q.t==='qcm'||q.t==='debug') return q.opts[q.a];
  if(q.t==='tf') return q.a===true?'VRAI ✅':'FAUX ❌';
  if(q.t==='fill') return q.opts[q.a];
  if(q.t==='calc') return q.opts[q.a].v;
  if(q.t==='order') return q.items.join(' → ');
  if(q.t==='word') return q.correct.join(', ');
  return String(q.a);
}

function startFlash(){
  flashSelCat=selCat; flashSelDiff=selDiff;
  var count=selQCount===9999?9999:selQCount;
  flashDeck=buildFlashDeck(flashSelCat,flashSelDiff).slice(0,Math.min(count,9999));
  flashIdx=0; flashFlipped=false; flashBad=[]; flashOk=[]; flashGood=[];
  applyBody();
  showScreen('flash');
  showFlashCard();
}

function showFlashCard(){
  if(flashIdx>=flashDeck.length){endFlash();return;}
  var q=flashDeck[flashIdx]; flashCurQ=q;
  var catLabel=(q._cat||CATS[flashSelCat].label).toUpperCase();
  var card=document.getElementById('flash-card');
  flashFlipped=false;
  card.classList.remove('revealed');
  document.getElementById('flash-q').innerHTML=safeQuestionHtml(q.q);
  document.getElementById('flash-cat').textContent=catLabel;
  document.getElementById('flash-cat-b').textContent=catLabel;
  document.getElementById('flash-ans').textContent=getFlashAnswer(q);
  document.getElementById('flash-exp').textContent=q.x||'';
  document.getElementById('flash-prog').textContent=(flashIdx+1)+' / '+flashDeck.length;
  var pct=Math.round(flashIdx/flashDeck.length*100);
  document.getElementById('flash-pfill').style.width=pct+'%';
  document.getElementById('flash-counter').textContent='Clic sur la carte pour voir la réponse';
  document.getElementById('flash-btns').style.display='none';
  document.getElementById('fs-bad').textContent=flashBad.length;
  document.getElementById('fs-ok').textContent=flashOk.length;
  document.getElementById('fs-good').textContent=flashGood.length;
  var front=card.querySelector('.flash-front-side');
  if(front){front.style.animation='none';front.offsetHeight;front.style.animation='';}
}

function flipCard(){
  var card=document.getElementById('flash-card');
  if(!flashFlipped){
    card.classList.add('revealed');
    flashFlipped=true;
    document.getElementById('flash-counter').textContent='Tu le savais ?';
    document.getElementById('flash-btns').style.display='flex';
  }
}

function rateFlash(rating){
  if(!flashFlipped) return;
  if(rating===0) flashBad.push(flashCurQ);
  else if(rating===1) flashOk.push(flashCurQ);
  else flashGood.push(flashCurQ);
  flashIdx++;
  showFlashCard();
}

function startFlashRetry(){
  if(flashBad.length+flashOk.length===0){goMenu();return;}
  flashDeck=shuffle(flashBad.concat(flashOk));
  flashIdx=0; flashFlipped=false; flashBad=[]; flashOk=[]; flashGood=[];
  showScreen('flash');
  showFlashCard();
}

function endFlash(){
  showScreen('flash-result');
  document.getElementById('fr-good').textContent=flashGood.length;
  document.getElementById('fr-ok').textContent=flashOk.length;
  document.getElementById('fr-bad').textContent=flashBad.length;
}

// keyboard for flashcards
document.addEventListener('keydown',function(e){
  var _sf=document.getElementById('screen-flash');
  if(!_sf||!_sf.classList.contains('active')) return;
  if(e.key===' '||e.key==='Enter'){e.preventDefault();
    if(!flashFlipped) flipCard();
  }
  if(e.key==='1'&&flashFlipped) rateFlash(0);
  if(e.key==='2'&&flashFlipped) rateFlash(1);
  if(e.key==='3'&&flashFlipped) rateFlash(2);
});



// =====================================================
// DUEL MODE — TOUR PAR TOUR
// =====================================================
var duelNames=['Joueur 1','Joueur 2'];
var duelScores=[0,0];
var duelTarget=5;
var duelTurn=0;
var duelAnswered=false;
var duelQIdx=0;
var duelCurQ=null; // track current question clearly

function pickDuelTarget(btn){
  document.querySelectorAll('.duel-tbtn').forEach(function(b){b.classList.remove('sel');});
  btn.classList.add('sel');
  duelTarget=parseInt(btn.getAttribute('data-t'));
}

function launchDuel(){
  duelNames[0]=(document.getElementById('duel-name-1').value||'Joueur 1').trim();
  duelNames[1]=(document.getElementById('duel-name-2').value||'Joueur 2').trim();
  duelScores=[0,0]; duelTurn=0; duelAnswered=false; duelQIdx=0; duelCurQ=null;

  var cat=CATS[selCat], pool=cat.qs;
  if(selDiff!=='all') pool=pool.filter(function(q){return q.d===parseInt(selDiff);});
  if(!pool.length) pool=cat.qs; // ultimate fallback
  session=freshShuffle(pool).slice(0,50);
  markShown(session);

  applyBody();
  el('gbadge').textContent='⚔️ DUEL · '+duelNames[0]+' vs '+duelNames[1];
  var jr=el('jokers-row'); if(jr) jr.style.display='none';
  var sh=el('score-hud'); if(sh) sh.style.display='none';
  buildDots();
  showScreen('game');
  showDuelQ();
}

// ── Résolution partagée duel local (tous types) ──
function duelResolveResult(ok, q){
  clearInterval(timerInt);
  var p = duelTurn;
  var fbk = el('fbk');
  if(ok){
    duelScores[p]++;
    flash('g'); playOk();
    fbk.className='fbk show fok';
    fbk.innerHTML='✅ <strong>'+escapeUserHtml(duelNames[p])+'</strong> a la bonne réponse ! ('+duelScores[p]+'/'+duelTarget+')<div class="fexp">'+safeQuestionHtml(q.x||'')+'</div>';
    if(duelScores[p] >= duelTarget){ setTimeout(function(){showDuelWin(p);}, 800); return; }
  } else {
    flash('r'); playErr();
    fbk.className='fbk show ferr';
    fbk.innerHTML='❌ Mauvais !<span class="fans"> ✓ '+fmtAnswerForHtml(q)+'</span><div class="fexp">'+safeQuestionHtml(q.x||'')+'</div>';
  }
  duelTurn = 1 - duelTurn;
  duelQIdx++;
  el('nextbtn').className = 'next-btn show';
  el('hint-txt').textContent = 'Espace → tour de ' + duelNames[duelTurn];
}

// ── Rendu de la mécanique en mode duel (tous types) ──
function renderDuelMechanic(q, area, p){
  var keys = p === 0 ? ['Q','W','E','R'] : ['U','I','O','P'];
  window._duelFreeformActive = false;

  if(q.t === 'tf'){
    // Vrai / Faux — 2 boutons avec raccourcis clavier
    var wrap = document.createElement('div'); wrap.className = 'opts'; wrap.id = 'duel-opts';
    var makeBtn = function(label, val, keyLabel, keyIndex){
      var b = document.createElement('button'); b.className = 'opt';
      b.innerHTML = '<span class="okey">'+keyLabel+'</span><span>'+label+'</span>';
      b.setAttribute('data-orig', val ? '1' : '0');
      b.setAttribute('data-key-idx', ''+keyIndex);
      b.onclick = function(){ if(!duelAnswered) pickDuelAnswerTF(val, b, wrap, q); };
      return b;
    };
    wrap.appendChild(makeBtn('✅ VRAI', true,  keys[0], 0));
    wrap.appendChild(makeBtn('❌ FAUX', false, keys[1], 1));
    area.appendChild(wrap);

  } else if(q.opts && q.opts.length > 0){
    // QCM / fill / debug / calc / word — options avec raccourcis clavier
    var shuffled = shuffle(q.opts.map(function(t,i){return{t:t,i:i};}));
    var wrap = document.createElement('div'); wrap.className = 'opts'; wrap.id = 'duel-opts';
    for(var ki = 0; ki < Math.min(4, shuffled.length); ki++){
      (function(optData, keyLabel, keyIndex){
        var b = document.createElement('button'); b.className = 'opt';
        var duelOpt = (typeof optData.t === 'object' && optData.t && optData.t.v !== undefined)
          ? safeQuestionHtml(String(optData.t.v)) + (optData.t.sub ? '<span class="calc-sub">'+escapeUserHtml(optData.t.sub)+'</span>' : '')
          : safeQuestionHtml(String(optData.t));
        b.innerHTML = '<span class="okey">'+keyLabel+'</span><span>'+duelOpt+'</span>';
        b.setAttribute('data-orig', ''+optData.i);
        b.setAttribute('data-key-idx', ''+keyIndex);
        b.onclick = function(){ if(!duelAnswered) pickDuelAnswer(optData.i, b, wrap); };
        wrap.appendChild(b);
      })(shuffled[ki], keys[ki], ki);
    }
    // Afficher le code pour fill/debug
    if((q.t === 'fill' || q.t === 'debug') && q.code){
      var pre = document.createElement('pre');
      pre.className = q.t === 'debug' ? 'debug-code' : 'fill-code';
      function escHtml2(s){return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
      if(q.t === 'fill' && q.blank){
        var safeCode = escHtml2(q.code);
        var safeBlank = escHtml2(q.blank);
        pre.innerHTML = safeCode.replace(safeBlank, '<span class="fill-blank" style="background:var(--primary);color:#000;padding:0 4px;border-radius:4px;">'+safeBlank+'</span>');
      } else {
        pre.textContent = q.code;
      }
      area.insertBefore(pre, wrap);
    }
    area.appendChild(wrap);

  } else {
    // Types libres : order / slider / scramble / match / categorize / multiblank
    window._duelFreeformActive = true;
    var freeformTypes = ['order','slider','scramble','match','categorize','multiblank'];
    if(freeformTypes.indexOf(q.t) === -1){
      // Type inconnu → fallback QCM vide, ne pas bloquer
      window._duelFreeformActive = false;
      var msg = document.createElement('div');
      msg.style.cssText = 'text-align:center;color:var(--dim);padding:20px;';
      msg.textContent = '(type de question non supporté en duel)';
      area.appendChild(msg);
      return;
    }
    switch(q.t){
      case 'order':      renderOrder(q, area);      break;
      case 'slider':     renderSlider(q, area);     break;
      case 'scramble':   renderScramble(q, area);   break;
      case 'match':      renderMatch(q, area);      break;
      case 'categorize': renderCategorize(q, area); break;
      case 'multiblank': renderMultiblank(q, area); break;
    }
  }
}

function showDuelQ(){
  // Guard
  if(duelQIdx >= session.length) duelQIdx = 0;
  duelCurQ = session[duelQIdx];
  // Sauter les questions vraiment inutilisables (pas de champ q)
  var safetyGuard = 0;
  while(duelCurQ && !duelCurQ.q && safetyGuard < session.length){
    duelQIdx = (duelQIdx+1) % session.length;
    duelCurQ = session[duelQIdx];
    safetyGuard++;
  }
  duelAnswered = false;
  window._duelFreeformActive = false;

  var q = duelCurQ;
  var p = duelTurn;
  var area = el('question-area');
  area.innerHTML = '';

  // Turn banner
  var col = p === 0 ? '#38bdf8' : '#f472b6';
  var cls = p === 0 ? 'turn-p1' : 'turn-p2';
  var banner = document.createElement('div');
  banner.className = 'duel-turn-banner ' + cls;
  banner.innerHTML = '<span class="duel-turn-icon">'+(p===0?'🔵':'🩷')+'</span>&nbsp;Tour de <strong>'+escapeUserHtml(duelNames[p])+'</strong>';
  area.appendChild(banner);

  // Scoreboard
  var pct0 = Math.min(100, Math.round(duelScores[0]/duelTarget*100));
  var pct1 = Math.min(100, Math.round(duelScores[1]/duelTarget*100));
  var sb = document.createElement('div'); sb.className = 'duel-scoreboard';
  sb.innerHTML =
    '<div class="dsp'+(p===0?' p1-active':'')+'">'+
      '<span class="dsp-name" style="color:#38bdf8">'+escapeUserHtml(duelNames[0])+'</span>'+
      '<span class="dsp-score" style="color:#38bdf8">'+duelScores[0]+'</span>'+
      '<div class="dsp-bar"><div class="dsp-fill" style="width:'+pct0+'%;background:#38bdf8"></div></div>'+
    '</div>'+
    '<div class="duel-vs-mid">/ '+duelTarget+'</div>'+
    '<div class="dsp'+(p===1?' p2-active':'')+'">'+
      '<span class="dsp-name" style="color:#f472b6">'+escapeUserHtml(duelNames[1])+'</span>'+
      '<span class="dsp-score" style="color:#f472b6">'+duelScores[1]+'</span>'+
      '<div class="dsp-bar"><div class="dsp-fill" style="width:'+pct1+'%;background:#f472b6"></div></div>'+
    '</div>';
  area.appendChild(sb);

  // Card
  var card = document.createElement('div'); card.className = 'qcard'; card.id = 'qcard';
  card.style.cssText = '--acc:'+col+';';
  setTimeout(function(){var qd=card.querySelector('.qdiff');if(qd){qd.style.color=DS_COLORS[q.d]||'var(--dim)';qd.style.fontSize='9px';}},0);
  // Badge de type pour les modes libres
  var typeBadge = '';
  var typeLabels = {order:'📋 Ordre',slider:'🎚️ Curseur',scramble:'🔀 Mots mêlés',match:'🔗 Association',categorize:'📂 Catégories',multiblank:'📝 Trous',tf:'✅ Vrai/Faux',fill:'✏️ Compléter',debug:'🐛 Debug',calc:'🧮 Calcul',word:'☁️ Mots',qcm:''};
  if(typeLabels[q.t]) typeBadge = '<span style="font-size:10px;opacity:.6;margin-left:8px;">'+typeLabels[q.t]+'</span>';
  card.innerHTML = '<span class="qdiff">'+DS[q.d]+'</span><div class="qnum">Question '+(duelQIdx+1)+typeBadge+'</div><div class="qtext">'+safeQuestionHtml(q.q)+(q._cat?'<span class="qcat-tag">['+escapeUserHtml(q._cat)+']</span>':'')+'</div>';
  area.appendChild(card);

  // Rendu de la mécanique (tous types)
  renderDuelMechanic(q, area, p);

  // Reset feedback et bouton suivant
  el('fbk').className = 'fbk';
  el('nextbtn').className = 'next-btn';
  // Hint clavier seulement pour les types avec opts/tf
  if(q.opts || q.t === 'tf'){
    el('hint-txt').textContent = (p===0 ? duelNames[0]+' : Q·W·E·R' : duelNames[1]+' : U·I·O·P');
    if(q.t === 'tf') el('hint-txt').textContent = (p===0 ? duelNames[0]+' : Q=Vrai W=Faux' : duelNames[1]+' : U=Vrai I=Faux');
  } else {
    el('hint-txt').textContent = 'Tour de '+duelNames[p]+' — réponds puis valide';
  }

  // Timer 20s (30s pour les types libres, plus complexes)
  clearInterval(timerInt);
  var timerDur = (window._duelFreeformActive) ? 45 : 20;
  var tb = el('tbar'); tb.style.width = '100%'; tb.style.background = '#00d87a';
  timeLeft = timerDur;
  timerInt = setInterval(function(){
    if(paused) return;
    timeLeft -= 0.1;
    var pct = (timeLeft/timerDur)*100;
    tb.style.width = pct+'%';
    if(pct < 50) tb.style.background = '#ff9800';
    if(pct < 20) tb.style.background = '#dc2626';
    updateTimerDrama(pct, timeLeft);
    if(timeLeft <= 0){
      clearInterval(timerInt);
      if(!duelAnswered){
        duelAnswered = true;
        window._duelFreeformActive = false;
        // Désactiver tous les boutons de la question
        area.querySelectorAll('button:not(.next-btn)').forEach(function(b){b.disabled=true;});
        var fbk = el('fbk');
        fbk.className = 'fbk show ferr';
        fbk.innerHTML = '⏰ Temps écoulé !<span class="fans"> ✓ '+fmtAnswerForHtml(q)+'</span><div class="fexp">'+safeQuestionHtml(q.x||'')+'</div>';
        duelTurn = 1 - duelTurn;
        duelQIdx++;
        el('nextbtn').className = 'next-btn show';
        el('hint-txt').textContent = 'Espace → tour de '+duelNames[duelTurn];
      }
    }
  }, 100);
}

function pickDuelAnswer(origIdx, btn, wrap){
  if(duelAnswered) return;
  duelAnswered = true;
  var q = duelCurQ;
  // Disable all buttons, highlight correct
  wrap.querySelectorAll('.opt').forEach(function(b){b.disabled=true;});
  wrap.querySelectorAll('.opt').forEach(function(b){if(+b.getAttribute('data-orig')===q.a)b.classList.add('ok');});
  btn.classList.add((origIdx===q.a)?'ok':'err');
  duelResolveResult(origIdx === q.a, q);
}

function pickDuelAnswerTF(val, btn, wrap, q){
  if(duelAnswered) return;
  duelAnswered = true;
  var ok = (val === q.a);
  wrap.querySelectorAll('.opt').forEach(function(b){b.disabled=true;});
  // Highlight correct button
  wrap.querySelectorAll('.opt').forEach(function(b){
    var bval = b.getAttribute('data-orig') === '1';
    if(bval === q.a) b.classList.add('ok');
  });
  btn.classList.add(ok ? 'ok' : 'err');
  duelResolveResult(ok, q);
}

function showDuelWin(winner){
  clearInterval(timerInt);
  var win=document.getElementById('duel-win');
  var col=winner===0?'#38bdf8':'#f472b6';
  document.getElementById('dw-title').textContent=duelNames[winner]+' GAGNE ! 🏆';
  document.getElementById('dw-title').style.color=col;
  document.getElementById('dw-scores').innerHTML=
    '<div class="duel-fs"><span class="duel-fs-name" style="color:#38bdf8">'+escapeUserHtml(duelNames[0])+'</span><span class="duel-fs-val" style="color:#38bdf8">'+duelScores[0]+'</span></div>'+
    '<div class="duel-fs" style="font-size:24px;color:var(--dim)"> - </div>'+
    '<div class="duel-fs"><span class="duel-fs-name" style="color:#f472b6">'+escapeUserHtml(duelNames[1])+'</span><span class="duel-fs-val" style="color:#f472b6">'+duelScores[1]+'</span></div>';
  document.getElementById('dw-sub').textContent='Premier a '+duelTarget+' points !';
  win.classList.add('show');
  if(typeof playBonus==='function') playBonus();
}

// Keyboard for duel — only active player keys work
function duelKeydown(e){
  if(selMode!=='duel' || duelAnswered) return;
  var p1map={Q:0,W:1,E:2,R:3};
  var p2map={U:0,I:1,O:2,P:3};
  var k=e.key.toUpperCase();
  var map=duelTurn===0?p1map:p2map;
  if(map[k]===undefined) return;
  var opts=document.querySelectorAll('#duel-opts .opt:not(:disabled)');
  var btn=Array.from(opts).find(function(b){return +b.getAttribute('data-key-idx')===map[k];});
  if(btn) btn.click();
}

// =====================================================
// TIMER DRAMATIQUE
// =====================================================
function updateTimerDrama(pct,seconds){
  var wrap=el('tbarwrap');
  if(!wrap) return;
  if(pct<20){
    wrap.classList.add('danger');
    // Show countdown
    var cd=document.getElementById('tbar-countdown');
    if(!cd){cd=document.createElement('div');cd.id='tbar-countdown';cd.className='tbar-countdown';el('tbarwrap').parentNode.insertBefore(cd,el('tbarwrap'));}
    cd.textContent=Math.ceil(seconds)+'s';
    cd.classList.add('visible');
  } else {
    wrap.classList.remove('danger');
    var cd=document.getElementById('tbar-countdown');
    if(cd) cd.classList.remove('visible');
  }
}

// =====================================================
// STATS & PROGRESSION
// =====================================================
var historyD=lsGet('tssr5_history',[]);

function saveToHistory(cat,pct,correct,total){
  historyD.push({date:Date.now(),cat:cat,pct:pct,correct:correct,total:total});
  if(historyD.length>50) historyD=historyD.slice(-50);
  lsSet('tssr5_history',historyD);
}

function showStatsScreen(){
  showScreen('stats');
  var totalGames=historyD.length;
  var avgPct=totalGames>0?Math.round(historyD.reduce(function(a,b){return a+b.pct;},0)/totalGames):0;
  el('st-total').textContent=totalGames;
  el('st-pct').textContent=avgPct+'%';
  el('st-streak').textContent=streakD.current+'j';

  // Draw progress graph
  drawProgressGraph();
  drawMastery();
  // Show weak cats button only if enough data
  var hasData=Object.keys(stD).some(function(k){return stD[k]&&stD[k].played>0;});
  var btn=document.getElementById('btn-weak-cats');
  if(btn) btn.style.display=hasData?'inline-block':'none';
}

function drawProgressGraph(){
  var canvas=el('prog-canvas');
  if(!canvas) return;
  canvas.width=canvas.offsetWidth||600;
  var ctx=canvas.getContext('2d');
  var W=canvas.width, H=canvas.height||120;
  ctx.clearRect(0,0,W,H);
  var data=historyD.slice(-20);
  if(data.length<2){
    ctx.fillStyle=getComputedStyle(document.body).getPropertyValue('--text2').trim();
    ctx.font='12px DM Mono,monospace'; ctx.textAlign='center';
    ctx.fillText('Pas encore assez de données — joue d abord !',W/2,H/2);
    return;
  }
  var st=getComputedStyle(document.body);
  var cBorder=st.getPropertyValue('--border').trim();
  var cAcc=st.getPropertyValue('--acc').trim();
  var cText2=st.getPropertyValue('--text2').trim();
  var padL=30,padR=10,padT=10,padB=20;
  var gW=W-padL-padR, gH=H-padT-padB;
  // Grid lines
  [0,25,50,75,100].forEach(function(v){
    var y=padT+gH*(1-v/100);
    ctx.strokeStyle=cBorder; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(padL,y); ctx.lineTo(W-padR,y); ctx.stroke();
    ctx.fillStyle=cText2; ctx.font='8px DM Mono,monospace'; ctx.textAlign='right';
    ctx.fillText(v+'%',padL-4,y+3);
  });
  // Line
  ctx.beginPath(); ctx.strokeStyle=cAcc; ctx.lineWidth=2.5;
  data.forEach(function(d,i){
    var x=padL+gW*i/(data.length-1);
    var y=padT+gH*(1-d.pct/100);
    if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  });
  ctx.stroke();
  // Area fill
  ctx.beginPath();
  data.forEach(function(d,i){
    var x=padL+gW*i/(data.length-1);
    var y=padT+gH*(1-d.pct/100);
    if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  });
  ctx.lineTo(padL+gW,padT+gH); ctx.lineTo(padL,padT+gH); ctx.closePath();
  ctx.fillStyle='rgba('+hexToRgb(cAcc)+',0.08)'; ctx.fill();
  // Dots
  data.forEach(function(d,i){
    var x=padL+gW*i/(data.length-1);
    var y=padT+gH*(1-d.pct/100);
    ctx.beginPath(); ctx.arc(x,y,3.5,0,Math.PI*2);
    ctx.fillStyle=d.pct>=75?'#00a85a':d.pct>=50?'#ff9800':'#dc2626';
    ctx.fill();
  });
}

function hexToRgb(hex){
  // Handle var() css vars — return fallback
  if(hex.startsWith('var')) return '56,189,248';
  var r=parseInt(hex.slice(1,3),16)||56;
  var g=parseInt(hex.slice(3,5),16)||189;
  var b=parseInt(hex.slice(5,7),16)||248;
  return r+','+g+','+b;
}

function startWeakCats(){
  // Find the 3 categories with lowest mastery (min 5 questions played)
  var cats=Object.keys(CATS).filter(function(k){return k!=='mix';});
  var ranked=cats.map(function(k){
    var st=stD[k]||{played:0,correct:0};
    var pct=st.played>0?Math.round(st.correct/st.played*100):0;
    return {k:k,pct:pct,played:st.played};
  }).filter(function(x){return x.played>0;}).sort(function(a,b){return a.pct-b.pct;});
  if(!ranked.length){alert("Joue dabord quelques parties !");return;}
  // Build pool from the 3 weakest
  var pool=[];
  ranked.slice(0,3).forEach(function(r){
    CATS[r.k].qs.forEach(function(q){pool.push(Object.assign({},q,{_cat:CATS[r.k].label}));});
  });
  if(!pool.length) return;
  selMode='chill';
  session=freshShuffle(pool).slice(0,Math.min(selQCount,pool.length));
  markShown(session);
  correct=0;combo=1;maxCombo=1;errors=[];idx=0;paused=false;bonusStreak=0;lives=5;
  jokers=3;
  sStats={cat:'mix',mode:'chill',maxCombo:0,mechs:new Set(),streak:streakD.current};
  el('gbadge').textContent='🎯 CATÉGORIES FAIBLES';
  var sh=el('score-hud');if(sh)sh.style.display='grid';
  el('htotal').textContent=session.length;
  buildDots();
  showScreen('game');
  showQ();
}

function drawMastery(){
  var list=el('mastery-list');
  if(!list) return;
  list.innerHTML='';
  var catKeys=Object.keys(CATS).filter(function(k){return k!=='mix';});
  catKeys.forEach(function(catId){
    var st=stD[catId]||{played:0,correct:0};
    var pct=st.played>0?Math.round(st.correct/st.played*100):0;
    var col=pct>=80?'#00a85a':pct>=60?'#ff9800':pct>=40?'#fbbf24':'#dc2626';
    var level=pct>=80?'Expert':pct>=60?'Avancé':pct>=40?'Intermédiaire':st.played>0?'Débutant':'Non commencé';
    var row=document.createElement('div'); row.className='mastery-row';
    row.innerHTML=
      '<div class="mastery-top">'+
        '<span class="mastery-cat">'+CATS[catId].icon+' '+CATS[catId].label+'</span>'+
        '<span class="mastery-pct" style="color:'+col+'">'+pct+'%</span>'+
      '</div>'+
      '<div class="mastery-bar"><div class="mastery-fill" style="width:0%;background:'+col+'" data-pct="'+pct+'"></div></div>'+
      '<div class="mastery-detail">'+level+' · '+st.played+' questions jouées</div>';
    list.appendChild(row);
  });
  // Animate bars after render
  setTimeout(function(){
    list.querySelectorAll('.mastery-fill').forEach(function(bar){
      bar.style.width=bar.getAttribute('data-pct')+'%';
    });
  },100);
}

// =====================================================
// EASTER EGG — 15 bonnes réponses d'affilée
// =====================================================
var easterActive=false;
function checkEasterEgg(streak){
  if(streak>=15&&!easterActive){
    easterActive=true;
    var ov=document.getElementById('easter-overlay');
    var messages=["UNSTOPPABLE !","LEGENDAIRE !","T ES CHAUD BOUILLANT !","PERSONNE PEUT TE STOP !"];
    document.getElementById('easter-text').textContent=messages[Math.floor(Math.random()*messages.length)];
    ov.classList.add('show');
    // Rainbow mode for 3s
    document.body.classList.add('rainbow-mode');
    setTimeout(function(){
      ov.classList.remove('show');
      document.body.classList.remove('rainbow-mode');
      easterActive=false;
    },3000);
  }
}


// =====================================================
// CONFETTIS (rang S)
// =====================================================
function launchConfetti(){
  var colors=['#38bdf8','#f472b6','#4ade80','#fbbf24','#f87171','#a78bfa'];
  for(var i=0;i<60;i++){
    (function(delay){
      setTimeout(function(){
        var c=document.createElement('div');
        c.className='confetti-piece';
        c.style.left=Math.random()*100+'vw';
        c.style.background=colors[Math.floor(Math.random()*colors.length)];
        c.style.animationDuration=(1.5+Math.random()*2)+'s';
        c.style.animationDelay='0s';
        document.body.appendChild(c);
        setTimeout(function(){c.remove();},4000);
      },delay);
    })(i*40);
  }
}

// =====================================================
// DÉFI QUOTIDIEN
// =====================================================
var dailyData=lsGet('tssr5_daily',{});
var dailyPopupShownThisSession = false;

function getDailyQuestion(){
  var dayNum=Math.floor(Date.now()/86400000);
  var hardQs=[];
  Object.keys(CATS).forEach(function(k){
    if(k==='mix') return;
    CATS[k].qs.filter(function(q){ return q.d===3 && q.t==='qcm' && q.opts && q.opts.length >= 2; }).forEach(function(q){
      hardQs.push(Object.assign({},q,{_cat:CATS[k].label}));
    });
  });
  // Fallback : si aucune question de niveau 3, prendre n'importe quelle QCM avec opts
  if(!hardQs.length){
    Object.keys(CATS).forEach(function(k){
      if(k==='mix') return;
      CATS[k].qs.filter(function(q){ return q.t==='qcm' && q.opts && q.opts.length >= 2; }).forEach(function(q){
        hardQs.push(Object.assign({},q,{_cat:CATS[k].label}));
      });
    });
  }
  if(!hardQs.length) return null;
  return hardQs[dayNum % hardQs.length];
}

function buildDailyWidget(){
  var today=new Date().toDateString();
  var q=getDailyQuestion();
  
  var dot = document.getElementById('daily-notification-dot');
  var btn = document.getElementById('daily-top-btn');
  
  if (btn) {
    if (!q) {
      btn.style.display = 'none';
    } else {
      btn.style.display = 'inline-block';
      if (dot) {
        var done=dailyData[today];
        dot.style.display = done ? 'none' : 'block';
      }
    }
  }
  
  var widget=document.getElementById('daily-widget');
  if(widget) {
    widget.style.display = 'none';
    widget.innerHTML = '';
  }
}

function openDailyScreen(){
  var q=getDailyQuestion();
  if(!q) return;
  var today=new Date().toDateString();
  var done=dailyData[today];
  var scr=document.getElementById('screen-daily');
  if(!scr){
    scr=document.createElement('div');
    scr.id='screen-daily';
    scr.className='screen';
    scr.onclick=function(e){if(e.target===this)closeDailyScreen();};
    document.getElementById('app').appendChild(scr);
  }
  
  if(done) {
    scr.innerHTML =
      '<div class="daily-modal-content">'+
        '<div class="daily-topbar">'+
          '<button class="wiz-close" onclick="closeDailyScreen()" data-testid="daily-close-btn">✕</button>'+
          '<div class="daily-topbar-title">📅 DÉFI DU JOUR</div>'+
          '<div style="width:36px;"></div>'+
        '</div>'+
        '<div class="daily-page-body">'+
          '<div class="daily-cat-pill">'+escapeUserHtml(q._cat||'')+' · ★★★</div>'+
          '<h2 class="daily-page-q">'+safeQuestionHtml(q.q)+'</h2>'+
          '<div class="daily-exp-box" style="margin-top:10px;">'+
            '<div class="daily-exp-lbl">'+(done.ok?'✅ Défi réussi aujourd\'hui !':'❌ Défi raté — à demain !')+'</div>'+
            '<div class="daily-exp-txt">'+safeQuestionHtml(q.x||'')+'</div>'+
            '<button class="sheet-launch-btn" onclick="closeDailyScreen();" data-testid="daily-back-btn">↩ FERMER</button>'+
          '</div>'+
        '</div>'+
      '</div>';
    scr.classList.add('active');
    scr.style.display='flex';
    return;
  }
  
  scr.innerHTML =
    '<div class="daily-modal-content">'+
      '<div class="daily-topbar">'+
        '<button class="wiz-close" onclick="closeDailyScreen()" data-testid="daily-close-btn">✕</button>'+
        '<div class="daily-topbar-title">📅 DÉFI DU JOUR</div>'+
        '<div style="width:36px;"></div>'+
      '</div>'+
      '<div class="daily-page-body">'+
        '<div class="daily-cat-pill">'+escapeUserHtml(q._cat||'')+' · ★★★</div>'+
        '<h2 class="daily-page-q">'+safeQuestionHtml(q.q)+'</h2>'+
        '<div id="daily-opts" class="opts daily-opts-page"></div>'+
        '<div id="daily-exp"></div>'+
      '</div>'+
    '</div>';
  scr.classList.add('active');
  scr.style.display='flex';
  try{window.scrollTo(0,0);}catch(e){}
  // Guard : si la question n'a pas d'options valides, on ne peut pas afficher
  if(!q.opts || !q.opts.length){
    var optsDiv2=document.getElementById('daily-opts');
    if(optsDiv2) optsDiv2.innerHTML='<p style="color:var(--text2);font-size:11px;text-align:center;padding:10px 0">Réponses indisponibles pour cette question.</p>';
    return;
  }
  var shuffled=shuffle(q.opts.map(function(t,i){return{t:t,i:i};}));
  var optsDiv=document.getElementById('daily-opts');
  ['A','B','C','D'].forEach(function(k,i){
    if(!shuffled[i]) return;
    var b=document.createElement('button'); b.className='opt';
    b.setAttribute('data-testid','daily-opt-'+k);
    var dRaw=shuffled[i].t;
    var dHtml=(typeof dRaw==='object'&&dRaw&&dRaw.v!==undefined)
      ? safeQuestionHtml(String(dRaw.v))+(dRaw.sub?'<span class="calc-sub">'+escapeUserHtml(dRaw.sub)+'</span>':'')
      : safeQuestionHtml(String(dRaw));
    b.innerHTML='<span class="okey">'+k+'</span><span>'+dHtml+'</span>';
    b.onclick=(function(opt){return function(){
      optsDiv.querySelectorAll('.opt').forEach(function(x){x.disabled=true;});
      optsDiv.querySelectorAll('.opt').forEach(function(x){if(+x.getAttribute('data-orig')===q.a)x.classList.add('ok');});
      var ok=opt.i===q.a;
      b.classList.add(ok?'ok':'err');
      dailyData[today]={ok:ok};lsSet('tssr5_daily',dailyData);
      if(ok){beep(784,.15,'sine',.2);}else{beep(200,.1,'sawtooth',.15);}
      var exp=document.getElementById('daily-exp');
      exp.innerHTML='<div class="daily-exp-box"><div class="daily-exp-lbl">'+(ok?'✅ BRAVO !':'❌ Raté')+'</div><div class="daily-exp-txt">'+safeQuestionHtml(q.x||'')+'</div><button class="sheet-launch-btn" onclick="closeDailyScreen();" data-testid="daily-back-btn">↩ FERMER</button></div>';
    };})(shuffled[i]);
    b.setAttribute('data-orig',shuffled[i].i);
    optsDiv.appendChild(b);
  });
}

function closeDailyScreen(){
  var scr=document.getElementById('screen-daily');
  if(scr){scr.classList.remove('active');scr.style.display='none';}
  buildDailyWidget();
}
// Expose globally
window.openDailyScreen=openDailyScreen;
window.closeDailyScreen=closeDailyScreen;

// =====================================================
// SCORE PARTAGEABLE
// =====================================================
function toggleShare(){
  var box=document.getElementById('share-box');
  if(!box) return;
  if(box.style.display!=='none'){
    box.style.display='none';
    var cb=document.getElementById('copy-share-btn');if(cb)cb.style.display='none';
    return;
  }
  var pct=Math.round(correct/session.length*100);
  var rank=pct>=90?'S':pct>=75?'A':pct>=60?'B':pct>=40?'C':'D';
  var bars='';
  Object.keys(CATS).filter(function(k){return k!=='mix';}).slice(0,6).forEach(function(k){
    var st=stD[k]||{played:0,correct:0};
    var p=st.played>0?Math.round(st.correct/st.played*100):0;
    var bar=Math.round(p/10);
    bars+='  '+CATS[k].icon+' '+CATS[k].label.substring(0,12).padEnd(12)+' '+'█'.repeat(bar)+'░'.repeat(10-bar)+' '+p+'%\n';
  });
  var text='📚 TSSRQUIZZ — Résultats\n'+'═'.repeat(30)+'\n'+'🏆 Rang : '+rank+'   Score : '+correct+'/'+session.length+' ('+pct+'%)\n'+'⚡ Combo max : x'+maxCombo+'\n'+'═'.repeat(30)+'\n'+bars+'\n'+'🔥 Streak : '+streakD.current+' jours';
  box.textContent=text;
  box.style.display='block';
  var cb=document.getElementById('copy-share-btn');if(cb)cb.style.display='inline-block';
}

function copyShare(){
  var box=document.getElementById('share-box');
  if(!box) return;
  navigator.clipboard.writeText(box.textContent).then(function(){
    var t=document.getElementById('copied-toast');
    if(t){t.style.display='block';setTimeout(function(){t.style.display='none';},2000);}
  }).catch(function(){
    // fallback
    var ta=document.createElement('textarea');
    ta.value=box.textContent;
    document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();
  });
}

// =====================================================
// BLIND MODE — question révélée mot par mot
// =====================================================
function revealBlind(qtext){
  var el=document.getElementById('qtext');
  if(!el||selMode!=='blind') return;
  var text=qtext;
  var words=text.split(' ');
  el.innerHTML=words.map(function(w){return '<span class="blind-reveal">'+escapeUserHtml(w)+'</span>';}).join(' ');
  var spans=el.querySelectorAll('.blind-reveal');
  spans.forEach(function(s,i){setTimeout(function(){s.classList.add('shown');},i*80);});
}


// =====================================================
// MODE DISCUSSION — PROJO / CLASSE
// =====================================================
var discTimer=30, discN=10;
var discSession=[], discIdx=0, discRevealed=false;
var discTimerInt=null, discTimeLeft=0;
var discGroupScores=[]; // 1=found, 0=not found, null=not rated

function pickDiscTimer(btn){
  document.querySelectorAll('.disc-tbtn[data-t]').forEach(function(b){b.classList.remove('sel');});
  btn.classList.add('sel');
  discTimer=parseInt(btn.getAttribute('data-t'));
}
function pickDiscN(btn){
  document.querySelectorAll('.disc-tbtn[data-n]').forEach(function(b){b.classList.remove('sel');});
  btn.classList.add('sel');
  discN=parseInt(btn.getAttribute('data-n'));
}

function startDiscussion(){
  // Build pool — prefer qcm questions (cleaner for group discussion)
  var pool=CATS[selCat].qs;
  if(selDiff!=='all') pool=pool.filter(function(q){return q.d===parseInt(selDiff);});
  if(!pool.length) pool=CATS[selCat].qs;
  discSession=freshShuffle(pool).slice(0,Math.min(discN===9999?9999:discN,pool.length));
  discIdx=0; discRevealed=false; discGroupScores=[];
  discSession.forEach(function(){discGroupScores.push(null);});

  // Show game, hide setup/results
  document.getElementById('disc-setup').style.display='none';
  document.getElementById('disc-results').style.display='none';
  var game=document.getElementById('disc-game');
  game.style.display='flex'; game.style.flexDirection='column';

  applyBody();
  showScreen('discussion');
  showDiscQ();
}

function showDiscQ(){
  if(discIdx>=discSession.length){showDiscResults();return;}
  discRevealed=false;
  clearInterval(discTimerInt);

  var q=discSession[discIdx];
  var catLabel=(q._cat||CATS[selCat].label).toUpperCase();

  // Populate
  document.getElementById('disc-cat-pill').textContent=catLabel;
  document.getElementById('disc-qnum').textContent='QUESTION '+(discIdx+1)+' / '+discSession.length;
  document.getElementById('disc-q').innerHTML=safeQuestionHtml(q.q);
  // Answer
  var ans='';
  if(q.t==='qcm'||q.t==='debug') ans=q.opts[q.a];
  else if(q.t==='tf') ans=q.a===true?'VRAI ✅':'FAUX ❌';
  else if(q.t==='fill') ans=q.opts[q.a];
  else if(q.t==='calc') ans=q.opts[q.a].v;
  else if(q.t==='order') ans=q.items.join(' → ');
  else if(q.t==='word') ans=q.correct.join(', ');
  document.getElementById('disc-ans').textContent=ans;
  document.getElementById('disc-exp').textContent=q.x||'';

  // Hide reveal
  var rev=document.getElementById('disc-reveal');
  rev.classList.remove('show'); rev.style.display='none';

  // Buttons
  var revBtn=document.getElementById('disc-reveal-btn');
  revBtn.textContent='👁 RÉVÉLER'; revBtn.classList.remove('revealed');
  document.getElementById('disc-next-btn').style.display='none';
  document.getElementById('disc-score-row').style.display='none';
  document.getElementById('disc-hint').style.display='block';
  document.getElementById('disc-prog').textContent=(discIdx+1)+' / '+discSession.length;

  // Timer
  var timerWrap=document.getElementById('disc-timer-wrap');
  if(discTimer>0){
    timerWrap.style.display='flex';
    discTimeLeft=discTimer;
    timerWrap.classList.remove('danger');
    document.getElementById('disc-timer-num').textContent=discTimeLeft;
    document.getElementById('disc-timer-fill').style.width='100%';
    document.getElementById('disc-timer-fill').style.background='var(--acc)';

    discTimerInt=setInterval(function(){
      discTimeLeft--;
      var pct=(discTimeLeft/discTimer)*100;
      document.getElementById('disc-timer-num').textContent=discTimeLeft;
      document.getElementById('disc-timer-fill').style.width=pct+'%';
      if(pct<33){
        timerWrap.classList.add('danger');
        document.getElementById('disc-timer-fill').style.background='#dc2626';
      }
      if(discTimeLeft<=0){
        clearInterval(discTimerInt);
        if(!discRevealed) discReveal(); // auto-révèle à 0
      }
    },1000);
  } else {
    timerWrap.style.display='none';
  }
}

function discReveal(){
  if(discRevealed) return;
  discRevealed=true;
  clearInterval(discTimerInt);

  var rev=document.getElementById('disc-reveal');
  rev.style.display='block';
  setTimeout(function(){rev.classList.add('show');},10);

  document.getElementById('disc-hint').style.display='none';
  var revBtn=document.getElementById('disc-reveal-btn');
  revBtn.textContent='✅ RÉVÉLÉ'; revBtn.classList.add('revealed');
  document.getElementById('disc-next-btn').style.display='inline-block';
  document.getElementById('disc-score-row').style.display='flex';
}

function discClickReveal(){
  if(!discRevealed) discReveal();
}

function discScore(val){
  discGroupScores[discIdx]=val;
  discNext();
}

function discNext(){
  discIdx++;
  if(discIdx>=discSession.length) showDiscResults();
  else showDiscQ();
}

function showDiscResults(){
  clearInterval(discTimerInt);
  document.getElementById('disc-game').style.display='none';
  var res=document.getElementById('disc-results');
  res.style.display='block';

  var found=discGroupScores.filter(function(s){return s===1;}).length;
  var rated=discGroupScores.filter(function(s){return s!==null;}).length;
  document.getElementById('disc-res-score').textContent=found+' / '+rated;
  document.getElementById('disc-res-sub').textContent='Le groupe a trouvé '+found+' question'+(found>1?'s':'')+' sur '+rated+' notées';

  // List
  var list=document.getElementById('disc-res-list');
  list.innerHTML=discSession.map(function(q,i){
    var sc=discGroupScores[i];
    var icon=sc===1?'✅':sc===0?'❌':'—';
    var rawA=q.t==='qcm'||q.t==='debug'?q.opts[q.a]:q.t==='tf'?(q.a?'VRAI':'FAUX'):q.t==='fill'?q.opts[q.a]:'...';
    var ans=(typeof rawA==='object'&&rawA&&rawA.v!==undefined)?String(rawA.v)+(rawA.sub?' ('+rawA.sub+')':''):String(rawA);
    return '<div class="disc-res-row"><span style="flex-shrink:0">'+icon+'</span><span style="flex:1">'+safeQuestionHtml(q.q)+'</span><span style="color:#00a85a;font-size:11px;flex-shrink:0;margin-left:8px;">'+escapeUserHtml(ans)+'</span></div>';
  }).join('');
}

function discQuit(){
  clearInterval(discTimerInt);
  // Reset layout
  document.getElementById('disc-setup').style.display='block';
  document.getElementById('disc-game').style.display='none';
  document.getElementById('disc-results').style.display='none';
  goMenu();
}

// Route startGame to discussion setup



// =====================================================
// MODE BOSS
// =====================================================
function initBoss(pool){
  var easy=shuffle(pool.filter(function(q){return q.d===1;})).slice(0,3);
  var med=shuffle(pool.filter(function(q){return q.d===2;})).slice(0,4);
  var hard=shuffle(pool.filter(function(q){return q.d===3;})).slice(0,3);
  var result=easy.concat(med).concat(hard);
  if(result.length<5) result=shuffle(pool).slice(0,10);
  return result;
}
function updateBossBar(){
  var fill=document.getElementById('boss-fill');
  if(!fill) return;
  var pct=Math.round(((idx||0)/Math.max(session.length,1))*100);
  fill.style.width=pct+'%';
  var lbl=document.getElementById('boss-label');
  if(lbl) lbl.textContent='BOSS PHASE '+(Math.floor((idx||0)/3)+1)+'/4';
}
// =====================================================
// MUSIQUE LO-FI
// =====================================================
var lofiCtx=null,lofiNodes=[],lofiOn=false;
function toggleLofi(){
  lofiOn?stopLofi():startLofi();
  lofiOn=!lofiOn;
  ['lofi-btn','lofi-btn-menu'].forEach(function(id){
    var btn=document.getElementById(id);
    if(btn){btn.textContent=lofiOn?'🎵 ON':'🎵';btn.style.borderColor=lofiOn?'var(--acc)':'var(--border2)';btn.style.color=lofiOn?'var(--acc)':'var(--text2)';}
  });
}
function startLofi(){
  try{
    if(!lofiCtx)lofiCtx=new(window.AudioContext||window.webkitAudioContext)();
    var master=lofiCtx.createGain();master.gain.value=0.07;master.connect(lofiCtx.destination);
    var drone=lofiCtx.createOscillator();drone.type='sine';drone.frequency.value=55;
    var dg=lofiCtx.createGain();dg.gain.value=0.5;drone.connect(dg);dg.connect(master);drone.start();
    var chords=[[131,165,196],[110,138,165],[87,110,131],[98,123,147]];
    var ci=0;
    function chord(){
      chords[ci%4].forEach(function(f){
        var o=lofiCtx.createOscillator();o.type='triangle';o.frequency.value=f;
        var g=lofiCtx.createGain();
        g.gain.setValueAtTime(0,lofiCtx.currentTime);
        g.gain.linearRampToValueAtTime(0.12,lofiCtx.currentTime+0.4);
        g.gain.linearRampToValueAtTime(0,lofiCtx.currentTime+3.8);
        o.connect(g);g.connect(master);o.start();o.stop(lofiCtx.currentTime+4);
      });ci++;
    }
    chord();
    var lint=setInterval(chord,4000);
    lofiNodes=[drone,master,lint];
  }catch(e){}
}
function stopLofi(){
  try{if(lofiNodes[0])lofiNodes[0].stop();}catch(e){}
  if(lofiNodes[2])clearInterval(lofiNodes[2]);
  lofiNodes=[];
}

// =====================================================
// MÉCANIQUE MATCH (associer colonnes)
// =====================================================
var matchSelLeft=null, matchMatched=[];

function renderMatch(q,area){
  matchSelLeft=null; matchMatched=[];
  var pairs=q.pairs;
  var shuffledL=shuffle(pairs.map(function(p,i){return{text:p.l,idx:i};}));
  var shuffledR=shuffle(pairs.map(function(p,i){return{text:p.r,idx:i};}));

  var wrap=document.createElement('div'); wrap.className='match-wrap'; wrap.id='match-wrap';
  var colL=document.createElement('div'); colL.className='match-col';
  var colR=document.createElement('div'); colR.className='match-col';
  var lblL=document.createElement('div'); lblL.className='match-col-lbl'; lblL.textContent='TERME';
  var lblR=document.createElement('div'); lblR.className='match-col-lbl'; lblR.textContent='DÉFINITION';
  colL.appendChild(lblL); colR.appendChild(lblR);

  shuffledL.forEach(function(item){
    var d=document.createElement('div'); d.className='match-item';
    d.textContent=item.text; d.setAttribute('data-idx',''+item.idx); d.setAttribute('data-side','L');
    (function(el,i){el.onclick=function(){if(!answered)selectMatchItem(el,'L',i,pairs,wrap);};})(d,item.idx);
    colL.appendChild(d);
  });
  shuffledR.forEach(function(item){
    var d=document.createElement('div'); d.className='match-item';
    d.textContent=item.text; d.setAttribute('data-idx',''+item.idx); d.setAttribute('data-side','R');
    (function(el,i){el.onclick=function(){if(!answered)selectMatchItem(el,'R',i,pairs,wrap);};})(d,item.idx);
    colR.appendChild(d);
  });

  wrap.appendChild(colL); wrap.appendChild(colR);
  area.appendChild(wrap);
}

function selectMatchItem(el,side,itemIdx,pairs,wrap){
  // itemIdx renommé — évite conflit avec la variable globale idx (question courante)
  if(el.classList.contains('matched-ok')||el.classList.contains('matched-err')) return;
  if(side==='L'){
    wrap.querySelectorAll('.match-item[data-side="L"]').forEach(function(x){x.classList.remove('selected');});
    el.classList.add('selected');
    matchSelLeft=itemIdx;
  } else if(side==='R'&&matchSelLeft!==null){
    var ok=(matchSelLeft===itemIdx);
    var leftEl=wrap.querySelector('.match-item[data-side="L"][data-idx="'+matchSelLeft+'"]');
      if(ok){
        if(leftEl){leftEl.classList.remove('selected');leftEl.classList.add('matched-ok');}
        el.classList.add('matched-ok');
      } else {
        if(leftEl){leftEl.classList.add('match-flash-err');setTimeout(function(){if(leftEl){leftEl.classList.remove('match-flash-err','selected');}},500);}
        el.classList.add('match-flash-err');setTimeout(function(){el.classList.remove('match-flash-err');},500);
      }
    matchMatched.push({l:matchSelLeft,r:itemIdx,ok:ok});
    matchSelLeft=null;
    var done=wrap.querySelectorAll('.matched-ok').length;
    if(done>=pairs.length*2){
      var allOk=matchMatched.every(function(m){return m.ok;});
      // En mode online, utiliser la question online ; sinon la question solo
      var curQ = (window.onlineSession && window.onlineSession.code && window._curOnlineQ)
        ? window._curOnlineQ
        : session[idx];
      if(!allOk){
        var matchCorrectStr = pairs.map(function(p){return p.l+' → '+p.r;}).join(' | ');
        if(!(window.onlineSession && window.onlineSession.code)){
          errors.push({q:curQ?curQ.q:'match',yours:'Associations incorrectes',correct:matchCorrectStr,x:curQ?curQ.x||'':'',orig:curQ,mech:'match'});
        }
      }
      resolveCommon(allOk,curQ||{q:'',x:'',t:'match'});
    }
  }
}

// =====================================================
// MODE INVERSÉ
// =====================================================
function renderInverse(q,area){
  var ansDisp='';
  if(q.t==='qcm'||q.t==='debug'){
    var ao=q.opts[q.a];
    ansDisp=(typeof ao==='object'&&ao&&ao.v!==undefined)?String(ao.v)+(ao.sub?' ('+ao.sub+')':''):String(ao);
  } else if(q.t==='tf') ansDisp=q.a===true?'VRAI':'FAUX';
  else if(q.t==='fill') ansDisp=String(q.opts[q.a]);
  else ansDisp=String(q.a);
  var box=document.createElement('div'); box.className='inv-answer-box';
  box.innerHTML='<span class="inv-answer-label">A QUELLE QUESTION CORRESPOND CETTE REPONSE ?</span><div class="inv-answer-val">'+escapeUserHtml(ansDisp)+'</div>';
  area.appendChild(box);
  var realQ=q.q;
  var pool=session.filter(function(x){return x.q!==realQ;});
  var fakes=shuffle(pool).slice(0,3).map(function(x){return x.q;});
  while(fakes.length<3) fakes.push('Aucune de ces propositions');
  var allOpts=shuffle([realQ].concat(fakes));
  var wrap=document.createElement('div'); wrap.className='opts';
  ['A','B','C','D'].forEach(function(k,ii){
    if(ii>=allOpts.length) return;
    var b=document.createElement('button'); b.className='opt';
    b.innerHTML='<span class="okey">'+k+'</span><span>'+safeQuestionHtml(allOpts[ii])+'</span>';
    b.setAttribute('data-inv-correct', allOpts[ii]===realQ ? '1' : '0');
    (function(btn,optText,isOk){
      btn.onclick=function(){
        if(answered) return;
        clearInterval(timerInt); answered=true;
        wrap.querySelectorAll('.opt').forEach(function(x){x.disabled=true;});
        wrap.querySelectorAll('.opt').forEach(function(x){
          if(x.getAttribute('data-inv-correct')==='1') x.classList.add('ok');
        });
        btn.classList.add(isOk?'ok':'err');
        if(!isOk) errors.push({q:'[INVERSE] '+ansDisp,yours:optText,correct:realQ,x:q.x,orig:q,mech:'inverse'});
        resolveCommon(isOk,q);
      };
    })(b,allOpts[ii],allOpts[ii]===realQ);
    wrap.appendChild(b);
  });
  area.appendChild(wrap);
}

// =====================================================
// MODE SPEEDRUN
// =====================================================
var srStartTime=0, srElapsed=0, srInt2=null;
function initSpeedrun(){
  srStartTime=Date.now(); srElapsed=0;
  clearInterval(srInt2);
  var hud=document.getElementById('speedrun-hud');
  if(hud) hud.style.display='flex';
  srInt2=setInterval(function(){
    srElapsed=(Date.now()-srStartTime)/1000;
    var te=document.getElementById('sr-time');
    if(te) te.textContent=srElapsed.toFixed(1)+'s';
  },100);
}
function stopSpeedrun(){
  clearInterval(srInt2);
  var best=lsGet('tssr5_sr_best',{});
  var key=selCat||'mix';
  var prev=best[key]||9999;
  if(correct>=session.length&&srElapsed<prev){
    best[key]=Math.round(srElapsed*10)/10;
    lsSet('tssr5_sr_best',best);
    return true;
  }
  return false;
}

// =====================================================
// MODULE : SYSTÈME DE SEED (rejouabilité)
// =====================================================
var currentSeed='';

function seededRNG(seed){
  // Simple LCG seeded random — même seed = même séquence
  var s=0;
  for(var i=0;i<seed.length;i++) s=(s*31+seed.charCodeAt(i))&0x7fffffff;
  return function(){s=(s*1103515245+12345)&0x7fffffff;return s/0x7fffffff;};
}

function seededShuffle(arr,rng){
  var b=arr.slice();
  for(var i=b.length-1;i>0;i--){var j=Math.floor(rng()*(i+1));var t=b[i];b[i]=b[j];b[j]=t;}
  return b;
}

function genSeed(){
  var chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var s='';for(var i=0;i<6;i++) s+=chars[Math.floor(Math.random()*chars.length)];
  var inp=document.getElementById('seed-input');
  if(inp) inp.value=s;
  currentSeed=s;
}

function copySeed(){
  var inp=document.getElementById('seed-input');
  if(!inp) return;
  currentSeed=inp.value.trim().toUpperCase();
  if(!currentSeed){genSeed();currentSeed=document.getElementById('seed-input').value;}
  navigator.clipboard&&navigator.clipboard.writeText(currentSeed);
  inp.style.borderColor='#00a85a';
  setTimeout(function(){if(inp)inp.style.borderColor='';},1200);
}

function applyCurrentSeed(){
  var inp=document.getElementById('seed-input');
  if(inp) currentSeed=inp.value.trim().toUpperCase();
}

// =====================================================
// MODULE : FEEDBACK TEMPS DE RÉPONSE
// =====================================================
var qStartTime=0, qTimes=[], betActive=false, rpgPoints=0;

function startQTimer(){qStartTime=Date.now();}

function getQTime(){
  if(!qStartTime) return 0;
  var t=Math.round((Date.now()-qStartTime)/10)/100;
  qTimes.push(t);
  qStartTime=0; // reset pour éviter double-comptage
  return t;
}

function getTimeBadge(t){
  if(t<5) return '<span class="time-badge time-fast">⚡ '+t.toFixed(1)+'s RAPIDE</span>';
  if(t<12) return '<span class="time-badge time-ok">⏱ '+t.toFixed(1)+'s OK</span>';
  return '<span class="time-badge time-slow">🐢 '+t.toFixed(1)+'s LENT</span>';
}

function showTimeSummary(){
  var ts=document.getElementById('time-summary');
  if(!ts) return;
  if(!qTimes||!qTimes.length){ts.style.display='none';return;}
  var avg=qTimes.reduce(function(a,b){return a+b;},0)/qTimes.length;
  var best=Math.min.apply(null,qTimes);
  var pct=session.length>0?Math.round(correct/session.length*100):0;
  ts.style.display='flex';
  var tsAvg=document.getElementById('ts-avg');if(tsAvg)tsAvg.textContent=avg.toFixed(1)+'s';
  var tsBest=document.getElementById('ts-best');if(tsBest)tsBest.textContent=best.toFixed(1)+'s';
  var tsAcc=document.getElementById('ts-acc');if(tsAcc)tsAcc.textContent=pct+'%';
}

// =====================================================
// MODULE : ANIMATIONS BONNE/MAUVAISE RÉPONSE
// =====================================================
function animCorrect(){
  var card=document.getElementById('qcard');
  if(!card) return;
  card.classList.remove('anim-wrong');
  void card.offsetWidth;
  card.classList.add('anim-correct');
  setTimeout(function(){card&&card.classList.remove('anim-correct');},500);
}
function animWrong(){
  var card=document.getElementById('qcard');
  if(!card) return;
  card.classList.remove('anim-correct');
  void card.offsetWidth;
  card.classList.add('anim-wrong');
  setTimeout(function(){card&&card.classList.remove('anim-wrong');},400);
}

// =====================================================
// MODULE : SYSTÈME DE PARI
// =====================================================
var BET_CHANCE=0.25; // 25% de chance de pari proposé
var betOn=false;

function maybeShowBet(){
  betOn=false;
  var bar=document.getElementById('bet-bar');
  if(!bar) return;
  if(selMode==='chill'||selMode==='speed'||selMode==='survie'){
    if(Math.random()<BET_CHANCE&&idx>0){
      bar.style.display='flex';
    } else {
      bar.style.display='none';
    }
  } else {
    bar.style.display='none';
  }
}

function activateBet(){
  betOn=true;
  var bar=document.getElementById('bet-bar');
  if(bar){
    bar.innerHTML='<span class="bet-active">💰 PARI ACTIF — x2 si bon, -1 vie si faux</span>';
  }
}

function resolveBet(ok){
  if(!betOn) return;
  betOn=false;
  var bar=document.getElementById('bet-bar');
  if(ok){
    correct++; // bonus point
    showRPGPoints('+2x',ok);
  } else {
    if(lives!==99) lives--;
    updLives();
  }
  if(bar) bar.style.display='none';
}

// =====================================================
// MODULE : ÉVÉNEMENTS ALÉATOIRES
// =====================================================
var EVENT_CHANCE=0.12; // 12% par question
var activeEvent=null;
var eventTimerMult=1;

var EVENTS=[
  {id:'panne',cls:'panne',icon:'📡',text:'PANNE RÉSEAU — Timer x2 !',effect:function(){eventTimerMult=2;},clear:function(){eventTimerMult=1;}},
  {id:'maintenance',cls:'maintenance',icon:'🔧',text:'MAINTENANCE — Question gratuite !',effect:function(){if(!answered){answered=true;var qm=session[idx];if(qm)resolveCommon(true,qm);}},clear:function(){}},
  {id:'bonus',cls:'maintenance',icon:'⭐',text:'BOOST — Combo x3 !',effect:function(){combo=Math.max(combo,3);},clear:function(){}},
  {id:'joker_event',cls:'maintenance',icon:'💡',text:'CHANCE — Joker offert !',effect:function(){jokers=Math.min(jokers+1,5);var jc=document.getElementById('jcount');if(jc)jc.textContent=jokers;},clear:function(){}},
];

function maybeFireEvent(){
  if(Math.random()>EVENT_CHANCE) return;
  if(activeEvent) return;
  var e=EVENTS[Math.floor(Math.random()*EVENTS.length)];
  activeEvent=e;
  var banner=document.getElementById('event-banner');
  if(!banner) return;
  banner.className='event-banner show '+e.cls;
  document.getElementById('event-icon').textContent=e.icon;
  document.getElementById('event-text').textContent=e.text;
  if(e.effect) e.effect();
  if(e.id!=='latence'&&e.id!=='maintenance'){
    setTimeout(dismissEvent,3500);
  }
}

function dismissEvent(){
  if(activeEvent&&activeEvent.clear) activeEvent.clear();
  activeEvent=null; eventTimerMult=1;
  var banner=document.getElementById('event-banner');
  if(banner) banner.classList.remove('show');
}

// =====================================================
// MODULE : MODE CHAOS
// =====================================================
var CHAOS_CHANCE=0.07; // 7% par question
var chaosActive=false, chaosInt=null;

function maybeChaos(){
  if(chaosActive||Math.random()>CHAOS_CHANCE) return;
  chaosActive=true;
  document.body.classList.add('chaos-mode');
  var badge=document.getElementById('chaos-badge');
  if(badge) badge.style.display='block';
  // Timer instable
  var origTimer=timeLeft;
  chaosInt=setInterval(function(){
    if(!chaosActive) return;
    timeLeft+=Math.random()<0.4?-2:1;
    timeLeft=Math.max(1,Math.min(timeLeft,30));
  },300);
  // Points bonus x2 pendant chaos
  combo=Math.max(combo,2);
  // Fin chaos après 8s ou question suivante
  setTimeout(endChaos,8000);
}

function endChaos(){
  if(!chaosActive) return;
  chaosActive=false;
  clearInterval(chaosInt);
  document.body.classList.remove('chaos-mode');
  var badge=document.getElementById('chaos-badge');
  if(badge) badge.style.display='none';
}

// =====================================================
// MODULE : MODE RPG (tickets incidents)
// =====================================================
var rpgQ=null; // question courante RPG

var RPG_TICKETS=[
  {id:'easy',cls:'easy',diff:1,label:'FACILE ★',reward:10,risk:'Pas de pénalité',mechFilter:['qcm','tf']},
  {id:'medium',cls:'medium',diff:2,label:'MOYEN ★★',reward:25,risk:'-1 vie si faux',mechFilter:['qcm','fill','debug']},
  {id:'hard',cls:'hard',diff:3,label:'DIFFICILE ★★★',reward:50,risk:'-2 vies si faux',mechFilter:['qcm','debug','calc','word']},
];

function startChaosMode(){
  // Construire le pool normal puis lancer le mode chaos
  var pool=CATS[selCat]?CATS[selCat].qs:CATS['mix'].qs;
  if(selDiff!=='all') pool=pool.filter(function(q){return q.d===parseInt(selDiff);});
  if(!pool.length) pool=CATS[selCat]?CATS[selCat].qs:CATS['mix'].qs;
  var count=Math.min(selQCount===9999?15:selQCount,pool.length);
  session=freshShuffle(pool).slice(0,count);
  markShown(session);
  correct=0;combo=1;maxCombo=1;errors=[];idx=0;paused=false;
  bonusStreak=0;qTimes=[];rpgPoints=0;betOn=false;
  lives=MODES['chaos'].lives;
  jokers=3;
  sStats={cat:selCat,mode:'chaos',maxCombo:0,mechs:new Set(),streak:streakD.current};
  applyBody();
  updateStreak();
  el('gbadge').textContent='🌀 CHAOS · '+( CATS[selCat]?CATS[selCat].label:'MIX');
  var sh=el('score-hud');if(sh)sh.style.display='grid';
  el('htotal').textContent=session.length;
  buildDots();
  showScreen('game');
  startChaos();
  // Premier événement
  triggerChaosEvent();
}

function startRPG(){
  rpgPoints=0; lives=5; qTimes=[]; rpgQ=null;
  var pool=CATS[selCat]&&selCat!=='_multi'?CATS[selCat].qs:session.length?session:CATS['mix'].qs;
  if(selCat==='_multi'&&session.length) pool=session;
  else{
    if(selDiff!=='all') pool=pool.filter(function(q){return q.d===parseInt(selDiff);});
    if(!pool.length) pool=CATS[selCat].qs||[];
  }
  session=freshShuffle(pool).slice(0,Math.min(selQCount===9999?30:selQCount,pool.length));
  markShown(session);
  idx=0;correct=0;combo=1;errors=[];
  applyBody();
  el('gbadge').textContent='🎭 RPG · '+CATS[selCat].label.toUpperCase();
  var sh=el('score-hud');if(sh)sh.style.display='grid';
  el('htotal').textContent=session.length;
  updateStreak();
  buildDots();
  showScreen('game');
  showRPGTickets();
}

function showRPGTickets(){
  if(idx>=session.length){showResults();return;}
  var ovl=document.getElementById('rpg-overlay');
  var container=document.getElementById('rpg-tickets');
  var scoreEl=document.getElementById('rpg-score');
  if(!ovl||!container) return;
  if(scoreEl) scoreEl.textContent=rpgPoints;

  container.innerHTML='';

  var TDEFS=[
    {id:'easy',cls:'easy',diff:1,label:'P1 — FACILE',reward:10,risk:'Aucun risque',mechFilter:['qcm','tf','fill']},
    {id:'medium',cls:'medium',diff:2,label:'P2 — MOYEN',reward:25,risk:'-1 vie si faux',mechFilter:['qcm','debug','fill','calc']},
    {id:'hard',cls:'hard',diff:3,label:'P3 — DIFFICILE',reward:50,risk:'-2 vies si faux',mechFilter:['qcm','debug']},
  ];

  var remaining=session.slice(idx);

  TDEFS.forEach(function(t){
    // Chercher une question compatible — d'abord par difficulté+type, sinon par difficulté seule
    var pool=remaining.filter(function(q){return q.d===t.diff&&t.mechFilter.indexOf(q.t)>-1&&q.opts;});
    if(!pool.length) pool=remaining.filter(function(q){return q.d===t.diff&&q.opts;});
    if(!pool.length) pool=remaining.filter(function(q){return q.opts;}); // fallback any
    if(!pool.length) return; // skip if no compatible question at all
    var q=pool[Math.floor(Math.random()*pool.length)];

    var cat=q._cat||(CATS[selCat]?CATS[selCat].label:'Quiz');
    var catIcon=Object.values(CATS).find(function(c){return c.label===cat;});
    var icon=catIcon?catIcon.icon:'📋';
    var mechLabels={qcm:'QCM',tf:'Vrai/Faux',fill:'Compléter',debug:'Débug',calc:'Calcul',word:'Sélection',order:'Ordre',match:'Associer'};

    var card=document.createElement('div');
    card.className='rpg-ticket '+t.cls;
    card.innerHTML=
      '<div class="rpg-ticket-header">'+
        '<span class="rpg-ticket-priority">'+t.label+'</span>'+
        '<span class="rpg-ticket-reward-badge">+'+t.reward+' pts</span>'+
      '</div>'+
      '<div class="rpg-ticket-body">'+
        '<span class="rpg-ticket-title">'+icon+' '+cat+'</span>'+
        '<div class="rpg-ticket-meta">'+
          '<span class="rpg-ticket-tag">'+mechLabels[q.t]+'</span>'+
          '<span class="rpg-ticket-tag">'+DS[q.d]||'★'+'</span>'+
          '<span class="rpg-ticket-risk">⚠ '+t.risk+'</span>'+
        '</div>'+
      '</div>';

    (function(ticket,question){
      card.onclick=function(){
        rpgQ={ticket:ticket,q:question};
        // Ramener la question à la position courante
        var qi=session.indexOf(question);
        if(qi>idx){var tmp=session[idx];session[idx]=question;session[qi]=tmp;}
        ovl.classList.remove('show');
        showQ();
      };
    })(t,q);

    container.appendChild(card);
  });

  ovl.classList.add('show');
}

function resolveRPG(ok){
  if(!rpgQ) return;
  var t=rpgQ.ticket;
  if(ok){
    rpgPoints+=t.reward;
    showRPGPoints('+'+t.reward+' pts', true);
  } else {
    var penalty=t.diff===3?2:1;
    if(lives!==99) lives=Math.max(0,lives-penalty);
    updLives();
    showRPGPoints('-'+penalty+' ❤', false);
  }
  rpgQ=null;
}

function showRPGPoints(text,ok){
  var el2=document.createElement('div');
  el2.className='rpg-pts-popup';
  el2.textContent=text;
  el2.style.cssText='position:fixed;top:40%;left:50%;transform:translateX(-50%);color:'+(ok?'#00a85a':'#dc2626')+';text-shadow:0 0 10px '+(ok?'rgba(0,168,90,.5)':'rgba(220,38,38,.5)')+';';
  document.body.appendChild(el2);
  setTimeout(function(){el2.remove();},1300);
}

// =====================================================
// DIFFICULTÉ DYNAMIQUE
// =====================================================
var dynDiffStreak=0, dynDiffLevel=0;

function updateDynDiff(ok){
  if(selMode!=='chill'&&selMode!=='speed'&&selMode!=='survie') return;
  if(ok){
    dynDiffStreak++;
    if(dynDiffStreak===3&&dynDiffLevel<2){
      dynDiffLevel++;
      dynDiffStreak=0;
      showDynToast('↑ NIVEAU SUPÉRIEUR !','up');
    }
  } else {
    dynDiffStreak=0;
    if(dynDiffLevel>0){dynDiffLevel--;showDynToast('↓ Retour au niveau','down');}
  }
}

function showDynToast(msg,type){
  var t=document.createElement('div');
  t.className='dyn-diff-toast dyn-'+type;
  t.textContent=msg;
  document.body.appendChild(t);
  setTimeout(function(){if(t.parentNode)t.remove();},1400);
}

// =====================================================
// UI SWITCHER
// =====================================================
var currentUI = 'ui-arcade';

function switchUI(ui){
  playThemeChange();
  currentUI = ui;
  lsSet('tssr5_ui', ui);
  applyUI();
}

function applyUI(){
  // Remove all ui classes, keep others
  document.body.classList.remove('ui-arcade','ui-paper','ui-terminal','ui-minimal','ui-neon');
  document.body.classList.add(currentUI||'ui-neon');
  window.uiStyle=currentUI||'ui-neon';

  // Sync switcher buttons
  document.querySelectorAll('.ui-sw-btn, .settings-da-btn').forEach(function(b){
    b.classList.toggle('sel', b.getAttribute('data-ui')===(currentUI||'ui-neon'));
  });

  // Logo adaptatif
  var logo=document.getElementById('logo');
  if(logo){
    if(currentUI==='ui-terminal') logo.textContent='> TSSRQUIZZ.exe';
    else if(currentUI==='ui-paper'){
      var num=lsGet('tssr5_dossier',Math.floor(Math.random()*9000+1000));
      lsSet('tssr5_dossier',num);
      logo.textContent='DOSSIER N° '+num;
    }
    else if(currentUI==='ui-minimal') logo.textContent='TSSRQUIZZ';
    else if(currentUI==='ui-neon') logo.textContent='TSSR·QUIZZ';
    else logo.textContent='📚 TSSRQUIZZ';
  }

  // Sub-title adaptatif
  var sub=document.getElementById('header-sub');
  if(sub){
    if(currentUI==='ui-terminal') sub.textContent='[SYSTÈME PRÊT] 282 questions chargées';
    else if(currentUI==='ui-paper') sub.textContent='FORMULAIRE DE RÉVISION — CONFIDENTIEL';
    else if(currentUI==='ui-minimal') sub.textContent='282 questions · 15 catégories';
    else if(currentUI==='ui-neon') sub.textContent='Quiz Réseaux & Systèmes · 700 questions';
    else sub.textContent='Basé sur ton Notion · 282 questions';
  }
}

// =====================================================
// MODE CHAOS DÉDIÉ
// =====================================================
var CHAOS_EVENTS=[
  {icon:'🌀',title:'TIMER RÉDUIT !',desc:'Tu as 8 secondes par question.',effect:function(){window._chaosTimerOverride=8;}},
  {icon:'🔀',title:'OPTIONS MÉLANGÉES !',desc:'Les choix changent de position.',effect:function(){window._chaosShuffleExtra=true;}},
  {icon:'⚡',title:'DOUBLE OU RIEN !',desc:'Bonne réponse = +2 points. Fausse = -1 vie.',effect:function(){window._chaosDouble=true;}},
  {icon:'🌑',title:'QUESTION CACHÉE !',desc:'La question apparaît en 3... 2... 1...',effect:function(){window._chaosBlind=true;}},
  {icon:'💥',title:'DERNIÈRE CHANCE !',desc:'1 vie restante. Bonne chance.',effect:function(){if(lives>1)lives=1;updLives();}},
  {icon:'🎁',title:'BONUS !',desc:'Question gratuite offerte !',effect:function(){window._chaosFree=true;}},
];

var chaosEventActive=false, chaosEventData=null;

function startChaos(){
  // Reset chaos flags
  window._chaosTimerOverride=null;
  window._chaosShuffleExtra=false;
  window._chaosDouble=false;
  window._chaosBlind=false;
  window._chaosFree=false;

  document.body.classList.add('chaos-active');
  var badge=document.getElementById('chaos-badge');
  if(badge) badge.style.display='block';

  // Show random chaos event before each question
  triggerChaosEvent();
}

function triggerChaosEvent(){
  // 60% chance dun événement
  if(Math.random()>0.6){showQ();return;}
  var ev=CHAOS_EVENTS[Math.floor(Math.random()*CHAOS_EVENTS.length)];
  chaosEventData=ev;
  var ovl=document.getElementById('chaos-event-overlay');
  if(!ovl){showQ();return;}
  document.getElementById('chaos-event-title').textContent=ev.icon+' '+ev.title;
  document.getElementById('chaos-event-desc').textContent=ev.desc;
  document.getElementById('chaos-countdown').textContent=ev.icon;
  // Reset previous flags
  window._chaosTimerOverride=null;window._chaosShuffleExtra=false;
  window._chaosDouble=false;window._chaosBlind=false;window._chaosFree=false;
  if(ev.effect) ev.effect();
  ovl.classList.add('show');
}

function dismissChaosEvent(){
  var ovl=document.getElementById('chaos-event-overlay');
  if(ovl) ovl.classList.remove('show');
  chaosEventData=null;
  // If free question, skip
  if(window._chaosFree){
    window._chaosFree=false;
    var q=session[idx];
    if(q) resolveCommon(true,q);
    return;
  }
  showQ();
}

function stopChaosMode(){
  document.body.classList.remove('chaos-active');
  var badge=document.getElementById('chaos-badge');
  if(badge) badge.style.display='none';
  window._chaosTimerOverride=null;window._chaosShuffleExtra=false;
  window._chaosDouble=false;window._chaosBlind=false;window._chaosFree=false;
}

// Override maybeChaos pour ne plus déclencher en dehors du mode chaos
function maybeChaos(){
  // Ne rien faire — chaos est maintenant un mode dédié
}
// Override maybeFireEvent pour ne plus déclencher en dehors du mode chaos
function maybeFireEvent(){
  // Événements désactivés hors mode chaos
}
// =====================================================
// MODE RPG NARRATIF — Système de tickets incidents
// =====================================================
// Architecture :
// - 8 scénarios indépendants
// - Barre de confiance (0-100, démarre à 50)
// - Chaque scénario a : situation, 4-5 actions, questions liées
// - Actions types : BONNE_PISTE, NEUTRE, MAUVAISE_PISTE
// - Fin : confiance à 100 = promu, à 0 = viré

; // fin RPG

// =====================================================
// QUESTIONS LIÉES AUX SCÉNARIOS
// =====================================================
var RPG_QUESTIONS = {

  winrm_port: {
    q: "Quel port WinRM utilise-t-il par défaut pour les connexions HTTP ?",
    opts: ["Port 443","Port 5985","Port 3389","Port 8080"],
    a: 1,
    x: "WinRM utilise le port 5985 (HTTP) et 5986 (HTTPS). Le pare-feu doit autoriser ce port pour que PowerShell Remoting fonctionne."
  },
  winrm_trustedhosts: {
    q: "Quelle commande configure les TrustedHosts WinRM sur le client ?",
    opts: [
      "Set-Item WSMan:\\\\localhost\\\\Client\\\\TrustedHosts -Value 'SRV-PROD'",
      "Add-WinRMHost -Name SRV-PROD",
      "New-PSSession -TrustHost SRV-PROD",
      "Enable-WSManCredSSP -Role Client -DelegateComputer SRV-PROD"
    ],
    a: 0,
    x: "En workgroup, le client doit déclarer les hôtes distants dans TrustedHosts. Cette commande est nécessaire car sans domaine AD, il n'y a pas de Kerberos pour l'authentification mutuelle."
  },
  winrm_enable: {
    q: "Que fait la commande Enable-PSRemoting -Force ?",
    opts: [
      "Active uniquement le service WinRM",
      "Configure WinRM, crée les listeners et les règles pare-feu",
      "Ouvre une session PowerShell distante",
      "Ajoute l'hôte dans TrustedHosts"
    ],
    a: 1,
    x: "Enable-PSRemoting fait tout en une commande : démarre WinRM, configure les listeners HTTP/HTTPS et crée les règles de pare-feu Windows nécessaires."
  },
  dns_service_restart: {
    q: "Comment redémarrer le service DNS Server en PowerShell ?",
    opts: [
      "Restart-Service DNS",
      "Start-Service -Name 'dns-server'",
      "Restart-Service -Name 'DNS'",
      "Invoke-Command {Start DNS}"
    ],
    a: 2,
    x: "Restart-Service -Name 'DNS' redémarre le service DNS Server Windows. Le nom exact du service est 'DNS'. Alternatives : net stop DNS && net start DNS, ou via la console DNS."
  },
  dns_soa: {
    q: "Que contient un enregistrement SOA (Start Of Authority) ?",
    opts: [
      "Uniquement les adresses IP des hôtes",
      "Le serveur de noms primaire, le TTL, le numéro de série et les délais de réplication",
      "Les enregistrements MX et CNAME uniquement",
      "La liste des serveurs secondaires autorisés"
    ],
    a: 1,
    x: "Le SOA contient : serveur DNS primaire, email de l'administrateur, numéro de série (incrémenté à chaque modif), TTL, durée de refresh/retry/expire. C'est la carte d'identité de la zone."
  },
  vlan_svi: {
    q: "Comment activer une SVI Vlan20 qui est en 'down' ?",
    opts: [
      "interface vlan 20 → ip address ... → shutdown",
      "vlan 20 → state active",
      "interface vlan 20 → no shutdown",
      "switchport mode access vlan 20"
    ],
    a: 2,
    x: "Une SVI désactivée se réactive avec 'no shutdown' dans le mode interface Vlan. Il faut aussi s'assurer que le VLAN existe dans la base de données VLAN (show vlan brief)."
  },
  vlan_ip_routing: {
    q: "Quelle commande active le routage inter-VLAN sur un switch L3 Cisco ?",
    opts: [
      "router ospf 1",
      "ip routing",
      "routing enable",
      "switchport mode trunk"
    ],
    a: 1,
    x: "La commande 'ip routing' en mode config global active le moteur de routage IP sur le switch L3. Sans elle, les SVIs ont des IPs mais le switch ne route pas entre elles."
  },
  vlan_trunk: {
    q: "Comment ajouter le VLAN 20 à la liste des VLANs autorisés sur un trunk ?",
    opts: [
      "switchport trunk allowed vlan add 20",
      "vlan 20 allowed trunk",
      "switchport access vlan 20",
      "trunk vlan 20 permit"
    ],
    a: 0,
    x: "La commande 'switchport trunk allowed vlan add 20' AJOUTE le VLAN 20 sans supprimer les autres. Sans le mot-clé 'add', la commande remplace toute la liste."
  },
  hyperv_snapshot: {
    q: "Que faut-il faire avec des snapshots Hyper-V corrompus ou orphelins ?",
    opts: [
      "Les supprimer directement depuis l'Explorateur Windows",
      "Les fusionner ou supprimer depuis le Gestionnaire Hyper-V",
      "Recréer la VM pour éviter les problèmes",
      "Les déplacer dans un autre dossier"
    ],
    a: 1,
    x: "Les snapshots Hyper-V (.avhdx) doivent être gérés depuis le Gestionnaire Hyper-V. La fusion (merge) intègre les changements dans le VHDX parent. Ne jamais les supprimer manuellement."
  },
  hyperv_disk_path: {
    q: "Comment modifier le chemin dun disque dur dans une VM Hyper-V ?",
    opts: [
      "Modifier directement le fichier .vmcx avec un éditeur texte",
      "Via Paramètres VM → Contrôleur SCSI → Disque dur → Modifier le chemin",
      "Set-VM -DiskPath 'nouveau chemin'",
      "Déplacer le VHDX puis redémarrer"
    ],
    a: 1,
    x: "Dans le Gestionnaire Hyper-V, Paramètres de la VM → sélectionner le disque dur → modifier le chemin. En PowerShell : Set-VMHardDiskDrive avec le paramètre -Path."
  },
  ntfs_deny: {
    q: "Dans les permissions NTFS, quelle règle s'applique en cas de conflit Allow/Deny ?",
    opts: [
      "Allow est prioritaire sur Deny",
      "La permission la plus récente gagne",
      "Deny est toujours prioritaire sur Allow",
      "L'héritage prend toujours le dessus"
    ],
    a: 2,
    x: "Deny est TOUJOURS prioritaire sur Allow dans les ACL NTFS, quelle que soit l'origine (directe ou héritée). C'est pourquoi un Deny explicite sur un compte écrase tous les Allow de ses groupes."
  },
  ntfs_group_deny: {
    q: "Un utilisateur est dans GRP-RH (Allow Lecture) et GRP-STAGIAIRES (Deny Lecture). Que se passe-t-il ?",
    opts: [
      "Il peut lire car GRP-RH lui donne Allow",
      "Il ne peut pas lire car le Deny de GRP-STAGIAIRES prime",
      "Les deux permissions s'annulent — accès bloqué par défaut",
      "Cela dépend de l'ordre des groupes dans l'AD"
    ],
    a: 1,
    x: "Deny prime toujours. Même si GRP-RH accorde Allow, le Deny de GRP-STAGIAIRES l'emporte. Solution : retirer l'utilisateur de GRP-STAGIAIRES ou supprimer le Deny explicite."
  },
  stp_portfast: {
    q: "Que fait PortFast sur un port Cisco et sur quel type de port l'utiliser ?",
    opts: [
      "Accélère STP pour les ports trunk uniquement",
      "Passe le port directement en Forwarding — à utiliser sur les ports d'extrémité (PC, serveurs)",
      "Désactive STP sur le port complètement",
      "Force le port en Root Port"
    ],
    a: 1,
    x: "PortFast fait passer le port directement en Forwarding sans passer par Listening/Learning (30s économisées). À réserver aux ports d'extrémité. Sur un port trunk vers un switch, PortFast peut causer des boucles."
  },
  stp_bpduguard: {
    q: "Que fait BPDU Guard et pourquoi l'activer avec PortFast ?",
    opts: [
      "Il bloque tous les VLANs sur le port",
      "Il désactive le port (err-disabled) si une BPDU est reçue — protège contre les switches non autorisés",
      "Il force le port à rester en Blocking",
      "Il prévient les boucles en augmentant la priorité STP"
    ],
    a: 1,
    x: "BPDU Guard passe le port en err-disabled dès qu'une BPDU est reçue. Couplé à PortFast, il protège contre la connexion dun switch non autorisé sur un port d'accès."
  },
  dhcp_scope: {
    q: "Quelle action immédiate pour résoudre un pool DHCP épuisé ?",
    opts: [
      "Redémarrer le serveur DHCP",
      "Étendre la plage d'adresses du scope ou créer un nouveau scope",
      "Supprimer tous les baux et recommencer",
      "Passer en adressage statique"
    ],
    a: 1,
    x: "Pour un pool épuisé : étendre la plage existante (si adresses disponibles), supprimer les baux obsolètes, ou créer un superscope. La suppression des baux fantômes libère aussi des adresses rapidement."
  },
  dhcp_lease: {
    q: "Comment voir les baux actifs DHCP en PowerShell ?",
    opts: [
      "Get-DHCPServerv4Lease -ScopeId 192.168.1.0",
      "Show-DHCPLeases -Scope all",
      "Get-NetIPAddress -DHCPEnabled $true",
      "ipconfig /showclassid"
    ],
    a: 0,
    x: "Get-DhcpServerv4Lease -ScopeId permet de lister tous les baux dun scope. Avec | Where-Object {$_.AddressState -eq 'ActiveReservation'} pour filtrer les baux actifs."
  },
  cisco_ssh_rsa: {
    q: "Quelle séquence est nécessaire pour générer des clés RSA pour SSH sur Cisco ?",
    opts: [
      "Juste : crypto key generate rsa",
      "hostname → ip domain-name → crypto key generate rsa modulus 2048",
      "enable secret → crypto key generate",
      "ip ssh version 2 → crypto key generate rsa"
    ],
    a: 1,
    x: "L'ordre est crucial : 1) hostname (nom unique requis), 2) ip domain-name (requis pour nommer la clé), 3) crypto key generate rsa modulus 2048 (min 768 bits pour SSHv2)."
  },
  cisco_ssh_vty: {
    q: "Comment autoriser uniquement SSH (pas Telnet) sur les lignes VTY ?",
    opts: [
      "transport input ssh only",
      "transport input ssh",
      "no transport input telnet → transport input ssh",
      "line vty 0 4 → ssh enable"
    ],
    a: 1,
    x: "La commande 'transport input ssh' sur les lignes VTY nautorise que SSH. Si une commande 'transport input telnet' vient après, elle écrase la précédente — l'ordre dans la config est important."
  },
  cisco_acl: {
    q: "Une ACL bloque le port 22. Quelle commande retire une entrée dune ACL nommée ?",
    opts: [
      "no ip access-list extended MGMT deny tcp any any eq 22",
      "ip access-list extended MGMT → no [numéro de séquence]",
      "delete acl MGMT rule 22",
      "ip access-list remove MGMT deny 22"
    ],
    a: 1,
    x: "Dans une ACL nommée, on entre dans son mode config (ip access-list extended NOM) puis on supprime l'entrée par son numéro de séquence (visible avec 'show ip access-lists'). C'est plus précis que de recréer toute l'ACL."
  },
  cisco_ssh_domain: {
    q: "Sans ip domain-name, que se passe-t-il si on essaie de générer des clés RSA ?",
    opts: [
      "Les clés sont générées avec un nom par défaut",
      "L'erreur 'You must specify a key name' apparaît",
      "SSH fonctionne quand même sans domaine",
      "Cisco utilise l'hostname comme nom de clé automatiquement"
    ],
    a: 1,
    x: "Sans ip domain-name, Cisco ne peut pas nommer les clés RSA (le nom est hostname.domaine). La commande crypto key generate rsa échoue avec une erreur. Il faut configurer ip domain-name avant."
  },
};



// =====================================================
// SCÉNARIOS RPG — Structure enrichie
// Actions types: BONNE_PISTE, NEUTRE, MAUVAISE_PISTE
// sub_actions: sous-choix après laction principale
// direct_resolve: résolution narrative sans question
// =====================================================
// =====================================================
// 15 SCÉNARIOS RPG — VERSION ENRICHIE
// Chaque action mène à des conséquences → nouvelles actions → résolution
// Structure : action → conséquence/analyse → décision → résultat
// =====================================================

var RPG_SCENARIOS_V2 = [

// ======= 1. WINRM / RSAT =======
{
  id:'winrm', title:'TICKET #4471', prio:'P2 — URGENT',
  situation:'14h32. Un collègue ne peut pas administrer SRV-PROD depuis RSAT. Erreur : "Accès refusé — WinRM ne répond pas". Il doit effectuer une maintenance dans 30 minutes.',
  actions:[
    {id:'ping',label:'Tester la connectivité réseau vers SRV-PROD',type:'BONNE_PISTE',
     consequence:'Le ping répond en 1ms. SRV-PROD est joignable. Le problème n\'est pas réseau — c\'est une configuration WinRM ou pare-feu.',
     follow_up:'Le serveur répond. Tu dois maintenant comprendre pourquoi WinRM refuse la connexion malgré la connectivité.',
     follow_up_actions:[
       {id:'check_svc',label:'Vérifier l\'état du service WinRM (Get-Service WinRM)',type:'BONNE_PISTE',
        consequence:'Le service WinRM est Stopped. Il a été désactivé lors d\'un audit sécurité la semaine dernière. Tu dois le démarrer et reconfigurer.',
        question_id:'winrm_enable'},
       {id:'check_fw',label:'Vérifier les règles de pare-feu Windows (port 5985)',type:'BONNE_PISTE',
        consequence:'La règle autorisant le port 5985 est désactivée. WinRM tourne mais le pare-feu bloque les connexions entrantes.',
        question_id:'winrm_port'},
       {id:'check_listener',label:'Lister les listeners WinRM actifs',type:'NEUTRE',
        consequence:'Aucun listener actif. Cela confirme que le service WinRM n\'est pas configuré sur SRV-PROD.'},
     ]},
    {id:'trusted',label:'Vérifier les TrustedHosts côté client',type:'BONNE_PISTE',
     consequence:'La liste TrustedHosts est vide. En workgroup (sans domaine AD), le client doit déclarer SRV-PROD pour que l\'authentification NTLM fonctionne.',
     follow_up:'TrustedHosts vide confirmé. Tu dois décider comment corriger.',
     follow_up_actions:[
       {id:'add_trusted',label:'Ajouter SRV-PROD avec Set-Item WSMan:\\localhost\\Client\\TrustedHosts',type:'BONNE_PISTE',
        consequence:'La commande s\'exécute. Après avoir ouvert une nouvelle session, RSAT se connecte. Tu demandes à ton collègue de tester.',
        question_id:'winrm_trustedhosts'},
       {id:'add_all',label:'Mettre TrustedHosts à * (tous les hôtes)',type:'MAUVAISE_PISTE',malus:true,
        consequence:'ERREUR DE SÉCURITÉ. Accepter tous les hôtes expose le poste à des connexions non vérifiées. Le RSSI te contacte.'},
     ]},
    {id:'restart',label:'Redémarrer SRV-PROD pour forcer une réinitialisation',type:'MAUVAISE_PISTE',malus:true,
     consequence:'SRV-PROD est en production. 20 utilisateurs perdent leur connexion. Le chef reçoit une alerte et t\'appelle immédiatement.'},
    {id:'creds',label:'Vérifier les identifiants utilisés par le collègue',type:'NEUTRE',
     consequence:'Les identifiants sont valides — le compte admin local existe. Ce n\'est pas la cause.'},
    {id:'psremoting',label:'Lancer Enable-PSRemoting -Force sur SRV-PROD (console locale)',type:'BONNE_PISTE',
     consequence:'Tu accèdes directement à SRV-PROD. Enable-PSRemoting reconfigure tout en une commande : service, listeners, règles pare-feu.',
     question_id:'winrm_enable'},
  ],
  resolution_ok:'WinRM opérationnel. Le collègue accède à RSAT. Ton chef : "Bien joué, la maintenance peut avoir lieu."',
  resolution_fail:'Connexion toujours impossible. La maintenance est repoussée. Ton chef est mécontent.',
},

// ======= 2. DNS — panne site B =======
{
  id:'dns', title:'TICKET #3892', prio:'P1 — CRITIQUE',
  situation:'Alerte 9h15. Tous les postes du site B ont perdu accès aux ressources réseau. Erreur : "Serveur DNS introuvable". Le DSI a appelé. 80 utilisateurs sont bloqués.',
  actions:[
    {id:'check_svc',label:'Vérifier l\'état du service DNS sur le serveur',type:'BONNE_PISTE',
     consequence:'Le service DNS est Stopped. L\'heure d\'arrêt correspond à la mise à jour Windows automatique de 3h00 ce matin.',
     follow_up:'Service arrêté identifié. Avant de le redémarrer, tu dois vérifier si les zones sont intègres.',
     follow_up_actions:[
       {id:'check_zones',label:'Vérifier l\'intégrité des zones DNS avant redémarrage',type:'BONNE_PISTE',
        consequence:'Les zones semblent intègres. L\'enregistrement SOA a un numéro de série valide. Tu peux démarrer le service.',
        question_id:'dns_service_restart'},
       {id:'start_direct',label:'Démarrer le service DNS immédiatement sans vérification',type:'MAUVAISE_PISTE',malus:true,
        consequence:'Le service démarre mais la zone SOA est corrompue — erreur de réplication. Le DNS répond mais avec des données incorrectes.'},
       {id:'check_eventlog',label:'Consulter les journaux d\'événements DNS avant toute action',type:'BONNE_PISTE',
        consequence:'Event ID 4013 : zones AD non chargées au démarrage. La mise à jour a modifié les dépendances. Tu sais exactement quoi corriger.',
        question_id:'dns_soa'},
     ]},
    {id:'flush',label:'Vider le cache DNS sur les postes clients (ipconfig /flushdns)',type:'NEUTRE',
     consequence:'Cache vidé sur plusieurs postes. Le problème persiste — ce n\'est pas un problème de cache local.'},
    {id:'check_dc',label:'Vérifier si le contrôleur de domaine répond',type:'BONNE_PISTE',
     consequence:'Le DC répond en LDAP mais les requêtes DNS timeout. Cela confirme que c\'est le service DNS, pas l\'AD en lui-même.',
     follow_up:'DC opérationnel mais DNS mort. Le problème est isolé au service DNS.',
     follow_up_actions:[
       {id:'check_dns_dc',label:'Tester la résolution DNS depuis le DC lui-même',type:'BONNE_PISTE',
        consequence:'Même le DC ne peut pas résoudre ses propres enregistrements. Le service DNS est bien la cause racine.',
        question_id:'dns_service_restart'},
       {id:'change_dns_alt',label:'Pointer les postes vers un DNS alternatif (secondaire ou externe)',type:'NEUTRE',
        consequence:'Internet revient. Mais les ressources internes (partages, GPO) restent inaccessibles car le DNS interne n\'est pas rétabli.'},
     ]},
    {id:'pub_dns',label:'Changer les DNS des postes vers 8.8.8.8 en urgence',type:'MAUVAISE_PISTE',malus:true,
     consequence:'Internet revient mais les ressources AD sont inaccessibles. Tu as modifié la config sans validation. Le DSI demande une explication.'},
  ],
  resolution_ok:'Service DNS redémarré, zones intègres. Réseau rétabli en 3 minutes. Le DSI : "Réaction rapide, impact limité."',
  resolution_fail:'DNS en panne 45 minutes. Rapport d\'incident exigé. Ton chef prend note.',
},

// ======= 3. VLAN 20 inaccessible =======
{
  id:'vlan', title:'TICKET #5103', prio:'P2 — MOYEN',
  situation:'Le département RH (VLAN 20) ne peut plus accéder au serveur de fichiers depuis ce matin. Les autres VLANs fonctionnent. La responsable RH te relance toutes les 10 minutes.',
  actions:[
    {id:'check_svi',label:'Vérifier l\'état de la SVI Vlan20 sur le switch L3',type:'BONNE_PISTE',
     consequence:'L\'interface Vlan20 est en "down/down". Elle a probablement été désactivée manuellement. Tu es sur la bonne piste.',
     follow_up:'SVI down trouvée. Tu dois comprendre pourquoi avant d\'agir.',
     follow_up_actions:[
       {id:'check_who',label:'Regarder l\'historique des commandes (show logging)',type:'BONNE_PISTE',
        consequence:'Les logs montrent "Vlan20 shutdown" tapé hier à 23h12 par le compte "admin-maintenance". C\'était lors d\'un test qui n\'a pas été annulé.',
        question_id:'vlan_svi'},
       {id:'no_shutdown',label:'Faire un no shutdown sur Vlan20 directement',type:'BONNE_PISTE',
        consequence:'La SVI passe en "up/up". Le VLAN 20 retrouve sa connectivité vers les autres VLANs.',
        question_id:'vlan_svi'},
       {id:'check_vlan_db',label:'Vérifier que le VLAN 20 existe bien dans la base (show vlan brief)',type:'BONNE_PISTE',
        consequence:'Le VLAN 20 est actif dans la base et assigné aux bons ports. Le problème vient bien de la SVI.'},
     ]},
    {id:'check_routing',label:'Vérifier si ip routing est activé sur le switch L3',type:'BONNE_PISTE',
     consequence:'"show run | include ip routing" ne retourne rien. La commande a été retirée lors d\'une "simplification" de config.',
     follow_up:'ip routing absent. Sans lui, les SVIs ont des IPs mais le switch ne route pas.',
     follow_up_actions:[
       {id:'add_routing',label:'Activer ip routing en mode config global',type:'BONNE_PISTE',
        consequence:'Tu tapes "ip routing". Le switch commence immédiatement à router entre les VLANs. Le VLAN 20 retrouve son accès.',
        question_id:'vlan_ip_routing'},
       {id:'check_ospf',label:'Vérifier si OSPF ou un protocole de routage était actif',type:'NEUTRE',
        consequence:'Aucun protocole de routage dynamique. Le routage était statique via ip routing. Confirme le diagnostic.'},
     ]},
    {id:'check_trunk',label:'Vérifier la configuration du port trunk inter-switches',type:'BONNE_PISTE',
     consequence:'Le VLAN 20 n\'est plus dans la liste autorisée sur le trunk. Il a été retiré lors d\'un "nettoyage" récent.',
     follow_up:'VLAN 20 absent du trunk. Tu dois le rajouter.',
     follow_up_actions:[
       {id:'add_vlan_trunk',label:'Ajouter le VLAN 20 avec switchport trunk allowed vlan add 20',type:'BONNE_PISTE',
        consequence:'Le VLAN 20 est maintenant autorisé sur le trunk. Le trafic passe. La responsable RH confirme l\'accès.',
        question_id:'vlan_trunk'},
       {id:'replace_trunk',label:'Utiliser switchport trunk allowed vlan 20 (sans add)',type:'MAUVAISE_PISTE',malus:true,
        consequence:'ERREUR. Sans le mot "add", tous les autres VLANs sont supprimés du trunk. Panne généralisée.'},
     ]},
    {id:'restart_sw',label:'Redémarrer le switch RH',type:'MAUVAISE_PISTE',malus:true,
     consequence:'Tous les postes RH perdent la connexion pendant 3 minutes. Le problème n\'est pas résolu.'},
    {id:'check_acl',label:'Vérifier les ACL appliquées sur les interfaces VLAN',type:'NEUTRE',
     consequence:'Aucune ACL suspecte. Le problème est ailleurs.'},
  ],
  resolution_ok:'VLAN 20 opérationnel. Les RH accèdent au serveur de fichiers. Ton chef : "Bon diagnostic, cause trouvée."',
  resolution_fail:'VLAN 20 coupé 1h. Rapport d\'impact demandé.',
},

// ======= 4. HYPER-V VM ne démarre pas =======
{
  id:'hyperv', title:'TICKET #2267', prio:'P2 — URGENT',
  situation:'Un développeur ne peut plus démarrer sa VM de test. Erreur : "Disque non trouvé". Il a une démo dans 2 heures. La VM contient 3 mois de développement.',
  actions:[
    {id:'open_hv',label:'Ouvrir le Gestionnaire Hyper-V et inspecter la configuration',type:'BONNE_PISTE',
     consequence:'Dans Paramètres → Contrôleur SCSI → Disque dur, le chemin pointe vers D:\\VMs\\Dev-VM.vhdx mais ce dossier n\'existe pas.',
     follow_up:'Chemin incorrect trouvé. Tu dois comprendre ce qui s\'est passé avant de corriger.',
     follow_up_actions:[
       {id:'find_vhdx',label:'Chercher le fichier VHDX avec Explorer (tous les disques)',type:'BONNE_PISTE',
        consequence:'Le fichier est sur E:\\VMs\\Dev-VM.vhdx. Il a été déplacé lors d\'une migration de disque sans mise à jour de la config VM.',
        question_id:'hyperv_disk_path'},
       {id:'check_snapshots',label:'Vérifier la chaîne de snapshots dans le Gestionnaire',type:'BONNE_PISTE',
        consequence:'Tu vois 4 snapshots enchaînés. L\'un d\'eux (.avhdx) pointe vers un chemin différent qui n\'existe plus. C\'est la cause.',
        question_id:'hyperv_snapshot'},
       {id:'check_events',label:'Consulter les journaux d\'événements Hyper-V',type:'BONNE_PISTE',
        consequence:'Event 12220 : "Cannot open attachment [...] The system cannot find the file specified." Chemin : D:\\VMs\\Dev-VM.avhdx.'},
     ]},
    {id:'snapshot',label:'Chercher un snapshot valide et restaurer',type:'BONNE_PISTE',
     consequence:'Tu trouves un snapshot d\'hier 18h. En le restaurant, la VM retrouve un état cohérent avec tous les fichiers accessibles.',
     direct_resolve:true},
    {id:'recreate',label:'Recréer la VM depuis zéro rapidement',type:'MAUVAISE_PISTE',malus:true,
     consequence:'ERREUR CRITIQUE. 3 mois de travail perdus. Le développeur est catastrophé. Ton chef est furieux.'},
    {id:'check_switch',label:'Vérifier le commutateur réseau virtuel',type:'NEUTRE',
     consequence:'Le commutateur est bien configuré. Le problème de démarrage n\'est pas lié au réseau.'},
    {id:'export_vm',label:'Tenter un export de la VM pour récupérer les données',type:'NEUTRE',
     consequence:'L\'export nécessite que la VM soit accessible. Impossible dans l\'état actuel.'},
  ],
  resolution_ok:'VM démarrée, démo réussie. Ton chef : "Bien géré, impact minimal."',
  resolution_fail:'VM inaccessible. Démo annulée. Rapport d\'incident demandé.',
},

// ======= 5. NTFS — accès refusé =======
{
  id:'ntfs', title:'TICKET #6814', prio:'P1 — URGENT',
  situation:'La responsable RH ne peut plus accéder au dossier \\\\SRV-FILE\\Confidentiel-RH depuis ce matin. "Accès refusé". Ses collègues y accèdent normalement.',
  actions:[
    {id:'check_ntfs',label:'Inspecter les permissions NTFS du dossier (onglet Sécurité)',type:'BONNE_PISTE',
     consequence:'Tu vois une entrée "Deny - Tous les droits" sur le compte de la responsable, ajoutée hier à 22h. Un Deny explicite prime sur tous les Allow.',
     follow_up:'Deny explicite trouvé. Tu dois identifier pourquoi et décider comment corriger.',
     follow_up_actions:[
       {id:'remove_deny',label:'Supprimer l\'entrée Deny directement',type:'BONNE_PISTE',
        consequence:'L\'entrée Deny est supprimée. La responsable peut maintenant accéder au dossier. Ses droits Allow via GRP-RH s\'appliquent normalement.',
        question_id:'ntfs_deny'},
       {id:'check_inheritance',label:'Vérifier si l\'héritage NTFS est actif sur ce dossier',type:'BONNE_PISTE',
        consequence:'L\'héritage est coupé et les ACL ont été reconstruites manuellement. Le Deny a été ajouté par erreur lors de cette reconstruction.'},
       {id:'reset_permissions',label:'Réinitialiser toutes les permissions et tout reconfigurer',type:'MAUVAISE_PISTE',malus:true,
        consequence:'Tu effaces toutes les ACL du dossier. Personne ne peut plus y accéder. Il faut tout reconfigurer depuis zéro.'},
     ]},
    {id:'check_groups',label:'Vérifier les groupes AD de la responsable',type:'BONNE_PISTE',
     consequence:'Elle est dans GRP-RH (Allow) mais aussi dans GRP-STAGIAIRES (Deny sur ce dossier). Le Deny de GRP-STAGIAIRES prime.',
     follow_up:'Appartenance erronée à GRP-STAGIAIRES trouvée.',
     follow_up_actions:[
       {id:'remove_group',label:'Retirer du groupe GRP-STAGIAIRES dans l\'AD',type:'BONNE_PISTE',
        consequence:'Après déconnexion/reconnexion, les nouveaux tokens Kerberos s\'appliquent. L\'accès est rétabli.',
        question_id:'ntfs_group_deny'},
       {id:'check_why_added',label:'Comprendre pourquoi elle a été ajoutée à GRP-STAGIAIRES',type:'NEUTRE',
        consequence:'Un script de migration a mal classé son compte lors d\'une réorganisation des OU la semaine dernière.'},
     ]},
    {id:'reset_pwd',label:'Réinitialiser son mot de passe (pour forcer une reconnexion)',type:'MAUVAISE_PISTE',malus:true,
     consequence:'Son mot de passe change mais le problème NTFS persiste. Elle doit reconfigurer ses applications.'},
    {id:'check_share',label:'Vérifier les permissions de partage SMB',type:'NEUTRE',
     consequence:'Les permissions de partage sont "Everyone - Contrôle total". Le problème vient bien des NTFS.'},
  ],
  resolution_ok:'Accès rétabli. La responsable peut travailler. Ton chef : "Bien diagnostiqué, cause subtile."',
  resolution_fail:'Accès refusé toute la journée. Le DRH escalade.',
},

// ======= 6. STP — boucle réseau =======
{
  id:'stp', title:'TICKET #1190', prio:'P3 — CRITIQUE',
  situation:'ALERTE. Le réseau du bâtiment B sature. Tous les switches ont des indicateurs de trafic à 100%. Personne ne peut travailler. Le DSI est sur place et attend ta réponse.',
  actions:[
    {id:'show_stp',label:'Analyser l\'arbre STP (show spanning-tree) sur le switch core',type:'BONNE_PISTE',
     consequence:'show spanning-tree montre un port en Forwarding qui devrait être Blocking. Un switch non managé crée une boucle L2.',
     follow_up:'Boucle STP identifiée sur le port Gi0/2. Tu dois l\'isoler immédiatement.',
     follow_up_actions:[
       {id:'shutdown_port',label:'Couper le port incriminé (shutdown) immédiatement',type:'BONNE_PISTE',
        consequence:'Le port est coupé. La tempête de broadcast s\'arrête en 2 secondes. Le réseau se stabilise. Le DSI voit les indicateurs baisser.',
        question_id:'stp_bpduguard'},
       {id:'trace_cable',label:'Tracer le câble du port pour identifier l\'équipement non autorisé',type:'BONNE_PISTE',
        consequence:'Un stagiaire a branché un switch TP-Link personnel pour avoir plus de prises dans son bureau. C\'est lui qui a créé la boucle.'},
       {id:'restart_switches',label:'Redémarrer tous les switches du bâtiment',type:'MAUVAISE_PISTE',malus:true,
        consequence:'Redémarrage en cascade. 5 minutes de coupure complète. La boucle revient au démarrage car la cause n\'est pas traitée.'},
     ]},
    {id:'shutdown_direct',label:'Couper le port suspect identifié visuellement (LED orange)',type:'BONNE_PISTE',
     consequence:'Tu coupes le bon port. La tempête de broadcast cesse immédiatement. Réseau stabilisé.',
     question_id:'stp_portfast'},
    {id:'check_root',label:'Identifier le Root Bridge actuel (show spanning-tree)',type:'NEUTRE',
     consequence:'Le Root Bridge est le switch core attendu. L\'arbre STP est bien construit, mais la boucle physique le court-circuite.'},
    {id:'enable_portfast',label:'Activer PortFast sur tous les ports access',type:'MAUVAISE_PISTE',malus:true,
     consequence:'PortFast sur un port trunk aggrave la situation. Des BPDUs sont ignorées et de nouvelles boucles apparaissent.'},
    {id:'check_cdp',label:'Utiliser CDP pour cartographier les connexions (show cdp neighbors)',type:'BONNE_PISTE',
     consequence:'CDP ne voit pas le switch non managé (il ne parle pas CDP). Mais tu identifies le port par élimination.',
     follow_up:'Port suspect isolé par CDP. Tu dois maintenant agir.',
     follow_up_actions:[
       {id:'shutdown_suspect',label:'Couper le port suspect identifié',type:'BONNE_PISTE',
        consequence:'Port coupé. Boucle stoppée. Réseau stabilisé en quelques secondes.',
        question_id:'stp_bpduguard'},
       {id:'check_again',label:'Relancer show spanning-tree pour confirmer',type:'NEUTRE',
        consequence:'La topologie STP est maintenant cohérente. Tous les ports sont en Forwarding ou Blocking normalement.'},
     ]},
  ],
  resolution_ok:'Boucle stoppée en 3 minutes. Réseau stabilisé. Le DSI : "Bonne réactivité en situation de crise."',
  resolution_fail:'Boucle active 15+ minutes. Rapport de post-mortem exigé. Impact total bâtiment B.',
},

// ======= 7. DHCP épuisé =======
{
  id:'dhcp', title:'TICKET #7723', prio:'P2 — URGENT',
  situation:'Lundi matin, 12 postes du service compta affichent 169.254.x.x et ne peuvent pas accéder au réseau. Plusieurs nouveaux stagiaires sont arrivés ce matin.',
  actions:[
    {id:'check_scope',label:'Vérifier l\'état du scope DHCP dans la console',type:'BONNE_PISTE',
     consequence:'Scope 192.168.1.100-200 : 100 baux sur 100 — pool épuisé. Des baux obsolètes d\'anciens postes occupent 30% de l\'espace.',
     follow_up:'Pool épuisé confirmé. Deux solutions possibles : libérer des baux ou étendre le pool.',
     follow_up_actions:[
       {id:'purge_stale',label:'Identifier et supprimer les baux obsolètes (MACs inexistants)',type:'BONNE_PISTE',
        consequence:'23 baux d\'anciens postes supprimés. 23 adresses libérées. Les 12 postes obtiennent leurs adresses en quelques secondes.',
        question_id:'dhcp_lease'},
       {id:'extend_scope',label:'Étendre le scope de /24 à plus d\'adresses',type:'BONNE_PISTE',
        consequence:'Tu étends le scope à 192.168.1.100-250. 50 adresses supplémentaires disponibles. Les postes obtiennent leurs IPs.',
        question_id:'dhcp_scope'},
       {id:'restart_dhcp',label:'Redémarrer le service DHCP pour libérer les baux',type:'MAUVAISE_PISTE',malus:true,
        consequence:'Le redémarrage ne libère pas les baux persistants. Les 12 postes restent en 169.254.x.x.'},
     ]},
    {id:'check_svc',label:'Vérifier si le service DHCP est bien démarré',type:'NEUTRE',
     consequence:'Le service est actif et distribue. Le problème vient de l\'épuisement du pool, pas du service.'},
    {id:'ipconfig',label:'Faire un ipconfig /renew sur les postes en 169.254',type:'NEUTRE',
     consequence:'Les postes tentent de renouveler. Ils obtiennent "Impossible de contacter le serveur DHCP" — le pool est épuisé.'},
    {id:'static',label:'Configurer des IPs statiques sur les 12 postes',type:'MAUVAISE_PISTE',malus:true,
     consequence:'Solution temporaire non documentée. Dans 2 semaines tu as 12 postes en statique et personne ne sait pourquoi.'},
    {id:'check_relay',label:'Vérifier si le relay agent fonctionne (autre sous-réseau)',type:'BONNE_PISTE',
     consequence:'Le relay agent est opérationnel. Les postes reçoivent bien les requêtes DHCP. Le problème est le pool épuisé.',
     follow_up:'Relay OK mais pool vide. Il faut libérer des adresses.',
     follow_up_actions:[
       {id:'purge_relay',label:'Supprimer les baux obsolètes pour libérer des adresses',type:'BONNE_PISTE',
        consequence:'Baux obsolètes supprimés. Adresses libérées. Les postes obtiennent leurs IPs.',
        question_id:'dhcp_lease'},
     ]},
  ],
  resolution_ok:'Pool libéré. Les 12 postes ont leur IP. Ton chef : "Bien vu, les baux fantômes."',
  resolution_fail:'Compta sans réseau jusqu\'à 14h. Rapport de cause demandé.',
},

// ======= 8. SSH Cisco =======
{
  id:'cisco_ssh', title:'TICKET #9001', prio:'P2 — MOYEN',
  situation:'L\'admin réseau ne peut plus se connecter en SSH au routeur R-CORE. La connexion Telnet fonctionne encore mais le chef veut Telnet désactivé d\'urgence pour l\'audit.',
  actions:[
    {id:'check_rsa',label:'Vérifier si les clés RSA existent (show crypto key mypubkey rsa)',type:'BONNE_PISTE',
     consequence:'Aucune clé RSA. Elles ont été supprimées lors d\'un "crypto zeroize" pendant une remise à zéro partielle.',
     follow_up:'Clés RSA absentes. Tu dois les régénérer dans le bon ordre.',
     follow_up_actions:[
       {id:'check_prereqs',label:'Vérifier le hostname et ip domain-name avant génération',type:'BONNE_PISTE',
        consequence:'"show run | include domain" ne retourne rien. Sans ip domain-name, la génération des clés échoue.',
        question_id:'cisco_ssh_domain'},
       {id:'gen_rsa_direct',label:'Lancer crypto key generate rsa modulus 2048 directement',type:'MAUVAISE_PISTE',malus:true,
        consequence:'"% You must specify a key name using the \'label\' keyword". Sans domaine configuré, Cisco ne peut pas nommer la clé.'},
       {id:'full_sequence',label:'Configurer hostname, domain-name puis générer les clés',type:'BONNE_PISTE',
        consequence:'La séquence complète réussit. Les clés RSA 2048 bits sont générées. SSH v2 peut être activé.',
        question_id:'cisco_ssh_rsa'},
     ]},
    {id:'check_vty',label:'Inspecter la configuration des lignes VTY',type:'BONNE_PISTE',
     consequence:'"transport input ssh" est bien configuré. Mais en regardant attentivement, une ligne "transport input telnet" a été ajoutée après — elle écrase la première.',
     follow_up:'VTY mal configurée. Il faut corriger.',
     follow_up_actions:[
       {id:'fix_vty',label:'Reconfigurer les VTY correctement (transport input ssh)',type:'BONNE_PISTE',
        consequence:'Les lignes VTY n\'acceptent plus que SSH. Telnet est bloqué. L\'audit peut se poursuivre.',
        question_id:'cisco_ssh_vty'},
       {id:'check_version',label:'Verifier la version SSH',type:'NEUTRE',
        consequence:'SSHv1 par defaut, moins securise. Configurer ip ssh version 2 est recommande.'},
     ]},
    {id:'check_acl',label:'Vérifier si une ACL bloque le port 22 entrant',type:'BONNE_PISTE',
     consequence:'Une ACL appliquée à l\'interface de management bloque TCP port 22. Elle a été créée trop restrictive lors de l\'audit.',
     follow_up:'ACL trop restrictive trouvée.',
     follow_up_actions:[
       {id:'fix_acl',label:'Modifier l\'ACL pour autoriser SSH depuis le réseau admin',type:'BONNE_PISTE',
        consequence:'Après modification, SSH fonctionne depuis le poste de l\'admin. Telnet est bien bloqué.',
        question_id:'cisco_acl'},
       {id:'delete_acl',label:'Supprimer complètement l\'ACL de management',type:'MAUVAISE_PISTE',malus:true,
        consequence:'SSH fonctionne mais le routeur est maintenant accessible depuis n\'importe quelle IP. Mauvaise pratique sécurité.'},
     ]},
    {id:'check_domain',label:'Vérifier ip domain-name (requis pour SSH)',type:'BONNE_PISTE',
     consequence:'"show run | include domain" ne retourne rien. Sans ip domain-name les clés RSA ne peuvent pas être générées.',
     question_id:'cisco_ssh_domain'},
    {id:'reinstall_ios',label:'Réinstaller l\'IOS du routeur',type:'MAUVAISE_PISTE',malus:true,
     consequence:'Procédure lourde, fenêtre de maintenance requise. Ton chef demande pourquoi tu escalades sans diagnostic complet.'},
  ],
  resolution_ok:'SSH opérationnel, Telnet désactivé. Ton chef : "Parfait pour l\'audit."',
  resolution_fail:'SSH toujours KO. Telnet reste actif. Audit compromis.',
},

// ======= 9. Compte AD bloqué =======
{
  id:'ad_locked', title:'TICKET #3314', prio:'P1 — URGENT',
  situation:'Un commercial ne peut plus se connecter. "Compte désactivé ou expiré". Il a un rendez-vous client dans 20 minutes. Son manager appelle directement.',
  actions:[
    {id:'check_account',label:'Vérifier l\'état du compte dans ADUC',type:'BONNE_PISTE',
     consequence:'Le compte est désactivé ET verrouillé. Deux problèmes distincts. La désactivation est manuelle (hier 22h), le verrouillage est dû à 5 tentatives échouées ce matin.',
     follow_up:'Compte désactivé ET verrouillé. Il faut traiter les deux.',
     follow_up_actions:[
       {id:'enable_and_unlock',label:'Réactiver ET déverrouiller le compte',type:'BONNE_PISTE',
        consequence:'Enable-ADAccount + Unlock-ADAccount. Le commercial peut se connecter juste avant son rendez-vous.',
        question_id:'ad_enable_account'},
       {id:'only_unlock',label:'Déverrouiller sans réactiver',type:'MAUVAISE_PISTE',malus:true,
        consequence:'Unlock-ADAccount exécuté mais le compte reste désactivé. Le commercial ne peut toujours pas se connecter.'},
       {id:'check_why_disabled',label:'Comprendre pourquoi il a été désactivé',type:'BONNE_PISTE',
        consequence:'Un script de départ a désactivé son compte par erreur — son nom ressemble à celui d\'un employé qui a quitté l\'entreprise.'},
     ]},
    {id:'check_lockout',label:'Vérifier les lockouts avec Account Lockout Status tool',type:'BONNE_PISTE',
     consequence:'5 tentatives échouées depuis son poste à 8h01. Le compte est verrouillé sur 2 DC. Quelqu\'un a essayé de se connecter avec le mauvais mot de passe.',
     follow_up:'Lockout identifié sur 2 DCs. Tu dois déverrouiller.',
     follow_up_actions:[
       {id:'unlock_dc',label:'Déverrouiller sur tous les DCs (Unlock-ADAccount)',type:'BONNE_PISTE',
        consequence:'Le compte est déverrouillé. Il peut maintenant se connecter si le compte est aussi réactivé.',
        question_id:'ad_unlock'},
       {id:'force_pwd',label:'Forcer un changement de mot de passe',type:'NEUTRE',
        consequence:'Utile pour la sécurité mais ne résout pas le problème immédiat. Le compte doit aussi être réactivé.'},
     ]},
    {id:'reset_pwd_ad',label:'Réinitialiser son mot de passe dans l\'AD',type:'NEUTRE',
     consequence:'Le mot de passe est changé mais le compte reste désactivé. Le problème n\'est pas résolu.'},
    {id:'restart_dc',label:'Redémarrer le contrôleur de domaine',type:'MAUVAISE_PISTE',malus:true,
     consequence:'ERREUR CRITIQUE. Redémarrer un DC coupe l\'authentification pour tout le domaine. Ton chef reçoit 30 appels.'},
  ],
  resolution_ok:'Compte réactivé et déverrouillé. Rendez-vous sauvé. Ton chef : "Réactivité parfaite."',
  resolution_fail:'Commercial bloqué. Rendez-vous client manqué. Perte commerciale signalée.',
},

// ======= 10. GPO non appliquée =======
{
  id:'gpo', title:'TICKET #5521', prio:'P2 — MOYEN',
  situation:'Une GPO de sécurité (désactivation USB) ne s\'applique pas sur les postes compta. Les clés USB fonctionnent encore. Le RSSI veut une résolution avant l\'audit de 16h.',
  actions:[
    {id:'gpupdate',label:'Forcer gpupdate /force sur les postes compta',type:'BONNE_PISTE',
     consequence:'gpupdate s\'exécute mais la GPO n\'apparaît toujours pas dans gpresult. Le problème est structurel, pas de délai.',
     follow_up:'gpupdate ne suffit pas. Tu dois identifier pourquoi la GPO ne descend pas.',
     follow_up_actions:[
       {id:'gpresult',label:'Lancer gpresult /r /scope computer pour analyser',type:'BONNE_PISTE',
        consequence:'gpresult montre que les GPO du niveau domaine s\'appliquent mais pas celles de l\'OU parent "Informatique". Les postes compta sont dans une OU différente.',
        question_id:'gpo_gpresult'},
       {id:'check_link',label:'Vérifier le lien de la GPO dans la GPMC',type:'BONNE_PISTE',
        consequence:'La GPO est liée à OU=Informatique. Les postes compta sont dans OU=Comptabilité. La GPO ne les atteint pas.',
        question_id:'gpo_link'},
     ]},
    {id:'check_link_gpo',label:'Vérifier où la GPO est liée dans la GPMC',type:'BONNE_PISTE',
     consequence:'La GPO est liée à OU=Informatique, pas à OU=Comptabilité. Erreur de configuration initiale.',
     follow_up:'Mauvais lien trouvé. Tu dois décider de la correction.',
     follow_up_actions:[
       {id:'relink',label:'Créer un nouveau lien vers OU=Comptabilité',type:'BONNE_PISTE',
        consequence:'Lien créé. Après gpupdate /force, la GPO s\'applique. Les clés USB sont bloquées.',
        question_id:'gpo_link'},
       {id:'check_inheritance',label:'Vérifier si Block Inheritance est activé sur l\'OU Compta',type:'BONNE_PISTE',
        consequence:'L\'OU Comptabilité a "Block Policy Inheritance" activé — les GPO parentes ne descendent pas même si correctement liées.',
        question_id:'gpo_inheritance'},
     ]},
    {id:'check_wmi',label:'Vérifier si un filtre WMI conditionne la GPO',type:'BONNE_PISTE',
     consequence:'Un filtre WMI limite la GPO aux postes Windows 11. Les postes compta sont sous Windows 10 — ils sont exclus.',
     follow_up:'Filtre WMI trop restrictif.',
     follow_up_actions:[
       {id:'fix_wmi',label:'Modifier ou supprimer le filtre WMI',type:'BONNE_PISTE',
        consequence:'Filtre supprimé. La GPO s\'applique maintenant à tous les systèmes Windows.',
        question_id:'gpo_wmi'},
     ]},
    {id:'delete_gpo',label:'Supprimer et recréer la GPO',type:'MAUVAISE_PISTE',malus:true,
     consequence:'La GPO est supprimée. Elle ne s\'applique plus nulle part. Le RSSI est alerté.'},
  ],
  resolution_ok:'GPO appliquée. Clés USB bloquées en compta. Le RSSI : "Juste à temps pour l\'audit."',
  resolution_fail:'GPO non appliquée. Audit de sécurité compromis.',
},

// ======= 11. Certificat SSL expiré =======
{
  id:'ssl', title:'TICKET #7788', prio:'P2 — URGENT',
  situation:'L\'intranet RH affiche "CONNEXION NON SÉCURISÉE" depuis ce matin. Les navigateurs bloquent l\'accès. 200 employés ne peuvent plus accéder aux outils RH en ligne.',
  actions:[
    {id:'check_cert',label:'Vérifier le certificat SSL dans le navigateur (F12)',type:'BONNE_PISTE',
     consequence:'Le certificat a expiré hier à 23h59. Il avait été émis il y a 2 ans. Aucune alerte d\'expiration n\'était configurée.',
     follow_up:'Expiration confirmée. Tu dois renouveler sans couper le service.',
     follow_up_actions:[
       {id:'check_ca',label:'Identifier l\'autorité de certification émettrice',type:'BONNE_PISTE',
        consequence:'C\'est un certificat Let\'s Encrypt (gratuit). Le renouvellement automatique Certbot a échoué car un port était fermé.',
        question_id:'ssl_renew'},
       {id:'check_iis_binding',label:'Vérifier les bindings HTTPS dans IIS',type:'BONNE_PISTE',
        consequence:'Le binding HTTPS pointe encore sur l\'ancien certificat expiré. Tu devras le mettre à jour après renouvellement.'},
       {id:'create_self_signed',label:'Créer un certificat auto-signé temporaire',type:'MAUVAISE_PISTE',malus:true,
        consequence:'Les navigateurs affichent toujours un avertissement. Les utilisateurs doivent ajouter des exceptions. Mauvaise habitude de sécurité.'},
     ]},
    {id:'check_iis',label:'Vérifier la configuration IIS du site',type:'NEUTRE',
     consequence:'IIS est bien configuré, le site fonctionne. Le problème vient uniquement du certificat.'},
    {id:'exception',label:'Demander aux utilisateurs d\'ajouter des exceptions navigateur',type:'MAUVAISE_PISTE',malus:true,
     consequence:'Mauvaise pratique. Le RSSI te contacte pour signaler que tu habitues les employés à ignorer les alertes SSL.'},
    {id:'check_chain',label:'Vérifier la chaîne de certification (CA intermédiaire)',type:'BONNE_PISTE',
     consequence:'La chaîne est complète et valide. Le problème est uniquement l\'expiration du certificat feuille.',
     direct_resolve:true},
  ],
  resolution_ok:'Certificat renouvelé et installé. Intranet accessible. Ton chef : "Configure une alerte pour la prochaine fois."',
  resolution_fail:'Intranet inaccessible 4h. Rapport d\'incident et plan de renouvellement automatique exigés.',
},

// ======= 12. Route manquante =======
{
  id:'routing', title:'TICKET #2098', prio:'P3 — CRITIQUE',
  situation:'Le site secondaire (192.168.2.0/24) ne communique plus avec le siège depuis une intervention hier soir. Les sauvegardes nocturnes ont échoué. Le DSI veut une résolution immédiate.',
  actions:[
    {id:'check_routes',label:'Vérifier la table de routage sur R1 (show ip route)',type:'BONNE_PISTE',
     consequence:'Aucune route vers 192.168.2.0/24. Elle a été supprimée lors de l\'intervention. La route vers 192.168.3.0/24 est aussi absente.',
     follow_up:'Routes manquantes identifiées. Tu dois les reconfigurer correctement.',
     follow_up_actions:[
       {id:'add_routes',label:'Ajouter les routes statiques manquantes',type:'BONNE_PISTE',
        consequence:'Les deux routes ajoutées. La communication inter-sites reprend. Les sauvegardes nocturnes de ce soir passeront.',
        question_id:'routing_static'},
       {id:'check_startup',label:'Comparer running-config et startup-config',type:'BONNE_PISTE',
        consequence:'La startup-config a les routes mais pas la running. L\'intervenant a oublié de faire "copy run start" après ses modifications.'},
       {id:'reload_config',label:'Charger la startup-config (reload)',type:'MAUVAISE_PISTE',malus:true,
        consequence:'Le reload coupe le routeur 3 minutes et charge une startup-config incomplète. La situation empire.'},
     ]},
    {id:'ping_sites',label:'Tester la connectivité par pings progressifs (sites, routeurs)',type:'NEUTRE',
     consequence:'Ping vers 192.168.2.1 échoue depuis R1. Le problème est bien le routage sur R1, pas une panne physique.'},
    {id:'check_interfaces',label:'Vérifier l\'état des interfaces du routeur',type:'BONNE_PISTE',
     consequence:'Toutes les interfaces sont "up/up". Le problème est logiciel (table de routage), pas physique.',
     direct_resolve:true},
    {id:'check_acl_r',label:'Vérifier les ACL sur les interfaces du routeur',type:'BONNE_PISTE',
     consequence:'Les ACL n\'ont pas été modifiées. Elles ne bloquent pas le trafic inter-sites.',
     direct_resolve:true},
  ],
  resolution_ok:'Routes ajoutées. Communication rétablie. Sauvegardes OK. Ton chef : "Bien vu, rapide."',
  resolution_fail:'Communication coupée 6h supplémentaires. Sauvegardes J+1 aussi perdues.',
},

// ======= 13. Imprimante réseau =======
{
  id:'printer', title:'TICKET #4456', prio:'P1 — MOYEN',
  situation:'L\'imprimante réseau du plateau commercial (IP: 192.168.1.50) est inaccessible depuis ce matin. 15 commerciaux ne peuvent pas imprimer leurs contrats pour les rendez-vous du jour.',
  actions:[
    {id:'ping_printer',label:'Pinger l\'adresse IP de l\'imprimante',type:'BONNE_PISTE',
     consequence:'Ping timeout. L\'imprimante ne répond pas sur 192.168.1.50. Elle a soit changé d\'IP, soit est éteinte.',
     follow_up:'Pas de réponse sur l\'IP connue. Tu dois trouver la nouvelle IP ou vérifier l\'état physique.',
     follow_up_actions:[
       {id:'check_dhcp_leases',label:'Chercher le bail DHCP de l\'imprimante par son adresse MAC',type:'BONNE_PISTE',
        consequence:'Le bail DHCP montre que l\'imprimante a obtenu 192.168.1.87 suite au redémarrage du serveur DHCP hier. L\'IP a changé.',
        question_id:'printer_ip'},
       {id:'check_physical',label:'Vérifier physiquement si l\'imprimante est allumée',type:'BONNE_PISTE',
        consequence:'L\'imprimante est allumée et affiche une IP différente sur son écran : 192.168.1.87. Elle était en DHCP.'},
       {id:'scan_network',label:'Scanner le réseau pour trouver l\'imprimante (nmap ou Advanced IP Scanner)',type:'BONNE_PISTE',
        consequence:'L\'imprimante est détectée sur 192.168.1.87. Son adresse MAC confirme que c\'est bien la bonne imprimante.'},
     ]},
    {id:'check_spooler',label:'Vérifier le spouleur d\'impression sur les postes',type:'NEUTRE',
     consequence:'Le spouleur est actif. Le problème n\'est pas logiciel côté poste — c\'est l\'imprimante qui est injoignable.'},
    {id:'reinstall',label:'Réinstaller les pilotes d\'impression sur tous les postes',type:'MAUVAISE_PISTE',malus:true,
     consequence:'45 minutes sur 15 postes. L\'imprimante reste inaccessible car le vrai problème (IP changée) n\'est pas traité.'},
    {id:'check_switch_port',label:'Vérifier le port switch de l\'imprimante (show int)',type:'NEUTRE',
     consequence:'Le port switch est "up/up". La connexion physique est bonne. Le problème est l\'adresse IP.'},
    {id:'fix_ip',label:'Configurer une IP statique sur l\'imprimante',type:'BONNE_PISTE',
     consequence:'Via l\'interface web de l\'imprimante, tu configures 192.168.1.50 en statique. Tous les postes retrouvent l\'imprimante.',
     follow_up:'IP statique configurée. Il faut maintenant mettre à jour les postes.',
     follow_up_actions:[
       {id:'update_ports',label:'Mettre à jour le port d\'impression sur les postes',type:'BONNE_PISTE',
        consequence:'Les ports sont mis à jour. L\'impression fonctionne sur tous les postes.',
        question_id:'printer_static'},
       {id:'reservation',label:'Créer une réservation DHCP pour éviter le problème futur',type:'BONNE_PISTE',
        consequence:'Réservation DHCP créée. L\'imprimante aura toujours 192.168.1.50, même en DHCP.'},
     ]},
  ],
  resolution_ok:'Impression rétablie. Commerciaux opérationnels. Ton chef : "Bien diagnostiqué."',
  resolution_fail:'Sans impression pendant 2h. Contrats signés à la main. Manager RH mécontent.',
},

// ======= 14. Espace NAS saturé =======
{
  id:'backup', title:'TICKET #6670', prio:'P2 — MOYEN',
  situation:'L\'alerte supervision signale l\'échec des sauvegardes nocturnes. Motif : "Espace insuffisant sur le NAS". Le NAS affiche 100% utilisé.',
  actions:[
    {id:'check_nas',label:'Analyser l\'occupation par dossier sur le NAS',type:'BONNE_PISTE',
     consequence:'Tu identifies un dossier "VM-ARCHIVE-2023" de 800 Go qui correspond à une VM désaffectée il y a 3 mois. Jamais supprimé.',
     follow_up:'800 Go de données obsolètes identifiées. Tu dois décider comment procéder.',
     follow_up_actions:[
       {id:'confirm_obsolete',label:'Confirmer la désaffectation de la VM avec le responsable',type:'BONNE_PISTE',
        consequence:'Le DSI confirme par email que la VM peut être supprimée. Tu as le feu vert.',
        question_id:'backup_retention'},
       {id:'delete_direct',label:'Supprimer le dossier directement sans confirmation',type:'MAUVAISE_PISTE',malus:true,
        consequence:'Le dossier est supprimé. 2h plus tard, un développeur cherche des données de la VM. Elles étaient encore utilisées.'},
     ]},
    {id:'check_policy',label:'Vérifier la politique de rétention configurée',type:'BONNE_PISTE',
     consequence:'La politique dit "30 jours" mais le nettoyage automatique est désactivé. Les anciennes sauvegardes s\'accumulent sans jamais être supprimées.',
     follow_up:'Politique mal appliquée. Il faut corriger la configuration.',
     follow_up_actions:[
       {id:'enable_cleanup',label:'Activer la purge automatique dans l\'outil de sauvegarde',type:'BONNE_PISTE',
        consequence:'Purge automatique activée et lancée manuellement. 40% d\'espace libéré. Les sauvegardes peuvent reprendre.',
        direct_resolve:true},
       {id:'manual_cleanup',label:'Supprimer manuellement les sauvegardes de plus de 30 jours',type:'BONNE_PISTE',
        consequence:'350 Go libérés manuellement. Les sauvegardes ce soir passeront.',
        question_id:'backup_retention'},
     ]},
    {id:'add_disk',label:'Commander un disque supplémentaire pour le NAS',type:'MAUVAISE_PISTE',malus:true,
     consequence:'Délai de 5 jours. Sauvegardes en échec d\'ici là. Ton chef : "T\'aurais pu libérer de l\'espace d\'abord."'},
    {id:'compress',label:'Lancer une compression des données existantes',type:'NEUTRE',
     consequence:'La compression est déjà activée. Les fichiers sont en format compressé. Pas de gain supplémentaire possible.'},
  ],
  resolution_ok:'Espace libéré. Sauvegardes reprennent. Ton chef : "Bien géré, maintenant c\'est automatique."',
  resolution_fail:'Sauvegardes en échec 3 nuits supplémentaires. Audit de conformité compromis.',
},

// ======= 15. ExecutionPolicy PowerShell =======
{
  id:'ps_policy', title:'TICKET #8823', prio:'P2 — MOYEN',
  situation:'Un développeur ne peut pas exécuter son script de déploiement mensuel. Erreur : "L\'exécution de scripts est désactivée sur ce système." Bloquer le déploiement = retard projet.',
  actions:[
    {id:'check_policy',label:'Vérifier l\'ExecutionPolicy actuelle (Get-ExecutionPolicy -List)',type:'BONNE_PISTE',
     consequence:'"MachinePolicy: Restricted" — une GPO impose cette politique. Ce n\'est pas un simple réglage local, c\'est une politique d\'entreprise.',
     follow_up:'GPO impose Restricted. Tu dois trouver un moyen d\'autoriser les scripts légitimes sans briser la politique.',
     follow_up_actions:[
       {id:'sign_script',label:'Proposer de signer le script numériquement (AllSigned)',type:'BONNE_PISTE',
        consequence:'Solution sécurisée mais longue. Il faut un certificat de signature de code et former le développeur.',
        question_id:'ps_remotesigned'},
       {id:'gpo_exception',label:'Créer une exception GPO pour le groupe Développeurs',type:'BONNE_PISTE',
        consequence:'Tu crées un filtre de sécurité sur la GPO pour exclure le groupe GRP-Devs. RemoteSigned s\'applique à leur place.',
        question_id:'ps_execution_policy'},
       {id:'bypass_local',label:'Changer localement avec Set-ExecutionPolicy Bypass',type:'MAUVAISE_PISTE',malus:true,
        consequence:'La GPO écrase le réglage local au prochain rafraîchissement. Bypass contourne toutes les protections — déconseillé.'},
     ]},
    {id:'check_gpo_ps',label:'Vérifier si une GPO contrôle l\'ExecutionPolicy',type:'BONNE_PISTE',
     consequence:'"gpresult /r" confirme qu\'une GPO "Hardening-Workstations" impose Restricted depuis la dernière mise à jour de sécurité.',
     follow_up:'GPO Hardening trouvée. Tu dois décider comment gérer l\'exception.',
     follow_up_actions:[
       {id:'scope_gpo',label:'Restreindre la portée de la GPO (exclure les devs)',type:'BONNE_PISTE',
        consequence:'La GPO n\'affecte plus les développeurs. Ils peuvent exécuter leurs scripts avec RemoteSigned.',
        direct_resolve:true},
       {id:'new_gpo',label:'Créer une GPO spécifique pour les développeurs',type:'BONNE_PISTE',
        consequence:'Nouvelle GPO liée à OU=Développeurs avec RemoteSigned. Propre et documenté.',
        question_id:'ps_execution_policy'},
     ]},
    {id:'run_admin',label:'Exécuter PowerShell en tant qu\'Administrateur',type:'NEUTRE',
     consequence:'Même en admin, la MachinePolicy Restricted bloque les scripts. Les droits admin et l\'ExecutionPolicy sont distincts.'},
    {id:'unrestricted',label:'Mettre l\'ExecutionPolicy à Unrestricted',type:'MAUVAISE_PISTE',malus:true,
     consequence:'Unrestricted exécute tous les scripts sans vérification. Le RSSI reçoit une alerte de configuration non conforme.'},
  ],
  resolution_ok:'Exception créée. Scripts de déploiement fonctionnels. Ton chef : "Bonne approche, équilibre sécurité/usage."',
  resolution_fail:'Déploiement bloqué. Applications non mises à jour. Retard projet signalé.',
},

]; // fin RPG_SCENARIOS_V2



var RPG = {
  CONF_GOOD_ACTION: 10,
  CONF_GOOD_ANSWER: 5,
  CONF_BAD_ANSWER: -5,
  CONF_BAD_PISTE: -10,
  scenarios: RPG_SCENARIOS_V2,
};

// Questions liees
;


// =====================================================
// MOTEUR RPG NARRATIF
// =====================================================
var rpgN={confidence:50,ticketIdx:0,ticketsPerSession:5,ticketOrder:[],triedActions:{},actOrder:{},stats:{ok:0,fail:0},questionAnswered:false,currentTicket:null};

function startRPGNarrative(){
  // Thème Paper automatique
  document.body.classList.remove('ui-arcade','ui-terminal','ui-minimal');
  document.body.classList.add('ui-paper','rpg-mode');
  // Init état
  rpgN.confidence=50;rpgN.ticketIdx=0;rpgN.stats={ok:0,fail:0};
  rpgN.triedActions={};rpgN.actOrder={};rpgN.questionAnswered=false;rpgN.currentTicket=null;
  rpgN.jokers=1;rpgN.questionAnswered=false;
  // Sélectionner les tickets aléatoirement
  var arr=RPG.scenarios.map(function(_,i){return i;});
  rpgN.ticketOrder=shuffle(arr).slice(0,rpgN.ticketsPerSession||5);
  // Afficher le bon écran D'ABORD
  showScreen('rpg-narrative');
  // PUIS initialiser les éléments DOM (qui existent maintenant)
  requestAnimationFrame(function(){
    rpgInitBonuses();
    rpgUpdateBar();
    rpgUpdateJokerDisplay();
    rpgShowTicket();
  });
}

function rpgStartAfterIntro(){
  showScreen('rpg-narrative');
  rpgUpdateBar();
  rpgInitBonus();
  rpgShowTicket();
}

function rpgShowTicket(){
  rpgUpdateBar(); // forcer sync barre au début de chaque ticket
  if(rpgN.ticketIdx>=rpgN.ticketOrder.length){rpgEndSession();return;}
  var sc=RPG.scenarios[rpgN.ticketOrder[rpgN.ticketIdx]];
  rpgN.currentTicket=sc;
  rpgN.questionAnswered=false;
  if(!rpgN.triedActions[sc.id]) rpgN.triedActions[sc.id]=[];
  if(!rpgN.actOrder[sc.id]) rpgN.actOrder[sc.id]=shuffle(sc.actions.map(function(_,i){return i;}));

  // Générer heure fictive et code barre
  var hh=String(Math.floor(Math.random()*4)+8).padStart(2,'0');
  var mm=String(Math.floor(Math.random()*60)).padStart(2,'0');
  var timeEl=document.getElementById('rpg-ticket-time');
  if(timeEl) timeEl.textContent=hh+':'+mm;
  var bcEl=document.getElementById('rpg-barcode');
  if(bcEl){
    // Générer un "numéro de série" visuel à partir du seed du scénario
    var bcSeed=sc.id.split('').reduce(function(a,c){return a+c.charCodeAt(0)%10;},0);
    var serial='REF-'+sc.id.toUpperCase().slice(0,3)+'-'+String(bcSeed*137+4471).slice(0,4);
    bcEl.textContent=serial+' ··· SERVICE IT ··· PRIORITÉ: '+(sc.title.split('Niveau ')[1]||'P2');
  }
  // Topbar
  var rpgProg=document.getElementById('rpg-prog');if(rpgProg)rpgProg.textContent='TICKET '+(rpgN.ticketIdx+1)+'/'+rpgN.ticketOrder.length;
  rpgUpdateBadge();
  rpgUpdateJokerDisplay();
  // Afficher bonus slot
  var bslot=document.getElementById('rpg-bonus-slot');
  if(bslot) bslot.className=rpgBonusPool&&rpgBonusPool.filter(function(b){return!b.used;}).length>0?'rpg-bonus-slot show':'rpg-bonus-slot';
  // Fermer menu bonus si ouvert
  rpgBonusMenuOpen=false;var bm=document.getElementById('rpg-bonus-menu');if(bm)bm.className='rpg-bonus-menu';

  // Narrative
  var narEl=document.getElementById('rpg-narrative-text');
  narEl.textContent='Nouveau ticket entrant...';narEl.style.color='';narEl.style.borderLeftColor='';

  // Ticket
  var rpgTNum=document.getElementById('rpg-ticket-num');if(rpgTNum)rpgTNum.textContent=sc.title.split(' — ')[0];
  var rpgTPrio=document.getElementById('rpg-ticket-prio');if(rpgTPrio)rpgTPrio.textContent=sc.title.split(' — ')[1]||'URGENT';
  var rpgTSit=document.getElementById('rpg-ticket-sit');if(rpgTSit)rpgTSit.textContent=sc.situation;

  // Switch to ticket view
  rpgShowView('ticket');
  rpgRenderActions(sc);
}

function rpgRenderActions(sc){
  var grid=document.getElementById('rpg-actions');
  if(!grid) return;
  grid.innerHTML='';
  var tried=rpgN.triedActions[sc.id]||[];
  var order=rpgN.actOrder[sc.id]||sc.actions.map(function(_,i){return i;});
  var keys=['A','B','C','D','E','F'];
  order.forEach(function(aIdx,ki){
    var action=sc.actions[aIdx];
    var isTried=tried.indexOf(action.id)>-1;
    var btn=document.createElement('button');
    btn.className='rpg-action-btn'+(isTried?' tried':'');
    btn.disabled=isTried;
    btn.innerHTML='<span class="rpg-action-key">'+keys[ki]+'</span><span>'+action.label+'</span>';
    if(!isTried){
      (function(a){btn.onclick=function(){playClickSoft();rpgPickAction(a);};})(action);
    }
    grid.appendChild(btn);
  });
}

function rpgPickAction(action, isFollowUp){
  playClick();
  var sc=rpgN.currentTicket;
  if(!isFollowUp){
    if(!rpgN.triedActions[sc.id]) rpgN.triedActions[sc.id]=[];
    rpgN.triedActions[sc.id].push(action.id);
  }

  rpgShowView('action');

  var resHeader=document.getElementById('rpg-result-header');
  var resText=document.getElementById('rpg-result-text');
  var subchoices=document.getElementById('rpg-subchoices');
  var inlineQ=document.getElementById('rpg-inline-q');
  var resolution=document.getElementById('rpg-resolution');
  var nextBtn=document.getElementById('rpg-next-btn');

  if(resHeader) resHeader.textContent='→ '+action.label;
  if(subchoices) subchoices.style.display='none';
  if(inlineQ) inlineQ.style.display='none';
  if(resolution) resolution.style.display='none';
  if(nextBtn){nextBtn.className='rpg-next-btn';nextBtn.style.background='';nextBtn.style.borderColor='';nextBtn.style.color='';}

  // ── MAUVAISE PISTE ──
  if(action.type==='MAUVAISE_PISTE'&&action.malus){
    if(resText){resText.textContent=action.consequence;resText.className='rpg-result-text bad';}
    rpgChangeConf(RPG.CONF_BAD_PISTE);
    if(nextBtn){
      nextBtn.textContent='← REVENIR AUX ACTIONS';
      nextBtn.className='rpg-next-btn show';
      nextBtn.onclick=function(){rpgShowView('ticket');rpgRenderActions(sc);};
    }

  // ── NEUTRE ──
  } else if(action.type==='NEUTRE'){
    if(resText){resText.textContent=action.consequence;resText.className='rpg-result-text neutral';}
    if(nextBtn){
      nextBtn.textContent='← REVENIR AUX ACTIONS';
      nextBtn.className='rpg-next-btn show';
      nextBtn.onclick=function(){rpgShowView('ticket');rpgRenderActions(sc);};
    }

  // ── BONNE PISTE ──
  } else if(action.type==='BONNE_PISTE'){
    if(resText){resText.textContent=action.consequence;resText.className='rpg-result-text good';}
    rpgChangeConf(RPG.CONF_GOOD_ACTION);

    // Si des sous-actions (niveau 2)
    if(action.follow_up_actions&&action.follow_up_actions.length){
      // Afficher narrative de suite
      var narEl=document.getElementById('rpg-narrative-text');
      if(narEl&&action.follow_up){narEl.textContent=action.follow_up;narEl.style.color='#4a6030';}
      // Afficher les sous-actions
      if(nextBtn){
        nextBtn.textContent='APPROFONDIR →';
        nextBtn.className='rpg-next-btn show';
        nextBtn.style.background='#3a3010';
        nextBtn.style.borderColor='#a07820';
        nextBtn.style.color='#d4a830';
        (function(subActions){
          nextBtn.onclick=function(){
            nextBtn.className='rpg-next-btn';
            nextBtn.style.background='';nextBtn.style.borderColor='';nextBtn.style.color='';
            rpgRenderFollowUpActions(subActions,sc,resolution,inlineQ,nextBtn);
          };
        })(action.follow_up_actions);
      }

    // Si direct_resolve
    } else if(action.direct_resolve){
      rpgN.stats.ok++;
      if(nextBtn){
        nextBtn.textContent='✓ VOIR LA RÉSOLUTION →';
        nextBtn.className='rpg-next-btn show';
        nextBtn.onclick=function(){
          nextBtn.className='rpg-next-btn';
          rpgShowResolutionPanel(true,sc,resolution,nextBtn);
        };
      }

    // Si question
    } else if(action.question_id){
      rpgN.stats.ok++;
      if(nextBtn){
        nextBtn.textContent='✓ VOIR LA RÉSOLUTION →';
        nextBtn.className='rpg-next-btn show';
        nextBtn.onclick=function(){
          nextBtn.className='rpg-next-btn';
          rpgShowResolutionPanel(true,sc,resolution,nextBtn,action.question_id,inlineQ);
        };
      }

    } else {
      rpgN.stats.ok++;
      if(nextBtn){
        nextBtn.textContent='✓ VOIR LA RÉSOLUTION →';
        nextBtn.className='rpg-next-btn show';
        nextBtn.onclick=function(){
          nextBtn.className='rpg-next-btn';
          rpgShowResolutionPanel(true,sc,resolution,nextBtn);
        };
      }
    }
  }
}

function rpgRenderFollowUpActions(subActions,sc,resolution,inlineQ,nextBtn){
  var subchoices=document.getElementById('rpg-subchoices');
  var grid=document.getElementById('rpg-subchoice-list');
  if(!subchoices||!grid) return;
  subchoices.style.display='flex';
  grid.innerHTML='';
  var keys=['A','B','C','D'];
  var triedSubs=[];
  subActions.forEach(function(sa,ki){
    var isTried=triedSubs.indexOf(sa.id)>-1;
    var btn=document.createElement('button');
    btn.className='rpg-action-btn'+(isTried?' tried':'');
    btn.disabled=isTried;
    btn.innerHTML='<span class="rpg-action-key">'+(keys[ki]||'?')+'</span><span>'+sa.label+'</span>';
    if(!isTried){
      (function(sub){
        btn.onclick=function(){
          triedSubs.push(sub.id);
          btn.className='rpg-action-btn tried';btn.disabled=true;
          // Ajouter la conséquence sous la liste
          var extra=document.createElement('div');
          extra.className='rpg-result-text '+(sub.type==='BONNE_PISTE'?'good':sub.type==='MAUVAISE_PISTE'?'bad':'neutral');
          extra.style.marginTop='8px';
          extra.textContent=sub.consequence;
          grid.after(extra);

          if(sub.type==='MAUVAISE_PISTE'&&sub.malus){
            rpgChangeConf(RPG.CONF_BAD_PISTE);
            // Reste sur les sous-actions
          } else if(sub.type==='BONNE_PISTE'){
            rpgChangeConf(RPG.CONF_GOOD_ACTION);
            rpgN.stats.ok++;
            // Masquer les autres sous-actions
            subchoices.style.display='none';
            // Afficher résolution
            if(nextBtn){
              nextBtn.textContent='✓ VOIR LA RÉSOLUTION →';
              nextBtn.className='rpg-next-btn show';
              nextBtn.style.background='';nextBtn.style.borderColor='';nextBtn.style.color='';
              (function(qid){
                nextBtn.onclick=function(){
                  nextBtn.className='rpg-next-btn';
                  rpgShowResolutionPanel(true,sc,resolution,nextBtn,qid,inlineQ);
                };
              })(sub.question_id);
            }
          }
        };
      })(sa);
    }
    grid.appendChild(btn);
  });
}


// Affiche la résolution du ticket, PUIS (si question_id) propose la question bonus
function rpgShowResolutionPanel(ok,sc,resolution,nextBtn,questionId,inlineQ){
  if(!resolution) return;
  resolution.style.display='block';
  resolution.className='rpg-resolution '+(ok?'ok':'fail');
  var lbl=document.getElementById('rpg-resolution-label');
  var txt=document.getElementById('rpg-resolution-text');
  if(lbl) lbl.textContent=ok?'✓ TICKET RÉSOLU':'✗ INCIDENT AGGRAVÉ';
  if(txt) txt.textContent=ok?sc.resolution_ok:sc.resolution_fail;

  // Notification barre de confiance (déjà faite dans rpgChangeConf)

  // Mettre à jour la narrative
  var narEl=document.getElementById('rpg-narrative-text');
  if(narEl){
    narEl.textContent=ok?sc.resolution_ok:sc.resolution_fail;
    narEl.style.color=ok?'#6a8a50':'#8a3020';
    narEl.style.borderLeftColor=ok?'#4a7a30':'#8b3020';
  }

  // Vérifier fin de partie
  if(rpgN.confidence<=0){setTimeout(function(){rpgEndSession(true);},1800);return;}
  if(rpgN.confidence>=100){setTimeout(function(){rpgEndSession(false,true);},1800);return;}

  // Bouton selon s'il y a une question bonus
  if(questionId&&inlineQ&&!rpgN.questionAnswered){
    if(nextBtn){
      nextBtn.textContent='🔎 QUESTION BONUS DE COMPRÉHENSION →';
      nextBtn.className='rpg-next-btn show';
      nextBtn.style.background='#4a3a10';
      nextBtn.style.borderColor='#d97706';
      nextBtn.style.color='#fbbf24';
      (function(qid){
        nextBtn.onclick=function(){
          nextBtn.className='rpg-next-btn';
          nextBtn.style.background='';nextBtn.style.borderColor='';nextBtn.style.color='';
          rpgShowInlineQuestion(qid,inlineQ,null,nextBtn,sc);
        };
      })(questionId);
    }
  } else {
    rpgShowNextTicketBtn(nextBtn);
  }
}

function rpgShowNextTicketBtn(nextBtn){
  if(!nextBtn) return;
  nextBtn.textContent=rpgN.ticketIdx+1<rpgN.ticketOrder.length?'TICKET SUIVANT ▶':'VOIR LES RÉSULTATS ▶';
  nextBtn.className='rpg-next-btn show';
  nextBtn.style.background='';nextBtn.style.borderColor='';nextBtn.style.color='';
  nextBtn.onclick=function(){
    rpgN.ticketIdx++;rpgN.questionAnswered=false;rpgN.currentTicket=null;
    var narEl=document.getElementById('rpg-narrative-text');
    if(narEl){narEl.style.color='';narEl.style.borderLeftColor='';}
    rpgShowTicket();
  };
}


function rpgShowInlineQuestion(qid,inlineQ,resolution,nextBtn,sc){
  var qdata=RPG_QUESTIONS[qid];
  if(!qdata||rpgN.questionAnswered) return;
  if(!inlineQ) return;
  inlineQ.style.display='block';
  // Label style "as-tu bien compris ?"
  var lbl=document.getElementById('rpg-inline-q-label');
  if(lbl) lbl.textContent='🎓 AS-TU BIEN COMPRIS ? (bonus confiance si correct)';
  document.getElementById('rpg-inline-q-text').textContent=qdata.q;
  // Bouton PASSER (skip la question)
  // Vider le skip btn précédent si présent
  var qbox=document.getElementById('rpg-inline-q');
  if(qbox){
    var oldSkip=qbox.querySelector('.rpg-skip-btn');
    if(oldSkip) oldSkip.remove();
    var skipBtn=document.createElement('button');
    skipBtn.className='rpg-skip-btn';
    skipBtn.textContent='PASSER →';
    skipBtn.style.cssText='float:right;background:none;border:1px dashed #8a7a5a;color:#8a7a5a;font-family:Courier New,monospace;font-size:9px;padding:3px 8px;cursor:pointer;margin-bottom:8px;';
    skipBtn.onclick=function(){
      if(inlineQ) inlineQ.style.display='none';
      rpgShowNextTicketBtn(nextBtn);
    };
    qbox.insertBefore(skipBtn,qbox.firstChild);
  }
  var expl=document.getElementById('rpg-inline-expl');
  if(expl){expl.textContent=qdata.x;expl.className='rpg-inline-expl';}
  var optsEl=document.getElementById('rpg-inline-opts');
  optsEl.innerHTML='';
  var shuffled=shuffle(qdata.opts.map(function(t,i){return{t:t,i:i};}));
  ['A','B','C','D'].forEach(function(k,i){
    if(!shuffled[i]) return;
    var b=document.createElement('button');
    b.className='rpg-inline-opt';
    var ri=shuffled[i].t;
    var rHtml=(typeof ri==='object'&&ri&&ri.v!==undefined)
      ? safeQuestionHtml(String(ri.v))+(ri.sub?'<span class="calc-sub">'+escapeUserHtml(ri.sub)+'</span>':'')
      : safeQuestionHtml(String(ri));
    b.innerHTML='<span style="font-weight:bold;margin-right:8px;">'+k+'.</span><span>'+rHtml+'</span>';
    var isOk=shuffled[i].i===qdata.a;
    (function(btn,correct){
      btn.onclick=function(){
        if(rpgN.questionAnswered) return;
        rpgN.questionAnswered=true;
        optsEl.querySelectorAll('.rpg-inline-opt').forEach(function(x,xi){
          x.disabled=true;
          if(shuffled[xi]&&shuffled[xi].i===qdata.a) x.classList.add('ok');
        });
        btn.classList.add(correct?'ok':'err');
        if(expl) expl.className='rpg-inline-expl show';
        // Question bonus : pas d'impact sur la barre
        // Si correct → +1 joker
        if(correct){
          rpgN.jokers=(rpgN.jokers||0)+1;
          rpgUpdateJokerDisplay();
          // Toast joker
          var jt=document.createElement('div');
          jt.style.cssText='position:fixed;top:60px;left:50%;transform:translateX(-50%);background:#4a7a20;color:#fef3c7;font-family:Courier New,monospace;font-size:11px;padding:8px 16px;border:2px solid #2a5a10;z-index:990;box-shadow:3px 3px 0 #1a4008;letter-spacing:1px;';
          jt.textContent='🃏 +1 JOKER GAGNÉ !';
          document.body.appendChild(jt);
          setTimeout(function(){if(jt.parentNode)jt.remove();},2000);
        }
        // Toujours afficher le bouton ticket suivant
        rpgShowNextTicketBtn(nextBtn);
      };
    })(b,isOk);
    optsEl.appendChild(b);
  });
}

function rpgShowResolution(ok,sc,resolution,nextBtn){
  if(!resolution) return;
  resolution.style.display='block';
  resolution.className='rpg-resolution '+(ok?'ok':'fail');
  var lbl=document.getElementById('rpg-resolution-label');
  var txt=document.getElementById('rpg-resolution-text');
  if(lbl) lbl.textContent=ok?'✓ TICKET RÉSOLU':'✗ INCIDENT AGGRAVÉ';
  if(txt) txt.textContent=ok?sc.resolution_ok:sc.resolution_fail;

  // Mettre à jour narrative en haut
  var narEl=document.getElementById('rpg-narrative-text');
  if(narEl){narEl.textContent=ok?sc.resolution_ok:sc.resolution_fail;narEl.style.color=ok?'#00a85a':'#dc2626';narEl.style.borderLeftColor=ok?'#00a85a':'#dc2626';}

  if(rpgN.confidence<=0){setTimeout(function(){rpgEndSession(true);},1800);return;}
  if(rpgN.confidence>=100){setTimeout(function(){rpgEndSession(false,true);},1800);return;}

  if(nextBtn){
    nextBtn.textContent=rpgN.ticketIdx+1<rpgN.ticketOrder.length?'TICKET SUIVANT ▶':'VOIR LES RÉSULTATS ▶';
    nextBtn.className='rpg-next-btn show';
    nextBtn.onclick=function(){
      rpgN.ticketIdx++;rpgN.questionAnswered=false;rpgN.currentTicket=null;
      rpgShowTicket();
    };
  }
}

function rpgGoBack(){
  // Retour vers la vue ticket depuis la vue action
  var vt=document.getElementById('rpg-view-ticket');
  var va=document.getElementById('rpg-view-action');
  if(va&&va.classList.contains('active')){
    rpgShowView('ticket');
    rpgRenderActions(rpgN.currentTicket);
  } else {
    rpgQuit();
  }
}

function rpgShowView(which){
  // S'assurer que l'écran RPG est actif avant de manipuler ses enfants
  var rpgScreen=document.getElementById('screen-rpg-narrative');
  if(!rpgScreen||!rpgScreen.classList.contains('active')) return;
  var vt=document.getElementById('rpg-view-ticket');
  var va=document.getElementById('rpg-view-action');
  var backBtn=document.getElementById('rpg-back-btn');
  if(which==='ticket'){
    if(vt) vt.classList.add('active');
    if(va) va.classList.remove('active');
    if(backBtn) backBtn.textContent='◀ QUITTER';
  } else {
    if(vt) vt.classList.remove('active');
    if(va) va.classList.add('active');
    if(backBtn) backBtn.textContent='◀ RETOUR';
  }
  if(rpgScreen) rpgScreen.scrollTop=0;
  window.scrollTo(0,0);
}

function rpgChangeConf(delta){
  rpgN.confidence=Math.max(0,Math.min(100,rpgN.confidence+delta));
  if(delta>0)playConfUp();else if(delta<0)playConfDown();
  rpgUpdateBar(delta);
}

function rpgUpdateBar(delta){
  requestAnimationFrame(function(){
    var screen=document.getElementById('screen-rpg-narrative');
    if(!screen) return; // écran pas dans le DOM
    var fill=document.getElementById('rpg-trust-fill');
    var pct=document.getElementById('rpg-trust-pct');
    if(fill) fill.style.width=Math.round(rpgN.confidence)+'%';
    if(pct) pct.textContent=Math.round(rpgN.confidence)+'%';
    if(delta&&delta!==0){
      var ind=document.getElementById('rpg-conf-delta');
      if(ind){
        ind.textContent=(delta>0?'+':'')+delta;
        ind.className='';
        void ind.offsetWidth;
        ind.className='rpg-conf-delta '+(delta>0?'show-up':'show-down');
        // sons gérés dans rpgChangeConf
        setTimeout(function(){var i2=document.getElementById('rpg-conf-delta');if(i2)i2.className='rpg-conf-delta';},1800);
      }
    }
    rpgUpdateBadge();
  });
}

function rpgUpdateJokerDisplay(){
  var jc=document.getElementById('rpg-joker-count');
  if(jc) jc.textContent='🃏 '+(rpgN.jokers||0)+' JOKER'+(rpgN.jokers>1?'S':'');
}
function rpgUpdateBadge(){
  var b=document.getElementById('rpg-badge');
  if(!b) return;
  var c=rpgN.confidence;
  if(c>=80){b.textContent='EXPERT ★';b.style.color='#fbbf24';}
  else if(c>=60){b.textContent='CONFIRMÉ';b.style.color='#00a85a';}
  else if(c>=40){b.textContent='TECHNICIEN';b.style.color='#c8bc9a';}
  else if(c>=20){b.textContent='EN DIFFICULTÉ';b.style.color='#ff9800';}
  else{b.textContent='CRITIQUE';b.style.color='#dc2626';}
}
function rpgEndSession(fired,promoted){
  document.body.classList.remove('rpg-mode');
  currentUI=lsGet('tssr5_ui','ui-neon');
  // Afficher l'écran de fin avec fond paper forcé via CSS inline
  document.querySelectorAll('.screen').forEach(function(s){s.style.display='none';s.classList.remove('active');});
  var endScreen=document.getElementById('screen-rpg-end');
  if(endScreen){endScreen.style.display='flex';endScreen.classList.add('active');}

  var title=promoted?'PROMOTION !':fired?'LICENCIÉ...':rpgN.stats.ok>=rpgN.stats.fail?'MISSION ACCOMPLIE':'SESSION DIFFICILE';
  var col=promoted?'#8b1a1a':fired?'#8b1a1a':rpgN.stats.ok>=rpgN.stats.fail?'#2a5a10':'#6a1a08';
  var sub=promoted?'Confiance maximale. Ton chef te propose une promotion au poste de chef de projet.':
    fired?'Trop derreurs. Rends ton badge.':
    rpgN.confidence>=60?'Bon travail. Quelques points a ameliorer.':
    'Session difficile. Revois les points rates.';

  var t=document.getElementById('rpg-end-title'); if(t){t.textContent=title;t.style.color=col;}
  var s=document.getElementById('rpg-end-sub'); if(s) s.textContent=sub;
  var c=document.getElementById('rpg-end-conf'); if(c){c.textContent=rpgN.confidence+'%';c.style.color=col;}
  var ok=document.getElementById('rpg-end-ok'); if(ok) ok.textContent=rpgN.stats.ok;
  var fa=document.getElementById('rpg-end-fail'); if(fa) fa.textContent=rpgN.stats.fail;

  // Cacher les éléments RPG
  var bslot=document.getElementById('rpg-bonus-slot');if(bslot)bslot.className='rpg-bonus-slot';
  var bm=document.getElementById('rpg-bonus-menu');if(bm)bm.className='rpg-bonus-menu';
  var tb=document.getElementById('rpg-trust-bar');if(tb)tb.style.display='none';
}

function rpgQuit(){
  document.body.classList.remove('rpg-mode');
  var bb=document.getElementById('rpg-bonus-btn');if(bb) bb.style.display='none';
  var bm=document.getElementById('rpg-bonus-menu');if(bm) bm.classList.remove('show');
  var lex=document.getElementById('rpg-lexique');if(lex) lex.remove();
  goMenu();
}

function rpgNextTicket(){/* handled inline */}


// =====================================================
// =====================================================
// LAUNCH WIZARD
// =====================================================
var wizSelCats=['mix'];
var selDiff='all';

// ── Variable pour tracker le groupe sélectionné (pour le badge du jeu) ──
var wizSelGroup = null; // null = mix/multi, sinon clé du groupe

function buildSheetCats(){
  wizSelCats = ['mix'];
  wizSelGroup = null;
  selCat = 'mix';
  _renderGroupLevel();
  applyBody();
}

// ── Niveau 1 : Afficher les groupes ──
function _renderGroupLevel(){
  var grid = document.getElementById('sheet-cat-grid');
  if (!grid) return;
  grid.innerHTML = '';
  // 3 colonnes compactes, tout visible sans scroll
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin-bottom:8px;overflow:visible;max-height:none;align-items:stretch;';

  var GROUPS = window.GROUPS || {};
  var isMix = wizSelCats.length === 1 && wizSelCats[0] === 'mix';

  // ── Carte MIX pleine largeur ──
  var mixSt  = stD['mix'] || {played:0, correct:0};
  var mixPct = mixSt.played > 0 ? Math.round(mixSt.correct / mixSt.played * 100) : null;
  var mixTotal = 0;
  Object.keys(CATS).forEach(function(k){ if(k!=='mix') mixTotal += (CATS[k]&&CATS[k].qs?CATS[k].qs.length:0); });

  var mixCard = document.createElement('div');
  mixCard.style.cssText = 'grid-column:span 2;display:flex;align-items:center;gap:10px;padding:8px 14px;cursor:pointer;border-radius:8px;' +
    'background:' + (isMix ? 'var(--a2)' : 'var(--panel)') + ';' +
    'border:' + (isMix ? '2px solid var(--acc)' : '1px solid var(--border)') + ';transition:all .15s;';
  mixCard.innerHTML =
    '<span style="font-size:18px">🎲</span>' +
    '<div style="flex:1;text-align:left;">' +
      '<div style="font-weight:bold;font-size:10px;color:var(--acc);margin-bottom:1px;">MIX — TOUT EN VRAC</div>' +
      '<div style="font-size:8.5px;color:var(--text2);">' + mixTotal + ' questions · Tous groupes mélangés</div>' +
    '</div>' +
    (isMix ? '<span style="font-size:8px;color:var(--acc);font-family:monospace;background:rgba(0,168,90,.15);padding:2px 6px;border-radius:3px;">✓ SÉLECTIONNÉ</span>' : '') +
    (mixPct !== null ? '<span style="font-size:9px;color:var(--dim);font-family:monospace;margin-left:8px;">' + mixPct + '%</span>' : '');
  mixCard.onclick = function(){
    wizSelCats = ['mix'];
    wizSelGroup = null;
    selCat = 'mix';
    _renderGroupLevel();
    applyBody();
  };
  grid.appendChild(mixCard);

  // ── Séparateur ──
  var sep = document.createElement('div');
  sep.style.cssText = 'grid-column:span 2;font-family:monospace;font-size:8px;color:var(--dim);letter-spacing:1px;text-transform:uppercase;text-align:center;padding:4px 0 2px 0;';
  sep.textContent = 'ou choisir un groupe';
  grid.appendChild(sep);

  // ── Cartes groupes — 3 colonnes ──
  Object.keys(GROUPS).forEach(function(groupId){
    var grp = GROUPS[groupId];
    // Calculer le total de questions du groupe
    var groupTotal = 0;
    var groupPlayed = 0, groupCorrect = 0;
    (grp.cats || []).forEach(function(catId){
      var c = CATS[catId];
      if (!c) return;
      groupTotal += (c.qs ? c.qs.length : 0);
      var st = stD[catId] || {played:0, correct:0};
      groupPlayed  += st.played;
      groupCorrect += st.correct;
    });
    var groupPct = groupPlayed > 0 ? Math.round(groupCorrect / groupPlayed * 100) : null;
    var catCount = (grp.cats || []).length;

    // Vérifier si toutes les cats du groupe sont sélectionnées
    var isGroupSel = wizSelGroup === groupId;

    var card = document.createElement('div');
    card.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 10px;cursor:pointer;border-radius:8px;' +
      'background:' + (isGroupSel ? 'var(--a2)' : 'var(--panel)') + ';' +
      'border:' + (isGroupSel ? '1.5px solid var(--acc)' : '1px solid var(--border)') + ';transition:all .15s;min-height:44px;box-sizing:border-box;height:100%;';
    card.innerHTML =
      '<span style="font-size:16px">' + (grp.label ? grp.label.split(' ')[0] : '📁') + '</span>' +
      '<div style="flex:1;min-width:0;">' +
        '<div style="font-size:9.5px;font-weight:bold;color:var(--text);margin-bottom:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' +
          (grp.label || groupId) +
        '</div>' +
        '<div style="font-size:8px;color:var(--text2);font-family:monospace;">' +
          groupTotal + ' Q · ' + catCount + ' cat.' +
        '</div>' +
      '</div>' +
      (groupPct !== null
        ? '<span style="font-size:9px;color:var(--dim);font-family:monospace;margin-left:2px;">' + groupPct + '%</span>'
        : '') +
      '<span style="font-size:11px;color:var(--text2);margin-left:2px;">›</span>';
    card.onmouseenter = function(){ if(!isGroupSel) card.style.borderColor='var(--acc)'; };
    card.onmouseleave = function(){ if(!isGroupSel) card.style.borderColor='var(--border)'; };
    (function(gId, gData){
      card.onclick = function(){
        wizSelGroup = gId;
        _openGroupCatsPopup(gId, gData);
      };
    })(groupId, grp);
    grid.appendChild(card);
  });
}

// ── Niveau 2 (stub) : logique déplacée dans _openGroupCatsPopup ──
function _renderCatLevel(groupId, grpData){
  // Vide — intégré dans _openGroupCatsPopup
}

// ── Popup modale : catégories d'un groupe ──
function _openGroupCatsPopup(groupId, grpData){
  // Supprimer toute popup existante
  var old = document.getElementById('grp-cats-overlay');
  if(old) old.remove();

  var cats = grpData.cats || [];

  // Pré-sélection : toutes les cats du groupe si rien n'est sélectionné dans ce groupe
  var hasAny = cats.some(function(c){ return wizSelCats.indexOf(c) > -1; });
  if(!hasAny){
    wizSelCats = cats.slice();
    selCat = cats[0] || 'mix';
    applyBody();
  }

  // Snapshot mutable pour la popup (on confirme en cliquant sur le bouton)
  var popSel = wizSelCats.slice();

  // ── OVERLAY ──
  var overlay = document.createElement('div');
  overlay.id = 'grp-cats-overlay';
  overlay.style.cssText = [
    'position:fixed;inset:0;z-index:9999;',
    'display:flex;align-items:center;justify-content:center;',
    'background:rgba(0,0,0,.55);backdrop-filter:blur(6px);',
    '-webkit-backdrop-filter:blur(6px);',
    'animation:fadeInOverlay .18s ease;'
  ].join('');

  // ── POPUP CARD ──
  var popup = document.createElement('div');
  popup.style.cssText = [
    'position:relative;width:min(92vw,460px);max-height:88vh;',
    'display:flex;flex-direction:column;',
    'background:var(--panel);border:1.5px solid var(--border2);border-radius:16px;',
    'box-shadow:0 24px 64px rgba(0,0,0,.6);overflow:hidden;',
    'animation:slideUpPopup .22s cubic-bezier(.22,1,.36,1);'
  ].join('');

  // ── HEADER ──
  var header = document.createElement('div');
  header.style.cssText = [
    'display:flex;align-items:center;justify-content:space-between;',
    'padding:14px 16px 10px;border-bottom:1px solid var(--border);',
    'background:var(--bg2);flex-shrink:0;'
  ].join('');

  var groupTotal = 0;
  cats.forEach(function(cId){ var c=CATS[cId]; if(c) groupTotal += (c.qs?c.qs.length:0); });

  var headerLeft = document.createElement('div');
  headerLeft.innerHTML =
    '<div style="font-size:13px;font-weight:bold;color:var(--acc);margin-bottom:2px;">' + (grpData.label||groupId) + '</div>' +
    '<div style="font-size:9px;color:var(--text2);font-family:monospace;">' + cats.length + ' catégories · ' + groupTotal + ' questions</div>';

  var closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.style.cssText = [
    'background:none;border:1px solid var(--border2);border-radius:6px;',
    'color:var(--text2);font-size:12px;cursor:pointer;padding:4px 8px;',
    'transition:all .12s;'
  ].join('');
  closeBtn.onmouseenter = function(){ closeBtn.style.borderColor='var(--acc)'; closeBtn.style.color='var(--acc)'; };
  closeBtn.onmouseleave = function(){ closeBtn.style.borderColor='var(--border2)'; closeBtn.style.color='var(--text2)'; };
  closeBtn.onclick = function(){ overlay.remove(); };

  header.appendChild(headerLeft);
  header.appendChild(closeBtn);
  popup.appendChild(header);

  // ── BOUTON TOUT LE GROUPE ──
  var playAllWrap = document.createElement('div');
  playAllWrap.style.cssText = 'padding:10px 14px 6px;flex-shrink:0;';

  var playAllBtn = document.createElement('div');
  playAllBtn.id = 'pop-play-all';
  playAllBtn.style.cssText = [
    'display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;',
    'border-radius:10px;border:1.5px solid var(--acc);background:var(--a2);',
    'transition:all .14s;'
  ].join('');

  function refreshPlayAll(){
    var allSel = cats.length > 0 && cats.every(function(c){ return popSel.indexOf(c) > -1; });
    playAllBtn.style.background = allSel ? 'var(--a2)' : 'var(--panel)';
    playAllBtn.style.border = allSel ? '1.5px solid var(--acc)' : '1px dashed var(--acc)';
    var badge = playAllBtn.querySelector('#pop-all-badge');
    if(badge){
      badge.textContent = allSel ? '✓ SÉLECTIONNÉ' : '▶ TOUT CHOISIR';
      badge.style.color = allSel ? 'var(--acc)' : 'var(--text2)';
      badge.style.background = allSel ? 'rgba(0,168,90,.15)' : 'var(--bg2)';
    }
  }

  playAllBtn.innerHTML =
    '<span style="font-size:18px">⚡</span>' +
    '<div style="flex:1">' +
      '<div style="font-size:10px;font-weight:bold;color:var(--acc);">JOUER TOUT LE GROUPE</div>' +
      '<div style="font-size:8.5px;color:var(--text2);font-family:monospace;">' + groupTotal + ' questions · toutes catégories</div>' +
    '</div>' +
    '<span id="pop-all-badge" style="font-size:8px;font-family:monospace;padding:3px 7px;border-radius:4px;">▶ TOUT CHOISIR</span>';

  playAllBtn.onclick = function(){
    if(cats.every(function(c){ return popSel.indexOf(c) > -1; })){
      // Déselectionner tout
      cats.forEach(function(c){ var i=popSel.indexOf(c); if(i>-1) popSel.splice(i,1); });
      if(popSel.length === 0) popSel.push('mix');
    } else {
      // Sélectionner tout
      cats.forEach(function(c){ if(popSel.indexOf(c) === -1) popSel.push(c); });
      var mixI = popSel.indexOf('mix');
      if(mixI > -1 && popSel.length > 1) popSel.splice(mixI, 1);
    }
    refreshPlayAll();
    refreshCatCards();
  };
  playAllWrap.appendChild(playAllBtn);
  popup.appendChild(playAllWrap);

  // ── SÉPARATEUR ──
  var sepLine = document.createElement('div');
  sepLine.style.cssText = 'margin:0 14px;border-top:1px solid var(--border);flex-shrink:0;';
  popup.appendChild(sepLine);

  // ── GRILLE DES CATÉGORIES (scrollable) ──
  var body = document.createElement('div');
  body.id = 'group-cats-popup-body';
  body.style.cssText = [
    'overflow-y:auto;padding:10px 14px;flex:1;',
    'display:grid;grid-template-columns:repeat(2,1fr);gap:8px;'
  ].join('');

  function refreshCatCards(){
    // Reconstruire les cartes selon popSel
    body.innerHTML = '';
    cats.forEach(function(catId){
      var c = CATS[catId];
      if(!c) return;
      var st  = stD[catId] || {played:0, correct:0};
      var pct = st.played > 0 ? Math.round(st.correct/st.played*100) : null;
      var isSel = popSel.indexOf(catId) > -1;

      var card = document.createElement('div');
      card.style.cssText = [
        'display:flex;align-items:center;gap:8px;padding:8px 10px;cursor:pointer;',
        'border-radius:8px;min-height:42px;box-sizing:border-box;transition:all .13s;',
        'background:' + (isSel ? 'var(--a2)' : 'var(--panel)') + ';',
        'border:' + (isSel ? '1.5px solid var(--acc)' : '1px solid var(--border)') + ';'
      ].join('');
      card.innerHTML =
        '<span style="font-size:16px;flex-shrink:0;">' + (c.icon||'📁') + '</span>' +
        '<div style="flex:1;min-width:0;">' +
          '<div style="font-family:monospace;font-size:8.5px;font-weight:bold;color:var(--text);' +
               'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px;">' + (c.label||catId) + '</div>' +
          '<div style="font-family:monospace;font-size:7.5px;color:var(--dim);">' +
            (pct !== null ? pct+'%' : (c.qs?c.qs.length:0)+'Q') +
          '</div>' +
        '</div>' +
        (isSel ? '<span style="font-size:10px;color:var(--acc);">✓</span>' : '');

      (function(cId){
        card.onclick = function(){
          var idx = popSel.indexOf(cId);
          if(idx > -1){
            if(popSel.length > 1) popSel.splice(idx, 1);
          } else {
            popSel.push(cId);
            var mixI = popSel.indexOf('mix');
            if(mixI > -1 && popSel.length > 1) popSel.splice(mixI, 1);
          }
          refreshCatCards();
          refreshPlayAll();
        };
      })(catId);

      body.appendChild(card);
    });
  }

  refreshCatCards();
  refreshPlayAll();
  popup.appendChild(body);

  // ── FOOTER — bouton confirmer ──
  var footer = document.createElement('div');
  footer.style.cssText = [
    'padding:10px 14px 14px;border-top:1px solid var(--border);',
    'background:var(--bg2);flex-shrink:0;display:flex;gap:8px;'
  ].join('');

  var cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Annuler';
  cancelBtn.style.cssText = [
    'flex:1;padding:9px;border-radius:8px;border:1px solid var(--border2);',
    'background:none;color:var(--text2);font-family:monospace;font-size:9px;',
    'cursor:pointer;transition:all .12s;'
  ].join('');
  cancelBtn.onclick = function(){ overlay.remove(); };

  var confirmBtn = document.createElement('button');
  confirmBtn.textContent = 'Confirme la sélection ✓';
  confirmBtn.style.cssText = [
    'flex:2;padding:9px;border-radius:8px;border:none;',
    'background:var(--acc);color:#fff;font-family:monospace;font-size:9px;',
    'font-weight:bold;cursor:pointer;transition:all .14s;letter-spacing:.5px;'
  ].join('');
  confirmBtn.onmouseenter = function(){ confirmBtn.style.filter='brightness(1.15)'; };
  confirmBtn.onmouseleave = function(){ confirmBtn.style.filter=''; };
  confirmBtn.onclick = function(){
    // Appliquer la sélection
    wizSelCats = popSel.length > 0 ? popSel.slice() : cats.slice();
    wizSelGroup = groupId;
    selCat = wizSelCats[0] || 'mix';
    applyBody();
    _renderGroupLevel(); // Rafraîchir la grille groupes pour voir la sélection active
    overlay.remove();
  };

  footer.appendChild(cancelBtn);
  footer.appendChild(confirmBtn);
  popup.appendChild(footer);

  overlay.appendChild(popup);

  // Fermer en cliquant hors de la popup
  overlay.onclick = function(e){ if(e.target === overlay) overlay.remove(); };

  document.body.appendChild(overlay);

  // Injecter les animations si pas encore présentes
  if(!document.getElementById('grp-popup-anim')){
    var st = document.createElement('style');
    st.id = 'grp-popup-anim';
    st.textContent = [
      '@keyframes fadeInOverlay{from{opacity:0}to{opacity:1}}',
      '@keyframes slideUpPopup{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}'
    ].join('');
    document.head.appendChild(st);
  }
}




function buildSheetModes(){
  var grid=document.getElementById('sheet-mode-grid');
  if(!grid) return;
  grid.style.cssText='display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:12px;';
  var modes=[
    {id:'chill',icon:'😌',name:'CHILL',desc:'Pas de timer',size:'full'},
    {id:'speed',icon:'⚡',name:'SPEED',desc:'20s/q',badge:''},
    {id:'survie',icon:'💀',name:'SURVIE',desc:'3 vies',badge:'HARD'},
    {id:'blitz',icon:'🔥',name:'BLITZ',desc:'10s · 1 vie',badge:'EXTREME'},
    {id:'exam',icon:'📝',name:'EXAMEN',desc:'20Q sans feedback',badge:'EXAM'},
    {id:'erreurs',icon:'📌',name:'ERREURS',desc:'Tes ratées',badge:''},
    {id:'chrono',icon:'⏱️',name:'CHRONO',desc:'3 min max',badge:''},
    {id:'mort',icon:'☠️',name:'MORT SUB.',desc:'1 erreur = fini',badge:''},
    {id:'marathon',icon:'🏃',name:'MARATHON',desc:'Toutes les Q',badge:''},
    {id:'inverse',icon:'🔄',name:'INVERSÉ',desc:'Trouve la question',badge:''},
    {id:'speedrun',icon:'💨',name:'SPEEDRUN',desc:'Chrono perso',badge:''},
    {id:'boss',icon:'👹',name:'BOSS',desc:'10Q croissantes',badge:''},
    {id:'chaos',icon:'🌀',name:'CHAOS',desc:'Règles instables',badge:'CHAOS'},
    {id:'flash',icon:'🃏',name:'FLASHCARD',desc:'Retourne les cartes',badge:''},
    {id:'duel',icon:'⚔️',name:'DUEL',desc:'2 joueurs',badge:'2P'},
    {id:'rpg',icon:'🎭',name:'RPG NARRATIF',desc:'Tickets incidents',badge:'RPG'},
    {id:'online_duel',icon:'⚔️',name:'DUEL EN LIGNE',desc:'Contre un ami à distance',badge:'LIVE'},
    {id:'discussion',icon:'🖥️',name:'DISCUSSION',desc:'Mode projo',badge:'PROJO'},
  ];
  grid.innerHTML='';
  modes.forEach(function(m){
    var d=document.createElement('div');
    var isSel=selMode===m.id;
    d.className='sheet-mode'+(isSel?' sel':'');
    if(m.size==='full'){
      d.style.gridColumn='1/-1';d.style.display='flex';d.style.alignItems='center';
      d.style.gap='12px';d.style.padding='14px 16px';
      d.innerHTML='<span style="font-size:22px">'+m.icon+'</span>'+
        '<div><span class="sm-name" style="font-size:9px;display:block">'+m.name+'</span>'+
        '<div class="sm-desc">'+m.desc+'</div></div>';
    } else {
      d.innerHTML='<span class="sm-icon">'+m.icon+'</span><span class="sm-name">'+m.name+'</span>'+
        '<div class="sm-desc">'+m.desc+'</div>'+(m.badge?'<span class="sm-badge">'+m.badge+'</span>':'');
    }
    (function(mId,card){card.onclick=function(){document.querySelectorAll('.sheet-mode').forEach(function(x){x.classList.remove('sel');});card.classList.add('sel');selMode=mId;};})(m.id,d);
    grid.appendChild(d);
  });
}

function sheetPickDiff(btn){
  document.querySelectorAll('.sheet-pill[data-diff]').forEach(function(b){b.classList.remove('sel');});
  btn.classList.add('sel');
  selDiff=btn.getAttribute('data-diff');
}

function sheetPickN(btn){
  document.querySelectorAll('.sheet-pill[data-n]').forEach(function(b){b.classList.remove('sel');});
  btn.classList.add('sel');
  selQCount=parseInt(btn.getAttribute('data-n'))||10;
  lsSet('tssr5_qcount',selQCount);
}

function buildQuickStats(){
  var qs=document.getElementById('quick-stats');
  if(!qs) return;
  var totalQ=Object.keys(CATS).reduce(function(a,k){
    if(k==='mix') return a;
    return a+(CATS[k]&&CATS[k].qs?CATS[k].qs.length:0);
  },0);
  var totalPlayed=Object.keys(stD).reduce(function(a,k){return a+(stD[k]?stD[k].played:0);},0);
  var totalCorrect=Object.keys(stD).reduce(function(a,k){return a+(stD[k]?stD[k].correct:0);},0);
  var globalPct=totalPlayed>0?Math.round(totalCorrect/totalPlayed*100):0;
  var mastered=Object.keys(CATS).filter(function(k){
    if(k==='mix') return false;
    var st=stD[k]||{played:0,correct:0};
    return st.played>=5&&Math.round(st.correct/st.played*100)>=70;
  }).length;
  var totalCats=Object.keys(CATS).length-1;
  var col=globalPct>=70?'#00a85a':globalPct>=50?'#ff9800':'#f87171';
  
  var questionsPct = totalQ > 0 ? Math.min(100, Math.round((totalPlayed / totalQ) * 100)) : 0;
  var categoriesPct = totalCats > 0 ? Math.min(100, Math.round((mastered / totalCats) * 100)) : 0;
  
  qs.innerHTML=
    '<div class="qs-box">' +
      '<span class="qs-val" style="color:var(--acc)">'+totalQ+'</span>' +
      '<div class="qs-bar-bg"><div class="qs-bar-fill" style="width:'+questionsPct+'%;background-color:var(--acc)"></div></div>' +
      '<div class="qs-lbl">Questions</div>' +
    '</div>'+
    '<div class="qs-box">' +
      '<span class="qs-val" style="color:'+col+'">'+globalPct+'%</span>' +
      '<div class="qs-bar-bg"><div class="qs-bar-fill" style="width:'+globalPct+'%;background-color:'+col+'"></div></div>' +
      '<div class="qs-lbl">Réussite</div>' +
    '</div>'+
    '<div class="qs-box">' +
      '<span class="qs-val" style="color:#fbbf24">'+mastered+'/'+totalCats+'</span>' +
      '<div class="qs-bar-bg"><div class="qs-bar-fill" style="width:'+categoriesPct+'%;background-color:#fbbf24"></div></div>' +
      '<div class="qs-lbl">Catégories</div>' +
    '</div>';
}

function genSeed(){
  var chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var s='';for(var i=0;i<6;i++) s+=chars[Math.floor(Math.random()*chars.length)];
  var inp=document.getElementById('seed-input');
  if(inp){inp.value=s;currentSeed=s;}
}

function copySeed(){
  var inp=document.getElementById('seed-input');if(!inp) return;
  currentSeed=inp.value.trim().toUpperCase();
  if(!currentSeed){genSeed();return;}
  navigator.clipboard&&navigator.clipboard.writeText(currentSeed);
  inp.style.borderColor='#00a85a';
  setTimeout(function(){if(inp)inp.style.borderColor='';},1200);
}

// =====================================================
// SYSTÈME DE BONUS RPG
// =====================================================
var RPG_BONUS_DEFS = [
  {
    id:'tech_call',icon:'📞',
    name:'Appeler un collegue',
    desc:'Un collegue elimine 2 mauvaises actions de ce ticket.',
    effect: function(){
      var sc=rpgN.currentTicket; if(!sc) return;
      var bad=sc.actions.filter(function(a){return a.type!=='BONNE_PISTE';});
      var toHide=shuffle(bad).slice(0,2);
      toHide.forEach(function(a){
        if(!rpgN.triedActions[sc.id]) rpgN.triedActions[sc.id]=[];
        if(rpgN.triedActions[sc.id].indexOf(a.id)===-1) rpgN.triedActions[sc.id].push(a.id);
      });
      rpgRenderActions(sc);
      rpgShowBonusNarrative('Un collegue a jete un oeil. Ces pistes semblent inutiles: '+toHide.map(function(a){return a.label;}).join(', '));
    }
  },
  {
    id:'lexique',icon:'📖',
    name:'Lexique technique',
    desc:'Un lexique des termes cles du ticket apparait en bas.',
    effect: function(){var sc=rpgN.currentTicket; if(!sc) return; rpgShowLexique(sc);}
  },
  {
    id:'historique',icon:'📋',
    name:'Consulter historique',
    desc:'Tu accedes aux logs — une indication sur la derniere modification.',
    effect: function(){
      var sc=rpgN.currentTicket; if(!sc) return;
      var hint=sc.history_hint||'Les logs montrent une modification de configuration recente sur ce service.';
      rpgShowBonusNarrative(hint);
    }
  },
  {
    id:'escalade',icon:'⬆️',
    name:'Escalader au chef',
    desc:'+20 confiance immediat. Le chef resout le ticket mais tu ne gagnes rien.',
    effect: function(){
      rpgChangeConf(20);
      rpgShowBonusNarrative('Ton chef prend en main le ticket. Confiance +20 mais tu passes au suivant sans apprendre.');
      setTimeout(function(){rpgN.ticketIdx++;rpgN.questionAnswered=false;rpgShowTicket();},2500);
    }
  },
  {
    id:'documentation',icon:'📄',
    name:'Consulter la doc',
    desc:'Revele quelle categorie de commande resout ce ticket.',
    effect: function(){
      var sc=rpgN.currentTicket; if(!sc) return;
      var catHints={
        winrm:'La doc WinRM: verifier les listeners et les hotes de confiance.',
        dns:'La doc DNS: verifier le statut du service avant toute modification de zone.',
        vlan:'Le guide Cisco: le routage inter-VLAN necessite les SVIs ET la commande ip routing.',
        hyperv:'La doc Hyper-V: les problemes de demarrage sont souvent lies aux snapshots.',
        ntfs:'La doc NTFS: les Deny explicites ecrasent tous les Allow.',
        stp:'Le guide STP: identifier les boucles physiques avant toute action logicielle.',
        dhcp:'La doc DHCP: verifier occupation du scope avant de modifier le service.',
        cisco_ssh:'Le guide Cisco IOS: SSH necessite hostname, domain-name et cles RSA.'
      };
      rpgShowBonusNarrative(catHints[sc.id]||'La doc recommande de proceder par ordre: service, config, permissions.');
    }
  },
];

var rpgBonusUsed = {};

function rpgInitBonus(){
  rpgBonusUsed={};
  // Afficher le bouton bonus
  var btn=document.getElementById('rpg-bonus-btn');
  if(btn) btn.style.display='flex';
  rpgUpdateBonusCount();
  rpgBuildBonusMenu();
}

function rpgUpdateBonusCount(){
  var used=Object.keys(rpgBonusUsed).filter(function(k){return rpgBonusUsed[k];}).length;
  var remaining=RPG_BONUS_DEFS.length-used;
  var cnt=document.getElementById('rpg-bonus-count');
  if(cnt) cnt.textContent=remaining;
}

function rpgBuildBonusMenu(){
  var list=document.getElementById('rpg-bonus-list');
  if(!list) return;
  list.innerHTML='';
  RPG_BONUS_DEFS.forEach(function(b){
    var used=rpgBonusUsed[b.id];
    var d=document.createElement('div');
    d.className='rpg-bonus-item'+(used?' bonus-used':'');
    d.innerHTML='<span class="rpg-bonus-item-name">'+b.icon+' '+b.name+(used?' — UTILISÉ':'')+'</span>'+
      '<div class="rpg-bonus-item-desc">'+b.desc+'</div>';
    if(!used){
      (function(bonus){
        d.onclick=function(){
          rpgBonusUsed[bonus.id]=true;
          rpgToggleBonusMenu();
          rpgUpdateBonusCount();
          rpgBuildBonusMenu();
          if(bonus.effect) bonus.effect();
        };
      })(b);
    }
    list.appendChild(d);
  });
}

function rpgToggleBonusMenu(){
  var menu=document.getElementById('rpg-bonus-menu');
  if(!menu) return;
  var isOpen=menu.classList.contains('show');
  menu.classList.toggle('show',!isOpen);
}

function rpgShowBonusNarrative(text){
  var nar=document.getElementById('rpg-narrative-text');
  if(!nar) return;
  var old=nar.textContent;
  nar.style.color='#fbbf24';
  nar.style.borderLeftColor='#d97706';
  nar.textContent='💡 '+text;
  setTimeout(function(){
    nar.style.color='';nar.style.borderLeftColor='';
    nar.textContent=old;
  },3500);
}

function rpgShowLexique(sc){
  var existing=document.getElementById('rpg-lexique');
  if(existing){existing.remove();return;}
  var lexiques={
    winrm:{terms:['WinRM: Windows Remote Management — protocole de gestion à distance','TrustedHosts: liste des hôtes autorisés côté client en workgroup','PSRemoting: technologie PowerShell basée sur WinRM','Port 5985: port HTTP par défaut de WinRM']},
    dns:{terms:['SOA: Start Of Authority — enregistrement principal dune zone DNS','Zone primaire: zone faisant autorité, modifiable directement','TTL: Time To Live — durée de vie dun enregistrement en cache','Flush DNS: vider le cache DNS local (ipconfig /flushdns)']},
    vlan:{terms:['SVI: Switch Virtual Interface — interface L3 dun VLAN','ip routing: commande activant le routage sur switch L3','Trunk: port transportant plusieurs VLANs avec tag 802.1Q','VLAN 20: identifiant du réseau virtuel du département RH']},
    ntfs:{terms:['ACL: Access Control List — liste des permissions','Deny: refus explicite — prioritaire sur Allow','Héritage: transmission des permissions du dossier parent','Groupe AD: regroupement dutilisateurs pour simplifier les droits']},
    cisco_ssh:{terms:['RSA: algorithme de chiffrement nécessaire pour SSH','ip domain-name: requis pour nommer les clés RSA','VTY: lignes virtuelles de connexion distante','transport input: définit les protocoles acceptés sur VTY']},
  };
  var lex=lexiques[sc.id];
  if(!lex) return;
  var el=document.createElement('div');
  el.id='rpg-lexique';
  el.style.cssText="position:fixed;bottom:36px;right:12px;background:#1a1208;border:2px solid #d97706;padding:12px 16px;font-family:monospace;font-size:10px;color:#c8bc9a;z-index:910;max-width:280px;line-height:1.8;box-shadow:0 4px 16px rgba(0,0,0,.4)";
  el.innerHTML='<div style="color:#d97706;font-size:9px;letter-spacing:2px;margin-bottom:8px;border-bottom:1px dashed #6a5a3a;padding-bottom:6px;">📖 LEXIQUE</div>'+
    lex.terms.map(function(t){return '<div style="margin-bottom:4px;">▸ '+t+'</div>';}).join('')+
    '<div style="margin-top:8px;text-align:right;"><button onclick="var l=document.getElementById(\'rpg-lexique\');if(l)l.remove();" style="background:none;border:1px solid #6a5a3a;color:#8a7a5a;font-size:9px;padding:3px 8px;cursor:pointer;font-family:inherit;">FERMER</button></div>';
  document.body.appendChild(el);
}

// =====================================================
// RPG INTRO + LAUNCHERS
// =====================================================
var rpgIntroTickets = 5;

function launchRPGDirect(){
  playModeStart();
  // Thème Paper pour RPG — appliquer sur le body directement sans passer par applyUI complet
  document.body.classList.remove('ui-arcade','ui-terminal','ui-minimal');
  document.body.classList.add('ui-paper','rpg-mode');
  // Mettre à jour les boutons switcher si présents
  document.querySelectorAll('.ui-sw-btn').forEach(function(b){
    b.classList.toggle('sel', b.getAttribute('data-ui')==='ui-paper');
  });
  showScreen('rpg-intro');
}

function launchFlashDirect(){
  selCat='mix';selMode='flash';
  var pool=[];
  Object.keys(CATS).forEach(function(k){
    if(CATS[k]&&CATS[k].qs) CATS[k].qs.forEach(function(q){pool.push(q);});
  });
  session=freshShuffle(pool).slice(0,30);
  startFlash();
}

function rpgSetTickets(n){
  rpgIntroTickets=n;
  if(rpgN) rpgN.ticketsPerSession=n;
  var el2=document.getElementById('rpg-intro-tickets');
  if(el2) el2.textContent=n;
  document.querySelectorAll('.rpg-intro-n-btn').forEach(function(b){
    var isSelected=parseInt(b.getAttribute('data-n'))===n;
    b.classList.toggle('sel',isSelected);
    if(isSelected){b.style.background='#8b1a1a';b.style.color='#fef3c7';b.style.borderColor='#1a1208';}
    else{b.style.background='#d4c9a8';b.style.color='#1a1208';b.style.borderColor='#8a7a5a';}
  });
}

function rpgStartFromIntro(){
  rpgN.ticketsPerSession=rpgIntroTickets||5;
  startRPGNarrative();
}

// =====================================================
// SYSTÈME DE BONUS RPG
// =====================================================
var RPG_BONUSES = [
  {
    id:'technicien',
    icon:'📞',
    name:'Appeler un technicien senior',
    desc:'Il élimine la moitié des mauvaises réponses de la prochaine question.',
    used:false,
    narrative:'Tu décroches ton téléphone. "Salut Marc, t as une minute ?" Il regarde rapidement et te dit ce qui est clairement faux.',
    effect:function(){rpgBonusHalfElim();}
  },
  {
    id:'lexique',
    icon:'📖',
    name:'Consulter le lexique',
    desc:'Tous les termes techniques de la page sont définis en bas de l écran.',
    used:false,
    narrative:'Tu ouvres ton classeur de notes. Les définitions des termes clés apparaissent.',
    effect:function(){rpgBonusLexique();}
  },
  {
    id:'log',
    icon:'🔍',
    name:'Consulter les logs système',
    desc:'Une piste supplémentaire apparaît dans le ticket.',
    used:false,
    narrative:'Tu consultes les journaux d événements. Une ligne attire ton attention...',
    effect:function(){rpgBonusLog();}
  },
  {
    id:'doc',
    icon:'📋',
    name:'Consulter la documentation',
    desc:'La bonne réponse est mise en surbrillance parmi les options.',
    used:false,
    narrative:'Tu ouvres la doc Microsoft. La commande correcte est là, en noir sur blanc.',
    effect:function(){rpgBonusDoc();}
  },
];

var rpgBonusPool = []; // bonus disponibles pour la session
var rpgBonusMenuOpen = false;

function rpgInitBonuses(){
  // 1 bonus automatique + possibilité d'en gagner d'autres
  rpgBonusPool = RPG_BONUSES.map(function(b){return Object.assign({},b,{used:false});});
  // Sélectionner 2 bonus aléatoires pour la session
  rpgBonusPool = shuffle(rpgBonusPool).slice(0,2);
  rpgRenderBonusSlot();
}

function rpgRenderBonusSlot(){
  var slot=document.getElementById('rpg-bonus-slot');
  var token=document.getElementById('rpg-bonus-token');
  if(!slot||!token) return;
  var avail=rpgBonusPool.filter(function(b){return !b.used;});
  if(avail.length>0){
    slot.className='rpg-bonus-slot show';
    token.textContent=avail[0].icon;
    token.className='rpg-bonus-token'+(avail[0].used?' used':'');
  } else {
    slot.className='rpg-bonus-slot';
  }
}

function toggleBonusMenu(){
  rpgBonusMenuOpen=!rpgBonusMenuOpen;
  var menu=document.getElementById('rpg-bonus-menu');
  if(!menu) return;
  if(rpgBonusMenuOpen){
    menu.className='rpg-bonus-menu show';
    rpgRenderBonusMenu();
  } else {
    menu.className='rpg-bonus-menu';
  }
}

function rpgRenderBonusMenu(){
  var list=document.getElementById('rpg-bonus-list');
  if(!list) return;
  list.innerHTML='';
  rpgBonusPool.forEach(function(b){
    var d=document.createElement('div');
    d.className='rpg-bonus-item'+(b.used?' used':'');
    d.innerHTML='<span class="rpg-bonus-item-name">'+b.icon+' '+b.name+(b.used?' — UTILISÉ':'')+'</span>'+
      '<span class="rpg-bonus-item-desc">'+b.desc+'</span>';
    if(!b.used){
      (function(bonus){
        d.onclick=function(){
          bonus.used=true;
          toggleBonusMenu();
          rpgRenderBonusSlot();
          // Afficher narrative du bonus
          var narEl=document.getElementById('rpg-narrative-text');
          if(narEl){narEl.textContent=bonus.narrative;narEl.style.color='#d97706';}
          setTimeout(function(){
            if(narEl){narEl.style.color='';} 
            bonus.effect();
          },1500);
        };
      })(b);
    }
    list.appendChild(d);
  });
}

// Effets des bonus
function rpgBonusHalfElim(){
  var opts=Array.from(document.querySelectorAll('.rpg-inline-opt:not(:disabled)'));
  if(opts.length<2) return;
  // Griser la moitié des options (aléatoirement, sauf la bonne)
  var correct=opts.filter(function(o){return o.classList.contains('ok');});
  var others=opts.filter(function(o){return !o.classList.contains('ok');});
  var toElim=shuffle(others).slice(0,Math.floor(others.length/2));
  toElim.forEach(function(o){o.style.opacity='.2';o.style.pointerEvents='none';o.disabled=true;});
}

function rpgBonusLexique(){
  // Ouvrir la page lexique complète
  var lex=document.getElementById('rpg-lexique-full');
  if(!lex) return;
  lex.classList.toggle('show');
  // Mettre en avant les mots présents dans le ticket actif
  var sc=rpgN.currentTicket;
  var activeWords=sc?sc.id:'';
  rpgRenderLexiqueFull(activeWords);
}

var LEXIQUE_COMPLET={
  // Windows / Réseau
  'WinRM':'Windows Remote Management. Protocole Microsoft permettant lexécution de commandes PowerShell à distance via le port 5985 (HTTP) ou 5986 (HTTPS).',
  'PSRemoting':'PowerShell Remoting. Ensemble de fonctionnalités basées sur WinRM permettant lexécution de scripts sur des machines distantes avec Enable-PSRemoting.',
  'TrustedHosts':'Liste blanche configurée côté client WinRM. En workgroup (sans domaine AD), il faut y déclarer explicitement les serveurs distants : Set-Item WSMan:\\localhost\\Client\\TrustedHosts.',
  'RSAT':'Remote Server Administration Tools. Outils dadministration Windows installables sur un poste client pour gérer des serveurs distants (AD, DNS, DHCP, etc.) sans console directe.',
  'WMI':'Windows Management Instrumentation. Infrastructure de gestion Windows permettant daccéder aux informations système et de les modifier via scripts.',
  // DNS
  'DNS':'Domain Name System. Système qui traduit les noms de domaine (ex: server.local) en adresses IP. Port 53 UDP/TCP.',
  'SOA':'Start Of Authority. Enregistrement DNS obligatoire dans chaque zone. Contient: serveur primaire, email admin, numéro de série (incrémenté à chaque modification), TTL, délais refresh/retry/expire.',
  'TTL':'Time To Live. Durée en secondes pendant laquelle un enregistrement DNS peut être mis en cache avant dêtre re-interrogé.',
  'Forwarder':'Serveur DNS externe vers lequel les requêtes non résolues localement sont transmises (ex: 8.8.8.8 pour résoudre les noms publics).',
  'Zone primaire':'Zone DNS modifiable, source faisant autorité. Les modifications se font ici puis se répliquent sur les zones secondaires.',
  'Zone secondaire':'Copie en lecture seule dune zone primaire, récupérée par transfert de zone. Sert de redondance.',
  // VLAN / Switch
  'VLAN':'Virtual Local Area Network. Segmentation logique dun réseau physique. Les machines dun VLAN ne communiquent pas directement avec celles dun autre VLAN sans routeur ou switch L3.',
  'SVI':'Switched Virtual Interface. Interface virtuelle sur un switch L3 représentant un VLAN. Elle a une adresse IP et permet le routage inter-VLAN. Commande: interface vlan [ID].',
  'Trunk':'Port switch transportant plusieurs VLANs simultanément via des tags 802.1Q. Utilisé pour les liaisons switch-switch ou switch-routeur.',
  '802.1Q':'Standard IEEE de trunking VLAN. Ajoute un tag de 4 octets dans la trame Ethernet pour identifier le VLAN dorigine.',
  'VLAN natif':'VLAN dont les trames passent sur un trunk sans tag. VLAN 1 par défaut sur Cisco. Doit être le même des deux côtés du trunk.',
  'ip routing':'Commande Cisco activant le moteur de routage IP sur un switch L3. Sans elle, les SVIs existent mais le switch ne route pas entre VLANs.',
  'Access port':'Port switch configuré pour un seul VLAN. Les trames ny sont pas taguées. Utilisé pour connecter des postes ou serveurs.',
  // STP
  'STP':'Spanning Tree Protocol (IEEE 802.1D). Prévient les boucles réseau en plaçant certains ports en état Blocking. Convergence lente (~50s).',
  'RSTP':'Rapid STP (802.1w). Version améliorée de STP avec convergence rapide (~1-2s). Compatibilité ascendante avec STP classique.',
  'Root Bridge':'Switch élu comme racine de larbre STP. Tous les autres switches calculent leurs chemins depuis lui. Élu par la priorité la plus basse (défaut: 32768).',
  'PortFast':'Optimisation STP Cisco. Passe immédiatement un port en état Forwarding sans passer par Listening/Learning. À utiliser UNIQUEMENT sur les ports dextrémité (PC, serveurs).',
  'BPDU Guard':'Sécurité STP. Désactive (err-disabled) un port si une BPDU est reçue. Protège contre la connexion dun switch non autorisé sur un port access.',
  'BPDU':'Bridge Protocol Data Unit. Trame échangée entre switches pour construire larbre STP. Contient: adresse MAC, priorité, coût de chemin, timers.',
  'Broadcast storm':'Tempête de diffusion causée par une boucle réseau. Les trames broadcast se répliquent indéfiniment, saturant le réseau.',
  // DHCP
  'DHCP':'Dynamic Host Configuration Protocol. Attribue automatiquement des adresses IP, masque, passerelle et DNS. Port 67 (serveur) / 68 (client). Processus: DORA (Discover, Offer, Request, Acknowledge).',
  'Scope DHCP':'Plage dadresses IP que le serveur DHCP peut distribuer (ex: 192.168.1.100-200). Peut inclure des exclusions et réservations.',
  'Bail DHCP':'Durée pendant laquelle une adresse IP est attribuée à un client. Après expiration, le client doit la renouveler.',
  'Relay agent':'Service ou équipement (souvent un routeur) qui relaie les requêtes DHCP entre des sous-réseaux différents. Commande Cisco: ip helper-address.',
  '169.254.x.x':'Adresse APIPA (Automatic Private IP Addressing). Attribuée automatiquement quand le client DHCP ne trouve pas de serveur. Indique un problème DHCP.',
  // Hyper-V
  'VHDX':'Format de disque virtuel Hyper-V (successeur de VHD). Supporte jusquà 64 To, résilient aux coupures, avec journal décriture.',
  'Snapshot':'Point de restauration dune VM (aussi appelé Checkpoint dans Hyper-V). Crée un fichier .avhdx différentiel. Ne remplace pas une sauvegarde complète.',
  'Commutateur virtuel':'Switch logiciel Hyper-V gérant la connectivité réseau des VMs. Types: External (accès au réseau physique), Internal (host+VMs), Private (VMs uniquement).',
  'Génération VM':'Hyper-V propose 2 générations. Gen 1: BIOS, compatibilité maximale. Gen 2: UEFI, Secure Boot, meilleures performances. Choix fait à la création, non modifiable.',
  // NTFS / Permissions
  'NTFS':'New Technology File System. Système de fichiers Windows avec gestion fine des permissions (ACL), journalisation, chiffrement (EFS), compression.',
  'ACL':'Access Control List. Liste des entrées de contrôle daccès (ACE) définissant qui peut faire quoi sur un objet (fichier, dossier, clé de registre).',
  'ACE':'Access Control Entry. Entrée individuelle dans une ACL définissant: utilisateur/groupe, permissions, Allow ou Deny.',
  'Héritage NTFS':'Mécanisme par lequel les sous-dossiers reçoivent automatiquement les permissions du dossier parent. Peut être coupé manuellement.',
  'Deny explicite':'Refus explicite daccès NTFS. Prioritaire sur tous les Allow, quelle que soit leur source (directe ou héritée).',
  'SMB':'Server Message Block. Protocole de partage de fichiers Windows. SMB3 (Windows 8/2012+) apporte le chiffrement et la compression.',
  // Cisco IOS / SSH
  'RSA':'Algorithme de chiffrement asymétrique. Utilisé par SSH pour lauthentification. Sur Cisco: crypto key generate rsa modulus 2048.',
  'SSH':'Secure Shell. Protocole de connexion distante sécurisé (port 22). Remplace Telnet. Nécessite: hostname + domain-name + clés RSA + ip ssh version 2.',
  'Telnet':'Protocole de connexion distante non chiffré (port 23). À éviter en production — remplacé par SSH.',
  'VTY':'Virtual TeletYpe. Lignes virtuelles sur un équipement Cisco permettant les connexions SSH/Telnet. Configuration: line vty 0 4.',
  'ip domain-name':'Commande Cisco définissant le nom de domaine DNS de léquipement. Requis avant la génération des clés RSA pour SSH.',
  'ACL étendue':'Access Control List Cisco filtrant le trafic sur critères source/destination IP et ports. Placée au plus près de la source.',
  // PowerShell
  'Cmdlet':'Commande PowerShell suivant la convention Verbe-Nom (ex: Get-Service, Set-ADUser). Chaque cmdlet fait une chose précise.',
  'Pipeline':'Mécanisme PowerShell transmettant les objets dune cmdlet à la suivante via le symbole |. Ex: Get-Service | Where-Object {$_.Status -eq "Running"}',
  'WMI/CIM':'Windows Management Instrumentation / Common Information Model. APIs PowerShell pour accéder aux informations système. Get-WmiObject (legacy) ou Get-CimInstance (moderne).',
};

function rpgRenderLexiqueFull(scId){
  var content=document.getElementById('rpg-lex-content');
  if(!content) return;
  
  // Mots liés au scénario actif — mis en avant
  var scWords={
    winrm:['WinRM','PSRemoting','TrustedHosts','RSAT'],
    dns:['DNS','SOA','TTL','Zone primaire','Forwarder'],
    vlan:['VLAN','SVI','Trunk','802.1Q','ip routing','VLAN natif'],
    stp:['STP','RSTP','Root Bridge','PortFast','BPDU Guard','BPDU','Broadcast storm'],
    dhcp:['DHCP','Scope DHCP','Bail DHCP','Relay agent','169.254.x.x'],
    hyperv:['VHDX','Snapshot','Commutateur virtuel','Génération VM'],
    ntfs:['NTFS','ACL','ACE','Héritage NTFS','Deny explicite','SMB'],
    cisco_ssh:['RSA','SSH','Telnet','VTY','ip domain-name','ACL étendue'],
  };
  var highlight=scId&&scWords[scId]?scWords[scId]:[];
  
  // Groupes
  var groups=[
    {label:'Windows & Administration',keys:['WinRM','PSRemoting','TrustedHosts','RSAT','WMI']},
    {label:'DNS',keys:['DNS','SOA','TTL','Zone primaire','Zone secondaire','Forwarder']},
    {label:'VLAN & Switching',keys:['VLAN','SVI','Trunk','802.1Q','VLAN natif','ip routing','Access port']},
    {label:'STP',keys:['STP','RSTP','Root Bridge','PortFast','BPDU Guard','BPDU','Broadcast storm']},
    {label:'DHCP',keys:['DHCP','Scope DHCP','Bail DHCP','Relay agent','169.254.x.x']},
    {label:'Hyper-V',keys:['VHDX','Snapshot','Commutateur virtuel','Génération VM']},
    {label:'NTFS & Permissions',keys:['NTFS','ACL','ACE','Héritage NTFS','Deny explicite','SMB']},
    {label:'Cisco IOS & SSH',keys:['RSA','SSH','Telnet','VTY','ip domain-name','ACL étendue']},
    {label:'PowerShell',keys:['Cmdlet','Pipeline','WMI/CIM']},
  ];
  
  content.innerHTML='';
  groups.forEach(function(g){
    var section=document.createElement('div');
    section.style.cssText='margin-bottom:14px;';
    var lbl=document.createElement('div');
    lbl.style.cssText='font-size:8px;letter-spacing:3px;color:#d97706;text-transform:uppercase;padding:4px 0;border-bottom:1px solid #6a5a3a;margin-bottom:6px;';
    lbl.textContent=g.label;
    section.appendChild(lbl);
    g.keys.forEach(function(k){
      if(!LEXIQUE_COMPLET[k]) return;
      var entry=document.createElement('div');
      var isHighlight=highlight.indexOf(k)>-1;
      entry.style.cssText='margin-bottom:8px;padding:6px 8px;'+(isHighlight?'background:#2a2010;border-left:2px solid #d97706;':'');
      entry.innerHTML='<div style="font-size:11px;color:'+(isHighlight?'#fbbf24':'#fef3c7')+';font-weight:bold;margin-bottom:3px;">'+k+'</div>'+
        '<div style="font-size:10px;color:#c8bc9a;line-height:1.6;">'+LEXIQUE_COMPLET[k]+'</div>';
      section.appendChild(entry);
    });
    content.appendChild(section);
  });
}

function rpgBonusDoc(){
  // Ajouter un indice discret sur la bonne réponse (fond légèrement différent)
  // On ne peut pas savoir laquelle est correcte sans le qid — on ajoute juste un toast
  var narEl=document.getElementById('rpg-narrative-text');
  if(narEl){
    narEl.textContent='📋 Documentation consultée. Cherche la réponse la plus précise et complète.';
    narEl.style.color='#d97706';
    setTimeout(function(){if(narEl){narEl.style.color='';narEl.textContent='Indice : lis bien chaque option avant de répondre.';}},4000);
  }
}

// =====================================================
// SONS UI (Web Audio — petits bruitages)
// =====================================================
var _uiAC = null;
function getUiAC(){
  if(!_uiAC) _uiAC=new(window.AudioContext||window.webkitAudioContext)();
  return _uiAC;
}

// Variation aléatoire des sons pour éviter la répétition
var _clickPool = [
  {type:'square', f1:800, f2:400, g:0.07},
  {type:'square', f1:880, f2:440, g:0.07},
  {type:'triangle', f1:720, f2:360, g:0.08},
  {type:'sine', f1:700, f2:500, g:0.06},
  {type:'square', f1:920, f2:520, g:0.06},
  {type:'triangle', f1:640, f2:420, g:0.07}
];
var _clickIdx = 0;
function playClick(){
  if(!soundOn) return;
  try{
    var ac=getUiAC();
    // Rotation + petite variation aléatoire de pitch (±6%)
    _clickIdx = (_clickIdx + 1 + Math.floor(Math.random()*2)) % _clickPool.length;
    var c = _clickPool[_clickIdx];
    var jitter = 0.94 + Math.random()*0.12;
    var o=ac.createOscillator();
    var g=ac.createGain();
    o.connect(g);g.connect(ac.destination);
    o.type=c.type;
    o.frequency.setValueAtTime(c.f1*jitter,ac.currentTime);
    o.frequency.exponentialRampToValueAtTime(c.f2*jitter,ac.currentTime+0.04);
    g.gain.setValueAtTime(c.g,ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.06);
    o.start();o.stop(ac.currentTime+0.07);
  }catch(e){}
}

var _softPool = [
  {type:'sine', f:600, g:0.05},
  {type:'sine', f:520, g:0.05},
  {type:'triangle', f:680, g:0.045},
  {type:'sine', f:560, g:0.05}
];
var _softIdx = 0;
function playClickSoft(){
  if(!soundOn) return;
  try{
    var ac=getUiAC();
    _softIdx = (_softIdx + 1 + Math.floor(Math.random()*2)) % _softPool.length;
    var c = _softPool[_softIdx];
    var jitter = 0.95 + Math.random()*0.1;
    var o=ac.createOscillator();
    var g=ac.createGain();
    o.connect(g);g.connect(ac.destination);
    o.type=c.type;
    o.frequency.setValueAtTime(c.f*jitter,ac.currentTime);
    g.gain.setValueAtTime(c.g,ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.08);
    o.start();o.stop(ac.currentTime+0.09);
  }catch(e){}
}

// Hover subtil (peu fréquent, très discret)
function playHover(){
  if(!soundOn) return;
  try{
    var ac=getUiAC();
    var o=ac.createOscillator();
    var g=ac.createGain();
    o.connect(g);g.connect(ac.destination);
    o.type='sine';
    var f = 900 + Math.random()*200;
    o.frequency.value=f;
    g.gain.setValueAtTime(0.015,ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.05);
    o.start();o.stop(ac.currentTime+0.06);
  }catch(e){}
}
window.playClick = playClick;
window.playClickSoft = playClickSoft;
window.playHover = playHover;

function playThemeChange(){
  if(!soundOn) return;
  try{
    var ac=getUiAC();
    var freqs=[440,550,660];
    freqs.forEach(function(f,i){
      var o=ac.createOscillator();
      var g=ac.createGain();
      o.connect(g);g.connect(ac.destination);
      o.type='sine';
      o.frequency.value=f;
      g.gain.setValueAtTime(0,ac.currentTime+i*0.08);
      g.gain.linearRampToValueAtTime(0.07,ac.currentTime+i*0.08+0.04);
      g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+i*0.08+0.15);
      o.start(ac.currentTime+i*0.08);
      o.stop(ac.currentTime+i*0.08+0.16);
    });
  }catch(e){}
}

function playModeStart(){
  if(!soundOn) return;
  try{
    var ac=getUiAC();
    [[330,0],[440,0.1],[550,0.2],[660,0.3]].forEach(function(pair){
      var o=ac.createOscillator();
      var g=ac.createGain();
      o.connect(g);g.connect(ac.destination);
      o.type='triangle';
      o.frequency.value=pair[0];
      g.gain.setValueAtTime(0,ac.currentTime+pair[1]);
      g.gain.linearRampToValueAtTime(0.08,ac.currentTime+pair[1]+0.05);
      g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+pair[1]+0.2);
      o.start(ac.currentTime+pair[1]);
      o.stop(ac.currentTime+pair[1]+0.21);
    });
  }catch(e){}
}

function playConfUp(){
  if(!soundOn) return;
  try{
    var ac=getUiAC();
    var o=ac.createOscillator();var g=ac.createGain();
    o.connect(g);g.connect(ac.destination);
    o.type='sine';
    o.frequency.setValueAtTime(440,ac.currentTime);
    o.frequency.linearRampToValueAtTime(660,ac.currentTime+0.15);
    g.gain.setValueAtTime(0.1,ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.2);
    o.start();o.stop(ac.currentTime+0.21);
  }catch(e){}
}

function playConfDown(){
  if(!soundOn) return;
  try{
    var ac=getUiAC();
    var o=ac.createOscillator();var g=ac.createGain();
    o.connect(g);g.connect(ac.destination);
    o.type='sawtooth';
    o.frequency.setValueAtTime(300,ac.currentTime);
    o.frequency.linearRampToValueAtTime(150,ac.currentTime+0.2);
    g.gain.setValueAtTime(0.08,ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.25);
    o.start();o.stop(ac.currentTime+0.26);
  }catch(e){}
}

// SIDE MENU
// =====================================================
function pickVTMenu(e){
  playThemeChange();
  document.querySelectorAll('.vtbtn').forEach(function(b){b.classList.remove('sel');});
  e.classList.add('sel');
  vTheme=e.getAttribute('data-vt');
  lsSet('tssr5_vt',vTheme);
  applyBody();
  // Also sync sheet
  document.querySelectorAll('.sheet-vtbtn').forEach(function(b){b.classList.toggle('sel',b.getAttribute('data-vt')===vTheme);});
}

function openSideMenu(){
  var panel=document.getElementById('side-panel');
  var ovl=document.getElementById('side-ovl');
  if(!panel||!ovl) return;
  var ctx=document.getElementById('side-context');
  var screen=document.querySelector('.screen.active');
  if(screen){
    var sid=screen.id;
    if(sid==='screen-game'){
      if(ctx) ctx.textContent=(CATS[selCat]?CATS[selCat].label:selCat)+' · '+selMode.toUpperCase()+' · Q'+(idx+1)+'/'+session.length;
      var sbRes=document.getElementById('sb-resume'); if(sbRes) sbRes.style.display='flex';
      var sbJok=document.getElementById('sb-joker'); if(sbJok) sbJok.style.display=jokersEnabled?'flex':'none';
      var sbJlbl=document.getElementById('sb-joker-lbl'); if(sbJlbl) sbJlbl.textContent='JOKER ('+jokers+' restants)';
      if(!paused&&selMode!=='exam'&&selMode!=='blitz') togglePause();
    } else if(sid==='screen-flash'){
      if(ctx) ctx.textContent='Flashcards';
      var sbRes2=document.getElementById('sb-resume'); if(sbRes2) sbRes2.style.display='flex';
      var sbJok2=document.getElementById('sb-joker'); if(sbJok2) sbJok2.style.display='none';
    } else {
      if(ctx) ctx.textContent='';
      var sbRes3=document.getElementById('sb-resume'); if(sbRes3) sbRes3.style.display='none';
      var sbJok3=document.getElementById('sb-joker'); if(sbJok3) sbJok3.style.display='none';
    }
  }
  panel.classList.add('open');
  ovl.classList.add('open');
}

function closeSideMenu(){
  var p=document.getElementById('side-panel'); if(p) p.classList.remove('open');
  var o=document.getElementById('side-ovl'); if(o) o.classList.remove('open');
}

// =====================================================
// DUEL — startDuel (alias de launchDuel pour compatibilité)
// =====================================================
function startDuel(){
  showScreen('duel-setup');
}

// KEYBOARD
document.addEventListener('keydown',function(e){
  if(paused) return;
  // Ne pas intercepter si l'input type est actif
  if(document.activeElement&&document.activeElement.id==='type-input') return;
  var q=session[idx];if(!q) return;
  if(q.t==='qcm'||q.t==='debug'){
    var map={A:0,B:1,C:2,D:3};var k=e.key.toUpperCase();
    if(map[k]!==undefined){var btns=document.querySelectorAll('.opt:not(:disabled):not(.elim)');if(btns[map[k]])btns[map[k]].click();}
  }
  if(q.t==='tf'){
    if(e.key==='ArrowLeft'){var bv=document.querySelector('.tf-true:not(:disabled)');if(bv)bv.click();}
    if(e.key==='ArrowRight'){var bf=document.querySelector('.tf-false:not(:disabled)');if(bf)bf.click();}
  }
  if((e.key==='Enter'||e.key===' ')&&el('nextbtn')&&el('nextbtn').classList.contains('show')){e.preventDefault();next();}
  if(e.key==='Escape'){
    if(document.getElementById('side-panel')&&document.getElementById('side-panel').classList.contains('open')){closeSideMenu&&closeSideMenu();return;}
    if(document.getElementById('launch-ovl')&&document.getElementById('launch-ovl').classList.contains('open')){document.getElementById('launch-ovl').classList.remove('open');return;}
    if(el('screen-game')&&el('screen-game').classList.contains('active')&&selMode!=='blitz')togglePause();
  }
  if(e.key.toLowerCase()==='j'&&!answered)useJoker();
  if(selMode==='duel') duelKeydown(e);
  // Discussion mode keyboard
  if(document.getElementById('screen-discussion')&&document.getElementById('screen-discussion').classList.contains('active')){
    if(e.key===' '||e.key==='Enter'){e.preventDefault();if(typeof discRevealed!=='undefined'&&!discRevealed)discReveal();}
    if(e.key==='ArrowRight'&&typeof discRevealed!=='undefined'&&discRevealed){discNext&&discNext();}
    if(e.key==='1'&&typeof discRevealed!=='undefined'&&discRevealed){discScore&&discScore(1);}
    if(e.key==='0'&&typeof discRevealed!=='undefined'&&discRevealed){discScore&&discScore(0);}
  }
  // Flashcard keyboard
  if(document.getElementById('screen-flash')&&document.getElementById('screen-flash').classList.contains('active')){
    if(e.key===' '||e.key==='Enter'){e.preventDefault();if(typeof flashFlipped!=='undefined'&&!flashFlipped)flipCard();else rateFlash&&rateFlash(2);}
    if(e.key==='1') rateFlash&&rateFlash(0);
    if(e.key==='2') rateFlash&&rateFlash(1);
    if(e.key==='3') rateFlash&&rateFlash(2);
  }
});

if(el('nextbtn')) el('nextbtn').addEventListener('click',next);



// ── Menu principal (hamburger) ──
function openMainMenu(){
  var o=document.getElementById('main-menu-ovl');
  var p=document.getElementById('main-menu-panel');
  if(o) o.classList.add('open');
  if(p) p.classList.add('open');
}
function closeMainMenu(){
  var o=document.getElementById('main-menu-ovl');
  var p=document.getElementById('main-menu-panel');
  if(o) o.classList.remove('open');
  if(p) p.classList.remove('open');
}

// ── Mise à jour avatar/username dans topbar ──
function updateMenuTopbar(){
  var user=window._fbUser;
  var avatarEl=document.getElementById('menu-avatar-top');
  var nameEl=document.getElementById('menu-username-top');
  var mmLogin=document.getElementById('mm-login-btn');
  var mmLogout=document.getElementById('mm-logout-btn');
  var mmUser=document.getElementById('mm-user-info');
  var profile={}; try{profile=JSON.parse(localStorage.getItem('tssr5_profile')||'{}');}catch(e){}
  if(user){
    if(avatarEl) avatarEl.textContent=profile.avatar||'👤';
    if(nameEl) nameEl.textContent=profile.name||user.displayName||user.email.split('@')[0]||'';
    if(mmLogin) mmLogin.style.display='none';
    if(mmLogout) mmLogout.style.display='block';
    if(mmUser) mmUser.textContent=user.email||'';
  } else {
    if(avatarEl) avatarEl.textContent=profile.avatar||'👤';
    if(nameEl) nameEl.textContent=profile.name||'';
    if(mmLogin) mmLogin.style.display='block';
    if(mmLogout) mmLogout.style.display='none';
    if(mmUser) mmUser.textContent='';
  }
}

// ── Promo ──

// INIT
// Les préférences sont chargées ici, mais l'affichage de l'écran
// est géré par Firebase onAuthStateChanged ou fbContinueWithoutAccount.
(function(){
  function doInit(){
    vTheme=lsGet('tssr5_vt','vt-light');
    soundOn=lsGet('tssr5_sound',true);
    jokersEnabled=lsGet('tssr5_jokers',true);
    selQCount=lsGet('tssr5_qcount',10);
    applyBody(); // applique le thème sans afficher de screen
    // NE PAS appeler initMenu() ici — c'est Firebase qui décide quoi afficher
  }
  if(document.readyState==='loading'){
    window.addEventListener('DOMContentLoaded',doInit);
  } else {
    doInit();
  }
})();

// =====================================================
// SONS GLOBAUX — clicks variés sur tous les boutons
// =====================================================
(function attachGlobalClickSounds(){
  function isClickable(el){
    if(!el) return false;
    var tag = (el.tagName||'').toLowerCase();
    if(tag==='button' || tag==='a') return true;
    if(el.getAttribute && (el.getAttribute('role')==='button' || el.hasAttribute('onclick'))) return true;
    if(el.classList && (el.classList.contains('ccard') || el.classList.contains('mcard') ||
       el.classList.contains('sheet-cat') || el.classList.contains('sheet-mode') ||
       el.classList.contains('sheet-pill') || el.classList.contains('opt') ||
       el.classList.contains('menu-action-card') || el.classList.contains('hero-card') ||
       el.classList.contains('settings-da-btn') || el.classList.contains('settings-theme-btn') ||
       el.classList.contains('daily-card-btn') || el.classList.contains('main-menu-btn'))) return true;
    return false;
  }
  function findClickable(el){
    for(var i=0;i<5 && el;i++){
      if(isClickable(el)) return el;
      el = el.parentElement;
    }
    return null;
  }
  document.addEventListener('click', function(e){
    var t = findClickable(e.target);
    if(!t) return;
    if(t.disabled) return;
    // Différents types de sons selon le rôle
    if(t.classList.contains('opt')){ return; } // le son opt est déjà géré par answer handler
    if(t.classList.contains('sheet-launch-btn') || t.classList.contains('start-btn-main')){
      if(window.playModeStart) window.playModeStart(); else if(window.playClick) window.playClick();
      return;
    }
    if(t.classList.contains('hero-card') || t.classList.contains('menu-action-card') ||
       t.classList.contains('sheet-cat') || t.classList.contains('sheet-mode') ||
       t.classList.contains('settings-da-btn') || t.classList.contains('daily-card-btn')){
      if(window.playClickSoft) window.playClickSoft();
      return;
    }
    if(window.playClick) window.playClick();
  }, true);

  // Hover très discret
  var lastHover = 0;
  document.addEventListener('pointerover', function(e){
    var t = findClickable(e.target);
    if(!t) return;
    var now = Date.now();
    if(now - lastHover < 80) return;  // throttle
    lastHover = now;
    if(Math.random() < 0.35 && window.playHover) window.playHover();
  }, true);
})();


// --- Question Feedback Functions ---
function getQId(q) {
  if (!q || !q.q) return 'unknown';
  var str = q.q;
  var hash = 0;
  for (var i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return 'q_' + Math.abs(hash);
}

window.reportBug = async function(q) {
  if (!window._fbUser) { showToast('Connecte-toi pour signaler un bug', 'err'); return; }
  var reason = prompt("Quel est le problème avec cette question ? (Optionnel)");
  if (reason === null) return;
  
  try {
    var qid = getQId(q);
    var report = {
      qid: qid,
      qText: q.q,
      reason: reason || 'Non précisé',
      uid: window._fbUser.uid,
      pseudo: (lsGet('tssr5_profile',{}).pseudo) || window._fbUser.email,
      ts: window._fbServerTs ? window._fbServerTs() : new Date().toISOString()
    };
    await window._fbSetDoc(window._fbDoc(window._fbDb, 'reports', qid + '_' + Date.now()), report);
    showToast('Signalement envoyé ! Merci 🙏', 'ok');
  } catch (e) {
    console.error(e);
    showToast('Erreur lors du signalement', 'err');
  }
};

window.voteQ = async function(q, val) {
  if (!window._fbUser) { showToast('Connecte-toi pour voter', 'err'); return; }
  try {
    var qid = getQId(q);
    var docRef = window._fbDoc(window._fbDb, 'question_stats', qid);
    var snap = await window._fbGetDoc(docRef);
    var data = snap.exists() ? snap.data() : { up: 0, down: 0 };
    
    if (val > 0) data.up = (data.up || 0) + 1;
    else data.down = (data.down || 0) + 1;
    
    await window._fbSetDoc(docRef, data, { merge: true });
    showToast('Merci pour ton vote !', 'ok');
  } catch (e) {
    console.error(e);
    showToast('Erreur lors du vote', 'err');
  }
};

function showToast(msg, type) {
  var t = document.createElement('div');
  t.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);padding:12px 20px;border-radius:30px;background:var(--panel);border:1px solid var(--border2);color:var(--text);font-size:10px;font-family:monospace;z-index:9999;box-shadow:0 10px 30px rgba(0,0,0,0.5);animation:toastIn 0.3s forwards;';
  if (type === 'err') t.style.borderColor = '#ef4444';
  if (type === 'ok') t.style.borderColor = '#22c55e';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(function() {
    t.style.animation = 'toastOut 0.3s forwards';
    setTimeout(function() { t.remove(); }, 300);
  }, 3000);
}


window.hostSkipOnlineQuestion = async function(){
  if(onlineSession.role !== 'host') return;
  if(!confirm("Passer cette question ? (Personne ne marquera de points)")) return;
  try {
    var docRef = window._fbDoc(window._fbDb, 'duels', onlineSession.code);
    var snap = await window._fbGetDoc(docRef);
    if(!snap.exists()) return;
    var dataAtSkip = snap.data();
    await _onlineUpdate({ reveal: true });
    setTimeout(async function(){
      try {
        var freshSnap = await window._fbGetDoc(docRef);
        hostAdvance(freshSnap.exists() ? freshSnap.data() : dataAtSkip);
      } catch(e){ hostAdvance(dataAtSkip); }
    }, 1500);
    showToast("Question passée par l'hôte");
  } catch(e){ console.error("Skip error", e); }
};

window.viewBugReports = async function(){
  if(!window._fbDb) return;
  try {
    showToast("Chargement des rapports...");
    var colRef = window._fbCollection(window._fbDb, 'reports');
    var q = window._fbQuery(colRef, window._fbOrderBy('timestamp', 'desc'), window._fbLimit(20));
    var snap = await window._fbGetDocs(q);
    if(snap.empty){ alert("Aucun rapport trouvé."); return; }
    var txt = "--- DERNIERS RAPPORTS ---\n\n";
    snap.forEach(function(doc){
      var d = doc.data();
      txt += "[" + new Date(d.timestamp).toLocaleString() + "] " + d.type + "\n";
      txt += "Q: " + d.questionText + "\n";
      txt += "User: " + d.userPseudo + "\n";
      txt += "------------------------\n";
    });
    console.log(txt);
    alert("Les rapports ont été affichés dans la CONSOLE (F12).\n\n" + txt.substring(0, 500) + "...");
  } catch(e){ alert("Erreur : " + e.message); }
};