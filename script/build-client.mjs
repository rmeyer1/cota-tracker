import * as esbuild from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const outDir = path.resolve(rootDir, 'dist', 'public');

// Ensure output directory exists
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

console.log('Building client...');

// Build the React app
await esbuild.build({
  entryPoints: [path.resolve(rootDir, 'client', 'src', 'main.tsx')],
  bundle: true,
  outfile: path.resolve(outDir, 'assets', 'main.js'),
  format: 'esm',
  platform: 'browser',
  target: ['es2020'],
  jsx: 'automatic',
  loader: {
    '.tsx': 'tsx',
    '.ts': 'ts',
    '.css': 'css',
    '.png': 'file',
    '.svg': 'file',
    '.jpg': 'file',
  },
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  minify: false,
  sourcemap: true,
  metafile: true,
}).then(result => {
  console.log('Build output:', JSON.stringify(result.metafile.outputs, null, 2));
}).catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});

// Copy index.html
const indexSrc = path.resolve(rootDir, 'client', 'src', 'index.html');
const indexDst = path.resolve(outDir, 'index.html');
if (fs.existsSync(indexSrc)) {
  fs.copyFileSync(indexSrc, indexDst);
  console.log('Copied index.html');
} else {
  // Create a basic index.html
  const basicHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>COTA Tracker</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/assets/main.js"></script>
</body>
</html>`;
  fs.writeFileSync(indexDst, basicHtml);
  console.log('Created basic index.html');
}

console.log('Client build complete. Output:', outDir);
