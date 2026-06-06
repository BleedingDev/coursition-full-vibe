import { defineConfig } from 'oxfmt';
import ultracite from 'ultracite/oxfmt';

export default defineConfig({
  extends: [ultracite],
  ignorePatterns: ['dist', 'node_modules', '.modern', '.modernjs', '**/*.gen.d.ts', '**/*.gen.ts'],
  singleQuote: true,
});
