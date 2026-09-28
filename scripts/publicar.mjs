// Compila la app y la publica en GitHub Pages (rama gh-pages del remoto origin).
// Uso: npm run publicar
import { execSync } from 'node:child_process';
import { mkdtempSync, cpSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const correr = (cmd, cwd) => execSync(cmd, { cwd, stdio: 'inherit' });
const leer = (cmd) => execSync(cmd, { encoding: 'utf8' }).trim();

correr('npm run validar');
correr('npm run build');

const remoto = leer('git remote get-url origin');
const version = leer('git rev-parse --short HEAD');
const carpeta = mkdtempSync(join(tmpdir(), 'aula-vr-pages-'));
try {
  cpSync('dist', carpeta, { recursive: true });
  writeFileSync(join(carpeta, '.nojekyll'), ''); // GitHub Pages sirve los archivos tal cual
  correr('git init -q -b gh-pages', carpeta);
  correr('git add -A', carpeta);
  correr(`git -c user.name="${leer('git config user.name')}" -c user.email="${leer('git config user.email')}" commit -q -m "Publicar ${version}"`, carpeta);
  // gh-pages solo contiene la última versión compilada, por eso se reemplaza completa.
  correr(`git push -q -f "${remoto}" gh-pages`, carpeta);
  console.log('\n✓ Publicado. GitHub Pages tarda 1-2 minutos en actualizarse.');
} finally {
  rmSync(carpeta, { recursive: true, force: true });
}
