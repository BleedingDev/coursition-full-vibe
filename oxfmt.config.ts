import { defineConfig } from 'oxfmt';
import ultracite from 'ultracite/oxfmt';

export default defineConfig({
  extends: [ultracite],
  ignorePatterns: [
    /* Generated CzechInvest reporting artefacts and scratch output. Reformatting
     * a rendered document changes what was reviewed and signed off. */
    'docs',
    '.tmp',
    'tmp',
    'dist',
    'dist-cloudflare',
    'dogfood-output',
    'hackathon-video',
    'node_modules',
    '.modern',
    '.modern-js',
    '.modernjs',
    '.output',
    '**/*.gen.d.ts',
    '**/*.gen.ts',
  ],
  singleQuote: true,
});
