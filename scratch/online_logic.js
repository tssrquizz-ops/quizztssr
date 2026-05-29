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
  perRoundScores:{}       // map uid -> [score_round1, score_round2,...]
};
var unsubLobby = null;

var ONLINE_MODES={
  rounds:  { label:'🏁 ROUNDS',     desc:'5 questions × 3 rounds. Dernier round caché ! 🔥' },
  course:  { label:'⚡ COURSE',     desc:'Premier à atteindre l\'objectif gagne' },
  qbq:     { label:'🎯 QUESTION/QUESTION', desc:'Plus rapide gagne, attente entre chaque' }
};
var ONLINE_COUNTS=[5,7,10,15];

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
      config:null,
      reveal:false,
      cat:selCat||'mix',
      createdAt:window._fbServerTs?window._fbServerTs():new Date().toISOString()
    });
    var box=document.getElementById('online-code-box');
    var num=document.getElementById('online-code-num');
    if(box) box.style.display='block';
    if(num) num.textContent=code;
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
    if(!alreadyIn && pCount >= 5){
      showOnlineError('Cette session est pleine (5 joueurs max).');return;
    }

    onlineSession.code=code;
    onlineSession.role= (data.host === window._fbUser.uid) ? 'host' : 'guest';
    onlineSession.uid=window._fbUser.uid;

    if(!alreadyIn){
      var upd = {};
      upd['players.'+window._fbUser.uid] = { uid:window._fbUser.uid, pseudo:pseudo, score:0, ready:false, vote:null, answer:null, role:onlineSession.role };
      await window._fbUpdateDoc(docRef, upd);
    }
    
    // Switch to waiting view
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

function loadOpenSessions(){
  if(unsubLobby) unsubLobby();
  if(!window._fbDb || !window._fbCollection) return;
  var listArea = document.getElementById('online-lobby-list');
  if(!listArea) return;
  
  var q = window._fbQuery(window._fbCollection(window._fbDb, 'duels'), window._fbWhere('status', '==', 'waiting'), window._fbWhere('isPublic', '==', true));
  unsubLobby = window._fbOnSnapshot(q, function(snap) {
    if(snap.empty){
      listArea.innerHTML = '<div style="text-align:center;color:var(--text2);font-size:0.85rem;padding:10px;">Aucune session publique en attente.</div>';
      return;
    }
    var html = '';
    snap.forEach(function(doc){
      var d = doc.data();
      var pCount = d.players ? Object.keys(d.players).length : 1;
      var hostName = 'Joueur';
      if(d.players && d.players[d.host]) hostName = d.players[d.host].pseudo;
      
      var isFull = pCount >= 5;
      var btnHtml = isFull ? '<button disabled style="background:var(--border2);color:var(--text2);border:none;border-radius:4px;padding:4px 8px;cursor:not-allowed;">Plein</button>'
                           : '<button onclick="joinOnlineSession(\''+d.code+'\')" style="background:var(--primary);color:#000;border:none;border-radius:4px;padding:4px 8px;cursor:pointer;font-weight:bold;">Rejoindre</button>';
                           
      html += '<div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg3);padding:8px;border-radius:8px;border:1px solid var(--border2);">'
            + '<div style="font-size:0.9rem;font-family:var(--font-title);"><span style="color:var(--primary);">'+hostName+'</span> <span style="color:var(--text2);font-size:0.8rem;">('+pCount+'/5)</span></div>'
            + btnHtml
            + '</div>';
    });
    listArea.innerHTML = html;
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
    // try delete
    window._fbDeleteDoc(window._fbDoc(window._fbDb,'duels',onlineSession.code)).catch(function(){});
  }
  onlineSession={code:null,uid:null,role:null,unsubscribe:null,config:null,qIdx:0,roundIdx:0,questionsPool:[],qStartTs:0,myAnswered:false,revealing:false,perRoundScores:{}};
  document.getElementById('online-setup-panel').style.display='block';
  document.getElementById('online-create-btn').style.display='block';
  document.getElementById('online-code-box').style.display='none';
  document.getElementById('online-waiting').style.display='none';
  document.getElementById('online-vote-panel').style.display='none';
  document.getElementById('online-round-panel').style.display='none';
  document.getElementById('online-game-panel').style.display='none';
  document.getElementById('online-finish-panel').style.display='none';
  var hBtn=document.getElementById('online-host-start-btn');if(hBtn)hBtn.style.display='none';
  showScreen('menu');
}

function handleOnlineSessionUpdate(data){
  var isHost=onlineSession.role==='host';
  var playersList = data.players ? Object.values(data.players) : [];
  
  // 1. WAITING
  if(data.status==='waiting'){ 
    _showOnlinePanel('setup'); 
    var wMsg = document.getElementById('online-waiting-msg');
    var wAnim = document.getElementById('online-waiting-anim');
    var hBtn = document.getElementById('online-host-start-btn');
    if(playersList.length > 1 && isHost) {
      if(wMsg) wMsg.textContent= playersList.length + ' joueurs prêts.';
      if(hBtn) hBtn.style.display='block';
    } else if(isHost) {
      if(wMsg) wMsg.textContent='En attente de joueurs...';
      if(hBtn) hBtn.style.display='none';
    } else {
      if(wMsg) wMsg.textContent="En attente de l'hôte...";
      if(hBtn) hBtn.style.display='none';
    }
    return; 
  }

  // 2. VOTING — config by host
  if(data.status==='voting'){
    _showOnlinePanel('vote');
    renderVotePanel(data, isHost);
    return;
  }

  // 3. STARTING — host génère la pool
  if(data.status==='starting'){
    _showOnlinePanel('round');
    renderRoundRecap(data, true /*starting*/);
    if(isHost){ hostGenerateQuestionsAndStart(data); }
    return;
  }

  // 3b. READY TO START
  if(data.status==='ready_to_start'){
    _showOnlinePanel('setup');
    var wMsg = document.getElementById('online-waiting-msg');
    var wAnim = document.getElementById('online-waiting-anim');
    var hBtn = document.getElementById('online-host-start-btn');
    var cBox = document.getElementById('online-code-box');
    var cBtn = document.getElementById('online-create-btn');
    if(cBtn) cBtn.style.display='none';
    if(cBox) cBox.style.display='none';
    document.getElementById('online-waiting').style.display='block';
    if(isHost){
      if(wMsg) wMsg.textContent='Configuration terminée !';
      if(wAnim) wAnim.style.display='none';
      if(hBtn) { hBtn.style.display='block'; hBtn.onclick=hostStartNow; }
    } else {
      if(wMsg) wMsg.textContent="L'hôte va lancer la partie...";
      if(wAnim) wAnim.style.display='flex';
      if(hBtn) hBtn.style.display='none';
    }
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
    onlineSession.config=data.config;
    onlineSession.qIdx=data.qIdx||0;
    onlineSession.roundIdx=data.roundIdx||0;
    renderOnlineHUD(data);
    
    var curQ=data.currentQ;
    var needRerender = !window._lastRenderedQ || window._lastRenderedQ.idx !== (curQ&&curQ.idx);
    if(curQ && needRerender){
      window._lastRenderedQ = curQ;
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
        setTimeout(function(){ hostAdvance(data); }, 3000);
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

function hostManualStart(){
  if(onlineSession.role!=='host')return;
  _onlineUpdate({status:'voting'});
}

function hostStartNow(){
  if(onlineSession.role!=='host')return;
  _onlineUpdate({status:'starting'});
}

// ─── CONFIG PANEL (ex-Vote) ───
function renderVotePanel(data, isHost){
  var area=document.getElementById('online-vote-area');
  if(!area)return;
  
  if(!isHost){
    area.innerHTML='<div class="online-waiting"><div class="online-waiting-text">L\'hôte configure la partie...</div><div class="online-waiting-dots"><div class="online-waiting-dot"></div><div class="online-waiting-dot"></div><div class="online-waiting-dot"></div></div></div>';
    return;
  }

  var html='<div class="vote-title" style="margin-bottom:20px;text-align:center;font-family:var(--font-title);color:var(--text);font-size:1.2rem;">⚙️ Configuration</div>';
  
  html+='<div style="font-size:0.9rem;color:var(--text2);margin-bottom:8px;">MODE DE JEU :</div>';
  html+='<div class="vote-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px;">';
  Object.keys(ONLINE_MODES).forEach(function(m){
    var sel = (onlineSession.localMode===m) ? ' border:2px solid var(--primary);background:var(--bg3);' : 'border:2px solid var(--border);';
    html+='<button onclick="setOnlineVote(\'mode\',\''+m+'\')" style="padding:15px;border-radius:12px;cursor:pointer;'+sel+'color:var(--text);">'
        + '<div style="font-weight:bold;margin-bottom:4px;pointer-events:none;">'+ONLINE_MODES[m].label+'</div>'
        + '<div style="font-size:0.8rem;color:var(--text2);pointer-events:none;">'+ONLINE_MODES[m].desc+'</div></button>';
  });
  html+='</div>';

  html+='<div style="font-size:0.9rem;color:var(--text2);margin-bottom:8px;">QUESTIONS (par round ou total) :</div>';
  html+='<div style="display:flex;gap:10px;margin-bottom:20px;justify-content:center;">';
  ONLINE_COUNTS.forEach(function(c){
    var sel = (onlineSession.localCount===c) ? ' border:2px solid var(--primary);background:var(--bg3);' : 'border:2px solid var(--border);';
    html+='<button onclick="setOnlineVote(\'count\','+c+')" style="padding:10px 20px;border-radius:8px;font-weight:bold;color:var(--text);cursor:pointer;'+sel+'">'+c+'</button>';
  });
  html+='</div>';

  html+='<div style="font-size:0.9rem;color:var(--text2);margin-bottom:8px;">OPTIONS :</div>';
  html+='<div style="display:flex;align-items:center;gap:10px;margin-bottom:30px;justify-content:center;">';
  var sbCheck = onlineSession.localSpeedBonus ? 'checked' : '';
  html+='<label style="color:var(--text);cursor:pointer;display:flex;align-items:center;gap:8px;">'
      + '<input type="checkbox" id="online-speed-cb" onchange="onlineSession.localSpeedBonus=this.checked" style="accent-color:var(--primary);width:18px;height:18px;" '+sbCheck+'>'
      + 'Bonus de vitesse (score dégressif selon le temps)</label>';
  html+='</div>';

  html+='<button onclick="validateOnlineConfig()" style="width:100%;padding:15px;border-radius:12px;background:var(--primary);color:#000;font-weight:bold;font-size:1.1rem;cursor:pointer;border:none;">⚔️ VALIDER & JOUER</button>';
  
  area.innerHTML=html;
}

window.setOnlineVote = function(type, val){
  if(type==='mode') onlineSession.localMode = val;
  if(type==='count') onlineSession.localCount = val;
  var d={status:'voting', players:{}};
  handleOnlineSessionUpdate(d); // re-render fast
}

window.validateOnlineConfig = function(){
  if(!onlineSession.localMode) onlineSession.localMode='rounds';
  if(!onlineSession.localCount) onlineSession.localCount=5;
  var cfg = {
    mode: onlineSession.localMode,
    qPerRound: (onlineSession.localMode==='rounds') ? onlineSession.localCount : 0,
    totalRounds: (onlineSession.localMode==='rounds') ? 3 : 1,
    target: (onlineSession.localMode==='course') ? onlineSession.localCount : 0,
    speedBonus: !!onlineSession.localSpeedBonus
  };
  if(cfg.mode==='qbq'){ cfg.qPerRound=onlineSession.localCount; cfg.totalRounds=1; }
  
  _onlineUpdate({
    config: cfg,
    status: 'ready_to_start'
  });
}

function computeAndStartConfig(data){} // Legacy, not used.

// ─── STARTING ───
async function hostGenerateQuestionsAndStart(data){
  var cfg=data.config;
  var totalQ=0;
  if(cfg.mode==='rounds') totalQ = cfg.qPerRound * cfg.totalRounds;
  else if(cfg.mode==='course') totalQ = cfg.target * 3; // buffer large
  else if(cfg.mode==='qbq') totalQ = cfg.qPerRound;
  
  var catList = Object.keys(CATS).filter(function(k){return k!=='mix';});
  var pool = [];
  var usedSet = new Set();
  var pIdx = 0;
  while(pool.length < totalQ && pIdx < 500){
    pIdx++;
    var c = catList[Math.floor(Math.random()*catList.length)];
    if(!CATS[c]||!CATS[c].questions||CATS[c].questions.length===0) continue;
    var q = CATS[c].questions[Math.floor(Math.random()*CATS[c].questions.length)];
    var k = c+'-'+q.idx;
    if(usedSet.has(k)) continue;
    usedSet.add(k);
    pool.push({c:c, q:q});
  }
  onlineSession.questionsPool = pool;
  
  var firstQ = pool[0];
  var upd = {
    status:'playing',
    qIdx:0, roundIdx:0,
    currentQ:{ cat:firstQ.c, idx:firstQ.q.idx, obj:firstQ.q },
    reveal:false
  };
  Object.keys(data.players).forEach(function(uid){
    upd['players.'+uid+'.score'] = 0;
    upd['players.'+uid+'.answer'] = null;
  });
  
  setTimeout(function(){ _onlineUpdate(upd); }, 3000); // Intro round
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
  _onlineUpdate({status:'playing', reveal:false});
}

// ─── IN GAME ───
function renderOnlineHUD(data){
  var hud=document.getElementById('online-hud');
  if(!hud)return;
  var players = Object.values(data.players).sort(function(a,b){return b.score - a.score;});
  var html = '';
  
  players.forEach(function(p, i){
    var ansState = p.answer != null ? '<div style="width:8px;height:8px;border-radius:50%;background:var(--success);margin:0 auto;margin-top:4px;"></div>' : '';
    html += '<div style="display:flex;flex-direction:column;align-items:center;background:var(--bg3);padding:5px 10px;border-radius:8px;border:1px solid '+(p.uid===window._fbUser.uid?'var(--primary)':'var(--border2)')+';">'
          + '<div style="font-size:0.75rem;color:var(--text2);max-width:50px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+p.pseudo+'</div>'
          + '<div style="font-weight:bold;color:var(--text);">'+p.score+'</div>'
          + ansState
          + '</div>';
  });
  hud.innerHTML = '<div style="display:flex;justify-content:center;gap:10px;flex-wrap:wrap;">' + html + '</div>';
}

function renderOnlineQuestion(q){
  var area=document.getElementById('online-question-area');
  var obj=q.obj;
  var tbar=document.querySelector('#online-game-panel .tbar');
  if(tbar){ tbar.style.transition='none'; tbar.style.width='100%'; tbar.style.background='var(--primary)'; }

  var html='<div style="font-size:1.1rem;font-weight:600;margin-bottom:20px;text-align:center;">'+safeQuestionHtml(obj.q)+'</div>';
  var mechs=['qcm','tf','word','calc']; // limited
  var m=obj.t; if(mechs.indexOf(m)===-1) m='qcm';
  
  window._curOnlineQ = obj;

  html+='<div id="online-opts" style="display:flex;flex-direction:column;gap:10px;">';
  if(m==='qcm'){
    var o=[obj.a].concat(obj.w||[]);
    shuffle(o);
    window._curOnlineOpts = o;
    o.forEach(function(opt,i){
      html+='<button class="opt-btn" id="oopt'+i+'" onclick="onlineAnswer('+i+')">'+safeQuestionHtml(opt)+'</button>';
    });
  } else if(m==='tf'){
    window._curOnlineOpts = ['Vrai','Faux'];
    html+='<button class="opt-btn" id="oopt0" onclick="onlineAnswer(0)">Vrai</button>';
    html+='<button class="opt-btn" id="oopt1" onclick="onlineAnswer(1)">Faux</button>';
  } else if(m==='word' || m==='calc'){
    html+='<input type="text" id="oopt-input" style="width:100%;padding:15px;border-radius:8px;border:1px solid var(--border);background:var(--bg2);color:var(--text);font-size:1.2rem;text-align:center;font-weight:bold;margin-bottom:10px;" placeholder="Réponse..." onkeydown="if(event.key===\'Enter\')onlineAnswer(\'input\')">';
    html+='<button class="opt-btn" onclick="onlineAnswer(\'input\')" style="background:var(--primary);color:#000;">VALIDER</button>';
  }
  html+='</div>';
  area.innerHTML=html;

  // Timer visuel
  setTimeout(function(){
    var timer=getQTimer(obj,20);
    if(tbar){ tbar.style.transition='width '+timer+'s linear'; tbar.style.width='0%'; }
  }, 50);
}

window.onlineAnswer = function(val){
  if(onlineSession.myAnswered || onlineSession.revealing) return;
  onlineSession.myAnswered=true;
  
  var obj=window._curOnlineQ;
  var ansText = '';
  if(obj.t==='qcm' || obj.t==='tf'){
    var o = window._curOnlineOpts;
    ansText = o[val];
    var b=document.getElementById('oopt'+val);
    if(b) b.style.border='2px solid var(--primary)';
  } else {
    var inp = document.getElementById('oopt-input');
    ansText = inp ? inp.value.trim() : '';
  }

  var elapsed = (Date.now() - onlineSession.qStartTs)/1000;
  var maxT = getQTimer(obj,20);
  
  var isCorrect = false;
  if(obj.t==='tf') isCorrect = ((ansText==='Vrai') === !!obj.a);
  else if(obj.t==='word' || obj.t==='calc') {
    var valid = [String(obj.a).toLowerCase()].concat((obj.w||[]).map(function(s){return String(s).toLowerCase();}));
    isCorrect = valid.indexOf(ansText.toLowerCase())>-1;
  }
  else isCorrect = (ansText === obj.a);

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
  var tbar=document.querySelector('#online-game-panel .tbar');
  if(tbar){ tbar.style.transition='none'; }
  
  var obj = data.currentQ.obj;
  var players = Object.values(data.players);
  var opts = document.querySelectorAll('#online-opts .opt-btn');
  
  if(obj.t==='qcm' || obj.t==='tf'){
    opts.forEach(function(b){
      var txt = b.textContent;
      var isGood = (obj.t==='tf') ? ((txt==='Vrai') === !!obj.a) : (txt === obj.a);
      if(isGood) {
        b.style.background = 'var(--success)';
        b.style.color = '#fff';
      } else {
        b.style.opacity = '0.4';
      }
      
      // Montrer qui a voté quoi
      players.forEach(function(p){
        if(p.answer && p.answer.txt === txt){
          var badge = document.createElement('div');
          badge.textContent = p.pseudo;
          badge.style.position = 'absolute';
          badge.style.right = '-10px';
          badge.style.top = '-10px';
          badge.style.background = 'var(--bg2)';
          badge.style.border = '1px solid var(--border)';
          badge.style.padding = '2px 6px';
          badge.style.borderRadius = '8px';
          badge.style.fontSize = '0.6rem';
          b.style.position = 'relative';
          b.appendChild(badge);
        }
      });
    });
  } else {
    var area = document.getElementById('online-opts');
    var h = '<div style="font-size:1.2rem;color:var(--success);font-weight:bold;margin-bottom:15px;text-align:center;">Réponse : '+obj.a+'</div>';
    players.forEach(function(p){
      if(p.answer){
        var c = p.answer.ok ? 'var(--success)' : 'var(--error)';
        h+='<div style="color:'+c+';font-size:0.9rem;">'+p.pseudo+' : '+p.answer.txt+' ('+p.answer.pts+' pts)</div>';
      }
    });
    if(area) area.innerHTML = h;
  }
}

function hostAdvance(data){
  if(onlineSession.role!=='host')return;
  var upd = {};
  var players = Object.values(data.players);
  var pids = Object.keys(data.players);
  
  players.forEach(function(p){
    var pts = (p.answer && p.answer.pts) ? p.answer.pts : 0;
    upd['players.'+p.uid+'.score'] = (p.score||0) + pts;
    upd['players.'+p.uid+'.answer'] = null; // reset
  });

  var c = data.config;
  if(c.mode==='course'){
    var winner = players.find(function(p){ return (p.score + ((p.answer&&p.answer.pts)?p.answer.pts:0)) >= (c.target*100); });
    if(winner) { upd.status='finished'; _onlineUpdate(upd); return; }
  }

  var nIdx = (data.qIdx||0) + 1;
  if(c.mode==='qbq'){
    if(nIdx >= c.qPerRound) { upd.status='finished'; }
    else { upd.qIdx=nIdx; upd.currentQ = {cat:onlineSession.questionsPool[nIdx].c, idx:onlineSession.questionsPool[nIdx].q.idx, obj:onlineSession.questionsPool[nIdx].q}; upd.reveal=false; }
  } else if(c.mode==='rounds') {
    if(nIdx % c.qPerRound === 0){
      var nRound = (data.roundIdx||0) + 1;
      if(nRound >= c.totalRounds) { upd.status='finished'; }
      else { upd.status='round_end'; upd.roundIdx=nRound; upd.qIdx=nIdx; }
    } else {
      upd.qIdx=nIdx; upd.currentQ = {cat:onlineSession.questionsPool[nIdx].c, idx:onlineSession.questionsPool[nIdx].q.idx, obj:onlineSession.questionsPool[nIdx].q}; upd.reveal=false;
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
