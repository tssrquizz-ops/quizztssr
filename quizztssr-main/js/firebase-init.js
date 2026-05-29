// Firebase module — chargé en premier

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword,
         createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider,
         signOut } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp,
         collection, getDocs, query, where, orderBy, limit }
         from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyBXMDEKxQ2HP5d4lxSx0IpaDEIjrhAFSEE",
  authDomain:        "tssrquizz-2744f.firebaseapp.com",
  projectId:         "tssrquizz-2744f",
  storageBucket:     "tssrquizz-2744f.firebasestorage.app",
  messagingSenderId: "968867578298",
  appId:             "1:968867578298:web:b67e5854522788a8d1dd83"
};

const app      = initializeApp(FIREBASE_CONFIG);
const auth     = getAuth(app);
const db       = getFirestore(app);
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
window._fbCollection   = collection;
window._fbGetDocs      = getDocs;
window._fbQuery        = query;
window._fbWhere        = where;
window._fbOrderBy      = orderBy;
window._fbLimit        = limit;
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

// ── Charger données depuis Firestore ──
window.fbLoadUserData = async function(uid) {
  try {
    var snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      var d = snap.data();
      // Fonction utilitaire locale pour éviter la répétition du try/catch et gérer le quota
      var safeLsSet = function(key, val) {
        try { localStorage.setItem(key, val); }
        catch(e) {
          if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
            console.warn('Quota localStorage dépassé ! Nettoyage de l\'historique...');
            try { localStorage.removeItem('tssr5_history'); } catch(e3){}
            try { localStorage.setItem(key, val); } catch(e2) {
              console.error('Impossible de sauvegarder', key, 'le stockage est plein.');
            }
          }
        }
      };

      var map = {srs:'tssr5_qdb',stats:'tssr5_stats',streak:'tssr5_streak',
                 badges:'tssr5_badges',history:'tssr5_history',hs:'tssr5_hs'};
      Object.keys(map).forEach(function(k){
        if(d[k]!==undefined) safeLsSet(map[k],JSON.stringify(d[k]));
      });
      if (d.prefs) {
        // vt (thème) : géré uniquement en local — pas chargé depuis Firestore
        if (d.prefs.ui)     safeLsSet('tssr5_ui', d.prefs.ui);
        if (d.prefs.sound  !== undefined) safeLsSet('tssr5_sound',  JSON.stringify(d.prefs.sound));
        if (d.prefs.qcount !== undefined) safeLsSet('tssr5_qcount', JSON.stringify(d.prefs.qcount));
      }
      if (d.profile) safeLsSet('tssr5_profile', JSON.stringify(d.profile));
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
    // Calcul résumé leaderboard
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
        // vt non sauvegardé dans Firestore — local only
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
      // Calculer taux de réussite global
      var statsAll=(function(){try{return JSON.parse(localStorage.getItem('tssr5_stats')||'{}');}catch(e){return {};}})();
      var totalPlayed=0,totalCorrect=0;
      Object.keys(statsAll).forEach(function(k){var s=statsAll[k];totalPlayed+=(s.played||0);totalCorrect+=(s.correct||0);});
      await setDoc(doc(db,'leaderboard',window._fbUser.uid),{
        pseudo:   profileData.pseudo||window._fbUser.email.split('@')[0],
        totalPlayed: totalPlayed,
        totalCorrect: totalCorrect,
        avatar:   profileData.avatar||'😊',
        promo:    profileData.promo||'',
        mastered: masteredCount,
        streak:   streakLb.current||0,
        badges:   badgesLb.length,
        title:    tlevel,
        email:    window._fbUser.email||'',
        lastPlayed: serverTimestamp()
      },{merge:true});
    } catch(e){ console.warn('lb update failed',e); }
  } catch(err) { console.warn('[Firebase] save error:', err); }
};

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
