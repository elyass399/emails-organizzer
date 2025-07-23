<script setup>
import { ref } from 'vue';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// La logica JavaScript della registrazione rimane esattamente la stessa
const supabase = useSupabaseClient();
const email = ref('');
const password = ref('');
const errorMessage = ref(null);
const successMessage = ref(null);
const loading = ref(false);

const handleRegister = async () => {
  loading.value = true;
  errorMessage.value = null;
  successMessage.value = null;
  try {
    const { error } = await supabase.auth.signUp({
      email: email.value,
      password: password.value,
    });
    if (error) throw error;
    successMessage.value = 'Registrazione completata! Controlla la tua email per il link di conferma (se abilitato).';
  } catch (error) {
    errorMessage.value = error.message;
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="relative min-h-screen w-full flex items-center justify-center overflow-hidden">
    
    <!-- VIDEO DI SFONDO PER LA REGISTRAZIONE -->
    <video 
      autoplay 
      loop 
      muted 
      playsinline 
      class="absolute z-0 w-full h-full object-cover"
    >
      <source src="/videos/vidRegister.mp4" type="video/mp4">
      Il tuo browser non supporta i video.
    </video>
    
    <!-- Overlay scuro per migliorare la leggibilità del testo -->
    <div class="absolute z-10 inset-0 bg-black/50"></div>

    <!-- CONTENUTO IN PRIMO PIANO -->
    <div class="relative z-20 flex flex-col items-center justify-center p-4">
      <div class="mb-8 text-center">
        <h1 class="text-5xl font-bold text-white [text-shadow:_0_2px_4px_rgb(0_0_0_/_40%)]">
          Email Organizer
        </h1>
        <p class="text-gray-300 mt-2 [text-shadow:_0_1px_2px_rgb(0_0_0_/_30%)]">
          Il tuo assistente intelligente per la gestione della posta
        </p>
      </div>

      <Card class="w-full max-w-md bg-gray-900/40 backdrop-blur-md border-gray-500/30 text-white">
        <CardHeader class="text-center">
          <CardTitle class="text-2xl text-white">Crea un Account</CardTitle>
          <CardDescription class="text-gray-400">Inizia a organizzare le tue email in pochi secondi</CardDescription>
        </CardHeader>
        <CardContent>
          <form @submit.prevent="handleRegister" class="space-y-4">
            <div class="space-y-2">
              <Label for="email" class="text-gray-300">Email</Label>
              <Input
                id="email"
                type="email"
                v-model="email"
                required
                placeholder="la.tua@email.com"
                class="bg-gray-800/50 border-gray-600 text-white placeholder:text-gray-500 focus:ring-white"
              />
            </div>
            <div class="space-y-2">
              <Label for="password" class="text-gray-300">Password (min. 6 caratteri)</Label>
              <Input
                id="password"
                type="password"
                v-model="password"
                required
                minlength="6"
                class="bg-gray-800/50 border-gray-600 text-white placeholder:text-gray-500 focus:ring-white"
              />
            </div>
            <div v-if="errorMessage" class="text-red-400 text-sm pt-2">
              {{ errorMessage }}
            </div>
            <div v-if="successMessage" class="text-green-400 text-sm pt-2">
              {{ successMessage }}
            </div>
            <Button type="submit" class="w-full mt-4 bg-white text-gray-900 hover:bg-gray-200" :disabled="loading">
              {{ loading ? 'Registrazione in corso...' : 'Registrati' }}
            </Button>
            <div class="text-center mt-4 text-sm text-gray-400">
              Hai già un account? 
              <NuxtLink to="/login" class="font-semibold text-white hover:underline">
                Accedi
              </NuxtLink>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  </div>
</template>