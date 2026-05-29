// Export all questions from Firestore to a JSON file and trigger download
// Requires Firebase Auth and Firestore to be initialized (see firebase-init.js)

// Ensure Firebase SDK is loaded (same imports as firebase-init.js)
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const auth = window._fbAuth || getAuth();
const db = window._fbDb || getFirestore();

/**
 * Fetch all categories and their questions from Firestore, then download as JSON.
 */
window.exportAllQuestions = async function() {
  try {
    // Ensure user is signed in (optional, Firestore rules may allow public read)
    const user = auth.currentUser;
    if (!user) {
      console.warn('User not signed in. Attempting to load questions publicly.');
    }
    const snap = await getDocs(collection(db, 'categories'));
    const allData = {};
    snap.forEach(doc => {
      const data = doc.data();
      // Preserve category id and its questions
      allData[doc.id] = {
        label: data.label || '',
        icon: data.icon || '',
        desc: data.desc || '',
        cat: data.cat || '',
        qs: data.qs || []
      };
    });
    const jsonStr = JSON.stringify(allData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'questions_export.json';
    a.click();
    URL.revokeObjectURL(url);
    console.log('Questions exported successfully.');
  } catch (e) {
    console.error('Error exporting questions:', e);
  }
};

// Optional: expose a button in the UI if a container exists
if (document.getElementById('export-questions-btn')) {
  document.getElementById('export-questions-btn').addEventListener('click', window.exportAllQuestions);
}
