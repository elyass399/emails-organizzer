<!-- File: pages/index.vue -->
<script setup>
import { ref, onMounted, computed } from 'vue'; // Rimosso 'reactive'
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// Importa i componenti Dialog necessari
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
// Rimosse importazioni di Label, Input, Textarea, DialogTrigger

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast/use-toast';
import { Toaster } from '@/components/ui/toast';

// Importa le icone necessarie per l'infografica e per il pulsante Aggiorna
// Icone specifiche come nell'immagine: Mail, Calculator, Settings (ingranaggio), Calendar (agenda), RefreshCw
import { Mail, RefreshCw, Calculator, Settings, Calendar } from 'lucide-vue-next';


// --- STATO DELLA PAGINA ---
const processedEmails = ref([]);
// Rimosso allStaff, showAddStaffDialog, newStaffForm
const selectedEmailContent = ref(null);
const showContentModal = ref(false);
const isLoading = ref(true); // Per la tabella della posta smistata

// Rimosso staffVisuals mapping

// Stato per il filtro attivo
const activeFilter = ref('all');

// Toast per notifiche
const { toast } = useToast();

// Computed properties per filtrare le email visualizzate nella tabella
const filteredEmails = computed(() => {
  if (!processedEmails.value || !Array.isArray(processedEmails.value)) {
    return [];
  }
  if (activeFilter.value === 'all') {
    return processedEmails.value;
  }
  if (activeFilter.value === 'problems') {
    return processedEmails.value.filter(e => ['manual_review', 'ai_error', 'forward_error'].includes(e.status));
  }
  return processedEmails.value.filter(email => email.status === activeFilter.value);
});

// PROPRIETÀ COMPUTED PER LA CARD EMAIL TOTALI
const totalEmailsCount = computed(() => processedEmails.value ? processedEmails.value.length : 0);

// PROPRIETÀ COMPUTED PER LE CARTE DEGLI UFFICI (NOMI DAL DB)
const forwardedToContabilitaCount = computed(() => {
  return processedEmails.value.filter(e => e.status === 'forwarded' && e.staff?.name === 'Ufficio Contabilità').length;
});
const forwardedToSupportoTecnicoCount = computed(() => {
  return processedEmails.value.filter(e => e.status === 'forwarded' && e.staff?.name === 'Supporto Tecnico').length;
});
const forwardedToSegreteriaCount = computed(() => {
  return processedEmails.value.filter(e => e.status === 'forwarded' && e.staff?.name === 'Segreteria Generale').length;
});


// Mantenute le computed properties per i filtri della tabella
const newEmailsCount = computed(() => processedEmails.value ? processedEmails.value.filter(e => e.status === 'new').length : 0);
const forwardedEmailsFilterCount = computed(() => processedEmails.value ? processedEmails.value.filter(e => e.status === 'forwarded').length : 0); // Rinominato per evitare conflitto
const problemEmailsCount = computed(() => processedEmails.value ? processedEmails.value.filter(e => ['manual_review', 'ai_error', 'forward_error'].includes(e.status)).length : 0);


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

// Rimosso fetchStaff

const viewEmailContent = (email) => {
  selectedEmailContent.value = email;
  showContentModal.value = true;
};

// Rimosso addStaff

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

// FUNZIONE PER ASSEGNARE IL TIPO DI BADGE IN BASE AL NOME DELLO STAFF
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
  // Rimosso await fetchStaff();
  await fetchProcessedEmails();
});
</script>

<template>
  <div class="container mx-auto p-4 md:p-8 space-y-8">
    <!-- Componente per mostrare le notifiche -->
    <Toaster />

    <h1 class="text-2xl font-bold mb-4">Gestione Email Intelligente</h1>

    <!-- SEZIONE: INFOGRAFICA ESATTA COME DA ULTIMA IMMAGINE FORNITA CON COLORI -->
    <!-- Layout con 4 colonne per desktop -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <!-- CARTA: EMAIL TOTALI (con gradiente blu/grigio tenue e testo scuro) -->
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
          <p class="text-xs text-gray-700">
            Elaborate finora
          </p>
        </CardContent>
      </Card>

      <!-- CARTA: EMAIL CONTABILITÀ (gradiente rosso/arancio, testo scuro) -->
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
          <p class="text-xs text-gray-800">
            Inoltrate all'Ufficio
          </p>
          <p class="text-xs text-gray-800 mt-1">
            Contabilità
          </p>
        </CardContent>
      </Card>

      <!-- CARTA: EMAIL SUPPORTO TECNICO (gradiente giallo/verde, testo scuro) -->
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
          <p class="text-xs text-gray-800">
            Inoltrate al Supporto
          </p>
          <p class="text-xs text-gray-800 mt-1">
            Tecnico
          </p>
        </CardContent>
      </Card>

      <!-- CARTA: EMAIL SEGRETERIA (gradiente viola/magenta, testo scuro) -->
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
          <p class="text-xs text-gray-800">
            Inoltrate alla
          </p>
          <p class="text-xs text-gray-800 mt-1">
            Segreteria Generale
          </p>
        </CardContent>
      </Card>
    </div>
    <!-- FINE SEZIONE INFOGRAFICA -->

    <!-- Card per la posta smistata -->
    <Card>
      <CardHeader>
        <CardTitle>Posta Smistata dall'AI</CardTitle>
        <CardDescription>Elenco delle email analizzate e assegnate a un dipartimento responsabile.</CardDescription>
      </CardHeader>
      <CardContent>
        <!-- Toolbar: Filtri e pulsante Aggiorna -->
        <div class="flex flex-col md:flex-row items-start md:items-center justify-between space-y-2 md:space-y-0 md:space-x-4 mb-4">
          <div class="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              :class="{ 'bg-primary text-primary-foreground': activeFilter === 'all' }"
              @click="activeFilter = 'all'"
            >
              Tutti ({{ totalEmailsCount }})
            </Button>
            <Button
              variant="outline"
              size="sm"
              :class="{ 'bg-primary text-primary-foreground': activeFilter === 'new' }"
              @click="activeFilter = 'new'"
            >
              Nuove ({{ newEmailsCount }})
            </Button>
            <Button
              variant="outline"
              size="sm"
              :class="{ 'bg-primary text-primary-foreground': activeFilter === 'forwarded' }"
              @click="activeFilter = 'forwarded'"
            >
              Inoltrate ({{ forwardedEmailsFilterCount }})
            </Button>
            <Button
              variant="outline"
              size="sm"
              :class="{ 'bg-destructive text-destructive-foreground': activeFilter === 'problems' }"
              @click="activeFilter = 'problems'"
            >
              Problemi ({{ problemEmailsCount }})
            </Button>
          </div>
          <Button variant="outline" @click="fetchProcessedEmails" :disabled="isLoading" class="shrink-0">
            <!-- Icona Aggiorna (Refresh) -->
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
                  <!-- Usa la funzione per determinare la variante del badge in base al nome dello staff -->
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

    <!-- Rimosso Modale per Aggiungere Nuovo Dipendente/Ufficio -->

  </div>
</template>