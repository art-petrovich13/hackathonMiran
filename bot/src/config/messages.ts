export const MESSAGES = {
  // Приветствие
  welcome: (name: string) => 
    `👋 Добро пожаловать, ${name}!\n\n` +
    `Для начала работы необходимо зарегистрироваться.`,
  
  welcomeBack: (name: string, role: string) => 
    `👋 С возвращением, ${name}!\n` +
    `🎖️ Должность: ${getRoleName(role)}`,

  // Регистрация
  enterFio: '📝 Введите ваше ФИО:',
  
  selectRole: '👔 Выберите вашу должность:',
  
  selectWorkshop: '🏭 Выберите номер цеха, которым вы руководите:',
  
  registrationComplete: (fio: string, role: string) =>
    `✅ Регистрация завершена!\n\n` +
    `👤 ФИО: ${fio}\n` +
    `👔 Должность: ${getRoleName(role)}`,

  // Проверяющий
  inspectorMenu: '📋 Выберите действие:',
  
  scheduleWeek: '📅 Расписание на неделю:',
  
  scheduleMonth: '📅 Расписание на месяц:',
  
  enterTime: (workshop: number, supervisorName: string) =>
    `⏰ Введите время проверки для цеха ${workshop}\n` +
    `Руководитель: ${supervisorName}\n\n` +
    `Формат: ЧЧ:ММ (например, 14:30)`,
  
  timeProposed: (time: string) =>
    `✅ Время ${time} отправлено руководителю на согласование`,
  
  invalidTime: '❌ Неверный формат времени. Используйте формат ЧЧ:ММ (например, 14:30)',

  // Менеджер
  managerMenu: '🎯 Меню менеджера:',
  
  generatedSchedule: '📊 Сгенерировано новое расписание:',
  
  editScheduleInstruction: 
    `✏️ Для изменения расписания отправьте текст в формате:\n` +
    `День Цех Фамилия\n\n` +
    `Например:\n` +
    `Понедельник 1 Иванов\n` +
    `Вторник 3 Петрова`,
  
  scheduleApproved: '✅ Расписание утверждено и отправлено всем проверяющим!',
  
  scheduleUpdated: '✅ Расписание обновлено',

  // Руководитель цеха
  supervisorMenu: '🏭 Меню руководителя цеха:',
  
  timeConfirmation: (inspector: string, time: string, date: string) =>
    `⏰ Проверяющий ${inspector} предлагает проверку:\n` +
    `📅 Дата: ${date}\n` +
    `🕐 Время: ${time}\n\n` +
    `Подтверждаете?`,
  
  timeConfirmed: (inspector: string) =>
    `✅ Время согласовано с проверяющим ${inspector}`,
  
  timeRejected: '❌ Время отклонено. Введите удобное для вас время в формате ЧЧ:ММ:',
  
  newTimeProposed: (time: string, inspector: string) =>
    `✅ Предложено новое время ${time} для проверяющего ${inspector}`,

  // Ошибки
  error: '❌ Произошла ошибка. Попробуйте еще раз.',
  
  userNotFound: '❌ Пользователь не найден. Используйте /start для регистрации.',
  
  noSchedule: '❌ Расписание пока не составлено.',
};

export const ROLES = {
  inspector: 'Проверяющий',
  manager: 'Менеджер',
  supervisor: 'Руководитель цеха'
};

function getRoleName(role: string): string {
  return ROLES[role as keyof typeof ROLES] || role;
}

export const WORKSHOPS = [1, 2, 3, 4, 5];