<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { ToastViewport, type ToastViewportProps } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps</* @vue-ignore */ ToastViewportProps & { class?: HTMLAttributes['class'] }>()

const delegatedProps = reactiveOmit(props, 'class')
</script>

<template>
  <ToastViewport
    v-bind="delegatedProps"
    :class="cn(
      /*
        MODIFICA CHIAVE QUI:
        - Cambiato `top-0` in `bottom-0` per posizionare in basso.
        - Rimosso `flex-col` perché l'ordine di apparizione dei toast
          (dal basso verso l'alto) è gestito automaticamente dalla libreria.
      */
      'fixed bottom-0 right-0 z-[100] flex max-h-screen flex-col-reverse gap-4 p-4', 
      'w-full max-w-[420px] sm:w-auto',
      props.class
    )"
  />
</template>