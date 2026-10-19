/*
 * A small YAML reader and writer, enough for the content files in data/.
 *
 * Supported: block maps and lists, flow maps and lists ({a: 1}, [a, b]), plain, 'single' and
 * "double" quoted strings, | and > block text, # comments, numbers, true/false/null/~, .inf.
 * Not supported: anchors, tags, multi-document files, complex keys. The parser throws an Error
 * naming the line when it meets something it can't read, so the Bench can show it.
 */
(function (G) {
  'use strict';

  function fail(msg, n) {
    const e = new Error('YAML line ' + (n + 1) + ': ' + msg);
    e.line = n + 1;
    throw e;
  }

  // Remove a trailing comment, honoring quotes.
  function stripComment(s) {
    let q = null;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (q) {
        if (ch === '\\' && q === '"') i++;
        else if (ch === q) q = null;
      } else if (ch === '"' || ch === "'") {
        // A quote only opens a string at the start of a token.
        if (i === 0 || /[\s\[{,:]/.test(s[i - 1])) q = ch;
      } else if (ch === '#' && (i === 0 || /\s/.test(s[i - 1]))) {
        return s.slice(0, i).replace(/\s+$/, '');
      }
    }
    return s.replace(/\s+$/, '');
  }

  function scalar(t) {
    if (t === '' || t === '~' || t === 'null') return null;
    if (t === 'true') return true;
    if (t === 'false') return false;
    if (t === '.inf' || t === '+.inf') return Infinity;
    if (t === '-.inf') return -Infinity;
    if (/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(t)) return Number(t);
    return t;
  }

  // ---- Flow values --------------------------------------------------------
  function parseFlow(src, n) {
    let i = 0;
    const ws = () => { while (i < src.length && /\s/.test(src[i])) i++; };
    function quoted() {
      const q = src[i++];
      let out = '';
      if (q === '"') {
        let j = i;
        while (j < src.length && src[j] !== '"') j += src[j] === '\\' ? 2 : 1;
        if (j >= src.length) fail('unterminated string', n);
        out = JSON.parse('"' + src.slice(i, j) + '"');
        i = j + 1;
      } else {
        while (i < src.length) {
          if (src[i] === "'") {
            if (src[i + 1] === "'") { out += "'"; i += 2; continue; }
            break;
          }
          out += src[i++];
        }
        if (src[i] !== "'") fail('unterminated string', n);
        i++;
      }
      return out;
    }
    function plain(stops) {
      const start = i;
      while (i < src.length && !stops.includes(src[i])) {
        // ': ' ends a key in a flow map; a bare ':' inside a word (a:b) is kept.
        if (src[i] === ':' && stops.includes(':') && (i + 1 >= src.length || /[\s,\]}]/.test(src[i + 1]))) break;
        i++;
      }
      return scalar(src.slice(start, i).trim());
    }
    function value(stops) {
      ws();
      if (src[i] === '[') {
        i++;
        const arr = [];
        ws();
        while (src[i] !== ']') {
          if (i >= src.length) fail('unterminated [', n);
          arr.push(value(',]'));
          ws();
          if (src[i] === ',') { i++; ws(); } else if (src[i] !== ']') fail('expected , or ]', n);
        }
        i++;
        return arr;
      }
      if (src[i] === '{') {
        i++;
        const obj = {};
        ws();
        while (src[i] !== '}') {
          if (i >= src.length) fail('unterminated {', n);
          ws();
          const k = src[i] === '"' || src[i] === "'" ? quoted() : String(plain(':,}'));
          ws();
          if (src[i] === ':') { i++; obj[k] = value(',}'); } else obj[k] = null;
          ws();
          if (src[i] === ',') { i++; ws(); } else if (src[i] !== '}') fail('expected , or }', n);
        }
        i++;
        return obj;
      }
      if (src[i] === '"' || src[i] === "'") return quoted();
      return plain(stops);
    }
    const v = value('');
    ws();
    if (i < src.length) fail('unexpected text after value: ' + src.slice(i), n);
    return v;
  }

  function parseInline(text, n) {
    if (text[0] === '[' || text[0] === '{' || text[0] === '"' || text[0] === "'") return parseFlow(text, n);
    return scalar(text);
  }

  // ---- Block structure ----------------------------------------------------
  function parse(src) {
    const raw = String(src).replace(/\r\n?/g, '\n').split('\n');
    const L = raw.map((line, n) => {
      if (/\t/.test(line.match(/^\s*/)[0])) fail('tabs are not allowed for indentation', n);
      const indent = line.match(/^ */)[0].length;
      return { n, raw: line, indent, text: stripComment(line.slice(indent)) };
    });
    let p = 0;
    const skip = () => { while (p < L.length && L[p].text === '') p++; };
    if (/^---\s*$/.test(raw[0] || '')) p = 1;

    function blockText(parentIndent, style) {
      const lines = [];
      let indent = null;
      while (p < L.length) {
        const l = L[p];
        if (l.raw.trim() === '') { lines.push(''); p++; continue; }
        if (l.indent <= parentIndent) break;
        if (indent === null) indent = l.indent;
        lines.push(l.raw.slice(Math.min(indent, l.indent)));
        p++;
      }
      while (lines.length && lines[lines.length - 1] === '') lines.pop();
      if (style === '|') return lines.join('\n');
      // Folded: single newlines become spaces, blank lines become newlines.
      return lines.join('\n').replace(/([^\n])\n(?=[^\n])/g, '$1 ');
    }

    function splitKey(t, n) {
      let k, rest;
      if (t[0] === '"' || t[0] === "'") {
        const q = t[0];
        let j = 1;
        while (j < t.length && t[j] !== q) j += (q === '"' && t[j] === '\\') ? 2 : 1;
        k = parseFlow(t.slice(0, j + 1), n);
        const after = t.slice(j + 1);
        if (!/^\s*:(\s|$)/.test(after)) return null;
        rest = after.replace(/^\s*:\s*/, '');
      } else {
        const m = t.match(/^([^\s:#\[\]{},'"][^:#]*?)\s*:(\s+|$)/);
        if (!m) return null;
        k = m[1];
        rest = t.slice(m[0].length);
      }
      return { key: String(k), rest };
    }

    function block(indent) {
      skip();
      if (p >= L.length) return null;
      const l = L[p];
      if (l.text === '-' || l.text.startsWith('- ')) return seq(l.indent);
      if (splitKey(l.text, l.n)) return map(l.indent);
      p++;
      return parseInline(l.text, l.n);
    }

    function seq(indent) {
      const out = [];
      for (;;) {
        skip();
        if (p >= L.length || L[p].indent !== indent || !(L[p].text === '-' || L[p].text.startsWith('- '))) break;
        const l = L[p];
        const rest = l.text === '-' ? '' : l.text.slice(2).replace(/^\s+/, '');
        if (rest === '') {
          p++;
          skip();
          out.push(p < L.length && L[p].indent > indent ? block(L[p].indent) : null);
        } else if (rest === '|' || rest === '>' || rest === '|-' || rest === '>-') {
          p++;
          out.push(blockText(indent, rest[0]));
        } else if (rest.startsWith('- ') || splitKey(rest, l.n)) {
          // "- key: v" or "- - x": reparse the rest as a block two columns in.
          const offset = l.text.length - rest.length;
          L[p] = { n: l.n, raw: l.raw, indent: indent + offset, text: rest };
          out.push(block(indent + offset));
        } else {
          p++;
          out.push(parseInline(rest, l.n));
        }
      }
      return out;
    }

    function map(indent) {
      const out = {};
      for (;;) {
        skip();
        if (p >= L.length || L[p].indent < indent) break;
        const l = L[p];
        if (l.indent > indent) fail('unexpected indentation', l.n);
        if (l.text === '-' || l.text.startsWith('- ')) break;
        const kv = splitKey(l.text, l.n);
        if (!kv) fail('expected "key: value"', l.n);
        if (Object.prototype.hasOwnProperty.call(out, kv.key)) fail('duplicate key "' + kv.key + '"', l.n);
        p++;
        let v;
        if (kv.rest === '') {
          skip();
          if (p < L.length && L[p].indent > indent) v = block(L[p].indent);
          else if (p < L.length && L[p].indent === indent && (L[p].text === '-' || L[p].text.startsWith('- '))) v = seq(indent);
          else v = null;
        } else if (/^[|>]-?$/.test(kv.rest)) {
          v = blockText(indent, kv.rest[0]);
        } else {
          v = parseInline(kv.rest, l.n);
        }
        out[kv.key] = v;
      }
      return out;
    }

    const result = block(0);
    skip();
    if (p < L.length) fail('could not read this line', L[p].n);
    return result;
  }

  // ---- Writer -------------------------------------------------------------
  const isScalar = (v) => v === null || typeof v !== 'object';
  function str(s) {
    if (s === '') return "''";
    if (/^[A-Za-z_][A-Za-z0-9_ .'()\/+-]*$/.test(s) && !/^(true|false|null|~)$/i.test(s) && !/\s$/.test(s) && !/: /.test(s) && !/ #/.test(s)) return s;
    return JSON.stringify(s);
  }
  function key(k) { return /^[A-Za-z_][A-Za-z0-9_]*$/.test(k) ? k : JSON.stringify(k); }
  function sc(v) {
    if (v === null || v === undefined) return 'null';
    if (typeof v === 'number') return v === Infinity ? '.inf' : v === -Infinity ? '-.inf' : String(v);
    if (typeof v === 'boolean') return String(v);
    return str(String(v));
  }
  function flow(v) {
    if (isScalar(v)) return sc(v);
    if (Array.isArray(v)) return '[' + v.map(flow).join(', ') + ']';
    return '{' + Object.keys(v).map((k) => key(k) + ': ' + flow(v[k])).join(', ') + '}';
  }
  function flat(v, depth) {
    if (isScalar(v)) return true;
    if (depth > 2) return false;
    const vals = Array.isArray(v) ? v : Object.values(v);
    return vals.every((x) => flat(x, depth + 1)) && flow(v).length <= 90;
  }
  function emit(v, indent, out, inSeq) {
    const pad = ' '.repeat(indent);
    if (Array.isArray(v)) {
      for (const x of v) {
        if (flat(x, 0)) out.push(pad + '- ' + flow(x));
        else if (Array.isArray(x)) { out.push(pad + '-'); emit(x, indent + 2, out); }
        else {
          const sub = [];
          emit(x, indent + 2, sub);
          sub[0] = pad + '- ' + sub[0].slice(indent + 2);
          out.push(...sub);
        }
      }
    } else {
      for (const k of Object.keys(v)) {
        const x = v[k];
        if (x === undefined) continue;
        if (flat(x, 0)) out.push(pad + key(k) + ': ' + flow(x));
        else {
          out.push(pad + key(k) + ':');
          emit(x, indent + 2, out);
        }
      }
    }
  }
  function stringify(v) {
    if (flat(v, 0)) return flow(v) + '\n';
    const out = [];
    emit(v, 0, out);
    return out.join('\n') + '\n';
  }

  G.Yaml = { parse, stringify };
})(typeof globalThis !== 'undefined' ? (globalThis.BBB = globalThis.BBB || {}) : {});
