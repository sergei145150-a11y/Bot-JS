// FULL V4 bot.js
// npm install vk-io sqlite3

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
// DB
// =====================================
const db = new sqlite3.Database('./base.db');

db.run(`
CREATE TABLE IF NOT EXISTS users(
id INTEGER PRIMARY KEY,
rp_nick TEXT DEFAULT '',
post TEXT DEFAULT '',
coins INTEGER DEFAULT 0,
warns INTEGER DEFAULT 0,
vigs INTEGER DEFAULT 0,
norm_days INTEGER DEFAULT 0,
inactive_count INTEGER DEFAULT 0,
appointed TEXT DEFAULT '',
last_up TEXT DEFAULT ''
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
        db.get(sql, params, (e, row) => resolve(row));
    });
}

function all(sql, params = []) {
    return new Promise(resolve => {
        db.all(sql, params, (e, rows) => resolve(rows));
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
        .replace('vk.com/', '')
        .replace('@', '')
        .trim();

    if (/^\d+$/.test(text)) return Number(text);

    try {
        const user = await vk.api.users.get({
            user_ids: text
        });

        return user[0].id;
    } catch {
        return null;
    }
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

function adminMenu() {
    return Keyboard.builder()
        .textButton({ label: '👤 Модераторы', color: Keyboard.PRIMARY_COLOR })
        .row()
        .textButton({ label: '📊 Статистика', color: Keyboard.POSITIVE_COLOR })
        .textButton({ label: '🔖 Повышения', color: Keyboard.SECONDARY_COLOR })
        .row()
        .textButton({ label: '📄 Состав', color: Keyboard.PRIMARY_COLOR })
        .textButton({ label: '⚙ Настройки', color: Keyboard.NEGATIVE_COLOR })
        .row()
        .textButton({ label: '⬅ Назад', color: Keyboard.SECONDARY_COLOR })
        .inline(false);
}

function moderatorsMenu() {
    return Keyboard.builder()
        .textButton({ label: '➕ Добавить модератора', color: Keyboard.POSITIVE_COLOR })
        .row()
        .textButton({ label: '🔎 Найти модератора', color: Keyboard.PRIMARY_COLOR })
        .row()
        .textButton({ label: '🗑 Удалить модератора', color: Keyboard.NEGATIVE_COLOR })
        .row()
        .textButton({ label: '⬅ Назад', color: Keyboard.SECONDARY_COLOR })
        .inline(false);
}

// =====================================
// START
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

            const photos = [];

            for (const a of context.attachments) {
                if (a.type === 'photo') {
                    photos.push(a.toString());
                }
            }

            await sendAdmins(
                `📑 Новый отчёт\n\n👤 id${id}\n📝 ${text || 'Без текста'}`,
                photos
            );

            delete states[id];
            await send(id, '✅ Отчёт отправлен.', menu(id));
            return;
        }

        // ADD MODERATOR
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

            await send(id, 'Введите RP Nick:');
            return;
        }

        if (st.type === 'add_nick') {

            states[id] = {
                type: 'add_post',
                uid: st.uid,
                nick: text
            };

            let msg = 'Выберите должность:\n\n';

            POSTS.forEach((p, i) => {
                msg += `${i + 1}. ${p}\n`;
            });

            await send(id, msg);
            return;
        }

        if (st.type === 'add_post') {

            const num = Number(text);

            if (!POSTS[num - 1]) {
                await send(id, '❌ Введите номер должности');
                return;
            }

            await run(
                `UPDATE users SET rp_nick=?, post=? WHERE id=?`,
                [st.nick, POSTS[num - 1], st.uid]
            );

            delete states[id];

            await send(id, '✅ Модератор добавлен.', moderatorsMenu());
            return;
        }

        // DELETE
        if (st.type === 'delete_mod') {

            const uid = await resolveUser(text);

            await run(`DELETE FROM users WHERE id=?`, [uid]);

            delete states[id];

            await send(id, '🗑 Модератор удалён.', moderatorsMenu());
            return;
        }

        // FIND
        if (st.type === 'find_mod') {

            const uid = await resolveUser(text);
            const row = await get(`SELECT * FROM users WHERE id=?`, [uid]);

            if (!row) {
                await send(id, '❌ Не найден.');
                return;
            }

            await send(id,
`👤 ${row.rp_nick}
🆔 ${uid}
📌 ${row.post}
🪙 Coins: ${row.coins}
⚠ Warns: ${row.warns}
⛔ Vigs: ${row.vigs}`, moderatorsMenu());

            delete states[id];
            return;
        }
    }

    // =====================================
    // COMMANDS
    // =====================================

    if (low === '/start') {
        await send(id, '✅ Панель активирована.', menu(id));
    }

    else if (low === '🪪 статистика') {

        const row = await get(`SELECT * FROM users WHERE id=?`, [id]);

        await send(id,
`🔻RP Nickname: ${row.rp_nick || 'Не указано'}
🔻Должность: ${row.post || 'Не указано'}
🪙 Coins: ${row.coins}

⛔ Предупреждения: ${row.warns}
⛔ Выговоры: ${row.vigs}

✅ Норма: ${row.norm_days}
❎ Неактивы: ${row.inactive_count}`, menu(id));
    }

    else if (low === '🗂 заявления') {
        await send(id, '🗂 Раздел заявлений:', claimsMenu());
    }

    else if (low === '📑 отчёт') {
        states[id] = { type: 'report' };
        await send(id, '📑 Отправьте отчёт с фото.');
    }

    else if (low === '⚖ инструктаж') {
        await send(id, '⚖ Соблюдайте правила.', menu(id));
    }

    else if (low === '🆘 sos') {
        await sendAdmins(`🆘 SOS вызов от id${id}`);
        await send(id, '✅ Руководство уведомлено.', menu(id));
    }

    // =====================================
    // ADMIN
    // =====================================
    else if (low === '🛠 управление' && ADMINS.includes(id)) {
        await send(id, '🛠 Панель управления:', adminMenu());
    }

    else if (low === '👤 модераторы' && ADMINS.includes(id)) {
        await send(id, '👤 Управление модераторами:', moderatorsMenu());
    }

    else if (low === '➕ добавить модератора' && ADMINS.includes(id)) {
        states[id] = { type: 'add_link' };
        await send(id, 'Введите ссылку / ID / @username');
    }

    else if (low === '🗑 удалить модератора' && ADMINS.includes(id)) {
        states[id] = { type: 'delete_mod' };
        await send(id, 'Введите ссылку / ID');
    }

    else if (low === '🔎 найти модератора' && ADMINS.includes(id)) {
        states[id] = { type: 'find_mod' };
        await send(id, 'Введите ссылку / ID');
    }

    else if (low === '📄 состав' && ADMINS.includes(id)) {

        const rows = await all(`SELECT * FROM users WHERE rp_nick != ''`);

        let msg = '📄 Состав:\n\n';

        rows.forEach((u, i) => {
            msg += `${i + 1}. ${u.rp_nick} — ${u.post}\n`;
        });

        await send(id, msg, adminMenu());
    }

    else if (low === '⬅ назад') {
        await send(id, '⬅ Главное меню.', menu(id));
    }

});

// =====================================
vk.updates.start()
.then(() => console.log('BOT STARTED'))
.catch(console.error);
