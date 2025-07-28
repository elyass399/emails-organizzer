// server/utils/imapClient.js
import Imap from 'node-imap';
import { simpleParser } from 'mailparser';

export function fetchNewEmails(config) {
  return new Promise((resolve, reject) => {
    let imap;
    try {
      imap = new Imap({
        user: config.imapUsername,
        password: config.imapPassword,
        host: config.imapHost,
        port: config.imapPort,
        tls: true,
        tlsOptions: { rejectUnauthorized: false },
      });
    } catch (e) {
      return reject(e);
    }

    const gracefulEnd = (result) => {
      if (imap.state !== 'disconnected') {
        imap.end();
      }
      if (result instanceof Error) {
        reject(result);
      } else {
        resolve(result);
      }
    };
    
    imap.once('error', (err) => {
      console.error('IMAP: Global connection error:', err);
    });

    imap.once('end', () => {
      console.log('IMAP: Connection ended.');
    });

    imap.once('ready', () => {
      imap.openBox(config.imapMailbox, false, (err, box) => {
        if (err) return gracefulEnd(new Error(`IMAP openBox error: ${err.message}`));
        
        imap.search(['UNSEEN'], (err, uids) => {
          if (err) return gracefulEnd(new Error(`IMAP search error: ${err.message}`));

          if (!uids || uids.length === 0) {
            console.log('IMAP: No new unseen emails.');
            return gracefulEnd([]);
          }

          console.log(`IMAP: Found ${uids.length} unseen emails.`);
          const f = imap.fetch(uids, { bodies: '' });
          const emails = [];

          // --- MODIFICA CHIAVE QUI: Logica di raccolta email resa più robusta ---
          f.on('message', (msg, seqno) => {
            let buffer = '';
            let attributes = null;

            msg.once('attributes', (attrs) => {
              attributes = attrs; // Cattura gli attributi (che contengono l'UID)
            });
            
            msg.on('body', (stream) => {
              stream.on('data', (chunk) => { buffer += chunk.toString('utf8'); });
            });

            msg.once('end', () => {
              // Associa il buffer e gli attributi solo alla fine
              emails.push({ attributes, buffer });
            });
          });
          // --- FINE MODIFICA ---

          f.once('error', (fetchErr) => {
            console.error('IMAP: Fetch error:', fetchErr);
            return gracefulEnd(fetchErr);
          });

          f.once('end', async () => {
            console.log('IMAP: Finished fetching. Parsing emails...');
            const parsedEmails = [];
            for (const email of emails) {
                try {
                    // Controlla che gli attributi e l'UID siano validi prima di parsare
                    if (!email.attributes || !email.attributes.uid) {
                        console.warn('IMAP: Skipping message with missing UID.');
                        continue;
                    }
                    const parsed = await simpleParser(email.buffer);
                    // Aggiungi l'UID dagli attributi catturati
                    parsedEmails.push({ ...parsed, uid: email.attributes.uid });
                } catch(e) {
                    console.error(`IMAP: Error parsing email (UID possibly ${email.attributes?.uid}):`, e.message);
                }
            }

            // --- MODIFICA CHIAVE DI SICUREZZA QUI ---
            const uidsToMark = parsedEmails.map(e => e.uid).filter(uid => uid != null); // Filtra via null/undefined
            
            if (uidsToMark.length > 0) {
                imap.addFlags(uidsToMark, ['\\Seen'], (flagErr) => {
                    if (flagErr) console.error('IMAP: Error marking emails as seen:', flagErr);
                    return gracefulEnd(parsedEmails);
                });
            } else {
                return gracefulEnd(parsedEmails); // Restituisce le email parsate anche se non c'è nulla da marcare
            }
          });
        });
      });
    });

    imap.connect();
  });
}