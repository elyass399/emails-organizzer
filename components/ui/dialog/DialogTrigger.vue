<script setup lang="ts">
import { DialogTrigger, type DialogTriggerProps } from 'radix-vue'
const props = defineProps</* @vue-ignore */ DialogTriggerProps>() // Aggiungi qui
</script>
<template><DialogTrigger v-bind="props"><slot /></DialogTrigger></template>