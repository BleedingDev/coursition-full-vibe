<script setup lang="ts">
import { useSlideContext } from '@slidev/client';
import CsFooter from '../CsFooter.vue';

const { $frontmatter } = useSlideContext();
</script>

<template>
  <div class="slidev-layout cs-default">
    <header class="cs-head">
      <div v-if="$frontmatter.kicker" class="cs-kicker">{{ $frontmatter.kicker }}</div>
      <h1 v-if="$frontmatter.title">{{ $frontmatter.title }}</h1>
      <p v-if="$frontmatter.lead">{{ $frontmatter.lead }}</p>
    </header>
    <div class="cs-body">
      <slot />
    </div>
    <CsFooter />
  </div>
</template>

<style scoped>
.cs-default {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 1.6rem;
}
.cs-head :deep(h1),
.cs-head h1 {
  margin-top: 0.55rem;
}
.cs-head p {
  margin-top: 0.5rem;
  font-size: 1rem;
}
.cs-body {
  min-height: 0;
}
</style>
