const { VK } = require('vk-io');
const sqlite3 = require('sqlite3').verbose();

const vk = new VK({
    token: 'vk1.a.FJKFjHTWfHQM-DgOtBH3y35k_8L13uZiaA6kvsUXxJcRG-fvChOWJLzwVcUrphGUWtHsf2i1NxfYagKRVMNxB1brG8c3YX0y2L-VwKzfY5hOnWO7Eex5ysAdSmluSEYWy-1XQgCMCcpCuQxDaRc5c950wWgJTU0_FT-ufn8nsxw6U_ue4VOY7bxbemrcsEsdFYw7PnSBC5vOP8lYT4NqCA'
});

const ADMINS = [674691524, 642009529, 547053039];
const states = {};

const db = new sqlite3.Database('./base.db');

db.run(`
CREATE TABLE IF NOT EXISTS users (
id INTEGER PRIMARY KEY,

warns INTEGER DEFAULT 0,
vigs INTEGER DEFAULT 0,
coins INTEGER DEFAULT 0,

rp_nick TEXT DEFAULT 'Не указано',
post TEXT DEFAULT 'Стажёр',

name TEXT DEFAULT 'Не указано',
age TEXT DEFAULT 'Не указано',
birthday TEXT DEFAULT 'Не указано',
timezone TEXT DEFAULT 'Не указано',
pc TEXT DEFAULT 'Нет',

appointed TEXT DEFAULT 'Не указано',
last_up TEXT DEFAULT 'Не указано',

norm_days INTEGER DEFAULT 0,
inactive_count INTEGER DEFAULT 0,

discord TEXT DEFAULT 'Не указано',
forum TEXT DEFAULT 'Не указано',
telegram TEXT DEFAULT 'Не указано'
)
`);

function reg(id) {
    db.run(`INSERT OR IGNORE INTO users(id) VALUES(?)`, [id]);
}

function getUser(id, callback) {
    db.get(`SELECT * FROM users WHERE id=?`, [id], callback);
}

async function send(userId, message, attachment = null) {
    await vk.api.messages.send({
        user_id: userId,
        random_id: Date.now(),
        message,
        attachment
    });
}

async function sendAdmins(message, attachment = null) {
    for (const admin of ADMINS) {
        await send(admin, message, attachment);
    }
}

vk.updates.on('message_new', async (context) => {
    if (!context.isFromUser) return;

    const id = context.senderId;
    const text = (context.text || '').trim().toLowerCase();
    const raw = (context.text || '').trim();
const args = raw.split(' ');

if (ADMINS.includes(id) && raw.startsWith('!')) {

    const cmd = args[0].toLowerCase();
    const uid = Number(args[1]);
    const value = args.slice(2).join(' ');

    if (!uid) {
        await send(id, '❌ Укажи ID.');
        return;
    }

    reg(uid);

    function update(field, val) {
        db.run(`UPDATE users SET ${field}=? WHERE id=?`, [val, uid]);
    }

    if (cmd === '!setnick') update('rp_nick', value);
    else if (cmd === '!setpost') update('post', value);
    else if (cmd === '!setcoins') update('coins', Number(value));
    else if (cmd === '!setwarn') update('warns', Number(value));
    else if (cmd === '!setvig') update('vigs', Number(value));
    else if (cmd === '!setname') update('name', value);
    else if (cmd === '!setage') update('age', value);
    else if (cmd === '!settg') update('telegram', value);
    else if (cmd === '!setds') update('discord', value);
    else if (cmd === '!setforum') update('forum', value);
    else if (cmd === '!setappoint') update('appointed', value);
    else if (cmd === '!setup') update('last_up', value);
    else {
        await send(id, '❌ Неизвестная команда.');
        return;
    }

    await send(id, `✅ Данные пользователя ${uid} обновлены.`);
    return;
}
    
    reg(id);

    if (states[id]) {
        const mode = states[id];

        let photos = [];

try {
    const msg = await vk.api.messages.getById({
        message_ids: context.id
    });

    if (msg.items.length) {
        const attachments = msg.items[0].attachments || [];

        for (const att of attachments) {
            if (att.type === 'photo') {
                const p = att.photo;

                if (p.access_key) {
                    photos.push(`photo${p.owner_id}_${p.id}_${p.access_key}`);
                } else {
                    photos.push(`photo${p.owner_id}_${p.id}`);
                }
            }
        }
    }
} catch (e) {
    console.log(e);
}

        const attachment = photos.length ? photos.join(',') : null;

        if (mode === 'report') {
            await sendAdmins(
                `📑 Новый отчёт\n👤 ID: ${id}\n📝 ${context.text || 'Без текста'}`,
                attachment
            );
            await send(id, '✅ Отчёт отправлен.');
        }

        if (mode === 'inactive') {
            await sendAdmins(`🛩 Неактив\n👤 ID: ${id}\n📝 ${context.text}`);
            await send(id, '✅ Заявка отправлена.');
        }

        if (mode === 'up') {
            await sendAdmins(`🔖 Повышение\n👤 ID: ${id}\n📝 ${context.text}`);
            await send(id, '✅ Заявка отправлена.');
        }

        if (mode === 'vigoff') {
            await sendAdmins(`🗂 Снятие выговора\n👤 ID: ${id}\n📝 ${context.text}`);
            await send(id, '✅ Заявка отправлена.');
        }

        if (mode === 'skip') {
            await sendAdmins(`🔕 Пропуск собрания\n👤 ID: ${id}\n📝 ${context.text}`);
            await send(id, '✅ Заявка отправлена.');
        }

        delete states[id];
        return;
    }

    if (text === '/start') {
        await send(id,
`✅ Панель активирована

🪪 Статистика
🗂 Заявления
⚖ Инструктаж
🆘 SOS`);
    }

    else if (text === '🪪 статистика') {
    getUser(id, async (err, row) => {

        const now = new Date();

        let daysPost = 0;
        let daysRank = 0;

        if (row.appointed !== 'Не указано') {
            const d = new Date(row.appointed);
            daysPost = Math.floor((now - d) / 86400000);
        }

        if (row.last_up !== 'Не указано') {
            const d2 = new Date(row.last_up);
            daysRank = Math.floor((now - d2) / 86400000);
        }

        await send(id,
`🔻RP-Nickname: ${row.rp_nick}
🔻Должность: ${row.post}
🪙Coins: ${row.coins}

📋 Личная информация

▫️Имя: ${row.name}
▫️Возраст: ${row.age}
▫️Дата рождения: ${row.birthday}
▫️Часовой пояс: ${row.timezone}
▫️ПК: ${row.pc}

🪪 Статистика модератора

⛔Предупреждения: ${row.warns}
⛔Выговоры: ${row.vigs}

▫️Поставлен: ${row.appointed}
▫️Последнее повышение: ${row.last_up}
▫️Дней на посту: ${daysPost}
▫️Дней на должности: ${daysRank}

✅Дней выполненной нормы: ${row.norm_days}
❎Количество неактивов: ${row.inactive_count}

⚠Discord: ${row.discord}
⚠Forum: ${row.forum}
⚠Telegram: ${row.telegram}`);
    });
}

    else if (text === '🗂 заявления') {
        await send(id,
`🗂 Раздел заявлений

📑 Отчёт
🛩 Неактив
🔖 Повышение
🗂 Снятие выговора
🔕 Пропуск собрания`);
    }

    else if (text === '⚖ инструктаж') {
        await send(id,
`⚖ Инструктаж:

• Соблюдать правила
• Быть активным
• Работать честно
• Уважать состав`);
    }

    else if (text === '🆘 sos') {
        await sendAdmins(`🆘 SOS вызов от ID ${id}`);
        await send(id, '✅ Руководство уведомлено.');
    }

    else if (text === '📑 отчёт') {
        states[id] = 'report';
        await send(id, '📑 Отправьте текст отчёта.\nМожно прикрепить до 10 фото.');
    }

    else if (text === '🛩 неактив') {
        states[id] = 'inactive';
        await send(id, '🛩 Укажите причину и срок.');
    }

    else if (text === '🔖 повышение') {
        states[id] = 'up';
        await send(id, '🔖 Почему вас нужно повысить?');
    }

    else if (text === '🗂 снятие выговора') {
        states[id] = 'vigoff';
        await send(id, '🗂 Укажите причину.');
    }

    else if (text === '🔕 пропуск собрания') {
        states[id] = 'skip';
        await send(id, '🔕 Укажите причину.');
    }
});

vk.updates.start().then(() => {
    console.log('BOT STARTED');
});
