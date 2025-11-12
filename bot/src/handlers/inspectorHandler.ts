import { Context, Markup } from 'telegraf';
import { getUser, updateUser, getSchedule, updateSchedule, getSupervisorByWorkshop } from '../utils/database';
import { MESSAGES } from '../config/messages';
import { bot } from '../index';

export async function handleInspectorFlow(ctx: Context) {
  const userId = ctx.from!.id;
  const user = getUser(userId);

  if (!user || user.role !== 'inspector') {
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

  // Показать расписание на неделю
  if (input === '📅 Расписание на неделю') {
    await showSchedule(ctx, 'week');
    return;
  }

  // Показать расписание на месяц
  if (input === '📅 Расписание на месяц') {
    await showSchedule(ctx, 'month');
    return;
  }

  // Согласовать время
  if (input === '⏰ Согласовать время') {
    await startTimeCoordination(ctx);
    return;
  }

  // Начать проверку
  if (input === '📸 Начать проверку') {
    await ctx.reply(
      '📸 Откройте мини-приложение для фотографирования:',
      Markup.inlineKeyboard([
        Markup.button.webApp(
          '📸 Сделать фото приборов',
          'https://comfort-pick-clone-ensuring.trycloudflare.com'
        )
      ])
    );
    return;
  }

  // Обработка ввода времени
  if (user.currentStep === 'awaiting_time') {
    await handleTimeInput(ctx);
    return;
  }

  // Обработка callback кнопок
  if (ctx.callbackQuery) {
    await handleInspectorCallback(ctx);
    return;
  }
}

async function showSchedule(ctx: Context, period: 'week' | 'month') {
  const userId = ctx.from!.id;
  const user = getUser(userId);
  const schedule = getSchedule();
  
  const scheduleData = period === 'week' ? schedule.week : schedule.month;
  
  if (scheduleData.length === 0) {
    await ctx.reply(MESSAGES.noSchedule);
    return;
  }
  
  // Фильтруем только задания для этого проверяющего
  let message = period === 'week' ? 
    '📅 *Ваше расписание на неделю:*\n\n' : 
    '📅 *Ваше расписание на месяц:*\n\n';
  
  scheduleData.forEach(day => {
    const myAssignments = day.assignments.filter(a => a.inspectorId === userId);
    
    if (myAssignments.length > 0) {
      message += `📌 *${day.day}, ${day.date}*\n`;
      
      myAssignments.forEach(assignment => {
        const status = assignment.status === 'confirmed' ? '✅' : 
                      assignment.status === 'rejected' ? '❌' : '⏳';
        const time = assignment.confirmedTime ? ` в ${assignment.confirmedTime}` : '';
        message += `   🏭 Цех ${assignment.workshop}${time} ${status}\n`;
      });
      
      message += '\n';
    }
  });
  
  await ctx.reply(message, { parse_mode: 'Markdown' });
}

async function startTimeCoordination(ctx: Context) {
  const userId = ctx.from!.id;
  const schedule = getSchedule();
  
  // Находим сегодняшнее задание
  const today = new Date().toLocaleDateString('ru-RU');
  const todaySchedule = schedule.week.find(day => day.date === today);
  
  if (!todaySchedule) {
    await ctx.reply('❌ На сегодня нет заданий в расписании');
    return;
  }
  
  const myAssignment = todaySchedule.assignments.find(a => a.inspectorId === userId);
  
  if (!myAssignment) {
    await ctx.reply('❌ На сегодня у вас нет назначенных проверок');
    return;
  }
  
  const supervisor = getSupervisorByWorkshop(myAssignment.workshop);
  
  if (!supervisor) {
    await ctx.reply(`❌ Руководитель цеха ${myAssignment.workshop} не найден`);
    return;
  }
  
  updateUser(userId, { 
    currentStep: 'awaiting_time',
    tempData: {
      workshop: myAssignment.workshop,
      supervisorId: supervisor.telegramId,
      date: today
    }
  });
  
  await ctx.reply(
    MESSAGES.enterTime(myAssignment.workshop, supervisor.fio || supervisor.firstName),
    Markup.removeKeyboard()
  );
}

async function handleTimeInput(ctx: Context) {
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
  
  const tempData = user.tempData;
  
  // Отправляем запрос руководителю
  try {
    await bot.telegram.sendMessage(
      tempData.supervisorId,
      MESSAGES.timeConfirmation(user.fio || user.firstName, input, tempData.date),
      Markup.inlineKeyboard([
        [
          Markup.button.callback('✅ Подтвердить', `confirm_time_${userId}_${input}`),
          Markup.button.callback('❌ Отклонить', `reject_time_${userId}_${input}`)
        ]
      ])
    );

    await ctx.reply(
      MESSAGES.timeProposed(input),
      Markup.keyboard([
        ['📅 Расписание на неделю', '📅 Расписание на месяц'],
        ['⏰ Согласовать время', '📸 Начать проверку']
      ]).resize()
    );
    
    updateUser(userId, { 
      currentStep: undefined,
      tempData: undefined
    });
    
  } catch (error) {
    console.error('Ошибка отправки запроса:', error);
    await ctx.reply(MESSAGES.error);
  }
}

async function handleInspectorCallback(ctx: Context) {
  const callbackQuery = ctx.callbackQuery!;
  const userId = ctx.from!.id;
  const user = getUser(userId);
  if (!user) return;

  if (!('data' in callbackQuery)) return;

  const data = callbackQuery.data;
  const schedule = getSchedule();

  // Подтверждение времени
  if (data.startsWith('confirm_time_')) {
    const parts = data.split('_');
    const inspectorId = parseInt(parts[2]);
    const time = parts[3];

    if (inspectorId !== userId) return;

    const today = new Date().toLocaleDateString('ru-RU');
    const todaySchedule = schedule.week.find(day => day.date === today);

    if (todaySchedule) {
      const assignment = todaySchedule.assignments.find(a => a.inspectorId === userId);
      if (assignment) {
        assignment.confirmedTime = time;
        assignment.status = 'confirmed';
        updateSchedule(schedule);

        // Уведомляем руководителя
        const supervisor = getSupervisorByWorkshop(assignment.workshop);
        if (supervisor) {
          try {
            await bot.telegram.sendMessage(
              supervisor.telegramId,
              `✅ Проверяющий ${user.fio || user.firstName} согласился на время ${time}`
            );
          } catch (error) {
            console.error('Ошибка уведомления руководителя:', error);
          }
        }

        await ctx.editMessageText(`✅ Время ${time} подтверждено`);
      }
    }

    await ctx.answerCbQuery('✅ Время подтверждено');
    return;
  }

  // Отклонение времени
  if (data.startsWith('reject_time_')) {
    const parts = data.split('_');
    const inspectorId = parseInt(parts[2]);
    const time = parts[3];

    if (inspectorId !== userId) return;

    const today = new Date().toLocaleDateString('ru-RU');
    const todaySchedule = schedule.week.find(day => day.date === today);

    if (todaySchedule) {
      const assignment = todaySchedule.assignments.find(a => a.inspectorId === userId);
      if (assignment) {
        // Уведомляем руководителя
        const supervisor = getSupervisorByWorkshop(assignment.workshop);
        if (supervisor) {
          try {
            await bot.telegram.sendMessage(
              supervisor.telegramId,
              `❌ Проверяющий ${user.fio || user.firstName} отклонил предложенное время ${time}`
            );
          } catch (error) {
            console.error('Ошибка уведомления руководителя:', error);
          }
        }

        await ctx.editMessageText(`❌ Предложенное время ${time} отклонено`);
      }
    }

    await ctx.answerCbQuery('❌ Время отклонено');
    return;
  }
}