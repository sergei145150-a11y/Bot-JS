// bot.js — Полноценное добавление модератора + Редактирование + Статистика
const { VK, Keyboard } = require('vk-io');
const sqlite3 = require('sqlite3').verbose();

const TOKEN = "vk1.a.c_NX16Hlc78trOj76fNP5UITEA52LxsXPJcBQ-HIbhg71EfbqbRpSGmcaY-R2qqEn6-nXc-jnKS2GT-OTT1Ucfy4f3zjveJShDVNmdQqpnD7EP7rp9wbLtXZDmSOLTYWh0QqevdCwu7Ind2sL9RWFGbPDAoYYAUcz3Iw4a0wd5rX2V36ezAooxH5L-X8WSC6-pX_TUfC56_qWvWbY28KDw
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
    .textButton({ label: '👤 Добавить модератора', payload: { cmd: 'add_mod_start' } })
    .textButton({ label: '📋 Список состава', payload: { cmd: 'mod_list' } })
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

    // ====================== ДОБАВЛЕНИЕ МОДЕРАТОРА ======================
    if (text === '👤 Добавить модератора' || state?.state === 'add_mod_id') {
        if (!state) {
            setState(uid, 'add_mod_id');
            return ctx.send('🔹 Введите ID пользователя (или ссылку на профиль):');
        }
        const targetId = parseInt(text.replace(/\D/g, ''));
        if (!targetId) return ctx.send('❌ Не удалось определить ID.');

        setState(uid, 'add_mod_nickname', { targetId });
        return ctx.send(`ID принят: @id${targetId}\n\nВведите RP-Nickname:`);
    }

    if (state?.state === 'add_mod_nickname') {
        setState(uid, 'add_mod_name', { ...state.data, nickname: text });
        return ctx.send('Введите реальное имя:');
    }

    if (state?.state === 'add_mod_name') {
        setState(uid, 'add_mod_age', { ...state.data, name: text });
        return ctx.send('Введите возраст:');
    }

    if (state?.state === 'add_mod_age') {
        setState(uid, 'add_mod_birth', { ...state.data, age: parseInt(text) });
        return ctx.send('Введите дату рождения (ДД.ММ.ГГГГ):');
    }

    if (state?.state === 'add_mod_birth') {
        setState(uid, 'add_mod_timezone', { ...state.data, birth_date: text });
        return ctx.send('Введите часовой пояс (например: UTC+3, МСК):');
    }

    if (state?.state === 'add_mod_timezone') {
        setState(uid, 'add_mod_pc', { ...state.data, timezone: text });
        return ctx.send('Есть ПК? (Да/Нет):');
    }

    if (state?.state === 'add_mod_pc') {
        const finalData = { ...state.data, pc: text };
        
        db.run(`INSERT OR REPLACE INTO moderators 
            (user_id, nickname, name, age, birth_date, timezone, pc, join_date) 
            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [finalData.targetId, finalData.nickname, finalData.name, finalData.age, 
             finalData.birth_date, finalData.timezone, finalData.pc],
            (err) => {
                if (err) return ctx.send('❌ Ошибка сохранения');
                ctx.send(`✅ Модератор @id${finalData.targetId} успешно добавлен!\n\n` +
                        `Ник: ${finalData.nickname}\nИмя: ${finalData.name}`);
                clearState(uid);
            });
    }

    // Список состава
    if (text === '📋 Список состава') {
        db.all("SELECT * FROM moderators", [], (_, rows) => {
            let msg = '👥 Состав модерации:\n\n';
            rows.forEach(m => msg += `• @id${m.user_id} — ${m.nickname} (${m.role})\n`);
            ctx.send(msg || 'Состав пуст.');
        });
    }
});

async function startBot() {
    await vk.updates.startPolling();
    console.log('🚀 Бот запущен | Добавление модератора полностью работает');
}

startBot();
