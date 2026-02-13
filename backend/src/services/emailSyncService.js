const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const fs = require('fs');
const path = require('path');
const quotationService = require('./quotationService');
const pool = require('../config/db');

const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: {
        user: process.env.MAIL_FROM_ADDRESS || process.env.EMAIL_USER,
        pass: process.env.MAIL_PASSWORD || process.env.EMAIL_PASSWORD
    },
    logger: false
});

const uploadsDir = path.join(process.cwd(), process.env.UPLOAD_DIR || 'uploads');

async function syncEmails() {
    try {
        console.log('[EmailSync] Connecting to IMAP server...');
        await client.connect();

        let lock = await client.getMailboxLock('INBOX');
        try {
            await client.mailboxOpen('INBOX');
            
            // Search for unread messages that might be replies to RFQs
            let uids = await client.search({ seen: false });
            console.log(`[EmailSync] Found ${uids.length} messages to check.`);

            for (let uid of uids) {
                const message = await client.fetchOne(uid, { source: true });
                const parsed = await simpleParser(message.source);
                const subject = parsed.subject || '';
                
                // Regex to find Quote Number (e.g., QT-1770967664972)
                const quoteMatch = subject.match(/QT-\d+/);
                if (!quoteMatch) {
                    // Mark as seen anyway to avoid re-processing non-RFQ emails
                    await client.messageFlagsAdd(uid, ['\\Seen']);
                    continue;
                }

                const quoteNumber = quoteMatch[0];
                console.log(`[EmailSync] Found potential reply for ${quoteNumber}`);

                // Find the quotation in DB
                const [rows] = await pool.query('SELECT id, status FROM quotations WHERE quote_number = ?', [quoteNumber]);
                if (rows.length === 0) {
                    await client.messageFlagsAdd(uid, ['\\Seen']);
                    continue;
                }

                const quotation = rows[0];

                // Process attachments
                let pdfSaved = false;
                let pdfPath = null;

                if (parsed.attachments && parsed.attachments.length > 0) {
                    for (let attachment of parsed.attachments) {
                        if (attachment.contentType === 'application/pdf') {
                            const filename = `${Date.now()}-vendor-${attachment.filename.replace(/\s+/g, '_')}`;
                            const fullPath = path.join(uploadsDir, filename);
                            
                            fs.writeFileSync(fullPath, attachment.content);
                            // Store relative path for frontend compatibility if needed, 
                            // but quotationService might expect absolute or handled path.
                            // Looking at server.js, /uploads is static.
                            pdfPath = filename; 
                            pdfSaved = true;
                            console.log(`[EmailSync] Saved attachment: ${filename}`);
                            break; 
                        }
                    }
                }

                if (pdfSaved) {
                    // Update quotation status and PDF path
                    await quotationService.updateQuotation(quotation.id, {
                        received_pdf_path: pdfPath
                    });
                    
                    // Mark as RECEIVED
                    await quotationService.updateQuotationStatus(quotation.id, 'RECEIVED');
                    console.log(`[EmailSync] Updated ${quoteNumber} to RECEIVED status`);
                }

                // Mark email as seen so we don't process it again
                await client.messageFlagsAdd(uid, ['\\Seen']);
            }
        } finally {
            lock.release();
        }

        await client.logout();
    } catch (err) {
        console.error('[EmailSync] Error during sync:', err.message);
        // Ensure we try to logout if connected
        try { await client.logout(); } catch (e) {}
    }
}

// Polling interval (e.g., every 5 minutes)
function startEmailSync() {
    console.log('[EmailSync] Starting email synchronization service...');
    // Initial sync
    syncEmails();
    // Schedule periodic sync
    setInterval(syncEmails, 5 * 60 * 1000); 
}

module.exports = { startEmailSync };
