import { Context, Markup } from 'telegraf';
import { getUser, updateUser, getSchedule, updateSchedule, getSupervisorByWorkshop, loadChecklist, getInspection, saveInspection, generateInspectionReport } from '../utils/database';
import { MESSAGES, getWorkshopName } from '../config/messages';
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


  // Согласовать время
  if (input === '⏰ Согласовать время') {
    await startTimeCoordination(ctx);
    return;
  }

  // Начать проверку
  if (input === '📸 Начать проверку') {
    await startInspection(ctx);
    return;
  }

  // Обработка выбора дня
  if (user.currentStep === 'selecting_day') {
    await handleDaySelection(ctx);
    return;
  }

  // Обработка ввода времени
  if (user.currentStep === 'awaiting_time') {
    await handleTimeInput(ctx);
    return;
  }

  // Обработка callback кнопок
  if (ctx.callbackQuery) {
    const data = (ctx.callbackQuery as any).data;
    if (data.startsWith('meeting_')) {
      await handleMeetingCallback(ctx);
      return;
    }
    await handleInspectorCallback(ctx);
    return;
  }

  // Обработка фотографий нарушения
  if (user.currentStep === 'awaiting_photos') {
    // Photos handled in bot.on('photo')
    return;
  }

  // Обработка комментария
  if (user.currentStep === 'awaiting_comment') {
    await handleComment(ctx);
    return;
  }

  // Обработка альтернативного времени встречи
  if (user.currentStep === 'awaiting_alternative_time') {
    await handleAlternativeTime(ctx);
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
    '📅 *Ваше расписание на 2 недели:*\n\n';
  
  scheduleData.forEach(day => {
    const myAssignments = day.assignments.filter(a => a.inspectorId === userId);
    
    if (myAssignments.length > 0) {
      message += `📌 *${day.day}, ${day.date}*\n`;
      
      myAssignments.forEach(assignment => {
        const status = assignment.status === 'confirmed' ? '✅' : 
                      assignment.status === 'rejected' ? '❌' : '⏳';
        const time = assignment.confirmedTime ? ` в ${assignment.confirmedTime}` : '';
        message += `   🏭 ${getWorkshopName(assignment.workshop)}${time} ${status}\n`;
      });
      
      message += '\n';
    }
  });
  
  await ctx.reply(message, { parse_mode: 'Markdown' });
}

async function startTimeCoordination(ctx: Context) {
  const userId = ctx.from!.id;
  const schedule = getSchedule();

  // Находим дни с заданиями для проверяющего в ближайшей неделе
  const availableDays = schedule.week.filter(day => {
    const dayDate = new Date(day.date.split('.').reverse().join('-'));
    const today = new Date();
    const diffTime = dayDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 7 && day.assignments.some(a => a.inspectorId === userId);
  });

  if (availableDays.length === 0) {
    await ctx.reply('❌ В ближайшей неделе нет заданий для согласования времени');
    return;
  }

  updateUser(userId, { currentStep: 'selecting_day' });

  let message = '📅 Выберите день для согласования времени:\n\n';
  const keyboard = [];

  availableDays.forEach((day, index) => {
    const myAssignment = day.assignments.find(a => a.inspectorId === userId);
    if (myAssignment) {
      message += `${index + 1}. ${day.day}, ${day.date} - ${getWorkshopName(myAssignment.workshop)}\n`;
      keyboard.push([`${index + 1}`]);
    }
  });

  keyboard.push(['❌ Отменить']);

  await ctx.reply(message, Markup.keyboard(keyboard).resize());
}

async function handleDaySelection(ctx: Context) {
  const userId = ctx.from!.id;
  const user = getUser(userId);
  let input = '';
  if ('text' in ctx.message!) {
    input = ctx.message!.text;
  } else {
    return;
  }

  if (input === '❌ Отменить') {
    updateUser(userId, { currentStep: undefined });
    await ctx.reply(
      '❌ Согласование времени отменено',
      Markup.keyboard([
        ['📅 Расписание на неделю', '📅 Расписание на 2 недели'],
        ['⏰ Согласовать время', '📸 Начать проверку']
      ]).resize()
    );
    return;
  }

  const num = parseInt(input);
  if (isNaN(num)) return;

  const schedule = getSchedule();
  const availableDays = schedule.week.filter(day => {
    const dayDate = new Date(day.date.split('.').reverse().join('-'));
    const today = new Date();
    const diffTime = dayDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 7 && day.assignments.some(a => a.inspectorId === userId);
  });

  const selectedDay = availableDays[num - 1];
  if (!selectedDay) return;

  const myAssignment = selectedDay.assignments.find(a => a.inspectorId === userId);
  if (!myAssignment) return;

  const supervisor = getSupervisorByWorkshop(myAssignment.workshop);
  if (!supervisor) {
    await ctx.reply(`❌ Руководитель ${getWorkshopName(myAssignment.workshop)} не найден`);
    return;
  }

  updateUser(userId, {
    currentStep: 'awaiting_time',
    tempData: {
      workshop: myAssignment.workshop,
      supervisorId: supervisor.telegramId,
      date: selectedDay.date
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
        ['📅 Расписание на неделю', '📅 Расписание на 2 недели'],
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

async function startInspection(ctx: Context) {
  const userId = ctx.from!.id;
  const user = getUser(userId);
  if (!user) return;

  const schedule = getSchedule();
  const today = new Date().toLocaleDateString('ru-RU');
  const todaySchedule = schedule.week.find(day => day.date === today);

  if (!todaySchedule) {
    await ctx.reply('❌ Сегодня нет заданий в расписании');
    return;
  }

  const myAssignment = todaySchedule.assignments.find(a => a.inspectorId === userId);

  if (!myAssignment) {
    await ctx.reply('❌ Сегодня у вас нет назначенных проверок');
    return;
  }

  // Confirm workshop
  await ctx.reply(
    `🏭 Проверить цех ${getWorkshopName(myAssignment.workshop)}?`,
    Markup.inlineKeyboard([
      [
        Markup.button.callback('✅ Да', `start_inspection_${myAssignment.workshop}`),
        Markup.button.callback('❌ Нет', 'cancel_inspection')
      ]
    ])
  );
}

async function handleInspectorCallback(ctx: Context) {
  const callbackQuery = ctx.callbackQuery!;
  const userId = ctx.from!.id;
  const user = getUser(userId);
  if (!user) return;

  if (!('data' in callbackQuery)) return;

  const data = callbackQuery.data;
  const schedule = getSchedule();

  // Start inspection confirmation
  if (data.startsWith('start_inspection_')) {
    const workshop = parseInt(data.split('_')[2]);
    const questions = loadChecklist();
    const date = new Date().toLocaleDateString('ru-RU');

    updateUser(userId, {
      currentStep: 'inspecting',
      tempData: {
        workshop,
        currentQuestion: 0,
        answers: [],
        date
      }
    });

    await askQuestion(ctx, questions[0]);
    await ctx.answerCbQuery();
    return;
  }

  if (data === 'cancel_inspection') {
    await ctx.editMessageText('❌ Проверка отменена');
    await ctx.answerCbQuery();
    return;
  }

  // Question answers
  if (data.startsWith('complies_')) {
    const questionId = data.split('_')[1];
    await handleAnswer(ctx, questionId, true);
    await ctx.answerCbQuery();
    return;
  }

  if (data.startsWith('non_complies_')) {
    const questionId = data.split('_')[1];
    await handleNonCompliance(ctx, questionId);
    await ctx.answerCbQuery();
    return;
  }

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

async function askQuestion(ctx: Context, question: any) {
  await ctx.reply(
    `❓ ${question.criterion}`,
    Markup.inlineKeyboard([
      [
        Markup.button.callback('✅ Соответствует', `complies_${question.id}`),
        Markup.button.callback('❌ Не соответствует', `non_complies_${question.id}`)
      ]
    ])
  );
}

async function handleAnswer(ctx: Context, questionId: string, complies: boolean) {
  const userId = ctx.from!.id;
  const user = getUser(userId);
  if (!user || !user.tempData) return;

  const answers = user.tempData.answers || [];
  answers.push({ questionId, complies });

  const questions = loadChecklist();
  const currentQuestion = user.tempData.currentQuestion + 1;

  if (currentQuestion < questions.length) {
    updateUser(userId, {
      tempData: { ...user.tempData, answers, currentQuestion }
    });
    await askQuestion(ctx, questions[currentQuestion]);
  } else {
    // Finish inspection
    await finishInspection(ctx, answers);
  }
}

async function handleNonCompliance(ctx: Context, questionId: string) {
  const userId = ctx.from!.id;
  const user = getUser(userId);
  if (!user) return;

  const answers = user.tempData.answers || [];
  answers.push({ questionId, complies: false, photos: [], comment: '' });

  // Send mini app link
  await ctx.reply(
    '📸 Зафиксируйте нарушение с помощью мини-приложения:',
    Markup.inlineKeyboard([
      Markup.button.webApp(
        '📸 Сделать фото нарушения',
        'https://solar-athletics-nested-advertisements.trycloudflare.com'
      )
    ])
  );

  updateUser(userId, {
    currentStep: 'awaiting_photos',
    tempData: {
      ...user.tempData,
      answers,
      pendingQuestion: questionId,
      photos: [],
      commentAsked: false,
      attempt: 1
    }
  });
}

async function handleComment(ctx: Context) {
  const userId = ctx.from!.id;
  const user = getUser(userId);
  if (!user || !user.tempData) return;

  let input = '';
  if ('text' in ctx.message!) {
    input = ctx.message!.text;
  } else {
    return;
  }

  const answers = user.tempData.answers || [];
  const pendingQuestion = user.tempData.pendingQuestion;
  const answer = answers.find((a: any) => a.questionId === pendingQuestion);
  if (answer) {
    const aiComment = user.tempData.aiComment ? `\nAI: ${user.tempData.aiComment}` : '';
    answer.comment = input + aiComment;
  }

  // Go to next question
  const questions = loadChecklist();
  const currentQuestion = user.tempData.currentQuestion + 1;

  if (currentQuestion < questions.length) {
    updateUser(userId, {
      currentStep: 'inspecting',
      tempData: { ...user.tempData, answers, currentQuestion, pendingQuestion: undefined }
    });
    await askQuestion(ctx, questions[currentQuestion]);
  } else {
    await finishInspection(ctx, answers);
  }
}

async function finishInspection(ctx: Context, answers: any[]) {
  const userId = ctx.from!.id;
  const user = getUser(userId);
  if (!user || !user.tempData) return;

  const questions = loadChecklist();
  const sectionScores: { [key: string]: number } = {};
  const sections = [...new Set(questions.map(q => q.section))];

  sections.forEach(section => {
    const sectionQuestions = questions.filter(q => q.section === section);
    const sectionAnswers = answers.filter(a => sectionQuestions.some(q => q.id === a.questionId));
    const score = sectionAnswers.filter(a => a.complies).length;
    sectionScores[section] = score;
  });

  const totalSections = sections.length;
  const finalScore = totalSections > 0 ? Object.values(sectionScores).reduce((a, b) => a + b, 0) / totalSections : 0;

  const inspection: any = {
    inspectorId: userId,
    workshop: user.tempData.workshop,
    date: user.tempData.date,
    answers,
    sectionScores,
    finalScore
  };

  saveInspection(inspection);

  // Generate and send report
  const reportBuffer = generateInspectionReport(inspection);
  await ctx.replyWithDocument(
    { source: reportBuffer, filename: `report_${user.tempData.date}.xlsx` },
    { caption: '✅ Отчет по проверке готов! Для получения итоговой оценки разрешите редактирование файла.' }
  );

  // Save report to file
  const fs = require('fs');
  const path = require('path');
  const reportsDir = path.join(__dirname, '../data/reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  const reportPath = path.join(reportsDir, `report_${inspection.inspectorId}_${inspection.date}.xlsx`);
  fs.writeFileSync(reportPath, reportBuffer);

  updateUser(userId, { currentStep: undefined, tempData: undefined });
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
