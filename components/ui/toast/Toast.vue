<script setup lang="ts">
import { ToastRoot, type ToastRootEmits, useForwardPropsEmits } from 'reka-ui'
import { cn } from '@/lib/utils'
import { type ToastProps, toastVariants } from '.'
import type { VariantProps } from 'class-variance-authority'

// Definiamo le props in modo esplicito
const props = withDefaults(defineProps<ToastProps & {
  class?: string;
  variant?: VariantProps<typeof toastVariants>['variant'];
  open?: boolean;
}>(), {
  open: true, // Default open a true
});

const emits = defineEmits<ToastRootEmits>()

// Usiamo useForwardPropsEmits per passare le props corrette a ToastRoot
const forwarded = useForwardPropsEmits(props, emits)

</script>

<template>
  <ToastRoot
    v-bind="forwarded"
    :class="cn(toastVariants({ variant: props.variant }), props.class)"
  >
    <slot />
  </ToastRoot>
</template>