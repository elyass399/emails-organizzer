// server/utils/imapClient.js
import Imap from 'node-imap';
import { simpleParser } from 'mailparser';

export async function fetchNewEmails(config) {
  console.log('IMAP Client Config for fetchNewEmails:', {
    user: config.imapUsername,
    host: config.imapHost,
    port: config.imapPort,
    tls: true,
    tlsOptsRejectUnauthorized: false // Esplicito per il log
  });

  const imap = new Imap({
    user: config.imapUsername,
    password: config.imapPassword,
    host: config.imapHost,
    port: config.imapPort,
    tls: true,
    tlsOpts: { rejectUnauthorized: false }
  });

  let connectionState = 'connecting';
  const endConnection = (error = null) => {
    if (connectionState === 'closed') {
      return;
    }
    try {
      if (imap.state !== 'disconnected') {
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

      if (imap.client && imap.client.socket) {
        imap.client.socket.on('error', (err) => {
          if (err.code === 'ECONNRESET') {
            console.warn('IMAP (Socket): Received ECONNRESET. This is often a benign post-operation disconnect.', err.message);
          } else {
            console.error('IMAP (Socket): Unhandled socket error:', err);
          }
          endConnection(err);
        });
      } else {
          console.warn('IMAP: imap.client or imap.client.socket was not available after ready event. Socket error handling might be incomplete.');
      }

      imap.openBox(config.imapMailbox, false, (err, box) => {
        if (err) {
          console.error('IMAP: Error opening mailbox:', err);
          endConnection(err);
          return reject(err);
        }
        console.log(`IMAP: Mailbox "${config.imapMailbox}" opened.`);

        imap.search(['UNSEEN'], (err, uids) => {
          if (err) {
            console.error('IMAP: Error searching for emails:', err);
            endConnection(err);
            return reject(err);
          }

          if (!uids || uids.length === 0) {
            console.log('IMAP: No new unseen emails.');
            endConnection();
            return resolve([]);
          }

          console.log(`IMAP: Found ${uids.length} unseen emails. Fetching them.`);

          const fetchPromises = [];

          // Assicurati che 'bodies: '' sia sufficiente per gli allegati, lo è per default con mailparser
          const f = imap.fetch(uids, { bodies: '' });

          f.on('message', (msg, seqno) => {
            let buffer = '';
            let currentUid;

            msg.once('attributes', (attrs) => {
              currentUid = attrs.uid;
            });

            const messagePromise = new Promise(messageResolve => {
              msg.on('body', (stream) => {
                stream.on('data', (chunk) => {
                  buffer += chunk.toString('utf8');
                });
                stream.once('end', async () => {
                  try {
                    const parsed = await simpleParser(buffer);

                    // --- NUOVI LOG PER DEBUG ALLEGATI ---
                    console.log(`IMAP: Message #${seqno} parsed. Attachments count: ${parsed.attachments ? parsed.attachments.length : 0}`);
                    if (parsed.attachments && parsed.attachments.length > 0) {
                        parsed.attachments.forEach((att, i) => {
                            console.log(`  Attachment ${i + 1}: Filename='${att.filename}', ContentType='${att.contentType}', Size=${att.size} bytes. Content (Buffer/Uint8Array) present: ${!!att.content && att.content.length > 0}`);
                        });
                    }
                    // --- FINE NUOVI LOG ---

                    messageResolve({
                      uid: currentUid,
                      messageId: parsed.messageId,
                      from: parsed.from?.text,
                      to: parsed.to?.text,
                      subject: parsed.subject,
                      text: parsed.text,
                      html: parsed.html,
                      date: parsed.date,
                      raw: buffer,
                      attachments: parsed.attachments || [] // Questa riga è corretta
                    });
                  } catch (parseErr) {
                    console.error('IMAP: Error parsing email:', parseErr);
                    messageResolve(null);
                  }
                });
              });
            });
            fetchPromises.push(messagePromise);
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
                        flagReject(flagErr);
                      } else {
                        console.log('IMAP: Valid emails marked as seen.');
                        flagResolve();
                      }
                    });
                  });
                } catch (addFlagsError) {
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

    imap.once('error', (err) => {
      if (['ECONNRESET', 'ETIMEDOUT', 'EPIPE'].includes(err.code) && connectionState === 'ready') {
        console.warn(`IMAP: Received a non-critical connection error (${err.code}). Ignoring as a potential post-operation issue.`, err.message);
      } else {
        console.error('IMAP: Global connection error:', err);
        reject(err);
      }
      endConnection(err);
    });

    imap.once('end', () => {
      console.log('IMAP: Connection gracefully ended (IMAP end event).');
    });

    imap.connect();
  });
}