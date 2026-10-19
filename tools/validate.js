#!/usr/bin/env node
// Cross-reference check of data/*.yaml. Exits 1 on any problem. Run by CI before deploying.
'use strict';
const B = require('../tests/load.js');
const problems = B.Content.validate();
if (problems.length) { console.error(problems.join('\n')); console.error(`\n${problems.length} problem(s).`); process.exit(1); }
console.log('data/ is consistent.');
