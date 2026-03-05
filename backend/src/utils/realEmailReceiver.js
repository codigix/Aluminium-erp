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

            // Search for unread messages - fetch UIDs specifically
            let messages = [];
            const searchResult = await client.search({ seen: false });
            
            // Convert sequence numbers to UIDs for consistent processing
            if (searchResult.length > 0) {
                const list = await client.fetch(searchResult.join(','), { uid: true });
                for await (const msg of list) {
                    messages.push(msg.uid);
                }
                console.log(`[Email Receiver] Found ${messages.length} unread messages.`);
            }
            
            // If no unread, check last 10 messages just in case (increased from 5)
            if (messages.length === 0) {
                const list = await client.fetch('1:*', { uid: true }, { last: 10 });
                for await (const msg of list) {
                    messages.push(msg.uid);
                }
                console.log(`[Email Receiver] Checking last ${messages.length} messages (fallback).`);
            }
            
            for (let uid of messages) {
                try {
                    // Always use { uid: true } when fetching by UID
                    let message = await client.fetchOne(uid, { source: true }, { uid: true });
                    if (!message) continue;
                    
                    const parsed = await simpleParser(message.source);
                    const subject = parsed.subject || '';
                    let body = parsed.text || '';
                    
                    if (!body && parsed.html) {
                        body = parsed.html.replace(/<[^>]*>?/gm, ''); 
                    }

                    const from = (parsed.from?.value[0]?.address || '').toLowerCase();
                    const messageId = parsed.messageId;
                    const systemEmail = (process.env.MAIL_FROM_ADDRESS || 'reactjscodigix@gmail.com').toLowerCase();

                    console.log(`[Email Receiver] Checking email: Subject: "${subject}", From: ${from}`);

                    // Skip emails sent BY the system
                    if (from === systemEmail) {
                        console.log(`[Email Receiver] Skipping system-sent email.`);
                        if (searchResult.length > 0) {
                            await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
                        }
                        continue;
                    }

                    // Match quotation ID or number from subject
                    // Enhanced regex to handle various formats and ensure it's not just a random number
                    // Matches QRT-0005, [QRT-0005], Quotation Request QRT-0005, etc.
                    const qrtMatch = subject.match(/(?:QRT|QT)[\s\-_:#]*(\d+)/i) || subject.match(/\[((?:QRT|QT)[\s\-_:#]*([^\]]+))\]/i);
                    
                    let quotationId = null;
                    let quotationType = 'CLIENT'; 

                    if (qrtMatch) {
                        let prefix, fullMatch, numericPart;
                        
                        if (qrtMatch[0].startsWith('[')) {
                            fullMatch = qrtMatch[1];
                            // Split by any non-alphanumeric char
                            const parts = fullMatch.split(/[^a-zA-Z0-9]+/);
                            prefix = (parts[0] || '').toUpperCase();
                            numericPart = parts[1];
                        } else {
                            fullMatch = qrtMatch[0];
                            prefix = (qrtMatch[1] || '').toUpperCase();
                            numericPart = qrtMatch[2];
                        }

                        if (prefix === 'QT') {
                            quotationType = 'VENDOR';
                            // Try matching by full quote number first (most reliable)
                            const [rows] = await pool.query('SELECT id FROM quotations WHERE quote_number = ?', [fullMatch]);
                            if (rows.length > 0) {
                                quotationId = rows[0].id;
                            } else if (numericPart && /^\d+$/.test(numericPart) && numericPart.length < 10) {
                                // Fallback to ID ONLY if numericPart looks like a small integer (possible ID)
                                quotationId = parseInt(numericPart);
                            }
                        } else if (prefix === 'QRT') {
                            quotationType = 'CLIENT';
                            if (numericPart && /^\d+$/.test(numericPart) && numericPart.length < 10) {
                                quotationId = parseInt(numericPart);
                            }
                        }
                    }

                    if (quotationId) {
                        console.log(`[Email Receiver] Matched to Quotation ${quotationId} (${quotationType})`);
                        const cleanBody = stripReply(body);
                        
                        const [existing] = await pool.query(
                            'SELECT id FROM quotation_communications WHERE email_message_id = ?',
                            [messageId]
                        );

                        if (existing.length === 0) {
                            console.log(`[Email Receiver] Found new reply for ${quotationType} Quote ${quotationId} from ${from}`);
                            
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

                    // Only mark as seen if it's actually an unread message from search
                    // If it was picked up by fallback (already seen), we don't need to do anything
                    if (searchResult.length > 0) {
                        await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
                    }
                } catch (msgError) {
                    console.error(`[Email Receiver] Error parsing message UID ${uid}:`, msgError.message);
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
