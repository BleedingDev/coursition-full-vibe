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
    'dist',
    'dogfood-output',
    'node_modules',
    'test-results',
    'tests/test-results',
    '.coursition-data',
    '.modern',
    '.modernjs',
    '.scratch',
    '.vera',
    '**/*.gen.d.ts',
    '**/*.gen.ts',
  ],
  rules: {
    'max-classes-per-file': 'off',
  },
});
