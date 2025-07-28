<script setup lang="ts">
const user = useSupabaseUser()
const router = useRouter()

// Questo watch ora attende che l'utente sia definito e poi reindirizza
// alla pagina a cui l'utente voleva andare. Se non c'è una pagina specifica,
// il modulo supabase reindirizzerà alla root ('/') di default.
watch(user, () => {
  if (user.value) {
    // Il modulo supabase gestirà il reindirizzamento all'URL originale (es. /?email_id=123)
    // Noi lo forziamo solo verso la home page come fallback.
    return router.push('/')
  }
}, { immediate: true })
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50">
    <p class="text-gray-600">Autenticazione in corso, attendere prego...</p>
  </div>
</template>