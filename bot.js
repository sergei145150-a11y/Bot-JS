// bot.js — Главный модератор в базе + улучшенное редактирование
const { VK, Keyboard } = require('vk-io');
const sqlite3 = require('sqlite3').verbose();

const TOKEN = "vk1.a.c_NX16Hlc78trOj76fNP5UITEA52LxsXPJcBQ-HIbhg71EfbqbRpSGmcaY-R2qqEn6-nXc-jnKS2GT-OTT1Ucfy4f3zjveJShDVNmdQqpnD7EP7rp9wbLtXZDmSOLTYWh0QqevdCwu7Ind2sL9RWFGbPDAoYYAUcz3Iw4a0wd5rX2V36ezAooxH5L-X8WSC6-pX_TUfC56_qWvWbY28KDw";
const GROUP_ID = 238114499;
const MAIN_ADMINS = [547053039];// ← Твой ID
const MAIN_ADMIN_IDS = [547053039];

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
        last_promotion TEXT DEFAULT CURRENT_TIMESTAMP,
        name TEXT,
        age INTEGER,
        birth_date TEXT,
        timezone TEXT,
        pc TEXT DEFAULT 'Нет',
        discord TEXT,
        forum TEXT,
        telegram TEXT,
        inactive_count INTEGER DEFAULT 0,
        norms_completed INTEGER DEFAULT 0
    )`);

    // Добавление Главного модератора
    MAIN_ADMIN_IDS.forEach(id => {
        db.run(`INSERT OR IGNORE INTO moderators 
            (user_id, nickname, role, rank, name, coins, norms_completed) 
            VALUES (?, 'Главный Модератор', 'Главный модератор', 'Высший ранг', 'Главный', 999, 999)`, [id]);
    });
});

// ====================== FSM ======================
const states = new Map();

const setState = (id, state, data = {}) => states.set(id, {state, data, time: Date.now()});
const getState = (id) => {
    const s = states.get(id);
    if (!s || Date.now() - s.time > 1800000) states.delete(id);
    return s;
};
const clearState = (id) => states.delete(id);

// ====================== ДАННЫЕ ======================
async function getUserData(userId) {
    return new Promise(r => {
        db.get("SELECT * FROM moderators WHERE user_id = ?", [userId], (_, row) => r(row));
    });
}

function formatStats(user) {
    return `🔻 RP-Nickname: ${user.nickname || '—'}
🔻 Должность: ${user.role} (${user.rank || '—'})

🪙 Coins: ${user.coins || 0}

📋 Личная информация
▫️ Имя: ${user.name || '—'}
▫️ Возраст: ${user.age || '—'}
▫️ Дата рождения: ${user.birth_date || '—'}
▫️ Часовой пояс: ${user.timezone || '—'}
▫️ ПК: ${user.pc || 'Нет'}

🪪 Статистика модератора
⛔️ Предупреждения: ${user.warnings || 0}
⛔️ Выговоры: ${user.reprimands || 0}

✅ Дней нормы: ${user.norms_completed || 0}
❎ Неактивов: ${user.inactive_count || 0}

⚠️ Discord: ${user.discord || '—'}
⚠️ Forum: ${user.forum || '—'}
⚠️ Telegram: ${user.telegram || '—'}`;
}

// ====================== КЛАВИАТУРЫ ======================
const mainKeyboard = Keyboard.builder()
    .textButton({ label: '🪪 Статистика', payload: { cmd: 'my_stats' } })
    .textButton({ label: '📋 Заявления', payload: { cmd: 'applications' } })
    .row()
    .textButton({ label: '💻 Инструктаж', payload: { cmd: 'instructions' } })
    .textButton({ label: '🆘 SOS', payload: { cmd: 'sos' } });

const adminPanelKeyboard = Keyboard.builder()
    .textButton({ label: '👤 Добавить', payload: { cmd: 'add_mod_start' } })
    .textButton({ label: '📋 Список', payload: { cmd: 'mod_list' } })
    .row()
    .textButton({ label: '✏️ Редактировать', payload: { cmd: 'edit_start' } });

// ====================== HANDLER ======================
vk.updates.on('message', async (ctx) => {
    if (ctx.isOutbox) return;

    const uid = ctx.peerId;
    const text = ctx.text.trim();
    const state = getState(uid);
    const userData = await getUserData(uid);

    if (!userData) return ctx.send('⛔ Доступ запрещён.');

    if (['/start', 'меню'].includes(text.toLowerCase())) {
        let kb = mainKeyboard;
        if (['Главный модератор', 'Заместитель'].includes(userData.role)) {
            kb = mainKeyboard.clone().row().textButton({ label: '🛠️ Управление', payload: { cmd: 'admin_panel' } });
        }
        return ctx.send(`👋 Добро пожаловать, ${userData.role}!`, { keyboard: kb });
    }

    if (text === '🪪 Статистика') {
        return ctx.send(formatStats(userData));
    }

    if (text === '🛠️ Управление') {
        return ctx.send('🛠️ Панель управления:', { keyboard: adminPanelKeyboard });
    }

    // Редактирование (оставлено как было в предыдущей версии)
    // ====================== EDIT START ======================
if (text === '✏️ Редактировать') {
    setState(uid, 'edit_user');
    return ctx.send('Введите ID пользователя:');
}

// выбор пользователя
if (state?.state === 'edit_user') {

    const targetId = parseInt(text);

    if (isNaN(targetId)) {
        return ctx.send('❌ Введите корректный ID');
    }

    const target = await getUserData(targetId);

    if (!target) {
        return ctx.send('❌ Пользователь не найден');
    }

    setState(uid, 'edit_action', { targetId });

    return ctx.send(
        `Выбран: ${target.nickname || target.user_id}`,
        {
            keyboard: Keyboard.builder()
                .textButton({ label: '➕ Coins' })
                .textButton({ label: '➖ Coins' })
                .row()
                .textButton({ label: '⛔ Выговор' })
                .textButton({ label: '❌ Снять выговор' })
                .row()
                .textButton({ label: '📈 +Норма' })
                .textButton({ label: '📉 -Норма' })
                .row()
                .textButton({ label: '❌ Отмена' })
        }
    );
}

// выбор действия
if (state?.state === 'edit_action') {

    const targetId = state.data.targetId;

    if (text === '➕ Coins') {
        setState(uid, 'edit_coins_add', { targetId });
        return ctx.send('Введите количество:');
    }

    if (text === '➖ Coins') {
        setState(uid, 'edit_coins_remove', { targetId });
        return ctx.send('Введите количество:');
    }

    if (text === '⛔ Выговор') {
        db.run(`UPDATE moderators SET reprimands = reprimands + 1 WHERE user_id = ?`, [targetId]);
        clearState(uid);
        return ctx.send('✅ Выговор выдан');
    }

    if (text === '❌ Снять выговор') {
        db.run(`UPDATE moderators SET reprimands = reprimands - 1 WHERE user_id = ?`, [targetId]);
        clearState(uid);
        return ctx.send('✅ Выговор снят');
    }

    if (text === '📈 +Норма') {
        db.run(`UPDATE moderators SET norms_completed = norms_completed + 1 WHERE user_id = ?`, [targetId]);
        clearState(uid);
        return ctx.send('✅ День нормы добавлен');
    }

    if (text === '📉 -Норма') {
        db.run(`UPDATE moderators SET norms_completed = norms_completed - 1 WHERE user_id = ?`, [targetId]);
        clearState(uid);
        return ctx.send('✅ День нормы убран');
    }

    if (text === '❌ Отмена') {
        clearState(uid);
        return ctx.send('❌ Отменено');
    }
}

// добавить coins
if (state?.state === 'edit_coins_add') {

    const amount = parseInt(text);

    if (isNaN(amount) || amount <= 0) {
        return ctx.send('❌ Введите число больше 0');
    }

    db.run(`UPDATE moderators SET coins = coins + ? WHERE user_id = ?`, [amount, state.data.targetId]);

    clearState(uid);

    return ctx.send(`✅ Добавлено ${amount} coins`);
}

// снять coins
if (state?.state === 'edit_coins_remove') {

    const amount = parseInt(text);

    if (isNaN(amount) || amount <= 0) {
        return ctx.send('❌ Введите число больше 0');
    }

    db.run(`UPDATE moderators SET coins = coins - ? WHERE user_id = ?`, [amount, state.data.targetId]);

    clearState(uid);

    return ctx.send(`✅ Снято ${amount} coins`);
}

async function startBot() {
    await vk.updates.startPolling();
    console.log('🚀 Бот запущен успешно!');
}
});
startBot();
