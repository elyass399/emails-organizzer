<!-- File: pages/index.vue -->
<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast/use-toast';
import { Toaster } from '@/components/ui/toast';

// Importiamo le icone per un look più pulito
import { Eye, Inbox, LoaderCircle } from 'lucide-vue-next';

// --- STATO DELLA PAGINA ---
const processedEmails = ref([]);
const selectedEmailContent = ref(null);
const showContentModal = ref(false);
const isLoading = ref(true);
let refreshInterval = null;

const { toast } = useToast();

// --- FUNZIONI API ---
const fetchProcessedEmails = async () => {
  try {
    const data = await $fetch('/api/inbox');
    processedEmails.value = data;
  } catch (error) {
    console.error("Impossibile caricare la posta smistata:", error);
    toast({
      title: 'Errore di Caricamento',
      description: 'Non è stato possibile aggiornare la lista delle email.',
      variant: 'destructive',
    });
  } finally {
    isLoading.value = false;
  }
};

const viewEmailContent = (email) => {
  selectedEmailContent.value = email;
  showContentModal.value = true;
};

// --- FUNZIONI UTILI PER LA VISUALIZZAZIONE ---
const formatDate = (dateString) => new Date(dateString).toLocaleString('it-IT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const getConfidenceVariant = (score) => {
  if (score === null || score === undefined) return 'secondary';
  if (score >= 0.8) return 'default'; // Verde nel tema di default
  if (score >= 0.5) return 'secondary';
  return 'destructive';
};

// --- HOOK DEL CICLO DI VITA ---
onMounted(() => {
  fetchProcessedEmails();
  // Aggiorniamo la lista ogni 30 secondi
  refreshInterval = setInterval(fetchProcessedEmails, 30000);
});

onUnmounted(() => {
  // Puliamo l'intervallo quando l'utente lascia la pagina per evitare problemi
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
});
</script>

<template>
  <div class="bg-gray-50 min-h-screen">
    <div class="container mx-auto p-4 sm:p-6 lg:p-8">
      <!-- Componente per mostrare le notifiche (toast) -->
      <Toaster />

      <!-- Card principale per la posta smistata -->
      <Card class="w-full max-w-7xl mx-auto shadow-sm">
        <CardHeader>
          <CardTitle class="text-2xl font-bold tracking-tight">Posta in Arrivo Smistata</CardTitle>
          <CardDescription>
            Elenco delle email analizzate dall'AI e assegnate a un responsabile. La lista si aggiorna automaticamente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <!-- Stato di caricamento iniziale -->
          <div v-if="isLoading" class="flex flex-col items-center justify-center text-center py-24 text-gray-500">
            <LoaderCircle class="h-8 w-8 animate-spin mb-4" />
            <p class="font-medium">Caricamento storico email...</p>
            <p class="text-sm">Potrebbe richiedere qualche istante.</p>
          </div>

          <!-- Tabella con le email -->
          <div v-else-if="processedEmails.length > 0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead class="w-[35%]">Mittente & Oggetto</TableHead>
                  <TableHead>Assegnato A</TableHead>
                  <TableHead class="text-center">Confidenza AI</TableHead>
                  <TableHead class="text-right">Data Ricezione</TableHead>
                  <TableHead class="text-center w-[120px]">Azione</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="email in processedEmails" :key="email.id">
                  <TableCell class="font-medium">
                    <div class="truncate" :title="email.sender">{{ email.sender }}</div>
                    <div class="text-xs text-muted-foreground truncate max-w-xs" :title="email.subject">
                      {{ email.subject }}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{{ email.staff?.name || 'Non Assegnato' }}</Badge>
                  </TableCell>
                  <TableCell class="text-center">
                    <Badge :variant="getConfidenceVariant(email.ai_confidence_score)">
                      {{ email.ai_confidence_score !== null ? (email.ai_confidence_score * 100).toFixed(0) + '%' : 'N/D' }}
                    </Badge>
                  </TableCell>
                  <TableCell class="text-right text-xs text-muted-foreground">{{ formatDate(email.created_at) }}</TableCell>
                  <TableCell class="text-center">
                     <Button @click="viewEmailContent(email)" variant="ghost" size="icon">
                       <Eye class="h-4 w-4" />
                       <span class="sr-only">Visualizza Email</span>
                     </Button>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <!-- Stato vuoto, quando non ci sono email -->
          <div v-else class="flex flex-col items-center justify-center text-center py-24 text-gray-400 border-2 border-dashed rounded-lg">
            <Inbox class="h-12 w-12 mb-4" />
            <p class="font-semibold text-lg text-gray-600">La tua casella di posta è vuota.</p>
            <p class="text-sm">Le nuove email ricevute all'indirizzo di smistamento appariranno qui.</p>
          </div>
        </CardContent>
      </Card>
      
      <!-- Modale per visualizzare il contenuto completo dell'email -->
      <Dialog :open="showContentModal" @update:open="showContentModal = false">
        <DialogContent v-if="selectedEmailContent" class="sm:max-w-2xl">
            <DialogHeader>
                <DialogTitle>{{ selectedEmailContent.subject }}</DialogTitle>
                <DialogDescription>
                  Da: {{ selectedEmailContent.sender }} • Ricevuta il: {{ formatDate(selectedEmailContent.created_at) }}
                </DialogDescription>
            </DialogHeader>
            <div class="py-4 whitespace-pre-wrap text-sm max-h-[60vh] overflow-y-auto border-t border-b">
                {{ selectedEmailContent.body_text || "Corpo dell'email non disponibile." }}
            </div>
            <DialogFooter>
                <Button @click="showContentModal = false" variant="secondary">Chiudi</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  </div>
</template>

<style>
/* Abbiamo spostato lo sfondo principale qui per un controllo più granulare,
   sebbene quello in app.vue funzioni ancora come fallback. */
body {
  background-color: #f9fafb; /* Un grigio molto chiaro, quasi bianco */
}
</style>