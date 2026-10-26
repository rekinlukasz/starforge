// Copies runtime libraries from node_modules into www/vendor so the game runs
// fully offline (browser and Cordova) without a bundler: npm run vendor
// Example modules import the bare specifier 'three'; it is rewritten to the
// vendored file because the CSP forbids inline import maps.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = `${root}www/vendor/`;
const jsm = `${root}node_modules/three/examples/jsm/`;
mkdirSync(out, { recursive: true });

const three = JSON.parse(readFileSync(`${root}node_modules/three/package.json`, 'utf8'));
copyFileSync(`${root}node_modules/three/build/three.module.min.js`, `${out}three.module.min.js`);
copyFileSync(`${root}node_modules/three/LICENSE`, `${out}three.LICENSE.txt`);

const rewrite = (src, dest, replacements) => {
  let code = readFileSync(src, 'utf8');
  for (const [from, to] of replacements) {
    if (!code.includes(from)) throw new Error(`${src}: expected import "${from}" not found`);
    code = code.split(from).join(to);
  }
  writeFileSync(dest, code);
};
rewrite(`${jsm}loaders/GLTFLoader.js`, `${out}GLTFLoader.js`, [
  ["from 'three'", "from './three.module.min.js'"],
  ["from '../utils/BufferGeometryUtils.js'", "from './BufferGeometryUtils.js'"],
]);
rewrite(`${jsm}utils/BufferGeometryUtils.js`, `${out}BufferGeometryUtils.js`, [
  ["from 'three'", "from './three.module.min.js'"],
]);
console.log(`three.js ${three.version} -> www/vendor (core, GLTFLoader, BufferGeometryUtils)`);
