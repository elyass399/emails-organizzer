// File: nuxt.config.ts

export default defineNuxtConfig({
  devtools: { enabled: true },
  
  modules: [
    '@nuxtjs/tailwindcss',
    '@nuxtjs/supabase',
    'shadcn-nuxt'
  ],

  supabase: {
    url: process.env.SUPABASE_URL,
    key: process.env.NUXT_PUBLIC_SUPABASE_KEY,
    
    redirect: true,
    
    redirectOptions: {
      login: '/login',
      callback: '/confirm',
      // MODIFICA CHIAVE QUI: Dobbiamo escludere ENTRAMBE le pagine del flusso.
      exclude: ['/forgot-password', '/update-password'], 
    }
  },

  shadcn: {
    prefix: '',
    componentDir: './components/ui'
  },

  runtimeConfig: {
    googleApiKey: process.env.GOOGLE_API_KEY,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    sendgridApiKey: process.env.SENDGRID_API_KEY, 
    senderEmail: process.env.SENDER_EMAIL,
    imapHost: process.env.IMAP_HOST,
    imapPort: parseInt(process.env.IMAP_PORT || '993'),
    imapUsername: process.env.IMAP_USERNAME,
    imapPassword: process.env.IMAP_PASSWORD,
    imapMailbox: process.env.IMAP_MAILBOX || 'INBOX',
    
    public: {
      baseUrl: process.env.NUXT_PUBLIC_BASE_URL || 'http://localhost:3000',
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.NUXT_PUBLIC_SUPABASE_KEY,
    }
  },
})