import type{ Device, ErrorLog } from '../data/objects';

export function calculateDeviceRisk(device: Device, errorLogs: ErrorLog[]) {
  let riskScore = 0;
  
  // Фактор 1: Возраст устройства (максимум 30 баллов)
  const deviceAge = getDeviceAge(device.manufacture_date);
  if (deviceAge > 10) riskScore += 30;
  else if (deviceAge > 5) riskScore += 20;
  else if (deviceAge > 2) riskScore += 10;
  
  // Фактор 2: Количество ошибок за последние 30 дней (максимум 40 баллов)
  const recentErrors = errorLogs.filter(e => {
    const daysSince = (Date.now() - new Date(e.reported_at).getTime()) / (1000 * 60 * 60 * 24);
    return daysSince <= 30;
  }).length;
  
  if (recentErrors >= 10) riskScore += 40;
  else if (recentErrors >= 5) riskScore += 30;
  else if (recentErrors >= 2) riskScore += 20;
  else if (recentErrors >= 1) riskScore += 10;
  
  // Фактор 3: Серьезность ошибок (максимум 30 баллов)
  const criticalErrors = errorLogs.filter(e => e.severity >= 4).length;
  if (criticalErrors >= 3) riskScore += 30;
  else if (criticalErrors >= 2) riskScore += 20;
  else if (criticalErrors >= 1) riskScore += 10;
  
  // Ограничиваем риск 100 баллами
  riskScore = Math.min(riskScore, 100);
  
  // Расчет вероятности сбоя на основе риска
  const failureProbability = calculateFailureProbability(riskScore, recentErrors, criticalErrors);
  
  return {
    risk_score: riskScore,
    failure_probability: failureProbability
  };
}

export function getFacilityRiskLevel(devices: any[]): 'low' | 'medium' | 'high' {
  if (devices.length === 0) return 'low';
  
  const avgRisk = devices.reduce((sum, device) => sum + device.risk_score, 0) / devices.length;
  
  if (avgRisk >= 60) return 'high';
  if (avgRisk >= 30) return 'medium';
  return 'low';
}

function getDeviceAge(manufactureDate: string): number {
  const now = new Date();
  const manufactured = new Date(manufactureDate);
  const years = (now.getTime() - manufactured.getTime()) / (1000 * 60 * 60 * 24 * 365);
  return years;
}

function calculateFailureProbability(riskScore: number, recentErrors: number, criticalErrors: number): number {
  let probability = riskScore * 0.8; // Базовая вероятность
  
  // Увеличиваем вероятность если есть критические ошибки
  if (criticalErrors > 0) {
    probability += criticalErrors * 5;
  }
  
  // Увеличиваем вероятность если много недавних ошибок
  if (recentErrors >= 5) {
    probability += 10;
  }
  
  // Ограничиваем 100%
  return Math.min(Math.round(probability), 100);
}