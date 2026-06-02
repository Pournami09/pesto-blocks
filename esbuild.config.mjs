import { build, context } from 'esbuild';
import { cpSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const isWatch = process.argv.includes('--watch');

const commonOptions = {
  bundle: true,
  sourcemap: false,
  target: 'chrome120',
  minify: false,
};

const entryPoints = [
  {
    entryPoints: [resolve(__dirname, 'src/service-worker.js')],
    outfile: resolve(__dirname, 'dist/service-worker.js'),
    format: 'esm',
  },
  {
    entryPoints: [resolve(__dirname, 'src/content/index.js')],
    outfile: resolve(__dirname, 'dist/content.js'),
    format: 'iife',
  },
  {
    entryPoints: [resolve(__dirname, 'src/popup/popup.js')],
    outfile: resolve(__dirname, 'dist/popup/popup.js'),
    format: 'iife',
  },
  {
    entryPoints: [resolve(__dirname, 'src/onboarding/onboarding.js')],
    outfile: resolve(__dirname, 'dist/onboarding/onboarding.js'),
    format: 'iife',
  },
];

function copyStaticFiles() {
  const distDir = resolve(__dirname, 'dist');
  mkdirSync(distDir, { recursive: true });
  mkdirSync(resolve(distDir, 'popup'), { recursive: true });
  mkdirSync(resolve(distDir, 'onboarding'), { recursive: true });
  mkdirSync(resolve(distDir, 'icons'), { recursive: true });

  cpSync(resolve(__dirname, 'manifest.json'), resolve(distDir, 'manifest.json'));
  cpSync(resolve(__dirname, 'src/popup/popup.html'), resolve(distDir, 'popup/popup.html'));
  cpSync(resolve(__dirname, 'src/popup/popup.css'), resolve(distDir, 'popup/popup.css'));
  cpSync(resolve(__dirname, 'src/onboarding/onboarding.html'), resolve(distDir, 'onboarding/onboarding.html'));
  cpSync(resolve(__dirname, 'src/onboarding/onboarding.css'), resolve(distDir, 'onboarding/onboarding.css'));

  const iconsDir = resolve(__dirname, 'src/icons');
  if (existsSync(iconsDir)) {
    cpSync(iconsDir, resolve(distDir, 'icons'), { recursive: true });
  }
}

async function run() {
  copyStaticFiles();

  if (isWatch) {
    const contexts = await Promise.all(
      entryPoints.map((ep) =>
        context({ ...commonOptions, ...ep })
      )
    );
    await Promise.all(contexts.map((ctx) => ctx.watch()));
    console.log('Watching for changes...');
  } else {
    await Promise.all(
      entryPoints.map((ep) =>
        build({ ...commonOptions, ...ep })
      )
    );
    console.log('Build complete.');
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
