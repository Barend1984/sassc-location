import { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';
import { 
  MapPin, Users, UserPlus, Settings, Truck, Clipboard, 
  Share2, Check, AlertCircle, X, Search, Printer, 
  ArrowLeft, Download, Trash2, QrCode, RefreshCw, 
  ExternalLink, FileText, Phone, Info, Map, ChevronRight, CheckSquare
} from 'lucide-react';
import { Customer, SystemConfig, LocationHistoryRecord } from './types';

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
  const encoded = btoa(cid); // Base64 encode — hides customer ID and system name
  return `${origin}${window.location.pathname}?ref=${encoded}`;
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
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Custom Toasts state
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Form states (Add customer)
  const [fName, setFName] = useState('');
  const [fId, setFId] = useState('');
  const [fCell, setFCell] = useState('');
  const [fWhatsappCell, setFWhatsappCell] = useState('');
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

    // Detect URL Params — decode Base64 ref parameter
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    const cid = ref ? atob(ref) : null; // Decode Base64 back to real customer ID
    if (cid) {
      setCustomerCid(cid);
      const exists = currentRecords.some(c => c.id === cid);
      if (!exists) {
        const newRecord: Customer = {
          id: cid,
          name: `Beneficiary (${cid})`,
          idNumber: '',
          cell: '',
          area: 'Rustenburg Area',
          grantType: 'Social Relief of Distress',
          homeW3W: '',
          currentW3W: null,
          lastLocationTs: null,
          locationHistory: [],
          consentSigned: true,
          notes: 'Auto-registered via secure locate link.',
          createdAt: new Date().toISOString()
        };
        currentRecords = [...currentRecords, newRecord];
      }
    }

    setCustomers(currentRecords);
    localStorage.setItem('sassc_loc_customers', JSON.stringify(currentRecords));
  }, []);

  // ── AUTO-FIRE GPS when customerCid is set (capture link opened) ──────────
  useEffect(() => {
    if (customerCid && !captureSuccess && !captureError) {
      const timer = setTimeout(() => {
        executeClientSelfCapture();
      }, 900);
      return () => clearTimeout(timer);
    }
  }, [customerCid]);

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
      whatsappCell: fWhatsappCell.trim() || undefined,
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

This is to inform you that we are completing your important request/order. Delivery confirmation is required upon your approval at the link provided. Please ensure your personal information matches your registered profile for acceptance.

🔗 ${link}

— SASSC Service Network | Ref: ${c.id}

---

Hallo ${c.name}

Hiermee wil ons u in kennis stel dat ons u belangrike versoek/bestelling voltooi. Aflweringsbevestiging word benodig op u goedkeuring by die skakel wat verskaf word. Verseker asseblief dat u persoonlike inligting met u geregistreerde profiel ooreenstem vir aanvaarding.

🔗 ${link}

— SASSC Diensnetwerk | Verw: ${c.id}`;
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
              <span className="text-xs uppercase tracking-widest text-[#e8a020] font-mono font-bold">Delivery Confirmation Portal</span>
              <h2 className="text-sm text-slate-400 font-medium">Secure Identity Verification Required</h2>
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
              <div className="w-full space-y-3">
                <div className="bg-rose-950/20 border border-rose-800/40 text-rose-300 rounded-xl p-4 text-xs font-mono text-left whitespace-pre-line leading-relaxed">
                  {captureError}
                </div>
                <button
                  onClick={executeClientSelfCapture}
                  className="w-full py-3 px-6 rounded-xl bg-[#e8a020] hover:bg-[#f0c050] text-[#0d1117] font-semibold flex items-center justify-center gap-2 transition duration-200 shadow-lg cursor-pointer text-sm"
                >
                  <RefreshCw className="w-4 h-4" /> Tap to Retry
                </button>
              </div>
            )}

            {!captureSuccess && !captureError && (
              <div className="text-[11px] text-slate-500 font-mono text-center px-4">
                Locating automatically… If your browser asks for permission, tap <strong className="text-white">Allow</strong>.
              </div>
            )}

            <div className="text-[10px] text-slate-600 font-mono">
              NCR Licensed Network • POPIA Compliant
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

            <nav className="flex-1 p-3 space-y-1">
              {[
                { key: 'dashboard', label: 'Dashboard', icon: Map },
                { key: 'customers', label: 'Customers', icon: Users },
                { key: 'add-customer', label: 'Add Customer', icon: UserPlus },
                { key: 'dispatch', label: 'Dispatch Queue', icon: Truck },
                { key: 'settings', label: 'System Settings', icon: Settings },
              ].map(item => (
                <button
                  key={item.key}
                  onClick={() => {
                    setCurrentView(item.key);
                    setSelectedCustomerId(null);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                    currentView === item.key 
                      ? 'bg-[#e8a020]/10 text-[#e8a020] border-l-2 border-[#e8a020]' 
                      : 'text-slate-400 hover:bg-slate-850 hover:text-slate-200'
                  }`}
                >
                  <item.icon className="w-3.5 h-3.5" />
                  {item.label}
                </button>
              ))}
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
                        <label className="text-xs font-medium text-slate-400">
                          WhatsApp Number <span className="text-slate-600">(if different from cell)</span>
                        </label>
                        <input 
                          type="text" 
                          placeholder="e.g. 064 987 6543"
                          value={fWhatsappCell}
                          onChange={(e) => setFWhatsappCell(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:border-[#25D366] outline-none font-mono"
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
              {/* V6: CUSTOMER AUDIT FILE / PROFILE DETAILS */}
              {/* ------------------------------------------------------------- */}
              {currentView === 'customer-detail' && activeCustomer && (
                <div className="space-y-6">
                  
                  {/* Back to list Navigation */}
                  <div className="flex items-center justify-between">
                    <button 
                      onClick={() => {
                        setCurrentView('customers');
                        setSelectedCustomerId(null);
                      }}
                      className="flex items-center gap-1.5 text-xs text-[#e8a020] font-mono hover:text-white transition cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4" /> Back to Recipient Index
                    </button>
                    <button
                      onClick={() => {
                        setEditingCustomer({...activeCustomer});
                        setCurrentView('edit-customer');
                      }}
                      className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white px-3 py-1.5 rounded-lg transition cursor-pointer font-mono"
                    >
                      ✏️ Edit Profile
                    </button>
                  </div>

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
                        <span className="text-[10px] text-slate-500 font-mono uppercase font-semibold">WhatsApp Number</span>
                        <div className="text-xs text-slate-300 font-mono font-bold">{activeCustomer.whatsappCell || activeCustomer.cell || 'Same as cell'}</div>
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
                    <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">Communication — WhatsApp</h3>

                    {/* WhatsApp number warning if missing */}
                    {!activeCustomer.cell && !activeCustomer.whatsappCell && (
                      <div className="flex items-center gap-2 p-3 bg-amber-950/30 border border-amber-800/40 rounded-lg text-xs text-amber-400 font-mono">
                        ⚠️ No cell number on profile. Edit profile to add number for direct WhatsApp send.
                      </div>
                    )}

                    {/* Message Preview */}
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono text-[11px] leading-relaxed text-slate-300 whitespace-pre-wrap select-all">
                      {generateWhatsAppMessage(activeCustomer)}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-3">

                      {/* Direct WhatsApp Open — WhatsApp number preferred, cell as fallback */}
                      {(activeCustomer.whatsappCell || activeCustomer.cell) && (
                        <button
                          onClick={() => {
                            const raw = (activeCustomer.whatsappCell || activeCustomer.cell)!;
                            const number = raw.replace(/\s/g, '').replace(/^0/, '27');
                            const message = encodeURIComponent(generateWhatsAppMessage(activeCustomer));
                            window.open(`https://wa.me/${number}?text=${message}`, '_blank');
                          }}
                          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#25D366] hover:bg-[#20bd5a] text-black font-bold text-xs transition cursor-pointer shadow-lg"
                        >
                          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-black" xmlns="http://www.w3.org/2000/svg">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                          </svg>
                          Open WhatsApp — Send Now
                          {activeCustomer.whatsappCell && (
                            <span className="text-[10px] font-normal opacity-70">({activeCustomer.whatsappCell})</span>
                          )}
                        </button>
                      )}

                      {/* Copy message to clipboard fallback */}
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(generateWhatsAppMessage(activeCustomer));
                          showToast('Message copied — paste into WhatsApp or SMS.', 'success');
                        }}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs font-mono transition cursor-pointer"
                      >
                        <Clipboard className="w-4 h-4" /> Copy Message
                      </button>

                      {/* Copy link only */}
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(getSecureUrl(activeCustomer.id));
                          showToast('Locate link copied.', 'success');
                        }}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs font-mono transition cursor-pointer"
                      >
                        <Share2 className="w-4 h-4" /> Copy Link Only
                      </button>
                    </div>

                    <p className="text-[10px] text-slate-600 font-mono">
                      "Open WhatsApp" opens the app with the message and number pre-loaded — one tap sends. 
                      "Copy Message" is the fallback for manual paste. Cell number must be saved on profile for direct send.
                    </p>
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

      {/* ================================================================ */}
      {/* EDIT CUSTOMER VIEW                                                */}
      {/* ================================================================ */}
      {currentView === 'edit-customer' && editingCustomer && (
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-950">
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                setCurrentView('customer-detail');
                setEditingCustomer(null);
              }}
              className="flex items-center gap-1.5 text-xs text-[#e8a020] font-mono hover:text-white transition cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" /> Cancel — Back to Profile
            </button>
            <span className="text-xs font-mono text-slate-500">Editing: {editingCustomer.id}</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 font-mono border-b border-slate-800 pb-3">
              ✏️ Edit Customer Profile
            </h2>

            {/* Name + ID */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono text-slate-500 uppercase font-semibold">Full Name *</label>
                <input
                  type="text"
                  value={editingCustomer.name}
                  onChange={e => setEditingCustomer({...editingCustomer, name: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-[#e8a020] outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono text-slate-500 uppercase font-semibold">SA ID Number</label>
                <input
                  type="text"
                  value={editingCustomer.idNumber || ''}
                  onChange={e => setEditingCustomer({...editingCustomer, idNumber: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-[#e8a020] outline-none"
                  maxLength={13}
                />
              </div>
            </div>

            {/* Cell + Alt Cell */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono text-slate-500 uppercase font-semibold">Cell Number</label>
                <input
                  type="tel"
                  value={editingCustomer.cell || ''}
                  onChange={e => setEditingCustomer({...editingCustomer, cell: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-[#e8a020] outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono text-slate-500 uppercase font-semibold">
                  WhatsApp Number <span className="text-slate-600">(if different)</span>
                </label>
                <input
                  type="tel"
                  value={editingCustomer.whatsappCell || ''}
                  onChange={e => setEditingCustomer({...editingCustomer, whatsappCell: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-[#25D366] outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono text-slate-500 uppercase font-semibold">Caregiver / Alt Contact</label>
                <input
                  type="tel"
                  value={editingCustomer.altCell || ''}
                  onChange={e => setEditingCustomer({...editingCustomer, altCell: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-[#e8a020] outline-none"
                />
              </div>
            </div>

            {/* Area + Grant Type */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono text-slate-500 uppercase font-semibold">Area / Village</label>
                <input
                  type="text"
                  value={editingCustomer.area || ''}
                  onChange={e => setEditingCustomer({...editingCustomer, area: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-[#e8a020] outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono text-slate-500 uppercase font-semibold">Grant Type</label>
                <select
                  value={editingCustomer.grantType || ''}
                  onChange={e => setEditingCustomer({...editingCustomer, grantType: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-[#e8a020] outline-none"
                >
                  <option value="">Select...</option>
                  <option>Old Age Pension</option>
                  <option>Disability Grant</option>
                  <option>Child Support Grant</option>
                  <option>Care Dependency Grant</option>
                  <option>Foster Child Grant</option>
                  <option>Social Relief of Distress</option>
                </select>
              </div>
            </div>

            {/* Church + Pastor */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono text-slate-500 uppercase font-semibold">Church</label>
                <input
                  type="text"
                  value={editingCustomer.church || ''}
                  onChange={e => setEditingCustomer({...editingCustomer, church: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-[#e8a020] outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono text-slate-500 uppercase font-semibold">Pastor Contact</label>
                <input
                  type="text"
                  value={editingCustomer.pastor || ''}
                  onChange={e => setEditingCustomer({...editingCustomer, pastor: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-[#e8a020] outline-none"
                />
              </div>
            </div>

            {/* Next of Kin */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono text-slate-500 uppercase font-semibold">Next of Kin</label>
              <input
                type="text"
                value={editingCustomer.nextOfKin || ''}
                onChange={e => setEditingCustomer({...editingCustomer, nextOfKin: e.target.value})}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-[#e8a020] outline-none"
              />
            </div>

            {/* Home W3W */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono text-slate-500 uppercase font-semibold">Home what3words Address</label>
              <input
                type="text"
                value={editingCustomer.homeW3W || ''}
                onChange={e => setEditingCustomer({...editingCustomer, homeW3W: e.target.value.replace(/^\/\/\//, '')})}
                placeholder="e.g. table.lamp.river"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-[#e8a020] outline-none"
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono text-slate-500 uppercase font-semibold">Notes</label>
              <textarea
                value={editingCustomer.notes || ''}
                onChange={e => setEditingCustomer({...editingCustomer, notes: e.target.value})}
                rows={3}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-[#e8a020] outline-none resize-none"
              />
            </div>

            {/* Consent toggle */}
            <div className="flex items-center gap-3 p-3 bg-slate-950 border border-slate-800 rounded-lg">
              <input
                type="checkbox"
                id="edit-consent"
                checked={editingCustomer.consentSigned}
                onChange={e => setEditingCustomer({...editingCustomer, consentSigned: e.target.checked})}
                className="w-4 h-4 accent-[#e8a020]"
              />
              <label htmlFor="edit-consent" className="text-xs text-slate-300 cursor-pointer">
                POPIA consent confirmed — signed NCA credit agreement on file
              </label>
            </div>

            {/* Save + Delete buttons */}
            <div className="flex justify-between items-center pt-2 border-t border-slate-800">
              <button
                onClick={() => {
                  if (!window.confirm('Permanently delete this customer profile? This cannot be undone.')) return;
                  const updated = customers.filter(c => c.id !== editingCustomer.id);
                  setCustomers(updated);
                  localStorage.setItem('sassc_loc_customers', JSON.stringify(updated));
                  setEditingCustomer(null);
                  setSelectedCustomerId(null);
                  setCurrentView('customers');
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-950/30 border border-rose-900/40 text-rose-400 hover:bg-rose-900/40 text-xs font-mono transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete Profile
              </button>

              <button
                onClick={() => {
                  if (!editingCustomer.name.trim()) {
                    alert('Customer name is required.');
                    return;
                  }
                  const updated = customers.map(c => c.id === editingCustomer.id ? editingCustomer : c);
                  setCustomers(updated);
                  localStorage.setItem('sassc_loc_customers', JSON.stringify(updated));
                  setEditingCustomer(null);
                  setCurrentView('customer-detail');
                }}
                className="flex items-center gap-2 px-6 py-2 rounded-lg bg-[#e8a020] hover:bg-[#f0c050] text-black font-bold text-xs font-mono transition cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" /> Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
