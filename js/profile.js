// ─── profile.js — Profil, Leaderboard, Objectifs ───
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
    document.getElementById('lb-list').innerHTML='<div style="text-align:center;padding:24px;font-family:monospace;font-size:9px;color:#dc2626;">❌ '+err.message+'</div>';
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
  var sorted=_lbData.slice().sort(function(a,b){return (b[_lbTab]||0)-(a[_lbTab]||0);});
  var rankIcons={1:'🥇',2:'🥈',3:'🥉'};
  var scoreLabels={mastered:'maîtrisés',streak:'j. streak',badges:'badges'};
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
      '<div class="lb-avatar">'+(user.avatar||'😊')+'</div>'+
      '<div class="lb-info"><div class="lb-pseudo">'+(user.pseudo||'Anonyme')+(isMe?' <span style="font-size:8px;color:var(--acc);">← toi</span>':'')+
      '</div><div style="font-size:9px;color:var(--text2);">'+(user.promo||'')+'</div>'+
      '<div style="font-family:monospace;font-size:7px;color:var(--dim);margin-top:2px;">'+(user.title||'')+'</div></div>'+
      '<div class="lb-score"><span class="lb-score-val">'+(user[_lbTab]||0)+'</span><span class="lb-score-lbl">'+scoreLabels[_lbTab]+'</span></div>'+
    '</div>';
  }).join('');
}

function showLeaderboard(){ showScreen('leaderboard'); loadLeaderboard(); }

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
function showQuestsScreen(){buildQuestsScreen();showScreen('quests');}

