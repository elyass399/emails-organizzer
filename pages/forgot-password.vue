<script setup>
import { ref } from 'vue';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast/use-toast';
import { Toaster } from '@/components/ui/toast';

definePageMeta({ layout: false });

const supabase = useSupabaseClient();
const { toast } = useToast();
const email = ref('');
const loading = ref(false);
const emailSent = ref(false);

const handleSendResetLink = async () => {
  if (!email.value) {
    toast({ title: 'Errore', description: 'Inserisci la tua email.', variant: 'destructive' });
    return;
  }
  loading.value = true;
  // IMPORTANTE: Il link di reset ora punta alla pagina /update-password
  const { error } = await supabase.auth.resetPasswordForEmail(email.value, {
    redirectTo: 'http://localhost:3000/update-password',
  });
  loading.value = false;

  if (error) {
    toast({ title: 'Errore', description: error.message, variant: 'destructive' });
  } else {
    emailSent.value = true;
  }
};
</script>

<template>
  <div class="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-gray-900">
    <Toaster />
    <video autoplay loop muted playsinline class="absolute z-0 w-full h-full object-cover opacity-30">
      <source src="/videos/vidRegister.mp4" type="video/mp4">
    </video>
    <div class="relative z-20 flex flex-col items-center justify-center p-4">
      <Card class="w-full max-w-md bg-gray-900/40 backdrop-blur-md border-gray-500/30 text-white">
        <CardHeader class="text-center">
          <CardTitle class="text-2xl text-white">Resetta Password</CardTitle>
          <CardDescription v-if="!emailSent" class="text-gray-400">
            Inserisci la tua email per ricevere un link e impostare la tua password.
          </CardDescription>
          <CardDescription v-else class="text-green-400 p-4 border border-green-500/50 bg-green-500/10 rounded-md">
            <h3 class="font-bold mb-2">Controlla la tua Posta!</h3>
            <p class="text-sm">Ti abbiamo inviato un'email con un link sicuro. Clicca su quel link per continuare.</p>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form v-if="!emailSent" @submit.prevent="handleSendResetLink" class="space-y-4">
            <div class="space-y-2">
              <Label for="email" class="text-gray-300">Email</Label>
              <Input id="email" type="email" v-model="email" required class="bg-gray-800/50 border-gray-600 text-white"/>
            </div>
            <Button type="submit" class="w-full bg-white text-gray-900 hover:bg-gray-200" :disabled="loading">
              {{ loading ? 'Invio in corso...' : 'Invia Link di Reset' }}
            </Button>
          </form>
          <div class="mt-4 text-center">
            <NuxtLink to="/login" class="text-sm text-gray-400 hover:text-white">← Torna al Login</NuxtLink>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>