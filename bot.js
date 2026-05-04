// bot.js — Стабильная версия с обработкой AbortError
const { VK, Keyboard } = require('vk-io');
const sqlite3 = require('sqlite3').verbose();

const TOKEN = "vk1.a.c_NX16Hlc78trOj76fNP5UITEA52LxsXPJcBQ-HIbhg71EfbqbRpSGmcaY-R2qqEn6-nXc-jnKS2GT-OTT1Ucfy4f3zjveJShDVNmdQqpnD7EP7rp9wbLtXZDmSOLTYWh0QqevdCwu7Ind2sL9RWFGbPDAoYYAUcz3Iw4a0wd5rX2V36ezAooxH5L-X8WSC6-pX_TUfC56_qWvWbY28KDw";
const GROUP_ID = 238114499;
const MAIN_ADMINS = [547053039];

const vk = new VK({
    token: TOKEN,
    pollingGroupId: GROUP_ID,
    apiMode: 'parallel',           // Улучшает стабильность
});

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
});

// Проверка доступа
async function hasAccess(userId) {
    if (MAIN_ADMINS.includes(userId)) return { access: true, role: 'Главный модератор' };
    
    return new Promise(resolve => {
        db.get("SELECT role FROM moderators WHERE user_id = ?", [userId], (_, row) => {
            resolve(row ? { access: true, role: row.role } : { access: false });
        });
    });
}

// Главная клавиатура
const mainKeyboard = Keyboard.builder()
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

    const user = await hasAccess(uid);
    if (!user.access) {
        return ctx.send('⛔ У вас нет доступа к боту.');
    }

    if (['/start', 'меню'].includes(text.toLowerCase())) {
        return ctx.send(`👋 Добро пожаловать!\nРоль: ${user.role}`, { keyboard: mainKeyboard });
    }

    if (text === '🆘 SOS') {
        MAIN_ADMINS.forEach(id => vk.api.messages.send({ user_id: id, message: `🚨 SOS от @id${uid}` }));
        ctx.send('🚨 SOS отправлен!');
    }
});

// ====================== ЗАПУСК С ПЕРЕЗАПУСКОМ ======================
async function startPolling() {
    try {
        console.log('🔄 Запуск Long Polling...');
        await vk.updates.startPolling();
        console.log('✅ Polling успешно запущен!');
    } catch (error) {
        if (error.type === 'aborted' || error.message.includes('aborted')) {
            console.log('⚠️ AbortError — перезапуск polling через 5 секунд...');
            setTimeout(startPolling, 5000);
        } else {
            console.error('❌ Критическая ошибка:', error);
        }
    }
}

// Автоматический перезапуск при обрыве
vk.updates.on('error', (error) => {
    console.error('Polling error:', error);
    if (error.message?.includes('aborted') || error.type === 'aborted') {
        setTimeout(startPolling, 3000);
    }
});

startPolling();

console.log('🚀 Бот инициализирован');
