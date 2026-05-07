import { Platform } from 'react-native';
import { getApp as getNativeApp } from '@react-native-firebase/app';
import { getAuth as getNativeAuth } from '@react-native-firebase/auth';
import { FirebaseApp, FirebaseOptions, getApp as getWebApp, getApps, initializeApp } from 'firebase/app';
import { getAuth as getWebAuth } from 'firebase/auth';

const webFirebaseConfig: FirebaseOptions = {
  apiKey: 'AIzaSyCoD2pyCh_3wd5HCUG549R7SvExFCvRxbE',
  authDomain: 'gotogether-783eb.firebaseapp.com',
  projectId: 'gotogether-783eb',
  storageBucket: 'gotogether-783eb.firebasestorage.app',
  messagingSenderId: '501556960072',
  appId: '1:501556960072:web:gotogether',
};

const getOrCreateWebApp = (): FirebaseApp => {
  if (getApps().length > 0) {
    return getWebApp();
  }
  return initializeApp(webFirebaseConfig);
};

export const firebaseApp = Platform.OS === 'web' ? getOrCreateWebApp() : getNativeApp();
export const firebaseAuth: any =
  Platform.OS === 'web' ? getWebAuth(firebaseApp as FirebaseApp) : getNativeAuth(firebaseApp as ReturnType<typeof getNativeApp>);
