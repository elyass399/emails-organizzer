<!-- File: pages/index.vue -->
<script setup>
import { ref, onMounted, computed } from 'vue';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// Importa i componenti Dialog necessari da '@/components/ui/dialog'.
// Assicurati che questi componenti siano basati su radix-vue per evitare conflitti.
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast/use-toast';
import { Toaster } from '@/components/ui/toast';

// Importa le icone necessarie per l'infografica e per il pulsante Aggiorna da lucide-vue-next
import { Mail, CheckCircle, AlertCircle, RefreshCw } from 'lucide-vue-next';


// --- STATO DELLA PAGINA ---
const processedEmails = ref([]);
const selectedEmailContent = ref(null);
const showContentModal = ref(false);
const isLoading = ref(true); // Per la tabella della posta smistata

// Stato per il filtro attivo
const activeFilter = ref('all'); // Può essere 'all', 'new', 'analyzed', 'forwarded', etc.

// Toast per notifiche
const { toast } = useToast();

// Computed properties per filtrare le email visualizzate nella tabella
const filteredEmails = computed(() => {
  if (activeFilter.value === 'all') {
    return processedEmails.value;
  }
  // Filtra per stato singolo o per gruppo di stati "Problemi"
  if (activeFilter.value === 'problems') {
    return processedEmails.value.filter(e => ['manual_review', 'ai_error', 'forward_error'].includes(e.status));
  }
  return processedEmails.value.filter(email => email.status === activeFilter.value);
});

// NUOVE PROPRIETÀ COMPUTED PER L'INFOGRAFICA (calcolate dai dati fetched)
const totalEmails = computed(() => processedEmails.value.length);
const newEmailsCount = computed(() => processedEmails.value.filter(e => e.status === 'new').length);
const forwardedEmailsCount = computed(() => processedEmails.value.filter(e => e.status === 'forwarded').length);
const problemEmailsCount = computed(() => processedEmails.value.filter(e => ['manual_review', 'ai_error', 'forward_error'].includes(e.status)).length);

const automationRate = computed(() => {
  if (totalEmails.value === 0) return '0%';
  const automated = processedEmails.value.filter(e => e.status === 'forwarded').length;
  return ((automated / totalEmails.value) * 100).toFixed(0) + '%';
});


// --- FUNZIONI PRINCIPALI ---
const fetchProcessedEmails = async () => {
  isLoading.value = true;
  try {
    const data = await $fetch('/api/inbox');
    processedEmails.value = data;
  }
  catch (error) {
    console.error("Impossibile caricare la posta smistata:", error);
    toast({
      title: 'Errore',
      description: 'Impossibile caricare lo storico delle email.',
      variant: 'destructive',
    });
  }
  finally {
    isLoading.value = false;
  }
};

const viewEmailContent = (email) => {
  selectedEmailContent.value = email;
  showContentModal.value = true;
};

// --- FUNZIONI UTILI PER LA GRAFICA E I BADGE ---
const formatDate = (dateString) => {
  const date = new Date(dateString);
  const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
  return date.toLocaleString('it-IT', options);
};

const getConfidenceVariant = (score) => {
  if (score === null || score === undefined) return 'secondary'; // Grigio
  if (score >= 0.8) return 'default'; // Verde (Successo)
  if (score >= 0.5) return 'secondary'; // Giallo/Grigio (Mediocre)
  return 'destructive'; // Rosso (Basso/Fallimento)
};

const getStatusVariant = (status) => {
  switch (status) {
    case 'new': return 'secondary'; // Nuovo (grigio chiaro)
    case 'analyzed': return 'outline'; // Analizzato (contorno)
    case 'forwarded': return 'default'; // Inoltrato (verde principale)
    case 'manual_review': return 'destructive'; // Richiede Revisione (rosso)
    case 'ai_error': return 'destructive'; // Errore AI (rosso)
    case 'forward_error': return 'destructive'; // Errore Inoltro (rosso)
    default: return 'secondary'; // Default
  }
};

const getStatusLabel = (status) => {
  switch (status) {
    case 'new': return 'Nuova';
    case 'analyzed': return 'Analizzata';
    case 'forwarded': return 'Inoltrata';
    case 'manual_review': return 'Revisione Manuale';
    case 'ai_error': return 'Errore AI';
    case 'forward_error': return 'Errore Inoltro';
    default: return status; // Se lo stato è sconosciuto, mostra il testo originale
  }
};

// --- HOOK ---
onMounted(() => {
  fetchProcessedEmails();
});
</script>

<template>
  <div class="container mx-auto p-4 md:p-8 space-y-8">
    <!-- Componente per mostrare le notifiche -->
    <Toaster />

    <h1 class="text-2xl font-bold mb-4">Gestione Email Intelligente</h1>

    <!-- SEZIONE: INFOGRAFICA (Mini-Cards di Riepilogo) -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">
            Email Totali
          </CardTitle>
          <Mail class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">
            {{ totalEmails }}
          </div>
          <p class="text-xs text-muted-foreground">
            Elaborate finora
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">
            Inoltrate Automaticamente
          </CardTitle>
          <CheckCircle class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">
            {{ forwardedEmailsCount }}
          </div>
          <p class="text-xs text-muted-foreground">
            Tasso automazione: {{ automationRate }}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">
            Nuove Email
          </CardTitle>
          <Mail class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">
            {{ newEmailsCount }}
          </div>
          <p class="text-xs text-muted-foreground">
            In attesa di elaborazione
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">
            Revisione Manuale/Errori
          </CardTitle>
          <AlertCircle class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">
            {{ problemEmailsCount }}
          </div>
          <p class="text-xs text-muted-foreground">
            Richiedono attenzione
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
              Tutti ({{ processedEmails.length }})
            </Button>
            <Button
              variant="outline"
              size="sm"
              :class="{ 'bg-primary text-primary-foreground': activeFilter === 'new' }"
              @click="activeFilter = 'new'"
            >
              Nuove ({{ processedEmails.filter(e => e.status === 'new').length }})
            </Button>
            <Button
              variant="outline"
              size="sm"
              :class="{ 'bg-primary text-primary-foreground': activeFilter === 'forwarded' }"
              @click="activeFilter = 'forwarded'"
            >
              Inoltrate ({{ processedEmails.filter(e => e.status === 'forwarded').length }})
            </Button>
            <Button
              variant="outline"
              size="sm"
              :class="{ 'bg-destructive text-destructive-foreground': activeFilter === 'problems' }"
              @click="activeFilter = 'problems'"
            >
              Problemi ({{ processedEmails.filter(e => ['manual_review', 'ai_error', 'forward_error'].includes(e.status)).length }})
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
                  <Badge :variant="email.staff?.name ? 'outline' : 'secondary'">
                    {{ email.staff?.name || 'Non Assegnato' }}
                  </Badge>
                </TableCell>
                <TableCell class="text-center">
                  <Badge :variant="getConfidenceVariant(email.ai_confidence_score)">
                    {{ email.ai_confidence_score !== null && email.ai_confidence_score !== undefined ? (email.ai_confidence_score * 100).toFixed(0) + '%' : 'N/D' }}
                  </Badge>
                </TableCell>
                <TableCell class="text-center">
                  <Badge :variant="getStatusVariant(email.status)">
                    {{ getStatusLabel(email.status) }}
                  </Badge>
                </TableCell>
                <TableCell class="text-right">{{ formatDate(email.created_at) }}</TableCell>
                <TableCell class="text-center">
                   <Button
                     @click="viewEmailContent(email)"
                     size="sm"
                     class="bg-black text-white hover:bg-black/80"
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
      <!-- Applichiamo la classe personalizzata per forzare lo sfondo bianco e testo nero -->
      <DialogContent v-if="selectedEmailContent" class="dialog-content-force-white">
          <DialogHeader>
              <DialogTitle>{{ selectedEmailContent.subject }}</DialogTitle>
              <DialogDescription>Da: {{ selectedEmailContent.sender }}</DialogDescription>
          </DialogHeader>
          <!-- Contenuto scrollabile con classi Tailwind -->
          <div class="py-4 whitespace-pre-wrap text-sm max-h-96 overflow-y-auto">
              {{ selectedEmailContent.body_text || "Corpo dell'email non disponibile." }}
          </div>
          <DialogFooter>
              <Button @click="showContentModal = false" variant="outline">Chiudi</Button>
          </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>