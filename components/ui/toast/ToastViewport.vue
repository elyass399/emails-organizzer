<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { ToastViewport, type ToastViewportProps } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps</* @vue-ignore */ ToastViewportProps & { class?: HTMLAttributes['class'] }>() // Aggiungi qui

const delegatedProps = reactiveOmit(props, 'class')
</script>

<template>
  <ToastViewport
    v-bind="delegatedProps"
    :class="cn('fixed top-0 right-0 z-[100] flex max-h-screen w-full flex-col p-4 md:max-w-[420px]', props.class)"
  />
</template>