<!-- File: pages/index.vue -->
<script setup>
import { ref, onMounted } from 'vue';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast/use-toast';
import { Toaster } from '@/components/ui/toast';

// --- STATO DELLA PAGINA ---
const processedEmails = ref([]);
const selectedEmailContent = ref(null);
const showContentModal = ref(false);
const isLoading = ref(true); // Per la tabella della posta smistata
const isProcessing = ref(false); // Per il modulo di invio

// --- DATI DEL MODULO ---
const newEmail = ref({
  sender: 'cliente.generico@email.com',
  subject: 'Richiesta informazioni fattura',
  body_text: 'Buongiorno, vorrei ricevere una copia della fattura n. 123 del mese scorso. Grazie.'
});

// Toast per notifiche
const { toast } = useToast();

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

const processManualEmail = async () => {
  if (!newEmail.value.sender || !newEmail.value.subject || !newEmail.value.body_text) {
    toast({
      title: 'Dati mancanti',
      description: 'Compila tutti i campi per poter analizzare l\'email.',
      variant: 'destructive',
    });
    return;
  }

  isProcessing.value = true;
  try {
    const result = await $fetch('/api/emails/process', {
      method: 'POST',
      body: newEmail.value,
    });
    
    toast({
      title: 'Successo!',
      description: `Email assegnata a ${result.assignment?.name || 'N/D'}.`,
    });

    // Pulisce il modulo e ricarica la lista
    newEmail.value = { sender: '', subject: '', body_text: '' };
    await fetchProcessedEmails();

  } catch (error) {
    console.error("Errore durante l'analisi:", error);
    toast({
      title: 'Errore durante l\'analisi',
      description: error.data?.message || 'Si è verificato un errore imprevisto.',
      variant: 'destructive',
    });
  } finally {
    isProcessing.value = false;
  }
};

const viewEmailContent = (email) => {
  selectedEmailContent.value = email;
  showContentModal.value = true;
};

// --- FUNZIONI UTILI ---
const formatDate = (dateString) => new Date(dateString).toLocaleString('it-IT');
const getConfidenceVariant = (score) => {
  if (score === null || score === undefined) return 'secondary';
  if (score >= 0.8) return 'default'; // Verde nel tema di default
  if (score >= 0.5) return 'secondary';
  return 'destructive';
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

    <!-- Card per l'invio manuale -->
    <Card>
      <CardHeader>
        <CardTitle>Test Manuale Analisi Email</CardTitle>
        <CardDescription>Inserisci i dati di un'email per testare l'assegnazione da parte dell'AI.</CardDescription>
      </CardHeader>
      <CardContent>
        <form @submit.prevent="processManualEmail" class="space-y-4">
          <div class="space-y-2">
            <Label for="sender">Mittente</Label>
            <Input id="sender" v-model="newEmail.sender" placeholder="es. mario.rossi@email.com" />
          </div>
          <div class="space-y-2">
            <Label for="subject">Oggetto</Label>
            <Input id="subject" v-model="newEmail.subject" placeholder="es. Problema con fattura" />
          </div>
          <div class="space-y-2">
            <Label for="body_text">Corpo del Messaggio</Label>
            <Textarea id="body_text" v-model="newEmail.body_text" placeholder="Scrivi qui il testo dell'email..." class="min-h-32" />
          </div>
          <Button type="submit" :disabled="isProcessing" class="w-full">
            <span v-if="isProcessing">Analisi in corso...</span>
            <span v-else>Analizza e Smista Email</span>
          </Button>
        </form>
      </CardContent>
    </Card>

    <!-- Card per la posta smistata -->
    <Card>
      <CardHeader>
        <CardTitle>Posta Smistata dall'AI</CardTitle>
        <CardDescription>Elenco delle email analizzate e assegnate a un dipartimento/responsabile.</CardDescription>
      </CardHeader>
      <CardContent>
        <div v-if="isLoading" class="text-center py-16"><p>Caricamento storico...</p></div>
        <div v-else-if="processedEmails.length > 0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mittente & Oggetto</TableHead>
                <TableHead>Etichetta (Assegnato A)</TableHead>
                <TableHead class="text-center">Confidenza AI</TableHead>
                <TableHead class="text-right">Ricevuta il</TableHead>
                <TableHead class="text-center">Contenuto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="email in processedEmails" :key="email.id">
                <TableCell class="font-medium">
                  <div>{{ email.sender }}</div>
                  <div class="text-xs text-muted-foreground truncate max-w-xs" :title="email.subject">{{ email.subject }}</div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{{ email.staff?.name || 'Non Assegnato' }}</Badge>
                </TableCell>
                <TableCell class="text-center">
                  <Badge :variant="getConfidenceVariant(email.ai_confidence_score)">
                    {{ email.ai_confidence_score !== null && email.ai_confidence_score !== undefined ? (email.ai_confidence_score * 100).toFixed(0) + '%' : 'N/D' }}
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
        <div v-else class="text-center py-16"><p class="text-muted-foreground">Nessuna email è stata ancora processata.</p></div>
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