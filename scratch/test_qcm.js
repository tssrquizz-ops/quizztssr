const fs = require('fs');
const path = require('path');

// Simulate browser environment
global.window = {
  crypto: {
    getRandomValues: (arr) => {
      for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
      return arr;
    }
  }
};
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

// Load bdd_globale.json
const questions = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'bdd_globale.json'), 'utf8'));

// Build CATS with o -> opts mapping
questions.forEach(function(q) {
  var catId = q.cat;
  if (!catId) return;
  if (!global.CATS[catId]) {
    global.CATS[catId] = { qs: [] };
  }
  var cleanQ = Object.assign({}, q);
  if (cleanQ.o && !cleanQ.opts) {
    cleanQ.opts = cleanQ.o;
  }
  global.CATS[catId].qs.push(cleanQ);
});

// Load game.js with renderQCM exposed
let gameJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'game.js'), 'utf8');
gameJs = gameJs.replace('function renderQCM', 'global.renderQCM = function');
eval(gameJs);

// Get a question
const q = global.CATS['reseau'].qs[0];
console.log('Testing question:', JSON.stringify(q));

try {
  // Simulate renderQCM
  const area = {
    appendChild: () => {}
  };
  global.renderQCM(q, area);
  console.log('SUCCESS! renderQCM completed without error.');
} catch (e) {
  console.error('CRASHED!', e);
}
