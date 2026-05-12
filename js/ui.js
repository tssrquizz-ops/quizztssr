/**
 * ui.js — Fonctions UI Firebase & initialisation DOM
 * Extrait des scripts inline de index.html — Phase 6 du plan d'implémentation
 *
 * Ce fichier est chargé avec defer, donc s'exécute après le parsing HTML
 * mais les fonctions window.* sont disponibles avant tout clic utilisateur.
 */

'use strict';

/* ─────────────────────────────────────────────────────
   AUTH UI — Mise à jour de l'interface selon l'état Firebase
   ───────────────────────────────────────────────────── */

/**
 * Met à jour tous les éléments UI liés à l'authentification.
 * Appelé par firebase-init.js via onAuthStateChanged.
 * @param {object|null} user - Objet Firebase User ou null si déconnecté
 */
window.fbUpdateAuthUI = function(user) {
  // Mettre à jour le profil menu (fonctions définies dans game.js)
  setTimeout(function() {
    if (typeof updateMenuProfile === 'function') updateMenuProfile();
    if (typeof updateMenuTopbar === 'function') updateMenuTopbar();
  }, 300);

  var loginBtn  = document.getElementById('fb-login-btn');
  var logoutBtn = document.getElementById('fb-logout-btn');
  var userInfo  = document.getElementById('fb-user-info');
  var syncEl    = document.getElementById('fb-sync-status');
  var syncTxt   = document.getElementById('fb-sync-text');

  if (user) {
    if (loginBtn)  loginBtn.style.display  = 'none';
    if (logoutBtn) logoutBtn.style.display = 'flex';
    if (userInfo)  userInfo.textContent    = user.displayName || user.email;
    if (syncEl)    syncEl.style.display    = 'flex';
    if (syncTxt)   syncTxt.textContent     = 'Synchro : ' + (user.displayName || user.email);
  } else {
    if (loginBtn)  loginBtn.style.display  = 'flex';
    if (logoutBtn) logoutBtn.style.display = 'none';
    if (userInfo)  userInfo.textContent    = '';
    if (syncEl)    syncEl.style.display    = 'none';
  }
};

/* ─────────────────────────────────────────────────────
   ONGLETS CONNEXION / INSCRIPTION
   ───────────────────────────────────────────────────── */

/**
 * Bascule entre l'onglet "Connexion" et "Inscription".
 * @param {'login'|'signup'} tab
 */
window.fbSwitchTab = function(tab) {
  var isLogin = tab === 'login';
  var tl = document.getElementById('fb-tab-login');
  var ts = document.getElementById('fb-tab-signup');
  var sb = document.getElementById('fb-submit-btn');
  var fn = document.getElementById('fb-name');
  var er = document.getElementById('fb-error');

  if (tl) {
    tl.style.background = isLogin ? 'var(--acc)' : 'transparent';
    tl.style.color      = isLogin ? 'var(--bg)'  : 'var(--text2)';
  }
  if (ts) {
    ts.style.background = isLogin ? 'transparent' : 'var(--acc)';
    ts.style.color      = isLogin ? 'var(--text2)' : 'var(--bg)';
  }
  if (sb) sb.textContent     = isLogin ? 'SE CONNECTER' : "S'INSCRIRE";
  if (fn) fn.style.display   = isLogin ? 'none' : 'block';
  if (er) er.style.display   = 'none';
};

/* ─────────────────────────────────────────────────────
   SOUMISSION DU FORMULAIRE AUTH
   ───────────────────────────────────────────────────── */

/** Messages d'erreur Firebase localisés */
var _FB_ERROR_MESSAGES = {
  'auth/user-not-found':       'Compte introuvable.',
  'auth/wrong-password':       'Mot de passe incorrect.',
  'auth/email-already-in-use': 'Email déjà utilisé — connecte-toi.',
  'auth/invalid-email':        'Email invalide.',
  'auth/weak-password':        'Mot de passe trop faible (6 car. min).',
  'auth/invalid-credential':   'Email ou mot de passe incorrect.',
  'auth/too-many-requests':    'Trop de tentatives. Réessaie plus tard.'
};

/**
 * Soumet le formulaire de connexion ou d'inscription.
 * Appelé par onclick="fbSubmit()" sur le bouton principal.
 */
window.fbSubmit = async function() {
  var email    = (document.getElementById('fb-email').value    || '').trim();
  var password = (document.getElementById('fb-password').value || '').trim();
  var isSignup = (document.getElementById('fb-submit-btn').textContent || '').indexOf('INSCRIRE') > -1;
  var errEl    = document.getElementById('fb-error');
  var btn      = document.getElementById('fb-submit-btn');

  errEl.style.display = 'none';

  if (!email || !password) {
    errEl.textContent   = 'Email et mot de passe requis.';
    errEl.style.display = 'block';
    return;
  }

  btn.disabled    = true;
  btn.textContent = '...';

  try {
    if (isSignup) {
      await window._fbSignUpEmail(window._fbAuth, email, password);
    } else {
      await window._fbSignInEmail(window._fbAuth, email, password);
    }
  } catch (err) {
    errEl.textContent   = _FB_ERROR_MESSAGES[err.code] || ('Erreur : ' + err.message);
    errEl.style.display = 'block';
    btn.disabled        = false;
    btn.textContent     = isSignup ? "S'INSCRIRE" : 'SE CONNECTER';
  }
};

/* ─────────────────────────────────────────────────────
   CONNEXION GOOGLE
   ───────────────────────────────────────────────────── */

/** Ouvre la popup d'authentification Google. */
window.fbGoogleLogin = async function() {
  var errEl = document.getElementById('fb-error');
  if (errEl) errEl.style.display = 'none';
  try {
    await window._fbSignInPopup(window._fbAuth, window._fbGoogleProvider);
  } catch (err) {
    if (errEl) {
      errEl.textContent   = 'Connexion Google annulée ou bloquée.';
      errEl.style.display = 'block';
    }
  }
};

/* ─────────────────────────────────────────────────────
   CONTINUER SANS COMPTE
   ───────────────────────────────────────────────────── */

/** Permet d'utiliser l'application sans se connecter. */
window.fbContinueWithoutAccount = function() {
  window._fbSkipLogin = true;
  var ls = document.getElementById('fb-login-screen');
  if (ls) ls.style.display = 'none';
  if (typeof initMenu === 'function') initMenu();
  var sm = document.getElementById('screen-menu');
  if (sm) {
    document.querySelectorAll('.screen').forEach(function(s) {
      s.classList.remove('active');
    });
    sm.classList.add('active');
  }
};

/* ─────────────────────────────────────────────────────
   DÉCONNEXION
   ───────────────────────────────────────────────────── */

/** Demande confirmation, sauvegarde les données, puis déconnecte. */
window.fbLogout = async function() {
  if (confirm('Se déconnecter ?')) {
    if (window.fbSaveUserData) await window.fbSaveUserData();
    await window._fbSignOut(window._fbAuth);
    window._fbSkipLogin = false;
    window._fbUser      = null;
    var ls = document.getElementById('fb-login-screen');
    if (ls) ls.style.display = 'flex';
    document.querySelectorAll('.screen').forEach(function(s) {
      s.classList.remove('active');
    });
  }
};

/* ─────────────────────────────────────────────────────
   INITIALISATION DOM
   ───────────────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', function() {
  // Touche Entrée sur les champs de formulaire
  ['fb-email', 'fb-password', 'fb-name'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) {
      el.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') window.fbSubmit();
      });
    }
  });

  // Afficher l'écran login — Firebase onAuthStateChanged le masquera si déjà connecté
  var ls = document.getElementById('fb-login-screen');
  if (ls) ls.style.display = 'flex';
});
