import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Import the Firebase configuration
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);

// Use the named database if provided in the config
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId || 'ai-studio-cygnussoftwareso-026d8dc4-485a-4e34-9a56-7dd7b0359aae');
export const auth = getAuth(app);
export const storage = getStorage(app);

export default app;
