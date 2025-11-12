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
          ['📅 Расписание на неделю', '📅 Расписание на месяц'],
          ['⏰ Согласовать время', '📸 Начать проверку']
        ]).resize()
      );
      break;
      
    case 'manager':
      await ctx.reply(
        MESSAGES.managerMenu,
        Markup.keyboard([
          ['📊 Сгенерировать расписание', '📋 Текущее расписание'],
          ['✏️ Редактировать расписание', '✅ Утвердить расписание']
        ]).resize()
      );
      break;
      
    case 'supervisor':
      await ctx.reply(
        MESSAGES.supervisorMenu,
        Markup.keyboard([
          ['📅 Мое расписание', '⏰ Запросы на согласование']
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
  
  const text = 'text' in ctx.message! ? ctx.message!.text : '';
  
  // Начало регистрации
  if (text === '🚀 Начать регистрацию') {
    updateUser(userId, { currentStep: 'awaiting_fio' });
    await ctx.reply(MESSAGES.enterFio, Markup.removeKeyboard());
    return;
  }
  
  // Ввод ФИО
  if (user.currentStep === 'awaiting_fio') {
    updateUser(userId, { 
      fio: text,
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
    
    if (text === '👷 Проверяющий') {
      role = 'inspector';
    } else if (text === '👔 Менеджер') {
      role = 'manager';
    } else if (text === '🏭 Руководитель цеха') {
      role = 'supervisor';
    }
    
    if (!role) {
      await ctx.reply('❌ Выберите роль из предложенных вариантов');
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
          WORKSHOPS.map(w => [`🏭 Цех ${w}`])
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
    const workshopMatch = text.match(/Цех (\d+)/);
    if (!workshopMatch) {
      await ctx.reply('❌ Выберите цех из предложенных вариантов');
      return;
    }
    
    const workshop = parseInt(workshopMatch[1]);
    
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