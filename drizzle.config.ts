import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  out: './drizzle',
  schema: ['./server/coursition/auth-schema.ts', './server/coursition/storage-schema.ts'],
});
