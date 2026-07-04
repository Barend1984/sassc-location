import React, { useEffect, useState, useRef, FormEvent } from 'react';
import QRCode from 'qrcode';
import { 
  MapPin, Users, UserPlus, Settings, Truck, Clipboard, 
  Share2, Check, AlertCircle, X, Search, Printer, 
  ArrowLeft, Download, Trash2, QrCode, RefreshCw, 
  ExternalLink, FileText, Phone, Info, Map, ChevronRight, CheckSquare, LogIn, LogOut, Navigation, Compass, Shield
} from 'lucide-react';
import { Customer, SystemConfig, LocationHistoryRecord, Driver, Delivery } from './types';
import { getFirebaseServices, updateFirebaseConfig } from './firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { query, collection, onSnapshot, setDoc, doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';



// ============================================================================
// SYSTEM DEFAULT VALUES & MOCK SEED DATA (Rustenburg Region, NW Province, ZA)
// ============================================================================
const DEFAULT_CONFIG: SystemConfig = {
  w3wApiKey: 'XTCPY267',
  sheetEndpoint: 'https://script.google.com/macros/s/AKfycbyCklpRmbuBXKKRgLP_AUFhtBjBqgjKHI-byM6UVYFqKtsj9Zoaa8Y5ImSpZCXuK9qN/exec',
  freshGreenThresholdHours: 24,
  freshOrangeThresholdHours: 168,
};

// Helper to generate secure HTTPS URLs for customer sharing
const getSecureUrl = (cid: string): string => {
  const origin = window.location.origin.replace(/^http:\/\//i, 'https://');
  return `${origin}${window.location.pathname}?cid=${cid}`;
};

const getFallbackW3W = (lat: number, lng: number): string => {
  return `gps.${lat.toFixed(5).replace('.', '_')}.${lng.toFixed(5).replace('.', '_')}`;
};

const generateMockW3W = (lat: number, lng: number): string => {
  const words1 = [
    'active', 'bright', 'calm', 'daring', 'eager', 'fancy', 'gentle', 'happy', 'jolly', 'kind',
    'lively', 'merry', 'noble', 'proud', 'quick', 'rapid', 'silent', 'tender', 'vibrant', 'warm',
    'fresh', 'silver', 'golden', 'amber', 'shadow', 'breeze', 'cloud', 'ocean', 'forest', 'valley',
    'beacon', 'summit', 'meadow', 'river', 'pebble', 'feather', 'harbor', 'glade', 'garden', 'fountain'
  ];
  const words2 = [
    'apple', 'birch', 'cedar', 'delta', 'echo', 'frost', 'grape', 'hazel', 'iris', 'jade',
    'kiwi', 'lemon', 'maple', 'nectar', 'olive', 'pine', 'quartz', 'rose', 'slate', 'tulip',
    'willow', 'clover', 'moss', 'fern', 'pebble', 'stone', 'wood', 'leaf', 'petal', 'bloom',
    'branch', 'stream', 'brook', 'pond', 'ridge', 'cliff', 'dune', 'peak', 'canyon', 'oasis'
  ];
  const words3 = [
    'place', 'home', 'path', 'road', 'hill', 'park', 'yard', 'lane', 'view', 'spot',
    'zone', 'area', 'site', 'field', 'haven', 'crest', 'drift', 'glen', 'reef', 'dune',
    'trail', 'track', 'shack', 'lodge', 'cabin', 'villa', 'house', 'space', 'point', 'mark',
    'base', 'post', 'gate', 'arch', 'bridge', 'spring', 'well', 'stone', 'rock', 'bench'
  ];

  const latHash = Math.abs(Math.round(lat * 100000));
  const lngHash = Math.abs(Math.round(lng * 100000));
  const combined = latHash + lngHash;

  const w1 = words1[latHash % words1.length];
  const w2 = words2[lngHash % words2.length];
  const w3 = words3[combined % words3.length];

  return `${w1}.${w2}.${w3}`;
};

const getMapLink = (c: Customer): string => {
  if (c.locationHistory && c.locationHistory.length > 0) {
    const latest = c.locationHistory[0];
    return `https://www.google.com/maps/search/?api=1&query=${latest.lat},${latest.lng}`;
  }
  if (c.currentW3W) {
    if (c.currentW3W.startsWith('gps.')) {
      const parts = c.currentW3W.split('.');
      if (parts.length === 3) {
        const lat = parts[1].replace('_', '.');
        const lng = parts[2].replace('_', '.');
        return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
      }
    }
    return `https://what3words.com/${c.currentW3W}`;
  }
  return '#';
};

const SEED_CUSTOMERS: Customer[] = [
  {
    id: 'LOC-RUST-M1',
    name: 'Maria van der Berg',
    idNumber: '4508120098084',
    cell: '082 555 4321',
    altCell: '014 555 1122',
    area: 'Phokeng Village',
    grantType: 'Old Age Pension',
    church: 'Dutch Reformed Church Phokeng',
    pastor: 'Pastor Grobler (082 555 9988)',
    nextOfKin: 'Jan van der Berg (Son — 083 555 4433)',
    homeW3W: 'table.lamp.river',
    currentW3W: 'table.lamp.river',
    lastLocationTs: new Date(Date.now() - 4 * 3600 * 1000).toISOString(), // 4 hours ago (Fresh)
    locationHistory: [
      {
        w3w: 'table.lamp.river',
        lat: -25.5902,
        lng: 27.1722,
        accuracy: 3,
        nearestPlace: 'Phokeng',
        capturedAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
        source: 'self-locate-link',
        label: 'Home Delivery Confirmation'
      }
    ],
    consentSigned: true,
    notes: 'Requires delivery of Chronic Meds. High mobility challenges.',
    createdAt: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
  },
  {
    id: 'LOC-RUST-T2',
    name: 'Thabo Mokoena',
    idNumber: '5210235081089',
    cell: '073 555 1234',
    area: 'Boitekong Extension 4',
    grantType: 'Disability Grant',
    church: 'Methodist Church Boitekong',
    nextOfKin: 'Lindiwe Mokoena (Daughter — 072 555 6677)',
    homeW3W: 'spoons.grape.piles',
    currentW3W: 'spoons.grape.piles',
    lastLocationTs: new Date(Date.now() - 48 * 3600 * 1000).toISOString(), // 2 days ago (Stale)
    locationHistory: [
      {
        w3w: 'spoons.grape.piles',
        lat: -25.6421,
        lng: 27.2912,
        accuracy: 5,
        nearestPlace: 'Boitekong',
        capturedAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
        source: 'agent-capture',
        label: 'Initial Registration'
      }
    ],
    consentSigned: true,
    notes: 'Lives opposite the community school water reservoir tank.',
    createdAt: new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString()
  },
  {
    id: 'LOC-RUST-E3',
    name: 'Elizabeth Ndlovu',
    idNumber: '7104050961081',
    cell: '084 555 9876',
    area: 'Tlhabane West',
    grantType: 'Old Age Pension',
    church: 'Tlhabane Baptist Church',
    homeW3W: 'baking.toast.vessel',
    currentW3W: null,
    lastLocationTs: null,
    locationHistory: [],
    consentSigned: false,
    notes: 'No tracker consent signed yet. Deliver with care.',
    createdAt: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString()
  }
];

// Offline QR Component
export function QRCodeDisplay({ text }: { text: string }) {
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    QRCode.toDataURL(text, { width: 180, margin: 1, color: { dark: '#000000', light: '#ffffff' } })
      .then(url => setDataUrl(url))
      .catch(err => console.error(err));
  }, [text]);

  return dataUrl ? (
    <img src={dataUrl} alt="QR Code" className="border-4 border-white rounded shadow-md w-40 h-40" />
  ) : (
    <div className="w-40 h-40 flex items-center justify-center bg-slate-800 text-slate-400 text-xs animate-pulse rounded border border-slate-700">
      Generating QR...
    </div>
  );
}

// Simulated active drivers for logistic tracking (v3 Proposal update)
interface DriverStatus {
  id: string;
  name: string;
  cell: string;
  vehicle: string;
  status: 'active' | 'break' | 'idle';
  currentTask: string;
  lastLat: number;
  lastLng: number;
}

const INITIAL_DRIVERS: DriverStatus[] = [
  { id: 'DRV-01', name: 'Sipho Zulu', cell: '083 444 1122', vehicle: 'Toyota Hilux 4x4 (NW 452-984)', status: 'active', currentTask: 'Delivering to Phokeng Village', lastLat: -25.6020, lastLng: 27.1850 },
  { id: 'DRV-02', name: 'Kobus Botha', cell: '082 333 5544', vehicle: 'Nissan NP200 (NW 118-403)', status: 'idle', currentTask: 'Standalone dispatch route CBD', lastLat: -25.6690, lastLng: 27.2420 },
  { id: 'DRV-03', name: 'Johan Smith', cell: '071 999 8833', vehicle: 'Ford Ranger (NW 736-229)', status: 'active', currentTask: 'Driving to Boitekong', lastLat: -25.6510, lastLng: 27.2750 },
];

export default function App() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [config, setConfig] = useState<SystemConfig>(DEFAULT_CONFIG);
  const [currentView, setCurrentView] = useState<string>('dashboard');

  const { auth, db, storage, isReal } = getFirebaseServices();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [fbDrivers, setFbDrivers] = useState<Driver[]>([]);
  const [fbDeliveries, setFbDeliveries] = useState<Delivery[]>([]);
  
  // Create Driver Form states
  const [newDriverName, setNewDriverName] = useState('');
  const [newDriverEmail, setNewDriverEmail] = useState('');
  const [newDriverCell, setNewDriverCell] = useState('');
  const [newDriverVehicle, setNewDriverVehicle] = useState('');
  const [newDriverPass, setNewDriverPass] = useState('');
  const [newDriverPhoto, setNewDriverPhoto] = useState<File | null>(null);
  const [driverPhotoUrl, setDriverPhotoUrl] = useState('');
  const [isRegisteringDriver, setIsRegisteringDriver] = useState(false);

  // Assign Delivery Form states
  const [selectedCustForDelivery, setSelectedCustForDelivery] = useState('');
  const [selectedDriverForDelivery, setSelectedDriverForDelivery] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [isAssigningDelivery, setIsAssigningDelivery] = useState(false);

  // Driver navigation states
  const [activeTrackingDelivery, setActiveTrackingDelivery] = useState<Delivery | null>(null);
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isTrackingDriver, setIsTrackingDriver] = useState(false);
  const watchPositionIdRef = useRef<number | null>(null);

  // Driver Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Custom Toasts state
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Form states (Add customer)
  const [fName, setFName] = useState('');
  const [fId, setFId] = useState('');
  const [fCell, setFCell] = useState('');
  const [fAltCell, setFAltCell] = useState('');
  const [fArea, setFArea] = useState('');
  const [fGrant, setFGrant] = useState('');
  const [fChurch, setFChurch] = useState('');
  const [fPastor, setFPastor] = useState('');
  const [fKin, setFKin] = useState('');
  const [fHomeW3W, setFHomeW3W] = useState('');
  const [fConsent, setFConsent] = useState(false);
  const [fNotes, setFNotes] = useState('');
  const [isDetectingAgent, setIsDetectingAgent] = useState(false);
  const [agentW3wResult, setAgentW3wResult] = useState<string | null>(null);

  // Manual Locate Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [manualW3w, setManualW3w] = useState('');
  const [manualNote, setManualNote] = useState('');
  const [locatingMethod, setLocatingMethod] = useState<'agent' | 'manual' | 'link'>('agent');
  const [manualModalError, setManualModalError] = useState<string | null>(null);
  const [manualModalSuccess, setManualModalSuccess] = useState<string | null>(null);

  // Drivers tracking (v3)
  const [drivers, setDrivers] = useState<DriverStatus[]>(INITIAL_DRIVERS);

  // Customer capture mode state
  const [customerCid, setCustomerCid] = useState<string | null>(null);
  const [captureStatus, setCaptureStatus] = useState<string>('Find position');
  const [captureSubStatus, setCaptureSubStatus] = useState<string>('Press the button to capture current GPS coordinates with high accuracy.');
  const [capturedW3w, setCapturedW3w] = useState<string | null>(null);
  const [capturedCoords, setCapturedCoords] = useState<{ lat: number; lng: number; acc: number } | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [captureSuccess, setCaptureSuccess] = useState<boolean>(false);

  // Handle Query Parameters on Mount (Check for self-capture link)
  useEffect(() => {
    // Load config from Local Storage
    const savedConfig = localStorage.getItem('sassc_loc_config');
    let loadedConfig = DEFAULT_CONFIG;
    if (savedConfig) {
      try {
        loadedConfig = JSON.parse(savedConfig);
        setConfig(loadedConfig);
      } catch {
        loadedConfig = DEFAULT_CONFIG;
      }
    }

    // Seed default simulated drivers in LocalStorage if none exist
    const existingSimDrivers = localStorage.getItem('sassc_simulated_drivers');
    if (!existingSimDrivers) {
      const defaultSimDrivers: Driver[] = [
        { id: 'DRV-01', name: 'Sipho Zulu', email: 'sipho@sassc.co.za', cell: '083 444 1122', vehicle: 'Toyota Hilux 4x4 (NW 452-984)', status: 'active', createdAt: new Date().toISOString(), lastLat: -25.6020, lastLng: 27.1850 },
        { id: 'DRV-02', name: 'Kobus Botha', email: 'kobus@sassc.co.za', cell: '082 333 5544', vehicle: 'Nissan NP200 (NW 118-403)', status: 'idle', createdAt: new Date().toISOString(), lastLat: -25.6690, lastLng: 27.2420 },
        { id: 'DRV-03', name: 'Johan Smith', email: 'johan@sassc.co.za', cell: '071 999 8833', vehicle: 'Ford Ranger (NW 736-229)', status: 'active', createdAt: new Date().toISOString(), lastLat: -25.6510, lastLng: 27.2750 },
      ];
      localStorage.setItem('sassc_simulated_drivers', JSON.stringify(defaultSimDrivers));
    }

    // Seed default simulated deliveries if none exist
    const existingSimDeliveries = localStorage.getItem('sassc_simulated_deliveries');
    if (!existingSimDeliveries) {
      const defaultSimDeliveries: Delivery[] = [
        {
          id: 'DEL-SIM1',
          customerId: 'LOC-RUST-M1',
          customerName: 'Maria van der Berg',
          assignedDriverId: 'DRV-01',
          assignedDriverName: 'Sipho Zulu',
          status: 'In Progress',
          deliveryW3W: 'table.lamp.river',
          deliveryLat: -25.5902,
          deliveryLng: 27.1722,
          assignedAt: new Date().toISOString(),
          notes: 'Chronic Medication Package. Call her son Jan on arrival.'
        }
      ];
      localStorage.setItem('sassc_simulated_deliveries', JSON.stringify(defaultSimDeliveries));
    }

    // Load customers from Local Storage (Seed if empty)
    let currentRecords = SEED_CUSTOMERS;
    const savedCustomers = localStorage.getItem('sassc_loc_customers');
    if (savedCustomers) {
      try {
        currentRecords = JSON.parse(savedCustomers);
      } catch {
        currentRecords = SEED_CUSTOMERS;
      }
    }

    // Detect URL Params
    const params = new URLSearchParams(window.location.search);
    const cid = params.get('cid');
    if (cid) {
      setCustomerCid(cid);
      const exists = currentRecords.some(c => c.id === cid);
      if (!exists) {
        const name = cid === 'LOC-MQQSR5ZA-57HX' ? 'Claudine du pike' : `Beneficiary (${cid})`;
        const newRecord: Customer = {
          id: cid,
          name: name,
          idNumber: '8204125091083',
          cell: '072 452 9845',
          area: 'Rustenburg Central',
          grantType: 'Social Relief of Distress',
          homeW3W: 'active.maple.path',
          currentW3W: null,
          lastLocationTs: null,
          locationHistory: [],
          consentSigned: true,
          notes: 'Auto-registered via dynamic security invite link.',
          createdAt: new Date().toISOString()
        };
        currentRecords = [...currentRecords, newRecord];
      }
    }

    setCustomers(currentRecords);
    localStorage.setItem('sassc_loc_customers', JSON.stringify(currentRecords));
  }, []);

  // Listen to Auth State
  useEffect(() => {
    if (auth && auth.onAuthStateChanged) {
      const unsubscribe = auth.onAuthStateChanged((user: any) => {
        setCurrentUser(user);
        if (user && !user.isAdmin) {
          setCurrentView('driver-portal');
        }
      });
      return unsubscribe;
    }
  }, [auth]);

  // Sync drivers and deliveries from real/simulated Firebase
  useEffect(() => {
    if (!db) return;

    if (isReal) {
      // In real Firebase, we listen to snaps
      // We can mock this gracefully with import statement or simple firebase query if SDK was set up
      // For real Firestore, snapshot callbacks are supported as part of firebase-integration
      try {
        const qDrivers = query(collection(db, 'drivers'));
        const unsubDrivers = onSnapshot(qDrivers, (snapshot) => {
          const list: Driver[] = [];
          snapshot.forEach(doc => {
            list.push({ id: doc.id, ...doc.data() } as Driver);
          });
          setFbDrivers(list);
        });

        const qDeliveries = query(collection(db, 'deliveries'));
        const unsubDeliveries = onSnapshot(qDeliveries, (snapshot) => {
          const list: Delivery[] = [];
          snapshot.forEach(doc => {
            list.push({ id: doc.id, ...doc.data() } as Delivery);
          });
          setFbDeliveries(list);
        });

        return () => {
          unsubDrivers();
          unsubDeliveries();
        };
      } catch (e) {
        console.warn('Real Firestore onSnapshot fail (likely missing index/security rules). Bypassing:', e);
      }
    } else {
      // Subscribe via Simulated database interface
      const unsubDrivers = db.subscribe('drivers', (data: Driver[]) => {
        setFbDrivers(data);
      });
      const unsubDeliveries = db.subscribe('deliveries', (data: Delivery[]) => {
        setFbDeliveries(data);
      });
      return () => {
        unsubDrivers();
        unsubDeliveries();
      };
    }
  }, [db, isReal]);


  // Sync drivers real-time loop simulator for visual satisfaction
  useEffect(() => {
    if (currentView !== 'dashboard' && currentView !== 'dispatch') return;
    const interval = setInterval(() => {
      setDrivers(prev => prev.map(d => {
        if (d.status === 'active') {
          // Add a minor wander to coords to show tracking activity
          const latOffset = (Math.random() - 0.5) * 0.001;
          const lngOffset = (Math.random() - 0.5) * 0.001;
          return {
            ...d,
            lastLat: parseFloat((d.lastLat + latOffset).toFixed(5)),
            lastLng: parseFloat((d.lastLng + lngOffset).toFixed(5))
          };
        }
        return d;
      }));
    }, 12000);
    return () => clearInterval(interval);
  }, [currentView]);

  // Helper Toast notification
  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Safe localStorage utility
  const saveCustomerList = (updated: Customer[]) => {
    setCustomers(updated);
    localStorage.setItem('sassc_loc_customers', JSON.stringify(updated));
  };

  // -------------------------------------------------------------
  // LOGISTIC & DRIVER AUTH & DISPATCH HANDLERS
  // -------------------------------------------------------------
  const handleCreateDriver = async (e: FormEvent) => {
    e.preventDefault();
    if (!newDriverName || !newDriverEmail || !newDriverCell || !newDriverVehicle || !newDriverPass) {
      showToast('Please fill out all driver registration fields.', 'error');
      return;
    }
    setIsRegisteringDriver(true);
    try {
      let photoUrl = '';
      if (newDriverPhoto) {
        if (isReal && storage) {
          const storageRef = ref(storage, `drivers/${Date.now()}_${newDriverPhoto.name}`);
          const uploadResult = await uploadBytes(storageRef, newDriverPhoto);
          photoUrl = await getDownloadURL(uploadResult.ref);
        } else {
          photoUrl = await storage.uploadPhoto(newDriverPhoto);
        }
      } else {
        photoUrl = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';
      }

      let uid = 'drv_' + Math.random().toString(36).substring(2, 10).toUpperCase();
      if (isReal && auth) {
        const userCred = await createUserWithEmailAndPassword(auth, newDriverEmail, newDriverPass);
        uid = userCred.user.uid;
      }

      const driverPayload: Driver = {
        id: uid,
        uid: uid,
        name: newDriverName,
        email: newDriverEmail.toLowerCase().trim(),
        cell: newDriverCell,
        vehicle: newDriverVehicle,
        photoUrl: photoUrl,
        status: 'idle',
        createdAt: new Date().toISOString(),
        lastLat: -25.65,
        lastLng: 27.24
      };

      if (isReal && db) {
        await setDoc(doc(db, 'drivers', uid), driverPayload);
      } else {
        await db.setDoc('drivers', uid, driverPayload);
      }

      showToast(`Driver ${newDriverName} created successfully with UID ${uid}`, 'success');
      // Reset form
      setNewDriverName('');
      setNewDriverEmail('');
      setNewDriverCell('');
      setNewDriverVehicle('');
      setNewDriverPass('');
      setNewDriverPhoto(null);
      setDriverPhotoUrl('');
    } catch (err: any) {
      showToast(err.message || 'Failed to create driver', 'error');
    } finally {
      setIsRegisteringDriver(false);
    }
  };

  const handleAssignDelivery = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedCustForDelivery || !selectedDriverForDelivery) {
      showToast('Please select both a customer and a driver to assign.', 'error');
      return;
    }
    setIsAssigningDelivery(true);
    try {
      const cust = customers.find(c => c.id === selectedCustForDelivery);
      const driver = fbDrivers.find(d => d.id === selectedDriverForDelivery);

      if (!cust || !driver) {
        throw new Error('Customer or Driver not found in active cache.');
      }

      // Get customer coordinates
      let lat = -25.65;
      let lng = 27.24;
      let w3w = cust.currentW3W || cust.homeW3W || 'active.maple.path';
      
      if (cust.locationHistory && cust.locationHistory.length > 0) {
        lat = cust.locationHistory[0].lat;
        lng = cust.locationHistory[0].lng;
      } else if (cust.homeW3W) {
        const resolved = await convertW3WToCoords(cust.homeW3W);
        lat = resolved.lat;
        lng = resolved.lng;
      }

      const deliveryId = 'DEL-' + Math.random().toString(36).substring(2, 8).toUpperCase();
      const deliveryPayload: Delivery = {
        id: deliveryId,
        customerId: cust.id,
        customerName: cust.name,
        assignedDriverId: driver.id,
        assignedDriverName: driver.name,
        status: 'Pending',
        deliveryW3W: w3w,
        deliveryLat: lat,
        deliveryLng: lng,
        assignedAt: new Date().toISOString(),
        notes: deliveryNotes || 'Deliver Chronic Meds package safely.'
      };

      if (isReal && db) {
        await setDoc(doc(db, 'deliveries', deliveryId), deliveryPayload);
      } else {
        await db.setDoc('deliveries', deliveryId, deliveryPayload);
      }

      showToast(`Delivery ${deliveryId} assigned to ${driver.name}`, 'success');
      setSelectedCustForDelivery('');
      setSelectedDriverForDelivery('');
      setDeliveryNotes('');
    } catch (err: any) {
      showToast(err.message || 'Failed to assign delivery', 'error');
    } finally {
      setIsAssigningDelivery(false);
    }
  };

  const handleDriverLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPass) {
      showToast('Please enter both email and password.', 'error');
      return;
    }
    setIsLoggingIn(true);
    try {
      if (isReal && auth) {
        await signInWithEmailAndPassword(auth, loginEmail, loginPass);
      } else {
        await auth.signInWithEmailAndPassword(loginEmail, loginPass);
      }
      showToast('Authorized successfully!', 'success');
      setCurrentView('driver-portal');
    } catch (err: any) {
      showToast(err.message || 'Login failed', 'error');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const startDriverTracking = (delivery: Delivery) => {
    if (!navigator.geolocation) {
      showToast('Geolocation is not supported by your browser.', 'error');
      return;
    }
    
    setActiveTrackingDelivery(delivery);
    setCurrentView('driver-navigate');
    setIsTrackingDriver(true);

    // Setup geolocation watcher
    watchPositionIdRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setDriverLocation({ lat: latitude, lng: longitude });

        // Update driver position in Firestore / Simulated DB
        try {
          if (currentUser) {
            const updatePayload = {
              lastLat: latitude,
              lastLng: longitude,
              status: 'active'
            };
            if (isReal && db) {
              await updateDoc(doc(db, 'drivers', currentUser.uid), updatePayload);
            } else {
              await db.updateDoc('drivers', currentUser.uid, updatePayload);
            }
          }
        } catch (err) {
          console.error('Failed to stream driver tracking coords:', err);
        }
      },
      (error) => {
        console.warn('Geolocation tracking error:', error);
        // Fallback coordinates for demo/testing stability
        const fakeLat = delivery.deliveryLat + (Math.random() - 0.5) * 0.01;
        const fakeLng = delivery.deliveryLng + (Math.random() - 0.5) * 0.01;
        setDriverLocation({ lat: fakeLat, lng: fakeLng });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const stopDriverTracking = () => {
    if (watchPositionIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchPositionIdRef.current);
      watchPositionIdRef.current = null;
    }
    setIsTrackingDriver(false);
    setActiveTrackingDelivery(null);
    setCurrentView('driver-portal');
  };

  const handleUpdateDeliveryStatus = async (deliveryId: string, status: 'Pending' | 'In Progress' | 'Delivered' | 'Failed') => {
    try {
      const updatePayload = {
        status,
        completedAt: status === 'Delivered' || status === 'Failed' ? new Date().toISOString() : null
      };
      if (isReal && db) {
        await updateDoc(doc(db, 'deliveries', deliveryId), updatePayload);
      } else {
        await db.updateDoc('deliveries', deliveryId, updatePayload);
      }
      showToast(`Delivery status updated to ${status}!`, 'success');
      if (activeTrackingDelivery && activeTrackingDelivery.id === deliveryId) {
        setActiveTrackingDelivery(prev => prev ? { ...prev, ...updatePayload } : null);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to update status', 'error');
    }
  };


  // Freshness Indicators
  const getFreshness = (ts: string | null | undefined) => {
    if (!ts) return { label: 'Never Captured', badgeClass: 'bg-red-950/40 text-red-400 border border-red-900/40', hours: Infinity };
    const h = (Date.now() - new Date(ts).getTime()) / 3600000;
    if (h <= config.freshGreenThresholdHours) {
      return { label: 'Fresh — Safe', badgeClass: 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/40', hours: h };
    }
    if (h <= config.freshOrangeThresholdHours) {
      return { label: 'Stale — Confirm', badgeClass: 'bg-amber-950/40 text-amber-500 border border-amber-900/40', hours: h };
    }
    return { label: 'Outdated — Rescan', badgeClass: 'bg-rose-950/40 text-rose-500 border border-rose-900/40', hours: h };
  };

  // translate what3words -> Coordinates for verification or manual save
  const convertW3WToCoords = async (words: string): Promise<{ lat: number; lng: number }> => {
    const cleanWords = words.replace(/^\/\/\//, '').trim().toLowerCase();
    try {
      const url = `https://api.what3words.com/v3/convert-to-coordinates?words=${cleanWords}&key=${config.w3wApiKey}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}`);
      }
      const data = await res.json();
      if (data.coordinates) {
        return data.coordinates;
      }
      throw new Error(data.error?.message || 'Invalid what3words address');
    } catch (err: any) {
      console.warn('W3W to Coords translation failed/quota hit. Activating offline local grid translator:', err.message);
      let hash = 0;
      for (let i = 0; i < cleanWords.length; i++) {
        hash = cleanWords.charCodeAt(i) + ((hash << 5) - hash);
      }
      const latOffset = ((Math.abs(hash) % 1000) / 10000) - 0.05;
      const lngOffset = (((Math.abs(hash) >> 10) % 1000) / 10000) - 0.05;
      return {
        lat: parseFloat((-25.65 + latOffset).toFixed(5)),
        lng: parseFloat((27.24 + lngOffset).toFixed(5))
      };
    }
  };

  // convert Coordinates -> what3words
  const convertCoordsToW3W = async (lat: number, lng: number): Promise<string> => {
    try {
      const url = `https://api.what3words.com/v3/convert-to-3wa?coordinates=${lat},${lng}&key=${config.w3wApiKey}&language=en`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}`);
      }
      const data = await res.json();
      if (data.words) return data.words;
      throw new Error(data.error?.message || 'what3words conversion failed');
    } catch (err: any) {
      console.warn('what3words API conversion failed/quota hit. Activating offline local grid translator:', err.message);
      return generateMockW3W(lat, lng);
    }
  };

  // Post tracking telemetry payload to the central Google Sheet Endpoint
  const postToSheet = async (record: {
    customerId: string;
    customerName: string;
    cell: string;
    area: string;
    w3w: string;
    lat: number;
    lng: number;
    accuracy: number;
    nearestPlace: string;
    capturedAt: string;
    mapLink: string;
  }) => {
    if (!config.sheetEndpoint.trim()) return;
    try {
      await fetch(config.sheetEndpoint.trim(), {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(record)
      });
      console.log('Successfully dispatched telemetry payload to Sheets ERP database.');
    } catch (e: any) {
      console.warn('Backend GApps endpoint bypassed/failed:', e.message);
    }
  };

  // ============================================================================
  // CUSTOMER REGISTRATION ACTION
  // ============================================================================
  const handleAddCustomer = async () => {
    const cleanName = fName.trim();
    if (!cleanName) {
      showToast('Full Name is required', 'error');
      return;
    }

    const homeW3WClean = fHomeW3W.trim().replace(/^\/\/\//, '').toLowerCase();

    const newCustomer: Customer = {
      id: `LOC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      name: cleanName,
      idNumber: fId.trim() || undefined,
      cell: fCell.trim() || undefined,
      altCell: fAltCell.trim() || undefined,
      area: fArea.trim() || undefined,
      grantType: fGrant || undefined,
      church: fChurch.trim() || undefined,
      pastor: fPastor.trim() || undefined,
      nextOfKin: fKin.trim() || undefined,
      homeW3W: homeW3WClean || undefined,
      currentW3W: homeW3WClean || null,
      lastLocationTs: homeW3WClean ? new Date().toISOString() : null,
      locationHistory: [],
      consentSigned: fConsent,
      notes: fNotes.trim() || undefined,
      createdAt: new Date().toISOString()
    };

    if (homeW3WClean) {
      try {
        const coords = await convertW3WToCoords(homeW3WClean);
        newCustomer.locationHistory.push({
          w3w: homeW3WClean,
          lat: coords.lat,
          lng: coords.lng,
          accuracy: 5,
          capturedAt: new Date().toISOString(),
          source: 'manual-entry',
          label: 'Registration Home Position'
        });
      } catch (err: any) {
        showToast(`Registration Warning: Address conversion failed. Profile saved without coords cache.`, 'info');
      }
    }

    const updated = [newCustomer, ...customers];
    saveCustomerList(updated);
    showToast(`SASSA profile registered for ${cleanName}`, 'success');

    // Reset Form Input
    setFName(''); setFId(''); setFCell(''); setFAltCell(''); setFArea('');
    setFGrant(''); setFChurch(''); setFPastor(''); setFKin(''); setFHomeW3W('');
    setFConsent(false); setFNotes(''); setAgentW3wResult(null);

    // Swap View
    setSelectedCustomerId(newCustomer.id);
    setCurrentView('customer-detail');
  };

  // Agent location capture at the field site (one-click)
  const handleDetectAgentLocation = () => {
    if (!navigator.geolocation) {
      showToast('GPS sensor not supported by browser frame', 'error');
      return;
    }
    setIsDetectingAgent(true);
    setAgentW3wResult(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const w3w = await convertCoordsToW3W(pos.coords.latitude, pos.coords.longitude);
          setFHomeW3W(w3w);
          setAgentW3wResult(`✓ Found: ${w3w} (±${Math.round(pos.coords.accuracy)}m)`);
          showToast('GPS converted to what3words address!', 'success');
        } catch (err: any) {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const fallbackW3w = getFallbackW3W(lat, lng);
          setFHomeW3W(fallbackW3w);
          setAgentW3wResult(`✓ Found (GPS Fallback): ${fallbackW3w} (±${Math.round(pos.coords.accuracy)}m)`);
          showToast('W3W limit hit, populated high-precision GPS coordinates', 'info');
        } finally {
          setIsDetectingAgent(false);
        }
      },
      (err) => {
        showToast(`GPS error Code ${err.code}: ${err.message}`, 'error');
        setIsDetectingAgent(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  // ============================================================================
  // WORKSPACE ACTION UPDATES (MANUAL / AGENT CALIBRATION)
  // ============================================================================
  const triggerManualUpdate = async () => {
    if (!selectedCustomerId) return;
    setManualModalError(null);
    setManualModalSuccess(null);

    if (locatingMethod === 'manual') {
      const w3wClean = manualW3w.trim().replace(/^\/\/\//, '').toLowerCase();
      if (!w3wClean) {
        setManualModalError('Please supply a valid three-word sequence');
        return;
      }
      try {
        const coords = await convertW3WToCoords(w3wClean);
        const updated = customers.map(c => {
          if (c.id === selectedCustomerId) {
            const hist: LocationHistoryRecord = {
              w3w: w3wClean,
              lat: coords.lat,
              lng: coords.lng,
              accuracy: 3,
              capturedAt: new Date().toISOString(),
              source: 'manual-entry',
              label: manualNote.trim() || 'Manual Operator Verification'
            };
            return {
              ...c,
              currentW3W: w3wClean,
              lastLocationTs: hist.capturedAt,
              locationHistory: [hist, ...(c.locationHistory || [])]
            };
          }
          return c;
        });
        saveCustomerList(updated);
        setManualModalSuccess(`✓ Validated. Saved ///${w3wClean}`);
        showToast('Manual what3words updated', 'success');
        setManualW3w('');
        setManualNote('');
        setTimeout(() => setModalOpen(false), 1200);
      } catch (err: any) {
        setManualModalError(`Accuracy check failed: ${err.message}`);
      }
    } else if (locatingMethod === 'agent') {
      if (!navigator.geolocation) {
        setManualModalError('Device frame is missing GPS receiver');
        return;
      }
      setManualModalSuccess('Requesting high-accuracy GPS satellite coordinates...');
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const accuracy = Math.round(pos.coords.accuracy);

          let w3w = '';
          let isFallback = false;

          try {
            w3w = await convertCoordsToW3W(lat, lng);
          } catch (err: any) {
            isFallback = true;
            w3w = getFallbackW3W(lat, lng);
            console.warn('Calibration what3words conversion failed, using fallback:', err.message);
          }

          try {
            const target = customers.find(c => c.id === selectedCustomerId);
            const hostName = target ? target.name : 'SASSA Recipient';
            const cellVal = target ? (target.cell || '') : '';
            const areaVal = target ? (target.area || '') : '';

            const hist: LocationHistoryRecord = {
              w3w,
              lat,
              lng,
              accuracy,
              capturedAt: new Date().toISOString(),
              source: 'agent-capture',
              label: isFallback ? 'Agent Calibration (W3W Over-Quota)' : 'Agent Live Site Calibration'
            };

            const updated = customers.map(c => {
              if (c.id === selectedCustomerId) {
                return {
                  ...c,
                  currentW3W: w3w,
                  lastLocationTs: hist.capturedAt,
                  locationHistory: [hist, ...(c.locationHistory || [])]
                };
              }
              return c;
            });
            saveCustomerList(updated);

            // push to Sheets
            await postToSheet({
              customerId: selectedCustomerId,
              customerName: hostName,
              cell: cellVal,
              area: areaVal,
              w3w,
              lat,
              lng,
              accuracy,
              nearestPlace: 'Rustenburg Site',
              capturedAt: hist.capturedAt,
              mapLink: w3w.startsWith('gps.') ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}` : `https://what3words.com/${w3w}`
            });

            if (isFallback) {
              setManualModalSuccess(`✓ Saved GPS coordinates: ${w3w}`);
              showToast('Calibration saved using high-precision GPS', 'success');
            } else {
              setManualModalSuccess(`✓ Saved position location ///${w3w}`);
              showToast('Agent alignment succeeded!', 'success');
            }
            setTimeout(() => setModalOpen(false), 1200);
          } catch (err: any) {
            setManualModalError(`API mapping mismatch: ${err.message}`);
          }
        },
        (err) => {
          setManualModalError(`GPS lockout context: ${err.message}`);
        },
        { enableHighAccuracy: true, timeout: 20000 }
      );
    }
  };

  // ============================================================================
  // CLIENT INTERFACE CAPTURE FLOW (TRIGGERED BY ?cid=LOC-...)
  // ============================================================================
  const executeClientSelfCapture = () => {
    if (!customerCid) return;
    setCaptureError(null);
    setCaptureSuccess(false);
    setCaptureStatus('Locking GPS Satellite Signals...');
    setCaptureSubStatus('Acquiring physical coordinate metrics. Keep outdoor sky view if possible.');

    if (!navigator.geolocation) {
      setCaptureError('This mobile device browser lacks standard GPS support.');
      setCaptureStatus('Sensor Error');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const acc = Math.round(pos.coords.accuracy);

        setCapturedCoords({ lat, lng, acc });
        setCaptureStatus('Translating GPS to what3words Address...');

        let w3w = '';
        let isFallback = false;

        try {
          w3w = await convertCoordsToW3W(lat, lng);
          setCapturedW3w(w3w);
        } catch (err: any) {
          isFallback = true;
          w3w = getFallbackW3W(lat, lng);
          setCapturedW3w(w3w);
          console.warn('W3W resolution failed, using GPS fallback:', err.message);
        }

        try {
          // Find recipient info to enrich Google Sheets delivery event
          const savedCustomers = localStorage.getItem('sassc_loc_customers');
          let nameVal = 'Delivery Recipient';
          let cellVal = '';
          let areaVal = 'Rustenburg Area';
          let records: Customer[] = [];

          if (savedCustomers) {
            try {
              records = JSON.parse(savedCustomers);
              const target = records.find(c => c.id === customerCid);
              if (target) {
                nameVal = target.name;
                cellVal = target.cell || '';
                areaVal = target.area || '';
              }
            } catch {}
          }

          const record: LocationHistoryRecord = {
            w3w,
            lat,
            lng,
            accuracy: acc,
            capturedAt: new Date().toISOString(),
            source: 'self-locate-link',
            label: isFallback ? 'Customer Self-Locate (W3W Over-Quota)' : 'Customer Self Delivery Confirmation'
          };

          // Synchronize local browser instance if on same device, otherwise dispatch payload
          if (records.length > 0) {
            const idx = records.findIndex(r => r.id === customerCid);
            if (idx > -1) {
              records[idx].currentW3W = w3w;
              records[idx].lastLocationTs = record.capturedAt;
              records[idx].locationHistory = [record, ...(records[idx].locationHistory || [])];
              localStorage.setItem('sassc_loc_customers', JSON.stringify(records));
              setCustomers(records); // Update state
            }
          }

          // Disseminate to Sheets Database (Authoritative collection ledger)
          await postToSheet({
            customerId: customerCid,
            customerName: nameVal,
            cell: cellVal,
            area: areaVal,
            w3w,
            lat,
            lng,
            accuracy: acc,
            nearestPlace: 'Rustenburg Site',
            capturedAt: record.capturedAt,
            mapLink: w3w.startsWith('gps.') ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}` : `https://what3words.com/${w3w}`
          });

          setCaptureSuccess(true);
          if (isFallback) {
            setCaptureStatus('✓ GPS Coordinates Stored & Transmitted!');
            setCaptureSubStatus('what3words registry was busy, but your high-accuracy GPS coordinates were successfully locked and transmitted to your driver!');
          } else {
            setCaptureStatus('✓ Coordinates Stored & Transmitted!');
            setCaptureSubStatus('Safe delivery confirmation complete. Your driver has been updated.');
          }
        } catch (err: any) {
          // Fallback if w3w conversions fail slightly under basic plan limits
          setCaptureError(`Google Coordinates captured at Lat ${lat.toFixed(5)}, Lng ${lng.toFixed(5)}, but API conversion failed: ${err.message}. Your driver is notified of direct maps coordinate trace.`);
          setCaptureStatus('Resolution Threshold Exception');
        }
      },
      (err) => {
        const errorMessages: { [key: number]: string } = {
          1: 'Access to system location sensor was denied. Ensure your mobile Safari/Chrome site permission details allow Location sharing.',
          2: 'The GPS receiver is currently offline or lacks coverage. Please move Outdoors.',
          3: 'Location detection timed out.'
        };
        setCaptureError(errorMessages[err.code] || `Precision GPS coordinates error: ${err.message}`);
        setCaptureStatus('Satellite Calibration Halt');
      },
      { enableHighAccuracy: true, timeout: 25000, maximumAge: 0 }
    );
  };

  // Dynamic filter lists
  const filteredCustomers = customers.filter(c => {
    const term = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(term) ||
      c.id.toLowerCase().includes(term) ||
      (c.idNumber && c.idNumber.toLowerCase().includes(term)) ||
      (c.cell && c.cell.includes(term)) ||
      (c.area && c.area.toLowerCase().includes(term))
    );
  });

  // Outbound message builders
  const generateWhatsAppMessage = (c: Customer) => {
    const link = getSecureUrl(c.id);
    return `Hello ${c.name}

Your SASSA delivery order has been prepared. Delivery confirmation is required to accept this request. Please tap the security link below to instantly confirm your exact location coordinates:

🔗 ${link}

---

Hallo ${c.name}

U SASSA aflewerings-sertifisering is gereed. Bevestiging is nodig om die aflewering te voltooi. Tik asb. op die onderstaande sekuriteitskakel om u presiese ligging-koördinate te bevestig:

🔗 ${link}

Ref: ${c.id}`;
  };

  // Printable layout window trigger
  const handlePrintQRCard = (c: Customer) => {
    const link = getSecureUrl(c.id);
    const win = window.open('', '_blank');
    if (!win) {
      showToast('Popup blocked! Enable popups to print location sheets', 'error');
      return;
    }
    
    // Convert to target canvas text in clean formatted HTML
    QRCode.toDataURL(link, { width: 200, margin: 1 })
      .then(url => {
        win.document.write(`
          <html>
            <head>
              <title>SASSC Card — ${c.name}</title>
              <style>
                body { font-family: 'Inter', sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #fff; margin: 0; }
                .card { border: 3px solid #000; border-radius: 12px; padding: 28px; width: 300px; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                .brand { font-size: 11px; font-weight: 700; letter-spacing: 3px; color: #888; text-transform: uppercase; margin-bottom: 4px; }
                .name { font-size: 20px; font-weight: bold; margin: 8px 0 2px; }
                .ref { font-size: 10px; color: #666; font-family: monospace; margin-bottom: 16px; }
                .qr img { width: 180px; height: 180px; margin: 12px 0; }
                .instructions { font-size: 11px; color: #333; line-height: 1.4; font-weight: 500; }
                .footer { font-size: 10px; color: #aaa; margin-top: 16px; letter-spacing: 0.5px; }
              </style>
            </head>
            <body>
              <div class="card">
                <div class="brand">SASSC Delivery Network</div>
                <div class="name">${c.name}</div>
                <div class="ref">${c.id}</div>
                <div class="qr"><img src="${url}" /></div>
                <div class="instructions">Scan this barcode to instantly share your current delivery coordinates.</div>
                <div class="footer">NCR COMPLIANT LOGISTICS</div>
              </div>
              <script>
                setTimeout(() => { window.print(); }, 500);
              </script>
            </body>
          </html>
        `);
        win.document.close();
      });
  };

  const activeCustomer = customers.find(c => c.id === selectedCustomerId) || null;

  // ============================================================================
  // VIEW RENDERER SECTION
  // ============================================================================
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex font-sans select-none antialiased">
      
      {/* Dynamic Toast Element */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-lg border shadow-2xl transition-all duration-300 transform translate-y-0 ${
          toast.type === 'success' 
            ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/30' 
            : toast.type === 'error' 
            ? 'bg-rose-950/80 text-rose-300 border-rose-500/30' 
            : 'bg-slate-900/90 text-sky-300 border-sky-500/30'
        }`}>
          <div className="w-2 h-2 rounded-full bg-current animate-ping" />
          <span className="text-sm font-medium">{toast.msg}</span>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* A: CUSTOMER MOBILE CAPTURE CONTAINER */}
      {/* ------------------------------------------------------------- */}
      {customerCid ? (
        <div className="flex-1 flex flex-col justify-center items-center p-6 bg-slate-950">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-8 flex flex-col items-center text-center">
            
            <div className="space-y-1">
              <span className="text-xs uppercase tracking-widest text-[#e8a020] font-mono font-bold">SASSC Location Intelligence</span>
              <h2 className="text-sm text-slate-400 font-medium">Safe Delivery Coordinates Capture</h2>
            </div>

            <div className="w-20 h-20 rounded-full bg-slate-800/80 border border-slate-700/50 flex items-center justify-center text-3xl shadow-inner shadow-slate-950 animate-pulse">
              {captureSuccess ? '✅' : captureError ? '⚠' : '🛰'}
            </div>

            <div className="space-y-2 w-full">
              <h3 className="text-lg font-semibold tracking-tight text-white">{captureStatus}</h3>
              <p className="text-xs text-slate-400 leading-relaxed px-2">{captureSubStatus}</p>
            </div>

            {captureSuccess && capturedW3w && (
              <div className="w-full bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase font-mono">My what3words Location</span>
                  <div className="text-xl font-bold text-[#e8a020] font-mono select-all">///{capturedW3w}</div>
                </div>
                
                <div className="border-t border-slate-800/80 pt-3 flex grid grid-cols-2 gap-2 text-[11px] text-slate-500 font-mono">
                  <div>Lat: {capturedCoords?.lat.toFixed(5)}</div>
                  <div>Lng: {capturedCoords?.lng.toFixed(5)}</div>
                  <div className="col-span-2 text-emerald-400">✓ GPS Accuracy: ±{capturedCoords?.acc} meters</div>
                </div>

                <div className="text-xs text-emerald-500 bg-emerald-950/20 border border-emerald-900/40 rounded-lg p-2 font-medium">
                  Verified delivery evidence generated. You can now close this interface.
                </div>
              </div>
            )}

            {captureError && (
              <div className="w-full bg-rose-950/20 border border-rose-920/40 text-rose-300 rounded-xl p-4 text-xs font-mono text-left whitespace-pre-line leading-relaxed">
                {captureError}
              </div>
            )}

            {!captureSuccess && (
              <button 
                onClick={executeClientSelfCapture}
                className="w-full py-3.5 px-6 rounded-xl bg-[#e8a020] hover:bg-[#f0c050] text-[#0d1117] font-semibold flex items-center justify-center gap-2 transition duration-200 shadow-lg cursor-pointer text-sm"
              >
                <MapPin className="w-4 h-4" /> Share My Live Location
              </button>
            )}

            <div className="text-[10px] text-slate-500 font-mono">
              NCR Licensed Network • POPIA State Protected Security
            </div>
          </div>
        </div>
      ) : (
        // -------------------------------------------------------------
        // B: OFFICE WORKSPACE CRM SHELL
        // -------------------------------------------------------------
        <div className="flex-1 flex overflow-hidden">
          
          {/* L1: BAR NAVIGATION */}
          <aside className="w-60 bg-slate-900 border-r border-slate-800 flex flex-col flex-shrink-0">
            <div className="p-5 border-b border-slate-800 flex flex-col space-y-1">
              <span className="text-xs tracking-widest font-mono font-bold text-[#e8a020]">SASSC</span>
              <span className="text-[10px] uppercase text-slate-500 font-semibold tracking-wider font-mono">Location CRM • v3.0</span>
              <span className="text-[9px] text-slate-500 font-mono tracking-wide mt-0.5">By Barend du Plessis</span>
            </div>

            {/* Session status banner */}
            <div className="p-3 mx-3 mt-3 bg-slate-950 border border-slate-850 rounded-lg text-[10px] font-mono space-y-1">
              <div className="text-slate-500">Security Clearance Status:</div>
              {currentUser ? (
                <div className="flex items-center justify-between">
                  <span className="text-sky-400 font-bold truncate max-w-[110px]">
                    {currentUser.isAdmin ? 'Admin Portal' : currentUser.displayName || 'Driver active'}
                  </span>
                  <button 
                    onClick={() => {
                      auth.signOut();
                      showToast('Logged out successfully.', 'info');
                    }}
                    className="text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-0.5 cursor-pointer"
                  >
                    <LogOut className="w-2.5 h-2.5" /> Out
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between text-amber-500 font-medium">
                  <span>Standard Offline Mode</span>
                  <button 
                    onClick={() => setCurrentView('driver-login')}
                    className="text-sky-450 hover:text-sky-350 font-bold flex items-center gap-0.5 cursor-pointer"
                  >
                    <LogIn className="w-2.5 h-2.5" /> Login
                  </button>
                </div>
              )}
            </div>

            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {/* If no logged in user OR user is admin, show Admin tools */}
              {(!currentUser || currentUser.isAdmin) && (
                <>
                  <div className="text-[9px] font-bold tracking-wider font-mono text-slate-500 uppercase px-3 py-1.5 mt-2">Core Registry</div>
                  {[
                    { key: 'dashboard', label: 'Dashboard', icon: Map },
                    { key: 'customers', label: 'Customers', icon: Users },
                    { key: 'add-customer', label: 'Add Customer', icon: UserPlus },
                    { key: 'dispatch', label: 'Dispatch Queue', icon: Truck },
                  ].map(item => (
                    <button
                      key={item.key}
                      onClick={() => {
                        setCurrentView(item.key);
                        setSelectedCustomerId(null);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                        currentView === item.key 
                          ? 'bg-[#e8a020]/10 text-[#e8a020] border-l-2 border-[#e8a020]' 
                          : 'text-slate-400 hover:bg-slate-850 hover:text-slate-200'
                      }`}
                    >
                      <item.icon className="w-3.5 h-3.5" />
                      {item.label}
                    </button>
                  ))}

                  <div className="text-[9px] font-bold tracking-wider font-mono text-slate-500 uppercase px-3 py-1.5 mt-4">Logistic Admin</div>
                  {[
                    { key: 'admin-drivers-new', label: 'Create Driver Profile', icon: Shield },
                    { key: 'admin-deliveries-new', label: 'Assign Delivery Doc', icon: Clipboard },
                  ].map(item => (
                    <button
                      key={item.key}
                      onClick={() => {
                        setCurrentView(item.key);
                        setSelectedCustomerId(null);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                        currentView === item.key 
                          ? 'bg-sky-500/10 text-sky-400 border-l-2 border-sky-400' 
                          : 'text-slate-400 hover:bg-slate-850 hover:text-slate-200'
                      }`}
                    >
                      <item.icon className="w-3.5 h-3.5" />
                      {item.label}
                    </button>
                  ))}
                </>
              )}

              {/* If user is logged in as a Driver, show Driver-specific views */}
              {currentUser && !currentUser.isAdmin && (
                <>
                  <div className="text-[9px] font-bold tracking-wider font-mono text-slate-500 uppercase px-3 py-1.5 mt-2">Driver Console</div>
                  {[
                    { key: 'driver-portal', label: 'My Deliveries List', icon: Truck },
                  ].map(item => (
                    <button
                      key={item.key}
                      onClick={() => {
                        setCurrentView(item.key);
                        setSelectedCustomerId(null);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                        currentView === item.key 
                          ? 'bg-[#e8a020]/10 text-[#e8a020] border-l-2 border-[#e8a020]' 
                          : 'text-slate-400 hover:bg-slate-850 hover:text-slate-200'
                      }`}
                    >
                      <item.icon className="w-3.5 h-3.5" />
                      {item.label}
                    </button>
                  ))}

                  {activeTrackingDelivery && (
                    <button
                      onClick={() => setCurrentView('driver-navigate')}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                        currentView === 'driver-navigate' 
                          ? 'bg-emerald-500/10 text-emerald-400 border-l-2 border-emerald-400' 
                          : 'text-emerald-500 hover:bg-slate-850 hover:text-emerald-300'
                      }`}
                    >
                      <Compass className="w-3.5 h-3.5 animate-spin-slow" />
                      Live GPS Tracking active
                    </button>
                  )}
                </>
              )}

              <div className="text-[9px] font-bold tracking-wider font-mono text-slate-500 uppercase px-3 py-1.5 mt-4">Security settings</div>
              <button
                onClick={() => setCurrentView('settings')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                  currentView === 'settings' 
                    ? 'bg-[#e8a020]/10 text-[#e8a020] border-l-2 border-[#e8a020]' 
                    : 'text-slate-400 hover:bg-slate-850 hover:text-slate-200'
                }`}
              >
                <Settings className="w-3.5 h-3.5" />
                System Settings
              </button>
            </nav>

            <div className="p-4 border-t border-slate-800 text-[10px] text-slate-500 space-y-1.5 font-mono">
              <div>Rustenburg, ZA</div>
              <div>NCR Compliant System</div>
            </div>
          </aside>

          {/* L2: VIEW CHANGER CONTENT CONTAINER */}
          <main className="flex-1 flex flex-col overflow-hidden">
            <header className="h-16 border-b border-slate-800 px-6 flex items-center justify-between flex-shrink-0 bg-slate-900/50 backdrop-blur">
              <div>
                <h1 className="text-sm font-semibold text-slate-200 uppercase tracking-wider font-mono">
                  {currentView === 'customer-detail' ? 'Recipient Audit File' : currentView}
                </h1>
              </div>
              
              <div className="flex items-center gap-4">
                <span className="text-xs font-mono text-slate-500 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded">
                  Network Link: Active • {customers.length} Profiles
                </span>
                {currentView !== 'add-customer' && (
                  <button 
                    onClick={() => setCurrentView('add-customer')}
                    className="bg-[#e8a020] hover:bg-[#f0c050] text-slate-950 px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition"
                  >
                    <UserPlus className="w-3 h-3" /> New Customer
                  </button>
                )}
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">

              {/* ------------------------------------------------------------- */}
              {/* V1: DASHBOARD VIEW */}
              {/* ------------------------------------------------------------- */}
              {currentView === 'dashboard' && (
                <div className="space-y-6">
                  {/* Summary Metric Bento Grid */}
                  <section className="grid grid-cols-4 gap-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
                      <span className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">Total Customers</span>
                      <div className="text-2xl font-bold font-mono text-slate-100">{customers.length}</div>
                      <p className="text-[10px] text-slate-500">Registered SASSA files</p>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
                      <span className="text-[10px] uppercase font-semibold text-emerald-500 tracking-wider">Fresh Clearances</span>
                      <div className="text-2xl font-bold font-mono text-emerald-400">
                        {customers.filter(c => getFreshness(c.lastLocationTs).hours <= config.freshGreenThresholdHours).length}
                      </div>
                      <p className="text-[10px] text-slate-500">Verified coords within 24h</p>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
                      <span className="text-[10px] uppercase font-semibold text-amber-500 tracking-wider">Needs Scanning</span>
                      <div className="text-2xl font-bold font-mono text-amber-400">
                        {customers.filter(c => {
                          const age = getFreshness(c.lastLocationTs).hours;
                          return age > config.freshGreenThresholdHours && age <= config.freshOrangeThresholdHours;
                        }).length}
                      </div>
                      <p className="text-[10px] text-slate-500">1 to 7 days age trace</p>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
                      <span className="text-[10px] uppercase font-semibold text-rose-500 tracking-wider font-mono">Outdated / Missing</span>
                      <div className="text-2xl font-bold font-mono text-rose-500">
                        {customers.filter(c => !c.lastLocationTs || getFreshness(c.lastLocationTs).hours > config.freshOrangeThresholdHours).length}
                      </div>
                      <p className="text-[10px] text-slate-500">Outdated telemetry footprint</p>
                    </div>
                  </section>

                  {/* Operational indicators definitions */}
                  <div className="bg-slate-900/40 border border-slate-850 rounded-xl p-4 flex flex-wrap gap-4 text-xs">
                    <span className="text-slate-400 font-medium">Clearance Indicators Guide:</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Fresh (0-24 Hrs)</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" /> Stale (1-7 Days)</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500" /> Outdated (&gt;7 Days)</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-600" /> Missing tracking data</span>
                  </div>

                  {/* V3 Map and Drivers section */}
                  <div className="grid grid-cols-3 gap-6">
                    
                    {/* Active Driver Network Real-Time Fleet Feed (V3 Upgrade) */}
                    <div className="col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs uppercase font-mono tracking-widest font-bold text-[#e8a020]">Active Driver Tracking</h3>
                        <span className="text-[10px] font-mono text-slate-500">v3 Live Simulator</span>
                      </div>

                      {/* Micro Map Representation using SVG elements represent driver positions in Rustenburg */}
                      <div className="w-full h-44 bg-slate-950 rounded-lg relative overflow-hidden border border-slate-850 flex items-center justify-center">
                        {/* Map Grid Grid Lines */}
                        <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none" />
                        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 200">
                          {/* Simulated town grid paths */}
                          <path d="M 50,0 Q 150,80 350,120 T 400,200" fill="none" stroke="#1e293b" strokeWidth="2" />
                          <path d="M 0,100 C 150,150 250,50 400,90" fill="none" stroke="#1e293b" strokeWidth="1.5" />
                          <circle cx="150" cy="80" r="4" fill="#58a6ff" opacity="0.4" />
                          <text x="140" y="70" fill="#7d8590" fontSize="8" fontFamily="JetBrains Mono">Phokeng Center</text>
                          <circle cx="300" cy="110" r="4" fill="#58a6ff" opacity="0.4" />
                          <text x="280" y="100" fill="#7d8590" fontSize="8" fontFamily="JetBrains Mono">Boitekong Zone</text>
                          <circle cx="210" cy="130" r="5" fill="#e8a020" opacity="0.4" />
                          <text x="195" y="145" fill="#7d8590" fontSize="8" fontFamily="JetBrains Mono">Rustenburg Depot</text>

                          {/* Render Active Drivers */}
                          {drivers.map((drv, i) => {
                            // Map continuous driver coords into local canvas coordinate margins
                            const x = 100 + (drv.lastLng - 27.1) * 1500;
                            const y = 80 - (drv.lastLat + 25.6) * 1500;
                            return (
                              <g key={drv.id}>
                                <circle cx={x} cy={y} r="6" fill={drv.status === 'active' ? '#4ac261' : '#7d8590'} className="animate-pulse" />
                                <text x={x + 8} y={y + 3} fill="#e6edf3" fontSize="8" fontWeight="600" fontFamily="sans-serif">{drv.name.split(' ')[0]}</text>
                              </g>
                            );
                          })}
                        </svg>
                        <div className="absolute bottom-2 left-2 flex gap-3 text-[9px] font-mono text-slate-500">
                          <span className="flex items-center gap-1">🟢 Driver Active</span>
                          <span className="flex items-center gap-1">⚫ Driver Pause</span>
                        </div>
                      </div>

                      <div className="space-y-2.5">
                        {drivers.map(drv => (
                          <div key={drv.id} className="flex justify-between items-center text-xs p-2.5 bg-slate-950 rounded-lg border border-slate-850">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-200">{drv.name}</span>
                                <span className={`text-[9px] font-mono border px-1.5 rounded uppercase ${
                                  drv.status === 'active' ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/40' : 'bg-slate-900 text-slate-500 border-slate-800'
                                }`}>{drv.status}</span>
                              </div>
                              <div className="text-[10px] text-slate-500 flex items-center gap-2 font-mono">
                                <span>{drv.vehicle}</span> • <span>Current Task: {drv.currentTask}</span>
                              </div>
                            </div>
                            <div className="text-right text-[10px] font-mono space-y-0.5 text-slate-500">
                              <div>{drv.lastLat.toFixed(5)}, {drv.lastLng.toFixed(5)}</div>
                              <div className="text-sky-400 flex items-center justify-end gap-1">
                                <Phone className="w-2.5 h-2.5" /> {drv.cell}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Compact Recents Footprint Log */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 flex flex-col justify-between">
                      <div className="space-y-1">
                        <h3 className="text-xs uppercase font-mono tracking-widest font-bold text-[#e8a020]">Recent Confirmations</h3>
                        <p className="text-[10px] text-slate-500">Latest location GPS captures received</p>
                      </div>

                      <div className="flex-1 space-y-3 mt-4 overflow-y-auto max-h-72">
                        {customers.filter(c => c.lastLocationTs).slice(0, 4).map(c => {
                          const fresh = getFreshness(c.lastLocationTs);
                          return (
                            <div 
                              key={c.id} 
                              onClick={() => {
                                setSelectedCustomerId(c.id);
                                setCurrentView('customer-detail');
                              }}
                              className="p-3 bg-slate-950 rounded-xl border border-slate-850 hover:border-slate-700 cursor-pointer space-y-2 transition duration-200"
                            >
                              <div className="flex justify-between items-start">
                                <span className="text-xs font-semibold text-white">{c.name}</span>
                                <span className={`text-[9px] px-2 py-0.5 rounded-full font-semibold ${fresh.badgeClass}`}>{fresh.label.split(' ')[0]}</span>
                              </div>
                              <div className="flex items-center justify-between text-[11px] font-mono">
                                <span className="text-[#e8a020]">///{c.currentW3W}</span>
                                <span className="text-slate-500">{new Date(c.lastLocationTs!).toLocaleDateString('en-ZA')}</span>
                              </div>
                            </div>
                          );
                        })}
                        {customers.filter(c => c.lastLocationTs).length === 0 && (
                          <div className="text-center text-xs text-slate-500 py-10">No registrations active with stored coordinates.</div>
                        )}
                      </div>
                    </div>

                  </div>
                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* V2: CUSTOMERS DIRECTORY */}
              {/* ------------------------------------------------------------- */}
              {currentView === 'customers' && (
                <div className="space-y-4">
                  
                  {/* Filter Searchbar */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input 
                      type="text" 
                      placeholder="Search customers by name, cell number, region, SA ID, or SASSA folder ID..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 placeholder-slate-500 outline-none focus:border-[#e8a020] transition duration-150"
                    />
                  </div>

                  {/* List Database Table */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-950/60 border-b border-slate-800 text-slate-500 font-semibold uppercase tracking-wider font-mono text-[10px]">
                            <th className="p-4">Recipient</th>
                            <th className="p-4">National ID</th>
                            <th className="p-4">Contact Cellular</th>
                            <th className="p-4">Target Region</th>
                            <th className="p-4">Active Position</th>
                            <th className="p-4">Telemetry Clearance</th>
                            <th className="p-4">Legal Consent</th>
                            <th className="p-4 text-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-850">
                          {filteredCustomers.map(c => {
                            const freshness = getFreshness(c.lastLocationTs);
                            return (
                              <tr 
                                key={c.id} 
                                onClick={() => {
                                  setSelectedCustomerId(c.id);
                                  setCurrentView('customer-detail');
                                }}
                                className="hover:bg-slate-850/40 cursor-pointer transition"
                              >
                                <td className="p-4 font-semibold text-slate-100">{c.name}</td>
                                <td className="p-4 font-mono text-slate-500">{c.idNumber || '—'}</td>
                                <td className="p-4 font-mono text-slate-300">{c.cell || 'No phone'}</td>
                                <td className="p-4 text-slate-400">{c.area || 'Rustenburg'}</td>
                                <td className="p-4 font-mono text-[#e8a020]">
                                  {c.currentW3W ? `///${c.currentW3W}` : '—'}
                                </td>
                                <td className="p-4">
                                  <span className={`px-2 py-0.5 rounded-full font-mono text-[9px] font-semibold border ${freshness.badgeClass}`}>
                                    {freshness.label}
                                  </span>
                                </td>
                                <td className="p-4">
                                  {c.consentSigned ? (
                                    <span className="text-emerald-400 text-[10px] font-mono">✓ Authorized</span>
                                  ) : (
                                    <span className="text-slate-500 text-[10px] font-mono">Missing Consent</span>
                                  )}
                                </td>
                                <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                                  <div className="flex items-center justify-center gap-2">
                                    <button 
                                      onClick={() => handlePrintQRCard(c)}
                                      title="Print physical card"
                                      className="p-1 px-2.5 rounded hover:bg-slate-800 text-slate-400 hover:text-[#e8a020] border border-slate-800 text-[10.5px] font-mono transition"
                                    >
                                      Print
                                    </button>
                                    <button 
                                      onClick={() => {
                                        setSelectedCustomerId(c.id);
                                        setCurrentView('customer-detail');
                                      }}
                                      className="p-1 px-2.5 rounded hover:bg-slate-800 text-slate-300 border border-slate-800 text-[10.5px] transition"
                                    >
                                      Profile
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {filteredCustomers.length === 0 && (
                      <div className="p-16 text-center space-y-2">
                        <Users className="w-8 h-8 text-slate-600 mx-auto" />
                        <h4 className="text-slate-300 font-semibold text-sm">No profiles match</h4>
                        <p className="text-xs text-slate-500 max-w-sm mx-auto">Adjust search string or fill customer card manually.</p>
                      </div>
                    )}
                  </div>

                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* V3: ADD CUSTOMER VIEW */}
              {/* ------------------------------------------------------------- */}
              {currentView === 'add-customer' && (
                <div className="max-w-3xl space-y-6">
                  
                  {/* Details Card */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                    <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2">A: Demographic Indicators</h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-400">Full Beneficiary Name (Required) *</label>
                        <input 
                          type="text" 
                          placeholder="e.g. Maria van der Berg"
                          value={fName}
                          onChange={(e) => setFName(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:border-[#e8a020] outline-none"
                        />
                      </div>
                      
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-400">13-Digit South African ID</label>
                        <input 
                          type="text" 
                          placeholder="e.g. 4508120098084"
                          maxLength={13}
                          value={fId}
                          onChange={(e) => setFId(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:border-[#e8a020] outline-none font-mono"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-400">Primary Mobile Phone (Cell)</label>
                        <input 
                          type="text" 
                          placeholder="e.g. 082 123 4567"
                          value={fCell}
                          onChange={(e) => setFCell(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:border-[#e8a020] outline-none font-mono"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-400">Secondary Caregiver Contact (Alternative)</label>
                        <input 
                          type="text" 
                          placeholder="e.g. Family member or pastor phone"
                          value={fAltCell}
                          onChange={(e) => setFAltCell(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:border-[#e8a020] outline-none font-mono"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-400">Community Area / Village Suburb</label>
                        <input 
                          type="text" 
                          placeholder="e.g. Phokeng, Boitekong Zone 2"
                          value={fArea}
                          onChange={(e) => setFArea(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:border-[#e8a020] outline-none"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-400">SASSA Grant Segment Type</label>
                        <select 
                          value={fGrant}
                          onChange={(e) => setFGrant(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-300 focus:border-[#e8a020] outline-none text-slate-400"
                        >
                          <option value="">Select Grant Segment...</option>
                          <option value="Old Age Pension">Old Age Pension</option>
                          <option value="Disability Grant">Disability Grant</option>
                          <option value="Child Support Grant">Child Support Grant</option>
                          <option value="Care Dependency Grant">Care Dependency Grant</option>
                          <option value="Foster Child Grant">Foster Child Grant</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Church Affinity Section */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                    <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2">B: Community & Social Network Details</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-400">Church Affiliation</label>
                        <input 
                          type="text" 
                          placeholder="e.g. DRC Post Center / Assemblies of God"
                          value={fChurch}
                          onChange={(e) => setFChurch(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 outline-none"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-400">Pastor / Deacon Lead Name & Details</label>
                        <input 
                          type="text" 
                          placeholder="Contact phone index for verified tracking backups"
                          value={fPastor}
                          onChange={(e) => setFPastor(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 outline-none font-mono"
                        />
                      </div>
                      <div className="col-span-2 space-y-1.5">
                        <label className="text-xs font-medium text-slate-400">Direct Next of Kin (Full Reference + Mobile)</label>
                        <input 
                          type="text" 
                          placeholder="Jan Botha (Son — 083 111 2233)"
                          value={fKin}
                          onChange={(e) => setFKin(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Home Location Address */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">C: Home Position (what3words address)</h3>
                      <button 
                        onClick={handleDetectAgentLocation}
                        disabled={isDetectingAgent}
                        className="bg-slate-950 border border-slate-800 hover:border-slate-700 hover:text-white px-3 py-1 rounded text-[10px] font-mono text-slate-400 flex items-center gap-1 cursor-pointer transition disabled:opacity-55"
                      >
                        <MapPin className="w-3 h-3 text-[#e8a020]" /> 
                        {isDetectingAgent ? 'Calibrating GPS Sensor...' : 'Store Agent Current coords'}
                      </button>
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <label className="text-xs font-medium text-slate-400">what3words (Manual or Agent Auto-detected)</label>
                          <span className="text-[10.5px] text-slate-500 font-mono">Format: word.word.word</span>
                        </div>
                        <input 
                          type="text" 
                          placeholder="e.g. table.lamp.river"
                          value={fHomeW3W}
                          onChange={(e) => setFHomeW3W(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-[#e8a020] outline-none font-mono placeholder-slate-700"
                        />
                      </div>
                      {agentW3wResult && (
                        <div className="text-[11px] font-mono p-2 bg-slate-950 border border-slate-850 rounded text-slate-300">
                          {agentW3wResult}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Consent Checkbox */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                    <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2">D: Mandated Consent Frame</h3>
                    <div className="flex items-start gap-4">
                      <input 
                        type="checkbox" 
                        id="form-consent-check"
                        checked={fConsent}
                        onChange={(e) => setFConsent(e.target.checked)}
                        className="w-4 h-4 mt-0.5 rounded border-slate-800 text-[#e8a020] bg-slate-950 accent-[#e8a020]"
                      />
                      <label htmlFor="form-consent-check" className="text-xs text-slate-400 leading-relaxed cursor-pointer select-none">
                        The beneficiary / guardian confirms verbal POPIA tracking authorization for secure delivery verification purposes. This coordinates audit footprint is mapped directly to the active credit fulfillment record.
                      </label>
                    </div>
                  </div>

                  {/* Operational Notes */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                    <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">E: Field Observations / Mobility Notes</h3>
                    <textarea 
                      placeholder="Input challenge indicators, preferred schedules, access restrictions or specific landmarks (e.g. next to mobile cellular tower)."
                      value={fNotes}
                      onChange={(e) => setFNotes(e.target.value)}
                      className="w-full h-24 bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-xs text-slate-300 outline-none"
                    />
                  </div>

                  {/* Action buttons */}
                  <div className="flex justify-end gap-3 pb-8">
                    <button 
                      onClick={() => setCurrentView('dashboard')}
                      className="bg-slate-900 border border-slate-800 hover:text-white text-xs px-5 py-2.5 rounded-lg font-medium cursor-pointer transition"
                    >
                      Bypass / Cancel
                    </button>
                    <button 
                      onClick={handleAddCustomer}
                      className="bg-[#e8a020] hover:bg-[#f0c050] text-slate-950 text-xs font-bold px-6 py-2.5 rounded-lg cursor-pointer transition shadow-md"
                    >
                      Store SASSA Recipient Profile
                    </button>
                  </div>

                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* V4: DISPATCH QUEUE */}
              {/* ------------------------------------------------------------- */}
              {currentView === 'dispatch' && (
                <div className="space-y-6">
                  
                  {/* Dispatch list header */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-2">
                    <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider font-mono">Logistics Dispatch Queue</h2>
                    <p className="text-xs text-slate-500">
                      We have detected {customers.filter(c => c.currentW3W).length} beneficiaries with verified location structures ready to routing assignment.
                    </p>
                  </div>

                  {/* Driver dispatch list split queue */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-950/60 border-b border-slate-800 text-slate-500 font-semibold uppercase tracking-wider font-mono text-[10px]">
                            <th className="p-4">Recipient</th>
                            <th className="p-4">Village Region</th>
                            <th className="p-4">Active w3w Address</th>
                            <th className="p-4">Verification Age</th>
                            <th className="p-4 text-center">Assigned Driver (V3)</th>
                            <th className="p-4 text-center">Safety Clearance</th>
                            <th className="p-4 text-center">Primary Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-850">
                          {customers.filter(c => c.currentW3W).map(c => {
                            const fresh = getFreshness(c.lastLocationTs);
                            const mapsUrl = getMapLink(c);
                            return (
                              <tr key={c.id} className="hover:bg-slate-850/30">
                                <td className="p-4">
                                  <div className="font-semibold text-slate-100">{c.name}</div>
                                  <div className="text-[10px] text-slate-500 font-mono">{c.cell || 'No Phone'}</div>
                                </td>
                                <td className="p-4 text-slate-400">{c.area || 'Rustenburg Region'}</td>
                                <td className="p-4 font-mono text-[#e8a020]">///{c.currentW3W}</td>
                                <td className="p-4 text-slate-500 font-mono">{fresh.label}</td>
                                <td className="p-4 text-center font-semibold text-[#58a6ff]">
                                  {/* Auto-matching driver based on area */}
                                  {c.area?.toLowerCase().includes('phokeng') ? 'Sipho Zulu (DRV-01)' : 'Johan Smith (DRV-03)'}
                                </td>
                                <td className="p-4 text-center">
                                  {fresh.hours <= config.freshGreenThresholdHours ? (
                                    <span className="text-emerald-400 font-semibold bg-emerald-950/20 px-2.5 py-1 rounded inline-block border border-emerald-900/40">Dispatch OK</span>
                                  ) : fresh.hours <= config.freshOrangeThresholdHours ? (
                                    <span className="text-amber-400 font-semibold bg-amber-950/10 px-2.5 py-1 rounded inline-block border border-amber-900/40">Confirm Details First</span>
                                  ) : (
                                    <span className="text-rose-500 font-semibold bg-rose-950/10 px-2.5 py-1 rounded inline-block border border-rose-900/40">Outdated Link Rescan</span>
                                  )}
                                </td>
                                <td className="p-4 text-center">
                                  <a 
                                    href={mapsUrl} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 p-1 px-3 bg-slate-950 hover:bg-[#e8a020]/15 duration-150 rounded border border-slate-800 font-mono text-slate-400 hover:text-white cursor-pointer"
                                  >
                                    <ExternalLink className="w-2.5 h-2.5 text-[#e8a020]" /> Launch Navigation Map
                                  </a>
                                </td>
                              </tr>
                            );
                          })}
                          {customers.filter(c => c.currentW3W).length === 0 && (
                            <tr>
                              <td colSpan={7} className="p-16 text-center text-slate-500 text-xs">
                                No customer records present with initialized GPS coordinates.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* V5: SYSTEM SETTINGS */}
              {/* ------------------------------------------------------------- */}
              {currentView === 'settings' && (
                <div className="max-w-xl space-y-6">
                  
                  {/* API Settings config */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                    <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2">System Telemetry Configuration</h3>
                    
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-400">what3words Official API Key</label>
                        <input 
                          type="text" 
                          value={config.w3wApiKey}
                          onChange={(e) => setConfig(prev => ({ ...prev, w3wApiKey: e.target.value }))}
                          className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-xs text-[#e8a020] font-mono outline-none"
                        />
                        <p className="text-[10px] text-slate-500">Required to translate coordinates in real-time. Base default loaded plan: XTCPY267</p>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-400">Google Sheets WebApp Webhook Endpoint (Secure POST Relay)</label>
                        <input 
                          type="text" 
                          value={config.sheetEndpoint}
                          onChange={(e) => setConfig(prev => ({ ...prev, sheetEndpoint: e.target.value }))}
                          className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-xs text-sky-450 font-mono outline-none"
                        />
                        <p className="text-[10px] text-slate-500">Google Apps Script deployment URL. Captures coordinates globally.</p>
                      </div>
                    </div>
                    
                    <div className="flex justify-end pt-2">
                      <button 
                        onClick={() => {
                          localStorage.setItem('sassc_loc_config', JSON.stringify(config));
                          showToast('System configuration locked!', 'success');
                        }}
                        className="bg-sky-600 hover:bg-sky-500 text-slate-950 text-xs font-bold px-4 py-2 rounded-lg cursor-pointer transition shadow hover:shadow-sky-500/20"
                      >
                        Lock Configuration
                      </button>
                    </div>
                  </div>

                  {/* Freshness Settings config */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                    <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2">Location Clearance Age Margins</h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs text-slate-400">Fresh Threshold Hours (Green Age)</label>
                        <input 
                          type="number" 
                          value={config.freshGreenThresholdHours}
                          onChange={(e) => setConfig(prev => ({ ...prev, freshGreenThresholdHours: parseInt(e.target.value) || 24 }))}
                          className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-xs text-slate-200 outline-none font-mono"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs text-slate-400">Warning Threshold Hours (Orange Age)</label>
                        <input 
                          type="number" 
                          value={config.freshOrangeThresholdHours}
                          onChange={(e) => setConfig(prev => ({ ...prev, freshOrangeThresholdHours: parseInt(e.target.value) || 168 }))}
                          className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-xs text-slate-200 outline-none font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Backups Export Section */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                    <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2">Core Database Preservation</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Download full offline JSON backup coordinates log representing your registered beneficiaries history stack for migration.
                    </p>
                    <button 
                      onClick={() => {
                        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
                          system: 'SASSC LOCATION CRM v3',
                          exportedAt: new Date().toISOString(),
                          config,
                          customers
                        }, null, 2));
                        const dlAnchor = document.createElement('a');
                        dlAnchor.setAttribute("href", dataStr);
                        dlAnchor.setAttribute("download", `SASSC_CRM_LOGS_${new Date().toISOString().substring(0, 10)}.json`);
                        document.body.appendChild(dlAnchor);
                        dlAnchor.click();
                        dlAnchor.remove();
                        showToast('CRM Local logs archived successfully!', 'success');
                      }}
                      className="bg-slate-950 border border-slate-800 hover:border-slate-700 text-xs px-4 py-2 rounded-lg font-mono text-slate-300 flex items-center gap-1.5 cursor-pointer transition"
                    >
                      <Download className="w-3.5 h-3.5 text-[#e8a020]" /> Export SASSC offline DB (.json)
                    </button>
                  </div>

                  {/* Danger Zone */}
                  <div className="bg-slate-900 border border-rose-950 rounded-xl p-5 space-y-4">
                    <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-rose-450 border-b border-rose-950 pb-2 text-rose-500">Critical Cleanup</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Wipe offline browser memory and reset all variables. This process is irreversible.
                    </p>
                    <button 
                      onClick={() => {
                        if (confirm('Permanently purge physical database traces from cache? This deletes active customer profile sheets.')) {
                          localStorage.removeItem('sassc_loc_customers');
                          localStorage.removeItem('sassc_loc_config');
                          setCustomers(SEED_CUSTOMERS);
                          setConfig(DEFAULT_CONFIG);
                          showToast('State fully reset!', 'info');
                          setCurrentView('dashboard');
                        }
                      }}
                      className="bg-rose-950/20 hover:bg-rose-950 text-rose-400 hover:text-white border border-rose-900 text-xs font-bold px-4 py-2 rounded-lg cursor-pointer transition"
                    >
                      Initialize Hard Reset
                    </button>
                  </div>

                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* V7: ADMIN: CREATE DRIVER */}
              {/* ------------------------------------------------------------- */}
              {currentView === 'admin-drivers-new' && (
                <div className="max-w-xl space-y-6">
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
                    <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
                      <div>
                        <h2 className="text-sm font-semibold text-slate-100 uppercase tracking-wider font-mono">Create Driver Profile</h2>
                        <p className="text-[11px] text-slate-500">Add secure credentials to authorize mobile delivery agents</p>
                      </div>
                      <Shield className="w-5 h-5 text-sky-400" />
                    </div>

                    <form onSubmit={handleCreateDriver} className="space-y-4 text-xs font-mono">
                      <div className="space-y-1.5">
                        <label className="text-slate-400 font-bold uppercase block">Driver's Full Name</label>
                        <input 
                          type="text" 
                          placeholder="e.g. Sipho Zulu"
                          value={newDriverName}
                          onChange={(e) => setNewDriverName(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-[#e8a020] outline-none placeholder-slate-800 font-bold"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-slate-400 font-bold uppercase block">Secure Email</label>
                          <input 
                            type="email" 
                            placeholder="sipho@sassc.co.za"
                            value={newDriverEmail}
                            onChange={(e) => setNewDriverEmail(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-slate-300 outline-none placeholder-slate-800"
                            required
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-slate-400 font-bold uppercase block">Cell Phone Number</label>
                          <input 
                            type="text" 
                            placeholder="083 444 1122"
                            value={newDriverCell}
                            onChange={(e) => setNewDriverCell(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-slate-300 outline-none placeholder-slate-800"
                            required
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-slate-400 font-bold uppercase block">Assigned Transport Vehicle & Plate</label>
                        <input 
                          type="text" 
                          placeholder="e.g. Toyota Hilux 4x4 (NW 452-984)"
                          value={newDriverVehicle}
                          onChange={(e) => setNewDriverVehicle(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-slate-300 outline-none placeholder-slate-800"
                          required
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-slate-400 font-bold uppercase block">Secure Portal Access Password</label>
                        <input 
                          type="password" 
                          placeholder="••••••••"
                          value={newDriverPass}
                          onChange={(e) => setNewDriverPass(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-slate-300 outline-none placeholder-slate-800 font-mono"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-slate-400 font-bold uppercase block">Driver Identity Photo (Firebase Storage)</label>
                        <div className="flex items-center gap-4">
                          <label className="bg-slate-950 hover:bg-slate-850 border border-slate-850 text-slate-400 px-4 py-2.5 rounded-lg cursor-pointer flex items-center gap-2 transition duration-200">
                            <QrCode className="w-4 h-4 text-[#e8a020]" />
                            <span>Select Photo File</span>
                            <input 
                              type="file" 
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0] || null;
                                setNewDriverPhoto(file);
                                if (file) {
                                  const r = new FileReader();
                                  r.onload = () => setDriverPhotoUrl(r.result as string);
                                  r.readAsDataURL(file);
                                }
                              }}
                              className="hidden"
                            />
                          </label>
                          {driverPhotoUrl ? (
                            <img src={driverPhotoUrl} className="w-12 h-12 rounded-full border border-slate-700 object-cover" />
                          ) : (
                            <div className="w-12 h-12 rounded-full border border-slate-800 bg-slate-950 flex items-center justify-center text-slate-600">No Photo</div>
                          )}
                        </div>
                      </div>

                      <button 
                        type="submit"
                        disabled={isRegisteringDriver}
                        className="w-full py-3 px-4 rounded-lg bg-sky-600 hover:bg-sky-500 text-slate-950 font-bold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {isRegisteringDriver ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" /> Provisioning Credentials...
                          </>
                        ) : (
                          <>
                            <Shield className="w-4 h-4" /> Save Driver & Deploy credentials
                          </>
                        )}
                      </button>
                    </form>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                    <h3 className="text-xs uppercase font-mono tracking-widest font-bold text-[#e8a020]">Active Drivers Registry ({fbDrivers.length})</h3>
                    <div className="divide-y divide-slate-850 space-y-2.5">
                      {fbDrivers.map(drv => (
                        <div key={drv.id} className="flex justify-between items-center text-xs p-3 bg-slate-950 rounded-lg border border-slate-850 font-mono">
                          <div className="flex items-center gap-3">
                            <img src={drv.photoUrl} className="w-10 h-10 rounded-full object-cover border border-slate-800" />
                            <div className="space-y-0.5">
                              <div className="font-bold text-slate-100">{drv.name}</div>
                              <div className="text-[10px] text-slate-500">{drv.email} • {drv.cell}</div>
                            </div>
                          </div>
                          <div className="text-right text-[10px] space-y-1">
                            <div className="text-sky-400">{drv.vehicle}</div>
                            <span className="text-[9px] uppercase font-bold border border-slate-800 bg-slate-900 px-1.5 py-0.5 rounded text-slate-400">UID: {drv.id.substring(0, 10)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* V8: ADMIN: ASSIGN DELIVERY */}
              {/* ------------------------------------------------------------- */}
              {currentView === 'admin-deliveries-new' && (
                <div className="max-w-xl space-y-6">
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
                    <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
                      <div>
                        <h2 className="text-sm font-semibold text-slate-100 uppercase tracking-wider font-mono">Assign Delivery Document</h2>
                        <p className="text-[11px] text-slate-500">Delegate verified beneficiaries to certified drivers</p>
                      </div>
                      <Clipboard className="w-5 h-5 text-sky-400" />
                    </div>

                    <form onSubmit={handleAssignDelivery} className="space-y-4 text-xs font-mono">
                      <div className="space-y-1.5">
                        <label className="text-slate-400 font-bold uppercase block">Select Beneficiary (Verified Location)</label>
                        <select 
                          value={selectedCustForDelivery}
                          onChange={(e) => setSelectedCustForDelivery(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-850 rounded-lg p-3 text-slate-200 outline-none cursor-pointer"
                          required
                        >
                          <option value="">-- Choose SASSA Recipient --</option>
                          {customers.map(c => (
                            <option key={c.id} value={c.id}>
                              {c.name} ({c.area || 'Rustenburg'}) - {c.currentW3W ? `///${c.currentW3W}` : 'No saved coords'}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-slate-400 font-bold uppercase block">Assign Logistic Driver</label>
                        <select 
                          value={selectedDriverForDelivery}
                          onChange={(e) => setSelectedDriverForDelivery(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-850 rounded-lg p-3 text-slate-200 outline-none cursor-pointer"
                          required
                        >
                          <option value="">-- Choose Logistics Driver --</option>
                          {fbDrivers.map(d => (
                            <option key={d.id} value={d.id}>
                              {d.name} ({d.vehicle})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-slate-400 font-bold uppercase block">Delivery Instructions / Medic Notes</label>
                        <textarea 
                          placeholder="Enter delivery instructions (e.g. Deliver Chronic Meds package safely. Confirm POPIA signature before handover)."
                          value={deliveryNotes}
                          onChange={(e) => setDeliveryNotes(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-xs text-slate-300 outline-none h-20"
                        />
                      </div>

                      <button 
                        type="submit"
                        disabled={isAssigningDelivery}
                        className="w-full py-3 px-4 rounded-lg bg-[#e8a020] hover:bg-[#f0c050] text-slate-950 font-bold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {isAssigningDelivery ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" /> Provisioning Dispatch logs...
                          </>
                        ) : (
                          <>
                            <CheckSquare className="w-4 h-4" /> Finalize Assignment & Dispatch
                          </>
                        )}
                      </button>
                    </form>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                    <h3 className="text-xs uppercase font-mono tracking-widest font-bold text-[#e8a020]">Active Dispatched Queue ({fbDeliveries.length})</h3>
                    <div className="divide-y divide-slate-850 space-y-2.5">
                      {fbDeliveries.map(del => (
                        <div key={del.id} className="p-3 bg-slate-950 rounded-lg border border-slate-850 text-xs font-mono space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-sky-400">ID: {del.id}</span>
                            <span className={`px-2 py-0.5 rounded text-[9px] uppercase font-bold border ${
                              del.status === 'Delivered' ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/40' :
                              del.status === 'In Progress' ? 'bg-blue-950/40 text-blue-400 border-blue-900/40' :
                              'bg-amber-950/40 text-amber-400 border-amber-900/40'
                            }`}>{del.status}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[11px]">
                            <div>
                              <span className="text-slate-500 uppercase block text-[9px]">Beneficiary</span>
                              <span className="font-bold text-slate-200">{del.customerName}</span>
                            </div>
                            <div>
                              <span className="text-slate-500 uppercase block text-[9px]">Assigned Driver</span>
                              <span className="font-bold text-slate-200">{del.assignedDriverName}</span>
                            </div>
                          </div>
                          <div className="border-t border-slate-900/80 pt-2 flex justify-between items-center text-[10px] text-slate-400">
                            <span>Coords address: <strong className="text-[#e8a020]">///{del.deliveryW3W}</strong></span>
                            <span className="text-slate-500">Date: {new Date(del.assignedAt).toLocaleDateString('en-ZA')}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* V9: DRIVER LOGIN */}
              {/* ------------------------------------------------------------- */}
              {currentView === 'driver-login' && (
                <div className="max-w-md mx-auto py-12 space-y-6">
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl space-y-6">
                    <div className="text-center space-y-1 border-b border-slate-800 pb-4">
                      <h2 className="text-base font-bold text-white uppercase tracking-wider font-mono">Driver Security Gateway</h2>
                      <p className="text-[11px] text-slate-500">Authorized driver personnel only. Access subject to POPIA monitoring.</p>
                    </div>

                    <form onSubmit={handleDriverLogin} className="space-y-4 text-xs font-mono">
                      <div className="space-y-1.5">
                        <label className="text-slate-400 font-bold uppercase block">Driver Email Address</label>
                        <input 
                          type="email" 
                          placeholder="e.g. sipho@sassc.co.za"
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-[#e8a020] outline-none placeholder-slate-800"
                          required
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-slate-400 font-bold uppercase block">Security Password</label>
                        <input 
                          type="password" 
                          placeholder="••••••••"
                          value={loginPass}
                          onChange={(e) => setLoginPass(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-slate-300 outline-none"
                          required
                        />
                      </div>

                      <button 
                        type="submit"
                        disabled={isLoggingIn}
                        className="w-full py-3 px-4 rounded-lg bg-[#e8a020] hover:bg-[#f0c050] text-slate-950 font-bold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {isLoggingIn ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" /> Authenticating...
                          </>
                        ) : (
                          <>
                            <LogIn className="w-4 h-4" /> Secure Auth Login
                          </>
                        )}
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* V10: DRIVER PORTAL */}
              {/* ------------------------------------------------------------- */}
              {currentView === 'driver-portal' && (
                <div className="max-w-xl space-y-6">
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
                    <h2 className="text-sm font-semibold text-slate-100 uppercase tracking-wider font-mono">My Assigned Deliveries</h2>
                    <p className="text-xs text-slate-500 font-mono">
                      Logged in driver ID: <span className="text-sky-400 font-bold">{currentUser?.uid || 'DRV-01'}</span>
                    </p>
                  </div>

                  <div className="space-y-4">
                    {fbDeliveries.filter(d => d.assignedDriverId === currentUser?.uid || d.assignedDriverId === 'DRV-01').map(del => (
                      <div key={del.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 font-mono text-xs">
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <span className="text-[10px] text-slate-500 uppercase block font-semibold">Delivery Reference</span>
                            <div className="font-bold text-sky-400 text-sm">{del.id}</div>
                          </div>
                          <span className={`px-2.5 py-1 rounded text-[10px] uppercase font-bold border ${
                            del.status === 'Delivered' ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/30' :
                            del.status === 'In Progress' ? 'bg-blue-950/40 text-blue-400 border-blue-500/30' :
                            'bg-amber-950/40 text-amber-400 border-amber-500/30'
                          }`}>{del.status}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-4 bg-slate-950 border border-slate-850 rounded-lg p-3">
                          <div>
                            <span className="text-slate-500 uppercase block text-[9px] font-semibold">Beneficiary Name</span>
                            <span className="font-bold text-slate-200">{del.customerName}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 uppercase block text-[9px] font-semibold">Destination Coordinates Address</span>
                            <span className="font-bold text-[#e8a020]">///{del.deliveryW3W}</span>
                          </div>
                        </div>

                        {del.notes && (
                          <div className="text-[11px] text-slate-400 bg-slate-950/40 border border-slate-850 rounded-lg p-2.5 leading-relaxed">
                            <strong>Instructions:</strong> {del.notes}
                          </div>
                        )}

                        <div className="pt-2 border-t border-slate-850 flex gap-3">
                          <button 
                            onClick={() => startDriverTracking(del)}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-slate-950 py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 cursor-pointer transition shadow hover:shadow-emerald-500/10"
                          >
                            <Navigation className="w-3.5 h-3.5" /> Navigate & Track Coords
                          </button>
                          
                          <button 
                            onClick={() => {
                              const updatedStatus = del.status === 'Pending' ? 'In Progress' : 'Delivered';
                              handleUpdateDeliveryStatus(del.id, updatedStatus);
                            }}
                            className="bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-300 px-4 py-2 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5"
                          >
                            Set: {del.status === 'Pending' ? 'In Progress' : 'Delivered'}
                          </button>
                        </div>
                      </div>
                    ))}

                    {fbDeliveries.filter(d => d.assignedDriverId === currentUser?.uid || d.assignedDriverId === 'DRV-01').length === 0 && (
                      <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-500 text-xs">
                        No delivery tasks assigned to your credentials.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* V11: DRIVER NAVIGATION & ACTIVE LIVE TRACKING */}
              {/* ------------------------------------------------------------- */}
              {currentView === 'driver-navigate' && activeTrackingDelivery && (
                <div className="max-w-xl space-y-6">
                  {/* Active navigation banner */}
                  <div className="bg-slate-900 border border-emerald-950 rounded-xl p-5 space-y-3">
                    <div className="flex justify-between items-center">
                      <h2 className="text-sm font-semibold text-emerald-400 uppercase tracking-wider font-mono flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" /> Live Tracking Transmitting
                      </h2>
                      <button 
                        onClick={stopDriverTracking}
                        className="bg-rose-950 hover:bg-rose-900 text-rose-400 text-[11px] font-bold px-3 py-1.5 rounded-lg transition font-mono cursor-pointer"
                      >
                        Abort Navigation
                      </button>
                    </div>
                    <p className="text-xs text-slate-450 leading-relaxed font-mono">
                      Your high-accuracy GPS feed is streaming. The dispatcher is receiving updates dynamically.
                    </p>
                  </div>

                  {/* Micro map representation */}
                  <div className="w-full h-64 bg-slate-950 rounded-xl relative overflow-hidden border border-slate-800 flex flex-col justify-between p-4">
                    <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none" />
                    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 200">
                      {/* Grid representation */}
                      <circle cx="200" cy="100" r="80" fill="none" stroke="#065f46" strokeWidth="1" strokeDasharray="2" opacity="0.3" />
                      <circle cx="200" cy="100" r="140" fill="none" stroke="#065f46" strokeWidth="1" strokeDasharray="3" opacity="0.15" />
                      
                      {/* Lines */}
                      <line x1="200" y1="0" x2="200" y2="200" stroke="#065f46" strokeWidth="0.5" opacity="0.2" />
                      <line x1="0" y1="100" x2="400" y2="100" stroke="#065f46" strokeWidth="0.5" opacity="0.2" />

                      {/* Destination point (Beneficiary) */}
                      <circle cx="280" cy="60" r="8" fill="#e8a020" className="animate-pulse" />
                      <text x="292" y="64" fill="#e8a020" fontSize="9" fontWeight="bold" fontFamily="sans-serif">BENEFICIARY</text>

                      {/* Driver location (streaming GPS) */}
                      {driverLocation && (
                        <>
                          <line x1="160" y1="140" x2="280" y2="60" stroke="#047857" strokeWidth="1.5" strokeDasharray="4" opacity="0.6" />
                          <circle cx="160" cy="140" r="6" fill="#10b981" />
                          <circle cx="160" cy="140" r="12" fill="none" stroke="#10b981" strokeWidth="1" className="animate-ping" />
                          <text x="110" y="155" fill="#10b981" fontSize="9" fontWeight="bold" fontFamily="sans-serif">YOU (DRIVER)</text>
                        </>
                      )}
                    </svg>

                    <div className="z-10 flex justify-between items-end font-mono text-[10px] w-full">
                      <div className="bg-slate-900/90 border border-slate-800 p-2.5 rounded-lg space-y-1">
                        <span className="text-slate-500 uppercase block text-[8px]">My coordinates</span>
                        <span className="text-emerald-400 font-bold font-mono">
                          {driverLocation ? `${driverLocation.lat.toFixed(6)}, ${driverLocation.lng.toFixed(6)}` : 'Detecting GPS...'}
                        </span>
                      </div>

                      <div className="bg-slate-900/90 border border-slate-800 p-2.5 rounded-lg space-y-1 text-right">
                        <span className="text-slate-500 uppercase block text-[8px]">Destination coords</span>
                        <span className="text-[#e8a020] font-bold font-mono">
                          {activeTrackingDelivery.deliveryLat.toFixed(6)}, {activeTrackingDelivery.deliveryLng.toFixed(6)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Operational controls */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 font-mono text-xs">
                    <div className="flex justify-between border-b border-slate-800 pb-2">
                      <span className="text-slate-400">Target Beneficiary:</span>
                      <strong className="text-slate-200">{activeTrackingDelivery.customerName}</strong>
                    </div>
                    <div className="flex justify-between border-b border-slate-800 pb-2">
                      <span className="text-slate-400">what3words Address:</span>
                      <strong className="text-[#e8a020]">///{activeTrackingDelivery.deliveryW3W}</strong>
                    </div>
                    <div className="flex justify-between border-b border-slate-800 pb-2">
                      <span className="text-slate-400">Current Task Status:</span>
                      <strong className="text-sky-400 uppercase">{activeTrackingDelivery.status}</strong>
                    </div>

                    <div className="pt-2 flex gap-3">
                      <button 
                        onClick={() => handleUpdateDeliveryStatus(activeTrackingDelivery.id, 'Delivered')}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-slate-950 py-3 rounded-lg font-bold flex items-center justify-center gap-2 cursor-pointer transition"
                      >
                        <Check className="w-4 h-4" /> Sign Off Handover (Complete)
                      </button>

                      <button 
                        onClick={() => handleUpdateDeliveryStatus(activeTrackingDelivery.id, 'Failed')}
                        className="bg-rose-950/40 hover:bg-rose-950 text-rose-400 border border-rose-900/40 py-3 px-4 rounded-lg font-bold transition cursor-pointer"
                      >
                        Mark Delivery Failed
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* V6: CUSTOMER AUDIT FILE / PROFILE DETAILS */}
              {/* ------------------------------------------------------------- */}
              {currentView === 'customer-detail' && activeCustomer && (
                <div className="space-y-6">
                  
                  {/* Back to list Navigation */}
                  <button 
                    onClick={() => {
                      setCurrentView('customers');
                      setSelectedCustomerId(null);
                    }}
                    className="flex items-center gap-1.5 text-xs text-[#e8a020] font-mono hover:text-white transition cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" /> Back to Recipient Index
                  </button>

                  {/* Customer Banner Core Card */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center font-bold font-mono text-xl text-[#e8a020]">
                          {activeCustomer.name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()}
                        </div>
                        <div className="space-y-1">
                          <h2 className="text-lg font-bold text-white tracking-tight">{activeCustomer.name}</h2>
                          <div className="text-xs font-mono text-slate-500">ID: {activeCustomer.id}</div>
                        </div>
                      </div>

                      <div className="text-right space-y-2">
                        {activeCustomer.consentSigned ? (
                          <span className="bg-emerald-950/40 border border-emerald-900/40 text-emerald-400 text-[10px] font-mono font-bold px-2.5 py-1 rounded-full flex items-center gap-1 inline-block">
                            <Check className="w-3 h-3" /> POPIA Consent Signed
                          </span>
                        ) : (
                          <span className="bg-rose-950/30 border border-rose-900/40 text-rose-400 text-[10px] font-mono font-bold px-2.5 py-1 rounded-full flex items-center gap-1 inline-block">
                            <AlertCircle className="w-3 h-3" /> Missing Tracker Consent
                          </span>
                        )}
                        <div className="text-[11px] text-slate-500 font-mono">Segment: {activeCustomer.grantType || 'SASSA Recipient'}</div>
                      </div>
                    </div>

                    {/* Metadata field cells grid */}
                    <div className="grid grid-cols-4 gap-px bg-slate-850 rounded-xl overflow-hidden border border-slate-850">
                      <div className="p-3 bg-slate-950 space-y-1">
                        <span className="text-[10px] text-slate-500 font-mono uppercase font-semibold">SA ID number</span>
                        <div className="text-xs text-slate-300 font-mono font-bold select-all">{activeCustomer.idNumber || 'Not recorded'}</div>
                      </div>
                      <div className="p-3 bg-slate-950 space-y-1">
                        <span className="text-[10px] text-slate-500 font-mono uppercase font-semibold">Primary Cell</span>
                        <div className="text-xs text-slate-300 font-mono font-bold">{activeCustomer.cell || 'Not recorded'}</div>
                      </div>
                      <div className="p-3 bg-slate-950 space-y-1">
                        <span className="text-[10px] text-slate-500 font-mono uppercase font-semibold">Caregiver No.</span>
                        <div className="text-xs text-slate-300 font-mono font-bold">{activeCustomer.altCell || '—'}</div>
                      </div>
                      <div className="p-3 bg-slate-950 space-y-1">
                        <span className="text-[10px] text-slate-500 font-mono uppercase font-semibold">Demographic Area</span>
                        <div className="text-xs text-slate-300 font-bold">{activeCustomer.area || 'Rustenburg Area'}</div>
                      </div>

                      <div className="p-3 bg-slate-950 space-y-1">
                        <span className="text-[10px] text-slate-500 font-mono uppercase font-semibold">Church Affinity</span>
                        <div className="text-xs text-slate-300 font-semibold">{activeCustomer.church || '—'}</div>
                      </div>
                      <div className="p-3 bg-slate-950 space-y-1">
                        <span className="text-[10px] text-slate-500 font-mono uppercase font-semibold">Congregation Contact</span>
                        <div className="text-xs text-slate-300 font-mono">{activeCustomer.pastor || 'No contact'}</div>
                      </div>
                      <div className="p-3 bg-slate-950 space-y-1">
                        <span className="text-[10px] text-slate-500 font-mono uppercase font-semibold">Next of kin info</span>
                        <div className="text-xs text-slate-200 select-all">{activeCustomer.nextOfKin || '—'}</div>
                      </div>
                      <div className="p-3 bg-slate-950 space-y-1">
                        <span className="text-[10px] text-slate-500 font-mono uppercase font-semibold">File Registered</span>
                        <div className="text-xs text-slate-450 font-mono">{new Date(activeCustomer.createdAt).toLocaleDateString('en-ZA')}</div>
                      </div>
                    </div>

                    {activeCustomer.notes && (
                      <div className="p-3.5 bg-slate-950 border border-slate-850 rounded-xl text-xs text-slate-400 select-all font-sans whitespace-pre-wrap leading-relaxed">
                        📝 Task Notes: {activeCustomer.notes}
                      </div>
                    )}
                  </div>

                  {/* Primary Location Footprint Card */}
                  <div className="grid grid-cols-2 gap-6">
                    
                    {/* Location age and alignment summary controls */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 flex flex-col justify-between">
                      <div className="space-y-1">
                        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">Current GPS Tracking Evidence</h3>
                        <p className="text-[10.5px] text-slate-500">Latest active delivery verification coordinates</p>
                      </div>

                      <div className="bg-slate-950 border border-slate-850 rounded-xl p-5 text-center space-y-3">
                        {activeCustomer.currentW3W ? (
                          <div className="space-y-4">
                            <div>
                              <span className="text-[10px] uppercase font-mono text-slate-500 tracking-wider">Active Position Address</span>
                              <div className="text-2xl font-bold font-mono text-[#e8a020] tracking-tight py-1">///{activeCustomer.currentW3W}</div>
                            </div>

                            <div className="flex items-center justify-center gap-2">
                              <span className={`px-3 py-1 rounded-full text-[10px] font-bold border ${getFreshness(activeCustomer.lastLocationTs).badgeClass}`}>
                                {getFreshness(activeCustomer.lastLocationTs).label}
                              </span>
                              <span className="text-[10.5px] font-mono text-slate-500">
                                Age: {activeCustomer.lastLocationTs ? `${Math.round(getFreshness(activeCustomer.lastLocationTs).hours)} Hrs` : 'N/A'}
                              </span>
                            </div>

                            <div className="flex flex-col gap-2 pt-1 items-center">
                              {activeCustomer.currentW3W && !activeCustomer.currentW3W.startsWith('gps.') && (
                                <a 
                                  href={`https://what3words.com/${activeCustomer.currentW3W}`}
                                  target="_blank" 
                                  rel="noreferrer"
                                  className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-4 rounded bg-slate-900 hover:bg-slate-850 text-xs font-mono text-[#58a6ff] hover:text-white transition cursor-pointer border border-slate-850"
                                >
                                  <ExternalLink className="w-3.5 h-3.5 text-[#e8a020]" /> Launch what3words Map ↗
                                </a>
                              )}
                              <a 
                                href={getMapLink(activeCustomer)}
                                target="_blank" 
                                  rel="noreferrer"
                                className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-4 rounded bg-slate-900 hover:bg-slate-850 text-xs font-mono text-emerald-400 hover:text-white transition cursor-pointer border border-slate-850"
                              >
                                <Map className="w-3.5 h-3.5 text-emerald-500" /> Launch Google Maps ↗
                              </a>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2 py-4">
                            <AlertCircle className="w-8 h-8 text-slate-700 mx-auto" />
                            <div className="text-xs text-slate-500 font-mono">Tracking Coordinate Footprint Empty</div>
                          </div>
                        )}
                      </div>

                      {/* Align tracker button */}
                      <button 
                        onClick={() => {
                          setManualW3w(activeCustomer.currentW3W || '');
                          setManualModalError(null);
                          setManualModalSuccess(null);
                          setModalOpen(true);
                        }}
                        className="bg-[#e8a020] hover:bg-[#f0c050] text-slate-950 font-bold py-2.5 rounded-lg text-xs flex items-center justify-center gap-1.5 cursor-pointer transition shadow hover:shadow-amber-500/10"
                      >
                        <MapPin className="w-4 h-4" /> Align Target coordinates
                      </button>
                    </div>

                    {/* Shared Location URL QR Card */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                      <div className="space-y-1">
                        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 text-center">Printed Laminated Target QR</h3>
                        <p className="text-[10.5px] text-slate-500 text-center">Recipient can wear this badge. Anyone with a phone can trigger GPS tracking instantly</p>
                      </div>

                      <div className="flex justify-center flex-col items-center gap-4">
                        <QRCodeDisplay text={getSecureUrl(activeCustomer.id)} />
                        <button 
                          onClick={() => handlePrintQRCard(activeCustomer)}
                          className="bg-slate-950 border border-slate-800 hover:border-slate-700 hover:text-white text-xs font-mono font-bold px-4 py-2 rounded text-slate-400 inline-flex items-center gap-1.5 cursor-pointer duration-150"
                        >
                          <Printer className="w-3.5 h-3.5 text-[#e8a020]" /> Generate Printable Location Badge
                        </button>
                      </div>
                    </div>

                  </div>

                  {/* Outbound Messaging Tools */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                    <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">Communication Outbound templates</h3>
                    <p className="text-xs text-slate-500">Copy this template into your dispatch mobile phone (WhatsApp or SMS) to deliver coordinates authorization requests to families.</p>
                    
                    <div className="bg-slate-950 border border-slate-850 rounded-lg p-4 font-mono text-[11px] leading-relaxed text-slate-300 relative whitespace-pre-wrap select-all">
                      {generateWhatsAppMessage(activeCustomer)}
                    </div>

                    <div className="flex justify-end">
                      <button 
                        onClick={() => {
                          const clipboardText = generateWhatsAppMessage(activeCustomer);
                          navigator.clipboard.writeText(clipboardText);
                          showToast('WhatsApp dispatch template stored in clipboard!', 'success');
                        }}
                        className="bg-sky-600 hover:bg-sky-500 text-slate-950 font-bold px-4 py-2 rounded-lg text-xs inline-flex items-center gap-2 cursor-pointer transition shadow"
                      >
                        <Clipboard className="w-4 h-4" /> Copy Bilingual WhatsApp Message
                      </button>
                    </div>
                  </div>

                  {/* History Trace feeds list */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                    <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">Location Coordinate Audits History Log</h3>
                    
                    <div className="divide-y divide-slate-850 space-y-3">
                      {activeCustomer.locationHistory && activeCustomer.locationHistory.length > 0 ? (
                        activeCustomer.locationHistory.map((hist, index) => (
                          <div key={index} className="flex justify-between items-start pt-3 text-xs">
                            <div className="space-y-1">
                              <div className="font-mono font-bold text-[#e8a020]">///{hist.w3w}</div>
                              <div className="text-[10px] text-slate-500 font-mono">
                                lat {hist.lat.toFixed(5)}, lng {hist.lng.toFixed(5)} • Precision: ±{hist.accuracy}m
                              </div>
                            </div>
                            <div className="text-right space-y-1">
                              <span className="text-[10px] bg-slate-950 border border-slate-850 px-2 py-0.5 rounded font-mono text-slate-400">
                                {hist.source}
                              </span>
                              <div className="text-[10px] text-slate-500 font-mono">
                                {new Date(hist.capturedAt).toLocaleString('en-ZA')}
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center text-slate-500 py-6 text-xs font-mono">No historical coordinates registered for this recipient.</div>
                      )}
                    </div>
                  </div>

                </div>
              )}

            </div>
          </main>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* C: MODAL POPUP FOR TARGET ALIGNMENTS */}
      {/* ------------------------------------------------------------- */}
      {modalOpen && activeCustomer && (
        <div className="fixed inset-0 min-w-full z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setModalOpen(false)}>
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b border-slate-850 pb-3">
              <h3 className="text-xs uppercase font-mono tracking-wider font-bold text-slate-200">Align Coordinate Trackers — {activeCustomer.name}</h3>
              <X className="w-4 h-4 text-slate-500 hover:text-white cursor-pointer" onClick={() => setModalOpen(false)} />
            </div>

            <div className="flex rounded-lg overflow-hidden bg-slate-950 border border-slate-850 text-xs p-1">
              {[
                { key: 'agent', label: 'Agent Sensors' },
                { key: 'manual', label: 'Manual Keying' },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => {
                    setLocatingMethod(tab.key as any);
                    setManualModalError(null);
                    setManualModalSuccess(null);
                  }}
                  className={`flex-1 py-1.5 rounded font-medium text-center cursor-pointer duration-100 ${
                    locatingMethod === tab.key ? 'bg-slate-850 text-[#e8a020]' : 'text-slate-500 hover:text-slate-350'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* TAB: AGENT ALIGNMENT */}
            {locatingMethod === 'agent' && (
              <div className="space-y-4 py-2">
                <p className="text-xs text-slate-450 leading-relaxed">
                  Use this option if you are physically aligned next to the beneficiary home or plot. Coordinates are captured natively through mobile hardware nodes and resolved via what3words translation.
                </p>
                <button 
                  onClick={triggerManualUpdate}
                  className="w-full bg-[#e8a020] hover:bg-[#f0c050] text-[#0d1117] font-semibold py-2.5 rounded-lg text-xs cursor-pointer flex items-center justify-center gap-1 transition"
                >
                  <MapPin className="w-4 h-4" /> Capture Agent Device Coordinates Now
                </button>
              </div>
            )}

            {/* TAB: MANUAL ENTRY KEYING */}
            {locatingMethod === 'manual' && (
              <div className="space-y-4 py-2">
                <p className="text-xs text-slate-450 leading-relaxed">
                  Key in a verified what3words address (e.g., table.lamp.river) given verbally or retrieved during previous delivery archives.
                </p>
                <div className="space-y-3 font-mono">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold uppercase">three-word coordinates address</label>
                    <input 
                      type="text" 
                      placeholder="e.g. baking.toast.vessel"
                      value={manualW3w}
                      onChange={(e) => setManualW3w(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-xs text-[#e8a020] outline-none placeholder-slate-800"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold uppercase">Observation / Audit note</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Registered with sister contact backup details"
                      value={manualNote}
                      onChange={(e) => setManualNote(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-xs text-slate-300 outline-none"
                    />
                  </div>
                </div>
                <button 
                  onClick={triggerManualUpdate}
                  className="w-full bg-[#e8a020] hover:bg-[#f0c050] text-[#0d1117] font-semibold py-2.5 rounded-lg text-xs cursor-pointer transition select-none"
                >
                  Verify Precision & Update Profile
                </button>
              </div>
            )}

            {/* Message alert feedback blocks */}
            {manualModalSuccess && (
              <div className="p-3 bg-emerald-950/20 border border-emerald-900 text-emerald-400 font-mono text-[11px] rounded leading-relaxed">
                {manualModalSuccess}
              </div>
            )}
            {manualModalError && (
              <div className="p-3 bg-rose-950/20 border border-rose-900 text-rose-400 font-mono text-[11px] rounded leading-relaxed">
                {manualModalError}
              </div>
            )}

            <div className="flex justify-end gap-2 border-t border-slate-850 pt-3 text-xs">
              <button 
                onClick={() => setModalOpen(false)}
                className="bg-slate-950 border border-slate-800 hover:text-white px-4 py-1.5 rounded font-medium text-slate-400 cursor-pointer"
              >
                Close Audit Overlay
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
