<script setup lang="ts">
import CsFooter from '../CsFooter.vue';
</script>

<template>
  <div class="slidev-layout cs-end">
    <img :src="'/logo-light.svg'" class="cs-end-logo" alt="Coursition" />
    <div class="cs-end-body">
      <slot />
    </div>
    <div v-if="$slots.next" class="cs-end-next">
      <hr class="cs-hairline" />
      <div class="cs-end-next-row">
        <img :src="'/icons/arrow.png'" alt="" />
        <div><slot name="next" /></div>
      </div>
    </div>
    <CsFooter />
  </div>
</template>

<style scoped>
.cs-end {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
}
.cs-end-logo {
  width: 10.5rem;
  height: auto;
}
.cs-end-body {
  align-self: center;
}
.cs-end-body :deep(h1) {
  font-size: 3.4rem;
  color: var(--cs-dark-ink);
}
.cs-end-body :deep(p) {
  margin-top: 1.4rem;
  font-size: 1.15rem;
  color: var(--cs-dark-muted);
  max-width: 46ch;
}
.cs-end-next {
  padding-bottom: 1.6rem;
}
.cs-end-next-row {
  display: grid;
  grid-template-columns: 1.6rem minmax(0, 1fr);
  gap: 0.9rem;
  align-items: center;
  margin-top: 1.3rem;
}
.cs-end-next-row img {
  width: 1.4rem;
  filter: invert(1) brightness(1.6);
}
.cs-end-next-row :deep(p) {
  margin: 0;
  font-size: 0.95rem;
  color: var(--cs-dark-muted);
  max-width: 70ch;
}
</style>
