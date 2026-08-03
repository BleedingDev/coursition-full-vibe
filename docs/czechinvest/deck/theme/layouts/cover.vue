<script setup lang="ts">
import CsFooter from '../CsFooter.vue';
</script>

<template>
  <div class="slidev-layout cs-cover">
    <div class="cs-cover-copy">
      <img :src="'/logo.svg'" class="cs-cover-logo" alt="Coursition" />
      <div v-if="$slots.kicker" class="cs-kicker"><slot name="kicker" /></div>
      <slot />
      <div class="cs-rule" />
    </div>
    <div class="cs-cover-media">
      <slot name="media" />
    </div>
    <CsFooter />
  </div>
</template>

<style scoped>
.cs-cover {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.06fr);
  align-items: center;
  gap: 2.6rem;
}
.cs-cover-logo {
  width: 10rem;
  height: auto;
  margin-bottom: 2.2rem;
}
.cs-cover-copy .cs-kicker {
  white-space: nowrap;
}
.cs-cover-copy :deep(h1) {
  font-size: 2.5rem;
  margin-top: 0.85rem;
  max-width: 15ch;
}
.cs-cover-copy :deep(p) {
  margin-top: 1.1rem;
  font-size: 0.98rem;
  max-width: 38ch;
}
.cs-cover-media {
  position: relative;
  align-self: center;
}
</style>
