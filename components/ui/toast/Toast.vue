<script setup lang="ts">
import { reactiveOmit } from '@vueuse/core'
import { ToastRoot, type ToastRootEmits, useForwardPropsEmits } from 'reka-ui'
import { cn } from '@/lib/utils'
import { type ToastProps, toastVariants } from '.'

const props = defineProps</* @vue-ignore */ ToastProps>() // Aggiungi qui

const emits = defineEmits<ToastRootEmits>()

// Passa solo le props che ToastRoot di reka-ui si aspetta, escludendo quelle aggiuntive per use-toast
const delegatedProps = reactiveOmit(props, 'class', 'title', 'description', 'action')

const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <ToastRoot
    v-bind="forwarded"
    :class="cn(toastVariants({ variant }), props.class)"
    @update:open="props.onOpenChange"
  >
    <slot />
  </ToastRoot>
</template>