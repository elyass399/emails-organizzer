<script setup lang="ts">
import { type HTMLAttributes, type LabelHTMLAttributes } from 'vue'
import { Label, type LabelProps } from 'radix-vue'
import { cn } from '@/lib/utils'
const props = defineProps</* @vue-ignore */ LabelProps & { class?: HTMLAttributes['class'] }>() // Aggiungi qui
</script>
<template><Label :class="cn('text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70', props.class)"><slot /></Label></template>