import React, { useState, useEffect, useRef } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, AlertTriangle, CheckCircle, BarChart3, Download, Filter, X, FileSpreadsheet } from 'lucide-react';
import { facilities } from '../../data/objects';
import './Dashboards.scss';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// Генерация данных для трендов нарушений по участкам/бригадам/категориям
const generateTrendsData = () => {
  const months = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

  // Категории нарушений
  const categories = ['Вибрация', 'Температура', 'Давление', 'Электрика', 'Механика'];

  // Бригады
  const teams = ['Бригада А', 'Бригада Б', 'Бригада В', 'Бригада Г'];

  return months.map((month, index) => {
    const data: any = { month };

    // Тренды по участкам (с сезонностью)
    facilities.forEach(facility => {
      const baseValue = Math.floor(Math.random() * 15) + 5;
      const seasonalFactor = [1.2, 1.1, 1.0, 0.9, 0.8, 0.7, 0.8, 0.9, 1.0, 1.1, 1.3, 1.4][index];
      data[facility.name] = Math.floor(baseValue * seasonalFactor);
    });

    // Тренды по категориям
    categories.forEach(category => {
      const baseValue = Math.floor(Math.random() * 12) + 3;
      data[category] = Math.floor(baseValue * (0.8 + Math.random() * 0.4));
    });

    // Тренды по бригадам
    teams.forEach(team => {
      const baseValue = Math.floor(Math.random() * 10) + 2;
      data[team] = Math.floor(baseValue * (0.7 + Math.random() * 0.6));
    });

    return data;
  });
};

// Генерация данных для топа повторяющихся нарушений
const generateTopViolationsData = () => {
  const violations = [
    'Вибрация оборудования',
    'Перегрев компонентов',
    'Давление вне нормы',
    'Электрические сбои',
    'Механические повреждения',
    'Программные ошибки',
    'Утечки жидкостей',
    'Шумовое загрязнение'
  ];

  return violations.map((violation, index) => ({
    name: violation,
    count: Math.floor(Math.random() * 50) + 10,
    percentage: Math.floor(Math.random() * 100) + 1,
    severity: ['high', 'medium', 'low'][Math.floor(Math.random() * 3)]
  })).sort((a, b) => b.count - a.count).slice(0, 8);
};

// Генерация данных для тепловой карты чек-листов
const generateHeatmapData = () => {
  const checklistItems = [
    'Чистота пола и оборудования',
    'Личные вещи работника',
    'Головной убор и перчатки',
    'Отсутствие посторонних предметов',
    'Уборочный инвентарь',
    'Тара и упаковочные материалы',
    'Свободные проходы',
    'Общий балл за раздел А',
    'Состояние оборудования',
    'Ответственность наладчика',
    'Отсутствие пыли на оборудовании',
    'Тумбочки и шкафы наладчиков',
    'Защитные экраны',
    'Отсутствие креплений скотчем',
    'Внутри оборудования',
    'Технологическая оснастка',
    'Общий балл за раздел В1',
    'Ответственность персонала ЭМО',
    'Течь масла и жидкостей',
    'Элементы внутри оборудования',
    'Повреждения изоляции',
    'Отсутствие вещей ЭМО',
    'Панель управления',
    'Защитные ограждения',
    'Уборка и контейнеры',
    'Раздельный сбор отходов',
    'Места хранения сырья',
    'Проходы и проезды',
    'Маркировочные ярлыки',
    'Электроштабелеры',
    'Место питьевой воды'
  ];

  return facilities.map(facility => ({
    facility: facility.name,
    checklists: checklistItems.map(item => {
      // Более реалистичное распределение оценок
      const random = Math.random();
      let score, status;

      if (random > 0.85) {
        // 15% - критично (0-59%)
        score = Math.floor(Math.random() * 60);
        status = 'critical';
      } else if (random > 0.6) {
        // 25% - требует внимания (60-79%)
        score = 60 + Math.floor(Math.random() * 20);
        status = 'warning';
      } else {
        // 60% - хорошо (80-100%)
        score = 80 + Math.floor(Math.random() * 21);
        status = 'good';
      }

      return {
        name: item,
        score,
        status
      };
    })
  }));
};

// Генерация данных для выполнения планов проверок
const generateInspectionData = () => {
  const currentDate = new Date();
  const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

  // Функция для безопасного форматирования даты
  const formatDate = (date: Date) => {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  };

  return facilities.map(facility => {
    const plannedInspections = Math.floor(Math.random() * 30) + 15;
    const completedInspections = Math.floor(Math.random() * plannedInspections * 0.8) + Math.floor(plannedInspections * 0.1);
    const percentage = Math.round((completedInspections / plannedInspections) * 100);

    return {
      name: facility.name,
      planned: plannedInspections,
      completed: completedInspections,
      percentage,
      status: percentage >= 90 ? 'excellent' : percentage >= 75 ? 'good' : percentage >= 60 ? 'warning' : 'critical',
      schedule: {
        daily: Math.floor(plannedInspections / 30),
        weekly: Math.floor(plannedInspections / 4),
        monthly: plannedInspections
      },
      lastInspection: formatDate(new Date(currentDate.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000)),
      nextScheduled: formatDate(new Date(currentDate.getTime() + Math.random() * 3 * 24 * 60 * 60 * 1000))
    };
  });
};

const SEVERITY_COLORS = {
  high: '#ff4444',
  medium: '#ffaa00',
  low: '#00cc66'
};

const CHART_COLORS = [
  '#0088FE', '#00C49F', '#FFBB28', '#FF8042', 
  '#8884D8', '#82CA9D', '#FFC658', '#8DD1E1'
];

const STATUS_COLORS = {
  completed: '#00cc66',
  pending: '#ffaa00'
};

function Dashboards() {
  const [originalTrendsData, setOriginalTrendsData] = useState<any[]>([]);
  const [originalTopViolationsData, setOriginalTopViolationsData] = useState<any[]>([]);
  const [originalInspectionData, setOriginalInspectionData] = useState<any[]>([]);
  const [originalHeatmapData, setOriginalHeatmapData] = useState<any[]>([]);

  const [trendsData, setTrendsData] = useState<any[]>([]);
  const [topViolationsData, setTopViolationsData] = useState<any[]>([]);
  const [inspectionData, setInspectionData] = useState<any[]>([]);
  const [heatmapData, setHeatmapData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [trendsView, setTrendsView] = useState<'facilities' | 'categories' | 'teams'>('facilities');
  const [topViolationsCount, setTopViolationsCount] = useState(8);
  const [filters, setFilters] = useState({
    period: '3m',
    facilities: facilities.map(f => f.id),
    violationType: 'all',
    inspectionStatus: 'all'
  });
  const dashboardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Имитация загрузки данных
    setTimeout(() => {
      const trends = generateTrendsData();
      const violations = generateTopViolationsData();
      const inspections = generateInspectionData();
      const heatmap = generateHeatmapData();

      setOriginalTrendsData(trends);
      setOriginalTopViolationsData(violations);
      setOriginalInspectionData(inspections);
      setOriginalHeatmapData(heatmap);

      setTrendsData(trends);
      setTopViolationsData(violations.slice(0, topViolationsCount));
      setInspectionData(inspections);
      setHeatmapData(heatmap);
      setLoading(false);
    }, 1500);
  }, []);

  // Фильтрация данных при изменении фильтров или количества нарушений
  useEffect(() => {
    if (loading || !originalTrendsData.length) return;

    let filteredTrends = [...originalTrendsData];
    let filteredViolations = [...originalTopViolationsData];
    let filteredInspections = [...originalInspectionData];
    let filteredHeatmap = [...originalHeatmapData];

    // Фильтрация по периодам (количество месяцев)
    const monthsCount = filters.period === '3m' ? 3 : filters.period === '6m' ? 6 : filters.period === '1y' ? 12 : 12;
    filteredTrends = filteredTrends.slice(0, monthsCount);

    // Фильтрация трендов по участкам
    if (filters.facilities.length < facilities.length) {
      filteredTrends = filteredTrends.map(month => {
        const filteredMonth: any = { month };
        filters.facilities.forEach(facilityId => {
          const facility = facilities.find(f => f.id === facilityId);
          if (facility) {
            filteredMonth[facility.name] = month[facility.name];
          }
        });
        return filteredMonth;
      });
    }

    // Фильтрация нарушений по типу
    if (filters.violationType !== 'all') {
      const severityMap = { 'critical': 'high', 'warning': 'medium', 'info': 'low' };
      filteredViolations = filteredViolations.filter(v => v.severity === severityMap[filters.violationType as keyof typeof severityMap]);
    }

    // Фильтрация по количеству топ нарушений
    filteredViolations = filteredViolations.slice(0, topViolationsCount);

    // Фильтрация проверок по участкам и статусу
    if (filters.facilities.length < facilities.length) {
      filteredInspections = filteredInspections.filter(item => {
        const facility = facilities.find(f => f.name === item.name);
        return facility && filters.facilities.includes(facility.id);
      });
    }

    // Фильтрация по статусу проверок
    if (filters.inspectionStatus !== 'all') {
      filteredInspections = filteredInspections.filter(item => item.status === filters.inspectionStatus);
    }

    // Фильтрация тепловой карты по участкам
    if (filters.facilities.length < facilities.length) {
      filteredHeatmap = filteredHeatmap.filter(item => {
        const facility = facilities.find(f => f.name === item.facility);
        return facility && filters.facilities.includes(facility.id);
      });
    }

    setTrendsData(filteredTrends);
    setTopViolationsData(filteredViolations);
    setInspectionData(filteredInspections);
    setHeatmapData(filteredHeatmap);
  }, [filters, topViolationsCount, loading, originalTrendsData, originalTopViolationsData, originalInspectionData, originalHeatmapData]);

  // Функция экспорта в Excel (CSV) с улучшенной кодировкой
  const handleExportExcel = () => {
    try {
      // Функция для безопасного экранирования текста
      const escapeCSV = (text: string) => {
        // Заменяем проблемные символы на безопасные аналоги
        const safeText = text
          .replace(/"/g, '""') // Экранируем кавычки
          .replace(/№/g, 'N') // Заменяем № на N
          .replace(/•/g, '-') // Заменяем маркеры на тире
          .replace(/…/g, '...') // Заменяем многоточие
          .replace(/–/g, '-') // Заменяем длинное тире
          .replace(/—/g, '-') // Заменяем em-dash
          .replace(/'/g, "'") // Оставляем апострофы
          .replace(/'/g, "'") // Оставляем кавычки
          .replace(/«/g, '"') // Заменяем французские кавычки
          .replace(/»/g, '"')
          .replace(/„/g, '"')
          .replace(/"/g, '"')
          .replace(/'/g, "'")
          .replace(/'/g, "'")
          .replace(/##/g, '') // Удаляем хэш-символы
          .replace(/#/g, '') // Удаляем одиночные хэши
          .replace(/\uFFFD/g, '') // Удаляем replacement characters
          .replace(/\u0000/g, '') // Удаляем null characters
          .replace(/[\x00-\x1F\x7F-\x9F]/g, ''); // Удаляем управляющие символы

        // Если текст содержит разделитель, заключаем в кавычки
        return safeText.includes(';') || safeText.includes('"') || safeText.includes('\n')
          ? `"${safeText}"`
          : safeText;
      };

      // Используем точку с запятой как разделитель (стандарт для русской версии Excel)
      const separator = ';';
      let csvContent = '';

      // Заголовок отчета
      csvContent += escapeCSV('Аналитический отчет по нарушениям оборудования') + '\n';
      csvContent += escapeCSV('Дата формирования') + separator + escapeCSV(`${new Date().toLocaleDateString('ru-RU')} ${new Date().toLocaleTimeString('ru-RU')}`) + '\n';
      csvContent += escapeCSV('Период анализа') + separator + escapeCSV(filters.period === '1m' ? '1 месяц' : filters.period === '3m' ? '3 месяца' : filters.period === '6m' ? '6 месяцев' : '1 год') + '\n\n';

      // Раздел 1: Статистика
      csvContent += escapeCSV('СТАТИСТИКА') + '\n';
      csvContent += escapeCSV('Показатель') + separator + escapeCSV('Значение') + '\n';
      csvContent += escapeCSV('Критических нарушений') + separator + topViolationsData.filter(v => v.severity === 'high').length + '\n';
      csvContent += escapeCSV('Всего нарушений') + separator + topViolationsData.reduce((sum, v) => sum + v.count, 0) + '\n';
      csvContent += escapeCSV('Выполнение плана проверок') + separator + escapeCSV(`${inspectionData.length > 0 ? Math.round(inspectionData.reduce((sum, item) => sum + item.percentage, 0) / inspectionData.length) : 0}%`) + '\n\n';

      // Раздел 2: Тренды нарушений
      csvContent += escapeCSV('ТРЕНДЫ НАРУШЕНИЙ ПО МЕСЯЦАМ') + '\n';
      const trendHeaders = ['Месяц', ...facilities.slice(0, 3).map(f => f.name)];
      csvContent += trendHeaders.map(escapeCSV).join(separator) + '\n';
      trendsData.forEach(month => {
        const row = [escapeCSV(month.month)];
        facilities.slice(0, 3).forEach(facility => {
          row.push(month[facility.name]?.toString() || '0');
        });
        csvContent += row.join(separator) + '\n';
      });
      csvContent += '\n';

      // Раздел 3: Топ нарушений
      csvContent += escapeCSV('ТОП НАРУШЕНИЙ') + '\n';
      csvContent += escapeCSV('№') + separator + escapeCSV('Тип нарушения') + separator + escapeCSV('Количество') + separator + escapeCSV('Уровень серьезности') + '\n';
      topViolationsData.forEach((violation, index) => {
        const severityText = violation.severity === 'high' ? 'Критический' :
                           violation.severity === 'medium' ? 'Средний' : 'Низкий';
        csvContent += (index + 1) + separator + escapeCSV(violation.name) + separator + violation.count + separator + escapeCSV(severityText) + '\n';
      });
      csvContent += '\n';

      // Раздел 4: Выполнение проверок
      csvContent += escapeCSV('ВЫПОЛНЕНИЕ ГРАФИКА ПРОВЕРОК') + '\n';
      csvContent += escapeCSV('Участок') + separator + escapeCSV('План проверок') + separator + escapeCSV('Выполнено') + separator + escapeCSV('Процент выполнения') + separator + escapeCSV('Статус') + separator + escapeCSV('Последняя проверка') + separator + escapeCSV('Следующая проверка') + '\n';
      inspectionData.forEach(item => {
        const statusText = item.status === 'excellent' ? 'Отлично' :
                          item.status === 'good' ? 'Хорошо' :
                          item.status === 'warning' ? 'Требует внимания' : 'Критично';
        // Безопасная обработка дат - используем только цифры и точки
        const safeLastInspection = item.lastInspection.replace(/[^\d.]/g, '');
        const safeNextScheduled = item.nextScheduled.replace(/[^\d.]/g, '');
        csvContent += escapeCSV(item.name) + separator + item.planned + separator + item.completed + separator + escapeCSV(`${item.percentage}%`) + separator + escapeCSV(statusText) + separator + escapeCSV(safeLastInspection) + separator + escapeCSV(safeNextScheduled) + '\n';
      });
      csvContent += '\n';

      // Раздел 5: Тепловая карта чек-листов
      csvContent += escapeCSV('ОЦЕНКИ ЧЕК-ЛИСТОВ ПО УЧАСТКАМ') + '\n';
      if (heatmapData.length > 0) {
        const checklistHeaders = ['Участок', ...heatmapData[0].checklists.map((item: any) => item.name)];
        csvContent += checklistHeaders.map(escapeCSV).join(separator) + '\n';

        heatmapData.forEach(facility => {
          const row = [escapeCSV(facility.facility)];
          facility.checklists.forEach((item: any) => {
            row.push(escapeCSV(`${item.score}%`));
          });
          csvContent += row.join(separator) + '\n';
        });
      }
      csvContent += '\n';

      // Раздел 6: Анализ трендов
      csvContent += escapeCSV('АНАЛИЗ ТРЕНДОВ') + '\n';
      const totalViolations = trendsData.reduce((sum, month) => {
        return sum + facilities.slice(0, 3).reduce((facilitySum, facility) => facilitySum + (month[facility.name] || 0), 0);
      }, 0);
      const avgMonthly = Math.round(totalViolations / trendsData.length);
      csvContent += escapeCSV('Среднее количество нарушений в месяц') + separator + avgMonthly + '\n';

      const increasingMonths = trendsData.slice(1).filter((month, index) => {
        const prevTotal = facilities.slice(0, 3).reduce((sum, f) => sum + (trendsData[index][f.name] || 0), 0);
        const currTotal = facilities.slice(0, 3).reduce((sum, f) => sum + (month[f.name] || 0), 0);
        return currTotal > prevTotal;
      }).length;
      csvContent += escapeCSV('Месяцев с ростом нарушений') + separator + escapeCSV(`${increasingMonths} из ${trendsData.length - 1}`) + '\n\n';

      // Рекомендации
      csvContent += escapeCSV('РЕКОМЕНДАЦИИ') + '\n';
      if (topViolationsData.filter(v => v.severity === 'high').length > 0) {
        csvContent += escapeCSV('- Необходимо срочно устранить критические нарушения') + '\n';
      }
      if (inspectionData.some(item => item.percentage < 70)) {
        csvContent += escapeCSV('- Улучшить выполнение графика проверок на участках с низкими показателями') + '\n';
      }
      if (heatmapData.some(facility => facility.checklists.some((item: any) => item.score < 60))) {
        csvContent += escapeCSV('- Провести дополнительное обучение персонала по чек-листам') + '\n';
      }

      // Создаем файл с правильной кодировкой
      const BOM = '\uFEFF'; // UTF-8 BOM для Excel
      const csvWithBOM = BOM + csvContent;

      // Используем data URL с encodeURIComponent для максимальной совместимости
      const dataUrl = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvWithBOM);

      const link = document.createElement('a');
      link.setAttribute('href', dataUrl);
      link.setAttribute('download', `analytics_data_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } catch (error) {
      console.error('Error exporting Excel:', error);
      alert('Ошибка при экспорте данных. Попробуйте еще раз.');
    }
  };

  // Функция экспорта в PDF - используем html2canvas для сохранения кириллицы
  const handleExportPDF = async () => {
    if (!dashboardRef.current) return;

    try {
      // Создаем временный контейнер для экспорта
      const exportContainer = document.createElement('div');
      exportContainer.style.position = 'absolute';
      exportContainer.style.left = '-9999px';
      exportContainer.style.top = '-9999px';
      exportContainer.style.width = '800px';
      exportContainer.style.backgroundColor = '#ffffff';
      exportContainer.style.fontFamily = 'Arial, sans-serif';
      document.body.appendChild(exportContainer);

      // Копируем содержимое дашборда
      const dashboardClone = dashboardRef.current.cloneNode(true) as HTMLElement;

      // Удаляем элементы управления (фильтры, кнопки экспорта)
      const filtersToRemove = dashboardClone.querySelectorAll('.filters-overlay, .action-btn');
      filtersToRemove.forEach(el => el.remove());

      // Устанавливаем стили для экспорта
      dashboardClone.style.width = '800px';
      dashboardClone.style.padding = '20px';
      dashboardClone.style.backgroundColor = '#ffffff';
      dashboardClone.style.boxShadow = 'none';
      dashboardClone.style.border = 'none';

      exportContainer.appendChild(dashboardClone);

      // Создаем PDF
      const pdf = new jsPDF('portrait', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      // Создаем canvas из HTML
      const canvas = await html2canvas(dashboardClone, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        width: 800,
        height: dashboardClone.scrollHeight,
        logging: false
      });

      // Удаляем временный контейнер
      document.body.removeChild(exportContainer);

      const imgData = canvas.toDataURL('image/png', 1.0);

      // Разбиваем изображение на страницы если оно слишком большое
      const imgWidth = 210; // A4 ширина в мм
      const pageHeightPx = 297; // A4 высота в мм
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      // Добавляем первую страницу
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeightPx;

      // Добавляем дополнительные страницы если нужно
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeightPx;
      }

      // Устанавливаем метаданные
      pdf.setProperties({
        title: 'Аналитический отчет по нарушениям оборудования',
        subject: 'Отчет системы мониторинга оборудования',
        author: 'Система мониторинга',
        keywords: 'аналитика, оборудование, нарушения',
        creator: 'Система мониторинга оборудования'
      });

      // Сохраняем PDF
      const fileName = `analytics_dashboard_${new Date().toISOString().split('T')[0]}_${new Date().toISOString().split('T')[1].split('.')[0].replace(/:/g, '-')}.pdf`;
      pdf.save(fileName);

    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Ошибка при экспорте PDF. Попробуйте еще раз.');
    }
  };

  // Функция применения фильтров
  const handleApplyFilters = () => {
    setShowFilters(false);
    // Фильтры применяются автоматически через useEffect
  };

  // Функция сброса фильтров
  const handleResetFilters = () => {
    const defaultFilters = {
      period: '3m',
      facilities: facilities.map(f => f.id),
      violationType: 'all',
      inspectionStatus: 'all'
    };
    setFilters(defaultFilters);
    setTopViolationsCount(8);
    setTrendsView('facilities');
  };

  // Проверка, активны ли фильтры
  const areFiltersActive = () => {
    return (
      filters.period !== '3m' ||
      filters.facilities.length !== facilities.length ||
      filters.violationType !== 'all' ||
      filters.inspectionStatus !== 'all' ||
      topViolationsCount !== 8
    );
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip">
          <p className="tooltip-label">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="tooltip-item" style={{ color: entry.color }}>
              {entry.name}: <strong>{entry.value}</strong>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'high': return '🔴';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  };

  if (loading) {
    return (
      <div className="dashboards-container">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <div className="loading-text">Загрузка аналитики...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboards-container" ref={dashboardRef}>
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-content">
          <div className="header-title">
            <BarChart3 size={28} />
            <h1>Аналитика нарушений</h1>
          </div>
          <div className="header-actions">
            <button
              className={`action-btn ${showFilters ? 'active' : ''} ${areFiltersActive() ? 'has-filters' : ''}`}
              onClick={() => setShowFilters(true)}
            >
              <Filter size={18} />
              Фильтры
              {areFiltersActive() && <span className="filter-indicator">●</span>}
            </button>
            <button className="action-btn" onClick={handleExportExcel}>
              <FileSpreadsheet size={18} />
              Экспорт Excel
            </button>
            <button className="action-btn" onClick={handleExportPDF}>
              <Download size={18} />
              Экспорт PDF
            </button>
          </div>
        </div>

        {/* Time Range Selector */}
        <div className="time-selector">
          {['1m', '3m', '6m', '1y'].map(range => (
            <button
              key={range}
              className={`time-btn ${filters.period === range ? 'active' : ''}`}
              onClick={() => setFilters({ ...filters, period: range })}
            >
              {range === '1m' && '1 мес'}
              {range === '3m' && '3 мес'}
              {range === '6m' && '6 мес'}
              {range === '1y' && '1 год'}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Overview */}
      <div className="stats-overview">
        <div className="stat-card">
          <div className="stat-icon critical">
            <AlertTriangle size={20} />
          </div>
          <div className="stat-content">
            <div className="stat-value">
              {topViolationsData.filter(v => v.severity === 'high').length}
            </div>
            <div className="stat-label">Критические нарушения</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon warning">
            <TrendingUp size={20} />
          </div>
          <div className="stat-content">
            <div className="stat-value">
              {topViolationsData.reduce((sum, v) => sum + v.count, 0)}
            </div>
            <div className="stat-label">Всего нарушений</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon success">
            <CheckCircle size={20} />
          </div>
          <div className="stat-content">
            <div className="stat-value">
              {inspectionData.length > 0 ? Math.round(inspectionData.reduce((sum, item) => sum + item.percentage, 0) / inspectionData.length) : 0}%
            </div>
            <div className="stat-label">Выполнение плана</div>
          </div>
        </div>
      </div>

      {/* Main Dashboard Grid */}
      <div className="dashboard-grid">
        {/* Тренды нарушений по участкам/бригадам/категориям */}
        <div className="dashboard-card trends-card">
          <div className="card-header">
            <div className="card-title">
              <TrendingUp size={20} />
              <h2>Тренды нарушений</h2>
            </div>
            <div className="trends-selector">
              <button
                className={`trend-btn ${trendsView === 'facilities' ? 'active' : ''}`}
                onClick={() => setTrendsView('facilities')}
              >
                По участкам
              </button>
              <button
                className={`trend-btn ${trendsView === 'categories' ? 'active' : ''}`}
                onClick={() => setTrendsView('categories')}
              >
                По категориям
              </button>
              <button
                className={`trend-btn ${trendsView === 'teams' ? 'active' : ''}`}
                onClick={() => setTrendsView('teams')}
              >
                По бригадам
              </button>
            </div>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={trendsData}>
                <defs>
                  <linearGradient id="colorTrend1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00ff88" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#00ff88" stopOpacity={0.1}/>
                  </linearGradient>
                  <linearGradient id="colorTrend2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00cc66" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#00cc66" stopOpacity={0.1}/>
                  </linearGradient>
                  <linearGradient id="colorTrend3" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#009944" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#009944" stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="month"
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  verticalAlign="top"
                  height={36}
                  iconType="rect"
                  iconSize={12}
                />
                {(() => {
                  if (trendsView === 'facilities') {
                    return facilities.slice(0, 3).map((facility, index) => (
                      <Area
                        key={facility.id}
                        type="monotone"
                        dataKey={facility.name}
                        stroke={CHART_COLORS[index % CHART_COLORS.length]}
                        fill={`url(#colorTrend${index + 1})`}
                        strokeWidth={3}
                        dot={{ fill: CHART_COLORS[index % CHART_COLORS.length], strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6, strokeWidth: 0 }}
                      />
                    ));
                  } else if (trendsView === 'categories') {
                    return ['Вибрация', 'Температура', 'Давление'].map((category, index) => (
                      <Area
                        key={category}
                        type="monotone"
                        dataKey={category}
                        stroke={CHART_COLORS[index % CHART_COLORS.length]}
                        fill={`url(#colorTrend${index + 1})`}
                        strokeWidth={3}
                        dot={{ fill: CHART_COLORS[index % CHART_COLORS.length], strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6, strokeWidth: 0 }}
                      />
                    ));
                  } else { // teams
                    return ['Бригада А', 'Бригада Б', 'Бригада В'].map((team, index) => (
                      <Area
                        key={team}
                        type="monotone"
                        dataKey={team}
                        stroke={CHART_COLORS[index % CHART_COLORS.length]}
                        fill={`url(#colorTrend${index + 1})`}
                        strokeWidth={3}
                        dot={{ fill: CHART_COLORS[index % CHART_COLORS.length], strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6, strokeWidth: 0 }}
                      />
                    ));
                  }
                })()}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Топ повторяющихся нарушений */}
        <div className="dashboard-card violations-card">
          <div className="card-header">
            <div className="card-title">
              <AlertTriangle size={20} />
              <h2>Топ нарушений</h2>
            </div>
            <div className="violations-controls">
              <select
                value={topViolationsCount}
                onChange={(e) => setTopViolationsCount(Number(e.target.value))}
                className="count-selector"
              >
                <option value={5}>Топ 5</option>
                <option value={8}>Топ 8</option>
                <option value={10}>Топ 10</option>
                <option value={15}>Топ 15</option>
              </select>
              <span className="card-badge">{topViolationsCount} активных</span>
            </div>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={topViolationsData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f0f0f0" />
                <XAxis type="number" stroke="#666" fontSize={12} tickLine={false} />
                <YAxis 
                  type="category" 
                  dataKey="name" 
                  stroke="#666" 
                  fontSize={12}
                  tickLine={false}
                  width={120}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar 
                  dataKey="count" 
                  radius={[0, 4, 4, 0]}
                  background={{ fill: '#f5f5f5', radius: 4 }}
                >
                  {topViolationsData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={SEVERITY_COLORS[entry.severity as keyof typeof SEVERITY_COLORS] || CHART_COLORS[index % CHART_COLORS.length]} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="violations-list">
            {topViolationsData.slice(0, 3).map((violation, index) => (
              <div key={index} className="violation-item">
                <span className="severity-icon">
                  {getSeverityIcon(violation.severity)}
                </span>
                <span className="violation-name">{violation.name}</span>
                <span className="violation-count">{violation.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Выполнение графика проверок (план/факт) */}
        <div className="dashboard-card inspection-card">
          <div className="card-header">
            <div className="card-title">
              <CheckCircle size={20} />
              <h2>График проверок (План/Факт)</h2>
            </div>
            <div className="completion-rate">
              {Math.round(inspectionData.reduce((sum, item) => sum + item.percentage, 0) / inspectionData.length)}%
            </div>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={inspectionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="percentage"
                >
                  {inspectionData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        entry.status === 'excellent' ? '#00cc66' :
                        entry.status === 'good' ? '#66cc00' :
                        entry.status === 'warning' ? '#ffaa00' :
                        '#ff4444'
                      }
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pie-center-label">
              <div className="center-value">
                {Math.round(inspectionData.reduce((sum, item) => sum + item.percentage, 0) / inspectionData.length)}%
              </div>
              <div className="center-text">Выполнение плана</div>
            </div>
          </div>
          <div className="inspection-list">
            {inspectionData.map((item, index) => (
              <div key={index} className="inspection-item">
                <div className="inspection-info">
                  <div className="inspection-name">{item.name}</div>
                  <div className="inspection-details">
                    <span>План: {item.planned} | Факт: {item.completed}</span>
                    <span>Последняя: {item.lastInspection}</span>
                    <span>Следующая: {item.nextScheduled}</span>
                  </div>
                  <div className="inspection-progress">
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${item.percentage}%`,
                          backgroundColor:
                            item.status === 'excellent' ? '#00cc66' :
                            item.status === 'good' ? '#66cc00' :
                            item.status === 'warning' ? '#ffaa00' :
                            '#ff4444'
                        }}
                      ></div>
                    </div>
                    <span className="progress-text">{item.percentage}%</span>
                  </div>
                </div>
                <div className={`inspection-status ${item.status}`}>
                  {item.status === 'excellent' ? 'Отлично' :
                   item.status === 'good' ? 'Хорошо' :
                   item.status === 'warning' ? 'Требует внимания' :
                   'Критично'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Тепловая карта чек-листов */}
        <div className="dashboard-card heatmap-card">
          <div className="card-header">
            <div className="card-title">
              <BarChart3 size={20} />
              <h2>Тепловая карта чек-листов</h2>
            </div>
          </div>
          <div className="heatmap-container">
            <div className="heatmap-grid">
              <div className="heatmap-header">
                <div className="facility-label">Участок</div>
                {heatmapData[0]?.checklists.map((item: any, index: number) => (
                  <div key={index} className="checklist-label" title={item.name}>
                    {item.name.length > 15 ? item.name.substring(0, 12) + '...' : item.name}
                  </div>
                ))}
              </div>
              {heatmapData.map((facilityData: any, facilityIndex: number) => (
                <div key={facilityIndex} className="heatmap-row">
                  <div className="facility-name">{facilityData.facility}</div>
                  {facilityData.checklists.map((checklist: any, checklistIndex: number) => (
                    <div
                      key={checklistIndex}
                      className={`heatmap-cell ${checklist.status}`}
                      title={`${checklist.name}: ${checklist.score}%`}
                    >
                      {checklist.score}
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div className="heatmap-legend">
              <div className="legend-item">
                <div className="legend-color good"></div>
                <span>Хорошо (80-100%)</span>
              </div>
              <div className="legend-item">
                <div className="legend-color warning"></div>
                <span>Требует внимания (60-79%)</span>
              </div>
              <div className="legend-item">
                <div className="legend-color critical"></div>
                <span>Критично (0-59%)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Панель фильтров */}
      {showFilters && (
        <div className="filters-overlay" onClick={() => setShowFilters(false)}>
          <div className="filters-panel" onClick={(e) => e.stopPropagation()}>
            <div className="filters-header">
              <h3>Фильтры</h3>
              <button className="close-btn" onClick={() => setShowFilters(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="filters-content">
              <div className="filter-group">
                <label>Период</label>
                <select
                  value={filters.period}
                  onChange={(e) => setFilters({ ...filters, period: e.target.value })}
                >
                  <option value="3m">3 месяца</option>
                  <option value="6m">6 месяцев</option>
                  <option value="1y">1 год</option>
                  <option value="all">Все время</option>
                </select>
              </div>

              <div className="filter-group">
                <label>Участки</label>
                <div className="facilities-checkboxes">
                  {facilities.map(facility => (
                    <label key={facility.id} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={filters.facilities.includes(facility.id)}
                        onChange={(e) => {
                          const newFacilities = e.target.checked
                            ? [...filters.facilities, facility.id]
                            : filters.facilities.filter((id: string) => id !== facility.id);
                          setFilters({ ...filters, facilities: newFacilities });
                        }}
                      />
                      {facility.name}
                    </label>
                  ))}
                </div>
              </div>

              <div className="filter-group">
                <label>Тип нарушений</label>
                <select
                  value={filters.violationType}
                  onChange={(e) => setFilters({ ...filters, violationType: e.target.value })}
                >
                  <option value="all">Все нарушения</option>
                  <option value="critical">Критические</option>
                  <option value="warning">Предупреждения</option>
                  <option value="info">Информационные</option>
                </select>
              </div>

              <div className="filter-group">
                <label>Статус проверок</label>
                <select
                  value={filters.inspectionStatus}
                  onChange={(e) => setFilters({ ...filters, inspectionStatus: e.target.value })}
                >
                  <option value="all">Все</option>
                  <option value="completed">Завершены</option>
                  <option value="pending">В процессе</option>
                </select>
              </div>
            </div>

            <div className="filters-actions">
              <button
                className="reset-btn"
                onClick={handleResetFilters}
              >
                Сбросить
              </button>
              <button className="apply-btn" onClick={handleApplyFilters}>
                Применить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboards;