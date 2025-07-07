<script setup lang="ts">
import { ToastProvider, type ToastProviderProps } from 'reka-ui'

const props = defineProps</* @vue-ignore */ ToastProviderProps>() // Aggiungi qui
</script>

<template>
  <ToastProvider v-bind="props">
    <slot />
  </ToastProvider>
</template>
