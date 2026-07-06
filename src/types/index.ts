// Type definitions for SASSC Location CRM

export interface Location {
  id: string;
  name: string;
  address: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  status: 'active' | 'inactive';
}

export interface CRMEntry {
  id: string;
  locationId: string;
  date: Date;
  notes: string;
}
