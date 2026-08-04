import { withModernConfig } from '@modern-js/adapter-rstest';
import { defineConfig } from '@rstest/core';

export default defineConfig({
  exclude: [
    /* Agent worktrees hold their own copy of the suite; running those against
     * this checkout tests neither tree. */
    '.claude/**',
    'tests/coursition.draft-repository.test.ts',
    'tests/coursition.source-lifecycle.test.ts',
  ],
  extends: withModernConfig(),
  output: {
    module: true,
  },
  testEnvironment: 'happy-dom',
  tools: {
    rspack(config) {
      config.experiments ??= {};
      config.experiments.outputModule = true;
      config.output ??= {};
      config.output.library = { type: 'module' };
      return config;
    },
  },
});
