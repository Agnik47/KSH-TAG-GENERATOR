// Copies the DejaVu Sans fonts (needed for the ₹ sign) from node_modules into public/fonts.
// The copied files are committed, so this only needs to run when upgrading the font package.
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules', 'dejavu-fonts-ttf');
const dst = join(root, 'public', 'fonts');
mkdirSync(dst, { recursive: true });
for (const f of ['ttf/DejaVuSans.ttf', 'ttf/DejaVuSans-Bold.ttf', 'LICENSE']) {
  const name = f === 'LICENSE' ? 'DejaVu-LICENSE.txt' : f.split('/')[1];
  copyFileSync(join(src, f), join(dst, name));
  console.log('copied', name);
}
