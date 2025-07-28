<script setup>
import { ref } from 'vue';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const supabase = useSupabaseClient();
const router = useRouter();
const email = ref('');
const password = ref('');
const errorMessage = ref(null);
const loading = ref(false);

const handleLogin = async () => {
  loading.value = true;
  errorMessage.value = null;
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.value,
      password: password.value,
    });
    if (error) throw error;
    router.push('/');
  } catch (error) {
    errorMessage.value = error.message;
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="relative min-h-screen w-full flex items-center justify-center overflow-hidden">
    
    <video 
      autoplay 
      loop 
      muted 
      playsinline 
      class="absolute z-0 w-full h-full object-cover"
    >
      <source src="/videos/vidLogin.mp4" type="video/mp4">
      Il tuo browser non supporta i video.
    </video>
    
    <div class="absolute z-10 inset-0 bg-black/50"></div>

    <div class="relative z-20 flex flex-col items-center justify-center p-4">
      <div class="mb-8 text-center">
        <!-- MODIFICA QUI: Aggiunto Logo -->
        <img src="/images/logo.png" alt="FlashMail Logo" class="h-16 w-auto mx-auto mb-4">
        
        <h1 class="text-5xl font-bold text-white [text-shadow:_0_2px_4px_rgb(0_0_0_/_40%)]">
          FlashMail
        </h1>
        <p class="text-gray-300 mt-2 [text-shadow:_0_1px_2px_rgb(0_0_0_/_30%)]">
          Il tuo assistente intelligente per la gestione della posta
        </p>
      </div>

      <Card class="w-full max-w-md bg-gray-900/40 backdrop-blur-md border-gray-500/30 text-white">
        <CardHeader class="text-center">
          <CardTitle class="text-2xl text-white">Bentornato!</CardTitle>
          <CardDescription class="text-gray-400">Accedi al tuo account per continuare</CardDescription>
        </CardHeader>
        <CardContent>
          <form @submit.prevent="handleLogin" class="space-y-4">
            <div class="space-y-2">
              <Label for="email" class="text-gray-300">Email</Label>
              <Input
                id="email"
                type="email"
                v-model="email"
                required
                placeholder="mario.rossi@esempio.com"
                class="bg-gray-800/50 border-gray-600 text-white placeholder:text-gray-500 focus:ring-white"
              />
            </div>
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <Label for="password" class="text-gray-300">Password</Label>
                <NuxtLink to="/forgot-password" class="text-xs text-gray-400 hover:text-white hover:underline">
                  Password dimenticata?
                </NuxtLink>
              </div>
              <Input
                id="password"
                type="password"
                v-model="password"
                required
                class="bg-gray-800/50 border-gray-600 text-white placeholder:text-gray-500 focus:ring-white"
              />
            </div>
            <div v-if="errorMessage" class="text-red-400 text-sm pt-2">
              {{ errorMessage }}
            </div>
            <Button type="submit" class="w-full mt-4 bg-white text-gray-900 hover:bg-gray-200" :disabled="loading">
              {{ loading ? 'Accesso in corso...' : 'Accedi' }}
            </Button>
            
          </form>
        </CardContent>
      </Card>
    </div>
  </div>
</template>