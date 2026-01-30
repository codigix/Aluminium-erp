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

let isProcessing = false;
let timeoutId = null;

const processEmails = async () => {
    if (isProcessing) {
        console.log('[Email Receiver] Previous process still running, skipping...');
        return;
    }

    isProcessing = true;
    const client = new ImapFlow(config);

    // Handle unexpected errors to prevent app crash
    client.on('error', err => {
        console.error('[Email Receiver] Unexpected IMAP Client Error:', err.message);
    });

    try {
        console.log(`[Email Receiver] ${new Date().toISOString()} - Starting email sync...`);
        await client.connect();
        let lock = await client.getMailboxLock('INBOX');
        try {
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
            
            console.log(`[Email Receiver] Found ${messages.length} messages to check.`);

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

                    // Match quotation ID or number from subject
                    // Support QRT-123 (Client), QT-123 (Vendor), [QRT-123], [QT-123]
                    let qrtMatch = subject.match(/(QRT|QT)-(\d+)/i) || subject.match(/\[((?:QRT|QT)-[^\]]+)\]/i);
                    
                    // Fallback: Check body if not found in subject (for older emails)
                    if (!qrtMatch) {
                        qrtMatch = body.match(/(QRT|QT)-(\d+)/i);
                    }

                    let quotationId = null;
                    let quotationType = 'CLIENT'; // Default

                    if (qrtMatch) {
                        const prefix = (qrtMatch[1] || '').toUpperCase();
                        
                        // If it's a numeric match like QRT-123, extract the ID
                        if (qrtMatch[2] && !qrtMatch[1].includes('-')) {
                            quotationId = parseInt(qrtMatch[2]);
                            // Determine type from prefix
                            quotationType = (prefix === 'QT') ? 'VENDOR' : 'CLIENT';
                        } else {
                            // If it's a full number match like [QT-1738161038137], find in DB
                            const fullQuoteNumber = qrtMatch[1] || qrtMatch[0];
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
                        const clientMatch = subject.match(/-\s*([^-]+)$/i);
                        if (clientMatch) {
                            const clientName = clientMatch[1].trim();
                            
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
    } finally {
        isProcessing = false;
        console.log(`[Email Receiver] ${new Date().toISOString()} - Email sync finished.`);
        // Schedule next run
        if (timeoutId !== 'STOPPED') {
            timeoutId = setTimeout(processEmails, 60000);
        }
    }
};

const startEmailReceiver = () => {
    if (timeoutId && timeoutId !== 'STOPPED') return;
    console.log('[Email Receiver] Real Email Receiver started (Polling every 60s)');
    timeoutId = null;
    processEmails();
};

const stopEmailReceiver = () => {
    if (timeoutId && timeoutId !== 'STOPPED') {
        clearTimeout(timeoutId);
    }
    timeoutId = 'STOPPED';
    console.log('[Email Receiver] Email Receiver stopped.');
};

module.exports = { startEmailReceiver, stopEmailReceiver, processEmails };
