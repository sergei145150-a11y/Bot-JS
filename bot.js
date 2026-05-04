// bot.js
const { VK, Keyboard } = require('vk-io');
const sqlite3 = require('sqlite3').verbose();

const TOKEN = "vk1.a.c_NX16Hlc78trOj76fNP5UITEA52LxsXPJcBQ-HIbhg71EfbqbRpSGmcaY-R2qqEn6-nXc-jnKS2GT-OTT1Ucfy4f3zjveJShDVNmdQqpnD7EP7rp9wbLtXZDmSOLTYWh0QqevdCwu7Ind2sL9RWFGbPDAoYYAUcz3Iw4a0wd5rX2V36ezAooxH5L-X8WSC6-pX_TUfC56_qWvWbY28KDw";
const GROUP_ID = 238114499;
const MAIN_ADMINS = [547053039];

const vk = new VK({ token: TOKEN, pollingGroupId: GROUP_ID });

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

    db.run(`CREATE TABLE IF NOT EXISTS logs (...)`); // можно добавить позже
});

// Проверка доступа — любой, кто есть в таблице
async function hasAccess(userId) {
    if (MAIN_ADMINS.includes(userId)) return { access: true, role: 'Главный модератор' };
    
    return new Promise(resolve => {
        db.get("SELECT role, rank FROM moderators WHERE user_id = ?", [userId], (err, row) => {
            if (row) {
                resolve({ access: true, role: row.role, rank: row.rank });
            } else {
                resolve({ access: false });
            }
        });
    });
}

// ====================== КЛАВИАТУРЫ ======================
function getMainKeyboard(role, rank) {
    const kb = Keyboard.builder()
        .textButton({ label: '🪪 Статистика', payload: { cmd: 'stats' } })
        .textButton({ label: '📋 Заявления', payload: { cmd: 'applications' } })
        .row()
        .textButton({ label: '💻 Инструктаж', payload: { cmd: 'instructions' } })
        .textButton({ label: '🆘 SOS', payload: { cmd: 'sos' } });

    // Управление для высоких должностей
    const adminRoles = ['Главный модератор', 'Заместитель', 'Куратор модерации', 'Администратор'];
    if (adminRoles.includes(role)) {
        kb.row().textButton({ label: '🛠️ Управление', payload: { cmd: 'admin_panel' } });
    }

    return kb;
}

// ====================== MAIN ======================
vk.updates.on('message', async (ctx) => {
    if (ctx.isOutbox) return;

    const uid = ctx.peerId;
    const text = ctx.text.trim();

    const user = await hasAccess(uid);

    if (!user.access) {
        return ctx.send('⛔ У вас нет доступа к боту.\n\nЧтобы получить доступ — обратитесь к Главному модератору.');
    }

    if (['/start', 'меню', 'start'].includes(text.toLowerCase())) {
        return ctx.send(`👋 Добро пожаловать, ${user.role}!\nРанг: ${user.rank || '—'}`, { 
            keyboard: getMainKeyboard(user.role, user.rank) 
        });
    }

    // ... остальные команды (будем добавлять)
    if (text === '🆘 SOS') {
        MAIN_ADMINS.forEach(id => vk.api.messages.send({user_id: id, message: `🚨 SOS от @id${uid}`}));
        ctx.send('🚨 SOS отправлен!');
    }
});

async function startBot() {
    await vk.updates.startPolling();
    console.log('🚀 Бот запущен | Доступ у всех модераторов и выше');
}

startBot();
