// Loads the browser rule scripts into Node's global scope, in the same order as index.html.
const path = require('path');
const files = ['config', 'data', 'items', 'character', 'magic', 'combat', 'enemies', 'recovery', 'ai'];
for (const f of files) require(path.join(__dirname, '..', 'src', 'rules', f + '.js'));
module.exports = globalThis.BBB;
