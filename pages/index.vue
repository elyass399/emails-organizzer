<!-- File: pages/index.vue -->
<script setup>
import { ref, onMounted, computed, reactive } from 'vue';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// Importa i componenti Dialog, Label, Input, Textarea necessari
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast/use-toast';
import { Toaster } from '@/components/ui/toast';

// Importa le icone necessarie per il refresh e i bottoni staff
import { RefreshCw, Users, Edit, List, AlertTriangle } from 'lucide-vue-next';


// --- STATO DELLA PAGINA ---
const processedEmails = ref([]);
const selectedEmailContent = ref(null);
const showContentModal = ref(false);
const isLoadingEmails = ref(true); // Rinominato per chiarezza

// Stato per la modale di AGGIUNTA staff
const showAddStaffDialog = ref(false);
const newStaffForm = reactive({
  name: '',
  email: '',
  text_skills: '',
});

// Stato e dati per la modale di MODIFICA staff centralizzata
const showUpdateStaffDialog = ref(false);
const allStaffMembers = ref([]); // Lista completa dei dipendenti/uffici per la dropdown
const selectedStaffIdToUpdate = ref(null); // ID del dipendente selezionato nella dropdown

const updateStaffForm = reactive({ // Form per la modifica del testo delle skills
  text_skills: '',
});

// NUOVO STATO per la modale di VISUALIZZAZIONE staff
const showViewStaffDialog = ref(false); // NUOVO STATO PER LA NUOVA MODALE
const isLoadingStaff = ref(true); // Stato di caricamento per la lista staff

// Stato e dati per la modale di VISUALIZZAZIONE clienti
const showViewClientsDialog = ref(false);
const allClients = ref([]); // Lista completa dei clienti
const isLoadingClients = ref(true);


// Computed per ottenere il nome e l'email del dipendente selezionato nella modale di modifica
const currentSelectedStaff = computed(() => {
  return allStaffMembers.value.find(staff => staff.id === selectedStaffIdToUpdate.value) || {};
});


const activeFilter = ref('all');

// Toast per notifiche
const { toast } = useToast();

const filteredEmails = computed(() => {
  if (!processedEmails.value || !Array.isArray(processedEmails.value)) {
    return [];
  }
  return processedEmails.value;
});


// --- FUNZIONI PRINCIPALI ---
const fetchProcessedEmails = async () => {
  isLoadingEmails.value = true;
  try {
    const data = await $fetch('/api/inbox');
    processedEmails.value = data || [];
  }
  catch (error) {
    console.error("Impossibile caricare la posta smistata:", error);
    toast({
      title: 'Errore',
      description: 'Impossibile caricare lo storico delle email.',
      variant: 'destructive',
    });
    processedEmails.value = [];
  }
  finally {
    isLoadingEmails.value = false;
  }
};

// Funzione: Carica la lista completa dello staff
const fetchAllStaff = async () => {
  isLoadingStaff.value = true; // Aggiunto per gestire lo stato di caricamento della lista staff
  try {
    const data = await $fetch('/api/staff');
    allStaffMembers.value = data || [];
    // Imposta il primo staff come selezionato di default per la modale di modifica, se esiste
    if (allStaffMembers.value.length > 0) {
      selectedStaffIdToUpdate.value = allStaffMembers.value[0].id;
      updateStaffForm.text_skills = allStaffMembers.value[0].text_skills;
    } else {
      selectedStaffIdToUpdate.value = null;
      updateStaffForm.text_skills = '';
    }
  } catch (error) {
    console.error("Impossibile caricare la lista staff:", error);
    toast({
      title: 'Errore',
      description: 'Impossibile caricare la lista dei dipendenti/uffici.',
      variant: 'destructive',
    });
    allStaffMembers.value = [];
  } finally {
    isLoadingStaff.value = false;
  }
};

// NUOVA FUNZIONE: Carica la lista completa dei clienti
const fetchAllClients = async () => {
  isLoadingClients.value = true;
  try {
    const data = await $fetch('/api/clients'); // Chiamata al nuovo endpoint
    allClients.value = data || [];
  } catch (error) {
    console.error("Impossibile caricare la lista clienti:", error);
    toast({
      title: 'Errore',
      description: 'Impossibile caricare la lista dei clienti.',
      variant: 'destructive',
    });
    allClients.value = [];
  } finally {
    isLoadingClients.value = false;
  }
};


// Funzione per gestire la selezione di un dipendente nella dropdown di modifica
const handleStaffSelectionChange = () => {
  const selectedStaff = allStaffMembers.value.find(staff => staff.id === selectedStaffIdToUpdate.value);
  if (selectedStaff) {
    updateStaffForm.text_skills = selectedStaff.text_skills;
  } else {
    updateStaffForm.text_skills = '';
  }
};


const viewEmailContent = (email) => {
  selectedEmailContent.value = email;
  showContentModal.value = true;
};

const addStaff = async () => {
  console.log('Frontend: addStaff function called on submit.');
  console.log('Frontend: newStaffForm data:', {
    name: newStaffForm.name,
    email: newStaffForm.email,
    text_skills: newStaffForm.text_skills
  });

  if (!newStaffForm.name || !newStaffForm.email || !newStaffForm.text_skills || newStaffForm.text_skills.trim() === '') {
    toast({
      title: 'Errore',
      description: 'Nome, email e descrizione competenze sono campi obbligatori e non possono essere vuoti.',
      variant: 'destructive',
    });
    console.error('Frontend: Errore: Campi addStaff mancanti/vuoti.');
    return;
  }

  try {
    const response = await $fetch('/api/staff', {
      method: 'POST',
      body: newStaffForm,
    });

    if (response.status === 'success') {
      toast({
        title: 'Successo!',
        description: 'Dipendente aggiunto e salvato nel database.',
      });
      showAddStaffDialog.value = false;
      Object.assign(newStaffForm, { name: '', email: '', text_skills: '' });
      await fetchProcessedEmails();
      await fetchAllStaff(); // Aggiorna la lista staff per tutte le modali
      console.log('Frontend: Aggiunta staff completata con successo.');
    } else {
      toast({
        title: 'Errore',
        description: response.message || 'Errore durante l\'aggiunta del dipendente.',
        variant: 'destructive',
      });
      console.error('Frontend: Errore risposta API addStaff:', response.message);
    }
  } catch (error) {
    console.error('Frontend: Errore durante l\'aggiunta del dipendente:', error);
    toast({
      title: 'Errore',
      description: error.data?.statusMessage || 'Si è verificato un errore imprevisto.',
      variant: 'destructive',
    });
  }
};

// Funzione per aprire la modale di AGGIORNAMENTO STAFF centralizzata
const openCentralUpdateStaffDialog = async () => {
  await fetchAllStaff(); // Carica sempre la lista piÃ¹ recente
  showUpdateStaffDialog.value = true;
};

// NUOVA FUNZIONE: per aprire la modale di VISUALIZZAZIONE STAFF
const openViewStaffDetailsDialog = async () => {
  await fetchAllStaff(); // Carica sempre la lista piÃ¹ recente
  showViewStaffDialog.value = true;
};

// NUOVA FUNZIONE: per aprire la modale di VISUALIZZAZIONE CLIENTI
const openViewClientsDialog = async () => {
  await fetchAllClients(); // Carica la lista piÃ¹ recente dei clienti
  showViewClientsDialog.value = true;
};


const updateStaff = async () => {
  console.log('Frontend: updateStaff function called.');
  console.log('Frontend: selectedStaffIdToUpdate:', selectedStaffIdToUpdate.value);
  console.log('Frontend: updateStaffForm.text_skills:', updateStaffForm.text_skills);

  if (!selectedStaffIdToUpdate.value) {
    toast({
      title: 'Errore',
      description: 'Nessun dipendente selezionato per l\'aggiornamento.',
      variant: 'destructive',
    });
    console.error('Frontend: Errore: Nessun dipendente selezionato.');
    return;
  }

  if (!updateStaffForm.text_skills || updateStaffForm.text_skills.trim() === '') {
    toast({
      title: 'Errore',
      description: 'Il campo "Descrizione Competenze" non può essere vuoto.',
    });
    console.error('Frontend: Errore: Il campo Descrizione Competenze Ã¨ vuoto.');
    return;
  }

  console.log('updateStaff function called for ID:', selectedStaffIdToUpdate.value);
  try {
    console.log('Frontend: Tentativo di inviare richiesta PUT per aggiornare staff...');
    console.log('Frontend: URL della richiesta:', `/api/staff/${selectedStaffIdToUpdate.value}`);
    console.log('Frontend: Body della richiesta:', { text_skills: updateStaffForm.text_skills });

    const response = await $fetch(`/api/staff/${selectedStaffIdToUpdate.value}`, {
      method: 'PUT',
      body: {
        text_skills: updateStaffForm.text_skills, // Inviamo solo il campo modificabile
      },
    });

    if (response.status === 'success') {
      toast({
        title: 'Successo!',
        description: 'Competenze del dipendente aggiornate e ricalcolate.',
      });
      showUpdateStaffDialog.value = false;
      await fetchProcessedEmails(); // Ricarica tutte le email per riflettere le modifiche
      await fetchAllStaff(); // Ricarica la lista staff per sicurezza
      console.log('Frontend: Aggiornamento staff completato con successo.');
    } else {
      toast({
        title: 'Errore',
        description: response.message || 'Errore durante l\'aggiornamento delle competenze.',
        variant: 'destructive',
      });
      console.error('Frontend: Errore risposta API:', response.message);
    }
  } catch (error) {
    console.error('Frontend: Errore durante l\'aggiornamento delle competenze:', error);
    toast({
      title: 'Errore',
      description: error.data?.statusMessage || 'Si è verificato un errore imprevisto.',
      variant: 'destructive',
    });
  }
};


// --- FUNZIONI UTILI PER LA GRAFICA E I BADGE ---
const formatDate = (dateString) => {
  if (!dateString) return 'N/D';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Data non valida';
  const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
  return date.toLocaleString('it-IT', options);
};

const getConfidenceVariant = (score) => {
  if (score === null || score === undefined) return 'secondary';
  if (score >= 0.8) return 'default';
  if (score >= 0.5) return 'secondary';
  return 'destructive';
};

const getStatusLabel = (status) => {
  switch (status) {
    case 'new': return 'Nuova';
    case 'analyzed': return 'Analizzata';
    case 'forwarded': return 'Inoltrata';
    case 'manual_review': return 'Revisione Manuale';
    case 'ai_error': return 'Errore AI';
    case 'forward_error': return 'Errore Inoltro';
    case 'processing_error': return 'Errore Elaborazione';
    case 'processed_follow_up': return 'Dati Cliente Aggiornati';
    default: return status;
  }
};

const getStaffBadgeVariant = (staffName) => {
  return 'secondary';
};

const getRowUrgencyClass = (isUrgent) => {
  return isUrgent ? 'border-l-4 border-red-500 bg-red-50' : '';
};

const getUrgencyBadge = (isUrgent) => {
  if (isUrgent) {
    return {
      text: 'URGENTE',
      variant: 'destructive',
      icon: AlertTriangle
    };
  }
  return null;
};

// Funzione per formattare lo stato del follow-up email
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

// --- HOOK ---
onMounted(async () => {
  await fetchProcessedEmails();
});
</script>

<template>
  <div class="container mx-auto p-4 md:p-8 space-y-8">
    <Toaster />

    <h1 class="text-2xl font-bold mb-4">Gestione Email Intelligente</h1>

    <!-- Pulsanti "Aggiungi", "Modifica", "Visualizza Dipendenti" e "Visualizza Clienti" (allineati a destra) -->
    <div class="flex justify-end gap-2 mb-4">
      <Button variant="outline" @click="showAddStaffDialog = true" class="shrink-0">
        <Users class="h-4 w-4 mr-2" />
        Aggiungi Dipendente/Ufficio
      </Button>
      <Button variant="outline" @click="openCentralUpdateStaffDialog" class="shrink-0">
        <Edit class="h-4 w-4 mr-2" />
        Modifica Dipendente/Ufficio
      </Button>
      <!-- NUOVO BOTTONE PER VISUALIZZARE STAFF -->
      <Button variant="outline" @click="openViewStaffDetailsDialog" class="shrink-0">
        <List class="h-4 w-4 mr-2" />
        Visualizza Dipendenti/Uffici
      </Button>
      <!-- NUOVO BOTTONE PER VISUALIZZARE CLIENTI -->
      <Button variant="outline" @click="openViewClientsDialog" class="shrink-0">
        <List class="h-4 w-4 mr-2" />
        Visualizza Clienti
      </Button>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>Posta Smistata dall'AI</CardTitle>
        <CardDescription>Elenco delle email analizzate e assegnate a un dipartimento responsabile.</CardDescription>
      </CardHeader>
      <CardContent>
        <!-- TOOLBAR: SOLO PULSANTE AGGIORNA ALLINEATO A DESTRA (FILTRI RIMOSSI) -->
        <div class="flex justify-end mb-4">
          <Button variant="outline" @click="fetchProcessedEmails" :disabled="isLoadingEmails" class="shrink-0">
            <RefreshCw class="h-4 w-4 mr-2" />
            Aggiorna
          </Button>
        </div>

        <!-- Stato di Caricamento/Vuoto della Tabella -->
        <div v-if="isLoadingEmails" class="text-center py-16">
          <p class="text-muted-foreground">Caricamento storico email...</p>
        </div>
        <div v-else-if="filteredEmails.length > 0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead class="text-left">Mittente</TableHead>
                <TableHead class="text-center">Assegnato A</TableHead>
                <TableHead class="text-center">Confidenza AI</TableHead>
                <TableHead class="text-center">Stato</TableHead>
                <TableHead class="text-right">Ricevuta il</TableHead>
                <TableHead class="text-center">Contenuto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow
                v-for="email in filteredEmails"
                :key="email.id"
                :class="getRowUrgencyClass(email.is_urgent)"
              >
                <TableCell class="font-medium text-left">
                  <div class="flex items-center gap-2">
                    <AlertTriangle v-if="email.is_urgent" class="h-4 w-4 text-red-600" title="Email Urgente" />
                    <div>
                      <div>{{ email.sender }}</div>
                      <div class="text-xs text-muted-foreground truncate max-w-xs" :title="email.subject">{{ email.subject }}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell class="text-center">
                  <Badge :variant="getStaffBadgeVariant(email.staff?.name)">
                    {{ email.staff?.name || 'Non Assegnato' }}
                  </Badge>
                </TableCell>
                <TableCell class="text-center">
                  <Badge :variant="getConfidenceVariant(email.ai_confidence_score)">
                    {{ email.ai_confidence_score !== null && email.ai_confidence_score !== undefined ? (email.ai_confidence_score * 100).toFixed(0) + '%' : 'N/D' }}
                  </Badge>
                </TableCell>
                <TableCell class="text-center">
                  <div class="flex flex-col items-center gap-1">
                    <span>{{ getStatusLabel(email.status) }}</span>
                    <Badge v-if="getUrgencyBadge(email.is_urgent)" :variant="getUrgencyBadge(email.is_urgent).variant">
                      {{ getUrgencyBadge(email.is_urgent).text }}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell class="text-right">{{ formatDate(email.created_at) }}</TableCell>
                <TableCell class="text-center">
                   <Button
                     @click="viewEmailContent(email)"
                     size="sm"
                     variant="black"
                   >
                     Visualizza
                   </Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
        <div v-else class="text-center py-16">
          <p class="text-muted-foreground">Nessuna email trovata per il filtro selezionata.</p>
          <p class="text-muted-foreground text-sm mt-2">Le email vengono elaborate automaticamente ogni 5 minuti.</p>
        </div>
      </CardContent>
    </Card>

    <!-- Modale per visualizzare contenuto email -->
<Dialog :open="showContentModal" @update:open="showContentModal = false">
  <DialogContent v-if="selectedEmailContent" class="dialog-content-force-white">
      <DialogHeader>
          <DialogTitle>{{ selectedEmailContent.subject }}</DialogTitle>
          <DialogDescription>Da: {{ selectedEmailContent.sender }}</DialogDescription>
      </DialogHeader>
      <div class="py-4 whitespace-pre-wrap text-sm max-h-96 overflow-y-auto">
          {{ selectedEmailContent.body_text || "Corpo dell'email non disponibile." }}

          <!-- BLOCCO PER GLI ALLEGATI -->
          <div v-if="selectedEmailContent.attachments && selectedEmailContent.attachments.length > 0" class="mt-4 border-t pt-4">
            <h4 class="font-semibold mb-2">Allegati:</h4>
            <ul class="list-disc pl-5">
              <li v-for="attachment in selectedEmailContent.attachments" :key="attachment.public_url || attachment.filename">
                <a :href="attachment.public_url" target="_blank" class="text-blue-600 hover:underline">
                  {{ attachment.filename }} ({{ (attachment.size / 1024).toFixed(2) }} KB)
                </a>
              </li>
            </ul>
          </div>
          <!-- Icona di Urgenza nella Modale -->
          <div v-if="selectedEmailContent.is_urgent" class="mt-4 flex items-center text-red-600 font-semibold">
            <AlertTriangle class="h-5 w-5 mr-2" />
            <span>Questa email Ã¨ stata classificata come URGENTE dall'AI.</span>
          </div>
      </div>
      <DialogFooter>
          <Button @click="showContentModal = false" variant="outline">Chiudi</Button>
      </DialogFooter>
  </DialogContent>
</Dialog>

    <!-- Modale per Aggiungere Nuovo Dipendente/Ufficio -->
    <Dialog :open="showAddStaffDialog" @update:open="showAddStaffDialog = $event">
      <DialogContent class="dialog-content-force-white">
        <DialogHeader>
          <DialogTitle>Aggiungi Nuovo Dipendente/Ufficio</DialogTitle>
          <DialogDescription>
            Inserisci i dettagli del nuovo membro dello staff o del nuovo ufficio.
          </DialogDescription>
        </DialogHeader>
        <form @submit.prevent="addStaff">
          <div class="grid gap-4 py-4">
            <div class="grid grid-cols-4 items-center gap-4">
              <Label for="name" class="text-right">
                Nome Ufficio / Dipendente
              </Label>
              <Input id="name" v-model="newStaffForm.name" required class="col-span-3" />
            </div>
            <div class="grid grid-cols-4 items-center gap-4">
              <Label for="email" class="text-right">
                Email
              </Label>
              <Input id="email" type="email" v-model="newStaffForm.email" required class="col-span-3" />
            </div>
            <div class="grid grid-cols-4 items-center gap-4">
              <Label for="textSkills" class="text-right">
                Descrizione Competenze
              </Label>
              <Textarea id="textSkills" v-model="newStaffForm.text_skills" required class="col-span-3" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" @click="showAddStaffDialog = false">Annulla</Button>
            <Button type="submit">Aggiungi</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <!-- Modale per Aggiornare Competenze Dipendente (Centralizzata) -->
    <Dialog :open="showUpdateStaffDialog" @update:open="showUpdateStaffDialog = $event">
      <DialogContent class="dialog-content-force-white">
        <DialogHeader>
          <DialogTitle>Modifica Competenze Dipendente/Ufficio</DialogTitle>
          <DialogDescription>
            Seleziona un dipendente/ufficio per aggiornare la descrizione delle sue competenze.
          </DialogDescription>
        </DialogHeader>
        <form @submit.prevent="updateStaff">
          <div class="grid gap-4 py-4">
            <div class="grid grid-cols-4 items-center gap-4">
              <Label for="staffSelect" class="text-right">
                Seleziona Dipendente/Ufficio
              </Label>
              <select 
                id="staffSelect" 
                v-model="selectedStaffIdToUpdate" 
                @change="handleStaffSelectionChange"
                class="col-span-3 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                required
              >
                <option v-if="allStaffMembers.length === 0" value="" disabled>Nessun dipendente disponibile</option>
                <option 
                  v-for="staff in allStaffMembers" 
                  :key="staff.id" 
                  :value="staff.id"
                >
                  {{ staff.name }} ({{ staff.email }})
                </option>
              </select>
            </div>

            <!-- Campi nome e email visualizzati per il dipendente selezionato -->
            <div class="grid grid-cols-4 items-center gap-4">
              <Label for="selectedName" class="text-right">
                Nome
              </Label>
              <Input id="selectedName" :model-value="currentSelectedStaff.name" readonly class="col-span-3 bg-gray-100 text-gray-600" />
            </div>
            <div class="grid grid-cols-4 items-center gap-4">
              <Label for="selectedEmail" class="text-right">
                Email
              </Label>
              <Input id="selectedEmail" :model-value="currentSelectedStaff.email" readonly class="col-span-3 bg-gray-100 text-gray-600" />
            </div>

            <div class="grid grid-cols-4 items-center gap-4">
              <Label for="updateTextSkills" class="text-right">
                Descrizione Competenze
              </Label>
              <Textarea id="updateTextSkills" v-model="updateStaffForm.text_skills" required class="col-span-3" />
            </div>

            <!-- Optional: Mostra le skills estratte dall'AI dopo l'update per verifica -->
            <div v-if="currentSelectedStaff.skills && currentSelectedStaff.skills.length > 0" class="grid grid-cols-4 items-center gap-4">
              <Label class="text-right">Skills estratte (AI)</Label>
              <div class="col-span-3 flex flex-wrap gap-2">
                <Badge v-for="skill in currentSelectedStaff.skills" :key="skill" variant="secondary">
                  {{ skill }}
                </Badge>
              </div>
            </div>
             <div v-else class="grid grid-cols-4 items-center gap-4 text-sm text-muted-foreground">
              <span class="col-span-4 text-right">Nessuna skill estratta (o ancora da elaborare).</span>
            </div>

          </div>
          <DialogFooter>
            <Button type="button" variant="outline" @click="showUpdateStaffDialog = false">Annulla</Button>
            <Button type="submit" :disabled="!selectedStaffIdToUpdate">Salva Modifiche</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <!-- NUOVA MODALE PER VISUALIZZARE DIPENDENTI/UFFICI -->
    <Dialog :open="showViewStaffDialog" @update:open="showViewStaffDialog = $event">
      <DialogContent class="dialog-content-force-white max-w-7xl w-11/12">
        <DialogHeader>
          <DialogTitle>Elenco Dipendenti/Uffici</DialogTitle>
          <DialogDescription>
            Dettagli di tutti i membri dello staff e delle loro competenze.
          </DialogDescription>
        </DialogHeader>

        <div v-if="isLoadingStaff" class="text-center py-8">
          <p class="text-muted-foreground">Caricamento lista dipendenti...</p>
        </div>
        <div v-else-if="allStaffMembers.length > 0" class="max-h-[500px] overflow-y-auto overflow-x-auto">
          <Table class="min-w-full">
            <TableHeader>
              <TableRow>
                <TableHead class="w-[20%] min-w-[150px]">Nome Ufficio / Dipendente</TableHead>
                <TableHead class="w-[25%] min-w-[200px]">Email</TableHead>
                <TableHead class="w-[55%] min-w-[300px]">Descrizione Competenze</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="staff in allStaffMembers" :key="staff.id">
                <TableCell class="font-medium">{{ staff.name }}</TableCell>
                <TableCell class="break-all">{{ staff.email }}</TableCell>
                <TableCell class="text-sm">
                  <div class="whitespace-normal break-words">{{ staff.text_skills }}</div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
        <div v-else class="text-center py-8">
          <p class="text-muted-foreground">Nessun dipendente/ufficio configurato.</p>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" @click="showViewStaffDialog = false">Chiudi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>


    <!-- NUOVA MODALE PER VISUALIZZARE CLIENTI -->
    <Dialog :open="showViewClientsDialog" @update:open="showViewClientsDialog = $event">
      <DialogContent class="dialog-content-force-white max-w-7xl w-11/12">
        <DialogHeader>
          <DialogTitle>Elenco Clienti</DialogTitle>
          <DialogDescription>
            Dettagli di tutti i clienti e lo stato delle loro informazioni.
          </DialogDescription>
        </DialogHeader>

        <div v-if="isLoadingClients" class="text-center py-8">
          <p class="text-muted-foreground">Caricamento lista clienti...</p>
        </div>
        <div v-else-if="allClients.length > 0" class="max-h-[500px] overflow-y-auto overflow-x-auto">
          <Table class="min-w-full">
            <TableHeader>
              <TableRow>
                <TableHead class="w-[20%] min-w-[150px]">Email</TableHead>
                <TableHead class="w-[20%] min-w-[150px]">Nome</TableHead>
                <TableHead class="w-[15%] min-w-[120px]">Telefono</TableHead>
                <TableHead class="w-[15%] min-w-[120px]">Comune</TableHead>
                <TableHead class="w-[30%] min-w-[200px]">Follow-up</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="client in allClients" :key="client.id">
                <TableCell class="font-medium break-all">{{ client.email }}</TableCell>
                <TableCell>{{ client.name || 'N/D' }}</TableCell>
                <TableCell>{{ client.phone_number || 'N/D' }}</TableCell>
                <TableCell>{{ client.city || 'N/D' }}</TableCell>
                <TableCell>{{ formatFollowUpStatus(client) }}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
        <div v-else class="text-center py-8">
          <p class="text-muted-foreground">Nessun cliente trovato.</p>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" @click="showViewClientsDialog = false">Chiudi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>


  </div>
</template>