import { initializeApp, getApps, getApp } from 'firebase/app';
import * as FirebaseAuth from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: 'AIzaSyBV_HsgJPIlcxam7ZyppOi23CbVJP33ZDE',
  authDomain: 'gotogether-783eb.firebaseapp.com',
  projectId: 'gotogether-783eb',
  storageBucket: 'gotogether-783eb.firebasestorage.app',
  messagingSenderId: '501556960072',
  appId: '1:501556960072:web:f248b5cb2255c627eb717d',
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const firebaseStorage = getStorage(firebaseApp);

let authInstance;

try {
  const getReactNativePersistence = (
    FirebaseAuth as typeof FirebaseAuth & {
      getReactNativePersistence?: (
        storage: typeof AsyncStorage
      ) => FirebaseAuth.Persistence;
    }
  ).getReactNativePersistence;

  if (typeof getReactNativePersistence === 'function') {
    authInstance = FirebaseAuth.initializeAuth(firebaseApp, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } else {
    authInstance = FirebaseAuth.getAuth(firebaseApp);
  }
} catch {
  authInstance = FirebaseAuth.getAuth(firebaseApp);
}

export const firebaseAuth = authInstance;
