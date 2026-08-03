<script setup lang="ts">
import { computed } from 'vue';
import { useNav } from '@slidev/client';

const { currentPage, total } = useNav();

const progress = computed(() => `${(currentPage.value / Math.max(total.value, 1)) * 100}%`);
</script>

<template>
  <div class="cs-progress" :style="{ width: progress }" />
</template>
