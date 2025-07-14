import { type VariantProps, cva } from 'class-variance-authority'
export { default as Badge } from './Badge.vue'
export const badgeVariants = cva('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2', {
    variants: { variant: { default: 'border-transparent bg-primary text-primary-foreground hover:bg-primary/80', secondary: 'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80', destructive: 'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80', outline: 'text-foreground border-input',
    // NUOVE VARIANTI PERSONALIZZATE PER I BADGE DEGLI UFFICI (con text-white)
    contabilita: 'border-transparent bg-rose-500 text-white', // Rosso Rosato per Contabilità
    supportoTecnico: 'border-transparent bg-lime-500 text-white', // Verde Lime per Supporto Tecnico
    segreteria: 'border-transparent bg-violet-500 text-white', // Viola per Segreteria
    } },
    defaultVariants: { variant: 'default' },
})
export type BadgeVariants = VariantProps<typeof badgeVariants>