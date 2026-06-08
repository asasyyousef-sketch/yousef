import { initializeApp, getApps, getApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
let firebaseConfig: any = {};

try {
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }
} catch (err) {
  console.warn('[Firebase Admin] Warning loading firebase-applet-config.json:', err);
}

let app;
let usingServiceAccount = false;

const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT;
const credentialsPath = path.join(process.cwd(), 'firebase-service-account.json');

// 1. Validate and handle the service account from environment or disk
if (serviceAccountString) {
  try {
    const sa = JSON.parse(serviceAccountString.trim());
    if (sa.project_id === firebaseConfig.projectId) {
      fs.writeFileSync(credentialsPath, JSON.stringify(sa, null, 2), 'utf-8');
      process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;
      usingServiceAccount = true;
      console.log('[Firebase Admin] Loaded matching service account from FIREBASE_SERVICE_ACCOUNT env var.');
    } else {
      console.warn(`[Firebase Admin] FIREBASE_SERVICE_ACCOUNT project ID (${sa.project_id}) does not match active firebase-applet-config.json projectId (${firebaseConfig.projectId}). Skipping this credentials variable.`);
      // Clear GOOGLE_APPLICATION_CREDENTIALS so we don't accidentally load a wrong/stale credential file in runtime
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    }
  } catch (parseErr) {
    console.error('[Firebase Admin] Error parsing process.env.FIREBASE_SERVICE_ACCOUNT:', parseErr);
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  }
} else {
  // Check if a local file exists and matches the project ID
  if (fs.existsSync(credentialsPath)) {
    try {
      const sa = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'));
      if (sa.project_id === firebaseConfig.projectId) {
        process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;
        usingServiceAccount = true;
        console.log('[Firebase Admin] Found matching local service account in firebase-service-account.json.');
      } else {
        console.warn(`[Firebase Admin] Local firebase-service-account.json project ID (${sa.project_id}) does not match current projectId (${firebaseConfig.projectId}). Ignoring.`);
        delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
      }
    } catch (readErr) {
      console.warn('[Firebase Admin] Failed to parse local firebase-service-account.json:', readErr);
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    }
  } else {
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  }
}

// 2. Initialize the Firebase Admin instance
if (getApps().length === 0) {
  try {
    if (usingServiceAccount) {
      console.log('[Firebase Admin] Initializing Firebase Admin SDK with verified Service Account...');
      app = initializeApp({
        credential: cert(credentialsPath),
        projectId: firebaseConfig.projectId
      });
    } else {
      console.log('[Firebase Admin] Initializing Firebase Admin SDK using Application Default Credentials (ADC) or project defaults...');
      if (firebaseConfig.projectId) {
        app = initializeApp({
          projectId: firebaseConfig.projectId
        });
      } else {
        app = initializeApp();
      }
    }
  } catch (initErr: any) {
    console.error('[Firebase Admin] Primary initialization failed. Retrying fallback init...', initErr.message);
    app = initializeApp({
      projectId: firebaseConfig.projectId
    });
  }
} else {
  app = getApp();
}

export const adminDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// 3. Database connection check and graceful fallback variables
let isDbConnected = false;

export async function checkDbConnection(): Promise<boolean> {
  try {
    // Attempt a quick, light query to verify read access and authentication state
    await adminDb.collection('shipping_providers').limit(1).get();
    isDbConnected = true;
    console.log('[Firebase Admin DB Check] Connected to Firestore successfully.');
    return true;
  } catch (err: any) {
    isDbConnected = false;
    console.warn('[Firebase Admin DB Check] Firestore authentication check failed. Running on stable in-memory backup database. Reason:', err.message);
    return false;
  }
}

export function getIsDbConnected(): boolean {
  return isDbConnected;
}

export { FieldValue };
