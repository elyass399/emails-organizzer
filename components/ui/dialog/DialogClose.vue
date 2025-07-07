<script setup lang="ts">
import { DialogClose, type DialogCloseProps } from 'reka-ui'

const props = defineProps</* @vue-ignore */ DialogCloseProps>() // Aggiungi qui
</script>

<template>
  <DialogClose v-bind="props">
    <slot />
  </DialogClose>
</template>
