import { Context, Markup } from 'telegraf';
import { getUser, updateUser, getSchedule } from '../utils/database';
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
    await ctx.reply('🔧 Запрос о поломке пока в разработке');
    return;
  }

  // Недочеты
  if (input === '⚠️ Недочеты') {
    await ctx.reply('⚠️ Недочеты пока в разработке');
    return;
  }

  // Обработка callback кнопок
  if (ctx.callbackQuery) {
    await handleCallback(ctx);
    return;
  }

  // Обработка ввода времени после отклонения
  if (user.currentStep === 'proposing_new_time') {
    await handleNewTimeProposal(ctx);
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