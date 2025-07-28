<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useSupabaseClient, useSupabaseUser, useState } from '#imports';
import { useRouter } from 'vue-router';
import { useToast } from '@/components/ui/toast/use-toast';
import { Toaster } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, LoaderCircle } from 'lucide-vue-next';
import { Input } from '@/components/ui/input';

const supabase = useSupabaseClient();
const user = useSupabaseUser();
const router = useRouter();
const { toast } = useToast();

const isUploading = ref(false);
const loadingProfile = ref(true);

const profile = reactive({
  email: '',
  first_name: '',
  last_name: '',
  text_skills: '',
});

// Usiamo useState per lo stato che deve sopravvivere ai re-render
const avatarUrl = useState('profile-avatar-url', () => useSupabaseUser().value?.user_metadata?.avatar_url || '');
const avatarFile = useState('profile-avatar-file', () => null);

onMounted(async () => {
  if (!user.value) {
    router.push('/login');
    return;
  }
  
  try {
    const { data, error } = await supabase.from('staff').select('first_name, last_name, text_skills').eq('user_id', user.value.id).single();
    if (error) throw error;
    
    // Imposta l'URL iniziale, ma non sovrascrivere l'anteprima se esiste
    if (!avatarUrl.value || !avatarUrl.value.startsWith('blob:')) {
      avatarUrl.value = user.value.user_metadata.avatar_url || '';
    }
    
    profile.email = user.value.email;
    if (data) {
      profile.first_name = data.first_name;
      profile.last_name = data.last_name;
      profile.text_skills = data.text_skills;
    }
  } catch (error) {
    toast({ title: 'Errore', description: 'Impossibile caricare i dati del profilo.', variant: 'destructive' });
  } finally {
    loadingProfile.value = false;
  }
});

const handleFileChange = (event) => {
  const file = event.target.files?.[0];
  if (file) {
    avatarFile.value = file;
    avatarUrl.value = URL.createObjectURL(file);
  }
};

const handleProfileUpdate = async () => {
  isUploading.value = true;
  try {
    const { error: staffError } = await supabase
      .from('staff')
      .update({ first_name: profile.first_name, last_name: profile.last_name })
      .eq('user_id', user.value.id);
    if (staffError) throw new Error(`Errore DB: ${staffError.message}`);

    if (avatarFile.value) {
      const file = avatarFile.value;
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.value.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file, { upsert: true });
      if (uploadError) throw new Error(`Errore Storage: ${uploadError.message}`);
      
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const newPublicUrl = urlData.publicUrl;

      const { error: updateUserError } = await supabase.auth.updateUser({ data: { avatar_url: newPublicUrl } });
      if (updateUserError) throw new Error(`Errore Auth: ${updateUserError.message}`);
      
      // Aggiorna l'URL con quello definitivo
      avatarUrl.value = newPublicUrl;
    }
    
    // Un refresh della sessione è comunque una buona pratica per sincronizzare lo stato
    await supabase.auth.refreshSession();
    
    toast({ title: 'Successo!', description: 'Il tuo profilo è stato aggiornato.' });
    avatarFile.value = null; // Pulisci il file selezionato

  } catch (error) {
    toast({ title: 'Errore', description: error.message, variant: 'destructive' });
  } finally {
    isUploading.value = false;
  }
};
</script>

<template>
  <div class="min-h-screen bg-slate-50">
    <Toaster />
    <header class="bg-purple-700 text-white shadow-md sticky top-0 z-30">
        <div class="container mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex items-center h-16">
                <NuxtLink to="/" class="flex items-center gap-2 hover:text-purple-200 transition-colors">
                    <ArrowLeft class="h-5 w-5" />
                    <span class="font-medium">Torna alla Dashboard</span>
                </NuxtLink>
            </div>
        </div>
    </header>
    <main class="container mx-auto p-4 sm:p-6 lg:p-8">
        <div v-if="loadingProfile" class="flex justify-center items-center h-64">
            <LoaderCircle class="h-8 w-8 animate-spin text-indigo-500" />
        </div>
        <div v-else class="max-w-4xl mx-auto space-y-8">
            <div>
                <h1 class="text-3xl font-bold text-gray-900">Il Mio Profilo</h1>
                <p class="text-gray-500 mt-1">Gestisci le tue informazioni personali e preferenze.</p>
            </div>
            <form @submit.prevent="handleProfileUpdate" class="space-y-6">
                <Card class="border-indigo-200 shadow-sm">
                    <CardHeader>
                        <CardTitle>Immagine Profilo</CardTitle>
                    </CardHeader>
                    <CardContent class="flex items-center gap-6">
                        <Avatar class="h-24 w-24">
                            <AvatarImage :src="avatarUrl" :key="avatarUrl" alt="Avatar" />
                            <AvatarFallback class="bg-slate-200 text-3xl">
                                {{ profile.first_name?.charAt(0) }}{{ profile.last_name?.charAt(0) }}
                            </AvatarFallback>
                        </Avatar>
                        <div class="grid w-full max-w-sm items-center gap-1.5">
                            <Label for="picture">Carica una nuova immagine</Label>
                            <input 
                              id="picture" 
                              type="file" 
                              @change="handleFileChange" 
                              accept="image/png, image/jpeg"
                              class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-slate-500 ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            />
                            <p class="text-sm text-muted-foreground">PNG o JPG (consigliato 1:1).</p>
                        </div>
                    </CardContent>
                </Card>
                <Card class="border-indigo-200 shadow-sm">
                    <CardHeader>
                        <CardTitle>Informazioni Personali</CardTitle>
                        <CardDescription>Queste informazioni saranno visibili agli amministratori.</CardDescription>
                    </CardHeader>
                    <CardContent class="space-y-4 pt-6">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div class="space-y-2"><Label for="first_name">Nome</Label><Input id="first_name" v-model="profile.first_name" /></div>
                            <div class="space-y-2"><Label for="last_name">Cognome</Label><Input id="last_name" v-model="profile.last_name" /></div>
                        </div>
                        <div class="space-y-2"><Label for="email">Email</Label><Input id="email" v-model="profile.email" disabled class="bg-slate-100 cursor-not-allowed" /></div>
                        <div class="space-y-2"><Label for="text_skills">Descrizione Competenze</Label><Textarea id="text_skills" v-model="profile.text_skills" disabled class="bg-slate-100 min-h-[100px] cursor-not-allowed" /></div>
                    </CardContent>
                </Card>
                <div class="flex justify-end">
                    <Button type="submit" :disabled="isUploading" class="bg-purple-700 hover:bg-purple-800 text-white">
                        <LoaderCircle v-if="isUploading" class="mr-2 h-4 w-4 animate-spin" />
                        {{ isUploading ? 'Salvataggio...' : 'Salva Modifiche' }}
                    </Button>
                </div>
            </form>
        </div>
    </main>
  </div>
</template>