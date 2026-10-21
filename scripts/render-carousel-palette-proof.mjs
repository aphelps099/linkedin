import fs from 'node:fs/promises';
import path from 'node:path';
import {build} from 'esbuild';
import {pathToFileURL} from 'node:url';

const root = process.cwd();
const output = process.argv[2] || '/workspace/linkedin-beats-palette.html';
const cache = path.join(root,'node_modules/.cache/carousel-palette-proof.cjs');
await build({entryPoints:['design/carousel/PaletteProof.jsx'],outfile:cache,bundle:true,platform:'node',format:'cjs',loader:{'.css':'empty'},logLevel:'error'});
const {renderProof} = await import(pathToFileURL(cache));
const files = ['src/home-2/carousel-artwork-palette.css','src/home-2/carousel-artwork.css','design/carousel/palette-proof.css'];
let css = (await Promise.all(files.map(file=>fs.readFile(file,'utf8')))).join('\n');
for (const [family,file,weight] of [['LBFounders','founders-regular-trial.woff2',400],['LBFounders','founders-semibold-trial.woff2',600],['LBFoundersMono','founders-mono-medium-trial.woff2',500]]) {
  const data = await fs.readFile(`public/brand/fonts/${file}`);
  css += `\n@font-face{font-family:${family};src:url(data:font/woff2;base64,${data.toString('base64')}) format('woff2');font-weight:${weight};font-display:swap}`;
}
let html = renderProof();
for (const tone of ['white','black']) {
  const file = `brand/afterbeat/wordmark-${tone}.svg`;
  const data = await fs.readFile(`public/${file}`);
  html = html.replaceAll(`/${file}`, `data:image/svg+xml;base64,${data.toString('base64')}`);
}
const controls = await fs.readFile('design/carousel/palette-proof-controls.js','utf8');
const fragment = `<style>\n${css}\n</style>\n${html}\n<script>\n${controls}\n</script>\n`;
await fs.writeFile(output,fragment);
await fs.writeFile('design/carousel/palette-proof.html',`<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>LinkedIn Beats — palette proof</title></head><body style="margin:0">${fragment}</body></html>`);
console.log(`Rendered palette proof (${Buffer.byteLength(fragment)} bytes)`);
