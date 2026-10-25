import { build } from 'esbuild';
import { cp, mkdir, readdir, copyFile, writeFile, readFile } from 'node:fs/promises';
await mkdir('assets/ocr', { recursive: true });
await build({ entryPoints: ['src/app.js'], bundle: true, minify: true, sourcemap: false, outfile: 'assets/app.js', target: ['es2022'], legalComments: 'eof' });
const bundle = await readFile('assets/app.js', 'utf8');
await writeFile('assets/app.js', bundle.replace(/\/\*![\s\S]*?\*\//g, comment => comment.replace(/[\t ]+$/gm, '')));
await copyFile('node_modules/tesseract.js/dist/worker.min.js', 'assets/ocr/worker.min.js');
for (const file of await readdir('node_modules/tesseract.js-core')) {
  if (/^tesseract-core.*\.(wasm|js)$/.test(file)) await copyFile(`node_modules/tesseract.js-core/${file}`, `assets/ocr/${file}`);
}
for (const lang of ['eng', 'jpn']) {
  await cp(`node_modules/@tesseract.js-data/${lang}/4.0.0_best_int/${lang}.traineddata.gz`, `assets/ocr/${lang}.traineddata.gz`);
}
const licenses = [];
for (const name of ['tesseract.js', 'tesseract.js-core', 'jszip', '@tesseract.js-data/eng', '@tesseract.js-data/jpn']) {
  const files = await readdir(`node_modules/${name}`);
  for (const file of files.filter(x => /^licen[sc]e/i.test(x))) {
    const { readFile } = await import('node:fs/promises');
    licenses.push(`\n--- ${name} ---\n${await readFile(`node_modules/${name}/${file}`, 'utf8')}`);
  }
}
await writeFile('assets/THIRD-PARTY-LICENSES.txt', licenses.join('\n'));
console.log('Built static GitHub Pages site with local English/Japanese OCR models.');
