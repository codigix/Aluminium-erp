const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

const uploadsDir = path.join(process.cwd(), process.env.UPLOAD_DIR || 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

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
    
    // Add error listener to prevent crash on connection reset/errors
    client.on('error', err => {
        console.error(`[Email Receiver] ImapFlow Error: ${err.message}`);
    });

    try {
        console.log(`[Email Receiver] ${new Date().toISOString()} - Starting email sync...`);
        await client.connect();
        let lock = await client.getMailboxLock('INBOX');
        try {
            await client.mailboxOpen('INBOX');

            // Search for unread messages
            let messages = await client.search({ seen: false });
            
            // If no unread, check last 5 messages just in case
            if (messages.length === 0) {
                const list = await client.fetch('1:*', { uid: true }, { last: 5 });
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
                    
                    if (!body && parsed.html) {
                        body = parsed.html.replace(/<[^>]*>?/gm, ''); 
                    }

                    const from = parsed.from?.value[0]?.address || '';
                    const messageId = parsed.messageId;

                    // Match quotation ID or number from subject
                    // Improved regex to handle both standard and bracketed formats
                    const qrtMatch = subject.match(/(QRT|QT)-(\d+)/i) || subject.match(/\[((?:QRT|QT)-([^\]]+))\]/i);
                    
                    let quotationId = null;
                    let quotationType = 'CLIENT'; 

                    if (qrtMatch) {
                        let prefix, fullMatch, numericPart;
                        
                        if (qrtMatch[0].startsWith('[')) {
                            fullMatch = qrtMatch[1];
                            prefix = (fullMatch.split('-')[0] || '').toUpperCase();
                            numericPart = fullMatch.split('-')[1];
                        } else {
                            fullMatch = qrtMatch[0];
                            prefix = (qrtMatch[1] || '').toUpperCase();
                            numericPart = qrtMatch[2];
                        }

                        if (prefix === 'QT') {
                            quotationType = 'VENDOR';
                            const [rows] = await pool.query('SELECT id FROM quotations WHERE quote_number = ?', [fullMatch]);
                            if (rows.length > 0) {
                                quotationId = rows[0].id;
                            }
                        } else if (prefix === 'QRT') {
                            quotationType = 'CLIENT';
                            if (numericPart && /^\d+$/.test(numericPart) && numericPart.length < 10) {
                                quotationId = parseInt(numericPart);
                            }
                        }
                    }

                    if (quotationId) {
                        const cleanBody = stripReply(body);
                        
                        const [existing] = await pool.query(
                            'SELECT id FROM quotation_communications WHERE email_message_id = ?',
                            [messageId]
                        );

                        if (existing.length === 0) {
                            let pdfPath = null;
                            if (quotationType === 'VENDOR' && parsed.attachments && parsed.attachments.length > 0) {
                                for (let attachment of parsed.attachments) {
                                    if (attachment.contentType === 'application/pdf' || attachment.filename?.toLowerCase().endsWith('.pdf')) {
                                        const filename = `${Date.now()}-vendor-${attachment.filename.replace(/\s+/g, '_')}`;
                                        const fullPath = path.join(uploadsDir, filename);
                                        fs.writeFileSync(fullPath, attachment.content);
                                        pdfPath = filename;
                                        console.log(`[Email Receiver] Saved vendor PDF: ${filename}`);
                                        break;
                                    }
                                }
                            }

                            // Use execute for the INSERT
                            await pool.execute(
                                `INSERT INTO quotation_communications 
                                (quotation_id, quotation_type, sender_type, sender_email, message, email_message_id, created_at, is_read) 
                                VALUES (?, ?, ?, ?, ?, ?, NOW(), 0)`,
                                [quotationId, quotationType, quotationType, from, cleanBody, messageId]
                            );
                            
                            if (quotationType === 'VENDOR') {
                                const updateFields = ["status = 'EMAIL_RECEIVED'"];
                                const updateParams = [];
                                
                                if (pdfPath) {
                                    updateFields.push("received_pdf_path = ?");
                                    updateParams.push(pdfPath);
                                }
                                
                                updateParams.push(quotationId);
                                await pool.execute(
                                    `UPDATE quotations SET ${updateFields.join(', ')} WHERE id = ?`,
                                    updateParams
                                );
                                console.log(`[Email Receiver] Updated Quotation ${quotationId} to EMAIL_RECEIVED status`);
                            }
                        }
                    }

                    // Always mark as seen if we reached here
                    await client.messageFlagsAdd(uid, ['\\Seen']);
                } catch (msgError) {
                    console.error(`[Email Receiver] Error parsing message UID ${uid}:`, msgError.message);
                    // Mark as seen anyway to avoid infinite loop on bad messages
                    try { await client.messageFlagsAdd(uid, ['\\Seen']); } catch (e) {}
                }
            }
        } finally {
            if (lock) lock.release();
        }
        await client.logout();
    } catch (error) {
        console.error('[Email Receiver] IMAP Error:', error.message);
        try { await client.logout(); } catch (e) {}
    } finally {
        isProcessing = false;
        console.log(`[Email Receiver] ${new Date().toISOString()} - Email sync finished.`);
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
