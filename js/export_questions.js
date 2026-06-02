// export_questions.js — Export de la collection "questions" depuis Firestore
// Requiert Firebase Auth et Firestore initialisés (firebase-init.js)

import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, collection, getDocs, query, where }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const auth = window._fbAuth || getAuth();
const db   = window._fbDb   || getFirestore();

/**
 * Récupère toutes les questions actives de la collection "questions"
 * et les télécharge au format JSON v2 (tableau plat).
 */
window.exportAllQuestions = async function() {
  try {
    const user = auth.currentUser;
    if (!user) console.warn('User not signed in. Attempting public read.');

    const snap = await getDocs(query(collection(db, 'questions'), where('active', '==', true)));
    const allQuestions = [];
    snap.forEach(docSnap => { allQuestions.push(docSnap.data()); });

    const jsonStr = JSON.stringify(allQuestions, null, 2);
    const blob    = new Blob([jsonStr], { type: 'application/json' });
    const url     = URL.createObjectURL(blob);
    const a       = document.createElement('a');
    a.href        = url;
    a.download    = 'questions_export_v2_' + new Date().toISOString().slice(0,10) + '.json';
    a.click();
    URL.revokeObjectURL(url);
    console.log('Export terminé : ' + allQuestions.length + ' questions.');
  } catch(e) {
    console.error('Erreur export questions :', e);
  }
};

// Bouton optionnel dans l'UI
if (document.getElementById('export-questions-btn')) {
  document.getElementById('export-questions-btn').addEventListener('click', window.exportAllQuestions);
}
