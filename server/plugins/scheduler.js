// server/plugins/scheduler.js
import { Cron } from 'croner';
import { processNewIncomingEmails } from '../utils/mailProcessor';

export default defineNitroPlugin(async (nitroApp) => {
  // Aggiunto per debug: Controlla la variabile d'ambiente
  console.log('--- NITRO SERVER START ---');
  console.log('NODE_TLS_REJECT_UNAUTHORIZED (in Nitro):', process.env.NODE_TLS_REJECT_UNAUTHORIZED);
  console.log('--- END NITRO SERVER START ---');

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
  
  // *** MODIFICA QUI: Aggiungi "new" prima di Cron() e imposta a 5 minuti ***
  new Cron('*/5 * * * *', async () => { // Esegui ogni 5 minuti
    console.log('Running scheduled email processing (every 5 minutes)...');
    try {
      await processNewIncomingEmails();
    } catch (error) {
      console.error('Error during scheduled email processing run:', error);
    }
  }, { timezone: 'Europe/Rome' });


});