import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as XLSX from 'xlsx';

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

export interface Question {
  id: string;
  criterion: string;
  section: string;
}

export interface InspectionAnswer {
  questionId: string;
  complies: boolean;
  photos?: string[];
  comment?: string;
}

export interface InspectionData {
  inspectorId: number;
  workshop: number;
  date: string;
  answers: InspectionAnswer[];
  sectionScores: { [section: string]: number };
  finalScore: number;
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

export function getAllSupervisors(): User[] {
  return Array.from(users.values()).filter(u => u.role === 'supervisor');
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

  // Track last workshop for each inspector to avoid consecutive same workshop
  const lastWorkshop: { [inspectorId: number]: number } = {};

  for (let i = 0; i < 10; i++) { // 2 weeks = 10 days
    const currentDay = new Date(monday);
    currentDay.setDate(monday.getDate() + i);

    // Shuffle workshops
    const shuffledWorkshops = [...workshops].sort(() => Math.random() - 0.5);

    // Shuffle inspectors
    const shuffledInspectors = [...inspectors].sort(() => Math.random() - 0.5);

    const assignments = [];
    const usedInspectors = new Set<number>();

    for (const workshop of shuffledWorkshops) {
      // Find inspector who didn't check this workshop yesterday and not used today
      let inspector = shuffledInspectors.find(ins =>
        lastWorkshop[ins.telegramId] !== workshop && !usedInspectors.has(ins.telegramId)
      );

      if (!inspector) {
        // If no perfect match, find any unused inspector
        inspector = shuffledInspectors.find(ins => !usedInspectors.has(ins.telegramId));
      }

      if (!inspector) {
        // If still no, skip this workshop (shouldn't happen with equal numbers)
        continue;
      }

      usedInspectors.add(inspector.telegramId);
      lastWorkshop[inspector.telegramId] = workshop;

      assignments.push({
        workshop,
        inspector: inspector.fio || inspector.firstName,
        inspectorId: inspector.telegramId,
        status: 'pending' as const
      });
    }

    weekSchedule.push({
      date: currentDay.toLocaleDateString('ru-RU'),
      day: days[i % 5],
      assignments
    });
  }

  return weekSchedule;
}

export function generateMonthSchedule(): ScheduleDay[] {
  // Now returns the same 2 weeks schedule
  return generateWeekSchedule();
}

// --- РАБОТА С ЧЕК-ЛИСТОМ ---

export function loadChecklist(): Question[] {
  const workbook = XLSX.readFile(path.join(DATA_DIR, 'table1.xlsx'));
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

  const questions: Question[] = [];
  let currentSection = '';

  for (const row of data) {
    if (row[0] && typeof row[0] === 'string' && /^[А-Я]/.test(row[0])) {
      // Section header
      currentSection = row[0].split(' ')[0]; // Take first letter
    } else if (row[0] && typeof row[0] === 'number' && row[1]) {
      // Question row
      questions.push({
        id: `${currentSection}${row[0]}`,
        criterion: row[1],
        section: currentSection
      });
    }
  }

  return questions;
}

// --- РАБОТА С ИНСПЕКЦИЯМИ ---

let inspections: Map<string, InspectionData> = new Map(); // key: inspectorId_date

export function getInspection(inspectorId: number, date: string): InspectionData | undefined {
  return inspections.get(`${inspectorId}_${date}`);
}

export function saveInspection(inspection: InspectionData) {
  inspections.set(`${inspection.inspectorId}_${inspection.date}`, inspection);
}

export function generateInspectionReport(inspection: InspectionData): Buffer {
  const questions = loadChecklist();
  const workbook = XLSX.readFile(path.join(DATA_DIR, 'table1.xlsx'));
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

  // Create a map of questionId to answer
  const answerMap = new Map(inspection.answers.map(a => [a.questionId, a]));

  // Update the data
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (row[0] && typeof row[0] === 'number' && row[1]) {
      const section = row[0] < 10 ? 'А' : row[0] < 20 ? 'В1' : row[0] < 30 ? 'В2' : 'С'; // Approximate
      const questionId = `${section}${row[0]}`;
      const answer = answerMap.get(questionId);
      if (answer) {
        if (answer.complies) {
          row[2] = 1; // соответствует
        } else {
          row[3] = 0; // не соответствует
          row[4] = answer.comment || '';
          // Photos would be attached separately or noted
        }
      }
    } else if (row[1] && row[1].includes('Общий балл за раздел')) {
      const section = row[1].split(' ')[3]; // e.g. "Общий балл за раздел А"
      row[2] = inspection.sectionScores[section] || 0;
    } else if (row[1] && row[1].includes('Итоговая оценка')) {
      row[2] = inspection.finalScore;
    }
  }

  // Write back
  XLSX.utils.sheet_add_json(sheet, data, { skipHeader: true });
  return XLSX.write(workbook, { type: 'buffer' });
}

// Инициализация при загрузке модуля
loadSchedule();