// FULL V2 FINAL
// Node.js VK BOT
// npm i vk-io sqlite3

const { VK, Keyboard } = require('vk-io');
const sqlite3 = require('sqlite3').verbose();

// ======================================
// CONFIG
// ======================================
const TOKEN = 'vk1.a.FJKFjHTWfHQM-DgOtBH3y35k_8L13uZiaA6kvsUXxJcRG-fvChOWJLzwVcUrphGUWtHsf2i1NxfYagKRVMNxB1brG8c3YX0y2L-VwKzfY5hOnWO7Eex5ysAdSmluSEYWy-1XQgCMCcpCuQxDaRc5c950wWgJTU0_FT-ufn8nsxw6U_ue4VOY7bxbemrcsEsdFYw7PnSBC5vOP8lYT4NqCA';
const ADMINS = [674691524, 642009529, 547053039];

// ======================================
// VK
// ======================================
const vk = new VK({
    token: TOKEN
});

// ======================================
// DB
// ======================================
const db = new sqlite3.Database('./base.db');

db.run(`
CREATE TABLE IF NOT EXISTS users(
id INTEGER PRIMARY KEY,
rp_nick TEXT DEFAULT '',
post TEXT DEFAULT '',
coins INTEGER DEFAULT 0,
warns INTEGER DEFAULT 0,
vigs INTEGER DEFAULT 0,
name TEXT DEFAULT '',
age TEXT DEFAULT '',
birthday TEXT DEFAULT '',
timezone TEXT DEFAULT '',
pc TEXT DEFAULT '',
appointed TEXT DEFAULT '',
last_up TEXT DEFAULT '',
norm_days INTEGER DEFAULT 0,
inactive_count INTEGER DEFAULT 0,
discord TEXT DEFAULT '',
forum TEXT DEFAULT '',
telegram TEXT DEFAULT ''
)
`);

// ======================================
// MEMORY
// ======================================
const states = {};

// ======================================
// HELPERS
// ======================================
function reg(id) {
    db.run(`INSERT OR IGNORE INTO users(id) VALUES(?)`, [id]);
}

function query(sql, params = []) {
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
        random_id: Date.now() + Math.floor(Math.random() * 9999),
        message
    };

    if (keyboard) params.keyboard = keyboard;
    if (attachment && attachment.length) params.attachment = attachment;

    await vk.api.messages.send(params);
}

async function sendAdmins(message, attachment = []) {
    for (const admin of ADMINS) {
        await send(admin, message, null, attachment);
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

// ======================================
// KEYBOARDS
// ======================================
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
        .textButton({ label: '➕ Добавить сотрудника', color: Keyboard.POSITIVE_COLOR })
        .row()
        .textButton({ label: '📋 Список состава', color: Keyboard.PRIMARY_COLOR })
        .row()
        .textButton({ label: '⬅ Назад', color: Keyboard.SECONDARY_COLOR })
        .inline(false);
}

// ======================================
// START
// ======================================
vk.updates.on('message_new', async (context) => {

    if (!context.isUser) return;

    const id = context.senderId;
    const text = (context.text || '').trim();
    const low = text.toLowerCase();

    reg(id);

    // ======================================
    // STATES
    // ======================================
    if (states[id]) {

        const st = states[id];

        // ----------------------------------
        // REPORT
        // ----------------------------------
        if (st.type === 'report') {

            const attachments = [];

            if (context.attachments && context.attachments.length) {
                for (const item of context.attachments) {
                    if (item.type === 'photo') {
                        attachments.push(item.toString());
                    }
                }
            }

            await sendAdmins(
                `📑 Новый отчёт\n\n👤 id${id}\n📝 ${text || 'Без текста'}`,
                attachments
            );

            delete states[id];
            await send(id, '✅ Отчёт отправлен.', menu(id));
            return;
        }

        // ----------------------------------
        // SIMPLE CLAIMS
        // ----------------------------------
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

        // ----------------------------------
        // ADD STAFF
        // ----------------------------------
        if (st.type === 'add_staff_link') {

            const uid = await resolveUser(text);

            if (!uid) {
                await send(id, '❌ Пользователь не найден.');
                return;
            }

            reg(uid);

            states[id] = {
                type: 'add_staff_nick',
                uid
            };

            await send(id, 'Введите RP Nick:');
            return;
        }

        if (st.type === 'add_staff_nick') {

            states[id] = {
                type: 'add_staff_post',
                uid: st.uid,
                nick: text
            };

            await send(id, 'Введите должность:');
            return;
        }

        if (st.type === 'add_staff_post') {

            await run(
                `UPDATE users SET rp_nick=?, post=? WHERE id=?`,
                [st.nick, text, st.uid]
            );

            delete states[id];

            await send(id, '✅ Сотрудник добавлен.', adminMenu());
            return;
        }
    }

    // ======================================
    // COMMANDS
    // ======================================

    if (low === '/start') {
        await send(id, '✅ Панель активирована.', menu(id));
    }

    // --------------------------------------
    // STATS
    // --------------------------------------
    else if (low === '🪪 статистика') {

        const row = await query(`SELECT * FROM users WHERE id=?`, [id]);

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

⛔Предупреждения: ${row.warns}
⛔Выговоры: ${row.vigs}

▫️Поставлен: ${row.appointed || 'Не указано'}
▫️Последнее повышение: ${row.last_up || 'Не указано'}

✅Дней нормы: ${row.norm_days}
❎Неактивов: ${row.inactive_count}

⚠Discord: ${row.discord || 'Не указано'}
⚠Forum: ${row.forum || 'Не указано'}
⚠Telegram: ${row.telegram || 'Не указано'}`, menu(id));
    }

    // --------------------------------------
    // CLAIMS
    // --------------------------------------
    else if (low === '🗂 заявления') {
        await send(id, '🗂 Раздел заявлений:', claimsMenu());
    }

    else if (low === '📑 отчёт') {
        states[id] = { type: 'report' };
        await send(id, '📑 Отправьте текст отчёта и прикрепите фото.');
    }

    else if (low === '🛩 неактив') {
        states[id] = { type: 'inactive' };
        await send(id, '🛩 Укажите причину и срок неактива.');
    }

    else if (low === '🔖 повышение') {
        states[id] = { type: 'up' };
        await send(id, '🔖 Напишите причину повышения.');
    }

    else if (low === '🗂 снятие выговора') {
        states[id] = { type: 'vigoff' };
        await send(id, '🗂 Напишите причину снятия выговора.');
    }

    else if (low === '🔕 пропуск собрания') {
        states[id] = { type: 'skip' };
        await send(id, '🔕 Напишите причину пропуска.');
    }

    // --------------------------------------
    // INSTRUCTION
    // --------------------------------------
    else if (low === '⚖ инструктаж') {
        await send(id,
`⚖ Инструктаж:

• Соблюдать правила
• Быть активным
• Работать честно
• Уважать состав`, menu(id));
    }

    // --------------------------------------
    // SOS
    // --------------------------------------
    else if (low === '🆘 sos') {

        await sendAdmins(`🆘 SOS вызов от id${id}`);
        await send(id, '✅ Руководство уведомлено.', menu(id));
    }

    // --------------------------------------
    // ADMIN PANEL
    // --------------------------------------
    else if (low === '🛠 управление' && ADMINS.includes(id)) {
        await send(id, '🛠 Панель управления:', adminMenu());
    }

    else if (low === '➕ добавить сотрудника' && ADMINS.includes(id)) {
        states[id] = { type: 'add_staff_link' };
        await send(id, 'Введите VK ссылку / @username / ID:');
    }

    else if (low === '📋 список состава' && ADMINS.includes(id)) {

        const rows = await all(`SELECT * FROM users WHERE rp_nick != ''`);

        if (!rows.length) {
            await send(id, 'Состав пуст.', adminMenu());
            return;
        }

        let msg = '📋 Список состава:\n\n';

        rows.forEach((u, i) => {
            msg += `${i + 1}. ${u.rp_nick} — ${u.post}\n`;
        });

        await send(id, msg, adminMenu());
    }

    // --------------------------------------
    // BACK
    // --------------------------------------
    else if (low === '⬅ назад') {
        await send(id, '⬅ Главное меню.', menu(id));
    }

});

// ======================================
vk.updates.start()
    .then(() => console.log('BOT STARTED'))
    .catch(console.error);
