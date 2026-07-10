import fs from 'fs';
const html = fs.readFileSync('stats.html', 'utf8');
const tag = 'const data = ';
const start = html.indexOf(tag) + tag.length;
// brace-balanced extraction (skips string contents) — JSON may embed "</script>" from blog HTML
let i = start, depth = 0, inStr = false, esc = false;
for (; i < html.length; i++) {
    const ch = html[i];
    if (inStr) {
        if (esc) esc = false;
        else if (ch === '\\') esc = true;
        else if (ch === '"') inStr = false;
    } else if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) { i++; break; } }
}
const data = JSON.parse(html.slice(start, i));

const nodeParts = data.nodeParts;
const tree = data.tree;

const records = [];
function walk(node, stack, chunk) {
    if (node.uid && nodeParts[node.uid]) {
        const size = nodeParts[node.uid].renderedLength || 0;
        records.push({ chunk, path: stack.join('/'), size });
    }
    if (node.children) for (const c of node.children) walk(c, [...stack, c.name], chunk);
}
for (const ch of tree.children) walk(ch, [], ch.name);

function pkgOf(path) {
    if (path.includes('\x00')) return 'rollup-internal';
    const idx = path.lastIndexOf('node_modules/');
    if (idx < 0) return 'src:' + path.split('/').slice(0, 3).join('/');
    const after = path.slice(idx + 'node_modules/'.length);
    const parts = after.split('/');
    return parts[0].startsWith('@') ? parts[0] + '/' + parts[1] : parts[0];
}

const globalPkg = {};
for (const r of records) globalPkg[pkgOf(r.path)] = (globalPkg[pkgOf(r.path)] || 0) + r.size;
console.log('===== GLOBAL TOP PACKAGES =====');
for (const [k, v] of Object.entries(globalPkg).sort((a, b) => b[1] - a[1]).slice(0, 20))
    console.log(`${String(Math.round(v / 1024)).padStart(6)} KB  ${k}`);

const byChunk = {};
for (const r of records) {
    (byChunk[r.chunk] ??= { total: 0, pkg: {} });
    byChunk[r.chunk].total += r.size;
    const p = pkgOf(r.path);
    byChunk[r.chunk].pkg[p] = (byChunk[r.chunk].pkg[p] || 0) + r.size;
}
console.log('\n===== CHUNKS > 150KB =====');
const big = Object.entries(byChunk).filter(([, v]) => v.total > 150000).sort((a, b) => b[1].total - a[1].total);
for (const [name, v] of big) {
    console.log(`\n--- ${name}  (total ${Math.round(v.total / 1024)} KB)`);
    for (const [p, s] of Object.entries(v.pkg).sort((a, b) => b[1] - a[1]).slice(0, 8))
        console.log(`     ${String(Math.round(s / 1024)).padStart(5)} KB  ${p}`);
}
