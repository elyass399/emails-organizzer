<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { DialogTitle, type DialogTitleProps } from 'radix-vue'
import { cn } from '@/lib/utils'
const props = defineProps</* @vue-ignore */ DialogTitleProps & { class?: HTMLAttributes['class'] }>() // Aggiungi qui
</script>
<template><DialogTitle v-bind="props" :class="cn('text-lg font-semibold leading-none tracking-tight', props.class)"><slot /></DialogTitle></template>