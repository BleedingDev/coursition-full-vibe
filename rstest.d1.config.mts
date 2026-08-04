import { defineConfig } from '@rstest/core';

export default defineConfig({
  include: [
    'tests/coursition.draft-repository.test.ts',
    'tests/coursition.source-lifecycle.test.ts',
  ],
  maxWorkers: 1,
  testEnvironment: 'node',
});
