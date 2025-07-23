<script setup>
import { ref } from 'vue';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
    successMessage.value = 'Registrazione completata!';
  } catch (error) {
    errorMessage.value = error.message;
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="min-h-screen flex flex-col items-center justify-center bg-slate-100 p-4 overflow-hidden">
    <Transition appear name="fade-up">
      <div>
        <div class="mb-8 text-center">
          <h1 class="text-4xl font-bold text-gray-800">Email Organizer</h1>
          <p class="text-gray-600">Il tuo assistente intelligente per la gestione della posta</p>
        </div>
        <Card class="w-full max-w-md shadow-lg">
          <CardHeader class="text-center">
            <CardTitle class="text-2xl">Crea un Account</CardTitle>
            <CardDescription>Inizia a organizzare le tue email in pochi secondi</CardDescription>
          </CardHeader>
          <CardContent>
            <!-- ECCO IL FORM COMPLETO CHE MANCAVA -->
            <form @submit.prevent="handleRegister" class="space-y-4">
              <div class="space-y-2">
                <Label for="email">Email</Label>
                <Input id="email" type="email" v-model="email" required placeholder="la.tua@email.com" />
              </div>
              <div class="space-y-2">
                <Label for="password">Password (min. 6 caratteri)</Label>
                <Input id="password" type="password" v-model="password" required minlength="6" />
              </div>
              <div v-if="errorMessage" class="text-red-500 text-sm pt-2">
                {{ errorMessage }}
              </div>
              <div v-if="successMessage" class="text-green-600 text-sm pt-2">
                {{ successMessage }}
              </div>
              <Button type="submit" class="w-full mt-4" :disabled="loading">
                {{ loading ? 'Registrazione in corso...' : 'Registrati' }}
              </Button>
              <div class="text-center mt-4 text-sm">
                Hai già un account? 
                <NuxtLink to="/login" class="font-semibold text-primary hover:underline">
                  Accedi
                </NuxtLink>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </Transition>
  </div>
</template>

<style>
.fade-up-enter-active,
.fade-up-leave-active {
  transition: opacity 0.5s ease, transform 0.5s ease;
}
.fade-up-enter-from,
.fade-up-leave-to {
  opacity: 0;
  transform: translateY(20px);
}
</style>