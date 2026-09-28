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
import { loadUsers, getUser, updateUser } from './utils/database';

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

// --- Обработка фотографий ---
bot.on('photo', async (ctx) => {
  const userId = ctx.chat.id; // For private chats, chat.id is user.id
  const user = getUser(userId);

  if (!user) return;

  // Handle inspection photos for inspectors
  if (user.role === 'inspector' && user.currentStep === 'awaiting_photos') {
    const photo = ctx.message.photo[ctx.message.photo.length - 1]; // Largest
    const fileId = photo.file_id;

    const photos = user.tempData.photos || [];
    photos.push(fileId);

    // For inspection, ask for comment after first photo
    if (!user.tempData.commentAsked) {
      await bot.telegram.sendMessage(userId, '📝 Оставьте комментарий по фото(фоткам):');
      updateUser(userId, {
        currentStep: 'awaiting_comment',
        tempData: { ...user.tempData, photos, commentAsked: true }
      });
    } else {
      // Update photos array
      updateUser(userId, {
        tempData: { ...user.tempData, photos }
      });
    }
    return;
  }

  // Handle breakdown photos for supervisors
  if (user.role === 'supervisor' && user.currentStep === 'awaiting_breakdown_photos') {
    const photo = ctx.message.photo[ctx.message.photo.length - 1]; // Largest
    const fileId = photo.file_id;

    const photos = user.tempData.photos || [];
    photos.push(fileId);

    // For breakdown, ask for comment after first photo
    if (!user.tempData.commentAsked) {
      await bot.telegram.sendMessage(userId, '📝 Опишите, что произошло:');
      updateUser(userId, {
        currentStep: 'awaiting_breakdown_comment',
        tempData: { ...user.tempData, photos, commentAsked: true }
      });
    } else {
      // Update photos array
      updateUser(userId, {
        tempData: { ...user.tempData, photos }
      });
    }
    return;
  }

  const photo = ctx.message.photo[ctx.message.photo.length - 1]; // Largest
  const fileId = photo.file_id;

  const photos = user.tempData.photos || [];
  photos.push(fileId);

  // Analyze photo
  const violationDetected = await analyzePhoto(fileId, user.tempData.pendingQuestion);

  if (violationDetected) {
    // Proceed to comment
    await bot.telegram.sendMessage(userId, '✅ Нарушение выявлено на фото. 📝 Оставьте комментарий по фото(фоткам):');
    updateUser(userId, {
      currentStep: 'awaiting_comment',
      tempData: { ...user.tempData, photos, commentAsked: true }
    });
  } else {
    const attempt = user.tempData.attempt || 1;
    if (attempt === 1) {
      await bot.telegram.sendMessage(userId, '❌ Нарушение не выявлено на фото. Пожалуйста, сфотографируйте нарушение заново.');
      updateUser(userId, {
        tempData: { ...user.tempData, photos: [], attempt: 2 }
      });
    } else {
      // Second attempt failed
      await bot.telegram.sendMessage(userId, '❌ Нарушение не выявлено на фото повторно. 📝 Оставьте комментарий:');
      updateUser(userId, {
        currentStep: 'awaiting_comment',
        tempData: { ...user.tempData, photos, aiComment: 'Нарушение не найдено на фото', commentAsked: true }
      });
    }
  }
});

// --- ENDPOINT ДЛЯ ЗАГРУЗКИ ФОТО ---
app.post('/upload', upload.array('photos', 10), async (req, res) => {
  console.log('📸 Получен запрос на загрузку фото');

  const chatId = req.body.chatId;
  const mode = req.query.mode as string;
  const files = req.files as Express.Multer.File[];

  if (!chatId) {
    console.error('❌ chatId не указан');
    return res.status(400).json({ error: 'chatId обязателен' });
  }

  if (!files || files.length === 0) {
    console.error('❌ Файлы не загружены');
    return res.status(400).json({ error: 'Нет файлов' });
  }

  console.log(`📦 Получено ${files.length} файлов для пользователя ${chatId}, mode: ${mode}`);

  const user = getUser(parseInt(chatId));
  const isInspection = user && user.role === 'inspector' && user.currentStep === 'awaiting_photos';
  const isBreakdown = user && user.role === 'supervisor' && user.currentStep === 'awaiting_breakdown_photos';

  try {
    if (!isInspection) {
      await bot.telegram.sendMessage(
        chatId,
        `📸 Получено ${files.length} фото, начинаю анализ...`
      );
    }

    const sentPhotos = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const filePath = path.resolve(file.path);

      console.log(`📤 Отправка фото ${i + 1}/${files.length}: ${file.originalname}`);

      const sentMessage = await bot.telegram.sendPhoto(
        chatId,
        { source: filePath },
        { caption: `📸 ${file.originalname}` }
      );

      sentPhotos.push(sentMessage.photo[sentMessage.photo.length - 1].file_id);

      fs.unlinkSync(filePath);
    }

    if (isInspection) {
      // Handle inspection photo analysis
      const violationDetected = true; // Mock
      if (violationDetected) {
        await bot.telegram.sendMessage(chatId, '✅ Нарушение выявлено на фото. 📝 Оставьте комментарий по фото(фоткам):');
        updateUser(parseInt(chatId), {
          currentStep: 'awaiting_comment',
          tempData: { ...user.tempData, photos: sentPhotos, commentAsked: true }
        });
      } else {
        const attempt = user.tempData.attempt || 1;
        if (attempt === 1) {
          await bot.telegram.sendMessage(chatId, '❌ Нарушение не выявлено на фото. Пожалуйста, сфотографируйте нарушение заново.');
          updateUser(parseInt(chatId), {
            tempData: { ...user.tempData, photos: [], attempt: 2 }
          });
        } else {
          await bot.telegram.sendMessage(chatId, '❌ Нарушение не выявлено на фото повторно. 📝 Оставьте комментарий:');
          updateUser(parseInt(chatId), {
            currentStep: 'awaiting_comment',
            tempData: { ...user.tempData, photos: sentPhotos, aiComment: 'Нарушение не найдено на фото', commentAsked: true }
          });
        }
      }
    } else if (isBreakdown) {
      // Handle breakdown photos
      await bot.telegram.sendMessage(chatId, '📝 Опишите, что произошло:');
      updateUser(parseInt(chatId), {
        currentStep: 'awaiting_breakdown_comment',
        tempData: { ...user.tempData, photos: sentPhotos, commentAsked: true }
      });
    } else {
      await bot.telegram.sendMessage(
        chatId,
        '✅ Все фото получены и проанализированы!\n\n' +
        '💡 Можете начать новую смену командой /start'
      );
    }

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

// --- AI Photo Analysis ---
async function analyzePhoto(fileId: string, questionId: string): Promise<boolean> {
  // Mock analysis - in real implementation, use AI vision API
  // For demo, always detect violation to test flow
  const detected = true; // Math.random() < 0.8;
  console.log(`AI Analysis for ${questionId}: violation ${detected ? 'detected' : 'not detected'}`);
  return detected;
}

export { bot };