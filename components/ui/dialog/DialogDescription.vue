<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { DialogDescription, type DialogDescriptionProps } from 'radix-vue'
import { cn } from '@/lib/utils'
const props = defineProps</* @vue-ignore */ DialogDescriptionProps & { class?: HTMLAttributes['class'] }>() // Aggiungi qui
</script>
<template><DialogDescription :class="cn('text-sm text-muted-foreground', props.class)" v-bind="props"><slot /></DialogDescription></template>