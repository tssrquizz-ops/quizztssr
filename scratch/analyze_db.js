const fs = require('fs');
const path = require('path');

const bddPath = path.join(__dirname, '..', 'bdd_globale(7).json');
if (!fs.existsSync(bddPath)) {
  console.error('Error: file not found');
  process.exit(1);
}

const questions = JSON.parse(fs.readFileSync(bddPath, 'utf8'));
console.log('Total questions:', questions.length);

const types = {};
questions.forEach(q => {
  if (!types[q.t]) {
    types[q.t] = {
      count: 0,
      keys: new Set(),
      sample: null
    };
  }
  types[q.t].count++;
  Object.keys(q).forEach(k => types[q.t].keys.add(k));
  if (!types[q.t].sample) {
    types[q.t].sample = Object.assign({}, q);
  }
});

console.log('\n--- Question Types Analysis ---');
Object.keys(types).forEach(t => {
  console.log(`\nType: "${t}" (${types[t].count} questions)`);
  console.log('Keys:', Array.from(types[t].keys).join(', '));
  console.log('Sample:', JSON.stringify(types[t].sample, null, 2));
});
