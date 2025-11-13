import { useEffect, useState } from 'react';
import { ChevronLeft, AlertTriangle, Clock, TrendingUp, BarChart3, Wrench, CheckCircle, X, ZoomIn } from 'lucide-react';
import { calculateDeviceRisk, getFacilityRiskLevel } from '../../utils/riskCalculator';
import { facilities as mockFacilities, devices as mockDevices, type Facility, type Device, type ErrorLog, type FacilityWithDevices, type DeviceWithErrors } from '../../data/objects';
import './Breakdowns.scss';

// Новые интерфейсы для улучшенного прогнозирования
interface FailurePrediction {
  probability: number;
  timeframe: 'immediate' | 'short_term' | 'medium_term' | 'long_term';
  confidence: number;
  reasons: string[];
  recommendedActions: string[];
  partsNeeded?: string[];
  estimatedRepairTime: string;
  repairPriority: 'critical' | 'high' | 'medium' | 'low';
  failureType?: string;
  impactAssessment?: string;
}

interface RepairOption {
  id: string;
  name: string;
  description: string;
  estimatedTime: string;
  cost: 'low' | 'medium' | 'high';
  effectiveness: number;
  partsRequired: string[];
  toolsRequired: string[];
  steps: string[];
  specialistRequired?: string;
}

interface DeviceWithErrorsExtended extends DeviceWithErrors {
  failure_prediction?: FailurePrediction;
  imageUrl?: string;
}

interface FacilityWithDevicesExtended extends FacilityWithDevices {
  devices: DeviceWithErrorsExtended[];
}

// URL изображений приборов с соответствующими типами оборудования:
const DEVICE_IMAGES: { [key: string]: string } = {
  // Прессы и гидравлическое оборудование
  'press-1': 'https://i-machine.ru/upload/iblock/72b/0x999frejwhfnvjye39xegzmmfgixj2b.jpg',
  'press-2': 'https://мехтехникс.рф/d/gidravlika.jpg',

  // CNC станки и металлообработка
  'cnc-1': 'https://metall-machinery.ru/upload/medialibrary/4e8/fg9c9li9if7dga3a24cr6gs5ddy2a5w7/TB1bMs4dk9WBuNjSspeXXaz5VXa.jpg',
  'cnc-2': 'https://rustan.ru/sites/default/files/file_attach/16k20-stanok.jpg',

  // Конвейерные системы
  'conveyor-1': 'https://belfirst.by/wp-content/uploads/2023/11/screenshot_4-730x474.jpg',
  'conveyor-2': 'https://www.smttech.ru/upload/iblock/78c/u654ptkgx7b3vg0dnmf3qeij423oqyah/MWN_610XXL.jpg',

  // Смесители и химическое оборудование
  'mixer-1': 'https://katrinmet.ru/assets/images/articles/smesiteli.jpg',
  'mixer-2': 'https://zzbo.ru/wp-content/uploads/2023/03/gruntosmesitel-snd-30-1917-1.jpg',

  // Промышленные печи и термообработка
  'furnace-1': 'https://dprom.online/wp-content/uploads/2020/12/Kamernaya-narevatelnaya-pech-1-1.jpg',
  'furnace-2': 'https://belsklad.by/image/cache/catalog/data/N650_45AS_fmt-1200x900.jpg',

  // Компрессоры и пневматика
  'compressor-1': 'https://live.staticflickr.com/65535/52714069411_d6a102cecf_b.jpg',
  'compressor-2': 'https://www.remeza.com/upload/iblock/6cb/sl_main_0.png',

  // Насосы и гидравлика
  'pump-1': 'https://media.www1.ru/fit-in/744x573/ixbt-data/751248/photo-2025-09-24-134613-68d3afe6f0068.jpeg',


  // Генераторы и энергетика
  'generator-1': 'https://megaliner.by/upload/iblock/763/asvcwq7e81s9zk9sb3xcsulvtwlej2ew/elektrostantsija_benzinovaja_varteg_g950_kitaj_5817_160294_1.jpg',
  'generator-2': 'https://www.pnevmoteh.by/sites/pnevmoteh.by/files/images/qdfqm4qcsu9vc8obgzd3zk2bp240yreo.jpeg',


};

// Функция для получения изображения по типу устройства
function getDeviceImageKey(deviceType: string): string {
  const typeMappings: { [key: string]: string[] } = {
    'press': ['press-1', 'press-2'],
    'cnc': ['cnc-1', 'cnc-2'],
    'mill': ['cnc-1', 'cnc-2'],
    'lathe': ['cnc-1', 'cnc-2'],
    'milling_machine': ['cnc-1', 'cnc-2'],
    'conveyor': ['conveyor-1', 'conveyor-2'],
    'assembly_line': ['conveyor-1', 'conveyor-2'],
    'mixer': ['mixer-1', 'mixer-2'],
    'furnace': ['furnace-1', 'furnace-2'],
    'compressor': ['compressor-1', 'compressor-2'],
    'pump': ['pump-1', 'pump-2'],
    'generator': ['generator-1', 'generator-2'],
    'robot': ['robot-1', 'robot-2'],
    'industrial_robot': ['robot-1', 'robot-2'],
    'packaging': ['packaging-1', 'packaging-2'],
    'packaging_machine': ['packaging-1', 'packaging-2'],
    'palletizer': ['packaging-1', 'packaging-2'],
    'server': ['server-1', 'server-2'],
    'server_rack': ['server-1', 'server-2']
  };

  for (const [key, values] of Object.entries(typeMappings)) {
    if (deviceType.toLowerCase().includes(key)) {
      return values[Math.floor(Math.random() * values.length)];
    }
  }

  // Fallback
  return 'press-1';
}

function Breakdowns() {
  const [facilities, setFacilities] = useState<FacilityWithDevicesExtended[]>([]);
  const [selectedFacility, setSelectedFacility] = useState<FacilityWithDevicesExtended | null>(null);
  const [expandedDeviceId, setExpandedDeviceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [priorityView, setPriorityView] = useState<'all' | 'high' | 'critical'>('all');
  const [chartType, setChartType] = useState<'bars' | 'radar'>('bars');
  const [selectedRepairOption, setSelectedRepairOption] = useState<{ deviceId: string, optionId: string } | null>(null);
  const [confirmedRepairs, setConfirmedRepairs] = useState<{ deviceId: string, optionId: string }[]>([]);
  const [zoomedImage, setZoomedImage] = useState<{ src: string, alt: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const facilitiesData = mockFacilities as Facility[];
      const devicesData = mockDevices as Device[];

      // Генерируем моковые ошибки для демонстрации
      const errorLogsData = generateMockErrorLogs(devicesData);

      const facilitiesWithDevices: FacilityWithDevicesExtended[] = facilitiesData.map(facility => {
        const facilityDevices = devicesData.filter(d => d.facility_id === facility.id);

        const devicesWithErrors: DeviceWithErrorsExtended[] = facilityDevices.map(device => {
          const deviceErrors = errorLogsData.filter(e => e.device_id === device.id);
          const { risk_score, failure_probability } = calculateDeviceRisk(device, deviceErrors);
          const failurePrediction = predictFailure(device, deviceErrors);
          const imageUrl = DEVICE_IMAGES[getDeviceImageKey(device.type)] || DEVICE_IMAGES['press-1']; // fallback image

          return {
            ...device,
            error_logs: deviceErrors,
            risk_score,
            failure_probability,
            failure_prediction: failurePrediction,
            imageUrl
          };
        });

        const risk_level = getFacilityRiskLevel(devicesWithErrors);

        return {
          ...facility,
          devices: devicesWithErrors,
          risk_level
        };
      });

      setFacilities(facilitiesWithDevices);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  // Функция для генерации моковых ошибок
  function generateMockErrorLogs(devices: Device[]): ErrorLog[] {
    const errorLogs: ErrorLog[] = [];
    const errorTypes = ['vibration', 'temperature', 'pressure', 'electrical', 'mechanical', 'software'];
    const errorDescriptions = {
      vibration: 'Превышение допустимого уровня вибрации',
      temperature: 'Критическое значение температуры',
      pressure: 'Отклонение давления от нормы',
      electrical: 'Сбой в электрической системе',
      mechanical: 'Механическая неисправность',
      software: 'Ошибка программного обеспечения'
    };
    const now = new Date();

    devices.forEach(device => {
      // Для каждого устройства генерируем случайное количество ошибок (0-8)
      const errorCount = Math.floor(Math.random() * 8);

      for (let i = 0; i < errorCount; i++) {
        const daysAgo = Math.floor(Math.random() * 60); // Ошибки за последние 60 дней
        const errorDate = new Date(now);
        errorDate.setDate(now.getDate() - daysAgo);

        const severity = Math.floor(Math.random() * 5) + 1; // 1-5
        const errorType = errorTypes[Math.floor(Math.random() * errorTypes.length)];

        errorLogs.push({
          id: `error-${device.id}-${i}`,
          device_id: device.id,
          error_type: errorType,
          severity: severity,
          description: `${errorDescriptions[errorType as keyof typeof errorDescriptions]} на устройстве ${device.name}`,
          reported_at: errorDate.toISOString(),
          resolved_at: severity < 4 ? new Date(errorDate.getTime() + Math.random() * 24 * 60 * 60 * 1000).toISOString() : null,
          resolved_by: severity < 4 ? 'system' : null
        } as ErrorLog);
      }
    });

    return errorLogs.sort((a, b) => new Date(b.reported_at).getTime() - new Date(a.reported_at).getTime());
  }

  // Улучшенная функция прогнозирования поломок с детальным анализом
  function predictFailure(device: Device, errorLogs: ErrorLog[]): FailurePrediction {
    const deviceAge = parseFloat(getDeviceAge(device.manufacture_date));
    const now = new Date();

    // Детальный анализ ошибок за разные периоды
    const last24hErrors = errorLogs.filter(e => {
      const hoursSince = (now.getTime() - new Date(e.reported_at).getTime()) / (1000 * 60 * 60);
      return hoursSince <= 24;
    });

    const recentErrors = errorLogs.filter(e => {
      const daysSince = (now.getTime() - new Date(e.reported_at).getTime()) / (1000 * 60 * 60 * 24);
      return daysSince <= 7;
    });

    const monthlyErrors = errorLogs.filter(e => {
      const daysSince = (now.getTime() - new Date(e.reported_at).getTime()) / (1000 * 60 * 60 * 24);
      return daysSince <= 30;
    });

    // Анализ по типам ошибок
    const criticalErrors = errorLogs.filter(e => e.severity >= 4);
    const vibrationErrors = errorLogs.filter(e => e.error_type === 'vibration');
    const temperatureErrors = errorLogs.filter(e => e.error_type === 'temperature');
    const pressureErrors = errorLogs.filter(e => e.error_type === 'pressure');
    const electricalErrors = errorLogs.filter(e => e.error_type === 'electrical');
    const mechanicalErrors = errorLogs.filter(e => e.error_type === 'mechanical');

    let probability = 0;
    const reasons: string[] = [];
    const recommendedActions: string[] = [];
    const partsNeeded: string[] = [];
    let timeframe: FailurePrediction['timeframe'] = 'long_term';
    let confidence = 0;
    let estimatedRepairTime = "2-4 часа";
    let repairPriority: FailurePrediction['repairPriority'] = 'low';
    let failureType = "Неопределенный";
    let impactAssessment = "Минимальное влияние на производство";

    // Фактор 1: Возраст оборудования и общее состояние
    if (deviceAge > 10) {
      probability += 30;
      reasons.push(`Критический возраст оборудования (${deviceAge} лет) - высокий износ всех компонентов`);
      failureType = "Комплексный износ";
      impactAssessment = "Высокий риск полной остановки оборудования";
    } else if (deviceAge > 8) {
      probability += 25;
      reasons.push(`Оборудование старое (${deviceAge} лет) - повышенный износ компонентов`);
      recommendedActions.push("Провести полную диагностику основных компонентов");
      partsNeeded.push("Подшипники", "Сальники", "Электронные компоненты", "Приводные ремни");
    } else if (deviceAge > 5) {
      probability += 15;
      reasons.push(`Оборудование среднего возраста (${deviceAge} лет) - требуется профилактика`);
      recommendedActions.push("Плановое техническое обслуживание");
    }

    // Фактор 2: Критические ошибки
    if (criticalErrors.length > 3) {
      probability += 35;
      reasons.push(`КРИТИЧЕСКАЯ СИТУАЦИЯ: ${criticalErrors.length} серьезных ошибок за последний период`);
      failureType = "Критический отказ";
      impactAssessment = "НЕМЕДЛЕННАЯ ОСТАНОВКА ПРОИЗВОДСТВА";
      recommendedActions.push("НЕМЕДЛЕННАЯ ОСТАНОВКА И АВАРИЙНЫЙ РЕМОНТ");
      repairPriority = 'critical';
      timeframe = 'immediate';
    } else if (criticalErrors.length > 1) {
      probability += criticalErrors.length * 12;
      reasons.push(`Обнаружено ${criticalErrors.length} критических ошибок - высокий риск отказа`);
      recommendedActions.push("Срочное устранение критических ошибок");
      repairPriority = 'high';
      timeframe = 'short_term';
    }

    // Фактор 3: Частота ошибок и тренды
    if (last24hErrors.length >= 3) {
      probability += 25;
      reasons.push(`АВАРИЙНАЯ СИТУАЦИЯ: ${last24hErrors.length} ошибок за последние 24 часа`);
      failureType = "Ускоренный износ";
      impactAssessment = "Риск катастрофического отказа в ближайшие часы";
    } else if (recentErrors.length >= 5) {
      probability += 25;
      reasons.push(`Экстренная ситуация: ${recentErrors.length} ошибок за 7 дней`);
      recommendedActions.push("Немедленная диагностика и ремонт");
      if (timeframe !== 'immediate') timeframe = 'short_term';
      repairPriority = repairPriority === 'low' ? 'high' : repairPriority;
    } else if (recentErrors.length >= 3) {
      probability += 20;
      reasons.push(`Высокая частота ошибок (${recentErrors.length} за 7 дней)`);
      recommendedActions.push("Провести внеплановое техническое обслуживание");
      if (timeframe !== 'immediate') timeframe = 'short_term';
      repairPriority = repairPriority === 'low' ? 'high' : repairPriority;
    }

    // Фактор 4: Детальный анализ специфических типов ошибок
    if (vibrationErrors.length >= 3) {
      probability += 25;
      reasons.push("ОПАСНО: Сильная вибрация - риск разрушения механических частей и основания");
      failureType = "Механическая неустойчивость";
      impactAssessment = "Риск повреждения смежного оборудования";
      recommendedActions.push("Экстренная проверка балансировки и креплений");
      partsNeeded.push("Амортизаторы", "Противовес", "Опорные подшипники", "Фундаментные болты");
      timeframe = timeframe === 'long_term' ? 'short_term' : timeframe;
    } else if (vibrationErrors.length >= 2) {
      probability += 15;
      reasons.push("Повышенная вибрация указывает на износ механических частей");
      recommendedActions.push("Проверить балансировки и крепления");
      partsNeeded.push("Амортизаторы", "Противовес");
    }

    if (temperatureErrors.length >= 3) {
      probability += 20;
      reasons.push("ОПАСНЫЙ ПЕРЕГРЕВ - риск повреждения электроники и возгорания");
      failureType = "Термический перегруз";
      impactAssessment = "Риск пожара и полного выхода из строя";
      recommendedActions.push("Немедленно проверить систему охлаждения");
      partsNeeded.push("Термодатчики", "Вентиляторы", "Термопаста", "Радиаторы", "Теплоотводы");
    } else if (temperatureErrors.length >= 2) {
      probability += 12;
      reasons.push("Перегрев оборудования - снижение эффективности и ресурса");
      recommendedActions.push("Проверить систему охлаждения и термодатчики");
      partsNeeded.push("Термодатчики", "Вентиляторы", "Термопаста");
    }

    if (pressureErrors.length >= 3) {
      probability += 18;
      reasons.push("КРИТИЧЕСКОЕ ДАВЛЕНИЕ - риск разгерметизации и взрыва");
      failureType = "Гидравлический/пневматический сбой";
      impactAssessment = "Риск аварии с человеческими жертвами";
      recommendedActions.push("Срочная проверка герметичности системы");
      partsNeeded.push("Прокладки", "Клапаны", "Манометры", "Уплотнители", "Предохранительные клапаны");
    } else if (pressureErrors.length >= 2) {
      probability += 10;
      reasons.push("Нестабильное давление в системе");
      recommendedActions.push("Проверить герметичность и клапаны");
      partsNeeded.push("Прокладки", "Клапаны", "Манометры");
    }

    if (electricalErrors.length >= 3) {
      probability += 22;
      reasons.push("КРИТИЧЕСКИЕ ЭЛЕКТРИЧЕСКИЕ НЕИСПРАВНОСТИ - риск короткого замыкания и пожара");
      failureType = "Электрический отказ";
      impactAssessment = "Риск поражения персонала и пожара";
      recommendedActions.push("Немедленное обесточивание и проверка электропроводки");
      partsNeeded.push("Предохранители", "Реле", "Контакторы", "Кабели", "Автоматы защиты");
    } else if (electricalErrors.length >= 2) {
      probability += 15;
      reasons.push("Электрические неисправности - риск короткого замыкания");
      recommendedActions.push("Проверить электропроводку и заземление");
      partsNeeded.push("Предохранители", "Реле", "Контакторы");
    }

    if (mechanicalErrors.length >= 2) {
      probability += 18;
      reasons.push("Механические неисправности - риск заклинивания и разрушения");
      failureType = "Механический износ";
      recommendedActions.push("Проверить все движущиеся части на износ");
      partsNeeded.push("Шестерни", "Валы", "Подшипники", "Муфты");
    }

    // Фактор 5: Увеличение частоты ошибок
    const errorTrend = calculateErrorTrend(errorLogs);
    if (errorTrend > 0.8) {
      probability += 25;
      reasons.push("ЭКСТРЕННЫЙ РОСТ ошибок - оборудование на грани полного отказа");
      impactAssessment = "Остановка производства в ближайшие 24-48 часов";
    } else if (errorTrend > 0.5) {
      probability += 20;
      reasons.push("БЫСТРЫЙ РОСТ количества ошибок - ускоренный износ");
      recommendedActions.push("Усилить мониторинг и подготовить запасные части");
    } else if (errorTrend > 0.3) {
      probability += 15;
      reasons.push("Наблюдается рост количества ошибок");
      recommendedActions.push("Увеличить частоту проверок");
    }

    // Фактор 6: Сезонность и внешние факторы
    const currentMonth = new Date().getMonth();
    if (currentMonth >= 10 || currentMonth <= 2) { // Зимние месяцы
      probability += 8;
      reasons.push("Зимний период - повышенная нагрузка на оборудование из-за низких температур");
    }

    // Фактор 7: Анализ времени последней ошибки
    if (errorLogs.length > 0) {
      const lastErrorTime = new Date(errorLogs[0].reported_at).getTime();
      const hoursSinceLastError = (now.getTime() - lastErrorTime) / (1000 * 60 * 60);

      if (hoursSinceLastError < 6) {
        probability += 10;
        reasons.push("Недавние ошибки указывают на активное развитие неисправности");
      }
    }

    // Определение типа отказа на основе преобладающих ошибок
    if (vibrationErrors.length > temperatureErrors.length && vibrationErrors.length > pressureErrors.length) {
      failureType = "Механическая неуравновешенность";
    } else if (temperatureErrors.length > vibrationErrors.length && temperatureErrors.length > pressureErrors.length) {
      failureType = "Термическая перегрузка";
    } else if (pressureErrors.length > vibrationErrors.length && pressureErrors.length > temperatureErrors.length) {
      failureType = "Гидравлический/пневматический сбой";
    } else if (electricalErrors.length >= 2) {
      failureType = "Электрическая неисправность";
    }

    // Ограничение вероятности 100%
    probability = Math.min(probability, 98);

    // Расчет уверенности в прогнозе на основе данных
    const dataQuality = Math.min(
      70 +
      (recentErrors.length * 3) +
      (criticalErrors.length * 8) +
      (errorTrend > 0.3 ? 10 : 0) +
      (monthlyErrors.length > 10 ? 5 : 0),
      95
    );
    confidence = dataQuality;

    // Определение времени ремонта и приоритета на основе итоговой вероятности
    if (probability >= 85) {
      estimatedRepairTime = "8-24 часа";
      repairPriority = 'critical';
      timeframe = 'immediate';
      if (!recommendedActions.includes("НЕМЕДЛЕННАЯ ОСТАНОВКА")) {
        recommendedActions.unshift("НЕМЕДЛЕННАЯ ОСТАНОВКА ОБОРУДОВАНИЯ");
      }
      impactAssessment = "КРИТИЧЕСКИЙ РИСК - НЕМЕДЛЕННАЯ ОСТАНОВКА";
    } else if (probability >= 70) {
      estimatedRepairTime = "6-12 часов";
      repairPriority = 'critical';
      timeframe = 'immediate';
      recommendedActions.unshift("СРОЧНАЯ ОСТАНОВКА И РЕМОНТ");
      impactAssessment = "Высокий риск остановки производства";
    } else if (probability >= 60) {
      estimatedRepairTime = "4-8 часов";
      repairPriority = 'high';
      timeframe = 'short_term';
      recommendedActions.unshift("Срочный ремонт в течение 24 часов");
      impactAssessment = "Существенное влияние на производительность";
    } else if (probability >= 45) {
      estimatedRepairTime = "2-4 часа";
      repairPriority = 'medium';
      timeframe = 'medium_term';
      recommendedActions.unshift("Плановый ремонт в течение недели");
      impactAssessment = "Умеренное влияние на эффективность";
    } else {
      estimatedRepairTime = "1-2 часа";
      repairPriority = 'low';
      timeframe = 'long_term';
      recommendedActions.unshift("Профилактическое обслуживание при возможности");
    }

    // Добавление общих рекомендаций
    if (probability > 60) {
      recommendedActions.push("Подготовить запасные части к ремонту");
      recommendedActions.push("Уведомить службу эксплуатации и планирования");
      recommendedActions.push("Рассмотреть возможность работы в щадящем режиме");
    }
    if (probability > 40) {
      recommendedActions.push("Увеличить частоту мониторинга параметров");
    }
    if (probability > 75) {
      recommendedActions.push("Подготовить замену оборудования");
      recommendedActions.push("Уведомить руководство о критической ситуации");
    }

    // Удаление дубликатов
    const uniqueReasons = [...new Set(reasons)];
    const uniqueActions = [...new Set(recommendedActions)];
    const uniqueParts = [...new Set(partsNeeded)];

    return {
      probability,
      timeframe,
      confidence,
      reasons: uniqueReasons,
      recommendedActions: uniqueActions,
      partsNeeded: uniqueParts.length > 0 ? uniqueParts : undefined,
      estimatedRepairTime,
      repairPriority,
      failureType,
      impactAssessment
    };
  }

  // Функция для расчета тренда ошибок
  function calculateErrorTrend(errorLogs: ErrorLog[]): number {
    if (errorLogs.length < 4) return 0;

    const now = new Date();
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const recentErrors = errorLogs.filter(e => new Date(e.reported_at) > lastWeek).length;
    const olderErrors = errorLogs.filter(e =>
      new Date(e.reported_at) > twoWeeksAgo && new Date(e.reported_at) <= lastWeek
    ).length;

    if (olderErrors === 0) return recentErrors > 0 ? 1 : 0;

    return (recentErrors - olderErrors) / olderErrors;
  }

  // Функция для получения вариантов ремонта
  function getRepairOptions(device: DeviceWithErrorsExtended): RepairOption[] {
    const prediction = device.failure_prediction!;

    const baseOptions: RepairOption[] = [
      {
        id: 'quick_fix',
        name: 'Быстрый ремонт',
        description: 'Временное решение для устранения основных симптомов и продолжения работы до планового ремонта',
        estimatedTime: '1-2 часа',
        cost: 'low',
        effectiveness: 60,
        partsRequired: prediction.partsNeeded?.slice(0, 2) || ['Базовые расходники'],
        toolsRequired: ['Мультиметр', 'Основной набор инструментов', 'Смазка', 'Измерительные приборы'],
        steps: [
          'Безопасное отключение оборудования от сети',
          'Визуальный осмотр на явные повреждения и износ',
          'Проверка основных параметров работы (ток, напряжение, температура)',
          'Устранение очевидных неисправностей',
          'Очистка и смазка механизмов',
          'Тестовый запуск и проверка рабочих параметров',
          'Контрольная работа под нагрузкой 30 минут'
        ],
        specialistRequired: 'Слесарь-ремонтник'
      },
      {
        id: 'standard_repair',
        name: 'Стандартный ремонт',
        description: 'Полное устранение текущих неисправностей с заменой изношенных частей и диагностикой систем',
        estimatedTime: prediction.estimatedRepairTime,
        cost: 'medium',
        effectiveness: 85,
        partsRequired: prediction.partsNeeded || ['Стандартные запасные части', 'Расходные материалы'],
        toolsRequired: ['Мультиметр', 'Специализированный инструмент', 'Диагностическое ПО', 'Измерительные приборы', 'Стенд для тестирования'],
        steps: [
          'Полная диагностика всех систем оборудования',
          'Составление дефектной ведомости и плана ремонта',
          'Демонтаж изношенных компонентов',
          'Замена изношенных деталей на новые',
          'Настройка и калибровка рабочих параметров',
          'Проверка работы в различных режимах',
          'Тестирование под нагрузкой 2-4 часа',
          'Регулировка и тонкая настройка',
          'Документирование выполненных работ и остаточного ресурса'
        ],
        specialistRequired: 'Инженер-механик'
      },
      {
        id: 'preventive_maintenance',
        name: 'Профилактическое обслуживание',
        description: 'Комплексное обслуживание для предотвращения будущих поломок и увеличения срока службы оборудования',
        estimatedTime: '4-8 часов',
        cost: 'high',
        effectiveness: 95,
        partsRequired: [
          ...prediction.partsNeeded || [],
          'Смазочные материалы',
          'Фильтры',
          'Уплотнители',
          'Крепежные элементы',
          'Профилактические комплектующие'
        ],
        toolsRequired: [
          'Полный набор инструментов',
          'Диагностическое оборудование',
          'Стенды для тестирования',
          'Измерительные приборы',
          'Оборудование для балансировки',
          'Специализированный диагностический комплекс'
        ],
        steps: [
          'Полная остановка и обесточивание оборудования',
          'Разборка ключевых узлов для детального осмотра',
          'Дефектация всех компонентов с фотофиксацией',
          'Замена всех изношенных и близких к износу деталей',
          'Чистка и смазка всех механизмов и узлов',
          'Калибровка и настройка всех систем и датчиков',
          'Сборка и проверка правильности монтажа',
          'Тестирование в различных режимах работы',
          'Настройка оптимальных параметров работы',
          'Контрольная работа под максимальной нагрузкой',
          'Составление плана следующего ТО и рекомендаций'
        ],
        specialistRequired: 'Ведущий инженер'
      }
    ];

    // Для критических случаев добавляем экстренный вариант
    if (prediction.repairPriority === 'critical') {
      baseOptions.unshift({
        id: 'emergency_shutdown',
        name: 'ЭКСТРЕННАЯ ОСТАНОВКА',
        description: 'Немедленная остановка для предотвращения катастрофического отказа и аварии. Приоритет - безопасность персонала и оборудования.',
        estimatedTime: '30-60 минут',
        cost: 'high',
        effectiveness: 100,
        partsRequired: ['Аварийные компоненты', 'Предохранительные устройства', 'Сигнальные системы'],
        toolsRequired: ['Аварийный инструмент', 'СИЗ', 'Огнетушитель', 'Сигнальные ленты', 'Блокировочные устройства'],
        steps: [
          'НЕМЕДЛЕННАЯ безопасная остановка оборудования',
          'Полное обесточивание и блокировка энергоисточников',
          'Изоляция опасных зон и установка ограждений',
          'Оценка степени повреждений и потенциальных рисков',
          'Установка предупреждающих знаков и сигнализации',
          'Срочное уведомление ответственных лиц и аварийных служб',
          'Эвакуация персонала из опасной зоны',
          'Начало аварийного ремонта по специальному протоколу'
        ],
        specialistRequired: 'Аварийная бригада'
      });
    }

    return baseOptions;
  }

  // Функция для выбора варианта ремонта
  function handleRepairOptionSelect(deviceId: string, optionId: string) {
    setSelectedRepairOption({ deviceId, optionId });
  }

  // Функция для подтверждения ремонта
  function handleConfirmRepair(deviceId: string, optionId: string) {
    setConfirmedRepairs(prev => [...prev, { deviceId, optionId }]);
    setSelectedRepairOption(null);
    // Здесь можно добавить логику для сохранения в базу данных
    console.log(`Подтвержден ремонт ${optionId} для устройства ${deviceId}`);
  }

  // Функция для открытия увеличенного изображения
  function handleImageZoom(src: string, alt: string) {
    setZoomedImage({ src, alt });
  }

  // Функция для закрытия увеличенного изображения
  function handleImageClose() {
    setZoomedImage(null);
  }

  // Функция для получения приоритетных устройств
  function getPriorityDevices() {
    if (!selectedFacility) return [];

    return selectedFacility.devices
      .filter(device => device.risk_score >= 60)
      .sort((a, b) => b.risk_score - a.risk_score);
  }

  function getCriticalDevices() {
    if (!selectedFacility) return [];

    return selectedFacility.devices
      .filter(device => device.risk_score >= 80 || device.failure_probability >= 50)
      .sort((a, b) => b.risk_score - a.risk_score);
  }

  function handleFacilityClick(facility: FacilityWithDevicesExtended) {
    setSelectedFacility(facility);
    setExpandedDeviceId(null);
    setPriorityView('all');
    setSelectedRepairOption(null);
  }

  function handleBackClick() {
    setSelectedFacility(null);
    setExpandedDeviceId(null);
    setPriorityView('all');
    setSelectedRepairOption(null);
  }

  function handleDeviceClick(deviceId: string) {
    setExpandedDeviceId(expandedDeviceId === deviceId ? null : deviceId);
    setSelectedRepairOption(null);
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('ru-RU');
  }

  function formatDateTime(dateString: string) {
    return new Date(dateString).toLocaleString('ru-RU');
  }

  function getDeviceAge(manufactureDate: string) {
    const now = new Date();
    const manufactured = new Date(manufactureDate);
    const years = (now.getTime() - manufactured.getTime()) / (1000 * 60 * 60 * 24 * 365);
    return years.toFixed(1);
  }

  function getRiskLevel(score: number): 'low' | 'medium' | 'high' {
    if (score >= 60) return 'high';
    if (score >= 30) return 'medium';
    return 'low';
  }

  function getRiskLabel(level: 'low' | 'medium' | 'high'): string {
    const labels = {
      low: 'Низкий',
      medium: 'Средний',
      high: 'Высокий'
    };
    return labels[level];
  }

  function getPriorityLevel(device: DeviceWithErrorsExtended): 'critical' | 'high' | 'medium' | 'low' {
    if (device.risk_score >= 80 || device.failure_probability >= 50) return 'critical';
    if (device.risk_score >= 60 || device.failure_probability >= 30) return 'high';
    if (device.risk_score >= 30) return 'medium';
    return 'low';
  }

  function getTimeframeLabel(timeframe: FailurePrediction['timeframe']): string {
    const labels = {
      immediate: 'Немедленно (0-24 часа)',
      short_term: 'Краткосрочный (24-72 часа)',
      medium_term: 'Среднесрочный (3-7 дней)',
      long_term: 'Долгосрочный (1-4 недели)'
    };
    return labels[timeframe];
  }

  // Рендер панели прогнозирования
  const renderPredictionPanel = (device: DeviceWithErrorsExtended) => {
    const prediction = device.failure_prediction!;
    const repairOptions = getRepairOptions(device);
    const isRepairConfirmed = confirmedRepairs.some(repair => repair.deviceId === device.id);

    return (
      <div className="device-details">
        {/* Блок с изображением устройства */}
        <div className="device-image-section">
          <div className="image-container">
            <img
              src={device.imageUrl}
              alt={device.name}
              className="device-main-image"
              onClick={() => handleImageZoom(device.imageUrl!, device.name)}
            />
          </div>
          <div className="image-caption">
            <strong>Тип оборудования:</strong> {device.name}
            <br />
            <strong>Описание:</strong> {getDeviceDescription(device.id)}
          </div>
        </div>

        <div className="prediction-panel">
          <h4>
            <TrendingUp size={20} />
            Детальный прогноз поломки
          </h4>

          <div className="prediction-grid">
            <div className="prediction-metric">
              <div className="metric-value">{prediction.probability}%</div>
              <div className="metric-label">Вероятность поломки</div>
            </div>
            <div className="prediction-metric">
              <div className="metric-value">{getTimeframeLabel(prediction.timeframe)}</div>
              <div className="metric-label">Ожидаемое время</div>
            </div>
            <div className="prediction-metric">
              <div className="metric-value">{prediction.confidence}%</div>
              <div className="metric-label">Уверенность прогноза</div>
            </div>
            <div className="prediction-metric">
              <div className="metric-value">
                <span className={`priority-badge priority-${prediction.repairPriority}`}>
                  {prediction.repairPriority === 'critical' ? 'КРИТИЧЕСКИЙ' :
                    prediction.repairPriority === 'high' ? 'ВЫСОКИЙ' :
                      prediction.repairPriority === 'medium' ? 'СРЕДНИЙ' : 'НИЗКИЙ'}
                </span>
              </div>
              <div className="metric-label">Приоритет ремонта</div>
            </div>
          </div>

          <div className="detailed-analysis">
            <div className="analysis-row">
              <div className="analysis-item">
                <h5>Тип предполагаемого отказа:</h5>
                <p>{prediction.failureType}</p>
              </div>
              <div className="analysis-item">
                <h5>Влияние на производство:</h5>
                <p className={`impact-${prediction.repairPriority}`}>{prediction.impactAssessment}</p>
              </div>
            </div>
          </div>

          <div className="reasons-section">
            <h5>Детальный анализ причин риска:</h5>
            <ul>
              {prediction.reasons.map((reason, index) => (
                <li key={index} className="reason-item">{reason}</li>
              ))}
            </ul>
          </div>

          <div className="actions-section">
            <h5>Рекомендуемые действия:</h5>
            <ul>
              {prediction.recommendedActions.map((action, index) => (
                <li key={index} className={action.includes('НЕМЕДЛЕННАЯ') ? 'urgent-action' : ''}>
                  {action}
                </li>
              ))}
            </ul>
          </div>

          {prediction.partsNeeded && prediction.partsNeeded.length > 0 && (
            <div className="parts-section">
              <h5>Необходимые запчасти и материалы:</h5>
              <div className="parts-tags">
                {prediction.partsNeeded.map((part, index) => (
                  <span key={index} className="part-tag">{part}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {!isRepairConfirmed ? (
          <div className="repair-options">
            <h4>
              <Wrench size={20} />
              Варианты ремонта и обслуживания
            </h4>
            <div className="options-grid">
              {repairOptions.map(option => (
                <div
                  key={option.id}
                  className={`repair-option ${selectedRepairOption?.deviceId === device.id && selectedRepairOption?.optionId === option.id
                      ? 'selected'
                      : ''
                    }`}
                  onClick={() => handleRepairOptionSelect(device.id, option.id)}
                >
                  <div className="option-header">
                    <h5>{option.name}</h5>
                  </div>
                  <p className="option-description">{option.description}</p>

                  <div className="option-details">
                    <div className="detail-item">
                      <Clock size={14} />
                      {option.estimatedTime}
                    </div>
                    <div className="detail-item">
                      <TrendingUp size={14} />
                      Эффективность: {option.effectiveness}%
                    </div>
                    <div className="detail-item">
                      <Wrench size={14} />
                      Специалист: {option.specialistRequired}
                    </div>
                  </div>

                  <div className="option-tools">
                    <strong>Необходимые инструменты:</strong>
                    <div className="tools-list">
                      {option.toolsRequired.map((tool, index) => (
                        <span key={index} className="tool-tag">
                          🛠️ {tool}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="option-parts">
                    <strong>Запасные части:</strong>
                    <div className="parts-list">
                      {option.partsRequired.map((part, index) => (
                        <span key={index} className="part-small-tag">{part}</span>
                      ))}
                    </div>
                  </div>

                  <div className="option-steps">
                    <strong>Пошаговый план работ:</strong>
                    <ol>
                      {option.steps.map((step, index) => (
                        <li key={index}>{step}</li>
                      ))}
                    </ol>
                  </div>
                </div>
              ))}
            </div>

            {selectedRepairOption?.deviceId === device.id && (
              <div className="repair-confirmation">
                <button
                  className="confirm-button"
                  onClick={() => handleConfirmRepair(device.id, selectedRepairOption.optionId)}
                >
                  <CheckCircle size={16} />
                  Подтвердить выбранный вариант ремонта
                </button>
                <p className="confirmation-note">
                  Выбранный вариант будет передан в работу. Ожидаемое время выполнения: {
                    repairOptions.find(opt => opt.id === selectedRepairOption.optionId)?.estimatedTime
                  }
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="repair-confirmed">
            <CheckCircle size={24} className="confirmed-icon" />
            <h4>Ремонт подтвержден и передан в работу</h4>
            <p>Выбранный вариант ремонта был подтвержден и передан ответственному подразделению.</p>
            <div className="confirmation-details">
              <strong>Детали заявки:</strong>
              <ul>
                <li>Устройство: {device.name}</li>
                <li>Вариант ремонта: {
                  repairOptions.find(opt => opt.id === confirmedRepairs.find(r => r.deviceId === device.id)?.optionId)?.name
                }</li>
                <li>Статус: Ожидает выполнения</li>
                <li>Приоритет: {prediction.repairPriority.toUpperCase()}</li>
              </ul>
            </div>
          </div>
        )}

        <div className="details-table">
          <div className="details-table-text"><h4>История ошибок и событий</h4></div>
          <table>
            <thead>
              <tr>
                <th>Дата и время</th>
                <th>Тип ошибки</th>
                <th>Серьезность</th>
                <th>Описание</th>
                <th>Влияние</th>
              </tr>
            </thead>
            <tbody>
              {device.error_logs.length > 0 ? (
                device.error_logs.slice(0, 10).map(errorLog => (
                  <tr key={errorLog.id}>
                    <td>{formatDateTime(errorLog.reported_at)}</td>
                    <td>
                      <span className={`error-type error-${errorLog.error_type}`}>
                        {errorLog.error_type}
                      </span>
                    </td>
                    <td>
                      <span className={`severity-badge severity-${errorLog.severity}`}>
                        {errorLog.severity}/5
                      </span>
                    </td>
                    <td>
                      {errorLog.severity >= 4 ? 'Критическое' :
                        errorLog.severity >= 3 ? 'Значительное' :
                          'Незначительное'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: '#6b7280' }}>
                    Ошибок не обнаружено за весь период наблюдений
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {device.error_logs.length > 10 && (
            <div className="table-footer">
              Показано 10 из {device.error_logs.length} записей
            </div>
          )}
        </div>
      </div>
    );
  };

  // Функция для получения описания устройства по его ID
  function getDeviceDescription(deviceId: string): string {
    const descriptions: { [key: string]: string } = {
      'press-1': 'Гидравлический пресс 100т - используется для штамповки металлических деталей',
      'press-2': 'Механический пресс 50т - для холодной штамповки и вырубки',
      'cnc-1': '5-осевой фрезерный станок с ЧПУ - обработка сложных металлических деталей',
      'cnc-2': 'Токарный станок с ЧПУ - производство валов и осей',
      'conveyor-1': 'Ленточный конвейер 20м - транспортировка готовой продукции',
      'conveyor-2': 'Роликовый конвейер 15м - перемещение заготовок между участками',
      'mixer-1': 'Промышленный смеситель 500л - приготовление химических составов',
      'mixer-2': 'Лопастной смеситель 200л - для сухих смесей и порошков',
      'furnace-1': 'Промышленная печь 800°C - термообработка металлов',
      'furnace-2': 'Сушильная камера 200°C - сушка покрытий и материалов',
      'compressor-1': 'Винтовой компрессор 100л/с - подача сжатого воздуха',
      'compressor-2': 'Поршневой компрессор 50л/с - для пневмоинструмента',
      'pump-1': 'Центробежный насос 100м³/ч - циркуляция охлаждающей жидкости',
      'pump-2': 'Мембранный насос 20л/мин - перекачка химических реагентов',
      'generator-1': 'Дизельный генератор 500кВт - резервное электропитание',
      'generator-2': 'Газовый генератор 250кВт - аварийное энергоснабжение'
    };

    return descriptions[deviceId] || 'Промышленное оборудование общего назначения';
  }

  // Данные для графика
  const priorityDevices = getPriorityDevices();
  const criticalDevices = getCriticalDevices();

  const displayDevices = priorityView === 'critical' ? criticalDevices :
    priorityView === 'high' ? priorityDevices :
      selectedFacility?.devices || [];

  // Статистика для графика
  const riskStats = {
    critical: criticalDevices.length,
    high: priorityDevices.length - criticalDevices.length,
    medium: selectedFacility ? selectedFacility.devices.filter(d => d.risk_score >= 30 && d.risk_score < 60).length : 0,
    low: selectedFacility ? selectedFacility.devices.filter(d => d.risk_score < 30).length : 0
  };

  if (loading) {
    return (
      <div className="breakdowns-container">
        <div className="loading">Загрузка данных мониторинга...</div>
      </div>
    );
  }

  return (
    <div className="breakdowns-container">
      {/* Модальное окно для увеличенного изображения */}
      {zoomedImage && (
        <div className="image-modal" onClick={handleImageClose}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-button" onClick={handleImageClose}>
              <X size={24} />
            </button>
            <img src={zoomedImage.src} alt={zoomedImage.alt} className="zoomed-image" onClick={handleImageClose} />
            <div className="image-info">
              <h3>{zoomedImage.alt}</h3>
              <p>{getDeviceDescription(
                Object.keys(DEVICE_IMAGES).find(key => DEVICE_IMAGES[key] === zoomedImage.src) || ''
              )}</p>
            </div>
          </div>
        </div>
      )}

      {!selectedFacility ? (
        <>
          <h1 className="header-title">Система мониторинга и прогнозирования оборудования</h1>
          <div className="facility-list">
            {facilities.map(facility => (
              <div
                key={facility.id}
                className={`facility-card risk-${facility.risk_level}`}
                onClick={() => handleFacilityClick(facility)}
              >
                <div className="facility-name">{facility.name}</div>
                <div className="facility-stats">
                  <span>{facility.devices.length} единиц оборудования</span>
                  <span className={`risk-badge risk-${facility.risk_level}`}>
                    {getRiskLabel(facility.risk_level)} риск
                  </span>
                </div>
                <div className="facility-preview">
                  <div className="preview-stats">
                    <span>Критических: {facility.devices.filter(d => getPriorityLevel(d) === 'critical').length}</span>
                    <span>Высоких: {facility.devices.filter(d => getPriorityLevel(d) === 'high').length}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <button className="back-button" onClick={handleBackClick}>
            <ChevronLeft size={20} />
            Назад к цехам
          </button>

          <div className={`selected-facility-header risk-${selectedFacility.risk_level}`}>
            <h2>{selectedFacility.name}</h2>
            <div className="header-stats">
              <span>{selectedFacility.devices.length} единиц оборудования</span>
              <span className={`risk-badge risk-${selectedFacility.risk_level}`}>
                {getRiskLabel(selectedFacility.risk_level)} риск
              </span>
            </div>
          </div>

          {/* График приоритетов */}
          <div className="priority-dashboard">
            <div className="dashboard-header">
              <h3>
                <BarChart3 size={24} />
                Панель приоритетов и мониторинга
              </h3>
              <div className="dashboard-controls">
                <div className="chart-type-selector">
                  <button
                    className={`chart-btn ${chartType === 'bars' ? 'active' : ''}`}
                    onClick={() => setChartType('bars')}
                  >
                    Столбцы
                  </button>
                  <button
                    className={`chart-btn ${chartType === 'radar' ? 'active' : ''}`}
                    onClick={() => setChartType('radar')}
                  >
                    Радар
                  </button>
                </div>
                <div className="priority-filters">
                  <button
                    className={`filter-btn ${priorityView === 'all' ? 'active' : ''}`}
                    onClick={() => setPriorityView('all')}
                  >
                    Все ({selectedFacility.devices.length})
                  </button>
                  <button
                    className={`filter-btn ${priorityView === 'high' ? 'active' : ''}`}
                    onClick={() => setPriorityView('high')}
                  >
                    <Clock size={16} />
                    Высокие ({priorityDevices.length})
                  </button>
                  <button
                    className={`filter-btn ${priorityView === 'critical' ? 'active' : ''}`}
                    onClick={() => setPriorityView('critical')}
                  >
                    <AlertTriangle size={16} />
                    Критические ({criticalDevices.length})
                  </button>
                </div>
              </div>
            </div>

            <div className="charts-grid">
              {/* Основной график */}
              <div className="main-chart">
                {chartType === 'bars' ? (
                  <div className="bars-chart">
                    <div className="chart-title">Уровни риска по устройствам</div>
                    <div className="bars-container">
                      {displayDevices.slice(0, 8).map(device => {
                        const priority = getPriorityLevel(device);
                        return (
                          <div key={device.id} className="bar-item" onClick={() => handleDeviceClick(device.id)}>
                            <div className="bar-label">
                              <span className="device-name">{device.name}</span>
                              <span className="risk-value">{device.risk_score}</span>
                            </div>
                            <div className="bar-track">
                              <div
                                className={`bar-fill priority-${priority}`}
                                style={{ width: `${device.risk_score}%` }}
                              >
                                <div className="bar-tooltip">
                                  <strong>{device.name}</strong><br />
                                  Риск: {device.risk_score}%<br />
                                  Вероятность поломки: {device.failure_probability}%<br />
                                  Приоритет: {priority.toUpperCase()}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="radar-chart">
                    <div className="chart-title">Радар приоритетов оборудования</div>
                    <div className="radar-container">
                      <div className="radar-grid">
                        {[0, 25, 50, 75, 100].map(level => (
                          <div key={level} className="radar-circle">
                            <span>{level}%</span>
                          </div>
                        ))}
                      </div>
                      {/* Добавляем оси с метками */}
                      <div className="radar-axes">
                        {displayDevices.slice(0, 6).map((device, index) => {
                          const angle = (index * 60) * (Math.PI / 180);
                          const x = 150 + Math.cos(angle) * 130;
                          const y = 150 + Math.sin(angle) * 130;
                          return (

                            <div className="axis-label">{device.name.split(' ')[0]}</div>

                          );
                        })}
                      </div>
                      <div className="radar-points">
                        {displayDevices.slice(0, 6).map((device, index) => {
                          const angle = (index * 60) * (Math.PI / 180);
                          const radius = (device.risk_score / 100) * 120;
                          const x = 150 + Math.cos(angle) * radius;
                          const y = 150 + Math.sin(angle) * radius;
                          const priority = getPriorityLevel(device);

                          return (
                            <div
                              key={device.id}
                              className={`radar-point priority-${priority}`}
                              style={{ left: x, top: y }}
                              onClick={() => handleDeviceClick(device.id)}
                            >
                              <div className="point-tooltip">
                                <strong>{device.name}</strong><br />
                                Уровень риска: {device.risk_score}%<br />
                                Вероятность: {device.failure_probability}%<br />
                                Приоритет: {priority.toUpperCase()}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {/* Добавляем центр радара */}
                      
                    </div>
                  </div>
                )}
              </div>

              {/* Статистика */}
              <div className="stats-sidebar">
                <div className="stats-card">
                  <h4>Статистика рисков</h4>
                  <div className="stats-grid">
                    <div className="stat-item critical">
                      <div className="stat-icon">
                        <AlertTriangle size={20} />
                      </div>
                      <div className="stat-info">
                        <div className="stat-value">{riskStats.critical}</div>
                        <div className="stat-label">Критические</div>
                      </div>
                    </div>
                    <div className="stat-item high">
                      <div className="stat-icon">
                        <Clock size={20} />
                      </div>
                      <div className="stat-info">
                        <div className="stat-value">{riskStats.high}</div>
                        <div className="stat-label">Высокие</div>
                      </div>
                    </div>
                    <div className="stat-item medium">
                      <div className="stat-icon">⚠️</div>
                      <div className="stat-info">
                        <div className="stat-value">{riskStats.medium}</div>
                        <div className="stat-label">Средние</div>
                      </div>
                    </div>
                    <div className="stat-item low">
                      <div className="stat-icon">✅</div>
                      <div className="stat-info">
                        <div className="stat-value">{riskStats.low}</div>
                        <div className="stat-label">Низкие</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="urgency-card">
                  <h4>Рекомендации по приоритетам</h4>
                  <div className="urgency-list">
                    {criticalDevices.length > 0 && (
                      <div className="urgency-item critical">
                        <AlertTriangle size={16} />
                        <span>НЕМЕДЛЕННО устранить {criticalDevices.length} критических неисправностей</span>
                      </div>
                    )}
                    {priorityDevices.length > 0 && (
                      <div className="urgency-item high">
                        <Clock size={16} />
                        <span>В течение 24 часов: {priorityDevices.length} устройств высокого риска</span>
                      </div>
                    )}
                    {riskStats.medium > 0 && (
                      <div className="urgency-item medium">
                        <span>Запланировать обслуживание {riskStats.medium} устройств на неделю</span>
                      </div>
                    )}
                    {riskStats.low > 0 && (
                      <div className="urgency-item low">
                        <span>Профилактика {riskStats.low} устройств при плановом ТО</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Галерея приборов */}
                <div className="devices-gallery">
                  <h4>Оборудование цеха</h4>
                  <div className="gallery-grid">
                    {selectedFacility.devices.slice(0, 6).map(device => {
                      const priority = getPriorityLevel(device);
                      return (
                        <div
                          key={device.id}
                          className={`gallery-item priority-${priority}`}
                          onClick={() => handleDeviceClick(device.id)}
                        >
                          <div className="device-image">
                            <img
                              src={device.imageUrl}
                              alt={device.name}
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = '';
                              }}
                            />
                            <div className="device-overlay">
                              <div className="device-risk">{device.risk_score}</div>
                            </div>
                          </div>
                          <div className="device-info">
                            <div className="device-name">{device.name}</div>
                            <div className="device-priority">
                              <span className={`priority-dot priority-${priority}`}></span>
                              {priority === 'critical' ? 'КРИТИЧЕСКИЙ' :
                                priority === 'high' ? 'ВЫСОКИЙ' :
                                  priority === 'medium' ? 'СРЕДНИЙ' : 'НИЗКИЙ'}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Список устройств */}
          <div className="device-list">
            {displayDevices.map(device => {
              const riskLevel = getRiskLevel(device.risk_score);
              const isExpanded = expandedDeviceId === device.id;
              const priority = getPriorityLevel(device);
              const isRepairConfirmed = confirmedRepairs.some(repair => repair.deviceId === device.id);

              return (
                <div key={device.id} className="device-card">
                  <div
                    className={`device-header risk-${riskLevel} priority-${priority} ${isRepairConfirmed ? 'repair-confirmed' : ''
                      }`}
                    onClick={() => handleDeviceClick(device.id)}
                  >
                    <div className="device-image-small">
                      <img
                        src={device.imageUrl}
                        alt={device.name}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '';
                        }}
                      />
                    </div>
                    <div className="device-info">
                      <div className="device-name-row">
                        <div className="device-name">{device.name}</div>
                        <div className="device-status">
                          {isRepairConfirmed && (
                            <CheckCircle className="confirmed-icon" size={16} />
                          )}
                          {priority === 'critical' && <AlertTriangle className="priority-icon critical" size={16} />}
                          {priority === 'high' && <Clock className="priority-icon high" size={16} />}
                          {priority === 'medium' && <span className="priority-icon medium">⚠️</span>}
                        </div>
                      </div>
                      <div className="device-meta">
                        Дата изготовления: {formatDate(device.manufacture_date)} ({getDeviceAge(device.manufacture_date)} лет)
                      </div>
                      <div className="device-meta">
                        Ошибок за 30 дней: {device.error_logs.filter(e => {
                          const daysSince = (Date.now() - new Date(e.reported_at).getTime()) / (1000 * 60 * 60 * 24);
                          return daysSince <= 30;
                        }).length}
                      </div>
                      {device.failure_prediction && (
                        <div className="device-prediction">
                          Вероятность поломки: <strong>{device.failure_prediction.probability}%</strong>
                          {' '}({getTimeframeLabel(device.failure_prediction.timeframe)})
                        </div>
                      )}
                    </div>
                    <div className="device-risk-indicator">
                      <div className={`risk-score risk-${riskLevel}`}>
                        {device.risk_score}
                      </div>
                      <div className={`risk-badge risk-${riskLevel}`}>
                        {getRiskLabel(riskLevel)}
                      </div>
                    </div>
                  </div>

                  {isExpanded && renderPredictionPanel(device)}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default Breakdowns;