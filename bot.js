//bot.js — Полноценный Moderation Bot (с доступом только для модераторов)
const { VK, Keyboard } = require('vk-io');
const sqlite3 = require('sqlite3').verbose();

const TOKEN = "vk1.a.c_NX16Hlc78trOj76fNP5UITEA52LxsXPJcBQ-HIbhg71EfbqbRpSGmcaY-R2qqEn6-nXc-jnKS2GT-OTT1Ucfy4f3zjveJShDVNmdQqpnD7EP7rp9wbLtXZDmSOLTYWh0QqevdCwu7Ind2sL9RWFGbPDAoYYAUcz3Iw4a0wd5rX2V36ezAooxH5L-X8WSC6-pX_TUfC56_qWvWbY28KDw";           // ← Замени
const GROUP_ID = 238114499;                 // ← ID группы
const MAIN_ADMINS = [547053039];            // ← Главные администраторы

const vk = new VK({ token: TOKEN, pollingGroupId: GROUP_ID });

// ====================== БАЗА ======================
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
        last_promotion TEXT,
        name TEXT,
        age INTEGER
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS reports (...)`); // можно добавить позже
    db.run(`CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        type TEXT,
        action TEXT,
        date TEXT DEFAULT CURRENT_TIMESTAMP
    )`);
});

// ====================== ПРОВЕРКА ДОСТУПА ======================
async function hasAccess(userId) {
    if (MAIN_ADMINS.includes(userId)) return true;
    return new Promise(resolve => {
        db.get("SELECT role FROM moderators WHERE user_id = ?", [userId], (err, row) => {
            resolve(!!row);
        });
    });
}

// ====================== КЛАВИАТУРЫ ======================
const mainModeratorKeyboard = () => Keyboard.builder()
    .textButton({ label: '🪪 Статистика', payload: { cmd: 'stats' } })
    .textButton({ label: '📋 Заявления', payload: { cmd: 'applications' } })
    .row()
    .textButton({ label: '💻 Инструктаж', payload: { cmd: 'instructions' } })
    .textButton({ label: '🆘 SOS', payload: { cmd: 'sos' } });

// ====================== HANDLER ======================
vk.updates.on('message', async (ctx) => {
    if (ctx.isOutbox) return;

    const uid = ctx.peerId;
    const text = ctx.text.trim();

    const access = await hasAccess(uid);
    if (!access) {
        return ctx.send('⛔ У вас нет доступа к боту.\n\nОбратитесь к Главному модератору для получения роли.');
    }

    if (['/start', 'меню', 'start'].includes(text.toLowerCase())) {
        return ctx.send('👋 Добро пожаловать в систему модерации!', { 
            keyboard: mainModeratorKeyboard() 
        });
    }

    if (text === '🆘 SOS') {
        MAIN_ADMINS.forEach(id => {
            vk.api.messages.send({ user_id: id, message: `🚨 SOS от @id${uid}` });
        });
        ctx.send('🚨 Сообщение отправлено администрации!');
    }

    if (text === '🪪 Статистика') {
        ctx.send('🪪 Ваша статистика:\n\n(пока пусто — будем развивать)');
    }

    if (text === '📋 З
