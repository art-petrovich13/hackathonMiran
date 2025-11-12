import { Context, Markup } from 'telegraf';
import { getUser, createUser, updateUser } from '../utils/database';
import { MESSAGES, WORKSHOPS } from '../config/messages';

export async function handleStart(ctx: Context) {
  const userId = ctx.from!.id;
  const firstName = ctx.from!.first_name || 'Пользователь';
  
  let user = getUser(userId);
  
  // Проверяем, зарегистрирован ли пользователь
  if (!user) {
    user = createUser(userId, firstName);
    await ctx.reply(
      MESSAGES.welcome(firstName),
      Markup.keyboard([
        [Markup.button.text('🚀 Начать регистрацию')]
      ]).resize()
    );
    return;
  }
  
  // Если пользователь зарегистрирован
  if (user.role) {
    await showMainMenu(ctx, user);
    return;
  }
  
  // Если регистрация не завершена
  await ctx.reply(
    MESSAGES.welcome(firstName),
    Markup.keyboard([
      [Markup.button.text('🚀 Начать регистрацию')]
    ]).resize()
  );
}

async function showMainMenu(ctx: Context, user: any) {
  const roleName = user.role === 'inspector' ? 'Проверяющий' :
                   user.role === 'manager' ? 'Менеджер' : 'Руководитель цеха';
  
  await ctx.reply(
    MESSAGES.welcomeBack(user.fio || user.firstName, roleName)
  );
  
  // Показываем меню в зависимости от роли
  switch (user.role) {
    case 'inspector':
      await ctx.reply(
        MESSAGES.inspectorMenu,
        Markup.keyboard([
          ['📅 Расписание на неделю', '📅 Расписание на 2 недели'],
          ['⏰ Согласовать время', '📸 Начать проверку']
        ]).resize()
      );
      break;
      
    case 'manager':
      await ctx.reply(
        MESSAGES.managerMenu,
        Markup.keyboard([
          ['📅 Расписание', '👥 Сотрудники'],
          ['📊 Отчеты']
        ]).resize()
      );
      break;
      
    case 'supervisor':
      await ctx.reply(
        MESSAGES.supervisorMenu,
        Markup.keyboard([
          ['📅 Мое расписание', '⏰ Запросы на согласование'],
          ['🔧 Запрос о поломке', '⚠️ Недочеты']
        ]).resize()
      );
      break;
  }
}

export async function handleRegistration(ctx: Context) {
  const userId = ctx.from!.id;
  const user = getUser(userId);

  if (!user) {
    await handleStart(ctx);
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

  // Начало регистрации
  if (input === '🚀 Начать регистрацию') {
    updateUser(userId, { currentStep: 'awaiting_fio' });
    await ctx.reply(MESSAGES.enterFio, Markup.removeKeyboard());
    return;
  }

  // Ввод ФИО
  if (user.currentStep === 'awaiting_fio') {
    updateUser(userId, {
      fio: input,
      currentStep: 'awaiting_role'
    });
    
    await ctx.reply(
      MESSAGES.selectRole,
      Markup.keyboard([
        ['👷 Проверяющий'],
        ['👔 Менеджер'],
        ['🏭 Руководитель цеха']
      ]).resize()
    );
    return;
  }
  
  // Выбор роли
  if (user.currentStep === 'awaiting_role') {
    let role: 'inspector' | 'manager' | 'supervisor' | undefined;

    const lowerInput = input.toLowerCase();
    if (input === '👷 Проверяющий' || lowerInput.includes('проверяющий')) {
      role = 'inspector';
    } else if (input === '👔 Менеджер' || lowerInput.includes('менеджер')) {
      role = 'manager';
    } else if (input === '🏭 Руководитель цеха' || lowerInput.includes('руководитель')) {
      role = 'supervisor';
    }

    if (!role) {
      await ctx.reply('❌ Выберите роль из предложенных вариантов или введите название роли');
      return;
    }
    
    // Если руководитель цеха - выбираем цех
    if (role === 'supervisor') {
      updateUser(userId, { 
        role,
        currentStep: 'awaiting_workshop'
      });
      
      await ctx.reply(
        MESSAGES.selectWorkshop,
        Markup.keyboard(
          WORKSHOPS.map((w, i) => [`🏭 ${w}`])
        ).resize()
      );
      return;
    }
    
    // Для остальных ролей - завершаем регистрацию
    updateUser(userId, { 
      role,
      currentStep: undefined
    });
    
    await ctx.reply(
      MESSAGES.registrationComplete(user.fio!, role),
      Markup.removeKeyboard()
    );
    
    const updatedUser = getUser(userId);
    await showMainMenu(ctx, updatedUser);
    return;
  }
  
  // Выбор цеха для руководителя
  if (user.currentStep === 'awaiting_workshop') {
    const trimmedInput = input.trim();
    const workshopIndex = WORKSHOPS.findIndex(w => trimmedInput.includes(w));
    if (workshopIndex === -1) {
      await ctx.reply('❌ Выберите отделение из предложенных вариантов');
      return;
    }

    const workshop = workshopIndex + 1;
    
    updateUser(userId, { 
      workshop,
      currentStep: undefined
    });
    
    await ctx.reply(
      MESSAGES.registrationComplete(user.fio!, user.role!),
      Markup.removeKeyboard()
    );
    
    const updatedUser = getUser(userId);
    await showMainMenu(ctx, updatedUser);
  }
}