<script setup lang="ts">
import { DialogRoot, type DialogRootEmits, type DialogRootProps, useForwardPropsEmits } from 'radix-vue'
const props = defineProps</* @vue-ignore */ DialogRootProps>() // Aggiungi qui
const emits = defineEmits<DialogRootEmits>()
const forwarded = useForwardPropsEmits(props, emits)
</script>
<template><DialogRoot v-bind="forwarded"><slot /></DialogRoot></template>