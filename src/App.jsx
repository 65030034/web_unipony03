const express = require('express');
const cors = require('cors');
const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const NodeCache = require("node-cache"); // 📌 เพิ่มระบบความจำชั่วคราว

const app = express();
const myCache = new NodeCache({ stdTTL: 120 }); // ความจำเสื่อมใน 2 นาที
const IMAP_HOST = 'imap.rambler.ru'; // 📌 ใช้โฮสต์เดิมตามที่คุณตั้งไว้

// ปรับ CORS ให้รับการยิง API แบบมี Header ครบๆ
app.use(cors({
    origin: '*', // ถ้าจะล็อคโดเมน ให้เปลี่ยน * เป็น ['http://localhost:5173', 'https://เว็บคุณ.com']
    methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-imap-user', 'x-imap-pass'],
    credentials: true
}));

app.use(express.json());

// 🦄 1. สร้างโกดังเก็บ Connection ที่ต่อติดแล้ว
const activeClients = new Map();

// 🦄 2. ฟังก์ชันรีเซ็ตเวลา ถ้ามีการใช้งาน ให้ต่อเวลาไปอีก 5 นาที
function resetIdleTimer(user, client) {
    if (client.idleTimer) clearTimeout(client.idleTimer);
    
    client.idleTimer = setTimeout(async () => {
        try { await client.logout(); } catch (e) {}
        activeClients.delete(user);
        console.log(`💤 [System] ตัดการเชื่อมต่อของ ${user} เพราะไม่ได้ใช้งานเกิน 5 นาที`);
    }, 5 * 60 * 1000);
}

// 🦄 3. ฟังก์ชันเรียกใช้งาน IMAP (เปิดสายใหม่ หรือ เอาสายเก่ามาใช้)
async function getImapClient(user, pass) {
    if (!user || !pass) throw new Error('Missing Credentials');

    if (activeClients.has(user)) {
        const existingClient = activeClients.get(user);
        if (existingClient.usable) {
            resetIdleTimer(user, existingClient);
            return existingClient;
        } else {
            activeClients.delete(user);
        }
    }

    const client = new ImapFlow({ 
        host: IMAP_HOST, 
        port: 993, 
        secure: true, 
        auth: { user, pass }, 
        logger: false, 
        connectionTimeout: 15000 
    });

    await client.connect();
    activeClients.set(user, client);
    resetIdleTimer(user, client);

    client.on('close', () => activeClients.delete(user));
    client.on('error', () => activeClients.delete(user));

    return client;
}

// ----------------------------------------------------
// ROUTES
// ----------------------------------------------------

// API: Login Check (พร้อม Pre-warm เซิร์ฟเวอร์)
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        await getImapClient(email, password);
        res.json({ success: true });
    } catch (err) { 
        res.status(401).json({ success: false, error: 'Login Failed' }); 
    }
});

// API: Get Folders
app.get('/api/folders', async (req, res) => {
    const user = req.headers['x-imap-user'];
    const pass = req.headers['x-imap-pass'];
    const cacheKey = `folders_${user}`; 

    if (myCache.has(cacheKey)) return res.json(myCache.get(cacheKey));

    try {
        const client = await getImapClient(user, pass);
        let folders = await client.list();
        
        const responseData = { success: true, data: folders.map(f => ({ name: f.name, path: f.path })) };
        myCache.set(cacheKey, responseData);
        res.json(responseData);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// API: Get Email List (เน้นไว ดึงแค่ 5 ฉบับล่าสุด)
app.get('/api/emails', async (req, res) => {
    const user = req.headers['x-imap-user'];
    const pass = req.headers['x-imap-pass'];
    const folderPath = req.query.folder || 'INBOX';
    const cacheKey = `emails_${user}_${folderPath}`; 

    if (myCache.has(cacheKey)) return res.json(myCache.get(cacheKey));

    try {
        const client = await getImapClient(user, pass);
        let lock = await client.getMailboxLock(folderPath); 
        try {
            const mailbox = client.mailbox;
            if (mailbox.exists === 0) return res.json({ success: true, data: [] });

            let emails = [];
            // 🚀 อัปเกรดความเร็ว: ดึงแค่ 5 ฉบับล่าสุด (ถ้าอยากได้ 15 เหมือนเดิม ให้แก้ - 4 เป็น - 14)
            let start = Math.max(1, mailbox.exists - 4); 
            
            for await (let msg of client.fetch(`${start}:*`, { envelope: true })) {
                emails.push({
                    uid: msg.uid,
                    subject: msg.envelope.subject || '(No Subject)',
                    from: msg.envelope.from?.[0]?.address || 'Unknown',
                    date: msg.envelope.date
                });
            }
            
            const responseData = { success: true, data: emails.reverse() };
            myCache.set(cacheKey, responseData);
            res.json(responseData);
        } finally { 
            lock.release(); 
        }
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// API: Get Email Body (ปลดเนื้อหาอีเมล)
app.get('/api/email-content', async (req, res) => {
    const user = req.headers['x-imap-user'];
    const pass = req.headers['x-imap-pass'];
    const { folder, uid } = req.query;
    const cacheKey = `content_${user}_${folder}_${uid}`; 

    if (myCache.has(cacheKey)) return res.json(myCache.get(cacheKey));

    try {
        const client = await getImapClient(user, pass);
        let lock = await client.getMailboxLock(folder || 'INBOX');
        try {
            let message = await client.fetchOne(uid, { source: true });
            let parsed = await simpleParser(message.source);
            
            let finalContent = parsed.html || parsed.text || "ไม่มีเนื้อหาในจดหมายฉบับนี้";
            
            const responseData = { 
                success: true, 
                content: finalContent,
                isHtml: !!parsed.html // ส่งสถานะไปบอกหน้าบ้านว่าเป็น HTML ไหม เผื่อเอาไปใช้
            };

            myCache.set(cacheKey, responseData);
            res.json(responseData);
        } finally { 
            lock.release(); 
        }
    } catch (err) { res.status(500).json({ error: err.message }); }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🦄 Backend Live on Port ${PORT}`);
    console.log(`🚀 Rambler.ru Caching & Pooling Activated! (5 latest emails)`);
});
