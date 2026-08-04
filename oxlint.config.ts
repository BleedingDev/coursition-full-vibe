import { defineConfig } from 'oxlint';
import core from 'ultracite/oxlint/core';
import react from 'ultracite/oxlint/react';

export default defineConfig({
  env: {
    browser: true,
    node: true,
  },
  extends: [core, react],
  ignorePatterns: [
    'artifacts',
    /* One-off scripts and themes that build the CzechInvest documents and slide
     * deck. They are reporting deliverables rather than application source, and
     * hold the linter to app conventions they were never written against. */
    'docs',
    '.tmp',
    'tmp',
    'dist',
    'dist-cloudflare',
    'dogfood-output',
    'hackathon-video',
    'node_modules',
    'test-results',
    'tests/test-results',
    '.coursition-data',
    '.modern',
    '.modern-js',
    '.modernjs',
    '.output',
    '.scratch',
    '.vera',
    '**/*.gen.d.ts',
    '**/*.gen.ts',
  ],
  rules: {
    'max-classes-per-file': 'off',
    'no-inline-comments': 'off',
    'prefer-named-capture-group': 'off',
    'promise/prefer-await-to-then': 'off',
  },
});
