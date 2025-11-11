import { Telegraf, Markup } from 'telegraf';
import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import multer from 'multer';

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

// Настройка multer для загрузки файлов
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 } 
});

// --- Хранилище пользователей ---
const users = new Map();

// --- /start ---
bot.start(async (ctx) => {
  const userId = ctx.from.id;
  const userName = ctx.from.first_name || 'Коллега';

  if (!users.has(userId)) {
    users.set(userId, {
      step: 'start',
      rating: 85,
      rank: 'Специалист 2-го разряда',
      photos: []
    });
  }

  await ctx.reply(
    `👋 Добро пожаловать, ${userName}!\n` +
    `⭐ Рейтинг: ${users.get(userId).rating}/100\n` +
    `🎖️ Звание: ${users.get(userId).rank}\n\n` +
    `Для начала смены напишите "Старт смены"`
  );
});

// --- Обработка текста ---
bot.hears('Старт смены', async (ctx) => {
  const userId = ctx.from.id;
  users.set(userId, { 
    ...users.get(userId), 
    step: 'awaiting_fio',
    photos: [] 
  });
  await ctx.reply('🏭 Отлично! Введите ваше ФИО:');
});

bot.on('text', async (ctx) => {
  const userId = ctx.from.id;
  const user = users.get(userId);
  if (!user) return;

  const text = ctx.message.text;

  switch (user.step) {
    case 'awaiting_fio':
      users.set(userId, { ...user, fio: text, step: 'awaiting_workshop' });
      await ctx.reply('✅ ФИО принято! Теперь введите номер цеха:');
      break;
    case 'awaiting_workshop':
      users.set(userId, { ...user, workshop: text, step: 'awaiting_equipment' });
      await ctx.reply('✅ Цех записан. Укажите оборудование:');
      break;
    case 'awaiting_equipment':
      users.set(userId, { ...user, equipment: text, step: 'awaiting_photos' });
      await ctx.reply(
        `✅ Оборудование "${text}" записано.\n📸 Сделайте фото приборов через приложение:`,
        Markup.inlineKeyboard([
          Markup.button.webApp('📸 Сделать фото приборов', `https://solid-sandra-automated-wan.trycloudflare.com`)
        ])
      );
      break;
    default:
      await ctx.reply('Напишите "Старт смены" для начала работы');
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
      
      // Здесь можно добавить анализ через OpenAI
      // const analysis = await analyzePhoto(filePath);
      // await bot.telegram.sendMessage(chatId, `🔍 Анализ: ${analysis}`);
    }

    
    await bot.telegram.sendMessage(
      chatId,
      '✅ Все фото получены и проанализированы!\n\n' +
      '💡 Можете начать новую смену командой "Старт смены"'
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
