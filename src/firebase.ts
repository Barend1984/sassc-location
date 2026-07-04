import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword, User } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, updateDoc, addDoc, query, where, onSnapshot } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export interface FirebaseSettings {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

// In-memory / LocalStorage fallback for zero-setup demo & offline compilation resilience
class SimulatedAuth {
  private currentUser: any = null;
  private listeners: Array<(user: any) => void> = [];

  constructor() {
    const saved = localStorage.getItem('sassc_simulated_auth_user');
    if (saved) {
      try {
        this.currentUser = JSON.parse(saved);
      } catch {
        this.currentUser = null;
      }
    }
  }

  get uid() {
    return this.currentUser?.uid || null;
  }

  get email() {
    return this.currentUser?.email || null;
  }

  getCurrentUser() {
    return this.currentUser;
  }

  onAuthStateChanged(callback: (user: any) => void) {
    this.listeners.push(callback);
    callback(this.currentUser);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  async signInWithEmailAndPassword(email: string, pass: string) {
    // Validate from simulated drivers database in LocalStorage
    const drivers = JSON.parse(localStorage.getItem('sassc_simulated_drivers') || '[]');
    const found = drivers.find((d: any) => d.email.toLowerCase() === email.toLowerCase());
    
    if (found) {
      this.currentUser = {
        uid: found.id,
        email: found.email,
        displayName: found.name,
        isAdmin: found.email.includes('admin') || found.isAdmin,
      };
    } else if (email === 'admin@sassc.co.za') {
      this.currentUser = {
        uid: 'ADMIN_UID_1',
        email: 'admin@sassc.co.za',
        displayName: 'Barend Admin',
        isAdmin: true,
      };
    } else {
      throw new Error('Auth failed: Driver profile not found. Please register the driver in Admin dashboard.');
    }

    localStorage.setItem('sassc_simulated_auth_user', JSON.stringify(this.currentUser));
    this.notify();
    return { user: this.currentUser };
  }

  async createUserWithEmailAndPassword(email: string, pass: string) {
    const uid = 'drv_' + Math.random().toString(36).substring(2, 10).toUpperCase();
    const newUser = {
      uid,
      email,
      displayName: email.split('@')[0],
      isAdmin: false,
    };
    return { user: newUser };
  }

  async signOut() {
    this.currentUser = null;
    localStorage.removeItem('sassc_simulated_auth_user');
    this.notify();
  }

  private notify() {
    this.listeners.forEach(l => l(this.currentUser));
  }
}

class SimulatedFirestore {
  private listeners: { [key: string]: Array<(data: any) => void> } = {};

  private getCollection(name: string): any[] {
    const key = `sassc_simulated_${name}`;
    return JSON.parse(localStorage.getItem(key) || '[]');
  }

  private saveCollection(name: string, data: any[]) {
    const key = `sassc_simulated_${name}`;
    localStorage.setItem(key, JSON.stringify(data));
    this.triggerListeners(name);
  }

  private triggerListeners(name: string) {
    if (this.listeners[name]) {
      const data = this.getCollection(name);
      this.listeners[name].forEach(cb => cb(data));
    }
  }

  subscribe(collName: string, callback: (data: any[]) => void) {
    if (!this.listeners[collName]) {
      this.listeners[collName] = [];
    }
    this.listeners[collName].push(callback);
    callback(this.getCollection(collName));
    return () => {
      this.listeners[collName] = this.listeners[collName].filter(cb => cb !== callback);
    };
  }

  async getDocs(collName: string) {
    return this.getCollection(collName);
  }

  async addDoc(collName: string, docData: any) {
    const items = this.getCollection(collName);
    const id = collName === 'drivers' ? docData.id || 'DRV-' + Math.random().toString(36).substring(2, 6).toUpperCase() : 'DEL-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const newItem = { ...docData, id };
    items.push(newItem);
    this.saveCollection(collName, items);
    return { id };
  }

  async setDoc(collName: string, id: string, docData: any) {
    const items = this.getCollection(collName);
    const idx = items.findIndex(i => i.id === id || i.uid === id);
    const newItem = { ...docData, id };
    if (idx >= 0) {
      items[idx] = newItem;
    } else {
      items.push(newItem);
    }
    this.saveCollection(collName, items);
  }

  async updateDoc(collName: string, id: string, docData: any) {
    const items = this.getCollection(collName);
    const idx = items.findIndex(i => i.id === id || i.uid === id);
    if (idx >= 0) {
      items[idx] = { ...items[idx], ...docData };
      this.saveCollection(collName, items);
    } else {
      throw new Error(`Document with ID ${id} not found in ${collName}`);
    }
  }
}

class SimulatedStorage {
  async uploadPhoto(file: File): Promise<string> {
    // Generate base64 representations for simulated uploads to be offline-first and durable
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
}

// Global instances
let firebaseApp: any = null;
let firestoreInstance: any = null;
let authInstance: any = null;
let storageInstance: any = null;
let realFirebaseEnabled = false;

// Attempt auto-initialization from Local Storage configuration
const savedFbConfig = localStorage.getItem('sassc_firebase_credentials');
if (savedFbConfig) {
  try {
    const config: FirebaseSettings = JSON.parse(savedFbConfig);
    if (config.apiKey && config.projectId) {
      firebaseApp = initializeApp(config);
      firestoreInstance = getFirestore(firebaseApp);
      authInstance = getAuth(firebaseApp);
      storageInstance = getStorage(firebaseApp);
      realFirebaseEnabled = true;
      console.log('Real Firebase active and authorized via system telemetry settings.');
    }
  } catch (err) {
    console.warn('Real Firebase startup bypassed/failed. Reverting to Simulated offline core:', err);
  }
}

if (!realFirebaseEnabled) {
  authInstance = new SimulatedAuth();
  firestoreInstance = new SimulatedFirestore();
  storageInstance = new SimulatedStorage();
}

export const getFirebaseServices = () => {
  return {
    auth: authInstance,
    db: firestoreInstance,
    storage: storageInstance,
    isReal: realFirebaseEnabled
  };
};

export const updateFirebaseConfig = (config: FirebaseSettings | null) => {
  if (!config || !config.apiKey || !config.projectId) {
    localStorage.removeItem('sassc_firebase_credentials');
    authInstance = new SimulatedAuth();
    firestoreInstance = new SimulatedFirestore();
    storageInstance = new SimulatedStorage();
    realFirebaseEnabled = false;
    window.location.reload();
    return;
  }

  localStorage.setItem('sassc_firebase_credentials', JSON.stringify(config));
  window.location.reload();
};
