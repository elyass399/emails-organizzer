import type { Component, VNode } from 'vue'
import { computed, ref } from 'vue'
import type { ToastProps } from '.'

const TOAST_LIMIT = 3
const TOAST_REMOVE_DELAY = 5000 // Default a 5 secondi

export type StringOrVNode =
  | string
  | VNode
  | (() => VNode)

// Assicuriamoci che ogni proprietà sia opzionale ma presente
type ToasterToast = Partial<ToastProps> & {
  id: string
  title?: string
  description?: StringOrVNode
  action?: Component
  duration?: number
}

const actionTypes = {
  ADD_TOAST: 'ADD_TOAST',
  UPDATE_TOAST: 'UPDATE_TOAST',
  DISMISS_TOAST: 'DISMISS_TOAST',
  REMOVE_TOAST: 'REMOVE_TOAST',
} as const

let count = 0

function genId() {
  count = (count + 1) % Number.MAX_VALUE
  return count.toString()
}

type ActionType = typeof actionTypes

type Action =
  | {
    type: ActionType['ADD_TOAST']
    toast: ToasterToast
  }
  | {
    type: ActionType['UPDATE_TOAST']
    toast: Partial<ToasterToast>
  }
  | {
    type: ActionType['DISMISS_TOAST']
    toastId?: ToasterToast['id']
  }
  | {
    type: ActionType['REMOVE_TOAST']
    toastId?: ToasterToast['id']
  }

interface State {
  toasts: ToasterToast[]
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

function addToRemoveQueue(toastId: string, duration?: number) {
  if (toastTimeouts.has(toastId))
    return

  const newDuration = duration === Infinity ? Infinity : (duration || TOAST_REMOVE_DELAY)

  if (newDuration === Infinity) return

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId)
    dispatch({
      type: 'REMOVE_TOAST',
      toastId,
    })
  }, newDuration)

  toastTimeouts.set(toastId, timeout)
}

const state = ref<State>({
  toasts: [],
})

function dispatch(action: Action) {
  switch (action.type) {
    case 'ADD_TOAST':
      state.value.toasts = [action.toast, ...state.value.toasts].slice(0, TOAST_LIMIT)
      addToRemoveQueue(action.toast.id, action.toast.duration)
      break

    case 'UPDATE_TOAST':
      state.value.toasts = state.value.toasts.map(t =>
        t.id === action.toast.id ? { ...t, ...action.toast } : t,
      )
      break

    case 'DISMISS_TOAST': {
      const { toastId } = action
      // Imposta 'open' a false per avviare l'animazione di chiusura
      if (toastId) {
        state.value.toasts = state.value.toasts.map(t =>
          t.id === toastId ? { ...t, open: false } : t,
        )
      } else {
        state.value.toasts = state.value.toasts.map(t => ({ ...t, open: false }))
      }
      break
    }
    case 'REMOVE_TOAST':
      if (action.toastId === undefined)
        state.value.toasts = []

      else
        state.value.toasts = state.value.toasts.filter(t => t.id !== action.toastId)

      break
  }
}

type Toast = Omit<ToasterToast, 'id'>

function toast(props: Toast) {
  const id = genId()

  const update = (props: ToasterToast) =>
    dispatch({
      type: 'UPDATE_TOAST',
      toast: { ...props, id },
    })
    
  const dismiss = () => dispatch({ type: 'REMOVE_TOAST', toastId: id });

  dispatch({
    type: 'ADD_TOAST',
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open: boolean) => {
        if (!open) {
            // Rimuovi il toast dall'array dopo un breve ritardo per permettere l'animazione
            setTimeout(() => {
                dismiss()
            }, 500); // 500ms delay
        }
      },
    },
  })

  return {
    id,
    dismiss,
    update,
  }
}

function useToast() {
  return {
    toasts: computed(() => state.value.toasts),
    toast,
    dismiss: (toastId?: string) => dispatch({ type: 'DISMISS_TOAST', toastId }),
  }
}


export { useToast, toast }