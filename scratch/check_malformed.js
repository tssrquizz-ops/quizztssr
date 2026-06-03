const fs = require('fs');
const path = require('path');

const bddPath = path.join(__dirname, '..', 'bdd_globale(7).json');
const questions = JSON.parse(fs.readFileSync(bddPath, 'utf8'));

console.log('Checking questions for missing properties...');

questions.forEach((q, i) => {
  const prefix = `Q[${i}] (cat: ${q.cat}, type: ${q.t}, text: "${q.q.substring(0, 30)}...")`;
  
  if (!q.q) console.warn(`${prefix} is missing question text q!`);
  if (q.d === undefined) console.warn(`${prefix} is missing difficulty d!`);
  
  if (q.t === 'qcm') {
    if (!q.o || !q.o.length) console.warn(`${prefix} is missing options o!`);
    if (q.a === undefined) console.warn(`${prefix} is missing correct answer a!`);
  }
  
  if (q.t === 'tf') {
    if (q.a === undefined) console.warn(`${prefix} is missing correct answer a!`);
  }
  
  if (q.t === 'calc') {
    if (!q.o || !q.o.length) console.warn(`${prefix} is missing options o!`);
    if (q.a === undefined) console.warn(`${prefix} is missing correct answer a!`);
  }
  
  if (q.t === 'order') {
    if (!q.items || !q.items.length) console.warn(`${prefix} is missing items!`);
  }
  
  if (q.t === 'word') {
    if (!q.o || !q.o.length) console.warn(`${prefix} is missing options o!`);
    if (!q.a || !q.a.length) console.warn(`${prefix} is missing correct answers a!`);
  }
  
  if (q.t === 'fill') {
    if (!q.code) console.warn(`${prefix} is missing code!`);
    if (!q.o || !q.o.length) console.warn(`${prefix} is missing options o!`);
    if (q.a === undefined) console.warn(`${prefix} is missing correct answer a!`);
  }
  
  if (q.t === 'match') {
    if (!q.pairs || !q.pairs.length) console.warn(`${prefix} is missing pairs!`);
  }
  
  if (q.t === 'slider') {
    if (q.min === undefined || q.max === undefined) console.warn(`${prefix} is missing min/max bounds!`);
    if (q.a === undefined) console.warn(`${prefix} is missing correct answer a!`);
  }
  
  if (q.t === 'categorize') {
    if (!q.items || !q.items.length) console.warn(`${prefix} is missing items!`);
    if (!q.categories || !q.categories.length) console.warn(`${prefix} is missing categories!`);
    if (!q.answers || !q.answers.length) console.warn(`${prefix} is missing answers!`);
  }
  
  if (q.t === 'debug') {
    if (!q.code) console.warn(`${prefix} is missing code!`);
    if (!q.o || !q.o.length) console.warn(`${prefix} is missing options o!`);
    if (q.a === undefined) console.warn(`${prefix} is missing correct answer a!`);
  }
  
  if (q.t === 'scramble') {
    if (!q.word) console.warn(`${prefix} is missing word!`);
  }
  
  if (q.t === 'multiblank') {
    if (!q.code) console.warn(`${prefix} is missing code!`);
    if (!q.blanks || !q.blanks.length) console.warn(`${prefix} is missing blanks!`);
  }
});
console.log('Check finished.');
