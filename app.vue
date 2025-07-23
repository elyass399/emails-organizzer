<template>
  <div>
    <NuxtRouteAnnouncer />
    
    <!-- Applichiamo una transizione a livello globale -->
    <NuxtPage :transition="{
      name: 'page',
      mode: 'out-in'
    }" />
  </div>
</template>

<style>
/* Stili di base del corpo (li avevi già, li ho solo puliti) */
body {
  background-color: hsl(210 40% 98%);
  color: hsl(222.2 84% 4.9%);
}

/* Definiamo le animazioni per la transizione di pagina */
.page-enter-active,
.page-leave-active {
  transition: opacity 0.2s ease;
}
.page-enter-from,
.page-leave-to {
  opacity: 0;
}
</style>