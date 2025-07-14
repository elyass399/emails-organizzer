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
  console.log('Email processing scheduler started and scheduled to run every  minute.');
  
  // *** MODIFICA QUI: Aggiungi "new" prima di Cron() ***
  new Cron('*/1 * * * *', async () => { 
    console.log('Running scheduled email processing (every  minute)...');
    try {
      await processNewIncomingEmails();
    } catch (error) {
      console.error('Error during scheduled email processing run:', error);
    }
  }, { timezone: 'Europe/Rome' });


});