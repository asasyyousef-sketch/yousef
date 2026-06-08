import { initializeApp } from 'firebase/app';
import { getFirestore, setLogLevel } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize the Firebase core instance
const app = initializeApp(firebaseConfig);

// Suppress benign warnings such as disconnecting idle listen streams
setLogLevel('error');

// Initialize Firestore with custom Database ID specified in our configuration file
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
