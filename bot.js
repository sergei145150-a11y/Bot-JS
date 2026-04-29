// V5 FULL — ЧАСТЬ 1/2
// bot.js
// npm i vk-io sqlite3

const { VK, Keyboard } = require('vk-io');
const sqlite3 = require('sqlite3').verbose();

// =====================================
// CONFIG
// =====================================
const TOKEN = 'vk1.a.FJKFjHTWfHQM-DgOtBH3y35k_8L13uZiaA6kvsUXxJcRG-fvChOWJLzwVcUrphGUWtHsf2i1NxfYagKRVMNxB1brG8c3YX0y2L-VwKzfY5hOnWO7Eex5ysAdSmluSEYWy-1XQgCMCcpCuQxDaRc5c950wWgJTU0_FT-ufn8nsxw6U_ue4VOY7bxbemrcsEsdFYw7PnSBC5vOP8lYT4NqCA';
let ADMINS = [674691524, 642009529, 547053039];

const POSTS = [
    'Младший модератор',
    'Модератор',
    'Старший модератор',
    'Куратор модерации',
    'Заместитель главного модератора',
    'Главный модератор'
];

// =====================================
// VK
// =====================================
const vk = new VK({
    token: TOKEN
});

// =====================================
// DATABASE
// =====================================
const db = new sqlite3.Database('./base.db');

db.run(`
CREATE TABLE IF NOT EXISTS users(
id INTEGER PRIMARY KEY,
rp_nick TEXT DEFAULT '',
post TEXT DEFAULT '',
coins INTEGER DEFAULT 0,

name TEXT DEFAULT '',
age TEXT DEFAULT '',
birthday TEXT DEFAULT '',
timezone TEXT DEFAULT '',
pc TEXT DEFAULT '',

warns INTEGER DEFAULT 0,
vigs INTEGER DEFAULT 0,

appointed TEXT DEFAULT '',
last_up TEXT DEFAULT '',

norm_days INTEGER DEFAULT 0,
inactive_count INTEGER DEFAULT 0,

discord TEXT DEFAULT '',
forum TEXT DEFAULT '',
telegram TEXT DEFAULT ''
)
`);

// =====================================
// MEMORY
// =====================================
const states = {};

// =====================================
// HELPERS
// =====================================
function reg(id) {
    db.run(`INSERT OR IGNORE INTO users(id) VALUES(?)`, [id]);
}

function get(sql, params = []) {
    return new Promise(resolve => {
        db.get(sql, params, (err, row) => resolve(row));
    });
}

function all(sql, params = []) {
    return new Promise(resolve => {
        db.all(sql, params, (err, rows) => resolve(rows));
    });
}

function run(sql, params = []) {
    return new Promise(resolve => {
        db.run(sql, params, resolve);
    });
}

async function send(id, message, keyboard = null, attachment = []) {
    const params = {
        peer_id: id,
        random_id: Date.now(),
        message
    };

    if (keyboard) params.keyboard = keyboard;
    if (attachment.length) params.attachment = attachment;

    await vk.api.messages.send(params);
}

async function sendAdmins(msg, attachment = []) {
    for (const admin of ADMINS) {
        await send(admin, msg, null, attachment);
    }
}

async function resolveUser(text) {
    text = text
        .replace('https://vk.com/', '')
        .replace('http://vk.com/', '')
        .replace('vk.com/', '')
        .replace('@', '')
        .trim();

    if (/^\d+$/.test(text)) return Number(text);

    try {
        const users = await vk.api.users.get({
            user_ids: text
        });

        return users[0].id;
    } catch {
        return null;
    }
}

// =====================================
// DATE HELPERS
// =====================================
function parseDate(str) {
    if (!str || !str.includes('.')) return null;

    const parts = str.split('.');
    if (parts.length !== 3) return null;

    return new Date(parts[2], parts[1] - 1, parts[0]);
}

function daysBetween(str) {
    const d = parseDate(str);
    if (!d) return 'Не указано';

    const now = new Date();
    const diff = now - d;

    return Math.floor(diff / 86400000);
}

// =====================================
// KEYBOARDS
// =====================================
function menu(id) {
    const kb = Keyboard.builder();

    kb.textButton({
        label: '🪪 Статистика',
        color: Keyboard.PRIMARY_COLOR
    });

    kb.textButton({
        label: '🗂 Заявления',
        color: Keyboard.POSITIVE_COLOR
    });

    kb.row();

    kb.textButton({
        label: '⚖ Инструктаж',
        color: Keyboard.SECONDARY_COLOR
    });

    kb.textButton({
        label: '🆘 SOS',
        color: Keyboard.NEGATIVE_COLOR
    });

    if (ADMINS.includes(id)) {
        kb.row();

        kb.textButton({
            label: '🛠 Управление',
            color: Keyboard.NEGATIVE_COLOR
        });
    }

    return kb.inline(false);
}

function claimsMenu() {
    return Keyboard.builder()
        .textButton({ label: '📑 Отчёт', color: Keyboard.PRIMARY_COLOR })
        .textButton({ label: '🛩 Неактив', color: Keyboard.SECONDARY_COLOR })
        .row()
        .textButton({ label: '🔖 Повышение', color: Keyboard.POSITIVE_COLOR })
        .textButton({ label: '🗂 Снятие выговора', color: Keyboard.PRIMARY_COLOR })
        .row()
        .textButton({ label: '🔕 Пропуск собрания', color: Keyboard.NEGATIVE_COLOR })
        .row()
        .textButton({ label: '⬅ Назад', color: Keyboard.SECONDARY_COLOR })
        .inline(false);
}

// ===============================
// V6 — ЗАМЕНИ ТОЛЬКО adminMenu()
// ===============================

function adminMenu() {
    return Keyboard.builder()

        .textButton({
            label: '👤 Модераторы',
            color: Keyboard.PRIMARY_COLOR
        })

        .row()

        .textButton({
            label: '📊 Статистика',
            color: Keyboard.POSITIVE_COLOR
        })

        .textButton({
            label: '🔖 Повышения',
            color: Keyboard.SECONDARY_COLOR
        })

        .row()

        .textButton({
            label: '📄 Состав',
            color: Keyboard.PRIMARY_COLOR
        })

        .textButton({
            label: '⚙ Настройки',
            color: Keyboard.NEGATIVE_COLOR
        })

        .row()

        .textButton({
            label: '⬅ Назад',
            color: Keyboard.SECONDARY_COLOR
        })

        .inline(false);
}

// =====================================
// REPORT PHOTO PARSER
// =====================================
function getPhotos(context) {
    const arr = [];

    if (!context.attachments) return arr;

    for (const a of context.attachments) {
        if (a.type === 'photo') {
            arr.push(a.toString());
        }
    }

    return arr;
}

// =====================================
// MAIN HANDLER
// =====================================
vk.updates.on('message_new', async (context) => {

    if (!context.isUser) return;

    const id = context.senderId;
    const text = (context.text || '').trim();
    const low = text.toLowerCase();

    reg(id);

    // =====================================
    // STATES
    // =====================================
    if (states[id]) {

        const st = states[id];

        // REPORT
        if (st.type === 'report') {

            const photos = getPhotos(context);

            await sendAdmins(
                `📑 Новый отчёт\n\n👤 id${id}\n📝 ${text || 'Без текста'}`,
                photos
            );

            delete states[id];

            await send(id, '✅ Отчёт отправлен.', menu(id));
            return;
        }

        // V5 FULL — ЧАСТЬ 2/2
// вставить СРАЗУ после части 1

        // ============================
        // ADD MODERATOR
        // ============================
        if (st.type === 'add_link') {
            const uid = await resolveUser(text);

            if (!uid) {
                await send(id, '❌ Пользователь не найден');
                return;
            }

            reg(uid);

            states[id] = {
                type: 'add_nick',
                uid
            };

            await send(id, 'Введите RP Nickname:');
            return;
        }

        if (st.type === 'add_nick') {
            states[id] = {
                type: 'add_post',
                uid: st.uid,
                nick: text
            };

            let msg = 'Введите номер должности:\n\n';

            POSTS.forEach((p, i) => {
                msg += `${i + 1}. ${p}\n`;
            });

            await send(id, msg);
            return;
        }

        if (st.type === 'add_post') {
            const num = Number(text);

            if (!POSTS[num - 1]) {
                await send(id, '❌ Неверный номер.');
                return;
            }

            const today = new Date();
            const d = `${String(today.getDate()).padStart(2,'0')}.${String(today.getMonth()+1).padStart(2,'0')}.${today.getFullYear()}`;

            await run(`
                UPDATE users SET
                rp_nick=?,
                post=?,
                appointed=?,
                last_up=?
                WHERE id=?
            `, [
                st.nick,
                POSTS[num - 1],
                d,
                d,
                st.uid
            ]);

            delete states[id];

            await send(id, '✅ Модератор добавлен.', adminMenu());
            return;
        }

        // ============================
        // REPORT SIMPLE STATES
        // ============================
        if (st.type === 'inactive') {
            await sendAdmins(`🛩 Неактив\n\n👤 id${id}\n📝 ${text}`);
            delete states[id];
            await send(id, '✅ Заявка отправлена.', menu(id));
            return;
        }

        if (st.type === 'up') {
            await sendAdmins(`🔖 Повышение\n\n👤 id${id}\n📝 ${text}`);
            delete states[id];
            await send(id, '✅ Заявка отправлена.', menu(id));
            return;
        }

        if (st.type === 'vigoff') {
            await sendAdmins(`🗂 Снятие выговора\n\n👤 id${id}\n📝 ${text}`);
            delete states[id];
            await send(id, '✅ Заявка отправлена.', menu(id));
            return;
        }

        if (st.type === 'skip') {
            await sendAdmins(`🔕 Пропуск собрания\n\n👤 id${id}\n📝 ${text}`);
            delete states[id];
            await send(id, '✅ Заявка отправлена.', menu(id));
            return;
        }
    }

    // =====================================
    // COMMANDS
    // =====================================

    if (low === '/start') {
        await send(id, '✅ Панель активирована.', menu(id));
    }

    // ============================
    // STATISTIC
    // ============================
    else if (low === '🪪 статистика') {

        const row = await get(`SELECT * FROM users WHERE id=?`, [id]);

        if (!row) {
            await send(id, 'Профиль не найден.', menu(id));
            return;
        }

        await send(id,
`🔻RP-Nickname: ${row.rp_nick || 'Не указано'}
🔻Должность: ${row.post || 'Не указано'}
🪙Coins: ${row.coins}

📋 Личная информация

▫️Имя: ${row.name || 'Не указано'}
▫️Возраст: ${row.age || 'Не указано'}
▫️Дата рождения: ${row.birthday || 'Не указано'}
▫️Часовой пояс: ${row.timezone || 'Не указано'}
▫️ПК: ${row.pc || 'Не указано'}

🪪 Статистика модератора

⛔️Предупреждения: ${row.warns}
⛔️Выговоры: ${row.vigs}

▫️Поставлен: ${row.appointed || 'Не указано'}
▫️Последнее повышение: ${row.last_up || 'Не указано'}
▫️Дней на посту: ${daysBetween(row.appointed)}
▫️Дней на должности: ${daysBetween(row.last_up)}

✅Дней выполненной нормы: ${row.norm_days}
❎Количество неактивов: ${row.inactive_count}

⚠️Discord: ${row.discord || 'Не указано'}
⚠️Forum: ${row.forum || 'Не указано'}
⚠️Telegram: ${row.telegram || 'Не указано'}`, menu(id));
    }

    // ============================
    // CLAIMS
    // ============================
    else if (low === '🗂 заявления') {
        await send(id, '🗂 Раздел заявлений:', claimsMenu());
    }

    else if (low === '📑 отчёт') {
        states[id] = { type: 'report' };
        await send(id, '📑 Отправьте текст отчёта и прикрепите фото.');
    }

    else if (low === '🛩 неактив') {
        states[id] = { type: 'inactive' };
        await send(id, '🛩 Укажите причину и срок.');
    }

    else if (low === '🔖 повышение') {
        states[id] = { type: 'up' };
        await send(id, '🔖 Укажите причину.');
    }

    else if (low === '🗂 снятие выговора') {
        states[id] = { type: 'vigoff' };
        await send(id, '🗂 Укажите причину.');
    }

    else if (low === '🔕 пропуск собрания') {
        states[id] = { type: 'skip' };
        await send(id, '🔕 Укажите причину.');
    }

    // ============================
    // OTHER
    // ============================
    else if (low === '⚖ инструктаж') {
        await send(id,
`⚖ Инструктаж:

• Соблюдать правила
• Быть активным
• Работать честно
• Уважать состав`, menu(id));
    }

    else if (low === '🆘 sos') {
        await sendAdmins(`🆘 SOS вызов от id${id}`);
        await send(id, '✅ Руководство уведомлено.', menu(id));
    }

    // ============================
    // ADMIN PANEL
    // ============================
    else if (low === '🛠 управление' && ADMINS.includes(id)) {
        await send(id, '🛠 Панель управления:', adminMenu());
    }

    // =======================================
// V6 ШАГ 2 — вставить в COMMANDS блок
// ниже else if (low === '🛠 управление')
// =======================================

// ==============================
// 👤 МОДЕРАТОРЫ
// ==============================
else if (low === '👤 модераторы' && ADMINS.includes(id)) {

    await send(id, '👤 Управление модераторами:',
        Keyboard.builder()

        .textButton({
            label: '➕ Добавить модератора',
            color: Keyboard.POSITIVE_COLOR
        })

        .row()

        .textButton({
            label: '🗑 Удалить модератора',
            color: Keyboard.NEGATIVE_COLOR
        })

        .textButton({
            label: '✏ Изменить данные',
            color: Keyboard.PRIMARY_COLOR
        })

        .row()

        .textButton({
            label: '📄 Список модераторов',
            color: Keyboard.SECONDARY_COLOR
        })

        .row()

        .textButton({
            label: '⬅ Назад',
            color: Keyboard.SECONDARY_COLOR
        })

        .inline(false)
    );
}

// ==============================
// 📊 СТАТИСТИКА
// ==============================
else if (low === '📊 статистика' && ADMINS.includes(id)) {

    await send(id, '📊 Управление статистикой:',
        Keyboard.builder()

        .textButton({
            label: '➕ Выдать Coins',
            color: Keyboard.POSITIVE_COLOR
        })

        .textButton({
            label: '➖ Снять Coins',
            color: Keyboard.NEGATIVE_COLOR
        })

        .row()

        .textButton({
            label: '⛔ Выдать выговор',
            color: Keyboard.NEGATIVE_COLOR
        })

        .textButton({
            label: '✅ Снять выговор',
            color: Keyboard.POSITIVE_COLOR
        })

        .row()

        .textButton({
            label: '📈 +Норма день',
            color: Keyboard.PRIMARY_COLOR
        })

        .row()

        .textButton({
            label: '⬅ Назад',
            color: Keyboard.SECONDARY_COLOR
        })

        .inline(false)
    );
}

// ==========================================
// V6 STEP 3
// ВСТАВИТЬ В БЛОК if (states[id]) {
// СРАЗУ В НАЧАЛО
// ==========================================

// ============================
// УДАЛИТЬ МОДЕРАТОРА
// ============================
if (st.type === 'remove_mod') {

    const uid = await resolveUser(text);

    if (!uid) {
        await send(id, '❌ Пользователь не найден');
        return;
    }

    await run(`
        UPDATE users SET
        rp_nick='',
        post='',
        appointed='',
        last_up=''
        WHERE id=?
    `, [uid]);

    delete states[id];

    await send(id, '✅ Модератор удалён.', adminMenu());
    return;
}

// ============================
// ИЗМЕНИТЬ ДОЛЖНОСТЬ
// ============================
if (st.type === 'edit_mod_1') {

    const uid = await resolveUser(text);

    if (!uid) {
        await send(id, '❌ Пользователь не найден');
        return;
    }

    states[id] = {
        type: 'edit_mod_2',
        uid
    };

    let msg = 'Выберите новую должность:\n\n';

    POSTS.forEach((p, i) => {
        msg += `${i + 1}. ${p}\n`;
    });

    await send(id, msg);
    return;
}

if (st.type === 'edit_mod_2') {

    const num = Number(text);

    if (!POSTS[num - 1]) {
        await send(id, '❌ Неверный номер');
        return;
    }

    const today = new Date();
    const d = `${String(today.getDate()).padStart(2,'0')}.${String(today.getMonth()+1).padStart(2,'0')}.${today.getFullYear()}`;

    await run(`
        UPDATE users SET
        post=?,
        last_up=?
        WHERE id=?
    `, [
        POSTS[num - 1],
        d,
        st.uid
    ]);

    delete states[id];

    await send(id, '✅ Должность обновлена.', adminMenu());
    return;
}

// ============================
// ВЫДАТЬ COINS
// ============================
if (st.type === 'coins_add_1') {

    const uid = await resolveUser(text);

    if (!uid) {
        await send(id, '❌ Пользователь не найден');
        return;
    }

    states[id] = {
        type: 'coins_add_2',
        uid
    };

    await send(id, 'Введите количество Coins:');
    return;
}

if (st.type === 'coins_add_2') {

    const val = Number(text);

    await run(`
        UPDATE users
        SET coins = coins + ?
        WHERE id=?
    `, [val, st.uid]);

    delete states[id];

    await send(id, '✅ Coins начислены.', adminMenu());
    return;
}

// ============================
// СНЯТЬ COINS
// ============================
if (st.type === 'coins_remove_1') {

    const uid = await resolveUser(text);

    if (!uid) {
        await send(id, '❌ Пользователь не найден');
        return;
    }

    states[id] = {
        type: 'coins_remove_2',
        uid
    };

    await send(id, 'Введите количество Coins:');
    return;
}

if (st.type === 'coins_remove_2') {

    const val = Number(text);

    await run(`
        UPDATE users
        SET coins = CASE
            WHEN coins - ? < 0 THEN 0
            ELSE coins - ?
        END
        WHERE id=?
    `, [val, val, st.uid]);

    delete states[id];

    await send(id, '✅ Coins сняты.', adminMenu());
    return;
}

// ============================
// ВЫГОВОР +
// ============================
if (st.type === 'vig_add') {

    const uid = await resolveUser(text);

    if (!uid) {
        await send(id, '❌ Пользователь не найден');
        return;
    }

    await run(`
        UPDATE users
        SET vigs = vigs + 1
        WHERE id=?
    `, [uid]);

    delete states[id];

    await send(id, '✅ Выговор выдан.', adminMenu());
    return;
}

// ============================
// ВЫГОВОР -
// ============================
if (st.type === 'vig_remove') {

    const uid = await resolveUser(text);

    if (!uid) {
        await send(id, '❌ Пользователь не найден');
        return;
    }

    await run(`
        UPDATE users
        SET vigs = CASE
            WHEN vigs - 1 < 0 THEN 0
            ELSE vigs - 1
        END
        WHERE id=?
    `, [uid]);

    delete states[id];

    await send(id, '✅ Выговор снят.', adminMenu());
    return;
}

// ============================
// + НОРМА
// ============================
if (st.type === 'norm_add') {

    const uid = await resolveUser(text);

    if (!uid) {
        await send(id, '❌ Пользователь не найден');
        return;
    }

    await run(`
        UPDATE users
        SET norm_days = norm_days + 1
        WHERE id=?
    `, [uid]);

    delete states[id];

    await send(id, '✅ День нормы добавлен.', adminMenu());
    return;
}

// ============================
// АВТО ПОВЫШЕНИЕ
// ============================
if (st.type === 'raise_mod') {

    const uid = await resolveUser(text);

    if (!uid) {
        await send(id, '❌ Пользователь не найден');
        return;
    }

    const row = await get(`
        SELECT * FROM users WHERE id=?
    `, [uid]);

    const index = POSTS.indexOf(row.post);

    if (index === -1 || index >= POSTS.length - 1) {
        await send(id, '❌ Повысить нельзя.');
        delete states[id];
        return;
    }

    const today = new Date();
    const d = `${String(today.getDate()).padStart(2,'0')}.${String(today.getMonth()+1).padStart(2,'0')}.${today.getFullYear()}`;

    await run(`
        UPDATE users
        SET post=?,
        last_up=?
        WHERE id=?
    `, [
        POSTS[index + 1],
        d,
        uid
    ]);

    delete states[id];

    await send(id, '✅ Модератор повышен.', adminMenu());
    return;
}

// ==========================================
// V6 STEP 4
// ВСТАВИТЬ В COMMANDS БЛОК
// (ниже меню админки)
// ==========================================

// ============================
// УДАЛИТЬ МОДЕРАТОРА
// ============================
else if (low === '🗑 удалить модератора' && ADMINS.includes(id)) {
    states[id] = { type: 'remove_mod' };
    await send(id, 'Введите ссылку / ID / @username модератора:');
}

// ============================
// ИЗМЕНИТЬ ДАННЫЕ
// ============================
else if (low === '✏ изменить данные' && ADMINS.includes(id)) {
    states[id] = { type: 'edit_mod_1' };
    await send(id, 'Введите ссылку / ID / @username модератора:');
}

// ============================
// ВЫДАТЬ COINS
// ============================
else if (low === '➕ выдать coins' && ADMINS.includes(id)) {
    states[id] = { type: 'coins_add_1' };
    await send(id, 'Введите ссылку / ID / @username:');
}

// ============================
// СНЯТЬ COINS
// ============================
else if (low === '➖ снять coins' && ADMINS.includes(id)) {
    states[id] = { type: 'coins_remove_1' };
    await send(id, 'Введите ссылку / ID / @username:');
}

// ============================
// ВЫДАТЬ ВЫГОВОР
// ============================
else if (low === '⛔ выдать выговор' && ADMINS.includes(id)) {
    states[id] = { type: 'vig_add' };
    await send(id, 'Введите ссылку / ID / @username:');
}

// ============================
// СНЯТЬ ВЫГОВОР
// ============================
else if (low === '✅ снять выговор' && ADMINS.includes(id)) {
    states[id] = { type: 'vig_remove' };
    await send(id, 'Введите ссылку / ID / @username:');
}

// ============================
// + НОРМА ДЕНЬ
// ============================
else if (low === '📈 +норма день' && ADMINS.includes(id)) {
    states[id] = { type: 'norm_add' };
    await send(id, 'Введите ссылку / ID / @username:');
}

// ============================
// СПИСОК МОДЕРАТОРОВ
// ============================
else if (low === '📄 список модераторов' && ADMINS.includes(id)) {

    const rows = await all(`
        SELECT * FROM users
        WHERE rp_nick != ''
        ORDER BY id ASC
    `);

    if (!rows.length) {
        await send(id, 'Список пуст.');
        return;
    }

    let msg = '📄 Список модераторов:\n\n';

    rows.forEach((u, i) => {
        msg += `${i + 1}. ${u.rp_nick} — ${u.post}\n`;
    });

    await send(id, msg);
}
    
// ==============================
// СПИСОК АДМИНОВ
// ==============================
else if (low === '📋 список админов' && ADMINS.includes(id)) {

    let msg = '📋 Администраторы:\n\n';

    ADMINS.forEach((a, i) => {
        msg += `${i + 1}. id${a}\n`;
    });

    await send(id, msg, adminMenu());
}
};

// =====================================
// START BOT
// =====================================
vk.updates.start()
.then(() => console.log('BOT STARTED'))
.catch(console.error);
