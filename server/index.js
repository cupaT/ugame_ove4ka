import express from 'express';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Корень проекта (на уровень выше server/)
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DATA_DIR = process.env.DATA_DIR || path.join(PROJECT_ROOT, 'data');
const FILE = path.join(DATA_DIR, 'participants.json');
const COOKIE_NAME = 'pid';
const PORT = process.env.PORT || 8787;

// Подготовка хранилища
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, '[]', 'utf8');

function loadAll() {
    try { const j = JSON.parse(fs.readFileSync(FILE, 'utf8')); return Array.isArray(j) ? j : []; }
    catch { return []; }
}
function saveAll(arr) { fs.writeFileSync(FILE, JSON.stringify(arr, null, 2), 'utf8'); }
function ensureArray(x) { return Array.isArray(x) ? x : []; }
function getPid(req) {
    const pid = req.cookies?.[COOKIE_NAME];
    return (typeof pid === 'string' && pid.length > 0) ? pid : null;
}

// Нормализация
const DASHES_RE = /[‐‑‒–—―]/g;
const NAME_RE  = /^[A-Za-zА-Яа-яЁё]+(?: [A-Za-zА-Яа-яЁё]+)*$/u;
const GROUP_RE = /^[A-Za-zА-Яа-яЁё0-9]+(?:-[A-Za-zА-Яа-яЁё0-9]+)*$/u;

function sanitizeName(raw, maxLen = 40) {
    let s = String(raw ?? '').trim().slice(0, maxLen);
    if (!s) return { ok: false, reason: 'EMPTY_NAME', value: '' };
    s = s.replace(/\s+/g, ' ').trim();
    if (!NAME_RE.test(s)) return { ok: false, reason: 'BAD_NAME', value: s };
    return { ok: true, value: s };
}
function sanitizeGroup(raw, maxLen = 24) {
    let s = String(raw ?? '').trim().slice(0, maxLen);
    if (!s) return { ok: false, reason: 'EMPTY_GROUP', value: '' };
    s = s.replace(DASHES_RE, '-');
    s = s.replace(/\s+/g, '');
    s = s.replace(/-+/g, '-');
    s = s.toLocaleUpperCase('ru');
    if (!GROUP_RE.test(s)) return { ok: false, reason: 'BAD_GROUP', value: s };
    return { ok: true, value: s };
}

// Уникальность ТОЛЬКО по имени
function normalizeNameKey(name) {
    return sanitizeName(name).value.toLocaleLowerCase('ru');
}

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

/**
 * POST /api/register
 * - Регистрирует нового игрока или выполняет вход, если имя уже занято.
 * - Устанавливает cookie (pid).
 * - Ответ: { name, group, best }
 * - Ошибки: 400 BAD_NAME/BAD_GROUP
 */
app.post('/api/register', (req, res) => {
    const { name, group } = req.body || {};
    const n = sanitizeName(name);
    const g = sanitizeGroup(group);
    if (!n.ok) return res.status(400).json({ error: 'BAD_NAME', reason: n.reason });
    if (!g.ok) return res.status(400).json({ error: 'BAD_GROUP', reason: g.reason });

    const all = ensureArray(loadAll());
    const normalizedName = normalizeNameKey(n.value);

    // Найти существующего игрока (логин по имени)
    let player = all.find(rec => {
        const recNorm = rec.normalizedName || normalizeNameKey(rec.name);
        return recNorm === normalizedName;
    });

    let pid;
    if (player) {
        pid = player.pid;
    } else {
        pid = crypto.randomUUID();
        player = {
            pid,
            name: n.value,
            group: g.value,
            normalizedName,
            best: 0,
            createdAt: Date.now()
        };
        all.push(player);
        saveAll(all);
    }

    res.cookie(COOKIE_NAME, pid, { httpOnly: true, sameSite: 'lax', maxAge: 365*24*3600*1000 });
    res.json({ name: player.name, group: player.group, best: player.best });
});

/**
 * POST /api/submit-score
 * - Сохраняет результат игрока (только best)
 * - Ответ: { best }
 * - Ошибки: 401 NO_SESSION/UNKNOWN_PLAYER
 */
app.post('/api/submit-score', (req, res) => {
    const pid = getPid(req);
    if (!pid) return res.status(401).json({ error: 'NO_SESSION', reason: 'Not logged in' });

    const score = Math.max(0, Math.floor(Number(req.body?.score || 0)));
    const all = ensureArray(loadAll());
    const idx = all.findIndex(x => x.pid === pid);
    if (idx === -1) return res.status(401).json({ error: 'UNKNOWN_PLAYER', reason: 'Unknown player' });

    if (!Number.isFinite(all[idx].best) || score > all[idx].best) {
        all[idx].best = score;
        saveAll(all);
    }
    res.json({ best: all[idx].best });
});

/**
 * GET /api/leaderboard
 * - Возвращает топ игроков и общее число участников
 * - Ответ: { top: [...], total }
 */
app.get('/api/leaderboard', (req, res) => {
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
    const all = ensureArray(loadAll());
    const sorted = [...all].sort((a,b) => (b.best - a.best) || (a.createdAt - b.createdAt));
    const top = sorted.slice(0, limit).map(({ name, group, best }, i) => ({
        rank: i+1, name, group, score: best
    }));
    res.json({ top, total: sorted.length });
});

/**
 * POST /api/logout
 * - Удаляет cookie, всегда возвращает { success: true }
 */
app.post('/api/logout', (req, res) => {
    res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: 'lax' });
    res.json({ success: true });
});

// Статика
app.use(express.static(PROJECT_ROOT, {
    extensions: ['html'],
    setHeaders(res, filePath) {
        if (/\.(svg|png|jpg|css|js)$/.test(filePath)) {
            res.setHeader('Cache-Control', 'public, max-age=3600');
        }
    }
}));

app.get(/^\/(?!api).*/, (_req, res) => {
    res.sendFile(path.join(PROJECT_ROOT, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
    console.log(`Serving static from: ${PROJECT_ROOT}`);
    console.log(`Data file: ${FILE}`);
});