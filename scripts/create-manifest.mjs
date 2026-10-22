import { writeFileSync, existsSync } from 'node:fs';

const url = new URL(process.argv[2] || 'http://localhost:5173/');
if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) {
  throw new Error('Use uma URL HTTPS pública para instalar o plugin.');
}
if (!url.pathname.endsWith('/')) url.pathname += '/';
const manifest = { name: 'AI Studio', url: url.href, icon: new URL('icon.svg', url).href };
if (!existsSync('dist')) throw new Error('Execute npm run build primeiro.');
writeFileSync('dist/manifest.json', JSON.stringify(manifest, null, 2));
console.log('Manifesto pronto: dist/manifest.json');
