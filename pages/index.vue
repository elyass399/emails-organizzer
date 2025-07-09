<!-- File: pages/index.vue (con nuovo styling) -->
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
  refreshInterval = setInterval(fetchProcessedEmails, 30000);
});

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
});
</script>

<template>
  <div class="bg-slate-50 min-h-screen">
    <div class="container mx-auto p-4 sm:p-6 lg:p-8">
      <!-- Componente per mostrare le notifiche (toast) -->
      <Toaster />

      <!-- Card principale per la posta smistata -->
      <Card class="w-full max-w-7xl mx-auto shadow-sm border border-slate-200">
        <CardHeader class="border-b border-slate-200">
          <CardTitle class="text-2xl font-bold tracking-tight text-slate-800">Posta in Arrivo Smistata</CardTitle>
          <CardDescription>
            Elenco delle email analizzate dall'AI. La lista si aggiorna automaticamente.
          </CardDescription>
        </CardHeader>
        <CardContent class="p-0"> <!-- Rimuoviamo il padding qui per dare il pieno controllo alla tabella -->
          <!-- Stato di caricamento iniziale -->
          <div v-if="isLoading" class="flex flex-col items-center justify-center text-center py-24 text-slate-500">
            <LoaderCircle class="h-8 w-8 animate-spin mb-4" />
            <p class="font-medium">Caricamento storico email...</p>
          </div>

          <!-- Tabella con le email -->
          <div v-else-if="processedEmails.length > 0">
            <Table>
              <TableHeader class="bg-slate-100">
                <TableRow>
                  <TableHead class="w-[35%] font-semibold text-slate-700">Mittente & Oggetto</TableHead>
                  <TableHead class="font-semibold text-slate-700">Assegnato A</TableHead>
                  <TableHead class="text-center font-semibold text-slate-700">Confidenza AI</TableHead>
                  <TableHead class="text-right font-semibold text-slate-700">Data Ricezione</TableHead>
                  <TableHead class="text-center w-[120px] font-semibold text-slate-700">Azione</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="email in processedEmails" :key="email.id" class="hover:bg-slate-50">
                  <TableCell class="p-4 align-top">
                    <div class="font-medium text-slate-800 truncate" :title="email.sender">{{ email.sender }}</div>
                    <div class="text-sm text-slate-500 truncate max-w-xs" :title="email.subject">
                      {{ email.subject }}
                    </div>
                  </TableCell>
                  <TableCell class="p-4 align-middle">
                    <Badge variant="outline">{{ email.staff?.name || 'Non Assegnato' }}</Badge>
                  </TableCell>
                  <TableCell class="p-4 text-center align-middle">
                    <Badge :variant="getConfidenceVariant(email.ai_confidence_score)">
                      {{ email.ai_confidence_score !== null ? (email.ai_confidence_score * 100).toFixed(0) + '%' : 'N/D' }}
                    </Badge>
                  </TableCell>
                  <TableCell class="p-4 text-right text-sm text-slate-500 align-middle">{{ formatDate(email.created_at) }}</TableCell>
                  <TableCell class="p-4 text-center align-middle">
                     <Button @click="viewEmailContent(email)" variant="ghost" size="icon">
                       <Eye class="h-4 w-4 text-slate-600" />
                       <span class="sr-only">Visualizza Email</span>
                     </Button>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <!-- Stato vuoto, quando non ci sono email -->
          <div v-else class="flex flex-col items-center justify-center text-center p-16 text-slate-500 border-t border-slate-200">
            <Inbox class="h-12 w-12 mb-4 text-slate-400" />
            <p class="font-semibold text-lg text-slate-700">La tua casella di posta è vuota.</p>
            <p class="text-sm">Le nuove email processate appariranno qui.</p>
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