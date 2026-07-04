export interface LocationHistoryRecord {
  w3w: string;
  lat: number;
  lng: number;
  accuracy: number;
  nearestPlace?: string;
  capturedAt: string;
  source: 'self-locate-link' | 'agent-capture' | 'manual-entry';
  label?: string;
}

export interface Customer {
  id: string; // e.g. LOC-XXXXX
  name: string;
  idNumber?: string;
  cell?: string;
  altCell?: string;
  area?: string;
  grantType?: string;
  church?: string;
  pastor?: string;
  nextOfKin?: string;
  homeW3W?: string;
  currentW3W?: string | null;
  lastLocationTs?: string | null;
  locationHistory: LocationHistoryRecord[];
  consentSigned: boolean;
  notes?: string;
  createdAt: string;
}

export interface Driver {
  id: string;
  uid?: string;
  name: string;
  email: string;
  cell: string;
  photoUrl?: string;
  vehicle: string;
  status: 'active' | 'break' | 'idle';
  createdAt: string;
  lastLat?: number;
  lastLng?: number;
}

export interface Delivery {
  id: string;
  customerId: string;
  customerName: string;
  assignedDriverId: string;
  assignedDriverName: string;
  status: 'Pending' | 'In Progress' | 'Delivered' | 'Failed';
  deliveryW3W: string;
  deliveryLat: number;
  deliveryLng: number;
  assignedAt: string;
  completedAt?: string;
  notes?: string;
}

export interface SystemConfig {
  w3wApiKey: string;
  sheetEndpoint: string;
  freshGreenThresholdHours: number; // default: 24
  freshOrangeThresholdHours: number; // default: 168 (7 days)
  firebaseApiKey?: string;
  firebaseAuthDomain?: string;
  firebaseProjectId?: string;
  firebaseStorageBucket?: string;
  firebaseMessagingSenderId?: string;
  firebaseAppId?: string;
}

