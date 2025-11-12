import { Context, Markup } from 'telegraf';
import { 
  getUser, 
  updateUser, 
  getSchedule, 
  updateSchedule, 
  generateWeekSchedule,
  generateMonthSchedule,
  getAllInspectors
} from '../utils/database';
import { MESSAGES } from '../config/messages';
import { bot } from '../index';

export async function handleManagerFlow(ctx: Context) {
  const userId = ctx.from!.id;
  const user = getUser(userId);

  if (!user || user.role !== 'manager') {
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

  // Сгенерировать расписание
  if (input === '📊 Сгенерировать расписание') {
    await generateSchedule(ctx);
    return;
  }

  // Показать текущее расписание
  if (input === '📋 Текущее расписание') {
    await showCurrentSchedule(ctx);
    return;
  }

  // Редактировать расписание
  if (input === '✏️ Редактировать расписание') {
    await startScheduleEdit(ctx);
    return;
  }

  // Утвердить расписание
  if (input === '✅ Утвердить расписание') {
    await approveSchedule(ctx);
    return;
  }

  // Обработка редактирования расписания
  if (user.currentStep === 'editing_schedule') {
    await handleScheduleEdit(ctx);
    return;
  }
}

async function generateSchedule(ctx: Context) {
  const weekSchedule = generateWeekSchedule();
  const monthSchedule = generateMonthSchedule();
  
  updateSchedule({
    week: weekSchedule,
    month: monthSchedule,
    currentWeekApproved: false
  });
  
  await ctx.reply(MESSAGES.generatedSchedule);
  await showScheduleForManager(ctx, weekSchedule);
}

async function showCurrentSchedule(ctx: Context) {
  const schedule = getSchedule();
  
  if (schedule.week.length === 0) {
    await ctx.reply(MESSAGES.noSchedule);
    return;
  }
  
  await showScheduleForManager(ctx, schedule.week);
}

async function showScheduleForManager(ctx: Context, weekSchedule: any[]) {
  let message = '📅 *Расписание на неделю:*\n\n';
  
  weekSchedule.forEach(day => {
    message += `📌 *${day.day}, ${day.date}*\n`;
    
    day.assignments.forEach((assignment: any) => {
      message += `   🏭 Цех ${assignment.workshop} → ${assignment.inspector}\n`;
    });
    
    message += '\n';
  });
  
  await ctx.reply(message, { parse_mode: 'Markdown' });
}

async function startScheduleEdit(ctx: Context) {
  const userId = ctx.from!.id;
  
  updateUser(userId, { currentStep: 'editing_schedule' });
  
  await ctx.reply(
    MESSAGES.editScheduleInstruction,
    Markup.keyboard([
      ['❌ Отменить редактирование']
    ]).resize()
  );
}

async function handleScheduleEdit(ctx: Context) {
  const userId = ctx.from!.id;
  let input = '';
  if (ctx.callbackQuery) {
    input = (ctx.callbackQuery as any).data || '';
  } else if ('text' in ctx.message!) {
    input = ctx.message!.text;
  } else {
    return; // No input
  }

  if (input === '❌ Отменить редактирование') {
    updateUser(userId, { currentStep: undefined });
    await ctx.reply(
      MESSAGES.managerMenu,
      Markup.keyboard([
        ['📊 Сгенерировать расписание', '📋 Текущее расписание'],
        ['✏️ Редактировать расписание', '✅ Утвердить расписание']
      ]).resize()
    );
    return;
  }

  // Парсинг изменений
  const lines = input.split('\n').filter(l => l.trim());
  const schedule = getSchedule();
  const inspectors = getAllInspectors();
  
  let changes = 0;
  
  for (const line of lines) {
    // Формат: День Цех Фамилия
    const match = line.match(/(\S+)\s+(\d+)\s+(.+)/);
    
    if (!match) continue;
    
    const [, dayName, workshopStr, inspectorName] = match;
    const workshop = parseInt(workshopStr);
    
    // Находим день в расписании
    const day = schedule.week.find(d => 
      d.day.toLowerCase().includes(dayName.toLowerCase())
    );
    
    if (!day) continue;
    
    // Находим проверяющего
    const inspector = inspectors.find(i => 
      i.fio?.toLowerCase().includes(inspectorName.toLowerCase())
    );
    
    if (!inspector) continue;
    
    // Обновляем назначение
    const assignment = day.assignments.find(a => a.workshop === workshop);
    
    if (assignment) {
      assignment.inspector = inspector.fio || inspector.firstName;
      assignment.inspectorId = inspector.telegramId;
      changes++;
    }
  }
  
  if (changes > 0) {
    updateSchedule(schedule);
    
    await ctx.reply(
      `${MESSAGES.scheduleUpdated}\nИзменено назначений: ${changes}`,
      Markup.keyboard([
        ['📊 Сгенерировать расписание', '📋 Текущее расписание'],
        ['✏️ Редактировать расписание', '✅ Утвердить расписание']
      ]).resize()
    );
    
    updateUser(userId, { currentStep: undefined });
  } else {
    await ctx.reply('❌ Не удалось применить изменения. Проверьте формат.');
  }
}

async function approveSchedule(ctx: Context) {
  const schedule = getSchedule();
  
  if (schedule.week.length === 0) {
    await ctx.reply(MESSAGES.noSchedule);
    return;
  }
  
  updateSchedule({ currentWeekApproved: true });
  
  // Отправляем расписание всем проверяющим
  const inspectors = getAllInspectors();
  
  for (const inspector of inspectors) {
    try {
      let message = '📅 *Новое расписание на неделю:*\n\n';
      
      schedule.week.forEach(day => {
        const myAssignments = day.assignments.filter(
          a => a.inspectorId === inspector.telegramId
        );
        
        if (myAssignments.length > 0) {
          message += `📌 *${day.day}, ${day.date}*\n`;
          myAssignments.forEach(assignment => {
            message += `   🏭 Цех ${assignment.workshop}\n`;
          });
          message += '\n';
        }
      });
      
      await bot.telegram.sendMessage(
        inspector.telegramId,
        message,
        { parse_mode: 'Markdown' }
      );
      
    } catch (error) {
      console.error(`Ошибка отправки расписания проверяющему ${inspector.telegramId}:`, error);
    }
  }
  
  await ctx.reply(MESSAGES.scheduleApproved);
}