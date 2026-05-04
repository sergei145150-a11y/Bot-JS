// bot.js — Редактирование статистики + предыдущий функционал
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
    if (MAIN_ADMINS.includes(userId)) return { role: 'Главный модератор', nickname: 'Главный' };
    return new Promise(r => db.get("SELECT * FROM moderators WHERE user_id = ?", [userId], (_, row) => r(row)));
}

function formatStats(user) {
    return `🔻 RP-Nickname: ${user.nickname || '—'}
🔻 Должность: ${user.role} (${user.rank})

🪙 Coins: ${user.coins}

📋 Личная информация
▫️ Имя: ${user.name || '—'}
▫️ Возраст: ${user.age || '—'}
▫️ Дата рождения: ${user.birth_date || '—'}
▫️ Часовой пояс: ${user.timezone || '—'}
▫️ ПК: ${user.pc || 'Нет'}

🪪 Статистика модератора
⛔️ Предупреждения: ${user.warnings}
⛔️ Выговоры: ${user.reprimands}

▫️ Поставлен: ${user.join_date ? user.join_date.split('T')[0] : '—'}
▫️ Последнее повышение: ${user.last_promotion || '—'}
✅ Дней нормы: ${user.norms_completed}
❎ Неактивов: ${user.inactive_count}

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

    // Статистика
    if (text === '🪪 Статистика') {
        return ctx.send(formatStats(userData));
    }

    // Управление
    if (text === '🛠️ Управление') {
        return ctx.send('🛠️ Панель управления:', { keyboard: adminPanelKeyboard });
    }

    // === РЕДАКТИРОВАНИЕ ===
    if (text === '✏️ Редактировать' || state?.state === 'edit_select_user') {
        if (!state) {
            setState(uid, 'edit_select_user');
            return ctx.send('Введите ID модератора для редактирования:');
        }
        const targetId = parseInt(text.replace(/\D/g, ''));
        if (!targetId) return ctx.send('❌ Неверный ID');

        const targetData = await new Promise(r => db.get("SELECT * FROM moderators WHERE user_id = ?", [targetId], (_, row) => r(row)));
        if (!targetData) return ctx.send('❌ Модератор не найден.');

        setState(uid, 'edit_select_field', { targetId, targetData });
        return ctx.send(`Редактируем @id${targetId} — ${targetData.nickname}\n\nВыберите поле для изменения:`, {
            keyboard: Keyboard.builder()
                .textButton({ label: 'RP-Nickname', payload: { field: 'nickname' } })
                .textButton({ label: 'Имя', payload: { field: 'name' } })
                .row()
                .textButton({ label: 'Возраст', payload: { field: 'age' } })
                .textButton({ label: 'Дата рождения', payload: { field: 'birth_date' } })
                .row()
                .textButton({ label: 'Часовой пояс', payload: { field: 'timezone' } })
                .textButton({ label: 'ПК', payload: { field: 'pc' } })
                .row()
                .textButton({ label: 'Coins', payload: { field: 'coins' } })
                .textButton({ label: 'Предупреждения', payload: { field: 'warnings' } })
                .row()
                .textButton({ label: 'Выговоры', payload: { field: 'reprimands' } })
                .textButton({ label: 'Неактивы', payload: { field: 'inactive_count' } })
        });
    }

    if (state?.state === 'edit_select_field') {
        const field = text || ctx.payload?.field;
        if (!field) return;

        setState(uid, 'edit_input_value', { ...state.data, field });
        return ctx.send(`Введите новое значение для поля "${field}":`);
    }

    if (state?.state === 'edit_input_value') {
        const { targetId, field } = state.data;
        let value = text;

        db.run(`UPDATE moderators SET ${field} = ? WHERE user_id = ?`, [value, targetId], (err) => {
            if (err) return ctx.send('❌ Ошибка обновления');
            ctx.send(`✅ Поле "${field}" успешно обновлено!`);
            clearState(uid);
        });
    }
});

async function startBot() {
    await vk.updates.startPolling();
    console.log('🚀 Бот запущен | Редактирование статистики активно');
}

startBot();
