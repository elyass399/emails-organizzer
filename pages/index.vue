<script setup>
import { ref, shallowRef, onMounted, computed, reactive, watch, nextTick } from 'vue';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogScrollContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast/use-toast';
import { Toaster } from '@/components/ui/toast';
import { RefreshCw, Users, Edit, List, LogOut, LoaderCircle, CheckCircle, Send, User as UserIcon, X as XIcon, MessageSquare, Archive } from 'lucide-vue-next';

// --- STATO PRINCIPALE ---
const supabase = useSupabaseClient();
const router = useRouter();
const user = useSupabaseUser();
const { toast } = useToast();
const userRole = ref('user');
const staffId = ref(null);
const staffProfileData = ref(null);

const isLoadingData = ref(true);
const conversations = shallowRef([]);
const allStaffMembers = shallowRef([]);
const allClients = shallowRef([]);

// --- STATO DEI FILTRI ---
const filters = reactive({
    staffId: 'all',
    status: 'active',
    startDate: '',
    endDate: ''
});

// --- FETCH DATA ---
const fetchData = async () => {
  isLoadingData.value = true;
  try {
    if (!staffProfileData.value) {
        const { data: staffDataForUser } = await supabase.from('staff').select('id, role, first_name, last_name, email').eq('user_id', user.value.id).single();
        if (staffDataForUser) {
          userRole.value = staffDataForUser.role;
          staffId.value = staffDataForUser.id;
          staffProfileData.value = staffDataForUser;
        }
        const [staffData, clientsData] = await Promise.all([$fetch('/api/staff'), $fetch('/api/clients')]);
        allStaffMembers.value = staffData || [];
        allClients.value = clientsData || [];
    }
    
    const queryParams = new URLSearchParams();
    if (filters.status !== 'all') {
        if (filters.status === 'active') { /* L'API gestisce il default */ } 
        else { queryParams.append('status', filters.status); }
    }
    if (userRole.value === 'admin' && filters.staffId !== 'all') {
        queryParams.append('staffId', filters.staffId);
    }
    if (userRole.value !== 'admin') {
        queryParams.append('staffId', staffId.value);
    }
    if (filters.startDate) queryParams.append('startDate', filters.startDate);
    if (filters.endDate) queryParams.append('endDate', filters.endDate);

    const convData = await $fetch(`/api/conversations?${queryParams.toString()}`);
    conversations.value = convData || [];

  } catch (error) {
    console.error("Fetch Data Error:", error);
    toast({ title: 'Errore', description: 'Impossibile caricare i dati.', variant: 'destructive' });
  } finally {
    isLoadingData.value = false;
  }
};
watch(user, (newUser) => { if (newUser) { fetchData(); } }, { immediate: true });
watch(filters, fetchData, { deep: true });

const clearFilters = () => {
    filters.staffId = 'all';
    filters.status = 'active';
    filters.startDate = '';
    filters.endDate = '';
};
const isFilterActive = computed(() => {
    return filters.staffId !== 'all' || filters.status !== 'active' || filters.startDate || filters.endDate;
});

// --- GESTIONE CONVERSAZIONE ATTIVA ---
const showConversationModal = ref(false);
const activeConversation = ref(null);
const isLoadingConversation = ref(false);
const replyText = ref('');
const isReplying = ref(false);
const isClosing = ref(false);

const openConversation = async (conversation) => {
    activeConversation.value = null;
    replyText.value = '';
    isLoadingConversation.value = true;
    showConversationModal.value = true;
    try {
        const fullConversation = await $fetch(`/api/conversations/${conversation.id}`);
        activeConversation.value = fullConversation;
    } catch (error) {
        toast({ title: 'Errore', description: 'Impossibile caricare la conversazione.', variant: 'destructive'});
        showConversationModal.value = false;
    } finally {
        isLoadingConversation.value = false;
    }
};

const sendReply = async () => {
    if (!replyText.value.trim() || !activeConversation.value) return;
    isReplying.value = true;
    try {
        await $fetch('/api/emails/reply', {
            method: 'POST',
            body: { 
                conversationId: activeConversation.value.id, 
                replyText: replyText.value, 
                employeeEmail: staffProfileData.value.email 
            }
        });
        await fetchData();
        showConversationModal.value = false;
        toast({ title: 'Successo!', description: 'Risposta inviata.' });
    } catch (error) {
        toast({ title: 'Errore', description: 'Impossibile inviare la risposta.', variant: 'destructive' });
    } finally {
        isReplying.value = false;
    }
};

const resolveAndCloseConversation = async () => {
    if (!activeConversation.value) return;
    isClosing.value = true;
    try {
        await $fetch(`/api/conversations/${activeConversation.value.id}`, {
            method: 'PUT',
            body: {
                status: 'closed',
                resolution: 'resolved'
            }
        });
        await fetchData();
        showConversationModal.value = false;
        toast({ title: 'Successo', description: 'La conversazione è stata chiusa e segnata come risolta.' });
    } catch (error) {
        toast({ title: 'Errore', description: 'Impossibile chiudere la conversazione.', variant: 'destructive' });
    } finally {
        isClosing.value = false;
    }
};

// --- GESTIONE ARCHIVIO ---
const showClosedDialog = ref(false);
const closedConversations = shallowRef([]);
const isLoadingClosed = ref(false);

const openViewClosedDialog = async () => {
    showClosedDialog.value = true;
    isLoadingClosed.value = true;
    try {
        const data = await $fetch('/api/conversations/closed');
        closedConversations.value = data || [];
    } catch (error) {
        toast({ title: 'Errore', description: 'Impossibile caricare l\'archivio.', variant: 'destructive'});
    } finally {
        isLoadingClosed.value = false;
    }
};

// --- GESTIONE ELIMINAZIONE ---
const showConfirmDeleteDialog = ref(false);
const conversationToDelete = ref(null);
const isDeleting = ref(false);

const openConfirmDeleteDialog = (conversation) => {
    conversationToDelete.value = conversation;
    showConfirmDeleteDialog.value = true;
};

const deleteConversation = async () => {
    if (!conversationToDelete.value) return;
    isDeleting.value = true;
    try {
        await $fetch(`/api/conversations/${conversationToDelete.value.id}`, {
            method: 'DELETE'
        });
        
        closedConversations.value = closedConversations.value.filter(
            c => c.id !== conversationToDelete.value.id
        );
        
        toast({ title: 'Successo', description: 'La conversazione è stata eliminata.' });
    } catch (error) {
        toast({ title: 'Errore', description: 'Impossibile eliminare la conversazione.', variant: 'destructive'});
    } finally {
        isDeleting.value = false;
        showConfirmDeleteDialog.value = false;
        conversationToDelete.value = null;
    }
};

// --- GESTIONE ADMIN: STAFF & CLIENTI ---
const showAddStaffDialog = ref(false);
const newStaffForm = reactive({ first_name: '', last_name: '', email: '', text_skills: '', role: 'staff' });
const showUpdateStaffDialog = ref(false);
const selectedStaffIdToUpdate = ref(null);
const updateStaffForm = reactive({ text_skills: '' });
const showViewStaffDialog = ref(false);
const showViewClientsDialog = ref(false);
const showStaffMenuDialog = ref(false);

const addStaff = async () => {
  if (!newStaffForm.email || !newStaffForm.first_name || !newStaffForm.last_name || !newStaffForm.role) {
    return toast({ title: 'Campi mancanti', description: 'Tutti i campi sono obbligatori.', variant: 'destructive' });
  }
  try {
    await $fetch('/api/staff/admin-create', { method: 'POST', body: newStaffForm });
    toast({ title: 'Successo!', description: 'Nuovo utente creato. Verrà inviata un\'email con le istruzioni.' });
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
  if (selected) {
    updateStaffForm.text_skills = selected.text_skills;
  }
};

const openAddStaffDialog = () => {
  Object.assign(newStaffForm, { first_name: '', last_name: '', email: '', text_skills: '', role: 'staff' });
  showAddStaffDialog.value = true;
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

const openViewStaffDialog = () => { showViewStaffDialog.value = true; };
const openViewClientsDialog = () => { showViewClientsDialog.value = true; };

// --- FUNZIONI UTILI ---
const handleLogout = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) console.error('Error logging out:', error);
  router.push('/login');
};

const formatDate = (dateString) => {
  if (!dateString) return 'N/D';
  const options = { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' };
  return new Date(dateString).toLocaleDateString('it-IT', options);
};

const getStatusClass = (status) => {
  switch (status) {
    case 'open': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'awaiting_client': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'closed': return 'bg-green-100 text-green-800 border-green-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const formatMessageBody = (text) => {
    if (!text) return '';
    return text.split(/\n>|On .* wrote:|Il giorno .* ha scritto:/)[0].trim();
}
</script>

<template>
  <div class="min-h-screen bg-slate-50">
    <Toaster />
    <header class="bg-purple-600 text-white shadow-md sticky top-0 z-30">
        <div class="container mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex justify-between items-center h-16">
                <NuxtLink to="/" class="flex items-center gap-3">
                    <img src="/images/logo.png" alt="FlashMail Logo" class="h-8 w-auto">
                    <h1 class="text-2xl font-bold tracking-wider">FlashMail</h1>
                </NuxtLink>
                <div class="flex items-center gap-2">
                    <Button @click="fetchData" :disabled="isLoadingData" variant="ghost" class="relative h-10 w-10 rounded-full p-0 flex items-center justify-center hover:bg-purple-700 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none transition-colors">
                      <RefreshCw :class="['h-5 w-5', isLoadingData ? 'animate-spin' : '']" />
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger class="relative h-10 w-10 rounded-full p-0 flex items-center justify-center hover:bg-purple-700 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none transition-colors">
                            <Avatar class="h-9 w-9">
                                <AvatarImage :src="user?.user_metadata?.avatar_url" alt="Avatar" />
                                <AvatarFallback class="bg-purple-400 text-white">{{ staffProfileData?.first_name?.charAt(0) }}{{ staffProfileData?.last_name?.charAt(0) }}</AvatarFallback>
                            </Avatar>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent class="w-56 bg-white" align="end">
                            <DropdownMenuLabel class="font-normal"><div class="flex flex-col space-y-1"><p class="text-sm font-medium leading-none">{{ staffProfileData?.first_name }} {{ staffProfileData?.last_name }}</p><p class="text-xs leading-none text-muted-foreground">{{ user?.email }}</p></div></DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <NuxtLink to="/profile"><DropdownMenuItem><UserIcon class="mr-2 h-4 w-4" /><span>Profilo</span></DropdownMenuItem></NuxtLink>
                             <DropdownMenuSeparator />
                            <DropdownMenuItem @click="handleLogout" class="text-red-600 focus:bg-red-50 focus:text-red-700"><LogOut class="mr-2 h-4 w-4" /><span>Logout</span></DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
        </div>
    </header>

    <main class="container mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
        <div class="flex justify-between items-start">
            <div>
                <h2 class="text-3xl font-bold tracking-tight text-gray-900">Conversazioni</h2>
                <p class="text-gray-500 mt-1">Elenco delle conversazioni che richiedono la tua attenzione.</p>
            </div>
            <div v-if="userRole === 'admin'" class="flex items-center gap-2">
                 <Button @click="showStaffMenuDialog = true" variant="outline"><Users class="h-4 w-4 mr-2" />Gestisci Staff</Button>
                 <Button @click="openViewClientsDialog" variant="outline"><List class="h-4 w-4 mr-2" />Elenco Clienti</Button>
                 <Button @click="openViewClosedDialog" variant="outline"><Archive class="h-4 w-4 mr-2" />Archivio</Button>
            </div>
        </div>
        
        <Card class="shadow-sm">
            <CardContent class="pt-6">
                <div class="grid grid-cols-1 md:grid-cols-4 items-end gap-4">
                    <div v-if="userRole === 'admin'">
                        <Label for="staff-filter">Filtra per Dipendente</Label>
                        <select id="staff-filter" v-model="filters.staffId" class="mt-1 flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                            <option value="all">Tutti i dipendenti</option>
                            <option v-for="staff in allStaffMembers" :key="staff.id" :value="staff.id">{{ staff.first_name }} {{ staff.last_name }}</option>
                        </select>
                    </div>
                     <div>
                        <Label for="status-filter">Filtra per Stato</Label>
                        <select id="status-filter" v-model="filters.status" class="mt-1 flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm">
                            <option value="active">Attive</option>
                            <option value="open">Aperte</option>
                            <option value="awaiting_client">In attesa del cliente</option>
                            <option value="closed">Chiuse</option>
                            <option value="all">Tutte</option>
                        </select>
                    </div>
                    <div><Label for="date-start">Da</Label><Input id="date-start" type="date" v-model="filters.startDate" class="mt-1" /></div>
                    <div><Label for="date-end">A</Label><Input id="date-end" type="date" v-model="filters.endDate" class="mt-1" /></div>
                </div>
                <div v-if="isFilterActive" class="mt-4 flex justify-end">
                  <Button @click="clearFilters" variant="ghost" size="sm"><XIcon class="h-4 w-4 mr-2" />Reset Filtri</Button>
                </div>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Conversazioni ({{ conversations.length }})</CardTitle>
            </CardHeader>
            <CardContent>
                <div v-if="isLoadingData" class="text-center py-20">
                    <LoaderCircle class="h-8 w-8 animate-spin text-purple-500 mx-auto" />
                    <p class="text-muted-foreground mt-2">Caricamento conversazioni...</p>
                </div>
                <div v-else class="space-y-3">
                    <div v-if="conversations.length === 0" class="text-center py-12 border-2 border-dashed rounded-lg">
                        <p class="text-muted-foreground">Nessuna conversazione trovata con i filtri correnti.</p>
                    </div>
                    
                    <div v-for="conv in conversations" :key="conv.id" 
                         @click="openConversation(conv)"
                         class="border rounded-lg hover:shadow-md transition-shadow cursor-pointer bg-white">
                        
                        <div class="p-4 flex justify-between items-center gap-4">
                            <div class="flex-grow overflow-hidden">
                                <p class="font-semibold truncate">{{ conv.subject }}</p>
                                <p class="text-sm text-muted-foreground truncate">
                                    <span class="font-medium text-slate-800">{{ conv.client.name || conv.client.email }}</span>
                                    <span> - {{ formatMessageBody(conv.last_message.body_text) }}</span>
                                </p>
                                <p v-if="userRole === 'admin'" class="text-xs text-slate-500 mt-1">
                                    Assegnato a: {{ conv.staff ? conv.staff.first_name : 'N/A' }}
                                </p>
                            </div>
                            <div class="flex-shrink-0 flex items-center gap-4 ml-4">
                                <div class="text-right">
                                    <Badge variant="outline" :class="getStatusClass(conv.status)">{{ conv.status }}</Badge>
                                    <p class="text-xs text-muted-foreground mt-1">{{ formatDate(conv.updated_at) }}</p>
                                </div>
                                <MessageSquare class="h-5 w-5 text-slate-400 flex-shrink-0" />
                            </div>
                        </div>
                    </div>

                </div>
            </CardContent>
        </Card>
    </main>
    
    <!-- MODALE CONVERSAZIONE -->
    <Dialog :open="showConversationModal" @update:open="showConversationModal = $event">
      <DialogScrollContent>
        <div class="sm:max-w-6xl w-full mx-auto">
            <DialogHeader v-if="activeConversation" class="p-4 border-b text-left sticky top-0 bg-white z-10">
              <div class="flex flex-row justify-between items-center">
                <div>
                  <DialogTitle class="text-lg">Conversazione: {{ activeConversation.subject }}</DialogTitle>
                  <p class="text-sm text-muted-foreground">Cliente: {{ activeConversation.client.name || activeConversation.client.email }}</p>
                </div>
                <Button 
                  v-if="activeConversation.status !== 'closed'"
                  @click="resolveAndCloseConversation" 
                  variant="outline" 
                  size="sm"
                  :disabled="isClosing"
                  class="bg-green-50 hover:bg-green-100 text-green-700 border-green-300">
                  <LoaderCircle v-if="isClosing" class="mr-2 h-4 w-4 animate-spin" />
                  <CheckCircle v-else class="mr-2 h-4 w-4" />
                  Risolvi e Chiudi
                </Button>
                <Badge v-else variant="outline" class="bg-green-100 text-green-800 border-green-200">
                  Chiusa (Risolto)
                </Badge>
              </div>
            </DialogHeader>
            <div v-if="isLoadingConversation" class="py-20 flex items-center justify-center">
                <LoaderCircle class="h-8 w-8 animate-spin text-purple-500"/>
            </div>
            <div v-else-if="activeConversation" class="p-6 space-y-6 bg-slate-50 overflow-y-auto">
                <div v-for="message in activeConversation.messages" :key="message.id" 
                     :class="['flex w-full flex-col', message.sender_type === 'staff' ? 'items-end' : 'items-start']">
                    <p :class="['text-xs font-bold mb-1', message.sender_type === 'staff' ? 'text-purple-700' : 'text-slate-600']">
                        {{ message.sender_type === 'staff' ? 'Tu (Staff)' : 'Cliente' }}
                    </p>
                    <div :class="['max-w-xl p-3 rounded-lg shadow-sm', message.sender_type === 'staff' ? 'bg-purple-600 text-white rounded-br-none' : 'bg-white text-gray-800 border rounded-bl-none']">
                        <p class="whitespace-pre-wrap text-sm leading-relaxed">{{ formatMessageBody(message.body_text) }}</p>
                    </div>
                     <p class="text-xs mt-1 text-slate-400">{{ formatDate(message.created_at) }}</p>
                </div>
            </div>
            <DialogFooter v-if="activeConversation && activeConversation.status !== 'closed'" class="p-4 border-t bg-white sticky bottom-0">
                <div class="grid w-full gap-2">
                    <Textarea v-model="replyText" placeholder="Scrivi la tua risposta..." class="min-h-[100px]" />
                    <Button @click="sendReply" :disabled="isReplying || !replyText.trim()" class="bg-purple-600 hover:bg-purple-700 text-white">
                        <Send class="h-4 w-4 mr-2" />{{ isReplying ? 'Invio in corso...' : 'Invia Risposta' }}
                    </Button>
                </div>
            </DialogFooter>
        </div>
      </DialogScrollContent>
    </Dialog>

    <!-- MODALE ARCHIVIO -->
    <Dialog :open="showClosedDialog" @update:open="showClosedDialog = $event">
        <DialogContent>
            <div class="max-w-6xl w-full mx-auto">
                <DialogHeader>
                    <DialogTitle class="text-xl font-semibold">Archivio Conversazioni Chiuse</DialogTitle>
                    <DialogDescription>Elenco di tutte le conversazioni che sono state chiuse.</DialogDescription>
                </DialogHeader>
                <div v-if="isLoadingClosed" class="text-center py-20">
                    <LoaderCircle class="h-8 w-8 animate-spin text-purple-500 mx-auto" />
                    <p class="mt-2 text-muted-foreground">Caricamento archivio...</p>
                </div>
                <div v-else class="mt-4 border rounded-lg overflow-auto max-h-[60vh]">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead class="w-[20%]">Cliente</TableHead>
                                <TableHead class="w-[30%]">Oggetto</TableHead>
                                <TableHead class="w-[15%]" v-if="userRole === 'admin'">Gestita da</TableHead>
                                <TableHead class="w-[15%]">Risoluzione</TableHead>
                                <TableHead class="w-[15%] text-right">Data Chiusura</TableHead>
                                <TableHead class="w-[5%]" v-if="userRole === 'admin'"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow v-if="closedConversations.length === 0">
                                <TableCell :colspan="userRole === 'admin' ? 6 : 5" class="p-12 text-center text-muted-foreground">L'archivio è vuoto.</TableCell>
                            </TableRow>
                            <TableRow v-for="conv in closedConversations" :key="conv.id">
                                <TableCell class="font-medium">{{ conv.client.name || conv.client.email }}</TableCell>
                                <TableCell>{{ conv.subject }}</TableCell>
                                <TableCell v-if="userRole === 'admin'">{{ conv.staff ? conv.staff.first_name : 'N/A' }}</TableCell>
                                <TableCell>
                                    <Badge variant="outline" :class="conv.resolution_status === 'resolved' ? 'text-green-700 border-green-300' : 'text-red-700 border-red-300'">
                                        {{ conv.resolution_status === 'resolved' ? 'Risolto' : 'Non Risolto' }}
                                    </Badge>
                                </TableCell>
                                <TableCell class="text-right text-sm">{{ formatDate(conv.updated_at) }}</TableCell>
                                <TableCell v-if="userRole === 'admin'">
                                    <Button @click="openConfirmDeleteDialog(conv)" variant="ghost" size="icon" class="text-red-500 hover:text-red-700">
                                        <Trash2 class="h-4 w-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>
                <DialogFooter class="pt-4">
                    <Button type="button" variant="outline" @click="showClosedDialog = false">Chiudi</Button>
                </DialogFooter>
            </div>
        </DialogContent>
    </Dialog>
    
    <!-- MODALE CONFERMA ELIMINAZIONE -->
    <Dialog :open="showConfirmDeleteDialog" @update:open="showConfirmDeleteDialog = $event">
        <DialogContent>
            <div class="sm:max-w-md w-full mx-auto">
                <DialogHeader>
                    <DialogTitle>Conferma Eliminazione</DialogTitle>
                    <DialogDescription>
                        Sei sicuro di voler eliminare permanentemente questa conversazione? L'azione non può essere annullata.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" @click="showConfirmDeleteDialog = false">Annulla</Button>
                    <Button variant="destructive" @click="deleteConversation" :disabled="isDeleting">
                        <LoaderCircle v-if="isDeleting" class="mr-2 h-4 w-4 animate-spin" />
                        Elimina
                    </Button>
                </DialogFooter>
            </div>
        </DialogContent>
    </Dialog>

    <!-- MODALI ADMIN -->
    <Dialog :open="showStaffMenuDialog" @update:open="showStaffMenuDialog = $event"><DialogContent><div class="sm:max-w-[425px] w-full mx-auto"><DialogHeader><DialogTitle>Gestione Staff</DialogTitle><DialogDescription>Seleziona un'azione da eseguire.</DialogDescription></DialogHeader><div class="grid gap-2 pt-4"><button @click="() => { showStaffMenuDialog = false; openViewStaffDialog(); }" class="flex items-center text-left w-full p-3 rounded-md hover:bg-slate-100 transition-colors"><List class="h-5 w-5 mr-3 text-slate-500" /><span class="font-medium">Visualizza Elenco</span></button><button @click="() => { showStaffMenuDialog = false; openUpdateStaffDialog(); }" class="flex items-center text-left w-full p-3 rounded-md hover:bg-slate-100 transition-colors"><Edit class="h-5 w-5 mr-3 text-slate-500" /><span class="font-medium">Modifica Competenze</span></button><button @click="() => { showStaffMenuDialog = false; openAddStaffDialog(); }" class="flex items-center text-left w-full p-3 rounded-md hover:bg-slate-100 transition-colors"><Users class="h-5 w-5 mr-3 text-slate-500" /><span class="font-medium">Aggiungi Nuovo</span></button></div></div></DialogContent></Dialog>
    <Dialog :open="showAddStaffDialog" @update:open="showAddStaffDialog = $event"><DialogContent><div class="w-full mx-auto"><DialogHeader class="border-b pb-4"><DialogTitle class="text-xl">Crea Nuovo Profilo Staff</DialogTitle><DialogDescription class="pt-1">Verrà inviata un'email di invito per impostare la password.</DialogDescription></DialogHeader><form @submit.prevent="addStaff"><div class="grid gap-4 py-4"><div class="grid grid-cols-4 items-center gap-4"><Label for="first_name" class="text-right">Nome</Label><Input id="first_name" v-model="newStaffForm.first_name" required class="col-span-3" /></div><div class="grid grid-cols-4 items-center gap-4"><Label for="last_name" class="text-right">Cognome</Label><Input id="last_name" v-model="newStaffForm.last_name" required class="col-span-3" /></div><div class="grid grid-cols-4 items-center gap-4"><Label for="email" class="text-right">Email</Label><Input id="email" type="email" v-model="newStaffForm.email" required class="col-span-3" /></div><div class="grid grid-cols-4 items-center gap-4"><Label for="role" class="text-right">Ruolo</Label><select id="role" v-model="newStaffForm.role" required class="col-span-3 flex h-10 w-full rounded-md border p-2 bg-transparent"><option value="staff">Staff</option><option value="admin">Admin</option></select></div><div class="grid grid-cols-4 items-center gap-4"><Label for="textSkills" class="text-right">Competenze</Label><Textarea id="textSkills" v-model="newStaffForm.text_skills" class="col-span-3" /></div></div><DialogFooter><Button type="button" variant="outline" @click="showAddStaffDialog = false">Annulla</Button><Button type="submit">Crea Utente</Button></DialogFooter></form></div></DialogContent></Dialog>
    <Dialog :open="showUpdateStaffDialog" @update:open="showUpdateStaffDialog = $event"><DialogContent><div class="w-full mx-auto"><DialogHeader class="border-b pb-4"><DialogTitle class="text-xl">Modifica Competenze</DialogTitle></DialogHeader><form v-if="allStaffMembers.length" @submit.prevent="updateStaff" class="pt-4"><div class="grid gap-4 py-4"><div class="grid grid-cols-4 items-center gap-4"><Label for="staffSelect" class="text-right">Dipendente</Label><select id="staffSelect" v-model="selectedStaffIdToUpdate" @change="handleStaffSelectionChange" class="col-span-3 flex h-10 w-full rounded-md border p-2 bg-transparent"><option v-for="staff in allStaffMembers" :key="staff.id" :value="staff.id">{{ staff.first_name }} {{ staff.last_name }}</option></select></div><div class="grid grid-cols-4 items-center gap-4"><Label for="updateTextSkills" class="text-right">Competenze</Label><Textarea id="updateTextSkills" v-model="updateStaffForm.text_skills" required class="col-span-3" /></div></div><DialogFooter><Button type="button" variant="outline" @click="showUpdateStaffDialog = false">Annulla</Button><Button type="submit">Salva Modifiche</Button></DialogFooter></form></div></DialogContent></Dialog>
    <Dialog :open="showViewStaffDialog" @update:open="showViewStaffDialog = $event"><DialogContent><div class="max-w-4xl w-full mx-auto"><DialogHeader class="border-b pb-4"><DialogTitle class="text-xl font-semibold">Elenco Dipendenti</DialogTitle></DialogHeader><div class="mt-4 border rounded-lg overflow-auto max-h-[60vh]"><Table class="w-full table-fixed"><colgroup><col class="w-[20%]" /><col class="w-[30%]" /><col class="w-[50%]" /></colgroup><TableBody><TableRow v-for="staff in allStaffMembers" :key="staff.id" class="border-t"><TableCell class="p-4 font-medium align-top">{{ staff.first_name }} {{ staff.last_name }}</TableCell><TableCell class="p-4 align-top">{{ staff.email }}</TableCell><TableCell class="p-4 text-slate-600 text-sm align-top whitespace-normal">{{ staff.text_skills }}</TableCell></TableRow></TableBody></Table></div><DialogFooter class="pt-4"><Button type="button" variant="outline" @click="showViewStaffDialog = false">Chiudi</Button></DialogFooter></div></DialogContent></Dialog>
    <Dialog :open="showViewClientsDialog" @update:open="showViewClientsDialog = $event"><DialogContent><div class="max-w-5xl w-full mx-auto"><DialogHeader class="border-b pb-4"><DialogTitle class="text-xl font-semibold">Elenco Clienti</DialogTitle></DialogHeader><div class="mt-4 border rounded-lg overflow-auto max-h-[60vh]"><Table class="w-full table-fixed"><colgroup><col class="w-[30%]" /><col class="w-[25%]" /><col class="w-[20%]" /><col class="w-[25%]" /></colgroup><TableBody><TableRow v-for="client in allClients" :key="client.id" class="border-t"><TableCell class="p-4 font-medium">{{ client.email }}</TableCell><TableCell class="p-4">{{ client.name || 'N/D' }}</TableCell><TableCell class="p-4">{{ client.phone_number || 'N/D' }}</TableCell><TableCell class="p-4">{{ client.city || 'N/D' }}</TableCell></TableRow></TableBody></Table></div><DialogFooter class="pt-4"><Button type="button" variant="outline" @click="showViewClientsDialog = false">Chiudi</Button></DialogFooter></div></DialogContent></Dialog>
  </div>
</template>