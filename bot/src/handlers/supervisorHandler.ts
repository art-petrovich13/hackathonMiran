import { Context, Markup } from 'telegraf';
import { getUser, updateUser, getSchedule, getAllManagers } from '../utils/database';
import { MESSAGES, getWorkshopName } from '../config/messages';
import { bot } from '../index';

export async function handleSupervisorFlow(ctx: Context) {
  const userId = ctx.from!.id;
  const user = getUser(userId);

  if (!user || user.role !== 'supervisor') {
    await ctx.reply(MESSAGES.userNotFound);
    return;
  }

  let input = '';
  if (ctx.callbackQuery) {
    input = (ctx.callbackQuery as any).data || '';
    await ctx.answerCbQuery();
  } else if ('text' in ctx.message!) {
    input = ctx.message!.text;
  } else {
    return; // No input
  }

  // Показать расписание
  if (input === '📅 Мое расписание') {
    await showSupervisorSchedule(ctx);
    return;
  }

  // Запросы на согласование
  if (input === '⏰ Запросы на согласование') {
    await ctx.reply('📋 Активные запросы отображаются автоматически при их поступлении');
    return;
  }

  // Запрос о поломке
  if (input === '🔧 Запрос о поломке') {
    await startBreakdownRequest(ctx);
    return;
  }

  // Недочеты
  if (input === '⚠️ Недочеты') {
    await showDeficiencies(ctx);
    return;
  }

  // Обработка callback кнопок
  if (ctx.callbackQuery) {
    const data = (ctx.callbackQuery as any).data;
    if (data && data.startsWith('meeting_')) {
      await handleMeetingCallback(ctx);
      return;
    }
    await handleCallback(ctx);
    return;
  }

  // Обработка ввода времени после отклонения
  if (user.currentStep === 'proposing_new_time') {
    await handleNewTimeProposal(ctx);
    return;
  }

  // Обработка альтернативного времени встречи
  if (user.currentStep === 'awaiting_alternative_time') {
    await handleAlternativeTime(ctx);
    return;
  }

  // Обработка запроса о поломке
  if (user.currentStep === 'awaiting_breakdown_photos') {
    await handleBreakdownPhotos(ctx);
    return;
  }

  if (user.currentStep === 'awaiting_breakdown_comment') {
    await handleBreakdownComment(ctx);
    return;
  }
}

async function showSupervisorSchedule(ctx: Context) {
  const userId = ctx.from!.id;
  const user = getUser(userId);
  if (!user) {
  await ctx.reply(MESSAGES.userNotFound);
  return;
}
  const schedule = getSchedule();
  
  if (schedule.week.length === 0) {
    await ctx.reply(MESSAGES.noSchedule);
    return;
  }
  
  let message = `📅 *Расписание проверок для ${getWorkshopName(user.workshop!)}:*\n\n`;
  let hasAssignments = false;
  
  schedule.week.forEach(day => {
    const workshopAssignments = day.assignments.filter(
      a => a.workshop === user.workshop
    );
    
    if (workshopAssignments.length > 0) {
      hasAssignments = true;
      message += `📌 *${day.day}, ${day.date}*\n`;
      
      workshopAssignments.forEach(assignment => {
        const status = assignment.status === 'confirmed' ? '✅' : 
                      assignment.status === 'rejected' ? '❌' : '⏳';
        const time = assignment.confirmedTime ? ` в ${assignment.confirmedTime}` : '';
        message += `   👷 ${assignment.inspector}${time} ${status}\n`;
      });
      
      message += '\n';
    }
  });
  
  if (!hasAssignments) {
    await ctx.reply(`❌ Проверок для ${getWorkshopName(user.workshop!)} не запланировано`);
    return;
  }
  
  await ctx.reply(message, { parse_mode: 'Markdown' });
}

async function startBreakdownRequest(ctx: Context) {
  const userId = ctx.from!.id;
  const user = getUser(userId);

  if (!user?.workshop) return;

  updateUser(userId, { currentStep: 'awaiting_breakdown_photos', tempData: { photos: [] } });

  await ctx.reply(
    '🔧 Запрос о поломке/нарушении\n\n📸 Откройте мини-приложение для фотографирования:',
    Markup.inlineKeyboard([
      Markup.button.webApp(
        '📸 Сделать фото поломки/нарушения',
        'https://solar-athletics-nested-advertisements.trycloudflare.com'
      )
    ])
  );
}

async function handleBreakdownPhotos(ctx: Context) {
  // This will be called when photos are received
  // For now, photos are handled in the main photo handler in index.ts
  // We'll set awaiting_breakdown_comment when first photo is received
}

async function handleBreakdownComment(ctx: Context) {
  const userId = ctx.from!.id;
  const user = getUser(userId);
  let input = '';
  if ('text' in ctx.message!) {
    input = ctx.message!.text;
  } else {
    return;
  }

  const tempData = user?.tempData;
  if (!tempData?.photos || !Array.isArray(tempData.photos)) return;

  // Send to all managers
  const managers = getAllManagers();
  const workshopName = getWorkshopName(user?.workshop || 0);

  for (const manager of managers) {
    try {
      let message = `🔧 *Запрос о поломке/нарушении*\n\n`;
      message += `🏭 Цех: ${workshopName}\n`;
      message += `👤 Руководитель: ${user?.fio || user?.firstName}\n`;
      message += `📝 Описание: ${input}\n\n`;
      message += `📸 Прикреплены фотографии нарушения`;

      await bot.telegram.sendMessage(manager.telegramId, message, { parse_mode: 'Markdown' });

      // Send photos
      for (const photoId of tempData.photos) {
        try {
          await bot.telegram.sendPhoto(manager.telegramId, photoId, {
            caption: `🔧 Фото поломки/нарушения от ${user?.fio || user?.firstName}`
          });
        } catch (error) {
          console.error('Ошибка отправки фото менеджеру:', error);
        }
      }
    } catch (error) {
      console.error('Ошибка отправки запроса менеджеру:', error);
    }
  }

  await ctx.reply('✅ Запрос о поломке отправлен всем менеджерам');
  updateUser(userId, { currentStep: undefined, tempData: undefined });
}

async function handleCallback(ctx: Context) {
  const callbackQuery = ctx.callbackQuery!;
  
  if (!('data' in callbackQuery)) return;
  
  const data = callbackQuery.data;
  const userId = ctx.from!.id;
  const user = getUser(userId);
  if (!user) {
  await ctx.reply(MESSAGES.userNotFound);
  return;
}
  
  // Подтверждение времени
  if (data.startsWith('confirm_time_')) {
    const parts = data.split('_');
    const inspectorId = parseInt(parts[2]);
    const time = parts[3];
    
    // Обновляем расписание
    const schedule = getSchedule();
    const today = new Date().toLocaleDateString('ru-RU');
    const todaySchedule = schedule.week.find(day => day.date === today);
    
    if (todaySchedule) {
      const assignment = todaySchedule.assignments.find(
        a => a.workshop === user.workshop && a.inspectorId === inspectorId
      );
      
      if (assignment) {
        assignment.confirmedTime = time;
        assignment.status = 'confirmed';
      }
    }
    
    // Уведомляем проверяющего
    try {
      await bot.telegram.sendMessage(
        inspectorId,
        MESSAGES.timeConfirmed(user.fio || user.firstName)
      );
      
      await ctx.editMessageText(
        `✅ Время ${time} подтверждено для проверяющего`,
        { parse_mode: 'Markdown' }
      );
      
    } catch (error) {
      console.error('Ошибка отправки подтверждения:', error);
    }
    
    await ctx.answerCbQuery('✅ Время подтверждено');
    return;
  }
  
  // Отклонение времени
  if (data.startsWith('reject_time_')) {
    const parts = data.split('_');
    const inspectorId = parseInt(parts[2]);
    
    updateUser(userId, {
      currentStep: 'proposing_new_time',
      tempData: { inspectorId }
    });
    
    await ctx.editMessageText(
      MESSAGES.timeRejected,
      { parse_mode: 'Markdown' }
    );
    
    await ctx.answerCbQuery('❌ Время отклонено');
    return;
  }
}

async function handleNewTimeProposal(ctx: Context) {
  const userId = ctx.from!.id;
  const user = getUser(userId);
  if (!user) {
  await ctx.reply(MESSAGES.userNotFound);
  return;
}
  let input = '';
  if (ctx.callbackQuery) {
    input = (ctx.callbackQuery as any).data || '';
  } else if ('text' in ctx.message!) {
    input = ctx.message!.text;
  } else {
    return; // No input
  }

  // Проверка формата времени
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

  if (!timeRegex.test(input)) {
    await ctx.reply(MESSAGES.invalidTime);
    return;
  }
  
  const inspectorId = user.tempData?.inspectorId;
  
  if (!inspectorId) {
    await ctx.reply(MESSAGES.error);
    return;
  }
  
  // Отправляем новое предложение проверяющему
  try {
    await bot.telegram.sendMessage(
      inspectorId,
      `⏰ Руководитель ${getWorkshopName(user.workshop!)} (${user.fio}) предлагает новое время: ${input}`,
      Markup.inlineKeyboard([
        [
          Markup.button.callback('✅ Согласен', `confirm_time_${inspectorId}_${input}`),
          Markup.button.callback('❌ Не подходит', `reject_time_${inspectorId}_${input}`)
        ]
      ])
    );

    await ctx.reply(
      MESSAGES.newTimeProposed(input, user.fio || user.firstName),
      Markup.keyboard([
        ['📅 Мое расписание', '⏰ Запросы на согласование']
      ]).resize()
    );
    
    updateUser(userId, {
      currentStep: undefined,
      tempData: undefined
    });
    
  } catch (error) {
    console.error('Ошибка отправки предложения:', error);
    await ctx.reply(MESSAGES.error);
  }
}

async function handleMeetingCallback(ctx: Context) {
 const callbackQuery = ctx.callbackQuery!;
 const data = (callbackQuery as any).data;
 const userId = ctx.from!.id;
 const user = getUser(userId);

 const parts = data.split('_');
 const action = parts[1];
 const managerId = parseInt(parts[2]);

 if (action === 'accept') {
   // Notify manager
   try {
     await bot.telegram.sendMessage(managerId, `✅ ${user?.fio || user?.firstName} согласился на встречу`);
     await ctx.editMessageText('✅ Вы согласились на встречу');
   } catch (error) {
     console.error('Ошибка уведомления менеджера:', error);
   }
 } else if (action === 'decline') {
   // Ask for alternative time
   updateUser(userId, { currentStep: 'awaiting_alternative_time', tempData: { managerId } });
   await ctx.editMessageText('❌ Встреча отклонена. Предложите альтернативное время:');
 }

 await ctx.answerCbQuery();
}

async function showDeficiencies(ctx: Context) {
 const userId = ctx.from!.id;
 const user = getUser(userId);

 if (!user?.workshop) return;

 // Get recent inspection data or use example deficiencies
 const deficiencies = [
   {
     date: '10.11.2025',
     item: 'На полу отсутствует пыль, грязь',
     location: 'Укладчик-упаковщик оператора ЦП',
     comment: 'Обнаружена пыль и мусор на полу'
   },
   {
     date: '10.11.2025',
     item: 'Личные вещи отсутствуют в рабочей зоне',
     location: 'Стол наладчика участка',
     comment: 'Найдены личные вещи на рабочем столе'
   },
   {
     date: '09.11.2025',
     item: 'Тара, упаковочные материалы размещены правильно',
     location: 'Зона упаковки',
     comment: 'Материалы размещены не по разметке'
   }
 ];

 let message = `⚠️ *Недочеты по цеху ${getWorkshopName(user.workshop)}:*\n\n`;

 deficiencies.forEach((def, index) => {
   message += `${index + 1}. 📅 ${def.date}\n`;
   message += `   🔍 ${def.item}\n`;
   message += `   📍 ${def.location}\n`;
   message += `   💬 ${def.comment}\n`;
   message += `   ❌ *Требует исправления*\n\n`;
 });

 message += `💡 *Рекомендации:*\n`;
 message += `• Устраните выявленные нарушения\n`;
 message += `• Соблюдайте стандарты чистоты и порядка\n`;
 message += `• Следите за правильным размещением материалов\n`;

 await ctx.reply(message, { parse_mode: 'Markdown' });
}

async function handleAlternativeTime(ctx: Context) {
 const userId = ctx.from!.id;
 const user = getUser(userId);
 let input = '';
 if ('text' in ctx.message!) {
   input = ctx.message!.text;
 } else {
   return;
 }

 const managerId = user?.tempData?.managerId;
 if (!managerId) return;

 // Send alternative proposal to manager
 try {
   await bot.telegram.sendMessage(
     managerId,
     `📅 ${user?.fio || user?.firstName} предлагает альтернативное время: ${input}`,
     Markup.inlineKeyboard([
       [
         Markup.button.callback('✅ Согласен', `meeting_accept_${userId}`),
         Markup.button.callback('❌ Отклонить', `meeting_decline_${userId}`)
       ]
     ])
   );

   updateUser(userId, { currentStep: undefined, tempData: undefined });
   await ctx.reply('✅ Альтернативное предложение отправлено.');
 } catch (error) {
   console.error('Ошибка отправки альтернативного предложения:', error);
   await ctx.reply('❌ Ошибка отправки предложения');
 }
}