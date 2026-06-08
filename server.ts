import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import * as cheerio from 'cheerio';
import cors from 'cors';
import cookieParser from 'cookie-parser';

// Firestore configuration imports
import { adminDb as db, checkDbConnection, getIsDbConnected, FieldValue } from './src/firebase-admin';
import { ShippingProvider, UserConfig } from './src/types';

const sessionCache = new Map<string, { jar: CookieJar, lastUsed: number }>();
const SESSION_TIMEOUT = 15 * 60 * 1000; // 15 minutes

// In-Memory fallback database for zero-trust permission deniability
let localUsers: UserConfig[] = [
  {
    uid: 'admin',
    username: 'admin',
    password: 'admin123',
    role: 'admin',
    parentProviderId: 'hawk',
    sourceProviderIds: ['jood', 'shaya'],
    parentCredentials: { username: '', password: '' },
    sourceCredentials: {}
  }
];

let localActivityLogs: any[] = [];

// ==========================================
// HYBRID MEMORY-FIRST ARCHITECTURE STORAGE
// ==========================================
let liveLogsInMemory: any[] = [];
let liveUsersPresenceInMemory: UserConfig[] = [];
let liveProvidersInMemory: ShippingProvider[] = [];

// One-time Boot-Up Hydration routine
async function hydrateMemory() {
  console.log('[Memory Hydration] Starting one-time hydration on boot...');
  if (getIsDbConnected()) {
    try {
      // 1. Pull initial states of all users from Firestore
      console.log('[Memory Hydration] Hydrating liveUsersPresenceInMemory from Firestore...');
      const usersSnap = await db.collection('users').get();
      const users: UserConfig[] = [];
      usersSnap.forEach((docSnap) => {
        users.push(docSnap.data() as UserConfig);
      });
      if (users.length > 0) {
        // Ensure default admin exists
        const hasAdmin = users.some(u => u.uid === 'admin');
        if (!hasAdmin) {
          users.push(localUsers[0]);
        }
        liveUsersPresenceInMemory = users;
      } else {
        liveUsersPresenceInMemory = [...localUsers];
      }
      console.log(`[Memory Hydration] Hydrated ${liveUsersPresenceInMemory.length} users successfully.`);

      // 2. Pull initial states of shipping providers
      console.log('[Memory Hydration] Hydrating liveProvidersInMemory from Firestore...');
      const providersSnap = await db.collection('shipping_providers').get();
      const providers: ShippingProvider[] = [];
      providersSnap.forEach((docSnap) => {
        providers.push(docSnap.data() as ShippingProvider);
      });
      liveProvidersInMemory = providers.length > 0 ? providers : [...localProviders];
      console.log(`[Memory Hydration] Hydrated ${liveProvidersInMemory.length} shipping providers successfully.`);

      // 3. Pull last 200 activity logs
      console.log('[Memory Hydration] Hydrating liveLogsInMemory from Firestore...');
      const logsSnap = await db.collection('activity_logs').orderBy('timestamp', 'desc').limit(200).get();
      const logs: any[] = [];
      logsSnap.forEach((docSnap) => {
        logs.push({ id: docSnap.id, ...docSnap.data() });
      });
      liveLogsInMemory = logs.length > 0 ? logs : [...localActivityLogs];
      console.log(`[Memory Hydration] Hydrated ${liveLogsInMemory.length} activity logs successfully.`);
    } catch (e: any) {
      console.error('[Memory Hydration] Failed to hydrate database cache on boot:', e.message);
      // Fail-safes
      liveUsersPresenceInMemory = [...localUsers];
      liveProvidersInMemory = [...localProviders];
      liveLogsInMemory = [...localActivityLogs];
    }
  } else {
    console.log('[Memory Hydration] Firestore not connected. Falling back to local fallback arrays.');
    liveUsersPresenceInMemory = [...localUsers];
    liveProvidersInMemory = [...localProviders];
    liveLogsInMemory = [...localActivityLogs];
  }
}

// ==========================================
// IN-MEMORY PERFORMANCE CACHING LAYER
// ==========================================

interface PresenceCacheEntry {
  lastActiveAt: string;
  accumulatedSeconds: number;
  lastSavedAt: number;
  todayDate: string;
  todayVisits: number;
}

interface UserProfileCacheEntry {
  user: UserConfig;
  cachedAt: number;
}

const presenceCache = new Map<string, PresenceCacheEntry>();
const userProfileCache = new Map<string, UserProfileCacheEntry>();

interface AdminCacheEntry<T> {
  data: T;
  cachedAt: number;
}

const adminUsersCache: { entry: AdminCacheEntry<UserConfig[]> | null; ttlMS: number } = { entry: null, ttlMS: 30 * 1000 };       // 30 seconds
const adminProvidersCache: { entry: AdminCacheEntry<ShippingProvider[]> | null; ttlMS: number } = { entry: null, ttlMS: 5 * 60 * 1000 }; // 5 minutes
const adminLogsCache: { entry: AdminCacheEntry<any[]> | null; ttlMS: number } = { entry: null, ttlMS: 15 * 1000 };                // 15 seconds

async function flushPresenceToDb(userId: string) {
  if (!getIsDbConnected()) {
    return;
  }
  const cacheItem = presenceCache.get(userId);
  if (!cacheItem) return;

  const secondsToIncrement = cacheItem.accumulatedSeconds;

  try {
    const userRef = db.collection('users').doc(userId);
    console.log(`[Presence Sync] Flushing presence for user ${userId}. Incremental seconds: ${secondsToIncrement}`);

    if (secondsToIncrement > 0) {
      await userRef.update({
        'presence.lastActiveAt': cacheItem.lastActiveAt,
        'presence.todayDate': cacheItem.todayDate,
        'presence.todayVisits': cacheItem.todayVisits,
        'presence.todaySeconds': FieldValue.increment(secondsToIncrement)
      });
    } else {
      await userRef.update({
        'presence.lastActiveAt': cacheItem.lastActiveAt,
        'presence.todayDate': cacheItem.todayDate,
        'presence.todayVisits': cacheItem.todayVisits
      });
    }

    cacheItem.accumulatedSeconds = 0;
    cacheItem.lastSavedAt = Date.now();
    console.log(`[Presence Sync] Sync completed for user ${userId}`);
  } catch (err: any) {
    console.warn(`[Presence Sync] Firestore update failed for user ${userId}:`, err.message);
  }
}

async function getCachedUserProfile(userId: string): Promise<UserConfig | null> {
  // 1. Ultra-fast Memory-First lookup
  const liveUser = liveUsersPresenceInMemory.find(u => u.uid === userId);
  if (liveUser) {
    return liveUser;
  }

  // 2. Fallback to performance cache (5m) or Firestore
  const now = Date.now();
  const cached = userProfileCache.get(userId);

  if (cached && (now - cached.cachedAt) < 5 * 60 * 1000) {
    return cached.user;
  }

  if (getIsDbConnected()) {
    try {
      const doc = await db.collection('users').doc(userId).get();
      if (doc.exists) {
        const user = doc.data() as UserConfig;
        userProfileCache.set(userId, { user, cachedAt: now });
        
        // Upsert back into our liveUsersPresenceInMemory RAM array to prevent future reads
        const idx = liveUsersPresenceInMemory.findIndex(u => u.uid === userId);
        if (idx !== -1) {
          liveUsersPresenceInMemory[idx] = user;
        } else {
          liveUsersPresenceInMemory.push(user);
        }
        return user;
      }
    } catch (err: any) {
      console.warn(`[User Cache] Firestore fetch failed for user ${userId}, using memory fallback:`, err.message);
    }
  }

  return localUsers.find(u => u.uid === userId) || null;
}

// Background scheduler: Flush any dirty records older than 15 minutes OR inactive for too long
setInterval(async () => {
  if (!getIsDbConnected()) return;
  const now = Date.now();
  for (const [userId, cacheItem] of presenceCache.entries()) {
    const elapsed = now - cacheItem.lastSavedAt;
    // Condition A: Sync if 15 minutes elapsed since last database write, or if idle with pending seconds
    if (elapsed >= 15 * 60 * 1000 || (elapsed >= 5 * 60 * 1000 && cacheItem.accumulatedSeconds > 0)) {
      console.log(`[Presence Sync Scheduler] Auto flushing user ${userId} presence due to timer threshold.`);
      await flushPresenceToDb(userId);
    }
  }
}, 60000); // Check every minute

async function logActivity(userId: string, username: string, action: string, details: string = '') {
  try {
    const timestamp = new Date().toISOString();
    const entry = {
      userId,
      username,
      action,
      details,
      timestamp
    };
    
    // Maintain fallback logs
    localActivityLogs.unshift(entry);
    if (localActivityLogs.length > 500) {
      localActivityLogs.pop();
    }

    // Direct Memory-First RAM Dual-Write (strictly capped at 200)
    liveLogsInMemory.unshift(entry);
    if (liveLogsInMemory.length > 200) {
      liveLogsInMemory.pop();
    }
    
    adminLogsCache.entry = null; // Clear logs cache to ensure real-time data on next fetch

    if (getIsDbConnected()) {
      try {
        await db.collection('activity_logs').add(entry);
      } catch (dbErr: any) {
        console.warn('[Firestore Log] Failed to save log entry in database:', dbErr.message);
      }
    }
  } catch (err: any) {
    console.error('[logActivity Error]:', err.message);
  }
}

let localProviders: ShippingProvider[] = [
  {
    id: 'hawk',
    name: 'صقور نينوى',
    type: 'parent',
    loginUrl: 'https://msm-exp.com/login_db.php',
    searchUrl: 'https://msm-exp.com/search_wasl.php',
    loginCheck: 'logout',
    rowSelector: 'tr[id]',
    checkboxSelector: 'input[type="checkbox"][name="id[]"]',
    idWaslIndex: 1,
    sequenceIndex: 0
  },
  {
    id: 'jood',
    name: 'شركة الجود',
    type: 'source',
    loginUrl: 'https://aljoodexp.com/login_db.php',
    searchUrl: 'https://aljoodexp.com/search_wasl2.php',
    loginCheck: 'logout.php',
    columns: [
      'Actions', 'Sequence', 'idWasl_Value', 'Client Name', 'Representative Name', 'Governorate',
      'Area', 'Customer Phone', 'Total Amount', 'Delivery Fee', 'Net Amount',
      'Customer Name', 'Order ID', 'Client Phone', 'Status', 'Status Type',
      'Download', 'Cargo Type', 'Pieces Count', 'Notes', 'Date Added'
    ]
  },
  {
    id: 'shaya',
    name: 'شركة الشائع',
    type: 'source',
    loginUrl: 'https://alshaayie2-exp.com/login_db.php',
    searchUrl: 'https://alshaayie2-exp.com/search_wasl2.php',
    loginCheck: 'logout.php',
    columns: [
      'Actions', 'Sequence', 'idWasl_Value', 'Client Name', 'Representative Name', 'Governorate',
      'Area', 'Customer Phone', 'Total Amount', 'Delivery Fee', 'Net Amount',
      'Customer Name', 'Order ID', 'Client Phone', 'Status', 'Status Type',
      'Download', 'Cargo Type', 'Pieces Count', 'Notes', 'Date Added'
    ]
  }
];

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());
  app.use(cookieParser());

  // Automatically seed default templates of shipping providers on startup
  async function seedDefaultProviders() {
    console.log('[Firestore] Checking global shipping providers configurations...');
    const providersToSeed: ShippingProvider[] = [
      {
        id: 'hawk',
        name: 'صقور نينوى',
        type: 'parent',
        loginUrl: 'https://msm-exp.com/login_db.php',
        searchUrl: 'https://msm-exp.com/search_wasl.php',
        loginCheck: 'logout',
        rowSelector: 'tr[id]',
        checkboxSelector: 'input[type="checkbox"][name="id[]"]',
        idWaslIndex: 1,
        sequenceIndex: 0
      },
      {
        id: 'jood',
        name: 'شركة الجود',
        type: 'source',
        loginUrl: 'https://aljoodexp.com/login_db.php',
        searchUrl: 'https://aljoodexp.com/search_wasl2.php',
        loginCheck: 'logout.php',
        columns: [
          'Actions', 'Sequence', 'idWasl_Value', 'Client Name', 'Representative Name', 'Governorate',
          'Area', 'Customer Phone', 'Total Amount', 'Delivery Fee', 'Net Amount',
          'Customer Name', 'Order ID', 'Client Phone', 'Status', 'Status Type',
          'Download', 'Cargo Type', 'Pieces Count', 'Notes', 'Date Added'
        ]
      },
      {
        id: 'shaya',
        name: 'شركة الشائع',
        type: 'source',
        loginUrl: 'https://alshaayie2-exp.com/login_db.php',
        searchUrl: 'https://alshaayie2-exp.com/search_wasl2.php',
        loginCheck: 'logout.php',
        columns: [
          'Actions', 'Sequence', 'idWasl_Value', 'Client Name', 'Representative Name', 'Governorate',
          'Area', 'Customer Phone', 'Total Amount', 'Delivery Fee', 'Net Amount',
          'Customer Name', 'Order ID', 'Client Phone', 'Status', 'Status Type',
          'Download', 'Cargo Type', 'Pieces Count', 'Notes', 'Date Added'
        ]
      }
    ];

    for (const provider of providersToSeed) {
      try {
        const docRef = db.collection('shipping_providers').doc(provider.id);
        const docSnap = await docRef.get();
        if (!docSnap.exists) {
          await docRef.set(provider);
          console.log(`[Firestore] Seeded default provider template: ${provider.name} (ID: ${provider.id})`);
        }
      } catch (e: any) {
        console.error(`[Firestore] Error checking/seeding provider ${provider.id}:`, e.message);
      }
    }
  }

  // Automatically seed default admin account if not exists
  async function seedDefaultUsers() {
    console.log('[Firestore] Checking admin and user accounts...');
    try {
      const adminRef = db.collection('users').doc('admin');
      const adminSnap = await adminRef.get();
      if (!adminSnap.exists) {
        const defaultAdmin: UserConfig = {
          uid: 'admin',
          username: 'admin',
          password: 'admin123',
          role: 'admin',
          parentProviderId: 'hawk',
          sourceProviderIds: ['jood', 'shaya'],
          parentCredentials: { username: '', password: '' },
          sourceCredentials: {}
        };
        await adminRef.set(defaultAdmin);
        console.log('[Firestore] Seeded default admin account (username: admin, password: admin123)');
      }
    } catch (e: any) {
      console.error('[Firestore] Error seeding admin user:', e.message);
    }
  }

  // Perform database connection check
  await checkDbConnection();

  if (getIsDbConnected()) {
    // Seed default providers in firestore
    await seedDefaultProviders();
    await seedDefaultUsers();
  } else {
    console.log('[Firestore] Zero-trust mode: Running on resilient in-memory local database.');
  }

  // Hydrate Cache Layer after DB Connection / seeding have initialized
  await hydrateMemory();

  // Middleware layer: Dynamic Configuration Injection
  const injectUserConfig = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Read user ID from headers or body parameters
    const userId = req.body.userId || req.headers['x-user-id'];
    const userPassword = req.headers['x-user-password'];

    if (!userId) {
      // Fast fallback to request-level hardcoded parameters (Backward Compatibility)
      return next();
    }

    try {
      // 1. Fetch the user profile from cache (falls back to Firestore and local fallback internally)
      const user = await getCachedUserProfile(String(userId));

      if (!user) {
        return res.status(401).json({ error: 'حساب المستخدم/المحدث هذا غير مسجل على خادم المنصة الرئيسي' });
      }

      // Live Session/Password validation guard
      if (userPassword && String(userPassword).trim() !== String(user.password).trim()) {
        return res.status(401).json({ error: 'تم تغيير كلمة المرور من قبل الإدارة. يرجى تسجيل الدخول مجدداً.' });
      }

      (req as any).user = user;

      // 2. Identify and analyze the resource destination requested
      const isParentRequest = req.path.includes('/hawk/') || req.path.includes('/update-server');

      if (isParentRequest) {
        // Parent processing injection (Hawk setup)
        const parentId = user.parentProviderId || 'hawk';

        // Override body credentials from Mudhaddith profile only if missing
        if (!req.body.username) {
          req.body.username = user.parentCredentials?.username || '';
        }
        if (!req.body.password) {
          req.body.password = user.parentCredentials?.password || '';
        }

        // Fetch dynamic URLs and selectors for parent API
        let provider: ShippingProvider | null = null;
        if (getIsDbConnected()) {
          try {
            const providerRef = db.collection('shipping_providers').doc(parentId);
            const providerSnap = await providerRef.get();
            if (providerSnap.exists) {
              provider = providerSnap.data() as ShippingProvider;
            }
          } catch (e: any) {
            console.warn('[Firestore] Provider fetch error, trying local fallback:', e.message);
          }
        }

        if (!provider) {
          provider = localProviders.find(p => p.id === parentId) || null;
        }

        if (provider) {
          req.body.loginUrl = provider.loginUrl;
          req.body.searchUrl = provider.searchUrl;
          req.body.loginCheck = provider.loginCheck;
          req.body.rowSelector = provider.rowSelector || 'tr[id]';
          req.body.checkboxSelector = provider.checkboxSelector || 'input[type="checkbox"][name="id[]"]';
          req.body.idWaslIndex = provider.idWaslIndex !== undefined ? provider.idWaslIndex : 1;
          req.body.sequenceIndex = provider.sequenceIndex !== undefined ? provider.sequenceIndex : 0;
        } else {
          // Defaults if custom layout template not set
          req.body.loginUrl = 'https://msm-exp.com/login_db.php';
          req.body.searchUrl = 'https://msm-exp.com/search_wasl.php';
          req.body.loginCheck = 'logout';
          req.body.rowSelector = 'tr[id]';
          req.body.checkboxSelector = 'input[type="checkbox"][name="id[]"]';
          req.body.idWaslIndex = 1;
          req.body.sequenceIndex = 0;
        }
      } else {
        // Source processing injection (Aljood / Alshaayie setup)
        const requestedSource = req.body.source;

        if (!requestedSource) {
          return res.status(400).json({ error: 'لم يتم تحديد اسم شركة الشحن المصدر في طلب الجلب' });
        }

        // Validate user matches privileges to access this source company
        if (!user.sourceProviderIds.includes(requestedSource)) {
          return res.status(403).json({ error: `دخول مرفوض: ليس لديك صلاحية جلب البيانات من شركة الشحن [${requestedSource}]. يرجى مراجعة إدارة المنصة لطلب تفعيلها.` });
        }

        // Fetch credential map for Jood / Shaya matching only if missing in the request body
        if (!req.body.username || !req.body.password) {
          const sourceCreds = user.sourceCredentials?.[requestedSource];
          if (!req.body.username) {
            req.body.username = sourceCreds?.username || '';
          }
          if (!req.body.password) {
            req.body.password = sourceCreds?.password || '';
          }
        }

        if (!req.body.username || !req.body.password) {
          return res.status(400).json({ error: `بيانات تسجيل الدخول للشركة [${requestedSource}] غير مكتملة في حسابك الشخصي` });
        }

        // Fetch API configuration and selectors template
        let provider: ShippingProvider | null = null;
        if (getIsDbConnected()) {
          try {
            const providerRef = db.collection('shipping_providers').doc(requestedSource);
            const providerSnap = await providerRef.get();
            if (providerSnap.exists) {
              provider = providerSnap.data() as ShippingProvider;
            }
          } catch (e: any) {
            console.warn('[Firestore] Provider fetch error, trying local fallback:', e.message);
          }
        }

        if (!provider) {
          provider = localProviders.find(p => p.id === requestedSource) || null;
        }

        if (provider) {
          req.body.loginUrl = provider.loginUrl;
          req.body.searchUrl = provider.searchUrl;
          req.body.loginCheck = provider.loginCheck;
          if (provider.columns) {
            req.body.columns = provider.columns;
          }
        }
      }

      next();
    } catch (err: any) {
      console.error('[Middleware Error] Configuration Injection Failed:', err);
      return res.status(500).json({ error: `فشل التحقق التلقائي واستدعاء البيانات: ${err.message}` });
    }
  };

  // Helper to get or create a session-enabled client
  const getClient = async (source: string, sourceName: string, username: string, password: string, loginUrl: string, loginCheck: string) => {
    const cacheKey = `${source}:${username}`;
    const cached = sessionCache.get(cacheKey);
    const now = Date.now();

    if (cached && (now - cached.lastUsed < SESSION_TIMEOUT)) {
      cached.lastUsed = now;
      return wrapper(axios.create({ jar: cached.jar, withCredentials: true }));
    }

    const jar = new CookieJar();
    const client = wrapper(axios.create({ jar, withCredentials: true }));
    
    const loginRes = await client.post(loginUrl,
      new URLSearchParams({ username, password }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    if (!loginRes.data.toLowerCase().includes(loginCheck.toLowerCase())) {
      throw new Error(`اسم المستخدم أو كلمة المرور لـ ${sourceName} خاطئة`);
    }

    sessionCache.set(cacheKey, { jar, lastUsed: now });
    return client;
  };

  // User Authentication Endpoint
  app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'من فضلك أدخل اسم المستخدم وكلمة المرور' });
    }

    const trimmedUsername = String(username).trim();
    const trimmedPassword = String(password).trim();

    try {
      let snap;
      if (getIsDbConnected()) {
        snap = await db.collection('users').where('username', '==', trimmedUsername).get();
      }

      if (!snap || snap.empty) {
        // If Firestore snap is empty, check if username exists in local fallback memory to be responsive
        const existsLocally = localUsers.some(u => String(u.username).trim().toLowerCase() === trimmedUsername.toLowerCase());
        if (existsLocally) {
          const localMatch = localUsers.find(u => String(u.username).trim().toLowerCase() === trimmedUsername.toLowerCase() && String(u.password).trim() === trimmedPassword);
          if (localMatch) {
            await logActivity(localMatch.uid, localMatch.username, 'تسجيل الدخول', 'تم تسجيل الدخول عبر خادم الذاكرة المحلي المؤقت.');
            return res.json({ user: localMatch });
          } else {
            return res.status(401).json({ error: 'كلمة المرور غير صحيحة' });
          }
        }
        return res.status(401).json({ error: 'اسم المستخدم غير موجود بالنظام' });
      }

      let matchedUser: UserConfig | null = null;
      let usernameMatched = false;

      snap.forEach((docSnap) => {
        const u = docSnap.data() as UserConfig;
        usernameMatched = true;
        if (String(u.password).trim() === trimmedPassword) {
          matchedUser = u;
        }
      });

      if (!matchedUser) {
        if (usernameMatched) {
          return res.status(401).json({ error: 'كلمة المرور غير صحيحة' });
        } else {
          return res.status(401).json({ error: 'اسم المستخدم غير موجود بالنظام' });
        }
      }

      await logActivity((matchedUser as UserConfig).uid, (matchedUser as UserConfig).username, 'تسجيل الدخول', 'تم تسجيل الدخول إلى منصة المحدّثين بنجاح.');
      res.json({ user: matchedUser });
    } catch (e: any) {
      console.error('[Login API Error] Firestore query failed, attempting local fallback', e);
      // Attempt local memory fallback only when firestore query fails (offline fallback)
      const cachedUser = localUsers.find(u => String(u.username).trim().toLowerCase() === trimmedUsername.toLowerCase());
      if (cachedUser) {
        if (String(cachedUser.password).trim() === trimmedPassword) {
          console.log('[Auth] Successfully logged in via local fallback.');
          await logActivity(cachedUser.uid, cachedUser.username, 'تسجيل الدخول', 'تم تسجيل الدخول عبر خادم الذاكرة المحلي المؤقت.');
          return res.json({ user: cachedUser });
        } else {
          return res.status(401).json({ error: 'كلمة المرور غير صحيحة' });
        }
      } else {
        return res.status(401).json({ error: 'اسم المستخدم غير موجود بالنظام' });
      }
    }
  });

  // Verify and keep track of session status dynamically
  app.get('/api/auth/me', async (req, res) => {
    const userId = req.headers['x-user-id'];
    const userPassword = req.headers['x-user-password'];
    if (!userId) {
      return res.status(401).json({ error: 'عفواً، الجلسة منتهية أو غير صالحة. الرجاء تسجيل الدخول مجدداً.' });
    }

    try {
      const user = await getCachedUserProfile(String(userId));

      if (!user) {
        return res.status(401).json({ error: 'عنصر الجلسة غير صالح أو تم حذف حسابك من قبل المسؤول.' });
      }

      // Verification of active session integrity
      if (userPassword && String(userPassword).trim() !== String(user.password).trim()) {
        return res.status(401).json({ error: 'تم تغيير كلمة المرور من قبل الإدارة. يرجى تسجيل الدخول مجدداً.' });
      }

      // Touch presence cache in RAM to signal activity
      const userIdStr = String(userId);
      let cacheItem = presenceCache.get(userIdStr);
      if (!cacheItem) {
        cacheItem = {
          lastActiveAt: new Date().toISOString(),
          accumulatedSeconds: 0,
          lastSavedAt: Date.now(),
          todayDate: new Date().toISOString().split('T')[0],
          todayVisits: 1
        };
        presenceCache.set(userIdStr, cacheItem);
      } else {
        cacheItem.lastActiveAt = new Date().toISOString();
      }

      // Mutate liveUsersPresenceInMemory RAM array instantly
      const liveUser = liveUsersPresenceInMemory.find(u => u.uid === userIdStr);
      if (liveUser) {
        if (!liveUser.presence) {
          liveUser.presence = {
            lastActiveAt: new Date().toISOString(),
            todayDate: new Date().toISOString().split('T')[0],
            todaySeconds: 0,
            todayVisits: 1
          };
        } else {
          liveUser.presence.lastActiveAt = new Date().toISOString();
        }
      }

      res.json({ user });
    } catch (e: any) {
      res.status(500).json({ error: `خطأ في فحص صلاحية الدخول: ${e.message}` });
    }
  });

  // Keep track of user session heartbeat and presence (Optimized In-Memory Caching)
  app.post('/api/user/heartbeat', async (req, res) => {
    const userId = req.headers['x-user-id'];
    const userPassword = req.headers['x-user-password'];
    if (!userId) {
      return res.status(401).json({ error: 'عفواً، الجلسة غير صالحة.' });
    }

    const { seconds, visits, todayDate } = req.body;
    if (typeof seconds !== 'number' || typeof visits !== 'number' || !todayDate) {
      return res.status(400).json({ error: 'حقول البيانات غير مكتملة.' });
    }

    const userIdStr = String(userId);

    try {
      // 1. Resolve user profile from RAM cache
      const user = await getCachedUserProfile(userIdStr);

      if (user && userPassword && String(userPassword).trim() !== String(user.password).trim()) {
        return res.status(401).json({ error: 'تم تغيير كلمة المرور من قبل الإدارة. يرجى تسجيل الدخول مجدداً.' });
      }

      // 2. Update RAM presence cache
      let cacheItem = presenceCache.get(userIdStr);
      const now = Date.now();
      if (!cacheItem) {
        cacheItem = {
          lastActiveAt: new Date().toISOString(),
          accumulatedSeconds: 0,
          lastSavedAt: now,
          todayDate,
          todayVisits: visits
        };
      }

      cacheItem.lastActiveAt = new Date().toISOString();
      cacheItem.todayDate = todayDate;
      cacheItem.todayVisits = visits;
      cacheItem.accumulatedSeconds += 15; // default heart pulse interval duration

      presenceCache.set(userIdStr, cacheItem);

      // 3. Condition A: Trigger asynchronous Firestore flush if 15 minutes elapsed since last saved
      const elapsedMs = now - cacheItem.lastSavedAt;
      if (elapsedMs >= 15 * 60 * 1000) {
        console.log(`[Presence Pulse] 15 minutes threshold elapsed for user ${userIdStr}. Triggering database flush...`);
        flushPresenceToDb(userIdStr).catch(err => {
          console.error('[Presence Pulse] Firestore async flush failed:', err);
        });
      }

      // Reconstruct dynamic presence object for current response
      const dbBaseSeconds = (user?.presence as any)?.todaySeconds || 0;
      const currentPresenceTotalSeconds = dbBaseSeconds + cacheItem.accumulatedSeconds;
      const presence = {
        lastActiveAt: cacheItem.lastActiveAt,
        todayDate: cacheItem.todayDate,
        todaySeconds: currentPresenceTotalSeconds,
        todayVisits: cacheItem.todayVisits
      };

      // Keep local fallback in memory synchronized
      const localUser = localUsers.find(u => u.uid === userIdStr);
      if (localUser) {
        localUser.presence = presence;
      }

      // Mutate liveUsersPresenceInMemory RAM array instantly
      const liveUser = liveUsersPresenceInMemory.find(u => u.uid === userIdStr);
      if (liveUser) {
        liveUser.presence = presence;
      }

      res.json({ success: true, presence });
    } catch (e: any) {
      const presence = {
        lastActiveAt: new Date().toISOString(),
        todayDate,
        todaySeconds: seconds,
        todayVisits: visits
      };
      const localUser = localUsers.find(u => u.uid === userIdStr);
      if (localUser) {
        localUser.presence = presence;
      }
      const liveUser = liveUsersPresenceInMemory.find(u => u.uid === userIdStr);
      if (liveUser) {
        liveUser.presence = presence;
      }
      res.json({ success: true, presence });
    }
  });

  // Explicit logout with immediate presence flushing (Condition B)
  app.post('/api/auth/logout', async (req, res) => {
    const userId = req.headers['x-user-id'] || req.body.userId;
    if (userId) {
      const userIdStr = String(userId);
      console.log(`[Logout API] Explicit user logout requested for user: ${userIdStr}. Cleaning up cache triggers.`);
      
      // Flush remaining accumulated seconds immediately and block briefly to persist data
      await flushPresenceToDb(userIdStr);
      
      // Purge cache entries
      presenceCache.delete(userIdStr);
      userProfileCache.delete(userIdStr);
    }
    res.json({ success: true, message: 'تم تسجيل الخروج بنجاح وتأمين حفظ إحصائيات الجلسة.' });
  });

  // Save credentials for shipping providers in Firestore + localUsers memory
  app.post('/api/user/credentials', async (req, res) => {
    const userId = req.headers['x-user-id'];
    const userPassword = req.headers['x-user-password'];
    
    if (!userId) {
      return res.status(401).json({ error: 'من فضلك سجل الدخول أولاً.' });
    }

    const { parentCredentials, sourceCredentials } = req.body;

    try {
      // 1. Fetch user to verify active session password matches
      const user = await getCachedUserProfile(String(userId));

      if (!user) {
        return res.status(401).json({ error: 'حساب المستخدم/المحدث هذا غير مسجل على خادم المنصة الرئيسي' });
      }

      if (userPassword && String(userPassword).trim() !== String(user.password).trim()) {
        return res.status(401).json({ error: 'تم تغيير كلمة المرور من قبل الإدارة. يرجى تسجيل الدخول مجدداً.' });
      }

      // 2. Perform database update
      const updatedCreds = {
        parentCredentials: parentCredentials || { username: '', password: '' },
        sourceCredentials: sourceCredentials || {}
      };

      if (getIsDbConnected()) {
        try {
          const userRef = db.collection('users').doc(String(userId));
          await userRef.update(updatedCreds);
        } catch (dbErr: any) {
          console.warn('[Firestore Credentials Update] Failed to save in DB:', dbErr.message);
        }
      }

      // 3. Sync memory fallback
      const localUser = localUsers.find(u => u.uid === String(userId));
      if (localUser) {
        localUser.parentCredentials = updatedCreds.parentCredentials;
        localUser.sourceCredentials = updatedCreds.sourceCredentials;
      }

      const liveUser = liveUsersPresenceInMemory.find(u => u.uid === String(userId));
      if (liveUser) {
        liveUser.parentCredentials = updatedCreds.parentCredentials;
        liveUser.sourceCredentials = updatedCreds.sourceCredentials;
      }

      // 4. Invalidate profile cache so the update is immediate
      userProfileCache.delete(String(userId));

      await logActivity(String(userId), user.username || 'مستخدِم', 'تحديث الإعدادات', 'قام المحدّث بحفظ وإثبات بيانات الدخول للشركات في قاعدة البيانات.');

      res.json({ success: true, message: 'تم حفظ وتثبيت إعدادات تسجيل الدخول للشركات بنجاح في قاعدة البيانات.' });
    } catch (e: any) {
      res.status(500).json({ error: `فشل تخزين بيانات الشركات: ${e.message}` });
    }
  });

  // Save/Synchronize Shortcuts for user in Firestore + liveUsersPresenceInMemory RAM
  app.post('/api/user/shortcuts', async (req, res) => {
    const userId = req.headers['x-user-id'];
    const userPassword = req.headers['x-user-password'];
    
    if (!userId) {
      return res.status(401).json({ error: 'من فضلك سجل الدخول أولاً.' });
    }

    const { shortcuts } = req.body;

    try {
      const user = await getCachedUserProfile(String(userId));
      if (!user) {
        return res.status(401).json({ error: 'حساب المستخدم هذا غير مسجل على خادم المنصة الرئيسي' });
      }

      if (userPassword && String(userPassword).trim() !== String(user.password).trim()) {
        return res.status(401).json({ error: 'تم تغيير كلمة المرور من قبل الإدارة. يرجى تسجيل الدخول مجدداً.' });
      }

      if (getIsDbConnected()) {
        try {
          const userRef = db.collection('users').doc(String(userId));
          await userRef.update({ shortcuts: shortcuts || [] });
        } catch (dbErr: any) {
          console.warn('[Firestore Shortcuts Update] Failed to save in DB:', dbErr.message);
        }
      }

      const localUser = localUsers.find(u => u.uid === String(userId));
      if (localUser) {
        localUser.shortcuts = shortcuts || [];
      }

      const liveUser = liveUsersPresenceInMemory.find(u => u.uid === String(userId));
      if (liveUser) {
        liveUser.shortcuts = shortcuts || [];
      }

      userProfileCache.delete(String(userId));

      res.json({ success: true, message: 'تم حفظ وتثبيت الاختصارات بنجاح.' });
    } catch (e: any) {
      res.status(500).json({ error: `فشل تخزين الاختصارات: ${e.message}` });
    }
  });

  // ==========================================
  // ADMIN PLATFORM API ENDPOINTS (Phase 1 Controls)
  // ==========================================

  // 1. ADD / UPDATE Provider configuration template (Admin only)
  app.post('/api/admin/providers', async (req, res) => {
    const provider = req.body as ShippingProvider;
    if (!provider.id || !provider.name || !provider.type) {
      return res.status(400).json({ error: 'حقول البيانات الأساسية ناقصة: المعرَف والاسم ونوع الشركة مستقل عن بعضهم' });
    }

    try {
      // 1. Update in-memory fallback list
      const existingIdx = localProviders.findIndex(p => p.id === provider.id);
      if (existingIdx !== -1) {
        localProviders[existingIdx] = provider;
      } else {
        localProviders.push(provider);
      }

      // 2. Synchronously write to primary Memory-First RAM storage
      const liveIdx = liveProvidersInMemory.findIndex(p => p.id === provider.id);
      if (liveIdx !== -1) {
        liveProvidersInMemory[liveIdx] = provider;
      } else {
        liveProvidersInMemory.push(provider);
      }

      // 3. Persist to Firestore as long-term archive in background
      if (getIsDbConnected()) {
        try {
          const docRef = db.collection('shipping_providers').doc(provider.id);
          await docRef.set(provider, { merge: true });
        } catch (dbErr: any) {
          console.warn('[Firestore] Error saving provider to firestore, saved locally:', dbErr.message);
        }
      }
      res.json({ message: `تم حفظ وتحديث إعدادات شركة الشحن [${provider.name}] بنجاح كعنصر مستقر في الذاكرة الحية.` });
    } catch (e: any) {
      res.status(500).json({ error: `فشل تخزين البيانات: ${e.message}` });
    }
  });

  // 2. LIST all active Provider templates - ZERO-READ Memory First Endpoint
  app.get('/api/admin/providers', async (_req, res) => {
    try {
      console.log('[Zero-Read API] Serving dynamic shipping providers list from RAM.');
      return res.json({ providers: liveProvidersInMemory });
    } catch (e: any) {
      console.warn('[Zero-Read API] Fallback during provider retrieval:', e.message);
      res.json({ providers: localProviders });
    }
  });

  // 3. CREATE / UPDATE Mudhaddith User configurations
  app.post('/api/admin/users', async (req, res) => {
    const user = req.body as UserConfig;
    if (!user.uid || !user.username || !user.password || !user.parentProviderId) {
      return res.status(400).json({ error: 'حقول بيانات المحدث ناقصة: رقم المعرف، اسم الدخول، كلمة المرور والشركة الأم' });
    }

    try {
      const targetUser = {
        ...user,
        role: user.role || 'mudhaddith',
        createdAt: user.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // 1. Update fallback list
      const existingIdx = localUsers.findIndex(u => u.uid === user.uid);
      if (existingIdx !== -1) {
        localUsers[existingIdx] = targetUser;
      } else {
        localUsers.push(targetUser);
      }

      // 2. Synchronously write to primary Memory-First RAM storage (merging active presence states)
      const liveIdx = liveUsersPresenceInMemory.findIndex(u => u.uid === user.uid);
      if (liveIdx !== -1) {
        liveUsersPresenceInMemory[liveIdx] = {
          ...liveUsersPresenceInMemory[liveIdx],
          ...targetUser
        };
      } else {
        liveUsersPresenceInMemory.push(targetUser);
      }

      // 3. Persist to Firestore in background
      if (getIsDbConnected()) {
        try {
          const docRef = db.collection('users').doc(user.uid);
          await docRef.set(targetUser, { merge: true });
          userProfileCache.delete(user.uid); // invalidate profile cache instantly
        } catch (dbErr: any) {
          console.warn('[Firestore] Error saving user to firestore, saved locally:', dbErr.message);
        }
      }

      res.json({ message: `تم إنشاء/تحديث حساب المحدِّث [${user.username}] بنجاح وتأمينه بالذاكرة الحية للأنظمة.` });
    } catch (e: any) {
      res.status(500).json({ error: `فشل ربط وتخزين حساب المستخدم: ${e.message}` });
    }
  });

  // 4. LIST all Platform users - ZERO-READ Memory First Endpoint
  app.get('/api/admin/users', async (_req, res) => {
    try {
      console.log('[Zero-Read API] Serving dynamic platform users presence list from RAM.');
      return res.json({ users: liveUsersPresenceInMemory });
    } catch (e: any) {
      console.warn('[Zero-Read API] Fallback during users list retrieval:', e.message);
      res.json({ users: localUsers });
    }
  });

  // 5. DELETE mudhaddith user profile
  app.delete('/api/admin/users/:uid', async (req, res) => {
    const { uid } = req.params;
    try {
      // 1. Purge from RAM memory storage instantly
      localUsers = localUsers.filter(u => u.uid !== uid);
      liveUsersPresenceInMemory = liveUsersPresenceInMemory.filter(u => u.uid !== uid);

      // 2. Remove from Firestore in background
      if (getIsDbConnected()) {
        try {
          const docRef = db.collection('users').doc(uid);
          await docRef.delete();
          userProfileCache.delete(uid); // purge deleted profile instantly
        } catch (dbErr: any) {
          console.warn('[Firestore] Error deleting user in firestore, deleted locally:', dbErr.message);
        }
      }
      res.json({ message: 'تم إزالة كود المستخدم بنجاح من قاعدة البيانات والذاكرة الحية' });
    } catch (e: any) {
      res.status(500).json({ error: `فشل الحذف الرقمي للملف: ${e.message}` });
    }
  });

  // 6. GET audit and activity logs for admins - ZERO-READ Memory First Endpoint
  app.get('/api/admin/logs', async (req, res) => {
    try {
      console.log('[Zero-Read API] Serving dynamic activity logs dashboard from RAM.');
      return res.json({ logs: liveLogsInMemory });
    } catch (e: any) {
      console.warn('[Zero-Read API] Fallback during logs retrieval:', e.message);
      res.json({ logs: localActivityLogs });
    }
  });

  // 7. POST client-side events as activity logs - Hybrid Memory write
  app.post('/api/admin/logs', async (req, res) => {
    const { userId, username, action, details } = req.body;
    if (!userId || !username || !action) {
      return res.status(400).json({ error: 'البيانات المرسلة لتسجيل نشاط المحدث غير كاملة.' });
    }
    await logActivity(userId, username, action, details || '');
    res.json({ success: true });
  });


  // ==========================================
  // RE-INVENTED CORE SCRAPER AND UPDATER API ROUTES
  // ==========================================

  // Fetch Parent Orders with Dynamic Injection Hooked
  app.post('/api/hawk/process', injectUserConfig, async (req, res) => {
    const { username, password, filterKeyword, statusCode } = req.body;

    const loginUrl = req.body.loginUrl || 'https://msm-exp.com/login_db.php';
    const searchUrl = req.body.searchUrl || 'https://msm-exp.com/search_wasl.php';
    const loginCheck = req.body.loginCheck || 'logout';
    
    // Dynamic Selectors injected or defaulted
    const rowSelector = req.body.rowSelector || 'tr[id]';
    const checkboxSelector = req.body.checkboxSelector || 'input[type="checkbox"][name="id[]"]';
    const idWaslIndex = req.body.idWaslIndex !== undefined ? req.body.idWaslIndex : 1;
    const sequenceIndex = req.body.sequenceIndex !== undefined ? req.body.sequenceIndex : 0;

    try {
      const client = await getClient('hawk', 'صقور نينوى', username, password, loginUrl, loginCheck);

      // Fetch Hawk Orders dynamically with active filtering keyword passed
      const searchRes = await client.post(searchUrl,
        new URLSearchParams({ 'state[]': statusCode, 'wasl_search': filterKeyword || '' }).toString(),
        { 
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 30000
        }
      );

      if (!searchRes.data || typeof searchRes.data !== 'string') {
        return res.status(500).json({ error: 'فشل في جلب البيانات من موقع الشركة الأم (استجابة فارغة)' });
      }

      const $ = cheerio.load(searchRes.data);
      const orders: any[] = [];
      
      const rows = $(rowSelector);
      
      rows.each((_, row) => {
        const checkbox = $(row).find(checkboxSelector);
        const value = checkbox.attr('value');
        
        // Find cells dynamically according to database index template
        let cells = $(row).find('td[style="color: #000;"]');
        if (cells.length === 0 || cells.length <= Math.max(idWaslIndex, sequenceIndex)) {
          cells = $(row).find('td');
        }
        
        const idWasl = cells.eq(idWaslIndex).text().trim();
        const sequence = cells.eq(sequenceIndex).text().trim();

        if (value && idWasl) {
          let matchesFilter = true;
          if (filterKeyword) {
            const keyword = String(filterKeyword).trim();
            const rowText = $(row).text();
            matchesFilter = idWasl.includes(keyword) || sequence.includes(keyword) || rowText.includes(keyword);
          }
          
          if (matchesFilter) {
            orders.push({ Sequence: sequence, idWasl_Value: idWasl, Value: value });
          }
        }
      });

      // Commented out individual log to avoid duplicate logs (this is covered by the unified client process log)
      // const user = (req as any).user;
      // if (user) {
      //   await logActivity(user.uid, user.username, 'جلب طلبات الشركة الأم', `تم جلب وتصفية ${orders.length} طلب من الشركة الأم بنجاح (الكود للمطابقة: ${statusCode}${filterKeyword ? `، الكلمة: ${filterKeyword}` : ''}).`);
      // }

      res.json({ orders, message: `تم جلب وتصفية ${orders.length} طلب بنجاح.` });
    } catch (error: any) {
      const user = (req as any).user;
      if (user) {
        await logActivity(user.uid, user.username, 'خطأ جلب طلبات الشركة الأم', `فشل جلب الطلبات من الشركة الأم: ${error.message}`);
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Fetch Source Orders with Dynamic Injection Hooked
  app.post('/api/source/process', injectUserConfig, async (req, res) => {
    const { username, password, dates, source } = req.body;

    const loginUrl = req.body.loginUrl || (source === 'shaya' ? 'https://alshaayie2-exp.com/login_db.php' : 'https://aljoodexp.com/login_db.php');
    const searchUrl = req.body.searchUrl || (source === 'shaya' ? 'https://alshaayie2-exp.com/search_wasl2.php' : 'https://aljoodexp.com/search_wasl2.php');
    const loginCheck = req.body.loginCheck || 'logout.php';
    const sourceName = source === 'shaya' ? 'شركة الشائع' : 'شركة الجود';

    try {
      const client = await getClient(source, sourceName, username, password, loginUrl, loginCheck);

      const headers = req.body.columns || [
        'Actions', 'Sequence', 'idWasl_Value', 'Client Name', 'Representative Name', 'Governorate',
        'Area', 'Customer Phone', 'Total Amount', 'Delivery Fee', 'Net Amount',
        'Customer Name', 'Order ID', 'Client Phone', 'Status', 'Status Type',
        'Download', 'Cargo Type', 'Pieces Count', 'Notes', 'Date Added'
      ];

      // Parallel fetching for all dates
      const fetchPromises = dates.map(async (date: string) => {
        try {
          const searchRes = await client.post(searchUrl,
            new URLSearchParams({ 'date_add': date, 'wasl_search': 'بحث' }).toString(),
            { 
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              timeout: 30000
            }
          );

          if (!searchRes.data || typeof searchRes.data !== 'string') return [];

          const $ = cheerio.load(searchRes.data);
          const dateOrders: any[] = [];
          $('tr[id]').each((_, row) => {
            const cells = $(row).find('td');
            if (cells.length >= 21) {
              const rowData: any = { Value: $(row).attr('id') };
              for (let i = 1; i <= 20; i++) {
                const headerName = headers[i];
                let cellText = $(cells[i]).text().trim();
                const link = $(cells[i]).find('a');
                if (link.length > 0) {
                  cellText = link.text().trim();
                }
                rowData[headerName] = cellText;
              }
              dateOrders.push(rowData);
            }
          });
          return dateOrders;
        } catch (e) {
          console.error(`Error fetching for date ${date}:`, e);
          return [];
        }
      });

      const results = await Promise.all(fetchPromises);
      const allOrders = results.flat();

      // Commented out individual log to avoid duplicate logs (this is covered by the unified client process log)
      // const user = (req as any).user;
      // if (user) {
      //   await logActivity(user.uid, user.username, 'جلب طلبات المصدر', `تم جلب طلبات شركة شحن مصدر (${sourceName}) بنجاح للتواريخ (${dates.join(', ')}). الإجمالي: ${allOrders.length} طلب.`);
      // }

      res.json({ orders: allOrders, message: `اكتمل جلب طلبات ${sourceName}. الإجمالي: ${allOrders.length}` });
    } catch (error: any) {
      const user = (req as any).user;
      if (user) {
        await logActivity(user.uid, user.username, 'خطأ جلب طلبات المصدر', `فشل جلب الطلبات من شركة المصدر (${source === 'shaya' ? 'شركة الشائع' : 'شركة الجود'}): ${error.message}`);
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Update Server with Dynamic Injection Hooked
  app.post('/api/update-server', injectUserConfig, async (req, res) => {
    const { username, password, urls } = req.body;
    
    const loginUrl = req.body.loginUrl || 'https://msm-exp.com/login_db.php';
    const loginCheck = req.body.loginCheck || 'logout';

    // Extract dynamic host origin from active parent company's login URL
    let dynamicOrigin = 'https://msm-exp.com';
    try {
      const parsedUrl = new URL(loginUrl);
      dynamicOrigin = parsedUrl.origin;
    } catch (err: any) {
      console.warn('[Update Server Router] Could not extract origin from loginUrl:', err.message);
    }

    try {
      const client = await getClient('hawk', 'صقور نينوى', username, password, loginUrl, loginCheck);

      res.setHeader('Content-Type', 'application/x-ndjson');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      let successCount = 0;
      let failCount = 0;

      // Map incoming URLs to use the active parent company's dynamic origin
      const normalizedUrls = (urls || []).map((targetUrl: string) => {
        try {
          const parsedTarget = new URL(targetUrl);
          return `${dynamicOrigin}${parsedTarget.pathname}${parsedTarget.search}`;
        } catch {
          if (targetUrl.startsWith('/')) {
            return `${dynamicOrigin}${targetUrl}`;
          }
          return `${dynamicOrigin}/${targetUrl}`;
        }
      });

      // Process in batches of 10 for speed but to avoid overwhelming the target server
      const batchSize = 10;
      for (let i = 0; i < normalizedUrls.length; i += batchSize) {
        const batch = normalizedUrls.slice(i, i + batchSize);
        const results = await Promise.all(batch.map(async (url) => {
          try {
            await client.get(url, { timeout: 15000 });
            return { url, success: true };
          } catch (e: any) {
            return { url, success: false, error: e.message };
          }
        }));

        for (const resItem of results) {
          if (resItem.success) successCount++;
          else failCount++;
          res.write(JSON.stringify(resItem) + '\n');
        }
      }

      // Commented out generic server log - client now triggers detailed multi-parameter logs on success
      // const user = (req as any).user;
      // if (user) {
      //   await logActivity(user.uid, user.username, 'مزامنة وتحديث الحالات', `تمت مطابقة ومزامنة ${successCount} حالة طلب مع الشركة الأم بنجاح (العمليات الناجحة: ${successCount}، غير الناجحة: ${failCount}).`);
      // }

      res.write(JSON.stringify({ summary: true, successCount, failCount }) + '\n');
      res.end();
    } catch (error: any) {
      const user = (req as any).user;
      if (user) {
        await logActivity(user?.uid || 'unknown', user?.username || 'unknown', 'خطأ مزامنة وتحديث الحالات', `فشل مزامنة وتفريغ الحالات: ${error.message}`);
      }
      res.write(JSON.stringify({ error: error.message }) + '\n');
      res.end();
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
