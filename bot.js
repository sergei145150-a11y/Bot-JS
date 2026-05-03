// bot.js — Упрощённая версия без dotenv (для BotHost)
const { VK, Keyboard } = require('vk-io');
const sqlite3 = require('sqlite3').verbose();

// === НАСТРОЙКИ (измени на свои) ===
const TOKEN = "vk1.a.c_NX16Hlc78trOj76fNP5UITEA52LxsXPJcBQ-HIbhg71EfbqbRpSGmcaY-R2qqEn6-nXc-jnKS2GT-OTT1Ucfy4f3zjveJShDVNmdQqpnD7EP7rp9wbLtXZDmSOLTYWh0QqevdCwu7Ind2sL9RWFGbPDAoYYAUcz3Iw4a0wd5rX2V36ezAooxH5L-X8WSC6-pX_TUfC56_qWvWbY28KDw";   // ← ВСТАВЬ СЮДА ТОКЕН
const GROUP_ID = 238114499;                         // ← ВСТАВЬ ID ГРУППЫ

const vk = new VK({
    token: TOKEN,
    pollingGroupId: GROUP_ID
});

const MAIN_ADMINS = [547053039]; // ← Твой ID

// ====================== DATABASE ======================
const db = new sqlite3.Database('moderation.db');

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS moderators (user_id INTEGER PRIMARY KEY, role TEXT DEFAULT 'Модератор', rank TEXT DEFAULT 'Младший модератор', coins INTEGER DEFAULT 0)`);
    db.run(`CREATE TABLE IF NOT EXISTS reports (id INTEGER PRIMARY KEY AUTOINCREMENT, sender_id INTEGER, text TEXT, photos TEXT, status TEXT DEFAULT 'pending', created_at TEXT DEFAULT CURRENT_TIMESTAMP)`);
    db.run(`CREATE TABLE IF NOT EXISTS logs (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, type TEXT, action TEXT, date TEXT DEFAULT CURRENT_TIMESTAMP)`);
});

console.log('✅ Бот запущен');

// ====================== FSM ======================
const states = new Map();

const setState = (id, state) => states.set(id, {state, time: Date.now()});
const clearState = (id) => states.delete(id);

// ====================== MAIN KEYBOARD ======================
const mainKb = Keyboard.builder()
    .textButton({ label: '📑 Отчёт', payload: { cmd: 'report' } })
    .textButton({ label: '📜 История', payload: { cmd: 'history' } })
    .row()
    .textButton({ label: '🆘 SOS', payload: { cmd: 'sos' } });

// ====================== HANDLER ======================
vk.updates.on('message', async (ctx) => {
    if (ctx.isOutbox) return;

    const text = ctx.text.trim();
    const uid = ctx.peerId;

    if (text === '/start' || text === 'меню') {
        return ctx.send('👋 Модерация бот запущен!', { keyboard: mainKb });
    }

    if (text === '📑 Отчёт') {
        setState(uid, 'report');
        return ctx.send('Напишите текст отчёта + прикрепите минимум 2 фото:', {
            keyboard: Keyboard.builder().textButton({ label: '❌ Отмена' })
        });
    }

    if (text === '🆘 SOS') {
        MAIN_ADMINS.forEach(id => {
            vk.api.messages.send({ user_id: id, message: `🚨 SOS от @id${uid}` });
        });
        return ctx.send('🚨 SOS отправлен!');
    }

    // Автообработка отчёта
    const photos = ctx.attachments.filter(a => a.type === 'photo');
    if (photos.length >= 2 && text.length > 10) {
        ctx.send('✅ Отчёт получен и отправлен на проверку!');
    }
});

vk.updates.on('message_event', (ctx) => {
    console.log('Кнопка нажата:', ctx.payload);
});

// ====================== START ======================
async function startBot() {
    try {
        await vk.updates.startPolling();
        console.log(`🚀 Бот успешно запущен! Группа: ${GROUP_ID}`);
    } catch (e) {
        console.error('Ошибка запуска:', e);
    }
}

startBot();
