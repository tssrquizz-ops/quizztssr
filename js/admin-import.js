// admin-import.js – Bulk import of quiz questions (JSON or CSV) into Firestore
// This script is loaded on the admin panel and injects an import UI.

(function(){
  // Helper to parse CSV into array of objects
  function parseCSV(content) {
    const lines = content.trim().split(/\r?\n/);
    const headers = lines[0].split(',').map(h => h.trim());
    const rows = lines.slice(1).map(line => {
      const cols = line.split(',');
      const obj = {};
      headers.forEach((h,i) => obj[h] = cols[i] ? cols[i].trim() : '');
      return obj;
    });
    return rows;
  }

  // Validate question object shape
  function validateQuestion(q) {
    const required = ['question','answer','category'];
    for (const f of required) {
      if (!q[f] || typeof q[f] !== 'string' || q[f].trim() === '') return false;
    }
    return true;
  }

  // Upload a batch of questions to Firestore under the chosen category
  async function uploadQuestions(questions, catId) {
    const db = window._fbDb; // Firebase DB instance
    const batch = window._fbWriteBatch(db);
    const now = Date.now();
    questions.forEach((q, idx) => {
      const docRef = window._fbDoc(db, 'categories', catId, 'questions', `${now}_${idx}`);
      batch.set(docRef, q);
    });
    await window._fbCommitBatch(batch);
  }

  // Main import handler
  window.adminImportHandler = async function(){
    const fileInput = document.getElementById('admin-import-file');
    const formatSel = document.getElementById('admin-import-format');
    const catSel = document.getElementById('admin-import-cat');

    if (!fileInput.files.length) { alert('Veuillez sélectionner un fichier.'); return; }
    const file = fileInput.files[0];
    const format = formatSel.value; // 'json' or 'csv'
    const catId = catSel.value;

    const reader = new FileReader();
    reader.onload = async (e) => {
      let raw = e.target.result;
      let items = [];
      try {
        if (format === 'json') {
          const parsed = JSON.parse(raw);
          items = Array.isArray(parsed) ? parsed : [parsed];
        } else {
          items = parseCSV(raw);
        }
        items = items.map(it => ({
          question: it.question || it.q || '',
          answer: it.answer || it.a || '',
          category: it.category || it.cat || catId,
          ...it
        }));
        const invalid = items.filter(q => !validateQuestion(q));
        if (invalid.length) {
          alert(`Found ${invalid.length} invalid question(s). Import cancelled.`);
          return;
        }
        await uploadQuestions(items, catId);
        alert(`Successfully imported ${items.length} question(s).`);
        if (typeof loadAdminData === 'function') loadAdminData();
      } catch(err) {
        console.error(err);
        alert('Import failed: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  // UI injection for admin panel
  window.injectImportUI = function(){
    const panel = document.getElementById('admin-panel-body');
    if (!panel) return;
    const container = document.createElement('div');
    container.style.marginTop = '12px';
    container.innerHTML = `
      <div style="font-weight:bold;margin-bottom:4px;">📥 Importer des questions (JSON/CSV)</div>
      <input id="admin-import-file" type="file" accept=".json,.csv" style="margin-bottom:4px;" />
      <select id="admin-import-format" style="margin-right:4px;">
        <option value="json">JSON</option>
        <option value="csv">CSV</option>
      </select>
      <select id="admin-import-cat" style="margin-right:4px;">
        ${Object.entries(window.CATS || {}).map(([id,name]) => `<option value="${id}">${name}</option>`).join('')}
      </select>
      <button onclick="adminImportHandler()" style="padding:4px 8px;background:var(--acc);color:var(--bg);border:none;border-radius:4px;cursor:pointer;">Importer</button>
    `;
    panel.appendChild(container);
  };
})();
