<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { Primitive, type PrimitiveProps } from 'radix-vue'
import { type ButtonVariants, buttonVariants } from '.'
import { cn } from '@/lib/utils'

// MODIFICA QUI: Rimuovi 'extends PrimitiveProps' e definisci esplicitamente 'as' e 'asChild'
interface Props {
  variant?: ButtonVariants['variant'];
  size?: ButtonVariants['size'];
  class?: HTMLAttributes['class'];
  as?: PrimitiveProps['as']; // Usa il tipo da PrimitiveProps per 'as'
  asChild?: PrimitiveProps['asChild']; // Usa il tipo da PrimitiveProps per 'asChild'
}

const props = withDefaults(defineProps<Props>(), { 
  as: 'button', // Default tag HTML
  asChild: false // Default a non renderizzare come child
})
</script>
<template>
  <Primitive :as="props.as" :as-child="props.asChild" :class="cn(buttonVariants({ variant, size }), props.class)"><slot /></Primitive>
</template>