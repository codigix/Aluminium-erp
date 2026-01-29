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

            // Search for unread messages OR recently received messages to ensure we don't miss anything
            let messages = await client.search({ seen: false });
            
            // If no unread, check last 10 messages just in case some were marked seen but not processed
            if (messages.length === 0) {
                const list = await client.fetch('1:*', { uid: true }, { last: 10 });
                for await (const msg of list) {
                    messages.push(msg.uid);
                }
            }
            
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

                    // Match quotation ID or number from subject
                    // Support QRT-123 (Client), QT-123 (Vendor), [QRT-123], [QT-123]
                    let qrtMatch = subject.match(/(QRT|QT)-(\d+)/i) || subject.match(/\[((?:QRT|QT)-[^\]]+)\]/i);
                    
                    // Fallback: Check body if not found in subject (for older emails)
                    if (!qrtMatch) {
                        qrtMatch = body.match(/(QRT|QT)-(\d+)/i);
                        if (qrtMatch) console.log(`[Email Receiver] Found ID ${qrtMatch[0]} in email body fallback`);
                    }

                    let quotationId = null;
                    let quotationType = 'CLIENT'; // Default

                    if (qrtMatch) {
                        const prefix = (qrtMatch[1] || '').toUpperCase();
                        
                        // If it's a numeric match like QRT-123, extract the ID
                        if (qrtMatch[2]) {
                            quotationId = parseInt(qrtMatch[2]);
                            // Determine type from prefix
                            if (prefix === 'QT') {
                                quotationType = 'VENDOR';
                            } else {
                                quotationType = 'CLIENT';
                            }
                        } else {
                            // If it's a full number match like [QT-1738161038137], find in DB
                            const fullQuoteNumber = qrtMatch[1];
                            if (fullQuoteNumber.startsWith('QT-')) {
                                quotationType = 'VENDOR';
                                const [rows] = await pool.query('SELECT id FROM quotations WHERE quote_number = ?', [fullQuoteNumber]);
                                if (rows.length > 0) quotationId = rows[0].id;
                            } else {
                                quotationType = 'CLIENT';
                                // For QRT-0007, try to extract numeric ID if it's not in a dedicated quote_number column
                                const numMatch = fullQuoteNumber.match(/\d+/);
                                if (numMatch) quotationId = parseInt(numMatch[0]);
                            }
                        }
                    } else {
                        // LAST RESORT: Try to match by client name in subject for older emails
                        // Example subject: "Re: Quotation Request from SP TECHPIONEER - S_DEMOO"
                        const clientMatch = subject.match(/-\s*([^-]+)$/i);
                        if (clientMatch) {
                            const clientName = clientMatch[1].trim();
                            console.log(`[Email Receiver] Attempting fallback search for client name: ${clientName}`);
                            
                            // Find company ID
                            const [companies] = await pool.query(
                                'SELECT id FROM companies WHERE company_name LIKE ?',
                                [`%${clientName}%`]
                            );

                            if (companies.length > 0) {
                                // Find latest quotation request for this company
                                const [quotes] = await pool.query(
                                    'SELECT id FROM quotation_requests WHERE company_id = ? ORDER BY created_at DESC LIMIT 1',
                                    [companies[0].id]
                                );
                                
                                if (quotes.length > 0) {
                                    quotationId = quotes[0].id;
                                    quotationType = 'CLIENT';
                                    console.log(`[Email Receiver] Fallback matched client ${clientName} to Quotation Request ID: ${quotationId}`);
                                }
                            }
                        }
                    }

                    if (quotationId) {
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
                                [quotationId, quotationType, quotationType, from, cleanBody, messageId]
                            );
                            
                            console.log(`[Email Receiver] Saved ${quotationType} reply for Quotation ID: ${quotationId} from ${from}`);
                        }
                    } else {
                        console.log(`[Email Receiver] No valid quotation ID found in subject: ${subject}`);
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
