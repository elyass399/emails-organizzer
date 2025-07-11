// server/plugins/scheduler.js
import { Cron } from 'croner';
import { processNewIncomingEmails } from '../utils/mailProcessor';

export default defineNitroPlugin(async (nitroApp) => {
  // Gestore globale per gli errori di Promise non catturati (unhandledRejection).
  process.on('unhandledRejection', (reason, promise) => {
    console.error('GLOBAL ERROR: Unhandled Rejection at Promise', promise, 'reason:', reason);
  });

  // Esegui la funzione di elaborazione email all'avvio del server Nitro.
  console.log('Initial email processing run on server start.');
  try {
    await processNewIncomingEmails();
  } catch (error) {
    console.error('Error during initial email processing run:', error);
  }

  // Programma l'esecuzione periodica della funzione di elaborazione email.
  console.log('Email processing scheduler started and scheduled to run every 5 minutes.');
  
  Cron('*/5 * * * *', async () => {
    console.log('Running scheduled email processing (every 5 minutes)...');
    try {
      await processNewIncomingEmails();
    } catch (error) {
      console.error('Error during scheduled email processing run:', error);
    }
  }, { timezone: 'Europe/Rome' });

  // *** NUOVA AGGIUNTA: Mantiene l'Event Loop attivo per lo scheduler ***
  // Questo previene che il processo Node.js si fermi se non ci sono altre operazioni attive.
  // Un timer fittizio che si esegue ogni minuto.
  setInterval(() => {
    // console.log('Keeping Node.js event loop alive...'); // Puoi scommentare per debug
  }, 1000 * 60); // Ogni minuto
});