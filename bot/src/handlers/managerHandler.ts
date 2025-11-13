import { Context, Markup } from 'telegraf';
import {
  getUser,
  updateUser,
  createUser,
  getSchedule,
  updateSchedule,
  generateWeekSchedule,
  generateMonthSchedule,
  getAllInspectors,
  getAllManagers,
  getAllSupervisors,
  generateInspectionReport,
  getLatestInspection
} from '../utils/database';
import { MESSAGES, getWorkshopName, WORKSHOPS, ROLES } from '../config/messages';
import { User } from '../utils/database';
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

  // Расписание submenu
  if (input === '📅 Расписание') {
    await showScheduleMenu(ctx);
    return;
  }

  // Сотрудники submenu
  if (input === '👥 Сотрудники') {
    await showEmployeesMenu(ctx);
    return;
  }

  // Отчеты
  if (input === '📊 Отчеты') {
    await ctx.reply(
      'Выберите тип отчета:',
      Markup.keyboard([
        ['📊 Отчеты за неделю', '📈 Аналитика'],
        ['🔮 Прогноз', '⬅️ Назад']
      ]).resize()
    );
    return;
  }

  // Отчеты за неделю
  if (input === '📊 Отчеты за неделю') {
    await sendWeekReports(ctx);
    return;
  }

  // Аналитика
  if (input === '📈 Аналитика') {
    await ctx.reply(
      '📈 Открыть аналитику:',
      Markup.inlineKeyboard([
        Markup.button.webApp(
          '📈 Просмотр аналитики',
          'https://solar-athletics-nested-advertisements.trycloudflare.com/dashboards'
        )
      ])
    );
    return;
  }

  // Прогноз
  if (input === '🔮 Прогноз') {
    await ctx.reply(
      '🔮 Открыть прогноз:',
      Markup.inlineKeyboard([
        Markup.button.webApp(
          '🔮 Просмотр прогноза',
          'https://solar-athletics-nested-advertisements.trycloudflare.com/breakdowns'
        )
      ])
    );
    return;
  }

  // Назад
  if (input === '⬅️ Назад') {
    await showMainMenu(ctx);
    return;
  }

  // Schedule submenu options
  if (input === '📊 Сгенерировать расписание') {
    await generateSchedule(ctx);
    return;
  }

  if (input === '📋 Текущее расписание') {
    await showCurrentSchedule(ctx);
    return;
  }

  if (input === '✏️ Редактировать расписание') {
    await startScheduleEdit(ctx);
    return;
  }

  if (input === '✅ Утвердить расписание') {
    await approveSchedule(ctx);
    return;
  }

  // Employees submenu options
  if (input === '👥 Текущие сотрудники') {
    await showCurrentEmployees(ctx);
    return;
  }

  if (input === '➕ Изменить состав') {
    await startEmployeeManagement(ctx);
    return;
  }

  if (input === '📞 Связь с сотрудниками') {
    await showEmployeesForCommunication(ctx);
    return;
  }

  // Back buttons
  if (input === '⬅️ Назад') {
    await ctx.reply(
      MESSAGES.managerMenu,
      Markup.keyboard([
        ['📅 Расписание', '👥 Сотрудники'],
        ['📊 Отчеты']
      ]).resize()
    );
    return;
  }

  // Обработка редактирования расписания
  if (user.currentStep === 'editing_schedule') {
    await handleScheduleEdit(ctx);
    return;
  }

  // Обработка callback кнопок
  if (ctx.callbackQuery) {
    const data = (ctx.callbackQuery as any).data;
    if (data && data.startsWith('meeting_')) {
      await handleMeetingCallback(ctx);
      return;
    }
  }

  // Обработка управления сотрудниками
  if (user.currentStep === 'awaiting_employee_action') {
    await handleEmployeeAction(ctx);
    return;
  }

  if (user.currentStep === 'awaiting_employee_name') {
    await handleAddEmployeeName(ctx);
    return;
  }

  if (user.currentStep === 'awaiting_employee_position') {
    await handleAddEmployeePosition(ctx);
    return;
  }

  if (user.currentStep === 'awaiting_employee_removal') {
    await handleRemoveEmployee(ctx);
    return;
  }

  if (user.currentStep === 'awaiting_supervisor_workshop') {
    await handleSupervisorWorkshop(ctx);
    return;
  }

  if (user.currentStep === 'awaiting_password') {
    await handlePasswordCheck(ctx);
    return;
  }

  if (user.currentStep === 'awaiting_employee_selection') {
    await handleEmployeeSelection(ctx);
    return;
  }

  if (user.currentStep === 'awaiting_meeting_time') {
    await handleMeetingTimeProposal(ctx);
    return;
  }

  if (user.currentStep === 'awaiting_meeting_response') {
    await handleMeetingResponse(ctx);
    return;
  }

  if (user.currentStep === 'awaiting_alternative_time') {
    await handleAlternativeTime(ctx);
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
      message += `   🏭 ${getWorkshopName(assignment.workshop)} → ${assignment.inspector}\n`;
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
    await showScheduleMenu(ctx);
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
        ['✏️ Редактировать расписание', '✅ Утвердить расписание'],
        ['⬅️ Назад']
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
  const managers = getAllManagers();
  const supervisors = getAllSupervisors();

  const allUsers = [...inspectors, ...managers, ...supervisors];

  for (const user of allUsers) {
    try {
      let message = '📅 *Новое утвержденное расписание на 2 недели:*\n\n';

      if (user.role === 'inspector') {
        schedule.week.forEach(day => {
          const myAssignments = day.assignments.filter(
            a => a.inspectorId === user.telegramId
          );

          if (myAssignments.length > 0) {
            message += `📌 *${day.day}, ${day.date}*\n`;
            myAssignments.forEach(assignment => {
              message += `   🏭 ${getWorkshopName(assignment.workshop)}\n`;
            });
            message += '\n';
          }
        });
      } else if (user.role === 'supervisor') {
        schedule.week.forEach(day => {
          const workshopAssignments = day.assignments.filter(
            a => a.workshop === user.workshop
          );

          if (workshopAssignments.length > 0) {
            message += `📌 *${day.day}, ${day.date}*\n`;
            workshopAssignments.forEach(assignment => {
              message += `   👷 ${assignment.inspector}\n`;
            });
            message += '\n';
          }
        });
      } else {
        // Manager - show full schedule
        schedule.week.forEach(day => {
          message += `📌 *${day.day}, ${day.date}*\n`;

          day.assignments.forEach(assignment => {
            message += `   🏭 ${getWorkshopName(assignment.workshop)} → ${assignment.inspector}\n`;
          });

          message += '\n';
        });
      }

      await bot.telegram.sendMessage(
        user.telegramId,
        message,
        { parse_mode: 'Markdown' }
      );

    } catch (error) {
      console.error(`Ошибка отправки расписания пользователю ${user.telegramId}:`, error);
    }
  }

  await ctx.reply(MESSAGES.scheduleApproved);
}

async function sendWeekReports(ctx: Context) {
  const fs = require('fs');
  const path = require('path');
  const reportsDir = path.join(__dirname, '../data/reports');

  if (!fs.existsSync(reportsDir)) {
    await ctx.reply('❌ Отчеты не найдены');
    return;
  }

  const files: string[] = fs.readdirSync(reportsDir).filter((f: string) => f.startsWith('report_') && f.endsWith('.xlsx'));
  if (files.length === 0) {
    await ctx.reply('❌ Отчеты за неделю не найдены');
    return;
  }

  // Sort by date descending
  files.sort((a, b) => {
    const dateA = a.split('_')[2].split('.')[0];
    const dateB = b.split('_')[2].split('.')[0];
    return new Date(dateB.split('.').reverse().join('-')).getTime() - new Date(dateA.split('.').reverse().join('-')).getTime();
  });

  // Send the latest report
  const latestFile = files[0];
  const filePath = path.join(reportsDir, latestFile);
  const buffer = fs.readFileSync(filePath);

  const parts = latestFile.split('_');
  const date = parts[2].replace('.xlsx', '');
  const workshop = parts[1]; // Assuming inspectorId is workshop or something, but actually it's inspectorId

  await ctx.replyWithDocument(
    { source: buffer, filename: latestFile },
    { caption: `📊 Последний отчет по проверке от ${date}` }
  );
}

async function showMainMenu(ctx: Context) {
  await ctx.reply(
    MESSAGES.managerMenu,
    Markup.keyboard([
      ['📅 Расписание', '👥 Сотрудники'],
      ['📊 Отчеты']
    ]).resize()
  );
}

async function showScheduleMenu(ctx: Context) {
  await ctx.reply(
    '📅 Меню расписания:',
    Markup.keyboard([
      ['📊 Сгенерировать расписание', '📋 Текущее расписание'],
      ['✏️ Редактировать расписание', '✅ Утвердить расписание'],
      ['⬅️ Назад']
    ]).resize()
  );
}

async function showEmployeesMenu(ctx: Context) {
  await ctx.reply(
    '👥 Меню сотрудников:',
    Markup.keyboard([
      ['👥 Текущие сотрудники'],
      ['➕ Изменить состав'],
      ['📞 Связь с сотрудниками'],
      ['⬅️ Назад']
    ]).resize()
  );
}

async function showCurrentEmployees(ctx: Context) {
  const inspectors = getAllInspectors();
  const managers = getAllManagers();
  const supervisors = getAllSupervisors();

  let message = '👥 *Текущие сотрудники:*\n\n';

  message += '*Менеджеры:*\n';
  managers.forEach(manager => {
    message += `👔 ${manager.fio || manager.firstName}\n`;
  });

  message += '\n*Руководители цехов:*\n';
  supervisors.forEach(supervisor => {
    message += `🏭 ${supervisor.fio || supervisor.firstName} - ${getWorkshopName(supervisor.workshop!)}\n`;
  });

  message += '\n*Проверяющие:*\n';
  inspectors.forEach(inspector => {
    message += `👷 ${inspector.fio || inspector.firstName}\n`;
  });

  await ctx.reply(message, { parse_mode: 'Markdown' });
}

async function startEmployeeManagement(ctx: Context) {
  const userId = ctx.from!.id;
  updateUser(userId, { currentStep: 'awaiting_password' });

  await ctx.reply('🔒 Введите пароль для доступа к управлению сотрудниками:', Markup.removeKeyboard());
}

async function handleEmployeeAction(ctx: Context) {
  const userId = ctx.from!.id;
  let input = '';
  if (ctx.callbackQuery) {
    input = (ctx.callbackQuery as any).data || '';
  } else if ('text' in ctx.message!) {
    input = ctx.message!.text;
  } else {
    return;
  }

  if (input === '➕ Добавить сотрудника') {
    updateUser(userId, { currentStep: 'awaiting_employee_name' });
    await ctx.reply('👤 Введите ФИО нового сотрудника:', Markup.removeKeyboard());
  } else if (input === '➖ Удалить сотрудника') {
    await showEmployeesForRemoval(ctx);
  } else if (input === '⬅️ Назад') {
    await showEmployeesMenu(ctx);
  }
}

async function handleAddEmployeeName(ctx: Context) {
  const userId = ctx.from!.id;
  let input = '';
  if ('text' in ctx.message!) {
    input = ctx.message!.text;
  } else {
    return;
  }

  updateUser(userId, {
    currentStep: 'awaiting_employee_position',
    tempData: { name: input }
  });

  await ctx.reply(
    '👔 Выберите должность:',
    Markup.keyboard([
      ['👷 Проверяющий'],
      ['👔 Менеджер'],
      ['🏭 Руководитель цеха']
    ]).resize()
  );
}

async function handleAddEmployeePosition(ctx: Context) {
  const userId = ctx.from!.id;
  const user = getUser(userId);
  let input = '';
  if ('text' in ctx.message!) {
    input = ctx.message!.text;
  } else {
    return;
  }

  let role: 'inspector' | 'manager' | 'supervisor' | undefined;
  if (input === '👷 Проверяющий') {
    role = 'inspector';
  } else if (input === '👔 Менеджер') {
    role = 'manager';
  } else if (input === '🏭 Руководитель цеха') {
    role = 'supervisor';
  }

  if (!role || !user?.tempData?.name) {
    await ctx.reply('❌ Ошибка. Попробуйте снова.');
    return;
  }

  if (role === 'supervisor') {
    updateUser(userId, {
      currentStep: 'awaiting_supervisor_workshop',
      tempData: { ...user.tempData, role }
    });

    await ctx.reply(
      '🏭 Выберите цех для руководителя:',
      Markup.keyboard(WORKSHOPS.map((w, i) => [`${i + 1}. ${w}`])).resize()
    );
    return;
  }

  // Generate random telegram ID
  const randomId = Math.floor(Math.random() * 100) + 1;

  createUser(randomId, user.tempData.name);
  updateUser(randomId, {
    fio: user.tempData.name,
    role
  });

  updateUser(userId, {
    currentStep: undefined,
    tempData: undefined
  });

  await ctx.reply(
    `✅ Сотрудник ${user.tempData.name} добавлен с ролью ${ROLES[role]}`,
    Markup.keyboard([
      ['📅 Расписание', '👥 Сотрудники'],
      ['📊 Отчеты']
    ]).resize()
  );
}

async function showEmployeesForCommunication(ctx: Context) {
  const userId = ctx.from!.id;
  const inspectors = getAllInspectors();
  const managers = getAllManagers();
  const supervisors = getAllSupervisors();

  updateUser(userId, { currentStep: 'awaiting_employee_selection' });

  let message = '📞 Выберите сотрудника для связи (введите номер):\n\n';
  let employees: User[] = [];

  inspectors.forEach((inspector, index) => {
    message += `${index + 1}. 👷 ${inspector.fio || inspector.firstName}\n`;
    employees.push(inspector);
  });

  managers.forEach((manager, index) => {
    const num = inspectors.length + index + 1;
    message += `${num}. 👔 ${manager.fio || manager.firstName}\n`;
    employees.push(manager);
  });

  supervisors.forEach((supervisor, index) => {
    const num = inspectors.length + managers.length + index + 1;
    message += `${num}. 🏭 ${supervisor.fio || supervisor.firstName} (${getWorkshopName(supervisor.workshop!)})\n`;
    employees.push(supervisor);
  });

  updateUser(userId, { tempData: { employees } });

  await ctx.reply(message, Markup.removeKeyboard());
}

async function showEmployeesForRemoval(ctx: Context) {
  const userId = ctx.from!.id;
  const inspectors = getAllInspectors();
  const managers = getAllManagers();
  const supervisors = getAllSupervisors();

  updateUser(userId, { currentStep: 'awaiting_employee_removal' });

  let message = '➖ Выберите сотрудника для удаления:\n\n';
  let keyboard = [];

  inspectors.forEach((inspector, index) => {
    message += `${index + 1}. 👷 ${inspector.fio || inspector.firstName}\n`;
    keyboard.push([`${index + 1}`]);
  });

  managers.forEach((manager, index) => {
    const num = inspectors.length + index + 1;
    message += `${num}. 👔 ${manager.fio || manager.firstName}\n`;
    keyboard.push([`${num}`]);
  });

  supervisors.forEach((supervisor, index) => {
    const num = inspectors.length + managers.length + index + 1;
    message += `${num}. 🏭 ${supervisor.fio || supervisor.firstName} (${getWorkshopName(supervisor.workshop!)})\n`;
    keyboard.push([`${num}`]);
  });

  keyboard.push(['⬅️ Назад']);

  await ctx.reply(message, Markup.keyboard(keyboard).resize());
}

async function handleRemoveEmployee(ctx: Context) {
  const userId = ctx.from!.id;
  let input = '';
  if ('text' in ctx.message!) {
    input = ctx.message!.text;
  } else {
    return;
  }

  if (input === '⬅️ Назад') {
    await startEmployeeManagement(ctx);
    return;
  }

  const num = parseInt(input);
  if (isNaN(num)) return;

  const inspectors = getAllInspectors();
  const managers = getAllManagers();
  const supervisors = getAllSupervisors();
  let employeeToRemove;

  if (num <= inspectors.length) {
    employeeToRemove = inspectors[num - 1];
  } else if (num <= inspectors.length + managers.length) {
    employeeToRemove = managers[num - inspectors.length - 1];
  } else {
    employeeToRemove = supervisors[num - inspectors.length - managers.length - 1];
  }

  if (employeeToRemove) {
    // Remove by setting role to undefined or deleting
    updateUser(employeeToRemove.telegramId, { role: undefined });
    await ctx.reply(
      `✅ Сотрудник ${employeeToRemove.fio || employeeToRemove.firstName} удален`,
      Markup.keyboard([
        ['📅 Расписание', '👥 Сотрудники'],
        ['📊 Отчеты']
      ]).resize()
    );
  }

  updateUser(userId, { currentStep: undefined });
}

async function handlePasswordCheck(ctx: Context) {
  const userId = ctx.from!.id;
  let input = '';
  if ('text' in ctx.message!) {
    input = ctx.message!.text;
  } else {
    return;
  }

  if (input.toLowerCase() === 'хакатон') {
    updateUser(userId, { currentStep: 'awaiting_employee_action' });
    await ctx.reply(
      '✅ Доступ разрешен. Выберите действие:',
      Markup.keyboard([
        ['➕ Добавить сотрудника'],
        ['➖ Удалить сотрудника'],
        ['⬅️ Назад']
      ]).resize()
    );
  } else {
    updateUser(userId, { currentStep: undefined });
    await ctx.reply(
      '❌ Неверное кодовое слово. Доступ запрещен.',
      Markup.keyboard([
        ['📅 Расписание', '👥 Сотрудники'],
        ['📊 Отчеты']
      ]).resize()
    );
  }
}

async function handleSupervisorWorkshop(ctx: Context) {
  const userId = ctx.from!.id;
  const user = getUser(userId);
  let input = '';
  if ('text' in ctx.message!) {
    input = ctx.message!.text;
  } else {
    return;
  }

  const workshopIndex = WORKSHOPS.findIndex(w => input.includes(w));
  if (workshopIndex === -1) {
    await ctx.reply('❌ Выберите цех из предложенных вариантов');
    return;
  }

  const workshop = workshopIndex + 1;
  const name = user?.tempData?.name;
  const role = user?.tempData?.role;

  if (!name || role !== 'supervisor') {
    await ctx.reply('❌ Ошибка. Попробуйте снова.');
    return;
  }

  // Generate random telegram ID
  const randomId = Math.floor(Math.random() * 100) + 1;

  createUser(randomId, name);
  updateUser(randomId, {
    fio: name,
    role: 'supervisor',
    workshop
  });

  updateUser(userId, {
    currentStep: undefined,
    tempData: undefined
  });

  await ctx.reply(
    `✅ Руководитель цеха ${name} назначен на ${getWorkshopName(workshop)}`,
    Markup.keyboard([
      ['📅 Расписание', '👥 Сотрудники'],
      ['📊 Отчеты']
    ]).resize()
  );
}

async function handleEmployeeSelection(ctx: Context) {
  const userId = ctx.from!.id;
  const user = getUser(userId);
  let input = '';
  if ('text' in ctx.message!) {
    input = ctx.message!.text;
  } else {
    return;
  }

  const num = parseInt(input);
  if (isNaN(num) || !user?.tempData?.employees) {
    await ctx.reply('❌ Введите корректный номер сотрудника');
    return;
  }

  const employees = user.tempData.employees;
  const selectedEmployee = employees[num - 1];

  if (!selectedEmployee) {
    await ctx.reply('❌ Неверный номер сотрудника');
    return;
  }

  updateUser(userId, {
    currentStep: 'awaiting_meeting_time',
    tempData: { selectedEmployee }
  });

  await ctx.reply('📅 Предложите время встречи (например: завтра в 14:00):');
}

async function handleMeetingTimeProposal(ctx: Context) {
  const userId = ctx.from!.id;
  const user = getUser(userId);
  let input = '';
  if ('text' in ctx.message!) {
    input = ctx.message!.text;
  } else {
    return;
  }

  const selectedEmployee = user?.tempData?.selectedEmployee;
  if (!selectedEmployee) return;

  // Send proposal to employee
  try {
    await bot.telegram.sendMessage(
      selectedEmployee.telegramId,
      `📅 ${user?.fio || user?.firstName} предлагает встретиться: ${input}\n\nПодтверждаете?`,
      Markup.inlineKeyboard([
        [
          Markup.button.callback('✅ Согласен', `meeting_accept_${userId}`),
          Markup.button.callback('❌ Отклонить', `meeting_decline_${userId}`)
        ]
      ])
    );

    updateUser(userId, {
      currentStep: 'awaiting_meeting_response',
      tempData: { selectedEmployee, proposedTime: input }
    });

    await ctx.reply('✅ Предложение отправлено. Ожидаем ответа.');
  } catch (error) {
    console.error('Ошибка отправки предложения:', error);
    await ctx.reply('❌ Ошибка отправки предложения');
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

async function handleMeetingResponse(ctx: Context) {
  const userId = ctx.from!.id;
  let input = '';
  if ('text' in ctx.message!) {
    input = ctx.message!.text;
  } else {
    return;
  }

  const tempData = getUser(userId)?.tempData;
  if (!tempData?.selectedEmployee) return;

  // Send counter proposal
  try {
    await bot.telegram.sendMessage(
      tempData.selectedEmployee.telegramId,
      `📅 ${getUser(userId)?.fio || 'Менеджер'} предлагает альтернативное время: ${input}`,
      Markup.inlineKeyboard([
        [
          Markup.button.callback('✅ Согласен', `meeting_accept_${userId}`),
          Markup.button.callback('❌ Отклонить', `meeting_decline_${userId}`)
        ]
      ])
    );

    await ctx.reply('✅ Альтернативное предложение отправлено.');
  } catch (error) {
    console.error('Ошибка отправки альтернативного предложения:', error);
    await ctx.reply('❌ Ошибка отправки предложения');
  }
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

  const employeeId = user?.tempData?.selectedEmployee?.telegramId;
  if (!employeeId) return;

  // Send alternative proposal to employee
  try {
    await bot.telegram.sendMessage(
      employeeId,
      `📅 ${user?.fio || 'Менеджер'} предлагает альтернативное время: ${input}`,
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