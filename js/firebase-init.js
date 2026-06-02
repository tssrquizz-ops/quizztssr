// Firebase module — chargé en premier

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword,
         createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider,
         signOut } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp,
         collection, getDocs, query, where, orderBy, limit, writeBatch }
         from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyBXMDEKxQ2HP5d4lxSx0IpaDEIjrhAFSEE",
  authDomain:        "tssrquizz-2744f.firebaseapp.com",
  projectId:         "tssrquizz-2744f",
  storageBucket:     "tssrquizz-2744f.firebasestorage.app",
  messagingSenderId: "968867578298",
  appId:             "1:968867578298:web:b67e5854522788a8d1dd83"
};

const app       = initializeApp(FIREBASE_CONFIG);
const auth      = getAuth(app);
const db        = getFirestore(app);
const gProvider = new GoogleAuthProvider();

// ── Expose globalement ──
window._fbAuth           = auth;
window._fbDb             = db;
window._fbDoc            = doc;
window._fbGetDoc         = getDoc;
window._fbSetDoc         = setDoc;
window._fbUpdateDoc      = updateDoc;
window._fbDeleteDoc      = deleteDoc;
window._fbOnSnapshot     = onSnapshot;
window._fbServerTs       = serverTimestamp;
window._fbGoogleProvider = gProvider;
window._fbSignInEmail    = signInWithEmailAndPassword;
window._fbSignUpEmail    = createUserWithEmailAndPassword;
window._fbSignInPopup    = signInWithPopup;
window._fbSignOut        = signOut;
window._fbCollection     = collection;
window._fbGetDocs        = getDocs;
window._fbQuery          = query;
window._fbWhere          = where;
window._fbOrderBy        = orderBy;
window._fbLimit          = limit;
window._fbWriteBatch     = writeBatch;
window._fbUser           = null;

// ── Admin : document admins/{uid} (créé dans la console Firebase) ──
window.fbCheckAdmin = async function() {
  if (!window._fbUser) return false;
  try {
    var snap = await getDoc(doc(db, 'admins', window._fbUser.uid));
    return snap.exists();
  } catch (e) {
    return false;
  }
};

// ── Charger données utilisateur depuis Firestore ──
window.fbLoadUserData = async function(uid) {
  try {
    var snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      var d = snap.data();
      var map = {srs:'tssr5_qdb',stats:'tssr5_stats',streak:'tssr5_streak',
                 badges:'tssr5_badges',history:'tssr5_history',hs:'tssr5_hs'};
      Object.keys(map).forEach(function(k){
        if(d[k]!==undefined) try{localStorage.setItem(map[k],JSON.stringify(d[k]));}catch(e){}
      });
      if (d.prefs) {
        // vt (thème) : géré uniquement en local — pas chargé depuis Firestore
        if (d.prefs.ui)     try{localStorage.setItem('tssr5_ui', d.prefs.ui);}catch(e){}
        if (d.prefs.sound  !== undefined) try{localStorage.setItem('tssr5_sound',  JSON.stringify(d.prefs.sound));}catch(e){}
        if (d.prefs.qcount !== undefined) try{localStorage.setItem('tssr5_qcount', JSON.stringify(d.prefs.qcount));}catch(e){}
      }
      if (d.profile) try{localStorage.setItem('tssr5_profile', JSON.stringify(d.profile));}catch(e){}
    }
    // Recharger vars globales
    try{window.hsD     = JSON.parse(localStorage.getItem('tssr5_hs')    ||'{}');}catch(e){}
    try{window.stD     = JSON.parse(localStorage.getItem('tssr5_stats') ||'{}');}catch(e){}
    try{window.bdD     = JSON.parse(localStorage.getItem('tssr5_badges')||'[]');}catch(e){}
    try{window.streakD = JSON.parse(localStorage.getItem('tssr5_streak')||'{"current":0,"best":0,"lastDate":""}');}catch(e){}
    try{window.historyD= JSON.parse(localStorage.getItem('tssr5_history')||'[]');}catch(e){}
  } catch(err) { console.warn('[Firebase] load error:', err); }
};

// ── Sauvegarder vers Firestore ──
window.fbSaveUserData = async function() {
  if (!window._fbUser) return;
  try {
    var profileData=(function(){try{return JSON.parse(localStorage.getItem('tssr5_profile')||'{}');}catch(e){return {};}})();
    var srsData=(function(){try{return JSON.parse(localStorage.getItem('tssr5_qdb')||'{}');}catch(e){return {};}})();
    var nowMs=Date.now(),masteredCount=0;
    Object.keys(srsData).forEach(function(k){var r=srsData[k];if(r&&r.seen>0&&r.streak>=3&&nowMs<r.nextReview)masteredCount++;});
    var streakLb=(function(){try{return JSON.parse(localStorage.getItem('tssr5_streak')||'{}');}catch(e){return {};}})();
    var badgesLb=(function(){try{return JSON.parse(localStorage.getItem('tssr5_badges')||'[]');}catch(e){return [];}})();
    var tlevel='DÉBUTANT';
    if(masteredCount>=100)tlevel='TSSR CERTIFIÉ';
    else if(masteredCount>=60)tlevel='EXPERT';
    else if(masteredCount>=30)tlevel='INTERMÉDIAIRE';
    else if(masteredCount>=10)tlevel='TECHNICIEN';
    var payload = {
      srs:     JSON.parse(localStorage.getItem('tssr5_qdb')    ||'{}'),
      stats:   JSON.parse(localStorage.getItem('tssr5_stats')  ||'{}'),
      streak:  JSON.parse(localStorage.getItem('tssr5_streak') ||'{}'),
      badges:  JSON.parse(localStorage.getItem('tssr5_badges') ||'[]'),
      history: JSON.parse(localStorage.getItem('tssr5_history')||'[]'),
      hs:      JSON.parse(localStorage.getItem('tssr5_hs')     ||'{}'),
      profile: profileData,
      prefs: {
        ui:     localStorage.getItem('tssr5_ui')    ||'ui-arcade',
        sound:  JSON.parse(localStorage.getItem('tssr5_sound') ||'false'),
        qcount: JSON.parse(localStorage.getItem('tssr5_qcount')||'10')
      },
      email:     window._fbUser.email || '',
      updatedAt: serverTimestamp()
    };
    await setDoc(doc(db,'users',window._fbUser.uid), payload, {merge:true});
    // Leaderboard public
    try {
      var statsAll=(function(){try{return JSON.parse(localStorage.getItem('tssr5_stats')||'{}');}catch(e){return {};}})();
      var totalPlayed=0,totalCorrect=0;
      Object.keys(statsAll).forEach(function(k){var s=statsAll[k];totalPlayed+=(s.played||0);totalCorrect+=(s.correct||0);});
      await setDoc(doc(db,'leaderboard',window._fbUser.uid),{
        pseudo:      profileData.pseudo||window._fbUser.email.split('@')[0],
        totalPlayed: totalPlayed,
        totalCorrect:totalCorrect,
        avatar:      profileData.avatar||'😊',
        promo:       profileData.promo||'',
        mastered:    masteredCount,
        streak:      streakLb.current||0,
        badges:      badgesLb.length,
        title:       tlevel,
        email:       window._fbUser.email||'',
        lastPlayed:  serverTimestamp()
      },{merge:true});
    } catch(e){ console.warn('lb update failed',e); }
  } catch(err) { console.warn('[Firebase] save error:', err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// ── Construire window.CATS + window.GROUPS depuis un tableau de questions plat ──
// Appelé après chargement Firestore OU fallback JSON local.
// Compatible 100% avec le reste de l'app qui consomme window.CATS[catId].qs
// ─────────────────────────────────────────────────────────────────────────────
window.fbBuildCatsFromQuestions = function(questions) {
  if (!window.CATS)   window.CATS   = {};
  if (!window.GROUPS) window.GROUPS = {};

  // Vider les qs de toutes les catégories existantes pour éviter les doublons
  Object.keys(window.CATS).forEach(function(k) {
    if (k !== 'mix') window.CATS[k].qs = [];
  });

  questions.forEach(function(q) {
    var catId   = q.cat;
    var groupId = q.group;
    if (!catId) return;

    // Nettoyage : ignorer l'ancien champ mech, assurer t et d
    var cleanQ = Object.assign({}, q);
    delete cleanQ.mech;
    if (!cleanQ.t) cleanQ.t = 'qcm';
    if (cleanQ.d === undefined) cleanQ.d = 1;

    // Créer la catégorie en mémoire si inconnue
    if (!window.CATS[catId]) {
      window.CATS[catId] = {
        label:      q.catLabel   || catId,
        icon:       q.catIcon    || '📁',
        group:      groupId      || '',
        groupLabel: q.groupLabel || '',
        qs: []
      };
    }
    window.CATS[catId].qs.push(cleanQ);

    // Indexer dans GROUPS
    if (groupId) {
      if (!window.GROUPS[groupId]) {
        window.GROUPS[groupId] = { label: q.groupLabel || groupId, cats: [] };
      }
      if (window.GROUPS[groupId].cats.indexOf(catId) === -1) {
        window.GROUPS[groupId].cats.push(catId);
      }
    }
  });

  // Reconstruire le mix global (toutes catégories confondues)
  if (window.CATS.mix) {
    window.CATS.mix.qs = [];
    Object.keys(window.CATS).forEach(function(id) {
      if (id === 'mix') return;
      if (window.CATS[id] && window.CATS[id].qs) {
        window.CATS.mix.qs = window.CATS.mix.qs.concat(
          window.CATS[id].qs.map(function(q) {
            return Object.assign({}, q, {_cat: window.CATS[id].label});
          })
        );
      }
    });
  }

  var totalQ = 0;
  Object.keys(window.CATS).forEach(function(k){ if(k!=='mix') totalQ += window.CATS[k].qs.length; });
  console.log('[Firebase] CATS: ' + (Object.keys(window.CATS).length - 1) + ' catégories · '
    + totalQ + ' questions · '
    + Object.keys(window.GROUPS).length + ' groupes.');
};

// ─────────────────────────────────────────────────────────────────────────────
// ── Charger les questions depuis la collection Firestore "questions" (structure plate) ──
// Fallback automatique sur bdd_globale.json si la collection est vide ou inaccessible.
// ─────────────────────────────────────────────────────────────────────────────
window.fbLoadQuestions = async function() {
  // Attendre que window.CATS soit défini (chargé par js/data.js)
  while (!window.CATS) {
    await new Promise(function(resolve){ setTimeout(resolve, 50); });
  }

  var loaded = false;

  // Tentative 1 : Firestore, collection "questions", active == true
  try {
    console.log('[Firebase] Chargement des questions depuis Firestore (questions)...');
    var snap = await getDocs(query(collection(db, 'questions'), where('active', '==', true)));
    if (!snap.empty) {
      var questions = [];
      snap.forEach(function(docSnap) { questions.push(docSnap.data()); });
      window.fbBuildCatsFromQuestions(questions);
      console.log('[Firebase] ' + questions.length + ' questions chargées depuis Firestore.');
      loaded = true;
    } else {
      console.warn('[Firebase] Collection "questions" vide dans Firestore.');
    }
  } catch(err) {
    console.error('[Firebase] Erreur Firestore :', err);
  }

  // Tentative 2 (fallback) : bdd_globale.json local
  if (!loaded) {
    try {
      console.warn('[Firebase] Tentative de chargement du fallback local bdd_globale.json...');
      var resp = await fetch('bdd_globale.json');
      if (resp.ok) {
        var localQs = await resp.json();
        window.fbBuildCatsFromQuestions(localQs);
        console.log('[Firebase] Fallback OK : ' + localQs.length + ' questions depuis bdd_globale.json.');
        loaded = true;
      }
    } catch(fetchErr) {
      console.warn('[Firebase] Impossible de charger bdd_globale.json :', fetchErr);
    }
  }

  if (!loaded) {
    console.warn('[Firebase] Aucune source de questions disponible — data.js hardcodé utilisé.');
  }
};
window.fbQuestionsPromise = window.fbLoadQuestions();

// ── Auth state ──
onAuthStateChanged(auth, async function(user) {
  if (user) {
    window._fbUser = user;
    await window.fbLoadUserData(user.uid);
    // Masquer login screen
    var ls = document.getElementById('fb-login-screen');
    if (ls) ls.style.display = 'none';
    // Mettre à jour le side menu
    window.fbUpdateAuthUI(user);
    // Lancer le menu
    if (typeof initMenu === 'function') initMenu();
    var sm = document.getElementById('screen-menu');
    if (sm) { document.querySelectorAll('.screen').forEach(function(s){s.classList.remove('active');}); sm.classList.add('active'); }
  } else {
    window._fbUser = null;
    window.fbUpdateAuthUI(null);
    // Afficher login seulement si l'user n'a pas cliqué "continuer sans compte"
    if (!window._fbSkipLogin) {
      var ls2 = document.getElementById('fb-login-screen');
      if (ls2) ls2.style.display = 'flex';
    }
  }
});

// Sauvegarder avant fermeture
window.addEventListener('beforeunload', function(){
  if (window._fbUser && window.fbSaveUserData) window.fbSaveUserData();
});
