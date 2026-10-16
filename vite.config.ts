import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // どの場所（URLの階層）に置いても動くように、ファイルの参照を相対パスにする
  base: './',
  plugins: [react()],
});
