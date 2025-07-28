<script setup>
import { ref, onMounted } from 'vue';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast/use-toast';
import { Toaster } from '@/components/ui/toast';

definePageMeta({ layout: false });

const supabase = useSupabaseClient();
const router = useRouter();
const user = useSupabaseUser();
const { toast } = useToast();

const password = ref('');
const confirmPassword = ref('');
const loading = ref(false);

onMounted(() => {
    // Il middleware di Supabase ha già autenticato l'utente grazie al token.
    // Se, per qualche strano motivo, l'utente arriva qui senza essere loggato,
    // lo rimandiamo alla pagina di login per sicurezza.
    if (!user.value) {
        toast({ title: 'Errore', description: 'Link non valido o scaduto. Richiedi un nuovo link.', variant: 'destructive'});
        router.replace('/login');
    }
});

const handleUpdatePassword = async () => {
  if (password.value !== confirmPassword.value || password.value.length < 6) {
    toast({ title: 'Errore', description: 'Le password non coincidono o sono troppo corte.', variant: 'destructive' });
    return;
  }
  loading.value = true;
  const { error } = await supabase.auth.updateUser({ password: password.value });
  loading.value = false;
  if (error) {
    toast({ title: 'Errore', description: error.message, variant: 'destructive' });
  } else {
    toast({ title: 'Successo!', description: 'Password aggiornata. Verrai reindirizzato al login.' });
    await supabase.auth.signOut();
    setTimeout(() => router.push('/login'), 2000);
  }
};
</script>

<template>
  <div class="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-gray-900">
    <Toaster />
    <video autoplay loop muted playsinline class="absolute z-0 w-full h-full object-cover opacity-30"><source src="/videos/vidRegister.mp4" type="video/mp4"></video>
    <div v-if="user" class="relative z-20 flex flex-col items-center justify-center p-4">
      <Card class="w-full max-w-md bg-gray-900/40 backdrop-blur-md border-gray-500/30 text-white">
        <CardHeader class="text-center">
          <CardTitle class="text-2xl text-white">Imposta Nuova Password</CardTitle>
          <CardDescription class="text-gray-400">Ciao, {{ user.email }}. Scegli una nuova password sicura.</CardDescription>
        </CardHeader>
        <CardContent>
          <form @submit.prevent="handleUpdatePassword" class="space-y-4">
            <div class="space-y-2"><Label for="password" class="text-gray-300">Nuova Password</Label><Input id="password" type="password" v-model="password" required class="bg-gray-800/50 border-gray-600 text-white"/></div>
            <div class="space-y-2"><Label for="confirmPassword" class="text-gray-300">Conferma Password</Label><Input id="confirmPassword" type="password" v-model="confirmPassword" required class="bg-gray-800/50 border-gray-600 text-white"/></div>
            <Button type="submit" class="w-full bg-white text-gray-900 hover:bg-gray-200" :disabled="loading">{{ loading ? 'Aggiornamento...' : 'Aggiorna e Accedi' }}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  </div>
</template>