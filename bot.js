// bot.js — Полноценный Moderation Bot
const { VK, Keyboard } = require('vk-io');
const sqlite3 = require('sqlite3').verbose();

const TOKEN = "vk1.a.c_NX16Hlc78trOj76fNP5UITEA52LxsXPJcBQ-HIbhg71EfbqbRpSGmcaY-R2qqEn6-nXc-jnKS2GT-OTT1Ucfy4f3zjveJShDVNmdQqpnD7EP7rp9wbLtXZDmSOLTYWh0QqevdCwu7Ind2sL9RWFGbPDAoYYAUcz3Iw4a0wd5rX2V36ezAooxH5L-X8WSC6-pX_TUfC56_qWvWbY28KDw";
const GROUP_ID = 238114499;
const MAIN_ADMINS = [547053039];

const vk = new VK({ token: TOKEN, pollingGroupId: GROUP_ID });

// ====================== DATABASE ======================
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

    db.run(`CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        type TEXT,
        action TEXT,
        date TEXT DEFAULT CURRENT_TIMESTAMP
    )`);
});

// ====================== ACCESS CHECK ======================
async function hasAccess(userId) {
    if (MAIN_ADMINS.includes(userId)) return true;
    return new Promise(resolve => {
        db.get("SELECT role FROM moderators WHERE user_id = ?", [userId], (err, row) => {
            resolve(!!row);
        });
    });
}

// ====================== KEYBOARDS ======================
const mainKeyboard = Keyboard.builder()
    .textButton({ label: '🪪 Статистика', payload: { cmd: 'stats' } })
    .textButton({ label: '📋 Заявления', payload: { cmd: 'applications' } })
    .row()
    .textButton({ label: '💻 Инструктаж', payload: { cmd: 'instructions' } })
    .textButton({ label: '🆘 SOS', payload: { cmd: 'sos' } });

// ====================== MAIN HANDLER ======================
vk.updates.on('message', async (ctx) => {
    if (ctx.isOutbox) return;

    const uid = ctx.peerId;
    const text = ctx.text.trim();

    const access = await hasAccess(uid);
    if (!access) {
        return ctx.send('⛔ У вас нет доступа.\nОбратитесь к Главному модератору.');
    }

    if (['/start', 'меню', 'start'].includes(text.toLowerCase())) {
        return ctx.send('👋 Добро пожаловать в систему модерации!', { 
            keyboard: mainKeyboard 
        });
    }

    if (text === '🆘 SOS') {
        MAIN_ADMINS.forEach(id => {
            vk.api.messages.send({ user_id: id, message: `🚨 SOS от @id${uid}` });
        });
        return ctx.send('🚨 SOS отправлен администрации!');
    }

    if (text === '🪪 Статистика') {
        return ctx.send('🪪 Ваша статистика:\n\nРаздел в разработке...');
    }

    if (text === '📋 Заявления') {
        return ctx.send('📋 Выберите тип заявления (в разработке)');
    }

    if (text === '💻 Инструктаж') {
        return ctx.send('💻 Инструкции для модераторов:\n\nРаздел в разработке...');
    }
});

async function startBot() {
    await vk.updates.startPolling();
    console.log('🚀 Бот запущен успешно!');
}

startBot();
