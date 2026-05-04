// bot.js — Полноценный бот с кнопкой Управление
const { VK, Keyboard } = require('vk-io');
const sqlite3 = require('sqlite3').verbose();

const TOKEN = "vk1.a.c_NX16Hlc78trOj76fNP5UITEA52LxsXPJcBQ-HIbhg71EfbqbRpSGmcaY-R2qqEn6-nXc-jnKS2GT-OTT1Ucfy4f3zjveJShDVNmdQqpnD7EP7rp9wbLtXZDmSOLTYWh0QqevdCwu7Ind2sL9RWFGbPDAoYYAUcz3Iw4a0wd5rX2V36ezAooxH5L-X8WSC6-pX_TUfC56_qWvWbY28KDw";
const GROUP_ID = 238114499;
const MAIN_ADMINS = [547053039]; // ← Твой ID

const vk = new VK({
    token: TOKEN,
    pollingGroupId: GROUP_ID,
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

// Получение роли пользователя
async function getUserData(userId) {
    if (MAIN_ADMINS.includes(userId)) {
        return { role: 'Главный модератор', rank: 'Высшая роль' };
    }
    
    return new Promise(resolve => {
        db.get("SELECT role, rank FROM moderators WHERE user_id = ?", [userId], (_, row) => {
            resolve(row || null);
        });
    });
}

// ====================== КЛАВИАТУРЫ ======================
function getMainKeyboard(userData) {
    const kb = Keyboard.builder()
        .textButton({ label: '🪪 Статистика', payload: { cmd: 'stats' } })
        .textButton({ label: '📋 Заявления', payload: { cmd: 'applications' } })
        .row()
        .textButton({ label: '💻 Инструктаж', payload: { cmd: 'instructions' } })
        .textButton({ label: '🆘 SOS', payload: { cmd: 'sos' } });

    // Кнопка управления только для высоких ролей
    const adminRoles = ['Главный модератор', 'Заместитель', 'Куратор модерации', 'Администратор'];
    if (adminRoles.includes(userData?.role)) {
        kb.row().textButton({ label: '🛠️ Управление', payload: { cmd: 'admin_panel' } });
    }

    return kb;
}

// ====================== MAIN HANDLER ======================
vk.updates.on('message', async (ctx) => {
    if (ctx.isOutbox) return;

    const uid = ctx.peerId;
    const text = ctx.text.trim();

    const userData = await getUserData(uid);

    if (!userData) {
        return ctx.send('⛔ У вас нет доступа к боту.\nОбратитесь к Главному модератору.');
    }

    if (['/start', 'меню', 'start'].includes(text.toLowerCase())) {
        return ctx.send(`👋 Добро пожаловать, ${userData.role}!`, { 
            keyboard: getMainKeyboard(userData) 
        });
    }

    if (text === '🆘 SOS') {
        MAIN_ADMINS.forEach(id => vk.api.messages.send({ user_id: id, message: `🚨 SOS от @id${uid}` }));
        return ctx.send('🚨 SOS отправлен администрации!');
    }

    if (text === '🛠️ Управление') {
        if (!['Главный модератор', 'Заместитель', 'Куратор модерации', 'Администратор'].includes(userData.role)) {
            return ctx.send('⛔ Доступ запрещён.');
        }

        const adminKb = Keyboard.builder()
            .textButton({ label: '👤 Добавить модератора', payload: { cmd: 'add_mod' } })
            .textButton({ label: '📋 Список модераторов', payload: { cmd: 'mod_list' } })
            .row()
            .textButton({ label: '📊 Общая статистика', payload: { cmd: 'all_stats' } })
            .textButton({ label: '⚙ Настройки', payload: { cmd: 'settings' } });

        return ctx.send('🛠️ Панель управления:', { keyboard: adminKb });
    }
});

async function startBot() {
    await vk.updates.startPolling();
    console.log('🚀 Бот запущен успешно!');
}

startBot();
