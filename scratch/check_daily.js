const fs = require('fs');
const path = require('path');

// Simulate browser environment
global.window = {};
global.localStorage = {
  getItem: () => null,
  setItem: () => null
};
global.lsGet = (k, d) => d;
global.CATS = {};

// Load data.js to get the CATS structure
const dataJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8');
eval(dataJs);

// Load bdd_globale.json
const questions = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'bdd_globale.json'), 'utf8'));

// Simulate fbBuildCatsFromQuestions
questions.forEach(function(q) {
  var catId   = q.cat;
  var groupId = q.group;
  if (!catId) return;

  var cleanQ = Object.assign({}, q);
  delete cleanQ.mech;
  if (!cleanQ.t) cleanQ.t = 'qcm';
  if (cleanQ.d === undefined) cleanQ.d = 1;

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

// Copy getDailyQuestion implementation
function getDailyQuestion(){
  var dayNum=Math.floor(Date.now()/86400000);
  var hardQs=[];
  Object.keys(CATS).forEach(function(k){
    if(k==='mix') return;
    CATS[k].qs.filter(function(q){ return q.d===3 && q.t==='qcm' && q.opts && q.opts.length >= 2; }).forEach(function(q){
      hardQs.push(Object.assign({},q,{_cat:CATS[k].label}));
    });
  });
  // Fallback : si aucune question de niveau 3, prendre n'importe quelle QCM avec opts
  if(!hardQs.length){
    Object.keys(CATS).forEach(function(k){
      if(k==='mix') return;
      CATS[k].qs.filter(function(q){ return q.t==='qcm' && q.opts && q.opts.length >= 2; }).forEach(function(q){
        hardQs.push(Object.assign({},q,{_cat:CATS[k].label}));
      });
    });
  }
  if(!hardQs.length) return null;
  return hardQs[dayNum % hardQs.length];
}

try {
  const q = getDailyQuestion();
  console.log('SUCCESS! Question found:', q ? q.q : 'null');
} catch (e) {
  console.error('ERROR!', e);
}
