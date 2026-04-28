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
coins INTEGER DEFAULT 0
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
            await send(id,
`🪪 Ваша статистика

🆔 ID: ${id}
⚠ Предупреждения: ${row.warns}
⛔ Выговоры: ${row.vigs}
💰 Coins: ${row.coins}`);
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
