<script setup lang="ts">
import { useSlideContext } from '@slidev/client';

const { $frontmatter } = useSlideContext();
</script>

<template>
  <div v-if="$frontmatter.source" class="cs-footer">
    <span>{{ $frontmatter.source }}</span>
  </div>
</template>
