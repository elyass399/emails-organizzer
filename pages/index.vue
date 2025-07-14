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

// Importa le icone necessarie per l'infografica e per il pulsante Aggiorna
import { Mail, RefreshCw, Calculator, Settings, Calendar, Users } from 'lucide-vue-next';


// --- STATO DELLA PAGINA ---
const processedEmails = ref([]);
const selectedEmailContent = ref(null);
const showContentModal = ref(false);
const isLoading = ref(true);
const showAddStaffDialog = ref(false);

// Form per aggiungere nuovo staff
const newStaffForm = reactive({
  name: '',
  email: '',
  responsibilities: '',
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

const totalEmailsCount = computed(() => processedEmails.value ? processedEmails.value.length : 0);
const forwardedToContabilitaCount = computed(() => {
  return processedEmails.value.filter(e => e.status === 'forwarded' && e.staff?.name === 'Ufficio Contabilità').length;
});
const forwardedToSupportoTecnicoCount = computed(() => {
  return processedEmails.value.filter(e => e.status === 'forwarded' && e.staff?.name === 'Supporto Tecnico').length;
});
const forwardedToSegreteriaCount = computed(() => {
  return processedEmails.value.filter(e => e.status === 'forwarded' && e.staff?.name === 'Segreteria Generale').length;
});


// --- FUNZIONI PRINCIPALI ---
const fetchProcessedEmails = async () => {
  isLoading.value = true;
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
    isLoading.value = false;
  }
};

const viewEmailContent = (email) => {
  selectedEmailContent.value = email;
  showContentModal.value = true;
};

const addStaff = async () => {
  console.log('addStaff function called'); // Lasciamo il log per verifica
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
      Object.assign(newStaffForm, { name: '', email: '', responsibilities: '' });
      await fetchProcessedEmails();

    } else {
      toast({
        title: 'Errore',
        description: response.message || 'Errore durante l\'aggiunta del dipendente.',
        variant: 'destructive',
      });
    }
  } catch (error) {
    console.error('Errore durante l\'aggiunta del dipendente:', error);
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
    default: return status;
  }
};

const getStaffBadgeVariant = (staffName) => {
  switch (staffName) {
    case 'Ufficio Contabilità': return 'contabilita';
    case 'Supporto Tecnico': return 'supportoTecnico';
    case 'Segreteria Generale': return 'segreteria';
    default: return 'outline';
  }
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

    <!-- SEZIONE: INFOGRAFICA (CARTE GRANDI IN ALTO, SOLO TITOLO E NUMERO) -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <Card class="bg-gradient-to-br from-blue-50 to-gray-100">
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2 text-gray-800">
          <CardTitle class="text-sm font-medium">
            Email Totali
          </CardTitle>
          <Mail class="h-4 w-4 text-gray-700" />
        </CardHeader>
        <CardContent class="text-gray-800">
          <div class="text-2xl font-bold">
            {{ totalEmailsCount }}
          </div>
        </CardContent>
      </Card>

      <Card class="bg-gradient-to-br from-rose-200 to-red-400">
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2 text-black">
          <CardTitle class="text-sm font-medium">
            Email Contabilità
          </CardTitle>
          <Calculator class="h-4 w-4 text-gray-800" />
        </CardHeader>
        <CardContent class="text-black">
          <div class="text-2xl font-bold">
            {{ forwardedToContabilitaCount }}
          </div>
        </CardContent>
      </Card>

      <Card class="bg-gradient-to-br from-lime-200 to-green-400">
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2 text-black">
          <CardTitle class="text-sm font-medium">
            Email Supporto Tecnico
          </CardTitle>
          <Settings class="h-4 w-4 text-gray-800" />
        </CardHeader>
        <CardContent class="text-black">
          <div class="text-2xl font-bold">
            {{ forwardedToSupportoTecnicoCount }}
          </div>
        </CardContent>
      </Card>

      <Card class="bg-gradient-to-br from-purple-200 to-fuchsia-300">
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2 text-black">
          <CardTitle class="text-sm font-medium">
            Email Segreteria
          </CardTitle>
          <Calendar class="h-4 w-4 text-gray-800" />
        </CardHeader>
        <CardContent class="text-black">
          <div class="text-2xl font-bold">
            {{ forwardedToSegreteriaCount }}
          </div>
        </CardContent>
      </Card>
    </div>
    <!-- FINE SEZIONE INFOGRAFICA -->

    <!-- Pulsante "Aggiungi Dipendente/Ufficio" (allineato a destra) -->
    <div class="flex justify-end mb-4">
      <Button variant="outline" @click="showAddStaffDialog = true" class="shrink-0">
        <Users class="h-4 w-4 mr-2" />
        Aggiungi Dipendente/Ufficio
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
          <Button variant="outline" @click="fetchProcessedEmails" :disabled="isLoading" class="shrink-0">
            <RefreshCw class="h-4 w-4 mr-2" />
            Aggiorna
          </Button>
        </div>

        <!-- Stato di Caricamento/Vuoto della Tabella -->
        <div v-if="isLoading" class="text-center py-16">
          <p class="text-muted-foreground">Caricamento storico email...</p>
        </div>
        <div v-else-if="filteredEmails.length > 0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mittente & Oggetto</TableHead>
                <TableHead>Etichetta (Assegnato A)</TableHead>
                <TableHead class="text-center">Confidenza AI</TableHead>
                <TableHead class="text-center">Stato</TableHead>
                <TableHead class="text-right">Ricevuta il</TableHead>
                <TableHead class="text-center">Contenuto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="email in filteredEmails" :key="email.id">
                <TableCell class="font-medium">
                  <div>{{ email.sender }}</div>
                  <div class="text-xs text-muted-foreground truncate max-w-xs" :title="email.subject">{{ email.subject }}</div>
                </TableCell>
                <TableCell>
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
                  <span>
                    {{ getStatusLabel(email.status) }}
                  </span>
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
        <form> <!-- RIMOSSO @submit.prevent dal form -->
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
              <Label for="responsibilities" class="text-right">
                Responsabilità
              </Label>
              <Textarea id="responsibilities" v-model="newStaffForm.responsibilities" required class="col-span-3" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" @click="showAddStaffDialog = false">Annulla</Button>
            <!-- COLLEGATO addStaff direttamente all'evento @click -->
            <Button type="button" @click="addStaff">Aggiungi</Button> 
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

  </div>
</template>