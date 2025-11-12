import { Telegraf } from 'telegraf';
import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { handleStart, handleRegistration } from './handlers/startHandler';
import { handleInspectorFlow } from './handlers/inspectorHandler';
import { handleManagerFlow } from './handlers/managerHandler';
import { handleSupervisorFlow } from './handlers/supervisorHandler';
import { loadUsers, getUser } from './utils/database';

dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN!;
const PUBLIC_URL = process.env.PUBLIC_URL!;
const PORT = process.env.PORT || 3000;

if (!BOT_TOKEN || !PUBLIC_URL) {
  console.error('❌ BOT_TOKEN и PUBLIC_URL обязательны!');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
const app = express();

// Middleware
app.use(express.json());

// Загрузка пользователей при старте
loadUsers();

// Настройка multer для загрузки файлов
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 } 
});

// --- Команда /start ---
bot.start(async (ctx) => {
  await handleStart(ctx);
});

// --- Обработка callback кнопок ---
bot.on('callback_query', async (ctx) => {
  const userId = ctx.from.id;
  const user = getUser(userId);

  if (!user || !user.role) {
    // Обработка регистрации
    await handleRegistration(ctx);
    return;
  }

  // Маршрутизация по ролям
  switch (user.role) {
    case 'inspector':
      await handleInspectorFlow(ctx);
      break;
    case 'manager':
      await handleManagerFlow(ctx);
      break;
    case 'supervisor':
      await handleSupervisorFlow(ctx);
      break;
  }
});

// --- Обработка текстовых сообщений ---
bot.on('text', async (ctx) => {
  const userId = ctx.from.id;
  const user = getUser(userId);

  if (!user || !user.role) {
    await handleRegistration(ctx);
    return;
  }

  // Маршрутизация по ролям
  switch (user.role) {
    case 'inspector':
      await handleInspectorFlow(ctx);
      break;
    case 'manager':
      await handleManagerFlow(ctx);
      break;
    case 'supervisor':
      await handleSupervisorFlow(ctx);
      break;
  }
});

// --- ENDPOINT ДЛЯ ЗАГРУЗКИ ФОТО ---
app.post('/upload', upload.array('photos', 10), async (req, res) => {
  console.log('📸 Получен запрос на загрузку фото');
  
  const chatId = req.body.chatId;
  const files = req.files as Express.Multer.File[];
  
  if (!chatId) {
    console.error('❌ chatId не указан');
    return res.status(400).json({ error: 'chatId обязателен' });
  }
  
  if (!files || files.length === 0) {
    console.error('❌ Файлы не загружены');
    return res.status(400).json({ error: 'Нет файлов' });
  }

  console.log(`📦 Получено ${files.length} файлов для пользователя ${chatId}`);

  try {
    await bot.telegram.sendMessage(
      chatId, 
      `📸 Получено ${files.length} фото, начинаю анализ...`
    );

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const filePath = path.resolve(file.path);
      
      console.log(`📤 Отправка фото ${i + 1}/${files.length}: ${file.originalname}`);
      
      await bot.telegram.sendPhoto(
        chatId,
        { source: filePath },
        { caption: `📸 ${file.originalname}` }
      );

      fs.unlinkSync(filePath);
    }

    await bot.telegram.sendMessage(
      chatId,
      '✅ Все фото получены и проанализированы!\n\n' +
      '💡 Можете начать новую смену командой /start'
    );

    console.log('✅ Все фото отправлены успешно');
    res.json({ status: 'ok', count: files.length });

  } catch (err) {
    console.error('❌ Ошибка отправки фото:', err);
    res.status(500).json({ error: 'Ошибка отправки фото в Telegram' });
  }
});

// --- Webhook для бота ---
app.use(bot.webhookCallback('/bot'));

app.listen(PORT, async () => {
  console.log(`✅ Server running on port ${PORT}`);
  await bot.telegram.setWebhook(`${PUBLIC_URL}/bot`);
  console.log(`✅ Webhook установлен на: ${PUBLIC_URL}/bot`);
});

export { bot };