// Copies runtime libraries from node_modules into www/vendor so the game runs
// fully offline (browser and Cordova) without a bundler: npm run vendor
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = `${root}www/vendor/`;
mkdirSync(out, { recursive: true });

const three = JSON.parse(readFileSync(`${root}node_modules/three/package.json`, 'utf8'));
copyFileSync(`${root}node_modules/three/build/three.module.min.js`, `${out}three.module.min.js`);
copyFileSync(`${root}node_modules/three/LICENSE`, `${out}three.LICENSE.txt`);
console.log(`three.js ${three.version} -> www/vendor/three.module.min.js`);
