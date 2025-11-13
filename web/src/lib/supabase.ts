import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Facility {
  id: string;
  name: string;
  type: string;
  created_at: string;
}

export interface Device {
  id: string;
  facility_id: string;
  name: string;
  manufacture_date: string;
  created_at: string;
}

export interface ErrorLog {
  id: string;
  device_id: string;
  error_type: string;
  severity: number;
  reported_at: string;
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

export interface Facility {
  id: string;
  name: string;
  location: string;
  department: string;
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
