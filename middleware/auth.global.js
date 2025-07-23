export default defineNuxtRouteMiddleware((to, from) => {
  const user = useSupabaseUser();

  // Se l'utente NON è loggato e sta cercando di accedere a qualsiasi pagina
  // che non sia /login o /register, reindirizzalo a /login.
  if (!user.value && to.path !== '/login' && to.path !== '/register') {
    return navigateTo('/login');
  }

  // Se l'utente È loggato e sta cercando di accedere a /login o /register,
  // reindirizzalo alla dashboard principale.
  if (user.value && (to.path === '/login' || to.path === '/register')) {
    return navigateTo('/');
  }
});