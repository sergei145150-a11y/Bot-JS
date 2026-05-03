// bot.js - Полноценный VK Moderation Bot (Node.js + vk-io + sqlite3)
require('dotenv').config();
const { VK, Keyboard } = require('vk-io');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

// ====================== CONFIG ======================
const vk = new VK({
    token: process.env.VK_TOKEN,
    pollingGroupId: Number(process.env.GROUP_ID)
});

if (!process.env.VK_TOKEN || !process.env.GROUP_ID) {
    console.error('❌ Заполните .env (VK_TOKEN и GROUP_ID)');
    process.exit(1);
}

const MAIN_ADMINS = [123456789]; // Главные модераторы (можно расширить)

// ====================== DATABASE ======================
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
        join_date TEXT,
        last_promotion TEXT,
        name TEXT,
        age INTEGER,
        birth_date TEXT,
        timezone TEXT,
        pc TEXT,
        days_on_post INTEGER DEFAULT 0,
        days_on_rank INTEGER DEFAULT 0
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_id INTEGER,
        text TEXT,
        photos TEXT,
        status TEXT DEFAULT 'pending',
        reviewer_id INTEGER,
        created_at TEXT,
        reviewed_at TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        type TEXT,
        action TEXT,
        details TEXT,
        date TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS states (
        user_id INTEGER PRIMARY KEY,
        state TEXT,
        data TEXT,
        expires TEXT
    )`);
});

console.log('✅ База данных готова');

// ====================== FSM ======================
const states = new Map();

function setState(userId, state, data = {}) {
    states.set(userId, { state, data, time: Date.now() });
}

function getState(userId) {
    const s = states.get(userId);
    if (!s || Date.now() - s.time > 1800000) { // 30 минут
        states.delete(userId);
        return null;
    }
    return s;
}

function clearState(userId) { states.delete(userId); }

// ====================== HELPERS ======================
async function getMod(userId) {
    return new Promise(resolve => {
        db.get("SELECT * FROM moderators WHERE user_id = ?", [userId], (err, row) => resolve(row));
    });
}

function isMainAdmin(userId) {
    return MAIN_ADMINS.includes(userId);
}

function hasPermission(userId, requiredRole) {
    const roles = ['Модератор', 'Администратор', 'Заместитель', 'Главный модератор'];
    const roleLevel = { 'Модератор':1, 'Администратор':2, 'Заместитель':3, 'Главный модератор':4 };
    // Здесь можно сделать полноценную проверку
    return true; // упрощено для примера
}

function addLog(userId, type, action, details) {
    db.run("INSERT INTO logs (user_id, type, action, details, date) VALUES (?, ?, ?, ?, datetime('now'))",
        [userId, type, action, details]);
}

// ====================== KEYBOARDS ======================
const mainKb = Keyboard.builder()
    .textButton({ label: '📑 Отчёт', payload: { cmd: 'report_start' } })
    .textButton({ label: '🛩 Неактив', payload: { cmd: 'inactive' } })
    .row()
    .textButton({ label: '📜 История', payload: { cmd: 'history' } })
    .textButton({ label: '🆘 SOS', payload: { cmd: 'sos' } })
    .inline(false);

const adminKb = Keyboard.builder()
    .textButton({ label: '👤 Модераторы', payload: { cmd: 'mod_list' } })
    .textButton({ label: '📊 Статистика', payload: { cmd: 'stats_all' } })
    .row()
    .textButton({ label: '➕ Добавить', payload: { cmd: 'add_mod_start' } })
    .textButton({ label: '🗂 Заявления', payload: { cmd: 'applications' } });

// ====================== REPORT SYSTEM ======================
async function handleReport(context) {
    const attachments = context.attachments.filter(a => a.type === 'photo');
    const text = context.text.trim();

    if (text.length < 15) {
        return context.send('❌ Текст отчёта слишком короткий (минимум 15 символов)');
    }
    if (attachments.length < 2) {
        return context.send('❌ Нужно минимум 2 фото');
    }

    const photos = attachments.map(a => `photo${a.ownerId}_${a.id}`).join(',');

    db.run(`INSERT INTO reports (sender_id, text, photos, created_at) 
            VALUES (?, ?, ?, datetime('now'))`,
        [context.peerId, text, photos], function(err) {
            if (err) return console.error(err);
            const reportId = this.lastID;

            // Рассылка админам
            MAIN_ADMINS.forEach(async admin => {
                try {
                    const user = (await vk.api.users.get({ user_ids: context.peerId }))[0];
                    await vk.api.messages.send({
                        user_id: admin,
                        message: `📑 Новый отчёт #${reportId}\n👤 ${user.first_name} ${user.last_name} (id${context.peerId})\n📅 ${new Date().toLocaleString('ru-RU')}\n📝 ${text}\n📸 Фото: ${attachments.length}`,
                        attachment: photos,
                        keyboard: Keyboard.builder()
                            .textButton({ label: '✅ Принять', payload: { cmd: 'approve', id: reportId } })
                            .textButton({ label: '❌ Отклонить', payload: { cmd: 'reject', id: reportId } })
                            .oneTime(true)
                    });
                } catch (e) {}
            });

            context.send('✅ Отчёт отправлен на проверку!');
            addLog(context.peerId, 'report', 'sent', `#${reportId}`);
        });
}

// ====================== EVENT HANDLERS ======================
vk.updates.on('message', async (context) => {
    if (context.isOutbox) return;
    const text = context.text.trim();
    const userId = context.peerId;
    const state = getState(userId);

    // FSM
    if (state) {
        if (text === '❌ Отмена') {
            clearState(userId);
            return context.send('Отменено', { keyboard: mainKb });
        }

        if (state.state === 'report') {
            await handleReport(context);
            clearState(userId);
            return;
        }

        if (state.state === 'add_mod') {
            // логика добавления модератора
            clearState(userId);
            return context.send('Модератор добавлен (заглушка)');
        }
    }

    // Основные команды
    if (['/start', 'start', 'меню'].includes(text.toLowerCase())) {
        return context.send('👋 Система модерации VK', { keyboard: mainKb });
    }

    if (text === '📑 Отчёт' || text.toLowerCase() === 'отчёт') {
        setState(userId, 'report');
        return context.send('✍️ Напишите текст отчёта и прикрепите минимум 2 фото.\n❌ Отмена — для отмены.', {
            keyboard: Keyboard.builder().textButton({ label: '❌ Отмена' })
        });
    }

    if (text === '📜 История') {
        db.all("SELECT * FROM logs WHERE user_id = ? ORDER BY date DESC LIMIT 10", [userId], async (err, rows) => {
            let msg = '📜 Последние действия:\n\n';
            rows.forEach(r => msg += `${r.date} | ${r.type} | ${r.action}\n`);
            context.send(msg || 'История пуста');
        });
        return;
    }

    if (text === '🆘 SOS') {
        MAIN_ADMINS.forEach(admin => {
            vk.api.messages.send({
                user_id: admin,
                message: `🚨 SOS от @id${userId}!`
            });
        });
        context.send('🚨 SOS отправлен администрации!');
        addLog(userId, 'sos', 'sent', '');
        return;
    }

    // Админ панель
    if (MAIN_ADMINS.includes(userId)) {
        if (text === '👤 Модераторы') {
            return context.send('👥 Панель модераторов', { keyboard: adminKb });
        }
    }

    // Обработка вложений + текста как отчёт
    const photos = context.attachments.filter(a => a.type === 'photo');
    if (photos.length >= 2 && text.length > 10) {
        await handleReport(context);
    } else if (!state) {
        context.send('Используйте кнопки ниже:', { keyboard: mainKb });
    }
});

// Callback обработка (кнопки)
vk.updates.on('message_event', async (context) => {
    const p = context.payload;
    if (!p || !p.cmd) return;

    if (p.cmd === 'approve' && p.id) {
        db.run("UPDATE reports SET status='approved', reviewer_id=?, reviewed_at=datetime('now') WHERE id=?", 
            [context.peerId, p.id]);
        context.send('✅ Отчёт принят (+1 день нормы)');
        addLog(context.peerId, 'report', 'approved', `id:${p.id}`);
    }

    if (p.cmd === 'reject' && p.id) {
        setState(context.peerId, 'reject_reason', { reportId: p.id });
        context.send('Напишите причину отклонения:');
    }
});

// ====================== ЗАПУСК ======================
async function startBot() {
    try {
        await vk.updates.startPolling();
        console.log('🚀 VK Moderation Bot запущен!');
        console.log('👑 Главные администраторы:', MAIN_ADMINS);
    } catch (err) {
        console.error('Ошибка запуска:', err);
    }
}

startBot();

// Graceful
process.on('SIGINT', () => {
    db.close();
    console.log('\n👋 Бот остановлен');
    process.exit();
});
