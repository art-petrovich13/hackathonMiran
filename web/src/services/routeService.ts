// services/routeService.ts
interface Location {
  lat: number;
  lon: number;
}

interface Place {
  id: number;
  label: string;
  location: Location;
  durationMinutes: number;
}

export interface RouteRequest {
  places: Place[];
  start: Location;
  end: Location;
}

export interface ItineraryItem {
  id: string;
  type: 'travel' | 'visit' | 'break';
  startTime: string;
  endTime: string;
  duration: number;
  arrival?: number;
  placeId?: number;
  placeLabel?: string;
  breakType?: string;
  distance?: number;
}

export interface RouteResponse {
  plan: {
    id: string;
    itinerary: ItineraryItem[];
    unassigned: any[];
    geometry: string;
    summary: {
      cost: number;
      service: number;
      duration: number;
      violations: any[];
      travel: number;
      waiting_time: number;
    };
  };
}

export const createRoute = async (request: RouteRequest): Promise<RouteResponse> => {
  const response = await fetch('/api-u-travel/routing/plan', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
};
