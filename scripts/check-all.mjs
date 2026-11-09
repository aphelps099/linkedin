// Every check in one command, on any machine (macOS has no `timeout`; this needs only Node):
// the Vite build (into a scratch folder, removed after), then each scripts/check-*.mjs in turn. A log per check, one summary line each,
// exit 1 if anything failed. The default is the set every round runs before a commit;
// --full adds check-compositor (WebGL, the slowest) and the full export check (real exports in Chromium).
//
//   node scripts/check-all.mjs [--full] [--only allhands,casting] [--skip roast] [--no-build]
//        [--jobs N] [--out DIR] [--timeout 1800]
//
// --jobs runs checks side by side. Several start their own servers on fixed ports, so keep it at 1
// unless you know the set you picked does not.
import {spawn} from 'node:child_process';
import {readdirSync, mkdirSync, createWriteStream, readFileSync, writeFileSync, rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const flag = name => process.argv.includes(`--${name}`);
const list = name => arg(name, '').split(',').filter(Boolean).map(n => n.replace(/^check-/, ''));
const full = flag('full'), only = list('only'), skip = list('skip'), jobs = Math.max(1, +arg('jobs', 1));
const out = arg('out', join(tmpdir(), 'linkedin-checks')), limit = 1000 * +arg('timeout', 1800);
mkdirSync(out, {recursive:true});

const SLOW = {compositor:[]};                                    // only with --full
const ARGS = {'videostudio-export':full ? [] : ['--node']};      // the Node gates unless --full
const all = readdirSync(join(ROOT, 'scripts')).filter(f => /^check-.+\.mjs$/.test(f) && f !== 'check-all.mjs').map(f => f.slice(6, -4)).sort();
const unknown = [...only, ...skip].filter(n => !all.includes(n));
if (unknown.length) { console.error(`No such check: ${unknown.join(', ')}. The checks: ${all.join(', ')}.`); process.exit(2); }
const names = all.filter(n => only.length ? only.includes(n) : !(n in SLOW && !full)).filter(n => !skip.includes(n));

// Ctrl+C stops the running checks too (their own process groups don't hear the terminal).
const running = new Set();
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { for (const pid of running) try { process.kill(-pid, 'SIGKILL'); } catch {} process.exit(130); });

const run = (label, cmd, args) => new Promise(done => {
  const log = join(out, `${label}.log`), file = createWriteStream(log), t0 = Date.now();
  // Its own process group, so a timeout also stops the servers and browsers the check started.
  const child = spawn(cmd, args, {cwd:ROOT, stdio:['ignore', 'pipe', 'pipe'], detached:true});
  running.add(child.pid);
  const timer = setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch {} }, limit);
  child.stdout.pipe(file); child.stderr.pipe(file);
  child.on('close', (code, signal) => file.end(() => {
    clearTimeout(timer); running.delete(child.pid);
    const text = readFileSync(log, 'utf8'), said = text.match(/^.*(passed|built in).*$/gim)?.at(-1)?.trim().slice(0, 110) ?? '';
    const s = ((Date.now() - t0) / 1000).toFixed(0).padStart(5);
    const ok = code === 0;
    const line = `${ok ? 'PASS' : 'FAIL'} ${label.padEnd(28)} ${s} s  ${signal ? `killed (${signal}, over ${limit / 1000} s)` : ok ? said : `exit ${code}: see ${log}`}`;
    console.log(line); done({label, ok, line});
  }));
});

// The build comes first, into a scratch folder removed at the end, so dist/ (the deploy's) is never
// touched; checks that read the built site (check-social-cards) are pointed at it with CHECK_DIST.
const dist = join(out, 'dist'), building = !flag('no-build') && !only.length;
const prebuilt = [];
if (building) {
  prebuilt.push(await run('vite-build', process.execPath, [join('node_modules', 'vite', 'bin', 'vite.js'), 'build', '--outDir', dist, '--emptyOutDir']));
  process.env.CHECK_DIST = dist;
}

console.log(`${names.length} checks${only.length ? '' : full ? ' (full)' : ' (check-compositor and the full export with --full)'}, logs in ${out}\n`);
const queue = [...names], results = [];
await Promise.all(Array.from({length:jobs}, async () => {
  while (queue.length) { const n = queue.shift(); results.push(await run(n, process.execPath, [join('scripts', `check-${n}.mjs`), ...(ARGS[n] ?? [])])); }
}));
results.push(...prebuilt);
if (building) rmSync(dist, {recursive:true, force:true});

const failed = results.filter(r => !r.ok);
writeFileSync(join(out, 'summary.txt'), results.map(r => r.line).join('\n') + '\n');
console.log(`\n${results.length - failed.length} of ${results.length} passed.${failed.length ? ` Failed: ${failed.map(r => r.label).join(', ')}.` : ''} Summary: ${join(out, 'summary.txt')}`);
process.exit(failed.length ? 1 : 0);
