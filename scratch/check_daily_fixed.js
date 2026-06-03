const fs = require('fs');
const path = require('path');

// Simulate browser environment
global.window = {};
global.document = {
  body: {
    classList: {
      remove: () => {},
      add: () => {},
      contains: () => false
    }
  },
  documentElement: {
    style: {
      removeProperty: () => {},
      setProperty: () => {}
    }
  },
  addEventListener: () => {},
  getElementById: () => null,
  createElement: (tag) => {
    return {
      tagName: tag,
      appendChild: () => {},
      setAttribute: () => {},
      querySelectorAll: () => []
    };
  }
};
global.localStorage = {
  getItem: () => null,
  setItem: () => null
};
global.lsGet = (k, d) => d;
global.lsSet = () => {};
global.CATS = {};

// Load data.js
const dataJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8');
eval(dataJs);

// Sync references
global.CATS = CATS;

// Load bdd_globale.json
const questions = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'bdd_globale.json'), 'utf8'));

// Build CATS using our new firebase-init.js logic
questions.forEach(function(q) {
  var catId = q.cat;
  var groupId = q.group;
  if (!catId) return;

  var cleanQ = Object.assign({}, q);
  delete cleanQ.mech;
  if (!cleanQ.t) cleanQ.t = 'qcm';
  if (cleanQ.d === undefined) cleanQ.d = 1;
  // Apply our new fix
  if (cleanQ.o && !cleanQ.opts) cleanQ.opts = cleanQ.o;
  if (cleanQ.exp && !cleanQ.x) cleanQ.x = cleanQ.exp;

  if (!global.CATS[catId]) {
    global.CATS[catId] = {
      label:      q.catLabel   || catId,
      icon:       q.catIcon    || '📁',
      group:      groupId      || '',
      groupLabel: q.groupLabel || '',
      qs: []
    };
  }
  global.CATS[catId].qs.push(cleanQ);
});

// Rebuild mix
if (global.CATS.mix) {
  global.CATS.mix.qs = [];
  Object.keys(global.CATS).forEach(function(id) {
    if (id === 'mix') return;
    if (global.CATS[id] && global.CATS[id].qs) {
      global.CATS.mix.qs = global.CATS.mix.qs.concat(
        global.CATS[id].qs.map(function(q) {
          return Object.assign({}, q, {_cat: global.CATS[id].label});
        })
      );
    }
  });
}

// Load game.js with getDailyQuestion exposed & instrumented
let gameJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'game.js'), 'utf8');
const instrumentedGetDailyQuestion = `
global.getDailyQuestion = function() {
  console.log('[Inside getDailyQuestion] CATS keys:', Object.keys(CATS));
  console.log('[Inside getDailyQuestion] reseau questions count:', CATS.reseau && CATS.reseau.qs ? CATS.reseau.qs.length : 'N/A');
  var dayNum=Math.floor(Date.now()/86400000);
  var hardQs=[];
  Object.keys(CATS).forEach(function(k){
    if(k==='mix') return;
    if(!CATS[k] || !CATS[k].qs) return;
    CATS[k].qs.filter(function(q){ return q.d===3 && q.t==='qcm' && q.opts && q.opts.length >= 2; }).forEach(function(q){
      hardQs.push(Object.assign({},q,{_cat:CATS[k].label}));
    });
  });
  console.log('[Inside getDailyQuestion] hardQs d=3 count:', hardQs.length);
  // Fallback : si aucune question de niveau 3, prendre n'importe quelle QCM avec opts
  if(!hardQs.length){
    Object.keys(CATS).forEach(function(k){
      if(k==='mix') return;
      if(!CATS[k] || !CATS[k].qs) return;
      CATS[k].qs.filter(function(q){ return q.t==='qcm' && q.opts && q.opts.length >= 2; }).forEach(function(q){
        hardQs.push(Object.assign({},q,{_cat:CATS[k].label}));
      });
    });
  }
  console.log('[Inside getDailyQuestion] total hardQs count:', hardQs.length);
  if(!hardQs.length) return null;
  return hardQs[dayNum % hardQs.length];
}
`;

// Replace getDailyQuestion
const startIdx = gameJs.indexOf('function getDailyQuestion(){');
const endIdx = gameJs.indexOf('function buildDailyWidget(){');
gameJs = gameJs.substring(0, startIdx) + instrumentedGetDailyQuestion + gameJs.substring(endIdx);

eval(gameJs);

try {
  const q = global.getDailyQuestion();
  console.log('SUCCESS! Question found:', q ? q.q : 'null');
  console.log('Question difficulty (d):', q ? q.d : 'N/A');
  console.log('Question options (opts):', q ? q.opts : 'N/A');
  console.log('Question explanation (x):', q ? q.x : 'N/A');
} catch (e) {
  console.error('ERROR!', e);
}
