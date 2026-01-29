const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const pool = require('../config/db');

const config = {
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: {
        user: process.env.MAIL_FROM_ADDRESS || 'reactjscodigix@gmail.com',
        pass: process.env.MAIL_PASSWORD || 'psgrciqnkzpxylme'
    },
    logger: false
};

const stripReply = (text) => {
    if (!text) return '';
    
    // Common patterns to split email threads
    const patterns = [
        /\n\s*---\s*\n/i, // --- 
        /\n\s*________________________________\s*\n/i, // ________________________________
        /\nFrom: /i,
        /\nOn .* wrote:/i,
        /\nSent from my /i,
        /\n> /i // Quoted lines
    ];

    let cleanText = text;
    for (const pattern of patterns) {
        const parts = cleanText.split(pattern);
        if (parts.length > 0) {
            cleanText = parts[0];
        }
    }

    return cleanText.trim();
};

const processEmails = async () => {
    const client = new ImapFlow(config);
    try {
        await client.connect();
        let lock = await client.getMailboxLock('INBOX');
        try {
            // Select INBOX
            await client.mailboxOpen('INBOX');

            // Search for unread messages
            let messages = await client.search({ seen: false });
            
            for (let uid of messages) {
                try {
                    let message = await client.fetchOne(uid, { source: true });
                    const parsed = await simpleParser(message.source);
                    const subject = parsed.subject || '';
                    let body = parsed.text || '';
                    
                    // Fallback to HTML if text is empty
                    if (!body && parsed.html) {
                        body = parsed.html.replace(/<[^>]*>?/gm, ''); // Basic HTML strip
                    }

                    const from = parsed.from?.value[0]?.address || '';
                    const messageId = parsed.messageId;

                    console.log(`[Email Receiver] Processing email: ${subject} from ${from}`);

                    // Try to match quotation ID from subject (e.g., QRT-0007 or Quotation QRT-0007)
                    const qrtMatch = subject.match(/QRT-(\d+)/i);
                    if (qrtMatch) {
                        const quotationId = parseInt(qrtMatch[1]);
                        const cleanBody = stripReply(body);
                        
                        // Check if this message already exists in DB to avoid duplicates
                        const [existing] = await pool.query(
                            'SELECT id FROM quotation_communications WHERE email_message_id = ?',
                            [messageId]
                        );

                        if (existing.length === 0) {
                            // Insert into database with email_message_id
                            await pool.execute(
                                `INSERT INTO quotation_communications 
                                (quotation_id, quotation_type, sender_type, sender_email, message, email_message_id, created_at, is_read) 
                                VALUES (?, ?, ?, ?, ?, ?, NOW(), 0)`,
                                [quotationId, 'CLIENT', 'CLIENT', from, cleanBody, messageId]
                            );
                            
                            console.log(`[Email Receiver] Saved reply for Quotation QRT-${quotationId}`);
                        }
                    }

                    // Mark as seen
                    await client.messageFlagsAdd(uid, ['\\Seen']);
                } catch (msgError) {
                    console.error('[Email Receiver] Error parsing message:', msgError.message);
                }
            }
        } finally {
            if (lock) lock.release();
        }
        await client.logout();
    } catch (error) {
        console.error('[Email Receiver] IMAP Error:', error.message);
        // Ensure client is closed on error
        try { await client.logout(); } catch (e) {}
    }
};

let intervalId = null;

const startEmailReceiver = () => {
    if (intervalId) return;
    console.log('[Email Receiver] Real Email Receiver started (Polling every 60s)');
    // Run immediately on start
    processEmails();
    // Then every 60 seconds
    intervalId = setInterval(processEmails, 60000);
};

const stopEmailReceiver = () => {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }
};

module.exports = { startEmailReceiver, stopEmailReceiver, processEmails };
