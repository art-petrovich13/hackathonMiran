// data/objects.ts
export interface Facility {
  id: string;
  name: string;
  location: string;
  department: string;
}

export interface Device {
  id: string;
  facility_id: string;
  name: string;
  type: string;
  model: string;
  manufacturer: string;
  manufacture_date: string;
  installation_date: string;
  last_maintenance: string;
  status: 'operational' | 'maintenance' | 'critical' | 'stopped';
  specifications: {
    power_consumption?: string;
    operating_temperature?: string;
    pressure_range?: string;
    capacity?: string;
    voltage?: string;
  };
}

export interface ErrorLog {
  id: string;
  device_id: string;
  error_type: string;
  severity: number;
  description: string;
  reported_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

export interface DeviceWithErrors extends Device {
  error_logs: ErrorLog[];
  risk_score: number;
  failure_probability: number;
}

export interface FacilityWithDevices extends Facility {
  devices: DeviceWithErrors[];
  risk_level: 'low' | 'medium' | 'high';
}

export const facilities: Facility[] = [
  {
    id: 'facility-1',
    name: 'Цех металлообработки №1',
    location: 'Корпус А, Уровень 2',
    department: 'Производственный'
  },
  {
    id: 'facility-2',
    name: 'Цех сборки и монтажа',
    location: 'Корпус Б, Уровень 1',
    department: 'Сборочный'
  },
  {
    id: 'facility-3',
    name: 'Покрасочный цех',
    location: 'Корпус В, Уровень 1',
    department: 'Отделочный'
  },
  {
    id: 'facility-4',
    name: 'Цех контроля качества',
    location: 'Корпус А, Уровень 3',
    department: 'Контроля качества'
  },
  {
    id: 'facility-5',
    name: 'Упаковочный цех',
    location: 'Корпус Г, Уровень 1',
    department: 'Логистический'
  },
  {
    id: 'facility-6',
    name: 'Офис',
    location: 'Главный корпус, Уровень 1',
    department: 'Административный'
  }
];

export const devices: Device[] = [
  // Цех 1 - Цех металлообработки №1
  {
    id: 'device-1-1',
    facility_id: 'facility-1',
    name: 'ЧПУ Станок HAAS VF-2',
    type: 'cnc_mill',
    model: 'VF-2',
    manufacturer: 'HAAS Automation',
    manufacture_date: '2020-03-15',
    installation_date: '2020-05-10',
    last_maintenance: '2024-01-15',
    status: 'operational',
    specifications: {
      power_consumption: '15 kW',
      operating_temperature: '15-35°C',
      voltage: '380V'
    }
  },
  {
    id: 'device-1-2',
    facility_id: 'facility-1',
    name: 'Токарный станок DMG MORI',
    type: 'lathe',
    model: 'CLX 350',
    manufacturer: 'DMG MORI',
    manufacture_date: '2019-08-20',
    installation_date: '2019-10-05',
    last_maintenance: '2024-02-20',
    status: 'operational',
    specifications: {
      power_consumption: '12 kW',
      operating_temperature: '15-35°C',
      voltage: '380V'
    }
  },
  {
    id: 'device-1-3',
    facility_id: 'facility-1',
    name: 'Фрезерный станок MAZAK',
    type: 'milling_machine',
    model: 'VCN-430A',
    manufacturer: 'Mazak',
    manufacture_date: '2018-11-10',
    installation_date: '2019-01-15',
    last_maintenance: '2024-03-10',
    status: 'maintenance',
    specifications: {
      power_consumption: '18 kW',
      operating_temperature: '15-35°C',
      voltage: '380V'
    }
  },

  // Цех 2 - Цех сборки и монтажа
  {
    id: 'device-2-1',
    facility_id: 'facility-2',
    name: 'Автоматизированная сборочная линия',
    type: 'assembly_line',
    model: 'AL-2000',
    manufacturer: 'FANUC',
    manufacture_date: '2021-05-10',
    installation_date: '2021-07-01',
    last_maintenance: '2024-02-28',
    status: 'operational',
    specifications: {
      power_consumption: '25 kW',
      operating_temperature: '18-30°C',
      capacity: '120 units/hour'
    }
  },
  {
    id: 'device-2-2',
    facility_id: 'facility-2',
    name: 'Робот-манипулятор KUKA',
    type: 'industrial_robot',
    model: 'KR 10 R1100',
    manufacturer: 'KUKA',
    manufacture_date: '2020-09-15',
    installation_date: '2020-11-20',
    last_maintenance: '2024-03-05',
    status: 'operational',
    specifications: {
      power_consumption: '8 kW',
      operating_temperature: '5-45°C',
      voltage: '400V'
    }
  },
  {
    id: 'device-2-3',
    facility_id: 'facility-2',
    name: 'Конвейерная система',
    type: 'conveyor',
    model: 'CS-500',
    manufacturer: 'Siemens',
    manufacture_date: '2019-12-05',
    installation_date: '2020-02-10',
    last_maintenance: '2024-01-30',
    status: 'critical',
    specifications: {
      power_consumption: '7.5 kW',
      operating_temperature: '10-40°C',
      capacity: '150 units/hour'
    }
  },

  // Цех 3 - Покрасочный цех
  {
    id: 'device-3-1',
    facility_id: 'facility-3',
    name: 'Покрасочная камера',
    type: 'painting_booth',
    model: 'PB-3000',
    manufacturer: 'Global Finishing',
    manufacture_date: '2020-07-20',
    installation_date: '2020-09-15',
    last_maintenance: '2024-03-12',
    status: 'operational',
    specifications: {
      power_consumption: '35 kW',
      operating_temperature: '20-25°C',
      pressure_range: '5-8 bar'
    }
  },
  {
    id: 'device-3-2',
    facility_id: 'facility-3',
    name: 'Система вентиляции',
    type: 'ventilation_system',
    model: 'VS-800',
    manufacturer: 'AAF International',
    manufacture_date: '2020-07-15',
    installation_date: '2020-09-10',
    last_maintenance: '2024-02-15',
    status: 'operational',
    specifications: {
      power_consumption: '22 kW',
      operating_temperature: '-10-50°C',
      pressure_range: '2-10 bar'
    }
  },
  {
    id: 'device-3-3',
    facility_id: 'facility-3',
    name: 'Осушитель воздуха',
    type: 'air_dryer',
    model: 'AD-200',
    manufacturer: 'Atlas Copco',
    manufacture_date: '2019-04-10',
    installation_date: '2019-06-05',
    last_maintenance: '2024-03-01',
    status: 'maintenance',
    specifications: {
      power_consumption: '15 kW',
      operating_temperature: '5-35°C',
      pressure_range: '7-13 bar'
    }
  },

  // Цех 4 - Цех контроля качества
  {
    id: 'device-4-1',
    facility_id: 'facility-4',
    name: 'Координатно-измерительная машина',
    type: 'cmm',
    model: 'CONTURA G2',
    manufacturer: 'Carl Zeiss',
    manufacture_date: '2022-01-15',
    installation_date: '2022-03-01',
    last_maintenance: '2024-03-18',
    status: 'operational',
    specifications: {
      power_consumption: '3 kW',
      operating_temperature: '20±1°C',
      voltage: '230V'
    }
  },
  {
    id: 'device-4-2',
    facility_id: 'facility-4',
    name: 'Оптический сканер',
    type: 'optical_scanner',
    model: 'ATOS Core',
    manufacturer: 'GOM',
    manufacture_date: '2021-11-20',
    installation_date: '2022-01-10',
    last_maintenance: '2024-02-25',
    status: 'operational',
    specifications: {
      power_consumption: '1.5 kW',
      operating_temperature: '15-30°C',
      voltage: '230V'
    }
  },
  {
    id: 'device-4-3',
    facility_id: 'facility-4',
    name: 'Твердомер',
    type: 'hardness_tester',
    model: 'KB 250 PRUFT',
    manufacturer: 'KB Prüftechnik',
    manufacture_date: '2020-06-10',
    installation_date: '2020-08-05',
    last_maintenance: '2024-03-08',
    status: 'operational',
    specifications: {
      power_consumption: '0.8 kW',
      operating_temperature: '10-40°C',
      voltage: '230V'
    }
  },

  // Цех 5 - Упаковочный цех
  {
    id: 'device-5-1',
    facility_id: 'facility-5',
    name: 'Автоматическая упаковочная машина',
    type: 'packaging_machine',
    model: 'PM-450',
    manufacturer: 'Bosch',
    manufacture_date: '2021-03-05',
    installation_date: '2021-05-15',
    last_maintenance: '2024-03-14',
    status: 'operational',
    specifications: {
      power_consumption: '12 kW',
      operating_temperature: '15-35°C',
      capacity: '80 packages/min'
    }
  },
  {
    id: 'device-5-2',
    facility_id: 'facility-5',
    name: 'Палетизатор',
    type: 'palletizer',
    model: 'PLT-300',
    manufacturer: 'Columbia Machine',
    manufacture_date: '2020-10-20',
    installation_date: '2020-12-10',
    last_maintenance: '2024-02-22',
    status: 'critical',
    specifications: {
      power_consumption: '9 kW',
      operating_temperature: '5-40°C',
      capacity: '25 pallets/hour'
    }
  },
  {
    id: 'device-5-3',
    facility_id: 'facility-5',
    name: 'Термоусадочный тоннель',
    type: 'shrink_tunnel',
    model: 'ST-1800',
    manufacturer: 'ARPAC',
    manufacture_date: '2019-07-15',
    installation_date: '2019-09-20',
    last_maintenance: '2024-01-25',
    status: 'operational',
    specifications: {
      power_consumption: '28 kW',
      operating_temperature: '20-200°C',
      voltage: '400V'
    }
  },

  // Офис - facility-6
  {
    id: 'device-6-1',
    facility_id: 'facility-6',
    name: 'Серверная стойка',
    type: 'server_rack',
    model: 'Dell PowerEdge R750',
    manufacturer: 'Dell',
    manufacture_date: '2022-03-10',
    installation_date: '2022-05-15',
    last_maintenance: '2024-02-20',
    status: 'operational',
    specifications: {
      power_consumption: '5 kW',
      operating_temperature: '18-27°C',
      voltage: '230V'
    }
  },
  {
    id: 'device-6-2',
    facility_id: 'facility-6',
    name: 'Система кондиционирования',
    type: 'air_conditioning',
    model: 'Daikin VRV',
    manufacturer: 'Daikin',
    manufacture_date: '2021-08-20',
    installation_date: '2021-10-05',
    last_maintenance: '2024-03-10',
    status: 'operational',
    specifications: {
      power_consumption: '8 kW',
      operating_temperature: '16-30°C',
      capacity: '50 kBTU'
    }
  },
  {
    id: 'device-6-3',
    facility_id: 'facility-6',
    name: 'Копиро-вальный аппарат',
    type: 'copier',
    model: 'Canon iR-ADV C5250',
    manufacturer: 'Canon',
    manufacture_date: '2020-11-15',
    installation_date: '2021-01-10',
    last_maintenance: '2024-01-15',
    status: 'maintenance',
    specifications: {
      power_consumption: '2 kW',
      operating_temperature: '10-30°C',
      voltage: '230V'
    }
  }
];