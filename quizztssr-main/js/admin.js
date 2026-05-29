// ─── admin.js — Panneau Administrateur ───

async function openAdminPanel(){
  // Redirection directe vers les rapports pour corriger les questions
  if(typeof viewBugReports === 'function') viewBugReports();
  else alert('Fonction de rapports non chargée.');
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
  header.innerHTML = window.safeHTML ? window.safeHTML('<span style="font-family:monospace;font-size:11px;color:#f87171;letter-spacing:2px;">🔑 PANNEAU ADMIN</span>') : '<span style="font-family:monospace;font-size:11px;color:#f87171;letter-spacing:2px;">🔑 PANNEAU ADMIN</span>';
  var closeBtn=document.createElement('button');
  closeBtn.textContent='✕';
  closeBtn.style.cssText='background:none;border:none;color:var(--text2);font-size:18px;cursor:pointer;';
  closeBtn.onclick=function(){ ovl.style.display='none'; };
  header.appendChild(closeBtn);

  var body2=document.createElement('div');
  body2.style.cssText='padding:16px 20px;overflow-y:auto;flex:1;';
  var bHtml = '<div style="font-family:monospace;font-size:8px;color:var(--dim);letter-spacing:2px;margin-bottom:10px;">UTILISATEURS</div>'+
    '<div id="admin-users-list">Chargement...</div>'+
    '<div style="font-family:monospace;font-size:8px;color:var(--dim);letter-spacing:2px;margin:16px 0 10px;">PROMOS</div>'+
    '<div id="admin-promos-list">Chargement...</div>';
  body2.innerHTML = window.safeHTML ? window.safeHTML(bHtml) : bHtml;

  box.appendChild(header);
  box.appendChild(body2);
  ovl.appendChild(box);
  document.body.appendChild(ovl);
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
