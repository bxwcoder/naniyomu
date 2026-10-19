import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * オフライン対応の仕上げ：組み立てたファイルの一覧を sw.js に書き込む。
 * これで、初めて開いたときに画面の部品と本のデータがすべて保存され、次からオフラインでも開ける。
 */
function serviceWorkerAssets(): Plugin {
  let outDir = 'dist';
  let assets: string[] = [];
  return {
    name: 'naniyomu-sw-assets',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    generateBundle(_options, bundle) {
      assets = Object.keys(bundle)
        .filter((f) => f.startsWith('assets/'))
        .sort()
        .map((f) => `./${f}`);
    },
    closeBundle() {
      const swPath = join(outDir, 'sw.js');
      const version = createHash('sha256').update(assets.join('\n')).digest('hex').slice(0, 10);
      const sw = readFileSync(swPath, 'utf8')
        .replace("const CACHE_VERSION = 'naniyomu-dev';", `const CACHE_VERSION = 'naniyomu-${version}';`)
        .replace('const BUILD_ASSETS = [];', `const BUILD_ASSETS = ${JSON.stringify(assets)};`);
      writeFileSync(swPath, sw);
    },
  };
}

export default defineConfig({
  // どの場所（URLの階層）に置いても動くように、ファイルの参照を相対パスにする
  base: './',
  plugins: [react(), serviceWorkerAssets()],
});
