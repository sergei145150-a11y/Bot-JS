// bot.js — Полноценный Moderation Bot для VK (Production)
const { VK, Keyboard } = require('vk-io');
const sqlite3 = require('sqlite3').verbose();

// ==================== НАСТРОЙКИ ====================
const TOKEN = "vk1.a.c_NX16Hlc78trOj76fNP5UITEA52LxsXPJcBQ-HIbhg71EfbqbRpSGmcaY-R2qqEn6-nXc-jnKS2GT-OTT1Ucfy4f3zjveJShDVNmdQqpnD7EP7rp9wbLtXZDmSOLTYWh0QqevdCwu7Ind2sL9RWFGbPDAoYYAUcz3Iw4a0wd5rX2V36ezAooxH5L-X8WSC6-pX_TUfC56_qWvWbY28KDw";           // ← Замени
const GROUP_ID = 238114499;                      // ← ID группы
const MAIN_ADMINS = [547053039];                 // ← Твои ID (главные)

const vk = new VK({ token: TOKEN, pollingGroupId: GROUP_ID });

// ====================== БАЗА ДАННЫХ ======================
const db = new sqlite3.Database('moderation.db');

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS moderators (
        user_id INTEGER PRIMARY KEY,
        nickname TEXT,
        role TEXT DEFAULT 'Модератор',
        rank TEXT DEFAULT 'Младший модератор',
        coins INTEGER DEFAULT 0,
        warnings INTEGER DEFAULT 0,
        reprimands INTEGER DEFAULT 0,
        join_date TEXT DEFAULT CURRENT_TIMESTAMP,
        last_promotion TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_id INTEGER,
        text TEXT,
        photos TEXT,
        status TEXT DEFAULT 'pending',
        reviewer_id INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        type TEXT,
        action TEXT,
        details TEXT,
        date TEXT DEFAULT CURRENT_TIMESTAMP
    )`);
});

console.log('✅ Бот запущен');

// ====================== FSM ======================
const states = new Map();

const setState = (userId, state, data = {}) => {
    states.set(userId, { state, data, time: Date.now() });
};

const getState = (userId) => {
    const s = states.get(userId);
    if (!s || Date.now() - s.time > 30*60*1000) {
        states.delete(userId);
        return null;
    }
    return s;
};

// ====================== КЛАВИАТУРЫ ======================
const mainKeyboard = () => Keyboard.builder()
    .textButton({ label: '📑 Отчёт', payload: { cmd: 'report' } })
    .textButton({ label: '🛩 Неактив', payload: { cmd: 'inactive' } })
    .row()
    .textButton({ label: '📜 История', payload: { cmd: 'history' } })
    .textButton({ label: '🆘 SOS', payload: { cmd: 'sos' } });

const adminKeyboard = () => Keyboard.builder()
    .textButton({ label: '👤 Модераторы', payload: { cmd: 'mod_list' } })
    .textButton({ label: '📊 Статистика', payload: { cmd: 'stats' } })
    .row()
    .textButton({ label: '➕ Добавить модератора', payload: { cmd: 'add_mod' } });

// ====================== ОСНОВНАЯ ЛОГИКА ======================
vk.updates.on('message', async (ctx) => {
    if (ctx.isOutbox) return;

    const text = ctx.text.trim();
    const uid = ctx.peerId;
    const state = getState(uid);

    if (state && text === '❌ Отмена') {
        states.delete(uid);
        return ctx.send('✅ Отменено', { keyboard: mainKeyboard() });
    }

    // Команды
    if (['/start', 'меню'].includes(text.toLowerCase())) {
        return ctx.send('👋 Добро пожаловать в систему модерации!', { keyboard: mainKeyboard() });
    }

    if (text === '📑 Отчёт' || state?.state === 'report') {
        if (!state) {
            setState(uid, 'report');
            return ctx.send('Напишите текст отчёта и прикрепите минимум 2 фото:', {
                keyboard: Keyboard.builder().textButton({ label: '❌ Отмена' })
            });
        }
        // Обработка отчёта
        const photos = ctx.attachments.filter(a => a.type === 'photo');
        if (text.length < 15 || photos.length < 2) {
            return ctx.send('❌ Минимум 15 символов и 2 фото!');
        }

        const photoStr = photos.map(p => `photo${p.ownerId}_${p.id}`).join(',');
        db.run(`INSERT INTO reports (sender_id, text, photos) VALUES (?, ?, ?)`, 
            [uid, text, photoStr], function() {
                const reportId = this.lastID;
                MAIN_ADMINS.forEach(async admin => {
                    const user = (await vk.api.users.get({user_ids: uid}))[0];
                    await vk.api.messages.send({
                        user_id: admin,
                        message: `📑 Новый отчёт #${reportId}\n👤 ${user.first_name} ${user.last_name} (id${uid})\n📝 ${text}`,
                        attachment: photoStr,
                        keyboard: Keyboard.builder()
                            .textButton({label: '✅ Принять', payload: {cmd: 'approve', id: reportId}})
                            .textButton({label: '❌ Отклонить', payload: {cmd: 'reject', id: reportId}})
                    });
                });
                ctx.send('✅ Отчёт отправлен на проверку!');
            });
        states.delete(uid);
        return;
    }

    if (text === '🆘 SOS') {
        MAIN_ADMINS.forEach(id => vk.api.messages.send({user_id: id, message: `🚨 SOS от @id${uid}`}));
        ctx.send('🚨 SOS отправлен!');
    }

    if (text === '📜 История') {
        db.all("SELECT * FROM logs WHERE user_id = ? ORDER BY date DESC LIMIT 10", [uid], (_, rows) => {
            let msg = "📜 История:\n\n";
            rows.forEach(r => msg += `${r.date} | ${r.action}\n`);
            ctx.send(msg || "История пуста");
        });
    }

    // Админ команды
    if (MAIN_ADMINS.includes(uid)) {
        if (text === '👤 Модераторы') {
            ctx.send('👥 Админ-панель', { keyboard: adminKeyboard() });
        }
    }
});

// Обработка кнопок
vk.updates.on('message_event', async (ctx) => {
    const p = ctx.payload;
    if (p.cmd === 'approve' && p.id) {
        db.run("UPDATE reports SET status='approved', reviewer_id=? WHERE id=?", [ctx.peerId, p.id]);
        ctx.send('✅ Отчёт принят!');
    }
});

async function startBot() {
    await vk.updates.startPolling();
    console.log('🚀 Полноценный бот запущен!');
}

startBot();
