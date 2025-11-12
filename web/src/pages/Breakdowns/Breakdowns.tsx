import { useEffect, useState } from 'react';
import { ChevronLeft, AlertTriangle, Clock, TrendingUp, BarChart3, Filter } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Facility, Device, ErrorLog, FacilityWithDevices, DeviceWithErrors } from '../../lib/supabase';
import { calculateDeviceRisk, getFacilityRiskLevel } from '../../utils/riskCalculator';
import './Breakdowns.scss';

function Breakdowns() {
  const [facilities, setFacilities] = useState<FacilityWithDevices[]>([]);
  const [selectedFacility, setSelectedFacility] = useState<FacilityWithDevices | null>(null);
  const [expandedDeviceId, setExpandedDeviceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [priorityView, setPriorityView] = useState<'all' | 'high' | 'critical'>('all');
  const [chartType, setChartType] = useState<'bars' | 'radar'>('bars');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const { data: facilitiesData, error: facilitiesError } = await supabase
        .from('facilities')
        .select('*')
        .order('name');

      if (facilitiesError) throw facilitiesError;

      const { data: devicesData, error: devicesError } = await supabase
        .from('devices')
        .select('*');

      if (devicesError) throw devicesError;

      const { data: errorLogsData, error: errorLogsError } = await supabase
        .from('error_logs')
        .select('*')
        .order('reported_at', { ascending: false });

      if (errorLogsError) throw errorLogsError;

      const facilitiesWithDevices: FacilityWithDevices[] = (facilitiesData as Facility[]).map(facility => {
        const facilityDevices = (devicesData as Device[]).filter(d => d.facility_id === facility.id);

        const devicesWithErrors: DeviceWithErrors[] = facilityDevices.map(device => {
          const deviceErrors = (errorLogsData as ErrorLog[]).filter(e => e.device_id === device.id);
          const { risk_score, failure_probability } = calculateDeviceRisk(device, deviceErrors);

          return {
            ...device,
            error_logs: deviceErrors,
            risk_score,
            failure_probability
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

  function handleFacilityClick(facility: FacilityWithDevices) {
    setSelectedFacility(facility);
    setExpandedDeviceId(null);
    setPriorityView('all');
  }

  function handleBackClick() {
    setSelectedFacility(null);
    setExpandedDeviceId(null);
    setPriorityView('all');
  }

  function handleDeviceClick(deviceId: string) {
    setExpandedDeviceId(expandedDeviceId === deviceId ? null : deviceId);
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

  function getPriorityLevel(device: DeviceWithErrors): 'critical' | 'high' | 'medium' | 'low' {
    if (device.risk_score >= 80 || device.failure_probability >= 50) return 'critical';
    if (device.risk_score >= 60 || device.failure_probability >= 30) return 'high';
    if (device.risk_score >= 30) return 'medium';
    return 'low';
  }

  function getPriorityColor(level: string): string {
    const colors = {
      critical: '#dc2626',
      high: '#ea580c',
      medium: '#d97706',
      low: '#10b981'
    };
    return colors[level as keyof typeof colors];
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
        <div className="loading">Загрузка данных...</div>
      </div>
    );
  }

  return (
    <div className="breakdowns-container">
      {!selectedFacility ? (
        <>
          <h1 className="header-title">Мониторинг производства</h1>
          <div className="facility-list">
            {facilities.map(facility => (
              <div
                key={facility.id}
                className={`facility-card risk-${facility.risk_level}`}
                onClick={() => handleFacilityClick(facility)}
              >
                <div className="facility-name">{facility.name}</div>
                <div className="facility-stats">
                  <span>{facility.devices.length} приборов</span>
                  <span className={`risk-badge risk-${facility.risk_level}`}>
                    {getRiskLabel(facility.risk_level)}
                  </span>
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
              <span>{selectedFacility.devices.length} приборов</span>
              <span className={`risk-badge risk-${selectedFacility.risk_level}`}>
                {getRiskLabel(selectedFacility.risk_level)}
              </span>
            </div>
          </div>

          {/* График приоритетов */}
          <div className="priority-dashboard">
            <div className="dashboard-header">
              <h3>
                <BarChart3 size={24} />
                Панель приоритетов
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
                                  Риск: {device.risk_score}%<br/>
                                  Вероятность: {device.failure_probability}%
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
                    <div className="chart-title">Радар приоритетов</div>
                    <div className="radar-container">
                      <div className="radar-grid">
                        {[0, 25, 50, 75, 100].map(level => (
                          <div key={level} className="radar-circle">
                            <span>{level}%</span>
                          </div>
                        ))}
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
                                {device.name}<br/>
                                Риск: {device.risk_score}%
                              </div>
                            </div>
                          );
                        })}
                      </div>
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
                  <h4>Рекомендации</h4>
                  <div className="urgency-list">
                    {criticalDevices.length > 0 && (
                      <div className="urgency-item critical">
                        <AlertTriangle size={16} />
                        <span>Немедленно устранить {criticalDevices.length} критических неисправностей</span>
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
                        <span>Запланировать обслуживание {riskStats.medium} устройств</span>
                      </div>
                    )}
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

              return (
                <div key={device.id} className="device-card">
                  <div
                    className={`device-header risk-${riskLevel} priority-${priority}`}
                    onClick={() => handleDeviceClick(device.id)}
                  >
                    <div className="device-info">
                      <div className="device-name-row">
                        <div className="device-name">{device.name}</div>
                        {priority === 'critical' && <AlertTriangle className="priority-icon critical" size={16} />}
                        {priority === 'high' && <Clock className="priority-icon high" size={16} />}
                        {priority === 'medium' && <span className="priority-icon medium">⚠️</span>}
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

                  {isExpanded && (
                    <div className="device-details">
                      <div className="prediction-panel">
                        <h4>Прогноз поломки</h4>
                        <p>
                          Вероятность сбоя на {device.name} в ближайшие 72 часа:{' '}
                          <span className="probability">{device.failure_probability}%</span>
                        </p>
                        {device.failure_probability > 10 && (
                          <p>
                            {device.error_logs.filter(e => e.error_type === 'vibration').length >= 2 &&
                              'Причина: Учащение сообщений о вибрации. '}
                            {getDeviceAge(device.manufacture_date) > '5.0' &&
                              'Устройство старше 5 лет. '}
                            {device.error_logs.filter(e => e.severity >= 4).length > 0 &&
                              'Обнаружены критические ошибки.'}
                          </p>
                        )}
                      </div>

                      <div className="details-table">
                        <table>
                          <thead>
                            <tr>
                              <th>Дата и время</th>
                              <th>Тип ошибки</th>
                              <th>Серьезность</th>
                            </tr>
                          </thead>
                          <tbody>
                            {device.error_logs.length > 0 ? (
                              device.error_logs.slice(0, 10).map(errorLog => (
                                <tr key={errorLog.id}>
                                  <td>{formatDateTime(errorLog.reported_at)}</td>
                                  <td>{errorLog.error_type}</td>
                                  <td>
                                    <span className={`severity-badge severity-${errorLog.severity}`}>
                                      {errorLog.severity}/5
                                    </span>
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={3} style={{ textAlign: 'center', color: '#6b7280' }}>
                                  Ошибок не обнаружено
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
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