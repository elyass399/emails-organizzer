<script setup>
import { ref, shallowRef, onMounted, computed, reactive, watch } from 'vue';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast/use-toast';
import { Toaster } from '@/components/ui/toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { RefreshCw, Users, Edit, List, LogOut, LoaderCircle, Mail, Inbox, UserCheck, Send } from 'lucide-vue-next';

// --- AUTH & RUOLI ---
const supabase = useSupabaseClient();
const router = useRouter();
const user = useSupabaseUser();
const userRole = ref('user');
const staffId = ref(null);
const isLoadingData = ref(true);

const handleLogout = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) console.error('Error logging out:', error);
  router.push('/login');
};

// --- STATI (con shallowRef per le liste) ---
const processedEmails = shallowRef([]);
const { toast } = useToast();
const allStaffMembers = shallowRef([]);
const allClients = shallowRef([]);
const usersWithoutStaffProfile = shallowRef([]);

// --- STATISTICHE ---
const totalEmails = computed(() => processedEmails.value.length);
const totalStaff = computed(() => allStaffMembers.value.length);
const totalClients = computed(() => allClients.value.length);

// --- FILTRO EMAIL ---
const displayedEmails = computed(() => {
  if (userRole.value === 'admin') {
    return processedEmails.value;
  }
  return processedEmails.value.filter(email => email.assigned_to_staff_id === staffId.value);
});

// --- STATO MODALI ---
const showAddStaffDialog = ref(false);
const newStaffForm = reactive({ name: '', text_skills: '', user_id: null });
const isLoadingUsers = ref(false);
const showUpdateStaffDialog = ref(false);
const selectedStaffIdToUpdate = ref(null);
const updateStaffForm = reactive({ text_skills: '' });
const showViewStaffDialog = ref(false);
const showViewClientsDialog = ref(false);
const showConversationModal = ref(false);
const selectedEmail = ref(null);
const conversationHistory = ref([]);
const replyText = ref('');
const isReplying = ref(false);

const currentSelectedStaff = computed(() => {
  return allStaffMembers.value.find(staff => staff.id === selectedStaffIdToUpdate.value) || {};
});

// --- FUNZIONE fetchData (Unica Fonte di Verità) ---
const fetchData = async () => {
  isLoadingData.value = true;
  if (!user.value) { isLoadingData.value = false; return; }
  try {
    const { data: staffDataForUser } = await supabase.from('staff').select('id, role').eq('user_id', user.value.id).single();
    if (staffDataForUser) {
      userRole.value = staffDataForUser.role;
      staffId.value = staffDataForUser.id;
    } else {
      userRole.value = 'user';
      staffId.value = null;
    }
    const [emailsData, allStaffData, clientsData] = await Promise.all([$fetch('/api/inbox'), $fetch('/api/staff'), $fetch('/api/clients')]);
    
    processedEmails.value = emailsData || [];
    allStaffMembers.value = allStaffData || [];
    allClients.value = clientsData || [];

  } catch (error) {
    toast({ title: 'Errore', description: 'Impossibile caricare i dati.', variant: 'destructive' });
  } finally {
    isLoadingData.value = false;
  }
};

watch(user, (newUser) => { if (newUser) { fetchData(); } }, { immediate: true });

// --- FUNZIONI DI GESTIONE ---
const addStaff = async () => {
  if (!newStaffForm.name || !newStaffForm.text_skills || !newStaffForm.user_id) {
    return toast({ title: 'Campi mancanti', description: 'Tutti i campi sono obbligatori.', variant: 'destructive' });
  }
  try {
    await $fetch('/api/staff', { method: 'POST', body: newStaffForm });
    toast({ title: 'Successo!', description: 'Nuovo membro dello staff aggiunto.' });
    showAddStaffDialog.value = false;
    await fetchData();
  } catch (error) {
    toast({ title: 'Errore', description: error.data?.statusMessage || 'Si è verificato un problema.', variant: 'destructive' });
  }
};

const updateStaff = async () => {
  if (!selectedStaffIdToUpdate.value) return;
  try {
    await $fetch(`/api/staff/${selectedStaffIdToUpdate.value}`, { method: 'PUT', body: { text_skills: updateStaffForm.text_skills } });
    toast({ title: 'Successo!', description: 'Competenze aggiornate.' });
    showUpdateStaffDialog.value = false;
    await fetchData();
  } catch (error) {
    toast({ title: 'Errore', description: error.data?.statusMessage || 'Impossibile aggiornare.', variant: 'destructive' });
  }
};

const handleStaffSelectionChange = () => {
  const selected = allStaffMembers.value.find(s => s.id === selectedStaffIdToUpdate.value);
  if (selected) updateStaffForm.text_skills = selected.text_skills;
};

// --- FUNZIONI APERTURA MODALI ---
const openAddStaffDialog = async () => {
    Object.assign(newStaffForm, { name: '', text_skills: '', user_id: null });
    showAddStaffDialog.value = true;
    isLoadingUsers.value = true;
    try {
        usersWithoutStaffProfile.value = await $fetch('/api/users');
    } catch (error) {
        toast({ title: 'Errore', description: "Impossibile caricare l'elenco utenti.", variant: 'destructive' });
    } finally {
        isLoadingUsers.value = false;
    }
};
const openUpdateStaffDialog = () => {
    if (allStaffMembers.value.length > 0) {
        if (!selectedStaffIdToUpdate.value || !allStaffMembers.value.some(s => s.id === selectedStaffIdToUpdate.value)) {
            selectedStaffIdToUpdate.value = allStaffMembers.value[0].id;
        }
        handleStaffSelectionChange();
    }
    showUpdateStaffDialog.value = true;
};
const openViewStaffDialog = () => {
    showViewStaffDialog.value = true;
};
const openViewClientsDialog = () => {
    showViewClientsDialog.value = true;
};

// --- FUNZIONI CONVERSAZIONE ---
const openConversation = (email) => {
    selectedEmail.value = email;
    conversationHistory.value = [{
        id: email.id, sender: email.sender, body: email.body_text || "Corpo non disponibile",
        date: email.created_at, isOwn: false
    }];
    replyText.value = '';
    showConversationModal.value = true;
};

const sendReply = async () => {
  if (!replyText.value.trim() || !selectedEmail.value) return;
  isReplying.value = true;
  try {
    await $fetch('/api/emails/reply', {
      method: 'POST',
      body: {
        originalEmailId: selectedEmail.value.id,
        replyText: replyText.value,
        employeeEmail: selectedEmail.value.staff.email, 
      }
    });
    conversationHistory.value.push({
      id: Date.now(), sender: 'Tu (Studio)', body: replyText.value,
      date: new Date().toISOString(), isOwn: true
    });
    toast({ title: 'Successo!', description: 'Risposta inviata al cliente.' });
    replyText.value = '';
    await fetchData();
  } catch (error) {
    toast({ title: 'Errore', description: 'Impossibile inviare la risposta.', variant: 'destructive' });
  } finally {
    isReplying.value = false;
  }
};

const formatDate = (dateString) => {
    if (!dateString) return 'N/D';
    const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleString('it-IT', options);
};

const formatFollowUpStatus = (client) => {
  if (client.follow_up_email_sent) {
    return `Inviata il ${formatDate(client.follow_up_sent_at)}`;
  }
  const hasAllInfo = client.name && client.phone_number && client.city;
  if (hasAllInfo) {
    return 'Completi';
  }
  return 'Mancanti';
};
</script>

<template>
  <div class="min-h-screen bg-gray-50/50">
    <Toaster />

    <!-- HEADER FISSO -->
    <header class="bg-white border-b border-gray-200 sticky top-0 z-30">
      <div class="container mx-auto flex justify-between items-center p-4">
        <h1 class="text-xl font-bold text-gray-800">Dashboard</h1>
        <div class="flex items-center gap-4">
          <div v-if="user" class="text-sm text-gray-600 hidden sm:block">
            <span class="font-medium">Accesso come:</span> {{ user.email }}
          </div>
          <Button variant="ghost" size="sm" @click="handleLogout">
            <LogOut class="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>
    </header>

    <!-- CONTENUTO PRINCIPALE -->
    <main class="container mx-auto p-4 md:p-8 space-y-8">
      
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 class="text-3xl font-bold tracking-tight text-gray-900">Posta in Arrivo</h2>
          <p v-if="userRole === 'admin'" class="text-gray-500 mt-1">Vista Admin: Tutte le email assegnate nel sistema.</p>
          <p v-else class="text-gray-500 mt-1">Elenco delle email assegnate a te.</p>
        </div>
        <div class="flex gap-2">
          <Button @click="fetchData" :disabled="isLoadingData" variant="outline">
            <RefreshCw :class="['h-4 w-4 mr-2', isLoadingData ? 'animate-spin' : '']" />
            Aggiorna
          </Button>
        </div>
      </div>

      <div v-if="userRole === 'admin'" class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card><CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle class="text-sm font-medium">Email Assegnate</CardTitle><Mail class="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div class="text-2xl font-bold">{{ totalEmails }}</div></CardContent></Card>
        <Card><CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle class="text-sm font-medium">Staff Attivo</CardTitle><Users class="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div class="text-2xl font-bold">{{ totalStaff }}</div></CardContent></Card>
        <Card><CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle class="text-sm font-medium">Clienti Registrati</CardTitle><UserCheck class="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div class="text-2xl font-bold">{{ totalClients }}</div></CardContent></Card>
        
        <Card>
          <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle class="text-sm font-medium">Gestione Rapida</CardTitle>
            <Edit class="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent class="flex items-center justify-center gap-2 pt-4">
              <DropdownMenu>
                <DropdownMenuTrigger as-child><Button variant="outline" class="flex-1"><Users class="h-4 w-4 mr-2" />Staff</Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem @click="openViewStaffDialog"><List class="h-4 w-4 mr-2" />Visualizza Elenco</DropdownMenuItem>
                  <DropdownMenuItem @click="openUpdateStaffDialog"><Edit class="h-4 w-4 mr-2" />Modifica Competenze</DropdownMenuItem>
                  <DropdownMenuItem @click="openAddStaffDialog"><Users class="h-4 w-4 mr-2" />Aggiungi Nuovo</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button @click="openViewClientsDialog" variant="outline" class="flex-1"><List class="h-4 w-4 mr-2" />Clienti</Button>
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader><CardTitle>Email Recenti</CardTitle></CardHeader>
        <CardContent>
          <div v-if="isLoadingData" class="text-center py-20 flex flex-col items-center"><LoaderCircle class="h-8 w-8 animate-spin text-primary mb-4" /><p class="text-muted-foreground">Caricamento...</p></div>
          <Table v-else-if="displayedEmails.length > 0">
            <TableHeader><TableRow>
                <TableHead class="w-[35%]">Mittente</TableHead>
                <TableHead v-if="userRole === 'admin'">Assegnato A</TableHead>
                <TableHead class="text-center">Stato</TableHead>
                <TableHead class="text-right">Ricevuta</TableHead>
                <TableHead class="text-center w-[180px]">Azione</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              <TableRow v-for="email in displayedEmails" :key="email.id" class="hover:bg-gray-50">
                <TableCell><div class="font-medium text-gray-800">{{ email.sender }}</div><div class="text-sm text-gray-500 truncate max-w-xs">{{ email.subject }}</div></TableCell>
                <TableCell v-if="userRole === 'admin'"><Badge variant="secondary">{{ email.staff?.name || 'N/A' }}</Badge></TableCell>
                <TableCell class="text-center"><Badge variant="outline">{{ email.status }}</Badge></TableCell>
                <TableCell class="text-right text-sm text-gray-600">{{ formatDate(email.created_at) }}</TableCell>
                <TableCell class="text-center"><Button @click="openConversation(email)" size="sm">Apri e Rispondi</Button></TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <div v-else class="text-center py-20 flex flex-col items-center"><Inbox class="h-12 w-12 text-gray-300 mb-4" /><h3 class="font-semibold text-gray-800">Nessuna email da visualizzare</h3><p class="text-gray-500 mt-2 text-sm">Non ci sono email che corrispondono ai tuoi criteri.</p></div>
        </CardContent>
      </Card>

      <!-- MODALE CONVERSAZIONE -->
      <Dialog :open="showConversationModal" @update:open="showConversationModal = false">
        <DialogContent v-if="selectedEmail" class="dialog-content-force-white sm:max-w-3xl p-0">
          <div class="h-[80vh] flex flex-col">
            <DialogHeader class="p-6 pb-4 border-b"><DialogTitle>Conversazione con: {{ selectedEmail.sender }}</DialogTitle><p class="text-sm text-muted-foreground">Oggetto: {{ selectedEmail.subject }}</p></DialogHeader>
            <div class="flex-grow overflow-y-auto p-4 space-y-4 bg-slate-50">
              <div v-for="message in conversationHistory" :key="message.id" :class="['flex', message.isOwn ? 'justify-end' : 'justify-start']">
                <div :class="['max-w-lg p-3 rounded-lg shadow-sm', message.isOwn ? 'bg-blue-500 text-white' : 'bg-white text-gray-800']">
                  <p class="text-xs font-bold mb-1">{{ message.sender }}</p><p class="whitespace-pre-wrap">{{ message.body }}</p><p class="text-xs mt-2 text-right opacity-70">{{ formatDate(message.date) }}</p>
                </div>
              </div>
            </div>
            <div class="p-4 mt-auto border-t bg-white"><div class="grid w-full gap-2"><Textarea v-model="replyText" placeholder="Scrivi la tua risposta qui..." class="min-h-[80px]" /><Button @click="sendReply" :disabled="isReplying || !replyText.trim()"><Send class="h-4 w-4 mr-2" />{{ isReplying ? 'Invio in corso...' : 'Invia Risposta' }}</Button></div></div>
          </div> 
        </DialogContent>
      </Dialog>
      
      <!-- MODALE AGGIUNGI STAFF -->
      <Dialog :open="showAddStaffDialog" @update:open="showAddStaffDialog = $event">
        <DialogContent class="dialog-content-force-white">
          <DialogHeader><DialogTitle>Aggiungi Nuovo Membro Staff</DialogTitle><DialogDescription>Seleziona un utente già registrato per creare il suo profilo staff.</DialogDescription></DialogHeader>
          <div v-if="isLoadingUsers" class="text-center py-8"><LoaderCircle class="h-6 w-6 animate-spin mx-auto text-primary" /></div>
          <form v-else @submit.prevent="addStaff">
            <div class="grid gap-4 py-4">
              <div class="grid grid-cols-4 items-center gap-4">
                <Label for="userSelect" class="text-right">Utente Registrato</Label>
                <select id="userSelect" v-model="newStaffForm.user_id" required class="col-span-3 flex h-10 w-full rounded-md border p-2 bg-transparent">
                  <option disabled :value="null">Seleziona un utente...</option>
                  <option v-for="u in usersWithoutStaffProfile" :key="u.id" :value="u.id">{{ u.email }}</option>
                </select>
              </div>
              <div class="grid grid-cols-4 items-center gap-4">
                <Label for="name" class="text-right">Nome Pubblico</Label>
                <Input id="name" v-model="newStaffForm.name" required class="col-span-3" placeholder="Es. Ufficio Contabilità"/>
              </div>
              <div class="grid grid-cols-4 items-center gap-4">
                <Label for="textSkills" class="text-right">Competenze</Label>
                <Textarea id="textSkills" v-model="newStaffForm.text_skills" required class="col-span-3" />
              </div>
            </div>
            <DialogFooter><Button type="button" variant="outline" @click="showAddStaffDialog = false">Annulla</Button><Button type="submit">Aggiungi a Staff</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <!-- MODALE MODIFICA STAFF -->
      <Dialog :open="showUpdateStaffDialog" @update:open="showUpdateStaffDialog = $event">
        <DialogContent class="dialog-content-force-white">
          <DialogHeader><DialogTitle>Modifica Competenze</DialogTitle></DialogHeader>
          <div v-if="isLoadingStaff" class="text-center py-8"><LoaderCircle class="h-6 w-6 animate-spin mx-auto text-primary" /></div>
          <div v-else-if="!allStaffMembers.length" class="text-center py-8">Nessun dipendente da modificare.</div>
          <form v-else @submit.prevent="updateStaff">
            <div class="grid gap-4 py-4">
              <div class="grid grid-cols-4 items-center gap-4">
                <Label for="staffSelect" class="text-right">Dipendente</Label>
                <select id="staffSelect" v-model="selectedStaffIdToUpdate" @change="handleStaffSelectionChange" class="col-span-3 flex h-10 w-full rounded-md border p-2 bg-transparent">
                  <option v-for="staff in allStaffMembers" :key="staff.id" :value="staff.id">{{ staff.name }}</option>
                </select>
              </div>
              <div class="grid grid-cols-4 items-center gap-4">
                <Label for="updateTextSkills" class="text-right">Competenze</Label>
                <Textarea id="updateTextSkills" v-model="updateStaffForm.text_skills" required class="col-span-3" />
              </div>
            </div>
            <DialogFooter><Button type="button" variant="outline" @click="showUpdateStaffDialog = false">Annulla</Button><Button type="submit">Salva Modifiche</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <!-- MODALE VISUALIZZA STAFF -->
      <Dialog :open="showViewStaffDialog" @update:open="showViewStaffDialog = $event">
        <DialogContent class="dialog-content-force-white max-w-4xl"><DialogHeader><DialogTitle>Elenco Dipendenti/Uffici</DialogTitle></DialogHeader>
          <div v-if="isLoadingStaff" class="text-center py-8"><LoaderCircle class="h-6 w-6 animate-spin mx-auto text-primary" /></div>
          <div v-else-if="!allStaffMembers.length" class="text-center py-8">Nessun dipendente trovato.</div>
          <div v-else class="max-h-[500px] overflow-y-auto">
            <Table><TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Email</TableHead><TableHead>Competenze</TableHead></TableRow></TableHeader>
              <TableBody><TableRow v-for="staff in allStaffMembers" :key="staff.id"><TableCell>{{ staff.name }}</TableCell><TableCell>{{ staff.email }}</TableCell><TableCell class="whitespace-normal">{{ staff.text_skills }}</TableCell></TableRow></TableBody>
            </Table>
          </div>
          <DialogFooter><Button type="button" variant="outline" @click="showViewStaffDialog = false">Chiudi</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <!-- MODALE VISUALIZZA CLIENTI -->
      <Dialog :open="showViewClientsDialog" @update:open="showViewClientsDialog = $event">
        <DialogContent class="dialog-content-force-white max-w-5xl"><DialogHeader><DialogTitle>Elenco Clienti</DialogTitle></DialogHeader>
          <div v-if="isLoadingClients" class="text-center py-8"><LoaderCircle class="h-6 w-6 animate-spin mx-auto text-primary" /></div>
          <div v-else-if="!allClients.length" class="text-center py-8">Nessun cliente trovato.</div>
          <div v-else class="max-h-[500px] overflow-y-auto">
            <Table><TableHeader><TableRow><TableHead>Email</TableHead><TableHead>Nome</TableHead><TableHead>Telefono</TableHead><TableHead>Comune</TableHead><TableHead>Follow-up</TableHead></TableRow></TableHeader>
              <TableBody><TableRow v-for="client in allClients" :key="client.id"><TableCell>{{ client.email }}</TableCell><TableCell>{{ client.name || 'N/D' }}</TableCell><TableCell>{{ client.phone_number || 'N/D' }}</TableCell><TableCell>{{ client.city || 'N/D' }}</TableCell><TableCell>{{ formatFollowUpStatus(client) }}</TableCell></TableRow></TableBody>
            </Table>
          </div>
          <DialogFooter><Button type="button" variant="outline" @click="showViewClientsDialog = false">Chiudi</Button></DialogFooter>
        </DialogContent>
      </Dialog>

    </main>
  </div>
</template>