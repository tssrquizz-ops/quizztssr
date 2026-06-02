// admin-import.js – Import / Export de questions pour le panneau admin
// Structure cible : collection Firestore "questions" (documents plats, un par question)
// Import par lots writeBatch (400 max par batch) pour les 800+ questions

(function(){

  // ── CSV Parser ──
  function parseCSV(content) {
    var lines = content.trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    var headers = lines[0].split(',').map(function(h){ return h.trim(); });
    var rows = [];
    for (var i = 1; i < lines.length; i++) {
      var cols = lines[i].split(',');
      var obj = {};
      headers.forEach(function(h, idx){ obj[h] = cols[idx] ? cols[idx].trim() : ''; });
      rows.push(obj);
    }
    return rows;
  }

  // ── Normalise une question individuelle ──
  function normalizeQuestion(q) {
    var out = Object.assign({}, q);
    delete out.mech;        // ancienne structure — ignorée
    delete out._cat;
    delete out.idx;
    if (!out.t) out.t = 'qcm';
    if (out.d === undefined) out.d = 1;
    if (out.active === undefined) out.active = true;
    return out;
  }

  // ── Normalise un import JSON/CSV en tableau plat de questions ──
  // Accepte :
  //   1. Tableau plat [{cat, group, q, ...}, ...] → format v2 natif
  //   2. Objet { catId: { label, icon, qs: [...] } } → ancien format export
  //   3. CSV avec colonne "cat"
  function normalizeImport(raw, format) {
    var questions = [];

    if (format === 'csv') {
      var rows = parseCSV(raw);
      rows.forEach(function(row) {
        var catId = (row.cat || row.category || '').trim();
        if (!catId) return;
        var q = {};
        Object.keys(row).forEach(function(k) {
          if (k === 'category') return;
          try { q[k] = JSON.parse(row[k]); } catch(e) { q[k] = row[k]; }
        });
        q.cat = catId;
        questions.push(normalizeQuestion(q));
      });
      return questions;
    }

    var data = JSON.parse(raw);

    // Format v2 : tableau plat avec champs group + cat
    if (Array.isArray(data)) {
      data.forEach(function(item) {
        if (!item.cat && !item.category) return;
        var q = Object.assign({}, item);
        if (!q.cat) q.cat = q.category;
        questions.push(normalizeQuestion(q));
      });
      return questions;
    }

    // Ancien format export : { catId: { label, icon, qs: [...] } }
    if (typeof data === 'object') {
      Object.keys(data).forEach(function(catId) {
        if (catId === 'mix') return;
        var cat = data[catId];
        var qs = cat.questions || cat.qs || [];
        qs.forEach(function(q) {
          var out = Object.assign({}, q);
          out.cat      = catId;
          out.catLabel = out.catLabel || cat.label || catId;
          out.catIcon  = out.catIcon  || cat.icon  || '📁';
          questions.push(normalizeQuestion(out));
        });
      });
      return questions;
    }

    return questions;
  }

  // ── Envoyer questions vers Firestore par lots writeBatch (max 400/batch) ──
  async function batchWriteQuestions(questions, statusEl) {
    var db         = window._fbDb;
    var colFn      = window._fbCollection;
    var docFn      = window._fbDoc;
    var batchFn    = window._fbWriteBatch;

    if (!db || !colFn || !docFn || !batchFn) {
      throw new Error('Firebase non initialisé.');
    }

    var BATCH_SIZE = 400;
    var totalBatches = Math.ceil(questions.length / BATCH_SIZE);

    for (var b = 0; b < totalBatches; b++) {
      var chunk = questions.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);
      var batch = batchFn(db);

      chunk.forEach(function(q, i) {
        var globalIdx = b * BATCH_SIZE + i;
        var docRef = docFn(db, 'questions', 'q_' + globalIdx);
        batch.set(docRef, q);
      });

      if (statusEl) {
        statusEl.textContent = '⏳ Envoi lot ' + (b + 1) + '/' + totalBatches
          + ' (' + Math.min((b + 1) * BATCH_SIZE, questions.length) + '/' + questions.length + ' questions)...';
      }

      await batch.commit();
    }
  }

  // ── Import Handler ──
  window.adminImportHandler = async function(){
    var fileInput = document.getElementById('admin-import-file');
    var formatSel = document.getElementById('admin-import-format');
    var statusEl  = document.getElementById('admin-import-status');

    if (!fileInput || !fileInput.files.length) {
      alert('Veuillez sélectionner un fichier.'); return;
    }

    var file   = fileInput.files[0];
    var format = formatSel ? formatSel.value : 'json';

    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.style.color   = 'var(--text2)';
      statusEl.textContent   = '⏳ Lecture du fichier...';
    }

    var reader = new FileReader();
    reader.onload = async function(e) {
      try {
        var raw       = e.target.result;
        var questions = normalizeImport(raw, format);

        if (!questions.length) {
          alert('Aucune question valide trouvée.\nVérifiez que chaque entrée a un champ "cat".');
          if (statusEl) statusEl.style.display = 'none';
          return;
        }

        // Résumé par groupe/catégorie
        var byGroup = {};
        questions.forEach(function(q) {
          var g = q.group || '(sans groupe)';
          byGroup[g] = (byGroup[g] || 0) + 1;
        });
        var byCat = {};
        questions.forEach(function(q) {
          var c = q.cat || '?';
          byCat[c] = (byCat[c] || 0) + 1;
        });

        var msg = '📥 Import de ' + questions.length + ' question(s) en ' + Object.keys(byCat).length + ' catégorie(s)\n\n';
        msg += '📂 Par groupe :\n';
        Object.keys(byGroup).forEach(function(g){ msg += '   • ' + g + ' : ' + byGroup[g] + ' questions\n'; });
        msg += '\n⚠️ L\'IMPORT VA ÉCRASER LES QUESTIONS EXISTANTES DANS FIRESTORE.\nContinuer ?';

        if (!confirm(msg)) {
          if (statusEl) statusEl.style.display = 'none';
          return;
        }

        // Envoi par lots
        await batchWriteQuestions(questions, statusEl);

        // Mise à jour mémoire locale (CATS + GROUPS)
        if (typeof window.fbBuildCatsFromQuestions === 'function') {
          window.fbBuildCatsFromQuestions(questions);
        }

        var resultMsg = '✅ Import terminé ! ' + questions.length + ' questions envoyées en '
          + Math.ceil(questions.length / 400) + ' lot(s).';
        if (statusEl) { statusEl.textContent = resultMsg; statusEl.style.color = '#4ade80'; }
        alert(resultMsg);

      } catch(err) {
        console.error('Import error:', err);
        if (statusEl) { statusEl.textContent = '❌ Erreur : ' + err.message; statusEl.style.color = '#f87171'; }
        alert('❌ Import échoué : ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  // ── Export Handler : exporte window.CATS au format tableau plat (compatible v2) ──
  window.adminExportHandler = function(){
    var cats = window.CATS || {};
    var keys = Object.keys(cats).filter(function(k){ return k !== 'mix'; });
    if (!keys.length) { alert('Aucune catégorie en mémoire.'); return; }

    var exportData = [];
    var totalQ = 0;
    keys.forEach(function(k) {
      var cat = cats[k];
      (cat.qs || []).forEach(function(q) {
        var copy = Object.assign({}, q);
        delete copy._cat;
        exportData.push(copy);
        totalQ++;
      });
    });

    var json = JSON.stringify(exportData, null, 2);
    var blob = new Blob([json], { type: 'application/json' });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href   = url;
    a.download = 'quizztssr_questions_v2_' + new Date().toISOString().slice(0,10) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    alert('✅ Export terminé ! ' + totalQ + ' question(s) exportées.');
  };

  // ── UI injection dans le panneau admin ──
  window.injectImportUI = function(){
    var panel = document.getElementById('admin-panel-body');
    if (!panel) return;
    if (document.getElementById('admin-import-section')) return;

    var container = document.createElement('div');
    container.id  = 'admin-import-section';
    container.style.cssText = 'margin-top:16px;';

    container.innerHTML =
      '<div style="font-family:monospace;font-size:8px;color:var(--dim);letter-spacing:2px;margin-bottom:10px;">IMPORT / EXPORT — COLLECTION "questions"</div>' +
      '<div style="background:var(--panel);border:1.5px solid var(--border2);border-radius:8px;padding:12px;">' +
        '<div style="font-family:monospace;font-size:9px;color:var(--text);margin-bottom:6px;">📥 Importer questions (JSON v2 · JSON export · CSV)</div>' +
        '<div style="font-family:monospace;font-size:8px;color:var(--text2);margin-bottom:10px;line-height:1.6;">' +
          '• JSON v2 : tableau plat [{cat, group, q, ...}]<br>' +
          '• JSON export : {catId:{label,qs:[...]}}<br>' +
          '• Écriture dans Firestore par lots de 400<br>' +
          '<span style="color:#f87171;">⚠️ Écrase les questions existantes</span>' +
        '</div>' +
        '<div style="display:flex;flex-direction:column;gap:8px;">' +
          '<input id="admin-import-file" type="file" accept=".json,.csv" style="font-family:monospace;font-size:9px;color:var(--text);background:var(--bg2);border:1px solid var(--border2);border-radius:4px;padding:6px;" />' +
          '<select id="admin-import-format" style="font-family:monospace;font-size:9px;color:var(--text);background:var(--bg2);border:1px solid var(--border2);border-radius:4px;padding:6px;">' +
            '<option value="json">Format JSON (v2 plat ou export)</option>' +
            '<option value="csv">Format CSV</option>' +
          '</select>' +
          '<div style="display:flex;gap:6px;">' +
            '<button onclick="adminImportHandler()" style="flex:1;background:var(--acc);color:var(--bg);border:none;border-radius:6px;padding:10px 16px;font-family:monospace;font-size:9px;cursor:pointer;letter-spacing:1px;">📥 IMPORTER VERS FIRESTORE</button>' +
            '<button onclick="adminExportHandler()" style="flex:1;background:none;color:var(--acc);border:1.5px solid var(--acc);border-radius:6px;padding:10px 16px;font-family:monospace;font-size:9px;cursor:pointer;letter-spacing:1px;">📤 EXPORTER JSON</button>' +
          '</div>' +
          '<div id="admin-import-status" style="font-family:monospace;font-size:9px;color:var(--text2);display:none;padding:8px;background:var(--bg2);border-radius:4px;"></div>' +
        '</div>' +
      '</div>';

    panel.appendChild(container);
  };

})();
