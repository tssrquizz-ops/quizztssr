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
    // Avoid duplicate injection
    if (document.getElementById('admin-import-section')) return;

    const container = document.createElement('div');
    container.id = 'admin-import-section';
    container.style.cssText = 'margin-top:16px;';

    // Build category options from CATS (skip 'mix')
    let catOptions = '';
    const cats = window.CATS || {};
    Object.keys(cats).forEach(function(id) {
      if (id === 'mix') return;
      const label = cats[id].label || cats[id].name || id;
      catOptions += '<option value="' + id + '">' + label + '</option>';
    });

    container.innerHTML =
      '<div style="font-family:monospace;font-size:8px;color:var(--dim);letter-spacing:2px;margin-bottom:10px;">IMPORT DE QUESTIONS</div>' +
      '<div style="background:var(--panel);border:1.5px solid var(--border2);border-radius:8px;padding:12px;">' +
        '<div style="font-family:monospace;font-size:9px;color:var(--text);margin-bottom:8px;">📥 Importer des questions (JSON / CSV)</div>' +
        '<div style="display:flex;flex-direction:column;gap:8px;">' +
          '<input id="admin-import-file" type="file" accept=".json,.csv" style="font-family:monospace;font-size:9px;color:var(--text);background:var(--bg2);border:1px solid var(--border2);border-radius:4px;padding:6px;" />' +
          '<div style="display:flex;gap:6px;">' +
            '<select id="admin-import-format" style="flex:1;font-family:monospace;font-size:9px;color:var(--text);background:var(--bg2);border:1px solid var(--border2);border-radius:4px;padding:6px;">' +
              '<option value="json">JSON</option>' +
              '<option value="csv">CSV</option>' +
            '</select>' +
            '<select id="admin-import-cat" style="flex:2;font-family:monospace;font-size:9px;color:var(--text);background:var(--bg2);border:1px solid var(--border2);border-radius:4px;padding:6px;">' +
              catOptions +
            '</select>' +
          '</div>' +
          '<button onclick="adminImportHandler()" style="background:var(--acc);color:var(--bg);border:none;border-radius:6px;padding:10px 16px;font-family:monospace;font-size:9px;cursor:pointer;width:100%;letter-spacing:1px;">📥 IMPORTER</button>' +
          '<div id="admin-import-status" style="font-family:monospace;font-size:9px;color:var(--text2);display:none;"></div>' +
        '</div>' +
      '</div>';

    panel.appendChild(container);
  };
})();
