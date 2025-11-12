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
  created_at: string;
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
