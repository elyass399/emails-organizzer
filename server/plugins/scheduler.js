// server/plugins/scheduler.js
// Rimuovi l'import di node-cron
// import * as cron from 'node-cron'; 

import { Cron } from 'croner'; // <-- Importa Cron da croner (senza CronOptions)
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

  // Programma l'esecuzione periodica della funzione di elaborazione email con croner.
  // croner usa la stessa sintassi cron '*/5 * * * *' (ogni 5 minuti).
  console.log('Email processing scheduler started and scheduled to run every 5 minutes.');
  
  Cron('*/5 * * * *', async () => {
    console.log('Running scheduled email processing (every 5 minutes)...');
    try {
      await processNewIncomingEmails();
    } catch (error) {
      console.error('Error during scheduled email processing run:', error);
    }
  }, { timezone: 'Europe/Rome' }); // Opzionale: specifica il timezone se necessario
});