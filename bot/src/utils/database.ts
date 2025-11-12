import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SCHEDULE_FILE = path.join(DATA_DIR, 'schedule.json');

// Типы
export interface User {
  telegramId: number;
  firstName: string;
  fio?: string;
  role?: 'inspector' | 'manager' | 'supervisor';
  workshop?: number; // Для руководителей цехов
  currentStep?: string;
  tempData?: any;
}

export interface ScheduleDay {
  date: string;
  day: string;
  assignments: {
    workshop: number;
    inspector: string;
    inspectorId: number;
    confirmedTime?: string;
    status?: 'pending' | 'confirmed' | 'rejected';
  }[];
}

export interface Schedule {
  week: ScheduleDay[];
  month: ScheduleDay[];
  currentWeekApproved: boolean;
}

// Хранилище в памяти
let users: Map<number, User> = new Map();
let schedule: Schedule = {
  week: [],
  month: [],
  currentWeekApproved: false
};

// Создание директории если не существует
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// --- РАБОТА С ПОЛЬЗОВАТЕЛЯМИ ---

export function loadUsers() {
  ensureDataDir();
  if (fs.existsSync(USERS_FILE)) {
    const data = fs.readFileSync(USERS_FILE, 'utf-8');
    const usersArray: User[] = JSON.parse(data);
    users = new Map(usersArray.map(u => [u.telegramId, u]));
    console.log(`✅ Загружено ${users.size} пользователей`);
  } else {
    users = new Map();
    saveUsers();
  }
}

export function saveUsers() {
  ensureDataDir();
  const usersArray = Array.from(users.values());
  fs.writeFileSync(USERS_FILE, JSON.stringify(usersArray, null, 2));
}

export function getUser(telegramId: number): User | undefined {
  return users.get(telegramId);
}

export function createUser(telegramId: number, firstName: string): User {
  const user: User = {
    telegramId,
    firstName,
    currentStep: 'registration'
  };
  users.set(telegramId, user);
  saveUsers();
  return user;
}

export function updateUser(telegramId: number, data: Partial<User>) {
  const user = users.get(telegramId);
  if (user) {
    users.set(telegramId, { ...user, ...data });
    saveUsers();
  }
}

export function getAllInspectors(): User[] {
  return Array.from(users.values()).filter(u => u.role === 'inspector');
}

export function getAllManagers(): User[] {
  return Array.from(users.values()).filter(u => u.role === 'manager');
}

export function getSupervisorByWorkshop(workshop: number): User | undefined {
  return Array.from(users.values()).find(
    u => u.role === 'supervisor' && u.workshop === workshop
  );
}

// --- РАБОТА С РАСПИСАНИЕМ ---

export function loadSchedule() {
  ensureDataDir();
  if (fs.existsSync(SCHEDULE_FILE)) {
    const data = fs.readFileSync(SCHEDULE_FILE, 'utf-8');
    schedule = JSON.parse(data);
    console.log('✅ Расписание загружено');
  } else {
    schedule = {
      week: [],
      month: [],
      currentWeekApproved: false
    };
    saveSchedule();
  }
}

export function saveSchedule() {
  ensureDataDir();
  fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(schedule, null, 2));
}

export function getSchedule(): Schedule {
  return schedule;
}

export function updateSchedule(newSchedule: Partial<Schedule>) {
  schedule = { ...schedule, ...newSchedule };
  saveSchedule();
}

export function generateWeekSchedule(): ScheduleDay[] {
  const inspectors = getAllInspectors();
  const workshops = [1, 2, 3, 4, 5];
  const days = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница'];
  
  const weekSchedule: ScheduleDay[] = [];
  const today = new Date();
  
  // Получаем понедельник текущей недели
  const monday = new Date(today);
  monday.setDate(today.getDate() - today.getDay() + 1);
  
  for (let i = 0; i < 5; i++) {
    const currentDay = new Date(monday);
    currentDay.setDate(monday.getDate() + i);
    
    // Перемешиваем инспекторов для разнообразия
    const shuffledInspectors = [...inspectors].sort(() => Math.random() - 0.5);
    
    const assignments = workshops.map((workshop, idx) => {
      const inspector = shuffledInspectors[idx % shuffledInspectors.length];
      return {
        workshop,
        inspector: inspector.fio || inspector.firstName,
        inspectorId: inspector.telegramId,
        status: 'pending' as const
      };
    });
    
    weekSchedule.push({
      date: currentDay.toLocaleDateString('ru-RU'),
      day: days[i],
      assignments
    });
  }
  
  return weekSchedule;
}

export function generateMonthSchedule(): ScheduleDay[] {
  // Упрощенная версия - 4 недели
  const weekSchedule = generateWeekSchedule();
  const monthSchedule: ScheduleDay[] = [];
  
  for (let week = 0; week < 4; week++) {
    weekSchedule.forEach(day => {
      const date = new Date(day.date.split('.').reverse().join('-'));
      date.setDate(date.getDate() + (week * 7));
      
      monthSchedule.push({
        ...day,
        date: date.toLocaleDateString('ru-RU')
      });
    });
  }
  
  return monthSchedule;
}

// Инициализация при загрузке модуля
loadSchedule();