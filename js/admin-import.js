// admin-import.js – Import / Export de questions pour le panneau admin
// Gère : JSON (format export ou tableau plat) et CSV
// Auto-détecte les catégories : ajoute aux existantes ou crée les nouvelles

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

  // ── Normalise un JSON importé en { catId: { label, icon, qs: [...] } } ──
  function normalizeImport(parsed, format) {
    var result = {}; // catId → { label, icon, qs }

    if (format === 'csv') {
      // CSV : chaque ligne a un champ "cat" ou "category"
      var rows = parseCSV(parsed);
      rows.forEach(function(row) {
        var catId = (row.cat || row.category || '').trim();
        if (!catId) return;
        if (!result[catId]) result[catId] = { label: catId, icon: '', qs: [] };
        var q = {};
        Object.keys(row).forEach(function(k) {
          if (k === 'cat' || k === 'category') return;
          // Try to parse JSON values (for arrays like options)
          try { q[k] = JSON.parse(row[k]); } catch(e) { q[k] = row[k]; }
        });
        result[catId].qs.push(q);
      });
      return result;
    }

    // JSON
    var data = JSON.parse(parsed);

    // Format 1 : format export { catId: { label, icon, questions: [...] } }
    if (!Array.isArray(data) && typeof data === 'object') {
      var keys = Object.keys(data);
      // Check if it looks like export format (values have "questions" or "qs" arrays)
      var isExportFormat = keys.some(function(k) {
        var v = data[k];
        return v && typeof v === 'object' && (Array.isArray(v.questions) || Array.isArray(v.qs));
      });

      if (isExportFormat) {
        keys.forEach(function(catId) {
          if (catId === 'mix') return;
          var cat = data[catId];
          var qs = cat.questions || cat.qs || [];
          // Nettoyer les questions
          qs = qs.map(function(q) {
            var copy = Object.assign({}, q);
            delete copy._cat;
            return copy;
          });
          result[catId] = {
            label: cat.label || cat.name || catId,
            icon: cat.icon || '',
            qs: qs
          };
        });
        return result;
      }
    }

    // Format 2 : tableau plat [{ q, o, a, cat, ... }, ...]
    var items = Array.isArray(data) ? data : [data];
    items.forEach(function(item) {
      var catId = (item.cat || item.category || '').trim();
      if (!catId) return;
      if (!result[catId]) result[catId] = { label: catId, icon: '', qs: [] };
      var q = Object.assign({}, item);
      delete q.cat;
      delete q.category;
      delete q._cat;
      result[catId].qs.push(q);
    });

    return result;
  }

  // ── Import Handler ──
  window.adminImportHandler = async function(){
    var fileInput = document.getElementById('admin-import-file');
    var formatSel = document.getElementById('admin-import-format');
    var statusEl  = document.getElementById('admin-import-status');

    if (!fileInput || !fileInput.files.length) {
      alert('Veuillez sélectionner un fichier.'); return;
    }

    var file = fileInput.files[0];
    var format = formatSel ? formatSel.value : 'json';

    // Show status
    if (statusEl) { statusEl.style.display = 'block'; statusEl.style.color = 'var(--text2)'; statusEl.textContent = '⏳ Lecture du fichier...'; }

    var reader = new FileReader();
    reader.onload = async function(e) {
      try {
        var raw = e.target.result;
        var grouped = normalizeImport(raw, format);
        var catIds = Object.keys(grouped);

        if (!catIds.length) {
          alert('Aucune question valide trouvée dans le fichier.\nVérifiez que chaque question a un champ "cat" ou "category".');
          if (statusEl) statusEl.style.display = 'none';
          return;
        }

        // Count totals
        var totalQ = 0;
        catIds.forEach(function(k){ totalQ += grouped[k].qs.length; });

        // Confirm
        var newCats = catIds.filter(function(k){ return !window.CATS || !window.CATS[k]; });
        var existingCats = catIds.filter(function(k){ return window.CATS && window.CATS[k]; });

        var msg = '📥 Import de ' + totalQ + ' question(s) dans ' + catIds.length + ' catégorie(s) :\n\n';
        if (existingCats.length) {
          msg += '➕ Ajout aux catégories existantes :\n';
          existingCats.forEach(function(k){
            var label = (window.CATS[k].label || k);
            msg += '   • ' + label + ' (+' + grouped[k].qs.length + ' questions)\n';
          });
        }
        if (newCats.length) {
          msg += '\n🆕 Nouvelles catégories à créer :\n';
          newCats.forEach(function(k){
            msg += '   • ' + (grouped[k].label || k) + ' (' + grouped[k].qs.length + ' questions)\n';
          });
        }
        msg += '\nContinuer ?';

        if (!confirm(msg)) {
          if (statusEl) statusEl.style.display = 'none';
          return;
        }

        // Firebase refs
        var db = window._fbDb;
        var setDocFn = window._fbSetDoc;
        var docFn = window._fbDoc;
        if (!db || !setDocFn || !docFn) {
          throw new Error('Firebase non initialisé.');
        }

        var created = 0, updated = 0;

        for (var i = 0; i < catIds.length; i++) {
          var catId = catIds[i];
          var importCat = grouped[catId];

          if (statusEl) statusEl.textContent = '⏳ Traitement ' + (i+1) + '/' + catIds.length + ' : ' + (importCat.label || catId) + '...';

          if (window.CATS && window.CATS[catId]) {
            // ── Catégorie existante → fusionner ──
            var existing = window.CATS[catId];
            var mergedQs = (existing.qs || []).slice(); // copie

            // Ajouter les nouvelles questions
            importCat.qs.forEach(function(newQ) {
              mergedQs.push(newQ);
            });

            // Mettre à jour en mémoire
            existing.qs = mergedQs;

            // Écrire sur Firestore
            var catData = Object.assign({}, existing);
            catData.qs = mergedQs.map(function(q) {
              var copy = Object.assign({}, q);
              delete copy._cat;
              return copy;
            });
            await setDocFn(docFn(db, 'categories', catId), catData);
            updated++;

          } else {
            // ── Nouvelle catégorie → créer ──
            var newCat = {
              label: importCat.label || catId,
              icon: importCat.icon || '📁',
              qs: importCat.qs.map(function(q) {
                var copy = Object.assign({}, q);
                delete copy._cat;
                return copy;
              })
            };

            // Ajouter en mémoire
            if (!window.CATS) window.CATS = {};
            window.CATS[catId] = {
              label: newCat.label,
              icon: newCat.icon,
              qs: newCat.qs.slice()
            };

            // Écrire sur Firestore
            await setDocFn(docFn(db, 'categories', catId), newCat);
            created++;
          }
        }

        // Re-construire la catégorie 'mix'
        if (window.CATS && window.CATS.mix) {
          window.CATS.mix.qs = [];
          var ids = Object.keys(window.CATS).filter(function(k){return k!=='mix';});
          ids.forEach(function(id){
            if (window.CATS[id] && window.CATS[id].qs) {
              window.CATS.mix.qs = window.CATS.mix.qs.concat(window.CATS[id].qs.map(function(q){
                return Object.assign({}, q, {_cat: window.CATS[id].label});
              }));
            }
          });
        }

        // Résultat
        var resultMsg = '✅ Import terminé !\n' + totalQ + ' question(s) importées.\n';
        if (updated) resultMsg += '➕ ' + updated + ' catégorie(s) mise(s) à jour.\n';
        if (created) resultMsg += '🆕 ' + created + ' catégorie(s) créée(s).\n';

        if (statusEl) { statusEl.textContent = resultMsg.replace(/\n/g, ' '); statusEl.style.color = '#4ade80'; }
        alert(resultMsg);

      } catch(err) {
        console.error('Import error:', err);
        if (statusEl) { statusEl.textContent = '❌ Erreur: ' + err.message; statusEl.style.color = '#f87171'; }
        alert('❌ Import échoué : ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  // ── Export Handler ──
  window.adminExportHandler = function(){
    var cats = window.CATS || {};
    var keys = Object.keys(cats).filter(function(k){ return k !== 'mix'; });
    if (!keys.length) { alert('Aucune catégorie trouvée.'); return; }

    var exportData = {};
    var totalQ = 0;
    keys.forEach(function(k) {
      var cat = cats[k];
      var qs = (cat.qs || []).map(function(q) {
        var copy = Object.assign({}, q);
        delete copy._cat;
        return copy;
      });
      exportData[k] = {
        label: cat.label || cat.name || k,
        icon: cat.icon || '',
        questions: qs
      };
      totalQ += qs.length;
    });

    var json = JSON.stringify(exportData, null, 2);
    var blob = new Blob([json], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'quizztssr_questions_' + new Date().toISOString().slice(0,10) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    alert('✅ Export terminé ! ' + totalQ + ' question(s) dans ' + keys.length + ' catégorie(s).');
  };

  // ── UI injection ──
  window.injectImportUI = function(){
    var panel = document.getElementById('admin-panel-body');
    if (!panel) return;
    if (document.getElementById('admin-import-section')) return;

    var container = document.createElement('div');
    container.id = 'admin-import-section';
    container.style.cssText = 'margin-top:16px;';

    container.innerHTML =
      '<div style="font-family:monospace;font-size:8px;color:var(--dim);letter-spacing:2px;margin-bottom:10px;">IMPORT / EXPORT DE QUESTIONS</div>' +
      '<div style="background:var(--panel);border:1.5px solid var(--border2);border-radius:8px;padding:12px;">' +
        '<div style="font-family:monospace;font-size:9px;color:var(--text);margin-bottom:8px;">📥 Importer des questions (JSON / CSV)</div>' +
        '<div style="font-family:monospace;font-size:8px;color:var(--text2);margin-bottom:10px;line-height:1.5;">' +
          '• Les catégories sont détectées depuis le fichier<br>' +
          '• Catégorie existante → questions ajoutées<br>' +
          '• Nouvelle catégorie → créée automatiquement' +
        '</div>' +
        '<div style="display:flex;flex-direction:column;gap:8px;">' +
          '<input id="admin-import-file" type="file" accept=".json,.csv" style="font-family:monospace;font-size:9px;color:var(--text);background:var(--bg2);border:1px solid var(--border2);border-radius:4px;padding:6px;" />' +
          '<select id="admin-import-format" style="font-family:monospace;font-size:9px;color:var(--text);background:var(--bg2);border:1px solid var(--border2);border-radius:4px;padding:6px;">' +
            '<option value="json">Format JSON</option>' +
            '<option value="csv">Format CSV</option>' +
          '</select>' +
          '<div style="display:flex;gap:6px;">' +
            '<button onclick="adminImportHandler()" style="flex:1;background:var(--acc);color:var(--bg);border:none;border-radius:6px;padding:10px 16px;font-family:monospace;font-size:9px;cursor:pointer;letter-spacing:1px;">📥 IMPORTER</button>' +
            '<button onclick="adminExportHandler()" style="flex:1;background:none;color:var(--acc);border:1.5px solid var(--acc);border-radius:6px;padding:10px 16px;font-family:monospace;font-size:9px;cursor:pointer;letter-spacing:1px;">📤 EXPORTER JSON</button>' +
          '</div>' +
          '<div id="admin-import-status" style="font-family:monospace;font-size:9px;color:var(--text2);display:none;"></div>' +
        '</div>' +
      '</div>';

    panel.appendChild(container);
  };

})();
