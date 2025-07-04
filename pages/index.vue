<!-- File: pages/index.vue -->
<script setup>
// NESSUN IMPORT DI COMPONENTI QUI. NUXT LI GESTIRÀ AUTOMATICAMENTE.
import { ref, onMounted } from 'vue';

// --- STATO DELLA PAGINA (rimane invariato) ---
const processedEmails = ref([]);
const unprocessedEmails = ref([]);
const selectedEmailContent = ref(null);
const showContentModal = ref(false);
const isLoading = ref(true);
const isProcessing = ref(false);

// --- DATI DI ESEMPIO (rimangono invariati) ---
const getSampleEmails = () => [
  { id: 'sample-1', sender: 'cliente.tech@email.com', subject: 'Problema con login su App Mobile', body_text: 'Ciao, da stamattina non riesco più ad accedere all"applicazione mobile, continua a darmi "errore di autenticazione". Potete verificare? Grazie.' },
  { id: 'sample-2', sender: 'fornitore.fiscale@email.com', subject: 'Richiesta documenti per dichiarazione IVA', body_text: 'Buongiorno, avremmo bisogno delle fatture di acquisto del terzo trimestre per procedere con la dichiarazione IVA. Potete inviarcele? Saluti, Studio Legale Tributario.' },
  { id: 'sample-3', sender: 'info@eventifiera.com', subject: 'Invito a Fiera del Digitale 2024', body_text: 'Siamo lieti di invitarvi alla Fiera del Digitale che si terrà a Milano il prossimo mese. Sarebbe un"opportunità per presentare il vostro gestionale. Restiamo in attesa di un vostro gentile riscontro.' },
];

// --- FUNZIONI PRINCIPALI (rimangono invariate) ---
const fetchProcessedEmails = async () => {
  isLoading.value = true;
  try {
    processedEmails.value = await $fetch('/api/inbox');
  } catch (error) { console.error("Impossibile caricare la posta smistata:", error); }
  finally { isLoading.value = false; }
};

const processNextEmail = async () => {
  if (unprocessedEmails.value.length === 0) return;
  isProcessing.value = true;
  const emailToProcess = unprocessedEmails.value[0];
  try {
    await $fetch('/api/emails/process', {
      method: 'POST',
      body: { sender: emailToProcess.sender, subject: emailToProcess.subject, body_text: emailToProcess.body_text },
    });
    unprocessedEmails.value.shift();
    await fetchProcessedEmails();
  } catch (error) { alert(`Si è verificato un errore: ${error.data?.message || error.message}`); }
  finally { isProcessing.value = false; }
};

const viewEmailContent = (email) => {
  selectedEmailContent.value = email;
  showContentModal.value = true;
};

const resetSimulation = () => {
  unprocessedEmails.value = getSampleEmails();
  alert('Simulazione resettata.');
};

// --- FUNZIONI UTILI (rimangono invariate) ---
const formatDate = (dateString) => new Date(dateString).toLocaleString('it-IT');
const getConfidenceVariant = (score) => {
  if (score === null) return 'secondary';
  if (score >= 0.8) return 'default';
  if (score >= 0.5) return 'secondary';
  return 'destructive';
};

// --- HOOK (rimane invariato) ---
onMounted(() => {
  unprocessedEmails.value = getSampleEmails();
  fetchProcessedEmails();
});
</script>

<template>
  <div class="container mx-auto p-4 md:p-8 space-y-8">
    <Card>
      <CardHeader>
        <div class="flex justify-between items-center">
          <div>
            <CardTitle>Casella di Posta in Arrivo (Simulata)</CardTitle>
            <CardDescription>Email "in attesa" di essere analizzate dall'AI.</CardDescription>
          </div>
          <Button @click="resetSimulation" variant="outline">Resetta Simulazione</Button>
        </div>
      </CardHeader>
      <CardContent>
        <ul v-if="unprocessedEmails.length > 0" class="space-y-2">
          <li v-for="email in unprocessedEmails" :key="email.id" class="p-3 border rounded-md bg-muted/20">
            <p class="font-medium">{{ email.subject }}</p>
            <p class="text-sm text-muted-foreground">Da: {{ email.sender }}</p>
          </li>
        </ul>
        <p v-else class="text-muted-foreground">Tutte le email sono state processate!</p>
        <Button @click="processNextEmail" :disabled="isProcessing || unprocessedEmails.length === 0" class="w-full mt-4">
          <span v-if="isProcessing">Analisi in corso...</span>
          <span v-else>Processa Prossima Email ({{ unprocessedEmails.length }} Rimanenti)</span>
        </Button>
      </CardContent>
    </Card>

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
                    {{ email.ai_confidence_score ? (email.ai_confidence_score * 100).toFixed(0) + '%' : 'N/D' }}
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
              <Button @click="showContentModal = false">Chiudi</Button>
          </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>