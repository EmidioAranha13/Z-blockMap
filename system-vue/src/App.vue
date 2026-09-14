<script setup>
import { computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'

const route = useRoute()
const viewKey = computed(() => {
  if (route.name === 'pixel-edit' || route.name === 'pixel-view') return route.fullPath
  if (route.name === '3d-edit' || route.name === '3d-view') return route.fullPath
  return 'shell'
})
</script>

<template>
  <RouterView :key="viewKey" />
</template>
