// server/utils/imapClient.js
import Imap from 'node-imap';
import { simpleParser } from 'mailparser';

export async function fetchNewEmails(config) {
  const imap = new Imap({
    user: config.imapUsername,
    password: config.imapPassword,
    host: config.imapHost,
    port: config.imapPort,
    tls: true,
    tlsOpts: { rejectUnauthorized: false } // Mantiene il bypass del certificato
  });

  // Flag per assicurarsi che la connessione venga chiusa una sola volta e in modo sicuro
  let connectionState = 'connecting'; // 'connecting', 'ready', 'closed', 'error'
  const endConnection = (error = null) => {
    if (connectionState === 'closed') {
      return; // Già chiusa
    }
    try {
      if (imap.state !== 'disconnected') { // Tenta di chiudere solo se non è già disconnesso
        imap.end();
      }
      connectionState = 'closed';
      if (error) {
        console.error('IMAP: Connection ended due to error, but trying to close gracefully:', error.message);
      } else {
        console.log('IMAP: Connection gracefully closed.');
      }
    } catch (e) {
      console.warn('IMAP: Error during imap.end() call (ignored, likely already closed):', e.message);
      connectionState = 'closed';
    }
  };

  return new Promise(async (resolve, reject) => {
    imap.once('ready', () => {
      connectionState = 'ready';
      console.log('IMAP: Connected successfully to the main client!');

      // *** MODIFICA QUI: Sposta il gestore degli errori del socket qui dentro ***
      // imap.client.socket dovrebbe essere definito una volta che la connessione è "ready"
      if (imap.client && imap.client.socket) { // Aggiungi un controllo di sicurezza in più
        imap.client.socket.on('error', (err) => {
          if (err.code === 'ECONNRESET') {
            console.warn('IMAP (Socket): Received ECONNRESET. This is often a benign post-operation disconnect.', err.message);
          } else {
            console.error('IMAP (Socket): Unhandled socket error:', err);
          }
          endConnection(err); // Assicurati che la connessione venga terminata
        });
      } else {
          console.warn('IMAP: imap.client or imap.client.socket was not available after ready event. Socket error handling might be incomplete.');
      }

      imap.openBox(config.imapMailbox, false, (err, box) => {
        if (err) {
          console.error('IMAP: Error opening mailbox:', err);
          endConnection(err); // Chiudi la connessione in caso di errore
          return reject(err); // Rifiuta la promise
        }
        console.log(`IMAP: Mailbox "${config.imapMailbox}" opened.`);

        imap.search(['UNSEEN'], (err, uids) => {
          if (err) {
            console.error('IMAP: Error searching for emails:', err);
            endConnection(err); // Chiudi la connessione in caso di errore
            return reject(err); // Rifiuta la promise
          }

          if (!uids || uids.length === 0) {
            console.log('IMAP: No new unseen emails.');
            endConnection(); // Chiudi la connessione
            return resolve([]); // Risolvi con array vuoto se non ci sono email
          }

          console.log(`IMAP: Found ${uids.length} unseen emails. Fetching them.`);

          const fetchPromises = []; // Array per contenere le Promises di ogni singola email

          const f = imap.fetch(uids, { bodies: '', struct: true, markSeen: false }); // markSeen: false per marcare manualmente

          f.on('message', (msg, seqno) => {
            let buffer = '';
            let currentUid; // Variabile per immagazzinare l'UID di questo specifico messaggio

            // Cattura l'UID appena gli attributi sono disponibili
            msg.once('attributes', (attrs) => {
              currentUid = attrs.uid;
            });

            // Crea una Promise per il parsing di questo singolo messaggio
            const messagePromise = new Promise(messageResolve => {
              msg.on('body', (stream) => {
                stream.on('data', (chunk) => {
                  buffer += chunk.toString('utf8');
                });
                stream.once('end', async () => {
                  try {
                    const parsed = await simpleParser(buffer);
                    messageResolve({ // Risolvi la Promise del messaggio con i dati parsati
                      uid: currentUid, // USA L'UID CATTURATO DAGLI ATTRIBUTI
                      messageId: parsed.messageId,
                      from: parsed.from?.text,
                      to: parsed.to?.text,
                      subject: parsed.subject,
                      text: parsed.text,
                      html: parsed.html,
                      date: parsed.date,
                      raw: buffer
                    });
                  } catch (parseErr) {
                    console.error('Error parsing email:', parseErr);
                    messageResolve(null); // Risolvi con null in caso di errore di parsing
                  }
                });
              });
            });
            fetchPromises.push(messagePromise); // Aggiungi la Promise di questo messaggio all'array
          });

          f.once('error', (fetchErr) => {
            console.error('IMAP: Fetch stream error:', fetchErr);
            endConnection(fetchErr);
            reject(fetchErr);
          });

          f.once('end', async () => {
            console.log('IMAP: Fetch stream ended. Waiting for all messages to parse.');
            const parsedEmails = (await Promise.all(fetchPromises)).filter(email => email !== null);
            console.log(`IMAP: Successfully parsed ${parsedEmails.length} emails.`);

            if (parsedEmails.length > 0) {
              const validUidsToMark = parsedEmails.map(e => e.uid).filter(uid => uid !== undefined && uid !== null);
              
              if (validUidsToMark.length > 0) {
                try {
                  await new Promise((flagResolve, flagReject) => {
                    imap.addFlags(validUidsToMark, ['\\Seen'], (flagErr) => {
                      if (flagErr) {
                        console.error('IMAP: Error marking emails as seen:', flagErr);
                        flagReject(flagErr); // Rifiuta la Promise interna se c'è un errore
                      } else {
                        console.log('IMAP: Valid emails marked as seen.');
                        flagResolve(); // Risolvi la Promise interna
                      }
                    });
                  });
                } catch (addFlagsError) {
                  // Se addFlags fallisce, lo logghiamo ma non blocchiamo il flusso principale
                  console.error('IMAP: Failed to mark emails as seen due to:', addFlagsError);
                }
                endConnection();
                resolve(parsedEmails);
              } else {
                console.warn('IMAP: No valid UIDs found to mark as seen, but emails were parsed. Ending connection.');
                endConnection();
                resolve(parsedEmails);
              }
            } else {
              console.log('IMAP: No emails parsed successfully. Ending connection.');
              endConnection();
              resolve([]);
            }
          });
        });
      });
    });

    // Gestore generale per errori IMAP (cattura eventi che non sono legati a specifici stream di fetch)
    imap.once('error', (err) => {
      // Cattura ECONNRESET solo se la connessione non è già gestita altrove.
      // A volte ECONNRESET avviene dopo la chiusura intenzionale del socket.
      if (!connectionEnded && ['ECONNRESET', 'ETIMEDOUT', 'EPIPE'].includes(err.code) && connectionState === 'ready') {
        console.warn(`IMAP: Received a non-critical connection error (${err.code}). Ignoring as a potential post-operation issue.`, err.message);
      } else if (!connectionEnded) { // Per altri errori non gestiti e se la connessione non è chiusa
        console.error('IMAP: Global connection error:', err);
        reject(err);
      }
      endConnection(err); // Assicurati di chiudere la connessione
    });

    imap.once('end', () => {
      console.log('IMAP: Connection gracefully ended (IMAP end event).');
    });

    imap.connect();
  });
}