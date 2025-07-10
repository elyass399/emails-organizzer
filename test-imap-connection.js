// test-imap-connection.js - Moduli ES Syntax

import 'dotenv/config'; // Importa dotenv in modo che carichi le variabili

import Imap from 'node-imap';
import { simpleParser } from 'mailparser';

const config = {
  imapHost: process.env.IMAP_HOST,
  imapPort: parseInt(process.env.IMAP_PORT || '993'),
  imapUsername: process.env.IMAP_USERNAME,
  imapPassword: process.env.IMAP_PASSWORD,
  imapMailbox: process.env.IMAP_MAILBOX || 'INBOX',
};

console.log('--- IMAP Test Connection ---');
console.log('IMAP_HOST:', config.imapHost);
console.log('IMAP_PORT:', config.imapPort);
console.log('IMAP_USERNAME:', config.imapUsername);
// Non loggare la password per sicurezza

// Attiva il debug verboso di node-imap (può essere molto dettagliato)
Imap.debug = console.log;

const imap = new Imap({
  user: config.imapUsername,
  password: config.imapPassword,
  host: config.imapHost,
  port: config.imapPort,
  tls: true,
  // *** IMPORTANTE: SOLO PER AMBIENTI DI SVILUPPO/TEST! ***
  // Questa opzione disabilita la verifica che il nome host del server IMAP
  // corrisponda al nome nel suo certificato SSL.
  // È NECESSARIO se il tuo provider (es. Shellrent) usa un certificato generico.
  // Espone a vulnerabilità MITM in produzione. RIMUOVILA se vai in produzione con un certificato valido!
  tlsOpts: { rejectUnauthorized: false }
});

imap.once('ready', () => {
  console.log('IMAP: Connected successfully!');
  imap.openBox(config.imapMailbox, false, (err, box) => {
    if (err) {
      console.error('IMAP: Error opening mailbox:', err);
      imap.end();
      return;
    }
    console.log(`IMAP: Mailbox "${config.imapMailbox}" opened.`);

    // Cerca email non lette (UNSEEN)
    imap.search(['UNSEEN'], (err, uids) => {
      if (err) {
        console.error('IMAP: Error searching for emails:', err);
        imap.end();
        return;
      }

      if (!uids || uids.length === 0) {
        console.log('IMAP: No new unseen emails.');
        imap.end();
        return;
      }

      console.log(`IMAP: Found ${uids.length} unseen emails. Fetching them.`);

      const f = imap.fetch(uids, { bodies: '' }); // Fetch the entire email body
      f.on('message', (msg, seqno) => {
        console.log(`IMAP: Processing message #${seqno} (UID: ${uids[seqno - 1]})`);
        let buffer = '';
        msg.on('body', (stream) => {
          stream.on('data', (chunk) => {
            buffer += chunk.toString('utf8');
          });
          stream.once('end', async () => {
            try {
              const parsed = await simpleParser(buffer);
              console.log(`  From: ${parsed.from?.text}`);
              console.log(`  Subject: ${parsed.subject}`);
              console.log(`  Date: ${parsed.date}`);
              // Puoi aggiungere parsed.text o parsed.html per vedere il corpo
            } catch (parseErr) {
              console.error('  Error parsing email:', parseErr);
            }
          });
        });
      });

      f.once('error', (fetchErr) => {
        console.error('IMAP: Fetch error:', fetchErr);
        imap.end();
      });

      f.once('end', () => {
        console.log('IMAP: Finished fetching messages.');
        // Marca le email come lette, così non le rileggi sempre
        imap.addFlags(uids, ['\\Seen'], (flagErr) => {
          if (flagErr) console.error('IMAP: Error marking emails as seen:', flagErr);
          console.log('IMAP: Emails marked as seen.');
          imap.end(); // Disconnettiti dall'IMAP
        });
      });
    });
  });
});

imap.once('error', (err) => {
  console.error('IMAP: Global error event:', err);
  imap.end();
});

imap.once('end', () => {
  console.log('IMAP: Connection gracefully closed.');
});

imap.connect();