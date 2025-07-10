<!-- File: app.vue -->
<template>
  <div>
    <!-- Questo componente è utile per l'accessibilità, annuncia i cambi di pagina agli screen reader -->
    <NuxtRouteAnnouncer />
    
    <!-- Questo è il componente più importante.
         Nuxt renderizzerà qui il contenuto della pagina corrente (es. pages/index.vue) -->
    <NuxtPage />
  </div>
</template>

<style>
/* Aggiungiamo uno stile di base per lo sfondo, così l'app non è completamente bianca */
body {
  background-color: #f8f9fa; /* Un grigio molto chiaro */
  color: #212529; /* Un nero morbido */
}

/* Stili per il tema scuro (opzionale, ma buona pratica) */
@media (prefers-color-scheme: dark) {
  body {
    background-color: #f9f6f6; /* Un grigio scuro */
    color: #060000; /* Un bianco sporco */
  }
}
</style>