<!-- File: pages/index.vue -->
<script setup>
import { ref, onMounted, computed } from 'vue'; // Aggiungi 'computed'
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
// Rimosso: import { Input } from '@/components/ui/input';
// Rimosso: import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
// Rimosso: import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast/use-toast';
import { Toaster } from '@/components/ui/toast';

// --- STATO DELLA PAGINA ---
const processedEmails = ref([]);
const selectedEmailContent = ref(null);
const showContentModal = ref(false);
const isLoading = ref(true); // Per la tabella della posta smistata
// Rimosso: const isProcessing = ref(false); // Per il modulo di invio

// NUOVO: Stato per il filtro attivo
const activeFilter = ref('all'); // Può essere 'all', 'new', 'analyzed', 'forwarded', etc.

// --- DATI DEL MODULO ---
// Rimosso: const newEmail = ref({...}); // Non più necessario

// Toast per notifiche
const { toast } = useToast();

// NUOVO: Computed property per le email filtrate
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


// --- FUNZIONI PRINCIPALI ---
const fetchProcessedEmails = async () => {
  isLoading.value = true;
  try {
    processedEmails.value = await $fetch('/api/inbox');
  } catch (error) {
    console.error("Impossibile caricare la posta smistata:", error);
    toast({
      title: 'Errore',
      description: 'Impossibile caricare lo storico delle email.',
      variant: 'destructive',
    });
  } finally {
    isLoading.value = false;
  }
};

// Rimosso: const processManualEmail = async () => {...}; // Non più necessario

const viewEmailContent = (email) => {
  selectedEmailContent.value = email;
  showContentModal.value = true;
};

// --- NUOVE FUNZIONI UTILI PER LA GRAFICA ---
const formatDate = (dateString) => new Date(dateString).toLocaleString('it-IT');

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

    <!-- Rimosso: Card per l'invio manuale -->
    <!-- Qui era presente la Card per il test manuale -->

    <!-- Card per la posta smistata -->
    <Card>
      <CardHeader>
        <CardTitle>Posta Smistata dall'AI</CardTitle>
        <CardDescription>Elenco delle email analizzate e assegnate a un dipartimento/responsabile.</CardDescription>
      </CardHeader>
      <CardContent>
        <!-- NUOVO: Filtri e pulsante Aggiorna -->
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
              :class="{ 'bg-destructive': activeFilter === 'problems' }"
              @click="activeFilter = 'problems'"
            >
              Problemi ({{ processedEmails.filter(e => ['manual_review', 'ai_error', 'forward_error'].includes(e.status)).length }})
            </Button>
          </div>
          <Button variant="outline" @click="fetchProcessedEmails" :disabled="isLoading" class="shrink-0">
            <!-- Icona Aggiorna (Refresh) -->
            <svg class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004 9V4m0 0l2.5-2.5M4 4l-2.5 2.5m1.5 8h-1.5m0 0v-5h-.582m15.356 2A8.001 8.001 0 0120 15v5m0 0l-2.5 2.5m2.5-2.5l2.5-2.5"></path>
            </svg>
            Aggiorna
          </Button>
        </div>

        <div v-if="isLoading" class="text-center py-16"><p>Caricamento storico...</p></div>
        <div v-else-if="filteredEmails.length > 0"> <!-- MODIFICA: USA filteredEmails -->
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mittente & Oggetto</TableHead>
                <TableHead>Etichetta (Assegnato A)</TableHead>
                <TableHead class="text-center">Confidenza AI</TableHead>
                <TableHead class="text-center">Stato</TableHead> <!-- NUOVA COLONNA PER LO STATO -->
                <TableHead class="text-right">Ricevuta il</TableHead>
                <TableHead class="text-center">Contenuto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="email in filteredEmails" :key="email.id"> <!-- MODIFICA: USA filteredEmails -->
                <TableCell class="font-medium">
                  <div>{{ email.sender }}</div>
                  <div class="text-xs text-muted-foreground truncate max-w-xs" :title="email.subject">{{ email.subject }}</div>
                </TableCell>
                <TableCell>
                  <!-- Badge per Assegnato A - se staff.name è vuoto, usa un badge 'Non Assegnato' -->
                  <Badge :variant="email.staff?.name ? 'outline' : 'secondary'">
                    {{ email.staff?.name || 'Non Assegnato' }}
                  </Badge>
                </TableCell>
                <TableCell class="text-center">
                  <!-- Badge per Confidenza AI con colori diversi -->
                  <Badge :variant="getConfidenceVariant(email.ai_confidence_score)">
                    {{ email.ai_confidence_score !== null && email.ai_confidence_score !== undefined ? (email.ai_confidence_score * 100).toFixed(0) + '%' : 'N/D' }}
                  </Badge>
                </TableCell>
                <TableCell class="text-center"> <!-- NUOVA CELLA PER LO STATO -->
                  <Badge :variant="getStatusVariant(email.status)">
                    {{ getStatusLabel(email.status) }}
                  </Badge>
                </TableCell>
                <TableCell class="text-right">{{ formatDate(email.created_at) }}</TableCell>
                <TableCell class="text-center">
                   <Button @click="viewEmailContent(email)" variant="ghost" size="sm">Visualizza</Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
        <div v-else class="text-center py-16"><p class="text-muted-foreground">Nessuna email trovata per il filtro selezionato.</p></div>
      </CardContent>
    </Card>
    
    <!-- Modale per visualizzare contenuto email -->
    <Dialog :open="showContentModal" @update:open="showContentModal = false">
      <DialogContent v-if="selectedEmailContent">
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
  </div>
</template>