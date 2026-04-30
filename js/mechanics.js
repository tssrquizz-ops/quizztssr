// ─── mechanics.js — Mécaniques de rendu ───
// ============================================================
// MÉCANIQUE TYPE — Saisie libre
// ============================================================
function normalizeStr(s){
  return String(s).toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/\s+/g,' ')
    .replace(/[.,;:!?'"]/g,'');
}
function renderType(q,area){
  var wrap=document.createElement('div');wrap.className='type-wrap';
  var input=document.createElement('input');
  input.type='text';input.className='type-input';
  input.placeholder='Tape ta réponse ici...';input.id='type-input';
  input.autocomplete='off';input.autocorrect='off';input.spellcheck=false;
  var btn=document.createElement('button');btn.className='type-submit-btn';btn.textContent='✓ VALIDER';
  var hint=document.createElement('div');hint.className='type-hint';hint.textContent='⌨ Entrée ou clic pour valider';
  function doSubmit(){if(answered)return;var v=input.value.trim();if(!v)return;resolveType(v,input,q);}
  btn.onclick=doSubmit;
  input.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();doSubmit();}});
  wrap.appendChild(input);wrap.appendChild(btn);wrap.appendChild(hint);
  area.appendChild(wrap);
  setTimeout(function(){input.focus();},80);
}
function resolveType(val,input,q){
  clearInterval(timerInt);answered=true;
  input.disabled=true;
  var btns=document.querySelectorAll('.type-submit-btn');btns.forEach(function(b){b.disabled=true;});
  var nVal=normalizeStr(val);
  var accepted=Array.isArray(q.a)?q.a.slice():[q.a];
  if(q.aliases) accepted=accepted.concat(q.aliases);
  var ok=accepted.some(function(a){return normalizeStr(a)===nVal;});
  input.className='type-input '+(ok?'ok-input':'err-input');
  if(!ok){
    var correct=Array.isArray(q.a)?q.a[0]:q.a;
    var reveal=document.createElement('div');reveal.className='type-correct-reveal';reveal.textContent='✓ Réponse attendue : '+correct;
    input.parentNode.appendChild(reveal);
    errors.push({q:q.q,yours:val,correct:correct,x:q.x,orig:q,mech:'type'});
  }
  resolveCommon(ok,q);
}

// ============================================================
// MÉCANIQUE SLIDER — Curseur numérique
// ============================================================
function renderSlider(q,area){
  var wrap=document.createElement('div');wrap.className='slider-wrap';
  var midVal=Math.round((q.min+q.max)/2);
  var display=document.createElement('div');display.className='slider-display';display.id='slider-display';
  display.innerHTML=midVal+(q.unit?'<span class="slider-unit">'+q.unit+'</span>':'');
  var track=document.createElement('div');track.className='slider-track';
  var slider=document.createElement('input');slider.type='range';slider.className='slider-input';
  slider.min=q.min;slider.max=q.max;slider.step=q.step||1;slider.value=midVal;slider.id='slider-input';
  var bounds=document.createElement('div');bounds.className='slider-bounds';
  bounds.innerHTML='<span>'+q.min+(q.unit?' '+q.unit:'')+'</span><span>'+q.max+(q.unit?' '+q.unit:'')+'</span>';
  slider.oninput=function(){
    var v=parseInt(slider.value);
    display.innerHTML=v+(q.unit?'<span class="slider-unit">'+q.unit+'</span>':'');
  };
  var btn=document.createElement('button');btn.className='slider-submit-btn';btn.textContent='✓ CONFIRMER';
  btn.onclick=function(){if(!answered)resolveSlider(parseInt(slider.value),display,slider,q);};
  track.appendChild(slider);track.appendChild(bounds);
  wrap.appendChild(display);wrap.appendChild(track);wrap.appendChild(btn);
  area.appendChild(wrap);
}
function resolveSlider(val,display,slider,q){
  clearInterval(timerInt);answered=true;slider.disabled=true;
  var btns=document.querySelectorAll('.slider-submit-btn');btns.forEach(function(b){b.disabled=true;});
  var tol=q.tolerance||0;var ok=Math.abs(val-q.a)<=tol;
  display.className='slider-display '+(ok?'ok-val':'err-val');
  if(!ok){
    display.innerHTML=val+(q.unit?'<span class="slider-unit">'+q.unit+'</span>':'')+' &nbsp;<span style="font-size:14px;color:var(--text2)">→ réponse : '+q.a+(q.unit?' '+q.unit:'')+'</span>';
    errors.push({q:q.q,yours:String(val),correct:String(q.a),x:q.x,orig:q,mech:'slider'});
  }
  resolveCommon(ok,q);
}

// ============================================================
// MÉCANIQUE SCRAMBLE — Anagramme tuiles
// ============================================================
var _scrUserAns=[],_scrTokens=[];
function renderScramble(q,area){
  _scrUserAns=[];_scrTokens=[];
  var isLetters=!q.word.includes(' ');
  var tokens=isLetters?q.word.toUpperCase().split(''):q.word.toUpperCase().split(' ');
  _scrTokens=shuffle(tokens.map(function(v,i){return{id:i,val:v};}));
  if(q.hint){var h=document.createElement('div');h.className='scramble-hint';h.textContent='💡 '+q.hint;area.appendChild(h);}
  var lbl1=document.createElement('div');lbl1.className='scramble-zone-label';lbl1.textContent=isLetters?'Ta réponse (clique pour retirer)':'Tes mots (clique pour retirer)';area.appendChild(lbl1);
  var ansZone=document.createElement('div');ansZone.className='scramble-answer-zone';ansZone.id='scr-ans-zone';
  var empty=document.createElement('span');empty.className='scramble-answer-zone-empty';empty.id='scr-empty';empty.textContent='Clique les tuiles ci-dessous →';ansZone.appendChild(empty);
  area.appendChild(ansZone);
  var lbl2=document.createElement('div');lbl2.className='scramble-zone-label';lbl2.textContent='Tuiles disponibles';area.appendChild(lbl2);
  var pool=document.createElement('div');pool.className='scramble-pool';pool.id='scr-pool';
  _scrTokens.forEach(function(t){
    var tile=document.createElement('div');tile.className='scr-tile';tile.textContent=t.val;tile.id='scrtile-'+t.id;
    (function(tok,tileEl){
      tileEl.onclick=function(){
        if(answered||tileEl.classList.contains('scr-placed'))return;
        _scrUserAns.push(tok);tileEl.classList.add('scr-placed');
        var emptyEl=document.getElementById('scr-empty');if(emptyEl)emptyEl.style.display='none';
        addScrTileToAnswer(tok,ansZone,tileEl);
      };
    })(t,tile);
    pool.appendChild(tile);
  });
  area.appendChild(pool);
  var vbtn=document.createElement('button');vbtn.className='validate-btn';vbtn.textContent="✓ VALIDER L'ORDRE";
  vbtn.onclick=function(){validateScramble(q,ansZone,isLetters);};
  area.appendChild(vbtn);
}
function addScrTileToAnswer(tok,ansZone,srcTile){
  var t=document.createElement('div');t.className='scr-tile scr-ans';t.textContent=tok.val;
  t.onclick=function(){
    if(answered)return;
    var idx=_scrUserAns.findIndex(function(x){return x.id===tok.id;});
    if(idx>-1)_scrUserAns.splice(idx,1);
    ansZone.removeChild(t);srcTile.classList.remove('scr-placed');
    if(ansZone.querySelectorAll('.scr-tile').length===0){
      var emptyEl=document.getElementById('scr-empty');if(emptyEl)emptyEl.style.display='';
    }
  };
  ansZone.appendChild(t);
}
function validateScramble(q,ansZone,isLetters){
  if(answered)return;answered=true;clearInterval(timerInt);
  var correct=q.word.toUpperCase();
  var user=isLetters?_scrUserAns.map(function(t){return t.val;}).join(''):_scrUserAns.map(function(t){return t.val;}).join(' ');
  var ok=(user===correct);
  ansZone.className='scramble-answer-zone '+(ok?'ok-zone':'err-zone');
  if(!ok){errors.push({q:q.q,yours:user||'(incomplet)',correct:q.word,x:q.x,orig:q,mech:'scramble'});}
  resolveCommon(ok,q);
}


// ============================================================
// MÉCANIQUE MULTIBLANK — Plusieurs trous dans une config
// ============================================================
var _mbkState = {}; // {blankId: selectedOptIdx}

function renderMultiblank(q, area) {
  _mbkState = {};
  // Build code block with clickable blanks
  var codeDiv = document.createElement('div');
  codeDiv.className = 'mbk-code';
  codeDiv.id = 'mbk-code';

  // Replace ___N___ with span placeholders
  var codeHtml = q.code;
  q.blanks.forEach(function(b, i) {
    var ph = '___' + (i+1) + '___';
    codeHtml = codeHtml.replace(
      ph,
      '<span class="mbk-blank" id="mbk-blank-' + i + '" data-bidx="' + i + '">?</span>'
    );
  });
  codeDiv.innerHTML = codeHtml;
  area.appendChild(codeDiv);

  // Groups of options for each blank
  var groups = document.createElement('div');
  groups.className = 'mbk-groups';
  q.blanks.forEach(function(b, i) {
    var grp = document.createElement('div');
    grp.className = 'mbk-group';
    var lbl = document.createElement('div');
    lbl.className = 'mbk-group-lbl';
    lbl.innerHTML = '<span class="mbk-group-num">' + (i+1) + '</span>' + (b.label || 'Complète le blanc ' + (i+1));
    var row = document.createElement('div');
    row.className = 'mbk-opts-row';
    var shuffled = shuffle(b.opts.map(function(o, oi) { return {t:o, i:oi}; }));
    shuffled.forEach(function(opt) {
      var btn = document.createElement('button');
      btn.className = 'mbk-opt';
      btn.textContent = opt.t;
      btn.setAttribute('data-bidx', i);
      btn.setAttribute('data-orig', opt.i);
      (function(blankIdx, optIdx, btnEl, optTxt) {
        btnEl.onclick = function() {
          if (answered) return;
          // Deselect others in same group
          row.querySelectorAll('.mbk-opt').forEach(function(x) { x.classList.remove('mbk-sel'); });
          btnEl.classList.add('mbk-sel');
          _mbkState[blankIdx] = optIdx;
          // Update blank display
          var blankSpan = document.getElementById('mbk-blank-' + blankIdx);
          if (blankSpan) { blankSpan.textContent = optTxt; blankSpan.classList.add('mbk-filled'); }
        };
      })(i, opt.i, btn, opt.t);
      row.appendChild(btn);
    });
    grp.appendChild(lbl);
    grp.appendChild(row);
    groups.appendChild(grp);
  });
  area.appendChild(groups);

  // Validate button
  var vbtn = document.createElement('button');
  vbtn.className = 'mbk-validate';
  vbtn.textContent = '✓ VALIDER LA CONFIG';
  vbtn.onclick = function() { validateMultiblank(q); };
  area.appendChild(vbtn);
}

function validateMultiblank(q) {
  if (answered) return;
  // Check all blanks filled
  var allFilled = q.blanks.every(function(_, i) { return _mbkState[i] !== undefined; });
  if (!allFilled) {
    // Flash un message
    var msg = document.createElement('div');
    msg.style.cssText = 'font-family:monospace;font-size:9px;color:#ff9800;margin-bottom:6px;text-align:center;letter-spacing:1px;';
    msg.textContent = '⚠ Remplis tous les blancs avant de valider';
    var vbtn = document.querySelector('.mbk-validate');
    if (vbtn) vbtn.parentNode.insertBefore(msg, vbtn);
    setTimeout(function() { if (msg.parentNode) msg.parentNode.removeChild(msg); }, 2000);
    return;
  }
  clearInterval(timerInt);
  answered = true;

  var allOk = true;
  q.blanks.forEach(function(b, i) {
    var userChoice = _mbkState[i];
    var isOk = (userChoice === b.a);
    if (!isOk) allOk = false;
    // Mark blank
    var blankSpan = document.getElementById('mbk-blank-' + i);
    if (blankSpan) blankSpan.classList.add(isOk ? 'mbk-ok' : 'mbk-err');
    // Mark opts
    var group = document.querySelectorAll('.mbk-group')[i];
    if (group) {
      group.querySelectorAll('.mbk-opt').forEach(function(btn) {
        btn.disabled = true;
        var oi = parseInt(btn.getAttribute('data-orig'));
        if (oi === b.a) btn.classList.add('mbk-opt-ok');
        else if (btn.classList.contains('mbk-sel') && oi !== b.a) btn.classList.add('mbk-opt-err');
      });
    }
  });
  if (!allOk) {
    var correctStr = q.blanks.map(function(b) { return b.opts[b.a]; }).join(' | ');
    errors.push({q:q.q, yours:'Config incomplète', correct:correctStr, x:q.x, orig:q, mech:'multiblank'});
  }
  resolveCommon(allOk, q);
}

// ============================================================
// MÉCANIQUE CATEGORIZE — Trier des chips dans des colonnes
// ============================================================
var _catSelected = null; // chip currently selected
var _catPlacements = {}; // {chipId: colIdx}

function renderCategorize(q, area) {
  _catSelected = null;
  _catPlacements = {};

  // Pool label
  var poolLbl = document.createElement('div');
  poolLbl.className = 'cat-pool-lbl';
  poolLbl.textContent = 'Éléments à classer';
  area.appendChild(poolLbl);

  // Pool of chips
  var pool = document.createElement('div');
  pool.className = 'cat-pool';
  pool.id = 'cat-pool';
  var shuffledItems = shuffle(q.items.map(function(item, i) { return {label:item, id:i, col:q.answers[i]}; }));

  shuffledItems.forEach(function(item) {
    var chip = document.createElement('div');
    chip.className = 'cat-chip';
    chip.textContent = item.label;
    chip.id = 'cat-chip-' + item.id;
    chip.setAttribute('data-cid', item.id);
    (function(chipEl, itm) {
      chipEl.onclick = function() {
        if (answered) return;
        if (_catSelected && _catSelected.id === 'cat-chip-' + itm.id) {
          // Deselect
          chipEl.classList.remove('cat-chip-selected');
          _catSelected = null;
        } else {
          // Select
          document.querySelectorAll('.cat-chip').forEach(function(c) { c.classList.remove('cat-chip-selected'); });
          chipEl.classList.add('cat-chip-selected');
          _catSelected = {id: 'cat-chip-' + itm.id, itemId: itm.id};
        }
      };
    })(chip, item);
    pool.appendChild(chip);
  });
  area.appendChild(pool);

  // Columns
  var ncols = q.categories.length;
  var cols = document.createElement('div');
  cols.className = 'cat-cols';
  cols.style.gridTemplateColumns = 'repeat(' + ncols + ', 1fr)';
  area.appendChild(cols);

  q.categories.forEach(function(catName, ci) {
    var col = document.createElement('div');
    col.className = 'cat-col';
    col.id = 'cat-col-' + ci;
    var header = document.createElement('div');
    header.className = 'cat-col-header';
    header.innerHTML = catName + '<span style="font-size:10px;opacity:.5">↓</span>';
    var body = document.createElement('div');
    body.className = 'cat-col-body';
    body.id = 'cat-col-body-' + ci;

    (function(colIdx, colEl, bodyEl, headEl) {
      var clickHandler = function() {
        if (answered || !_catSelected) return;
        var itemId = _catSelected.itemId;
        var chipEl = document.getElementById('cat-chip-' + itemId);
        // Remove from previous col if already placed
        if (_catPlacements[itemId] !== undefined) {
          var prevBody = document.getElementById('cat-col-body-' + _catPlacements[itemId]);
          if (prevBody) {
            var toRemove = prevBody.querySelector('[data-placed-id="' + itemId + '"]');
            if (toRemove) prevBody.removeChild(toRemove);
          }
        }
        // Place in this col
        _catPlacements[itemId] = colIdx;
        if (chipEl) { chipEl.classList.add('cat-chip-placed'); chipEl.classList.remove('cat-chip-selected'); }

        // Create placed chip in column
        var placed = document.createElement('div');
        placed.className = 'cat-col-chip';
        placed.textContent = chipEl ? chipEl.textContent : '';
        placed.setAttribute('data-placed-id', itemId);
        (function(pid, placedEl) {
          placedEl.onclick = function() {
            if (answered) return;
            // Return to pool
            delete _catPlacements[pid];
            var origChip = document.getElementById('cat-chip-' + pid);
            if (origChip) { origChip.classList.remove('cat-chip-placed'); }
            bodyEl.removeChild(placedEl);
          };
        })(itemId, placed);
        bodyEl.appendChild(placed);
        _catSelected = null;

        // Highlight active col
        document.querySelectorAll('.cat-col').forEach(function(c) { c.classList.remove('cat-col-target'); });
      };
      headEl.onclick = clickHandler;
      colEl.onclick = function(e) {
        if (e.target === colEl || e.target === bodyEl) clickHandler();
        // Highlight on hover if chip selected
      };
    })(ci, col, body, header);

    col.appendChild(header);
    col.appendChild(body);
    cols.appendChild(col);
  });

  // Highlight cols when chip selected
  pool.addEventListener('click', function() {
    setTimeout(function() {
      document.querySelectorAll('.cat-col').forEach(function(c) {
        c.classList.toggle('cat-col-target', !!_catSelected);
      });
    }, 20);
  });

  // Validate
  var vbtn = document.createElement('button');
  vbtn.className = 'cat-validate';
  vbtn.textContent = '✓ VALIDER LE TRI';
  vbtn.onclick = function() { validateCategorize(q, shuffledItems); };
  area.appendChild(vbtn);
}

function validateCategorize(q, shuffledItems) {
  if (answered) return;
  var allPlaced = shuffledItems.every(function(item) { return _catPlacements[item.id] !== undefined; });
  if (!allPlaced) {
    var msg = document.createElement('div');
    msg.style.cssText = 'font-family:monospace;font-size:9px;color:#ff9800;margin-bottom:6px;text-align:center;';
    msg.textContent = '⚠ Place tous les éléments avant de valider';
    var vbtn = document.querySelector('.cat-validate');
    if (vbtn) vbtn.parentNode.insertBefore(msg, vbtn);
    setTimeout(function() { if (msg.parentNode) msg.parentNode.removeChild(msg); }, 2000);
    return;
  }
  clearInterval(timerInt);
  answered = true;

  var allOk = true;
  shuffledItems.forEach(function(item) {
    var userCol = _catPlacements[item.id];
    var correctCol = item.col;
    var isOk = (userCol === correctCol);
    if (!isOk) allOk = false;
    // Find placed chip and color it
    var body = document.getElementById('cat-col-body-' + userCol);
    if (body) {
      var placed = body.querySelector('[data-placed-id="' + item.id + '"]');
      if (placed) {
        placed.style.borderColor = isOk ? '#00d87a' : '#dc2626';
        placed.style.color = isOk ? '#00a85a' : '#dc2626';
        placed.style.background = isOk ? 'rgba(0,216,122,.12)' : 'rgba(220,38,38,.1)';
        placed.style.cursor = 'default';
        placed.onclick = null;
      }
    }
    // If wrong, show correct col
    if (!isOk) {
      var correctBody = document.getElementById('cat-col-body-' + correctCol);
      if (correctBody) {
        var corrLabel = document.createElement('div');
        corrLabel.style.cssText = 'font-size:9px;color:#00a85a;font-family:monospace;padding:2px 8px;border:1px dashed #00d87a;border-radius:12px;';
        corrLabel.textContent = '✓ ' + item.label;
        correctBody.appendChild(corrLabel);
      }
    }
    // Color col headers
    var colEl = document.getElementById('cat-col-' + userCol);
    if (colEl && !isOk) colEl.classList.add('cat-col-err');
  });

  var wrongItems = shuffledItems.filter(function(item) {
    return _catPlacements[item.id] !== item.col;
  });
  if (!allOk) {
    errors.push({
      q: q.q,
      yours: wrongItems.map(function(i) { return i.label + ' → ' + q.categories[_catPlacements[i.id]]; }).join(', '),
      correct: wrongItems.map(function(i) { return i.label + ' → ' + q.categories[i.col]; }).join(', '),
      x: q.x, orig: q, mech: 'categorize'
    });
  }
  resolveCommon(allOk, q);
}

// ============================================================
// MÉCANIQUE HOTSPOT — Schéma réseau annoté
// ============================================================
var _hsAnswers = {}; // {zoneIdx: chosen optIdx}
var _hsActiveZone = null;

function renderHotspot(q, area) {
  _hsAnswers = {};
  _hsActiveZone = null;

  // Diagram
  var diagDiv = document.createElement('div');
  diagDiv.className = 'hs-diagram';
  var diagHtml = q.diagram;
  q.zones.forEach(function(z, i) {
    diagHtml = diagHtml.replace(
      '[' + (i+1) + ']',
      '<span class="hs-marker" id="hs-m-' + i + '" onclick="hsClickMarker(' + i + ')">[' + (i+1) + ']</span>'
    );
  });
  diagDiv.innerHTML = diagHtml;
  area.appendChild(diagDiv);

  // Progress
  var prog = document.createElement('div');
  prog.className = 'hs-progress';
  prog.id = 'hs-prog';
  prog.textContent = '0 / ' + q.zones.length + ' zones identifiées';
  area.appendChild(prog);

  // Questions per zone
  var qsDiv = document.createElement('div');
  qsDiv.className = 'hs-questions';
  q.zones.forEach(function(z, i) {
    var qrow = document.createElement('div');
    qrow.className = 'hs-qrow';
    qrow.id = 'hs-qrow-' + i;
    var qlbl = document.createElement('div');
    qlbl.className = 'hs-qlbl';
    qlbl.innerHTML = '<span class="hs-qlbl-num">Zone ' + (i+1) + '</span>' + z.q;
    var qtext = document.createElement('div');
    qtext.className = 'hs-qtext';
    qtext.textContent = z.hint || '';
    var optsRow = document.createElement('div');
    optsRow.className = 'hs-opts-row';
    var shuffledOpts = shuffle(z.opts.map(function(o, oi) { return {t:o, i:oi}; }));
    shuffledOpts.forEach(function(opt) {
      var btn = document.createElement('button');
      btn.className = 'hs-opt';
      btn.textContent = opt.t;
      btn.setAttribute('data-zone', i);
      btn.setAttribute('data-orig', opt.i);
      btn.id = 'hs-opt-' + i + '-' + opt.i;
      (function(zi, oi, btnEl) {
        btnEl.onclick = function() {
          if (answered || _hsAnswers[zi] !== undefined) return;
          hsPickAnswer(zi, oi, q);
        };
      })(i, opt.i, btn);
      optsRow.appendChild(btn);
    });
    qrow.appendChild(qlbl);
    if (z.hint) qrow.appendChild(qtext);
    qrow.appendChild(optsRow);
    qsDiv.appendChild(qrow);
  });
  area.appendChild(qsDiv);
}

function hsClickMarker(zi) {
  // Scroll to corresponding qrow
  var qrow = document.getElementById('hs-qrow-' + zi);
  if (qrow) {
    qrow.scrollIntoView({behavior:'smooth', block:'nearest'});
    document.querySelectorAll('.hs-qrow').forEach(function(r) { r.classList.remove('hs-qrow-active'); });
    qrow.classList.add('hs-qrow-active');
    document.querySelectorAll('.hs-marker').forEach(function(m) { m.classList.remove('hs-active'); });
    var marker = document.getElementById('hs-m-' + zi);
    if (marker) marker.classList.add('hs-active');
  }
}

function hsPickAnswer(zi, oi, q) {
  _hsAnswers[zi] = oi;
  var z = q.zones[zi];
  var isOk = (oi === z.a);

  // Mark opts
  var optsRow = document.querySelectorAll('.hs-qrow')[zi].querySelector('.hs-opts-row');
  optsRow.querySelectorAll('.hs-opt').forEach(function(btn) {
    btn.disabled = true;
    var o = parseInt(btn.getAttribute('data-orig'));
    if (o === z.a) btn.classList.add('hs-opt-ok');
    else if (o === oi && !isOk) btn.classList.add('hs-opt-err');
  });

  // Mark qrow
  var qrow = document.getElementById('hs-qrow-' + zi);
  if (qrow) qrow.classList.add(isOk ? 'hs-qrow-done-ok' : 'hs-qrow-done-err');

  // Mark marker
  var marker = document.getElementById('hs-m-' + zi);
  if (marker) {
    marker.className = 'hs-marker ' + (isOk ? 'hs-answered-ok' : 'hs-answered-err');
    marker.textContent = '[' + (zi+1) + '] ' + (isOk ? '✓' : '✗');
  }

  // Update progress
  var done = Object.keys(_hsAnswers).length;
  var prog = document.getElementById('hs-prog');
  if (prog) prog.textContent = done + ' / ' + q.zones.length + ' zones identifiées';

  // If all answered → resolve
  if (done === q.zones.length) {
    clearInterval(timerInt);
    answered = true;
    var wrongZones = q.zones.filter(function(_, i) { return _hsAnswers[i] !== q.zones[i].a; });
    var allOk = wrongZones.length === 0;
    if (!allOk) {
      errors.push({
        q: q.q,
        yours: wrongZones.length + ' zone(s) incorrecte(s)',
        correct: wrongZones.map(function(z, i) {
          var realIdx = q.zones.indexOf(z);
          return 'Zone ' + (realIdx+1) + ' : ' + z.opts[z.a];
        }).join(', '),
        x: q.x, orig: q, mech: 'hotspot'
      });
    }
    resolveCommon(allOk, q);
  }
}


