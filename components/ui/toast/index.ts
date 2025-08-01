import type { ToastRootProps } from 'reka-ui'
import type { Component, HTMLAttributes, VNode } from 'vue' // Aggiunto VNode

export { default as Toast } from './Toast.vue'
export { default as ToastAction } from './ToastAction.vue'
export { default as ToastClose } from './ToastClose.vue'
export { default as ToastDescription } from './ToastDescription.vue'
export { default as Toaster } from './Toaster.vue'
export { default as ToastProvider } from './ToastProvider.vue'
export { default as ToastTitle } from './ToastTitle.vue'
export { default as ToastViewport } from './ToastViewport.vue'
export { toast, useToast } from './use-toast'

import { cva, type VariantProps } from 'class-variance-authority'

// MODIFICA QUI: Estendi da ToastRootProps e aggiungi le proprietÃ  che vengono passate dal `use-toast`
export interface ToastProps extends /* @vue-ignore */ ToastRootProps {
  class?: HTMLAttributes['class']
  variant?: ToastVariants['variant']
  // Proprietà aggiunte per compatibilità con ToasterToast in use-toast.ts
  title?: string
  description?: string | VNode | (() => VNode) // Deve essere compatibile con StringOrVNode
  action?: Component // Componente per l'azione del toast
}

export const toastVariants = cva(
  'group pointer-events-auto relative flex w-full items-center justify-between space-x-2 overflow-hidden rounded-md border p-4 pr-6 shadow-lg transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--reka-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--reka-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full',
  {
    variants: {
      variant: {
        default: 'border bg-background text-foreground',
        destructive:
                    'destructive group border-destructive bg-destructive text-destructive-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

type ToastVariants = VariantProps<typeof toastVariants>

// La definizione ToastProps qui sotto Ã¨ duplicata e meno specifica,
// manteniamo quella superiore che Ã¨ piÃ¹ completa.
// export interface ToastProps extends ToastRootProps {
//   class?: HTMLAttributes['class']
//   variant?: ToastVariants['variant']
//   onOpenChange?: ((value: boolean) => void) | undefined
// }