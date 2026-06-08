import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  LayoutDashboard, 
  Settings as SettingsIcon, 
  ListChecks, 
  RefreshCw, 
  ChevronRight, 
  Search, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  XCircle,
  ExternalLink,
  Save,
  Plus,
  Trash2,
  FileSpreadsheet,
  ArrowRightLeft,
  ArrowLeft,
  Terminal,
  ShieldCheck,
  Calendar,
  Filter,
  History,
  Activity,
  Database,
  Copy,
  ChevronLeft,
  Package,
  Zap,
  User
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast, Toaster } from 'sonner';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { format, subDays } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

import LoginPage from './components/LoginPage';
import AdminDashboard from './components/AdminDashboard';
import { UserConfig, ShippingProvider, Shortcut } from './types';

// Types
interface Order {
  Sequence: string;
  idWasl_Value: string;
  Value: string;
}

interface JoodOrder {
  Value: string;
  idWasl_Value: string;
  Status: string;
  'Status Type': string;
  Download: string;
  Notes: string;
  [key: string]: string;
}

interface MatchedResult {
  Sequence: string;
  ulNum: string;
  idWasl_Value: string;
  Match_Count: number;
  Status: string;
  Status_Type: string;
  Download: string;
  Notes: string;
  Notes_Encoded: string;
  StatusNumber: string;
}

interface ReplacementRule {
  find: string;
  replace: string;
}

const SHORTCUT_COLORS = [
  { id: 'white', name: 'أبيض', bg: 'bg-white', text: 'text-slate-700', border: 'border-slate-200', hover: 'hover:bg-slate-50' },
  { id: 'blue', name: 'أزرق', bg: 'bg-blue-600', text: 'text-white', border: 'border-blue-700', hover: 'hover:bg-blue-700' },
  { id: 'green', name: 'أخضر', bg: 'bg-green-600', text: 'text-white', border: 'border-green-700', hover: 'hover:bg-green-700' },
  { id: 'red', name: 'أحمر', bg: 'bg-red-600', text: 'text-white', border: 'border-red-700', hover: 'hover:bg-red-700' },
  { id: 'amber', name: 'برتقالي', bg: 'bg-amber-500', text: 'text-white', border: 'border-amber-600', hover: 'hover:bg-amber-600' },
  { id: 'indigo', name: 'بنفسجي', bg: 'bg-indigo-600', text: 'text-white', border: 'border-indigo-700', hover: 'hover:bg-indigo-700' },
  { id: 'slate', name: 'رمادي', bg: 'bg-slate-700', text: 'text-white', border: 'border-slate-800', hover: 'hover:bg-slate-800' },
  { id: 'rose', name: 'وردي', bg: 'bg-rose-500', text: 'text-white', border: 'border-rose-600', hover: 'hover:bg-rose-600' },
];

const STATUS_OPTIONS = [
  { label: "غير مؤكد", value: '0' },
  { label: "بحوزة مندوب استلام", value: '14' },
  { label: "قيد التنفيذ", value: '1' },
  { label: "قيد التنفيذ بحوزة مندوب", value: '10' },
  { label: "تم التسليم", value: '2' },
  { label: "المؤجل", value: '3' },
  { label: "الرفض", value: '4' }
];

const AUTO_RANGE_OPTIONS = [
  { label: "آخر 3 أيام", value: '3' },
  { label: "آخر أسبوع (7 أيام)", value: '7' },
  { label: "آخر أسبوعين (14 يوم)", value: '14' },
  { label: "آخر 3 أسابيع (21 يوم)", value: '21' },
  { label: "آخر شهر (30 يوم)", value: '30' },
  { label: "آخر شهرين (60 يوم)", value: '60' },
];

export default function App() {
  // State: Authentication Layer
  const [currentUser, setCurrentUser] = useState<UserConfig | null>(null);

  const isSubscriptionExpired = (() => {
    if (!currentUser || currentUser.role === 'admin') return false;
    const sub = currentUser.subscription;
    if (!sub) return false;
    
    // Check if subscription has expired by date or state
    const todayYMD = new Date().toISOString().split('T')[0];
    const expiredByDate = sub.expiresAt && sub.expiresAt < todayYMD;
    const expiredByStatus = sub.status === 'expired' || sub.status === 'canceled';
    return !!(expiredByDate || expiredByStatus);
  })();

  // State: View Management
  const [currentView, setCurrentView] = useState<'main' | 'analysis' | 'updater'>('main');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isShortcutModalOpen, setIsShortcutModalOpen] = useState(false);
  const [isProcessConfigModalOpen, setIsProcessConfigModalOpen] = useState(false);
  const [isUpdateInfoModalOpen, setIsUpdateInfoModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalColor, setModalColor] = useState('bg-blue-600');
  const [modalData, setModalData] = useState<MatchedResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<MatchedResult | null>(null);
  const [modalType, setModalType] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState('');
  const [editedIds, setEditedIds] = useState<Set<string>>(new Set());
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);
  const [editingShortcut, setEditingShortcut] = useState<Shortcut | null>(null);
  const [activeSettings, setActiveSettings] = useState<Shortcut['settings'] | null>(null);
  const [expandedShortcutId, setExpandedShortcutId] = useState<string | null>(null);
  const [shortcutWidths, setShortcutWidths] = useState<Record<string, number>>({});
  const [runningShortcutId, setRunningShortcutId] = useState<string | null>(null);
  const shortcutContainerRef = useRef<HTMLDivElement>(null);
  
  // State: Settings
  const [hawkUser, setHawkUser] = useState('');
  const [hawkPass, setHawkPass] = useState('');
  const [joodUser, setJoodUser] = useState('');
  const [joodPass, setJoodPass] = useState('');
  const [shayaUser, setShayaUser] = useState('');
  const [shayaPass, setShayaPass] = useState('');
  const [searchSource, setSearchSource] = useState<string>('jood');
  const [providers, setProviders] = useState<ShippingProvider[]>([]);
  const [parentCredentials, setParentCredentials] = useState<Record<string, { username?: string, password?: string }>>({});
  const [sourceCredentials, setSourceCredentials] = useState<Record<string, { username?: string, password?: string }>>({});
  const [keyword, setKeyword] = useState('');
  const [statusCode, setStatusCode] = useState('10');
  const [joodMode, setJoodMode] = useState('auto_range');
  const [autoRange, setAutoRange] = useState('3');
  const [singleDate, setSingleDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [replacementRules, setReplacementRules] = useState<ReplacementRule[]>([]);

  // State: Data
  const [hawkOrders, setHawkOrders] = useState<Order[]>([]);
  const [joodOrders, setJoodOrders] = useState<JoodOrder[]>([]);
  const [matchedResults, setMatchedResults] = useState<MatchedResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fetchLogs, setFetchLogs] = useState<{ text: string; type: 'info' | 'success' | 'error' | 'default' }[]>([]);
  const [updateLogs, setUpdateLogs] = useState<{ text: string; type: 'info' | 'success' | 'error' | 'default' }[]>([]);
  
  const logEndRef = useRef<HTMLDivElement>(null);
  const updateLogEndRef = useRef<HTMLDivElement>(null);

  // Configure Axios Response Interceptor and Validate Session dynamically
  useEffect(() => {
    // Axios response interceptor to catch any permission / session changes instantly
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response && [401, 403].includes(error.response.status)) {
          if (localStorage.getItem('logged_in_user')) {
            localStorage.removeItem('logged_in_user');
            localStorage.removeItem('app_settings');
            setCurrentUser(null);
            toast.error(error.response.data?.error || 'تم إنهاء الجلسة لانتهاء الصلاحية أو إيقاف الحساب.');
          }
        }
        return Promise.reject(error);
      }
    );

    // Startup Session Validation with Firestore Server
    const savedUser = localStorage.getItem('logged_in_user');
    if (savedUser && savedUser !== 'undefined') {
      try {
        const parsed = JSON.parse(savedUser) as UserConfig;
        if (parsed && parsed.uid) {
          setCurrentUser(parsed);
          axios.defaults.headers.common['x-user-id'] = parsed.uid;
          axios.defaults.headers.common['x-user-password'] = parsed.password;

          axios.get('/api/auth/me', {
            headers: { 
              'x-user-id': parsed.uid,
              'x-user-password': parsed.password
            }
          })
          .then(res => {
            // Update localized details matching database states
            setCurrentUser(res.data.user);
            localStorage.setItem('logged_in_user', JSON.stringify(res.data.user));
          })
          .catch(err => {
            console.warn('Initial session check rejected user:', err);
            // Auto logout is triggered by the interceptor above
          });
        }
      } catch (e) {
        console.error('Failed to parse saved user on startup', e);
      }
    }

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, []);

  // Periodic Session Heartbeat and High-precision Active Presence / Stay Time tracker
  useEffect(() => {
    if (!currentUser?.uid) return;

    // 1. Dynamic block status validator (every 15 seconds to sync role/access updates and validate password live)
    const validateInterval = setInterval(() => {
      axios.get('/api/auth/me', {
        headers: { 
          'x-user-id': currentUser.uid,
          'x-user-password': currentUser.password
        }
      })
      .then(res => {
        // Sync modified roles or credentials live
        setCurrentUser(res.data.user);
        localStorage.setItem('logged_in_user', JSON.stringify(res.data.user));
      })
      .catch(err => {
        console.warn('Dynamic heartbeat session validation rejected user status:', err);
        // Interceptor will log out and notify
      });
    }, 60000);

    // 2. Presence & stay-time tracker (pulses every 15 seconds when active)
    const getYMDString = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const todayYMD = getYMDString(new Date());

    // Isolate keys per user UID to prevent duration leak when switching accounts on the same browser
    const userPrefix = `presence_${currentUser.uid}`;
    const dateKey = `${userPrefix}_today_date`;
    const secsKey = `${userPrefix}_accumulated_seconds`;
    const visitsKey = `${userPrefix}_visits_count`;
    const pingKey = `${userPrefix}_last_ping_time`;

    const savedDate = localStorage.getItem(dateKey);
    const savedSecondsStr = localStorage.getItem(secsKey);
    const savedVisitsStr = localStorage.getItem(visitsKey);
    const savedLastPingStr = localStorage.getItem(pingKey);

    let currentSeconds = 0;
    let currentVisits = 1;

    const isSameDay = savedDate === todayYMD;

    if (isSameDay) {
      currentSeconds = Number(savedSecondsStr) || 0;
      currentVisits = Number(savedVisitsStr) || 1;
      
      const lastPingTime = Number(savedLastPingStr) || 0;
      const elapsedMinutes = (Date.now() - lastPingTime) / 60000;
      
      // If the last ping was more than 15 minutes ago, it counts as a brand-new session visit/recheck!
      if (lastPingTime > 0 && elapsedMinutes > 15) {
        currentVisits += 1;
      }
    } else {
      // New day, reset accumulate counter
      currentSeconds = 0;
      currentVisits = 1;
    }

    localStorage.setItem(dateKey, todayYMD);
    localStorage.setItem(secsKey, String(currentSeconds));
    localStorage.setItem(visitsKey, String(currentVisits));
    localStorage.setItem(pingKey, String(Date.now()));

    const sendPresencePulse = (secs: number, vsts: number) => {
      axios.post('/api/user/heartbeat', {
        seconds: secs,
        visits: vsts,
        todayDate: todayYMD
      }, {
        headers: { 'x-user-id': currentUser.uid }
      }).catch(err => {
        console.warn('[Presence Pulse] Failed to sync heartbeat:', err.message);
      });
    };

    // Send initial pulse on load
    sendPresencePulse(currentSeconds, currentVisits);

    const pingInterval = setInterval(() => {
      // Increase elapsed count and send only if the page/tab is visible to user
      if (document.visibilityState === 'visible') {
        currentSeconds += 15;
        localStorage.setItem(secsKey, String(currentSeconds));
        localStorage.setItem(pingKey, String(Date.now()));
        sendPresencePulse(currentSeconds, currentVisits);
      }
    }, 15000);

    return () => {
      clearInterval(validateInterval);
      clearInterval(pingInterval);
    };
  }, [currentUser?.uid]);

  useEffect(() => {
    if (currentUser?.uid) {
      axios.defaults.headers.common['x-user-id'] = currentUser.uid;
      axios.defaults.headers.common['x-user-password'] = currentUser.password;
      
      // Load saved settings first to see if user has already customized configurations locally
      const savedSettingsStr = localStorage.getItem('app_settings');
      let savedSettings: any = null;
      if (savedSettingsStr && savedSettingsStr !== 'undefined') {
        try {
          savedSettings = JSON.parse(savedSettingsStr);
        } catch {}
      }

      // Fetch dynamic active shipping providers templates configured in the system
      axios.get('/api/admin/providers')
        .then(res => {
          const fetchedProviders = res.data.providers || [];
          setProviders(fetchedProviders);
        })
        .catch(err => {
          console.error('Failed to fetch providers in App.tsx:', err);
        });

      // Automap parent credentials dynamically prioritizing local inputs with fallback to database profile
      const activeParentId = currentUser.parentProviderId || 'hawk';
      const dbParentCredentials = currentUser.parentCredentials || { username: '', password: '' };
      
      const parentCredsMap = savedSettings?.parentCredentials || {};
      const savedParentUser = parentCredsMap[activeParentId]?.username;
      const savedParentPass = parentCredsMap[activeParentId]?.password;

      // If we have local user changes for this current parent company, use them; otherwise, fall back to the DB's profile
      const finalParentUser = savedParentUser !== undefined ? savedParentUser : (dbParentCredentials.username || '');
      const finalParentPass = savedParentPass !== undefined ? savedParentPass : (dbParentCredentials.password || '');

      setHawkUser(finalParentUser);
      setHawkPass(finalParentPass);

      // Initialize parentCredentials mapping
      const initialParentCreds: Record<string, { username?: string, password?: string }> = {
        ...parentCredsMap,
        [activeParentId]: { username: finalParentUser, password: finalParentPass }
      };
      setParentCredentials(initialParentCreds);
      
      // Dynamically initialize sourceCredentials for all assigned providers
      const initialCreds: Record<string, { username?: string, password?: string }> = {};
      if (currentUser.sourceProviderIds) {
        currentUser.sourceProviderIds.forEach(provId => {
          const dbCredentials = currentUser.sourceCredentials?.[provId] || { username: '', password: '' };
          const savedCredentials = savedSettings?.sourceCredentials?.[provId];
          initialCreds[provId] = {
            username: savedCredentials?.username !== undefined ? savedCredentials.username : (dbCredentials.username || ''),
            password: savedCredentials?.password !== undefined ? savedCredentials.password : (dbCredentials.password || '')
          };
        });
      }
      setSourceCredentials(initialCreds);

      // Keep legacy states for backward compatibility
      setJoodUser(savedSettings?.joodUser || initialCreds['jood']?.username || currentUser.sourceCredentials?.jood?.username || '');
      setJoodPass(savedSettings?.joodPass || initialCreds['jood']?.password || currentUser.sourceCredentials?.jood?.password || '');
      setShayaUser(savedSettings?.shayaUser || initialCreds['shaya']?.username || currentUser.sourceCredentials?.shaya?.username || '');
      setShayaPass(savedSettings?.shayaPass || initialCreds['shaya']?.password || currentUser.sourceCredentials?.shaya?.password || '');

      // Enable the first active source provider by default if available, keeping current if still valid
      if (currentUser.sourceProviderIds && currentUser.sourceProviderIds.length > 0) {
        setSearchSource(prev => {
          if (currentUser.sourceProviderIds && currentUser.sourceProviderIds.includes(prev)) {
            return prev;
          }
          return currentUser.sourceProviderIds[0];
        });
      }
    } else {
      delete axios.defaults.headers.common['x-user-id'];
      delete axios.defaults.headers.common['x-user-password'];
    }
  }, [currentUser]);

  const handleLoginSuccess = (user: UserConfig) => {
    setCurrentUser(user);
    localStorage.setItem('logged_in_user', JSON.stringify(user));
  };

  const handleLogout = () => {
    if (currentUser) {
      axios.post('/api/admin/logs', {
        userId: currentUser.uid,
        username: currentUser.username,
        action: 'تسجيل الخروج',
        details: 'قام المحدّث بتسجيل الخروج من النظام طواعية.'
      }).catch(err => {
        console.warn('Failed to log logout activity:', err);
      });

      // Call express logout route to flush active presence instantly
      axios.post('/api/auth/logout', { userId: currentUser.uid }, {
        headers: {
          'x-user-id': currentUser.uid,
          'x-user-password': currentUser.password
        }
      }).catch(err => {
        console.warn('Failed to notify backend logout presence flush:', err.message);
      });
    }
    setCurrentUser(null);
    localStorage.removeItem('logged_in_user');
  };

  // Load settings from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('app_settings');
    if (saved && saved !== 'undefined') {
      try {
        const data = JSON.parse(saved);
        setHawkUser(data.hawkUser || '');
        setHawkPass(data.hawkPass || '');
        setJoodUser(data.joodUser || '');
        setJoodPass(data.joodPass || '');
        setShayaUser(data.shayaUser || '');
        setShayaPass(data.shayaPass || '');
        setKeyword(data.keyword || 'الجود');
        setStatusCode(data.statusCode || '10');
        setJoodMode(data.joodMode || 'today');
        setAutoRange(data.autoRange || '7');
        setSingleDate(data.singleDate || format(new Date(), 'yyyy-MM-dd'));
        setStartDate(data.startDate || format(new Date(), 'yyyy-MM-dd'));
        setEndDate(data.endDate || format(new Date(), 'yyyy-MM-dd'));
        setReplacementRules(data.replacementRules || []);
        if (data.parentCredentials) {
          setParentCredentials(prev => ({
            ...prev,
            ...data.parentCredentials
          }));
        }
        if (data.sourceCredentials) {
          setSourceCredentials(prev => ({
            ...prev,
            ...data.sourceCredentials
          }));
        }
        
        // App settings loaded successfully
      } catch (err) {
        console.error('Failed to parse app settings array:', err);
      }
    }
  }, []);

  // Sync shortcuts dynamically when the logged in user changes
  useEffect(() => {
    if (currentUser) {
      setShortcuts(currentUser.shortcuts || []);
    } else {
      setShortcuts([]);
    }
  }, [currentUser]);

  // Auto-save settings
  useEffect(() => {
    const data = {
      hawkUser, hawkPass, joodUser, joodPass, shayaUser, shayaPass, parentCredentials, sourceCredentials, keyword, statusCode,
      joodMode, autoRange, singleDate, startDate, endDate, replacementRules,
      shortcuts
    };
    localStorage.setItem('app_settings', JSON.stringify(data));
  }, [hawkUser, hawkPass, joodUser, joodPass, shayaUser, shayaPass, parentCredentials, sourceCredentials, keyword, statusCode, joodMode, autoRange, singleDate, startDate, endDate, replacementRules, shortcuts]);

  // Scroll logs to bottom
  useEffect(() => {
    if (fetchLogs.length > 0) {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [fetchLogs]);

  useEffect(() => {
    if (updateLogs.length > 0) {
      updateLogEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [updateLogs]);

  const addLog = (text: string, type: 'info' | 'success' | 'error' | 'default' = 'default', category: 'fetch' | 'update' = 'fetch') => {
    if (category === 'fetch') {
      setFetchLogs(prev => [...prev, { text, type }]);
    } else {
      setUpdateLogs(prev => [...prev, { text, type }]);
    }
  };

  useEffect(() => {
    if (selectedResult) {
      setEditingNote(selectedResult.Notes || '');
    }
  }, [selectedResult]);

  const handleSaveNote = () => {
    if (!selectedResult) return;
    
    setMatchedResults(prev => prev.map(r => {
      if (r.idWasl_Value === selectedResult.idWasl_Value && r.Sequence === selectedResult.Sequence) {
        return {
          ...r,
          Notes: editingNote,
          Notes_Encoded: encodeURIComponent(editingNote)
        };
      }
      return r;
    }));
    
    setEditedIds(prev => new Set(prev).add(`${selectedResult.idWasl_Value}-${selectedResult.Sequence}`));
    toast.success('تم حفظ الملاحظة بنجاح');
    setSelectedResult(null);
  };

  const handleSaveSettings = async () => {
    try {
      // 1. Send credentials to remote DB endpoint verified with active session password
      const payload = {
        parentCredentials: {
          username: hawkUser,
          password: hawkPass
        },
        sourceCredentials: sourceCredentials
      };

      await axios.post('/api/user/credentials', payload, {
        headers: { 
          'x-user-id': currentUser?.uid,
          'x-user-password': currentUser?.password
        }
      });

      // 2. Synchronize memory and localStorage with the secure changes
      if (currentUser) {
        const updatedUser = {
          ...currentUser,
          parentCredentials: {
            username: hawkUser,
            password: hawkPass
          },
          sourceCredentials: sourceCredentials
        };
        setCurrentUser(updatedUser);
        localStorage.setItem('logged_in_user', JSON.stringify(updatedUser));
      }

      toast.success('تم حفظ وتثبيت إعدادات تسجيل الدخول للشركات بقاعدة البيانات بنجاح.');
      setIsSettingsModalOpen(false);
    } catch (err: any) {
      console.error('Failed to save settings to remote database:', err);
      toast.error('فشل في حفظ إعدادات تسجيل الدخول بقاعدة البيانات: ' + (err.response?.data?.error || err.message));
    }
  };

  const handlePasteReplace = async () => {
    try {
      // Try to use the modern Clipboard API
      if (!navigator.clipboard || !navigator.clipboard.readText) {
        throw new Error('المتصفح لا يدعم الوصول المباشر للحافظة');
      }
      
      const text = await navigator.clipboard.readText();
      setEditingNote(text);
      toast.success('تم اللصق واستبدال الملاحظة');
    } catch (err: any) {
      console.error('Clipboard error:', err);
      
      // Detailed error messages based on common browser issues
      if (err.name === 'NotAllowedError') {
        toast.error('يرجى السماح للمتصفح بالوصول إلى الحافظة عند الطلب');
      } else {
        toast.error('فشل الوصول التلقائي: يرجى استخدام (Ctrl+V) للصق يدوياً');
      }
      
      // Fallback: Focus the textarea so the user can paste manually
      const textarea = document.querySelector('textarea');
      if (textarea) {
        textarea.focus();
        textarea.select();
      }
    }
  };

  // Shortcuts Logic
  const openShortcutModal = (shortcut?: Shortcut) => {
    if (shortcut) {
      setEditingShortcut(shortcut);
    } else {
      setEditingShortcut({
        id: '',
        name: '',
        color: 'white',
        settings: {
          keyword: '',
          statusCode,
          joodMode,
          autoRange,
          singleDate,
          startDate,
          endDate,
          searchSource
        }
      });
    }
    setIsShortcutModalOpen(true);
  };

  const handleExpandShortcut = (id: string, event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setShortcutWidths(prev => ({ ...prev, [id]: rect.width }));
    setExpandedShortcutId(id);
  };

  // Handle outside clicks for shortcuts
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (shortcutContainerRef.current && !shortcutContainerRef.current.contains(event.target as Node)) {
        setExpandedShortcutId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const syncShortcutsToServer = async (updatedShortcuts: Shortcut[]) => {
    if (!currentUser) return;
    try {
      await axios.post('/api/user/shortcuts', { shortcuts: updatedShortcuts }, {
        headers: {
          'x-user-id': currentUser.uid,
          'x-user-password': currentUser.password
        }
      });
      const newUser = { ...currentUser, shortcuts: updatedShortcuts };
      setCurrentUser(newUser);
      localStorage.setItem('logged_in_user', JSON.stringify(newUser));
    } catch (err: any) {
      console.warn('[Sync Shortcuts Error]:', err.message);
    }
  };

  const saveShortcut = async () => {
    if (!editingShortcut || !editingShortcut.name) {
      toast.error('يرجى إدخال اسم الاختصار');
      return;
    }
    
    let nextShortcuts: Shortcut[] = [];
    if (editingShortcut.id) {
      nextShortcuts = shortcuts.map(s => s.id === editingShortcut.id ? editingShortcut : s);
      setShortcuts(nextShortcuts);
      toast.success('تم تحديث الاختصار');
    } else {
      const newShortcut = { ...editingShortcut, id: Date.now().toString() };
      nextShortcuts = [...shortcuts, newShortcut];
      setShortcuts(nextShortcuts);
      toast.success('تم إضافة الاختصار');
    }
    setIsShortcutModalOpen(false);
    await syncShortcutsToServer(nextShortcuts);
  };

  const deleteShortcut = async (id: string) => {
    const nextShortcuts = shortcuts.filter(s => s.id !== id);
    setShortcuts(nextShortcuts);
    toast.success('تم حذف الاختصار');
    await syncShortcutsToServer(nextShortcuts);
  };

  const runShortcut = (shortcut: Shortcut) => {
    if (runningShortcutId) return;
    
    setRunningShortcutId(shortcut.id);
    runProcess(shortcut.settings);
    
    setTimeout(() => {
      setRunningShortcutId(null);
      setExpandedShortcutId(null);
    }, 1500);
  };

  // Helper: Get dates for Jood
  const getJoodDates = (settings?: Shortcut['settings']) => {
    let dates: string[] = [];
    const today = new Date();
    const mode = settings?.joodMode || joodMode;
    const range = settings?.autoRange || autoRange;
    const sDate = settings?.singleDate || singleDate;
    const stDate = settings?.startDate || startDate;
    const enDate = settings?.endDate || endDate;
    
    if (mode === 'today') {
      dates.push(format(today, 'MM/dd/yyyy'));
    } else if (mode === 'auto_range') {
      const days = parseInt(range);
      for (let i = 0; i <= days; i++) {
        dates.push(format(subDays(today, i), 'MM/dd/yyyy'));
      }
    } else if (mode === 'single') {
      dates.push(format(new Date(sDate), 'MM/dd/yyyy'));
    } else if (mode === 'range') {
      let current = new Date(stDate);
      const end = new Date(enDate);
      while (current <= end) {
        dates.push(format(current, 'MM/dd/yyyy'));
        current.setDate(current.getDate() + 1);
      }
    }
    return dates;
  };

  // Process: Run All
  const runProcess = async (customSettings?: Shortcut['settings']) => {
    if (isSubscriptionExpired) {
      toast.error('عفواً، لا يمكنك بدء جلب وتصفية البيانات لأن اشتراك حسابك منتهي الصلاحية أو غير نشط. يرجى مراجعة إدارة المنصة لتفعيل حسابك.');
      addLog('خطأ: تم حظر جلب البيانات لانتهاء صلاحية الاشتراك السنوي للحساب.', 'error');
      return;
    }

    const activeKeyword = customSettings?.keyword || keyword;
    const activeStatusCode = customSettings?.statusCode || statusCode;
    const activeSource = customSettings?.searchSource || searchSource;

    const activeParentId = currentUser?.parentProviderId || 'hawk';
    const parentProvider = providers.find(p => p.id === activeParentId);
    const parentName = parentProvider?.name || 'صقور نينوى';

    const activeProvider = providers.find(p => p.id === activeSource);
    const sourceName = activeProvider?.name || (activeSource === 'jood' ? 'شركة الجود' : activeSource === 'shaya' ? 'شركة الشائع' : `شركة ${activeSource}`);

    const sourceUser = sourceCredentials[activeSource]?.username || 
                       (activeSource === 'jood' ? joodUser : activeSource === 'shaya' ? shayaUser : '') || 
                       currentUser?.sourceCredentials?.[activeSource]?.username || '';
    const sourcePass = sourceCredentials[activeSource]?.password || 
                       (activeSource === 'jood' ? joodPass : activeSource === 'shaya' ? shayaPass : '') || 
                       currentUser?.sourceCredentials?.[activeSource]?.password || '';

    if (!hawkUser || !hawkPass || !sourceUser || !sourcePass) {
      toast.error(`يرجى إدخال بيانات تسجيل الدخول لـ ${parentName} و ${sourceName}`);
      addLog('خطأ: بيانات الدخول ناقصة', 'error');
      return;
    }
    
    // Store active settings for display in statistics
    setActiveSettings(customSettings || {
      keyword,
      statusCode,
      joodMode,
      autoRange,
      singleDate,
      startDate,
      endDate,
      searchSource: activeSource
    });

    setIsLoading(true);
    setProgress(0);
    setFetchLogs([]);
    addLog('بدء العملية المتكاملة...', 'info', 'fetch');
    addLog(`المصدر: ${sourceName} | البحث: '${activeKeyword}' | الحالة: '${activeStatusCode}'`, 'info', 'fetch');

    const startTimeFetch = Date.now();

    try {
      // 1 & 2. Parallel Fetching for Hawk and Source
      addLog(`بدء جلب البيانات المتزامن لـ ${parentName} و ${sourceName}...`, 'info', 'fetch');
      const joodDates = getJoodDates(customSettings);
      
      let hawkFinished = false;
      let completedDates = 0;
      const totalSteps = joodDates.length + 1;

      const updateFetchProgress = () => {
        const current = ((hawkFinished ? 1 : 0) + completedDates) / totalSteps * 80;
        setProgress(Math.round(current));
      };

      const hawkPromise = axios.post('/api/hawk/process', {
        username: hawkUser,
        password: hawkPass,
        filterKeyword: activeKeyword,
        statusCode: activeStatusCode
      }).then(res => {
        if (!res.data || !Array.isArray(res.data.orders)) {
          throw new Error(`فشل في جلب بيانات ${parentName}: استجابة غير صالحة`);
        }
        hawkFinished = true;
        updateFetchProgress();
        addLog(`تم جلب بيانات ${parentName} بنجاح`, 'success', 'fetch');
        return res.data.orders;
      });

      addLog(`جاري جلب بيانات المصدر للتواريخ المحددة (${joodDates.length} أيام)...`, 'info', 'fetch');
      const sourcePromise = axios.post('/api/source/process', {
        username: sourceUser,
        password: sourcePass,
        dates: joodDates,
        source: activeSource
      }).then(res => {
        if (!res.data || !Array.isArray(res.data.orders)) {
          throw new Error(`استجابة غير صالحة من خادم جلب المصدر`);
        }
        completedDates = joodDates.length;
        updateFetchProgress();
        addLog(`تم جلب إجمالي ${res.data.orders.length} طلب لكافة الأيام من ${sourceName} بنجاح`, 'success', 'fetch');
        return res.data.orders;
      }).catch(err => {
        completedDates = joodDates.length;
        updateFetchProgress();
        const msg = err.response?.data?.error || err.message;
        addLog(`فشل جلب بيانات ${sourceName}: ${msg}`, 'error', 'fetch');
        return [];
      });

      const [hawkOrdersList, joodOrdersList] = await Promise.all([
        hawkPromise,
        sourcePromise
      ]);
      
      setHawkOrders(hawkOrdersList);
      setJoodOrders(joodOrdersList);
      setProgress(80);
      addLog(`اكتمل الجلب: ${hawkOrdersList.length} من ${parentName} و ${joodOrdersList.length} من ${sourceName}`, 'success', 'fetch');

      // 3. Optimized Matching Logic (O(N+M) using Map)
      addLog('جاري تحليل ومطابقة البيانات بسرعة فائقة...', 'info', 'fetch');
      
      // Index jood orders by idWasl_Value for O(1) lookup
      const joodMap = new Map<string, JoodOrder[]>();
      joodOrdersList.forEach((j: JoodOrder) => {
        if (!joodMap.has(j.idWasl_Value)) {
          joodMap.set(j.idWasl_Value, []);
        }
        joodMap.get(j.idWasl_Value)!.push(j);
      });
      
      const results: MatchedResult[] = hawkOrdersList.map((order: Order) => {
        const matches = joodMap.get(order.idWasl_Value) || [];
        const matchCount = matches.length;
        
        let result: MatchedResult = {
          Sequence: order.Sequence || '',
          ulNum: order.Value,
          idWasl_Value: order.idWasl_Value,
          Match_Count: matchCount,
          Status: 'No Match Found',
          Status_Type: '',
          Download: '',
          Notes: '',
          Notes_Encoded: '',
          StatusNumber: '#'
        };

        if (matchCount > 0) {
          const firstMatch = matches[0];
          result.Status = matches.map((m: JoodOrder) => m.Status).join(', ');
          result.Status_Type = firstMatch['Status Type'] || '';
          result.Download = firstMatch.Download || '';
          result.Notes = firstMatch.Notes || '';
          
          // Apply replacement rules
          let finalNotes = result.Notes;
          for (const rule of replacementRules) {
            if (rule.find && rule.replace && finalNotes.includes(rule.find)) {
              finalNotes = rule.replace;
            }
          }
          result.Notes = finalNotes;
          result.Notes_Encoded = encodeURIComponent(finalNotes);

          // Status Number Logic
          if (result.Status_Type) {
            result.StatusNumber = '#';
          } else if (matchCount === 1) {
            const s = firstMatch.Status;
            if (s === 'تم التسليم' || s.startsWith('تم المحاسبه') || s.startsWith('تم محاسبة')) {
              result.StatusNumber = '2';
            } else if (s.includes('رفض') || s.includes('راجع مخزن') || s.includes('راجع عميل')) {
              result.StatusNumber = '4';
            } else if (s === 'مؤجل' || s === 'اعادة ارسال') {
              result.StatusNumber = '3';
            } else if (s.includes('واصل جزئي')) {
              result.StatusNumber = '#';
            }
          }
        }
        return result;
      });

      setMatchedResults(results);
      setProgress(100);
      addLog(`اكتملت عملية المطابقة بنجاح لـ ${results.length} طلب.`, 'success', 'fetch');
      toast.success('اكتملت العملية بنجاح');

      // 4. Log unified fetch operation
      if (currentUser) {
        const endTimeFetch = Date.now();
        const durationSecs = ((endTimeFetch - startTimeFetch) / 1000).toFixed(1);
        
        const detailsObj = {
          type: 'fetch_and_match',
          parentName: parentName,
          parentCount: hawkOrdersList.length,
          statusCode: activeStatusCode || 'الكل',
          keyword: activeKeyword || 'بدون كلمة تصفية',
          sourceName: sourceName,
          sourceCount: joodOrdersList.length,
          dates: joodDates,
          matchedCount: results.length,
          duration: durationSecs
        };

        axios.post('/api/admin/logs', {
          userId: currentUser.uid,
          username: currentUser.username,
          action: 'عملية جلب ومطابقة متكاملة',
          details: JSON.stringify(detailsObj)
        }).catch(err => {
          console.warn('Failed to log unified fetch activity:', err);
        });
      }
    } catch (error: any) {
      const msg = error.response?.data?.error || error.message;
      addLog(`فشل: ${msg}`, 'error', 'fetch');
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Stats
  const stats = useMemo(() => {
    const counts = {
      delivered: 0,
      partial: 0,
      executing: 0,
      delayed: 0,
      rejected: 0,
      unconfirmed: 0,
      noMatch: 0
    };

    matchedResults.forEach(r => {
      if (r.Match_Count === 0) {
        counts.noMatch++;
      } else if (r.Status_Type || r.Status.includes('واصل جزئي')) {
        counts.partial++;
      } else if (r.Match_Count > 1) {
        counts.unconfirmed++;
      } else {
        // Match_Count === 1
        const s = r.Status;
        if (s === 'تم التسليم' || s.startsWith('تم المحاسبه') || s.startsWith('تم محاسبة')) {
          counts.delivered++;
        } else if (s.includes('قيد التنفيذ')) {
          counts.executing++;
        } else if (s === 'مؤجل' || s === 'اعادة ارسال') {
          counts.delayed++;
        } else if (s.includes('رفض') || s.includes('راجع')) {
          counts.rejected++;
        } else {
          counts.unconfirmed++;
        }
      }
    });

    return counts;
  }, [matchedResults]);

  const handleViewList = (label: string, filterType: string, color: string) => {
    setModalTitle(label);
    setModalType(filterType);
    setModalColor(color);
    setIsModalOpen(true);
  };

  // Sync modalData when matchedResults changes
  useEffect(() => {
    if (isModalOpen && modalType) {
      let filtered: MatchedResult[] = [];
      
      if (modalType === 'delivered') {
        filtered = matchedResults.filter(r => 
          r.Match_Count === 1 && 
          !r.Status_Type && 
          !r.Status.includes('واصل جزئي') &&
          (r.Status === 'تم التسليم' || r.Status.startsWith('تم المحاسبه') || r.Status.startsWith('تم محاسبة'))
        );
      } else if (modalType === 'partial') {
        filtered = matchedResults.filter(r => r.Status_Type || r.Status.includes('واصل جزئي'));
      } else if (modalType === 'executing') {
        filtered = matchedResults.filter(r => 
          r.Match_Count === 1 && 
          !r.Status_Type && 
          !r.Status.includes('واصل جزئي') &&
          r.Status.includes('قيد التنفيذ')
        );
      } else if (modalType === 'delayed') {
        filtered = matchedResults.filter(r => 
          r.Match_Count === 1 && 
          !r.Status_Type && 
          !r.Status.includes('واصل جزئي') &&
          (r.Status === 'مؤجل' || r.Status === 'اعادة ارسال')
        );
      } else if (modalType === 'rejected') {
        filtered = matchedResults.filter(r => 
          r.Match_Count === 1 && 
          !r.Status_Type && 
          !r.Status.includes('واصل جزئي') &&
          (r.Status.includes('رفض') || r.Status.includes('راجع'))
        );
      } else if (modalType === 'unconfirmed') {
        filtered = matchedResults.filter(r => {
          if (r.Match_Count === 0 || r.Status_Type || r.Status.includes('واصل جزئي')) return false;
          if (r.Match_Count > 1) return true;
          const s = r.Status;
          const isKnown = (s === 'تم التسليم' || s.startsWith('تم المحاسبه') || s.startsWith('تم محاسبة')) ||
                          s.includes('قيد التنفيذ') ||
                          (s === 'مؤجل' || s === 'اعادة ارسال') ||
                          (s.includes('رفض') || s.includes('راجع'));
          return !isKnown;
        });
      } else if (modalType === 'noMatch') {
        filtered = matchedResults.filter(r => r.Match_Count === 0);
      }

      setModalData(filtered);
    }
  }, [matchedResults, isModalOpen, modalType]);

  // Export to Excel
  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(matchedResults);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Results");
    XLSX.writeFile(wb, "Matched_Results.xlsx");
    toast.success('تم تصدير الملف بنجاح');
  };

  // Updater Logic
  const [updaterStatus, setUpdaterStatus] = useState({
    status2: false,
    status3: false,
    status4: false,
    notes3: true,
    notes4: true,
    mainStatus: true
  });

  const runUpdater = async () => {
    if (isSubscriptionExpired) {
      toast.error('عفواً، لا يمكنك تحديث الحالات على السيرفر ومزامنة البيانات بسبب انتهاء اشتراك حسابك أو إلغائه.');
      return;
    }

    const activeParentId = currentUser?.parentProviderId || 'hawk';
    const parentProvider = providers.find(p => p.id === activeParentId);
    const parentName = parentProvider?.name || 'صقور نينوى';

    if (!hawkUser || !hawkPass) {
      toast.error(`يرجى إدخال بيانات ${parentName}`);
      return;
    }

    const urlSet = new Set<string>();
    
    // Status 2
    if (updaterStatus.status2) {
      matchedResults.filter(r => r.StatusNumber === '2').forEach(r => {
        urlSet.add(`https://msm-exp.com/changeState.php?wasl_id=${r.ulNum}&state=2`);
      });
    }
    // Status 3
    if (updaterStatus.status3) {
      matchedResults.filter(r => r.StatusNumber === '3').forEach(r => {
        urlSet.add(`https://msm-exp.com/changeState.php?wasl_id=${r.ulNum}&state=3`);
      });
    }
    // Status 4
    if (updaterStatus.status4) {
      matchedResults.filter(r => r.StatusNumber === '4').forEach(r => {
        urlSet.add(`https://msm-exp.com/changeState.php?wasl_id=${r.ulNum}&state=4`);
      });
    }
    // Main Status
    if (updaterStatus.mainStatus) {
      matchedResults.filter(r => r.StatusNumber !== '#').forEach(r => {
        urlSet.add(`https://msm-exp.com/changeState.php?wasl_id=${r.ulNum}&state=${r.StatusNumber}`);
      });
    }
    // Notes 3
    if (updaterStatus.notes3) {
      matchedResults.filter(r => r.StatusNumber === '3' && r.Notes).forEach(r => {
        urlSet.add(`https://msm-exp.com/changeNote.php?wasl_id=${r.ulNum}&note=${r.Notes_Encoded}`);
      });
    }
    // Notes 4
    if (updaterStatus.notes4) {
      matchedResults.filter(r => r.StatusNumber === '4' && r.Notes).forEach(r => {
        urlSet.add(`https://msm-exp.com/changeNote.php?wasl_id=${r.ulNum}&note=${r.Notes_Encoded}`);
      });
    }

    const finalUrls = Array.from(urlSet);

    if (finalUrls.length === 0) {
      toast.error('لا توجد روابط للتنفيذ');
      return;
    }

    setIsLoading(true);
    setProgress(0);
    setUpdateLogs([]);
    addLog(`بدء عملية تحديث السيرفر لـ ${finalUrls.length} إجراء...`, 'info', 'update');
    
    // Scroll to logs
    setTimeout(() => {
      updateLogEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);

    const startTimeUpdate = Date.now();
    let successCount = 0;
    let failCount = 0;

    let deliveredCountObj = 0;
    let delayedCountObj = 0;
    let rejectedCountObj = 0;
    let notesCountObj = 0;

    try {
      const response = await fetch('/api/update-server', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: hawkUser,
          password: hawkPass,
          urls: finalUrls
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'فشل الاتصال بالسيرفر');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      if (!reader) throw new Error('فشل بدء قراءة البيانات من السيرفر');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          const data = JSON.parse(line);

          if (data.summary) {
            successCount = data.summary ? data.successCount : successCount;
            failCount = data.summary ? data.failCount : failCount;
            continue;
          }

          if (data.error && !data.url) {
            addLog(`❌ خطأ عام: ${data.error}`, 'error', 'update');
            continue;
          }

          const url = data.url;
          const urlObj = new URL(url);
          const waslId = urlObj.searchParams.get('wasl_id');
          const state = urlObj.searchParams.get('state');
          const isNote = url.includes('changeNote.php');
          
          // Find the tracking number (idWasl_Value) for the log
          const result = matchedResults.find(r => r.ulNum === waslId);
          const displayId = result ? result.idWasl_Value : waslId;
          
          let actionDesc = '';
          if (isNote) {
            actionDesc = `تحديث ملاحظة الطلب رقم ${displayId}`;
          } else {
            const stateLabel = STATUS_OPTIONS.find(o => o.value === state)?.label || state;
            actionDesc = `تحديث حالة الطلب رقم ${displayId} إلى [${stateLabel}]`;
          }

          if (data.success) {
            const logType = isNote ? 'note-success' : 'success';
            addLog(`✅ تم ${actionDesc} بنجاح`, logType as any, 'update');

            // Collect category stats
            if (isNote) {
              notesCountObj++;
            } else if (state === '2') {
              deliveredCountObj++;
            } else if (state === '3') {
              delayedCountObj++;
            } else if (state === '4') {
              rejectedCountObj++;
            }
          } else {
            addLog(`❌ فشل ${actionDesc}: ${data.error || 'خطأ غير معروف'}`, 'error', 'update');
          }

          const processedCount = (successCount + failCount + 1);
          const currentProgress = Math.round((processedCount / finalUrls.length) * 100);
          setProgress(Math.min(currentProgress, 99));
        }
      }

      setProgress(100);
      addLog(`اكتملت العملية: تم بنجاح ${successCount}، وفشل ${failCount}`, successCount > 0 ? 'success' : 'error', 'update');
      toast.success(`تم إكمال التحديث: ${successCount} ناجح، ${failCount} فاشل`);

      // Log detailed update activity to admin logger
      if (currentUser) {
        const selectedOptions: string[] = [];
        if (updaterStatus.mainStatus) selectedOptions.push("تحديث الحالات الموحدة");
        if (updaterStatus.status2) selectedOptions.push("تحديث فقط: التسليم (2)");
        if (updaterStatus.status3) selectedOptions.push("تحديث فقط: المؤجل (3)");
        if (updaterStatus.status4) selectedOptions.push("تحديث فقط: الرفض (4)");
        if (updaterStatus.notes3) selectedOptions.push("إرفاق ملاحظة المؤجل");
        if (updaterStatus.notes4) selectedOptions.push("إرفاق ملاحظة الرفض");

        const endTimeUpdate = Date.now();
        const durationSecs = ((endTimeUpdate - startTimeUpdate) / 1000).toFixed(1);

        const detailsObj = {
          type: 'update_with_stats',
          selectedOptions,
          successCount,
          failCount,
          deliveredCount: deliveredCountObj,
          delayedCount: delayedCountObj,
          rejectedCount: rejectedCountObj,
          notesCount: notesCountObj,
          duration: durationSecs
        };

        axios.post('/api/admin/logs', {
          userId: currentUser.uid,
          username: currentUser.username,
          action: 'تحديث ومزامنة حالات السيرفر',
          details: JSON.stringify(detailsObj)
        }).catch(err => {
          console.warn('Failed to log update activity:', err);
        });
      }
    } catch (error: any) {
      const msg = error.response?.data?.error || error.message;
      addLog(`فشل التحديث العام: ${msg}`, 'error', 'update');
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  if (!currentUser) {
    return (
      <>
        <LoginPage onLoginSuccess={handleLoginSuccess} />
        <Toaster position="top-center" richColors />
      </>
    );
  }

  if (currentUser.role === 'admin') {
    return (
      <>
        <AdminDashboard currentUser={currentUser} onLogout={handleLogout} />
        <Toaster position="top-center" richColors />
      </>
    );
  }

  const currentParentId = currentUser?.parentProviderId || 'hawk';
  const currentParentProvider = providers.find(p => p.id === currentParentId);
  const currentParentName = currentParentProvider?.name || 'صقور نينوى';

  const LogoIconLocal = ({ className = "w-10 h-10", color = "blue" }: { className?: string; color?: string }) => {
    const isWhite = color === "white";
    return (
      <div className="flex items-center gap-2 select-none">
        <svg viewBox="0 0 120 120" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M25 82C25 87.5 29.5 92 35 92C40.5 92 45 87.5 45 82V52L60 66L75 52V82C75 87.5 79.5 92 85 92C90.5 92 95 87.5 95 82V38C95 32 88.5 28 83 31L60 47L37 31C31.5 28 25 32 25 38V82Z"
            fill={isWhite ? "currentColor" : "#0052e0"}
          />
          <line x1="39" y1="45" x2="51" y2="54" stroke={isWhite ? "#0052e0" : "white"} strokeWidth="4" strokeLinecap="round" />
          <circle cx="39" cy="45" r="6.5" fill={isWhite ? "#0052e0" : "white"} />
          <line x1="81" y1="45" x2="69" y2="54" stroke={isWhite ? "#0052e0" : "white"} strokeWidth="4" strokeLinecap="round" />
          <circle cx="81" cy="45" r="6.5" fill={isWhite ? "#0052e0" : "white"} />
        </svg>
        <span className={cn("text-lg font-black tracking-tight", isWhite ? "text-white" : "text-[#0052e0]")} style={{ fontFamily: 'Alexandria, sans-serif' }}>
          مطابق
        </span>
      </div>
    );
  };

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full justify-between">
      <div className="space-y-6">
        {/* Brand Logo Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <LogoIconLocal className="w-8 h-8" color="blue" />
          <Badge variant="outline" className="text-[9px] font-black tracking-wider text-slate-400 border-slate-200">
            V أولي
          </Badge>
        </div>

        {/* Current Active User Profile Card */}
        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-full bg-blue-50 text-[#0052e0] border border-blue-100/60 flex items-center justify-center shadow-inner overflow-hidden shrink-0">
            <User size={18} />
          </div>
          <div className="flex flex-col text-right space-y-1.5 py-0.5">
            <span className="text-xs font-black text-slate-800 leading-none">{currentUser?.username}</span>
            <span className="text-[10px] text-slate-500 font-bold leading-none">محدِّث النظام</span>
          </div>
        </div>

        {/* Sidebar Navigation Vertical Menu List */}
        <div className="space-y-1.5">
          {[
            { id: 'main', label: 'الرئيسية', icon: Activity },
            { id: 'analysis', label: 'الإحصائيات', icon: LayoutDashboard },
            { id: 'updater', label: 'التحديث', icon: RefreshCw },
          ].map((item) => {
            const isActive = currentView === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setCurrentView(item.id as any);
                  setIsSidebarOpen(false);
                }}
                className={cn(
                  "w-full h-11 px-4 rounded-xl flex items-center gap-3 transition-all text-xs font-black text-right",
                  isActive
                    ? "bg-blue-50 text-[#0052e0]"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                )}
              >
                <Icon size={16} className={isActive ? "text-[#0052e0]" : "text-slate-400"} />
                <span>{item.label}</span>
              </button>
            );
          })}

          <div className="my-2 border-t border-slate-100/80" />

          <button
            onClick={() => setIsRulesModalOpen(true)}
            className="w-full h-11 px-4 rounded-xl flex items-center gap-3 transition-all text-xs font-black text-slate-600 hover:text-slate-950 hover:bg-slate-50 text-right"
          >
            <ArrowRightLeft size={16} className="text-slate-400" />
            <span>قواعد الملاحظات</span>
          </button>
          <button
            onClick={() => {
              setCurrentView('settings');
              setIsSidebarOpen(false);
            }}
            className={cn(
              "w-full h-11 px-4 rounded-xl flex items-center gap-3 transition-all text-xs font-black text-right",
              currentView === 'settings'
                ? "bg-blue-50 text-[#0052e0]"
                : "text-slate-600 hover:text-slate-950 hover:bg-slate-50"
            )}
          >
            <SettingsIcon size={16} className={currentView === 'settings' ? "text-[#0052e0]" : "text-slate-400"} />
            <span>ربط شركات الشحن</span>
          </button>
          <button
            onClick={() => setIsUpdateInfoModalOpen(true)}
            className="w-full h-11 px-4 rounded-xl flex items-center gap-3 transition-all text-xs font-black text-slate-600 hover:text-slate-950 hover:bg-slate-50 text-right"
          >
            <Clock size={16} className="text-slate-400" />
            <span>معلومات الإصدار</span>
          </button>
        </div>
      </div>

      {/* Logout and Exit trigger */}
      <div className="pt-4 border-t border-slate-100">
        <Button
          variant="ghost"
          onClick={handleLogout}
          className="w-full h-11 px-4 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 font-black text-xs flex items-center justify-between border border-red-100/30 gap-1"
        >
          <span className="flex items-center gap-2">
            <XCircle size={16} />
            <span>تسجيل الخروج</span>
          </span>
          <ChevronLeft size={14} className="opacity-60" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans selection:bg-blue-100/80 transition-all duration-300" dir="rtl">
      <Toaster position="bottom-left" richColors />

      <div className="flex w-full">
        {/* DESKTOP SIDEBAR - PERSISTENT ON THE RIGHT */}
        <aside className="hidden md:flex w-72 bg-white border-l border-slate-200/80 flex-col p-6 fixed top-0 bottom-0 right-0 z-30 select-none shadow-[2px_0_15px_rgba(0,0,0,0.01)]">
          {renderSidebarContent()}
        </aside>

        {/* MAIN WORKSPACE WRAPPER */}
        <div className="flex-1 md:mr-72 min-h-screen flex flex-col bg-[#f8fafc] pb-6 md:pb-6 relative w-full overflow-hidden">
          
          {/* MOBILE TOP HEADER & NAVIGATION BLOCK */}
          <div className="md:hidden sticky top-0 z-40 bg-white border-b border-slate-100 shadow-[0_4px_12px_rgba(0,0,0,0.02)]">
            <header className="h-16 flex items-center justify-between px-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsSidebarOpen(true)}
                  className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-700"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16m-7 6h7" />
                  </svg>
                </button>
              </div>
              <div>
                <LogoIconLocal className="w-8 h-8" color="blue" />
              </div>
              <button
                onClick={() => setCurrentView('settings')}
                className={cn(
                  "w-9 h-9 rounded-xl flex items-center justify-center transition-all",
                  currentView === 'settings' 
                    ? "bg-blue-50 text-[#0052e0]" 
                    : "bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-100/80"
                )}
                title="إعدادات النظام والربط"
              >
                <SettingsIcon size={18} />
              </button>
            </header>

            {/* MOBILE TOP NAVIGATION BAR */}
            <nav className="h-12 bg-white border-t border-slate-100 flex justify-around items-center px-4">
              {[
                { id: 'main', label: 'الرئيسية', icon: Activity },
                { id: 'analysis', label: 'الإحصائيات', icon: LayoutDashboard },
                { id: 'updater', label: 'التحديث', icon: RefreshCw },
              ].map((b) => {
                const isActive = currentView === b.id;
                const Icon = b.icon;
                return (
                  <button
                    key={b.id}
                    onClick={() => setCurrentView(b.id as any)}
                    className={cn(
                      "flex items-center gap-1.5 py-1.5 px-3 rounded-lg transition-all h-9 text-xs font-black",
                      isActive ? "bg-blue-50 text-[#0052e0]" : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    <Icon size={16} className={isActive ? "scale-105" : ""} />
                    <span>{b.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* COLLAPSIBLE SIDEBAR DRAWER - MOBILE ONLY */}
          <AnimatePresence>
            {isSidebarOpen && (
              <div className="fixed inset-0 z-[60] md:hidden">
                {/* Dark Backdrop overlay */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.4 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsSidebarOpen(false)}
                  className="absolute inset-0 bg-slate-900"
                />
                {/* Sliding panel from right */}
                <motion.div
                  initial={{ x: "100%" }}
                  animate={{ x: 0 }}
                  exit={{ x: "100%" }}
                  transition={{ type: "spring", damping: 25, stiffness: 220 }}
                  className="absolute top-0 bottom-0 right-0 w-72 bg-white p-6 shadow-2xl flex flex-col justify-between"
                >
                  {renderSidebarContent()}
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* MAIN CONTENT INNER WORKSPACE */}
          <main className="px-4 py-6 md:py-8 md:px-8 space-y-6 md:space-y-8 flex-1">
            
            {/* Welcoming Top Heading for Desktop */}
            <div className="hidden md:flex items-center justify-between border-b border-slate-100 pb-5">
              <div>
                <h2 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">
                  مرحباً، {currentUser?.username}
                </h2>
                <p className="text-xs text-slate-400 font-bold mt-1">
                  هذا ملخص عملياتك لمزامنة وتصفية طلبات الشحن اليوم
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsUpdateInfoModalOpen(true)} className="rounded-xl border-slate-200 text-xs font-bold gap-1.5 h-10 px-4 bg-white">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm" />
                  الإصدار المعتمد V1
                </Button>
              </div>
            </div>

            {/* Subscription Expiration Banner */}
            {isSubscriptionExpired && (
              <div className="mb-6 bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 text-white p-5 rounded-3xl shadow-xl flex flex-col md:flex-row items-center justify-between gap-4 border border-red-500 animate-pulse">
                <div className="flex items-center gap-4 text-center md:text-right">
                  <div className="p-3 bg-white/10 rounded-2xl border border-white/20 shrink-0">
                    <Clock className="text-white animate-spin-slow" size={28} />
                  </div>
                  <div>
                    <h4 className="text-base font-black">عفواً، اشتراك حسابك منتهي الصلاحية أو غير نشط!</h4>
                    <p className="text-white/80 text-xs font-bold mt-1">
                      تاريخ انتهاء تفعيل حسابك هو: <span className="font-mono bg-white/20 px-2 py-0.5 rounded text-white">{currentUser?.subscription?.expiresAt || 'غير محدد'}</span>. 
                      {currentUser?.subscription?.notes ? ` (ملاحظة المسؤول: "${currentUser?.subscription.notes}").` : ''} يرجى التواصل مع مالك المنصة لتفعيل حسابك ومتابعة تحديث وتصفية الطلبات.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button 
                    onClick={() => toast.info('يرجى التواصل مع الملاك أو المشرفين لتنشيط الاشتراك.')}
                    className="bg-white text-rose-700 hover:bg-slate-100 font-extrabold text-xs px-6 py-2 rounded-xl border border-white/10 shadow"
                  >
                    طلب تنشيط الحساب
                  </Button>
                </div>
              </div>
            )}

            <AnimatePresence mode="wait">
              {currentView === 'main' && (
            <motion.div 
              key="main"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="max-w-5xl mx-auto space-y-8"
            >
              {/* Shortcuts Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-6 bg-blue-600 rounded-full" />
                    <h3 className="text-lg font-black text-slate-800">الاختصارات</h3>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => openShortcutModal()}
                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 font-bold gap-2"
                  >
                    <Plus size={16} />
                    إضافة اختصار جديد
                  </Button>
                </div>
                
                <ScrollArea className="w-full whitespace-nowrap pb-4">
                  <div className="flex gap-4" ref={shortcutContainerRef}>
                    {shortcuts.filter((s) => currentUser?.sourceProviderIds?.includes(s.settings.searchSource)).length === 0 && (
                      <div className="text-slate-400 text-sm italic py-4">لا توجد اختصارات محفوظة حالياً...</div>
                    )}
                    {shortcuts.filter((s) => currentUser?.sourceProviderIds?.includes(s.settings.searchSource)).map((s) => (
                      <div key={s.id} className="relative group">
                        <AnimatePresence mode="wait">
                          {expandedShortcutId === s.id ? (
                            <motion.div 
                              key="expanded"
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              transition={{ duration: 0.15, ease: "easeOut" }}
                              className="flex h-20 rounded-2xl overflow-hidden shadow-lg border border-slate-200"
                              style={{ width: shortcutWidths[s.id] || '12rem' }}
                            >
                              <button 
                                onClick={() => {
                                  openShortcutModal(s);
                                  setExpandedShortcutId(null);
                                }}
                                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-black text-sm flex items-center justify-center transition-colors"
                              >
                                تعديل
                              </button>
                              <button 
                                onClick={() => runShortcut(s)}
                                disabled={runningShortcutId === s.id}
                                className={`flex-1 ${runningShortcutId === s.id ? 'bg-green-600' : 'bg-green-500 hover:bg-green-600'} text-white font-black text-sm flex items-center justify-center transition-colors border-r border-white/20`}
                              >
                                {runningShortcutId === s.id ? 'تم التشغيل' : 'تشغيل'}
                              </button>
                            </motion.div>
                          ) : (
                            <motion.div
                              key="normal"
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              transition={{ duration: 0.15, ease: "easeOut" }}
                            >
                              {(() => {
                                const colorCfg = SHORTCUT_COLORS.find(c => c.id === s.color) || SHORTCUT_COLORS[0];
                                return (
                                  <Button
                                    onClick={(e) => handleExpandShortcut(s.id, e)}
                                    className={cn(
                                      "h-20 px-8 rounded-2xl shadow-sm flex flex-col items-center justify-center gap-1 transition-all min-w-[12rem] border",
                                      colorCfg.bg,
                                      colorCfg.text,
                                      colorCfg.border,
                                      colorCfg.hover
                                    )}
                                  >
                                    <span className="text-sm font-black">{s.name}</span>
                                    <span className={cn("text-[10px] font-bold opacity-70", colorCfg.id === 'white' ? "text-slate-400" : "text-white/80")}>
                                      {s.settings.keyword || 'بدون كلمة'} - {STATUS_OPTIONS.find(o => o.value === s.settings.statusCode)?.label}
                                    </span>
                                  </Button>
                                );
                              })()}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {/* Main Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
                <Button 
                  onClick={() => setIsProcessConfigModalOpen(true)} 
                  disabled={isLoading}
                  className="sm:col-span-2 h-24 md:h-32 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 hover:from-blue-500 hover:to-indigo-700 text-white rounded-3xl shadow-[0_20px_50px_rgba(59,130,246,0.2)] transition-all active:scale-95 flex flex-col gap-1 md:gap-2 relative overflow-hidden group border-none"
                >
                  <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="flex items-center gap-3 relative z-10">
                    {isLoading ? <RefreshCw className="animate-spin" size={24} /> : <Activity size={24} />}
                    <span className="text-lg sm:text-xl md:text-2xl font-black tracking-tight">بدء الجلب والمطابقة</span>
                  </div>
                </Button>

                <div className="grid grid-cols-2 sm:grid-cols-1 gap-4">
                  <Button 
                    variant="outline"
                    onClick={() => setCurrentView('settings')}
                    className="h-full md:h-auto py-4 md:py-6 rounded-3xl border-slate-200 hover:border-blue-500 hover:bg-blue-50 text-slate-700 hover:text-blue-700 transition-all font-black flex flex-col gap-1"
                  >
                    <SettingsIcon size={20} />
                    <span className="text-xs">الإعدادات</span>
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => setIsRulesModalOpen(true)}
                    className="h-full md:h-auto py-4 md:py-6 rounded-3xl border-slate-200 hover:border-amber-500 hover:bg-amber-50 text-slate-700 hover:text-amber-700 transition-all font-black flex flex-col gap-1"
                  >
                    <ArrowRightLeft size={20} />
                    <span className="text-xs">القواعد</span>
                  </Button>
                </div>
              </div>

              {/* Terminal Section */}
              <Card className="rounded-[32px] overflow-hidden border-none shadow-2xl bg-[#0F172A] relative">
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_0%,rgba(59,130,246,0.1),transparent)]" />
                <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500/50" />
                      <div className="w-3 h-3 rounded-full bg-amber-500/50" />
                      <div className="w-3 h-3 rounded-full bg-green-500/50" />
                    </div>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-4">System Console</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                    <span className="text-[9px] font-bold text-blue-400/70 uppercase">Live Monitoring</span>
                  </div>
                </div>
                <CardContent className="p-0 relative z-10 bg-slate-900/50">
                  <ScrollArea className="h-[300px] md:h-[400px] p-6">
                    <div className="space-y-2 font-mono">
                      {fetchLogs.map((log, i) => (
                        <motion.div 
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          key={i} 
                          className={cn(
                            "flex gap-3 text-[11px] md:text-xs border-r-2 pr-4 py-1",
                            log.type === 'success' ? "border-green-500/50 text-green-400" :
                            log.type === 'error' ? "border-red-500/50 text-red-400" :
                            log.type === 'info' ? "border-blue-500/50 text-blue-400" : "border-slate-700 text-slate-400"
                          )}
                        >
                          <span className="text-slate-600 shrink-0">[{format(new Date(), 'HH:mm:ss')}]</span>
                          <span className="leading-relaxed break-all">
                            {log.text}
                          </span>
                        </motion.div>
                      ))}
                      {fetchLogs.length === 0 && (
                        <div className="text-slate-600 italic text-center py-20 flex flex-col items-center gap-4">
                          <Terminal size={48} className="opacity-10" />
                          <span className="text-sm">بانتظار بدء العمليات...</span>
                        </div>
                      )}
                      <div ref={logEndRef} />
                    </div>
                  </ScrollArea>
                </CardContent>
                <div className="bg-slate-900/80 p-5 border-t border-white/5 relative z-10">
                  <div className="flex items-center justify-between mb-3 px-1">
                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Process Progress</span>
                    <span className="text-xs text-blue-400 font-black">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-1.5 bg-slate-800" />
                </div>
              </Card>
            </motion.div>
          )}

          {currentView === 'analysis' && (
            <motion.div 
              key="analysis"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-8"
            >
              {/* Source Overview Cards */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
                <Card className="card-modern overflow-hidden group border-none shadow-xl">
                  <div className="h-2 bg-blue-600 w-full" />
                  <CardContent className="p-6 md:p-8">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 shadow-sm shrink-0">
                          <FileSpreadsheet size={24} />
                        </div>
                        <div>
                          <CardTitle className="text-slate-800 text-lg sm:text-xl font-black">
                            {(() => {
                              const activeParentId = currentUser?.parentProviderId || 'hawk';
                              return providers.find(p => p.id === activeParentId)?.name || 'صقور نينوى';
                            })()}
                          </CardTitle>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mt-0.5">الشركة الأم الأقدم</p>
                        </div>
                      </div>
                      <Badge className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-3 py-1 font-black self-start sm:self-center transition-colors">
                        {(currentUser?.parentProviderId || 'hawk').toUpperCase()}
                      </Badge>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 pt-4 border-t border-slate-100">
                      <div className="space-y-1">
                        <p className="text-slate-400 text-xs font-bold">إجمالي الطلبات</p>
                        <p className="text-4xl sm:text-5xl font-black tracking-tighter text-slate-900 leading-none">{hawkOrders.length.toLocaleString()}</p>
                      </div>
                      <div className="flex flex-col sm:items-end gap-2 shrink-0 w-full sm:w-auto">
                        <div className="bg-blue-50/80 px-3 py-1.5 rounded-xl border border-blue-100/50 text-[11px] font-black text-blue-900 flex items-center justify-between sm:justify-start gap-4 w-full">
                          <span className="text-blue-500 font-bold block sm:hidden">الحالة:</span>
                          <span>{STATUS_OPTIONS.find(o => o.value === (activeSettings?.statusCode || statusCode))?.label}</span>
                        </div>
                        <div className="bg-indigo-50/80 px-3 py-1.5 rounded-xl border border-indigo-100/50 text-[11px] font-black text-indigo-900 flex items-center justify-between sm:justify-start gap-4 w-full">
                          <span className="text-indigo-500 font-bold block sm:hidden">الكلمة المحددة:</span>
                          <span>{activeSettings?.keyword || keyword}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="card-modern overflow-hidden group border-none shadow-xl">
                  <div className="h-2 bg-slate-900 w-full" />
                  <CardContent className="p-6 md:p-8">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-900 shadow-sm shrink-0">
                          <Database size={24} />
                        </div>
                        <div>
                          <CardTitle className="text-slate-800 text-lg sm:text-xl font-black">
                            {providers.find(p => p.id === activeSettings?.searchSource)?.name || 
                             (activeSettings?.searchSource === 'shaya' ? 'شركة الشائع' : 
                              activeSettings?.searchSource === 'jood' ? 'شركة الجود' : 
                              `شركة ${activeSettings?.searchSource || ''}`)}
                          </CardTitle>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mt-0.5">مصدر السحب المربوط</p>
                        </div>
                      </div>
                      <Badge className="bg-slate-900 hover:bg-slate-800 text-white rounded-lg px-3 py-1 font-black self-start sm:self-center transition-colors">
                        {(activeSettings?.searchSource || 'N/A').toUpperCase()}
                      </Badge>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 pt-4 border-t border-slate-100">
                      <div className="space-y-1">
                        <p className="text-slate-400 text-xs font-bold">الطلبات المجلوبة</p>
                        <p className="text-4xl sm:text-5xl font-black tracking-tighter text-slate-900 leading-none">{joodOrders.length.toLocaleString()}</p>
                      </div>
                      <div className="flex flex-col sm:items-end gap-2 shrink-0 w-full sm:w-auto">
                        <div className="bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200/50 text-[11px] font-black text-slate-800 flex items-center justify-between sm:justify-start gap-4 w-full">
                          <span className="text-slate-500 font-bold block sm:hidden">النطاق الزمني:</span>
                          <span>
                            {(activeSettings?.joodMode || joodMode) === 'today' ? 'اليوم' : 
                             (activeSettings?.joodMode || joodMode) === 'auto_range' ? `تلقائي (${activeSettings?.autoRange || autoRange} يوم)` : 
                             'مخصص'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Matching Results Grid */}
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-6 bg-blue-600 rounded-full" />
                  <h3 className="text-lg font-black text-slate-800 font-sans">نتائج المطابقة النهائية</h3>
                </div>
                
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                  {[
                    { label: 'تم التسليم', count: stats.delivered, type: 'delivered', color: 'bg-green-500', icon: CheckCircle2, desc: 'مطابقة تامة ومؤكدة' },
                    { label: 'واصل جزئي', count: stats.partial, type: 'partial', color: 'bg-blue-500', icon: ArrowRightLeft, desc: 'تسليم جزئي للمواد' },
                    { label: 'قيد التنفيذ', count: stats.executing, type: 'executing', color: 'bg-amber-500', icon: Clock, desc: 'بانتظار التحديث النهائي' },
                    { label: 'المؤجل', count: stats.delayed, type: 'delayed', color: 'bg-indigo-500', icon: History, desc: 'طلبات تم تأجيلها' },
                    { label: 'الرفض', count: stats.rejected, type: 'rejected', color: 'bg-red-500', icon: XCircle, desc: 'طلبات تم رفضها' },
                    { label: 'غير مؤكد', count: stats.unconfirmed, type: 'unconfirmed', color: 'bg-slate-500', icon: AlertCircle, desc: 'تحتاج مراجعة يدوية' },
                    { label: 'لا يوجد مطابقة', count: stats.noMatch, type: 'noMatch', color: 'bg-slate-900', icon: Search, desc: 'لم يتم العثور على بيانات' },
                  ].map((item, idx) => (
                    <motion.div
                      key={item.type}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      onClick={() => handleViewList(item.label, item.type, item.color)}
                      className="group cursor-pointer text-right"
                    >
                      <Card className="card-modern h-full border-none shadow-lg hover:translate-y-[-4px] transition-all overflow-hidden relative">
                        <div className={cn("absolute top-0 left-0 w-1 h-full", item.color)} />
                        <CardContent className="p-4 sm:p-5">
                          <div className="flex items-center justify-between mb-3 sm:mb-4">
                            <div className={cn("w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-white shadow-lg shrink-0", item.color)}>
                              <item.icon size={18} className="sm:size-[20px]" />
                            </div>
                            <span className="text-2xl sm:text-3xl font-black tracking-tighter text-slate-900 leading-none">{item.count.toLocaleString()}</span>
                          </div>
                          <div className="space-y-0.5">
                            <h4 className="font-black text-slate-800 text-xs sm:text-sm truncate">{item.label}</h4>
                            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-tight block truncate">{item.desc}</p>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {currentView === 'updater' && (
            <motion.div 
              key="updater"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="max-w-5xl mx-auto space-y-8"
            >
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
                <div className="lg:col-span-1 space-y-6">
                  <Card className="card-modern overflow-hidden border-none shadow-xl">
                    <CardContent className="p-6 space-y-4">
                      <div className="space-y-4">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">ملخص الحالات</p>
                        <div className="flex items-center justify-around py-2">
                          {[
                            { label: 'تم التسليم', count: stats.delivered, color: 'border-green-500 text-green-600 bg-green-50' },
                            { label: 'مؤجل', count: stats.delayed, color: 'border-indigo-500 text-indigo-600 bg-indigo-50' },
                            { label: 'الرفض', count: stats.rejected, color: 'border-red-500 text-red-600 bg-red-50' },
                          ].map((item, i) => (
                            <div key={i} className="flex flex-col items-center gap-2">
                              <div className={cn("w-14 h-14 rounded-2xl border-2 flex items-center justify-center font-black text-xl shadow-sm transition-transform", item.color)}>
                                {item.count}
                              </div>
                              <span className="text-[10px] font-black text-slate-500">{item.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="lg:col-span-2 space-y-6">
                  <Card className="card-modern overflow-hidden border-none shadow-xl">
                    <CardHeader className="bg-white border-b border-slate-50 p-6 md:p-8">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-lg md:text-xl font-black text-slate-800">خيارات التحديث</CardTitle>
                        </div>
                        <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400">
                          <RefreshCw size={24} />
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6 md:p-8 space-y-8">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-8">
                        <div className="space-y-5">
                          <div className="flex items-center gap-3">
                            <div className="w-1.5 h-5 bg-blue-600 rounded-full" />
                            <h4 className="font-black text-slate-800 text-sm">تحديث الحالات</h4>
                          </div>
                          <div className="space-y-3">
                            {[
                              { id: 'mainStatus', label: 'تحديث الحالات الموحدة', icon: '⚡', checked: updaterStatus.mainStatus },
                              { id: 'status2', label: 'تحديث فقط: التسليم (2)', icon: '🟢', checked: updaterStatus.status2 },
                              { id: 'status3', label: 'تحديث فقط: المؤجل (3)', icon: '🟠', checked: updaterStatus.status3 },
                              { id: 'status4', label: 'تحديث فقط: الرفض (4)', icon: '🔴', checked: updaterStatus.status4 },
                            ].map((opt) => (
                              <div 
                                key={opt.id}
                                className={cn(
                                  "flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer group",
                                  opt.checked ? "bg-blue-50 border-blue-200" : "bg-slate-50 border-slate-100 hover:border-slate-200"
                                )}
                                onClick={() => {
                                  const newStatus = !updaterStatus[opt.id as keyof typeof updaterStatus];
                                  let updated = { ...updaterStatus, [opt.id]: newStatus };
                                  
                                  // Logic: If specific status checked, uncheck mainStatus
                                  if (opt.id !== 'mainStatus' && newStatus) {
                                    updated.mainStatus = false;
                                  }
                                  // Logic: If mainStatus checked, uncheck specific statuses
                                  if (opt.id === 'mainStatus' && newStatus) {
                                    updated.status2 = false;
                                    updated.status3 = false;
                                    updated.status4 = false;
                                  }
                                  
                                  setUpdaterStatus(updated);
                                }}
                              >
                                <Checkbox checked={opt.checked} />
                                <span className={cn("text-xs font-bold", opt.checked ? "text-blue-700" : "text-slate-600")}>
                                  <span className="ml-2">{opt.icon}</span>
                                  {opt.label}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-5">
                          <div className="flex items-center gap-3">
                            <div className="w-1.5 h-5 bg-amber-500 rounded-full" />
                            <h4 className="font-black text-slate-800 text-sm">تحديث الملاحظات</h4>
                          </div>
                          <div className="space-y-3">
                            {[
                              { id: 'notes3', label: 'إرفاق ملاحظة المؤجل', icon: '📝', checked: updaterStatus.notes3 },
                              { id: 'notes4', label: 'إرفاق ملاحظة الرفض', icon: '📝', checked: updaterStatus.notes4 },
                            ].map((opt) => (
                              <div 
                                key={opt.id}
                                className={cn(
                                  "flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer group",
                                  opt.checked ? "bg-amber-50 border-amber-200" : "bg-slate-50 border-slate-100 hover:border-slate-200"
                                )}
                                onClick={() => setUpdaterStatus({...updaterStatus, [opt.id]: !updaterStatus[opt.id as keyof typeof updaterStatus]})}
                              >
                                <Checkbox checked={opt.checked} />
                                <span className={cn("text-xs font-bold", opt.checked ? "text-amber-700" : "text-slate-600")}>
                                  <span className="ml-2">{opt.icon}</span>
                                  {opt.label}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <Button 
                        onClick={runUpdater} 
                        disabled={isLoading || matchedResults.length === 0}
                        className="w-full h-16 bg-slate-900 hover:bg-black text-white text-lg font-black rounded-2xl shadow-2xl shadow-slate-200 transition-all active:scale-95 group"
                      >
                        {isLoading ? <RefreshCw className="ml-3 animate-spin" size={22} /> : <Save className="ml-3 transition-transform" size={22} />}
                        تحديث السيرفر
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Mini Terminal for Updater */}
                  <div className="space-y-4">
                    <Card className="rounded-[24px] overflow-hidden border-none shadow-xl bg-[#0F172A] p-5 h-[250px] relative">
                      <div className="absolute top-0 right-0 p-3">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                      </div>
                      <ScrollArea className="h-full">
                        <div className="space-y-2 font-mono">
                          <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-3 border-b border-white/5 pb-2 flex justify-between items-center">
                            <span>سجل التحديث المباشر</span>
                            {isLoading && <span className="text-emerald-500 animate-pulse">جاري المعالجة...</span>}
                          </div>
                          {updateLogs.length === 0 && (
                            <div className="text-slate-600 italic text-[11px] py-4">في انتظار بدء التحديث...</div>
                          )}
                          {updateLogs.map((log, i) => (
                            <div key={i} className={cn(
                              "flex gap-3 text-[11px] border-r-2 pr-3 py-0.5",
                              log.type === 'success' ? "border-green-500/50 text-green-400" :
                              log.type === 'note-success' ? "border-cyan-500/50 text-cyan-400" :
                              log.type === 'error' ? "border-red-500/50 text-red-400" : "border-blue-500/50 text-blue-400"
                            )}>
                              <span className="text-slate-600 shrink-0">[{format(new Date(), 'HH:mm:ss')}]</span>
                              <span className="font-sans leading-relaxed">{log.text}</span>
                            </div>
                          ))}
                          <div ref={updateLogEndRef} />
                        </div>
                      </ScrollArea>
                    </Card>

                    {isLoading && (
                      <div className="bg-white p-4 rounded-2xl shadow-lg border border-slate-100 space-y-3">
                        <div className="flex justify-between items-center px-1">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">إجمالي التقدم</span>
                          <span className="text-xs font-black text-blue-600">{progress}%</span>
                        </div>
                        <Progress value={progress} className="h-2 bg-slate-100" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {currentView === 'settings' && (
            <motion.div 
              key="settings"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              className="max-w-5xl mx-auto space-y-8 text-right font-sans"
              dir="rtl"
            >
              {/* Simple elegant title row for Accounts */}
              <div className="border-b border-slate-200 pb-3 mb-6">
                <h3 className="font-black text-base text-slate-800">الحسابات</h3>
              </div>

              {/* Accounts Card Grid - Unified styling, same card height, aligned inputs, 1 column on tablet/mobile */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 1. يوزر التحديث في شركة Card */}
                {(() => {
                  const activeParentId = currentUser?.parentProviderId || 'hawk';
                  const parentProvider = providers.find(p => p.id === activeParentId);
                  const parentName = parentProvider?.name || 'صقور نينوى';
                  return (
                    <Card key="parent" className="card-modern overflow-hidden border-none shadow-xl">
                      <div className="h-1.5 bg-blue-600 w-full" />
                      <CardContent className="p-5 space-y-4">
                        <div className="flex items-center gap-3 mb-2 pb-1">
                          <div className="w-10 h-10 bg-blue-50 text-blue-600 border border-blue-100/60 rounded-xl flex items-center justify-center shadow-sm shrink-0 font-black text-xs">
                            {activeParentId.toUpperCase()}
                          </div>
                          <div>
                            <h5 className="font-black text-slate-800 text-sm leading-tight">{parentName}</h5>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="space-y-1.5">
                            <Label className="text-[11px] font-black text-slate-500">اسم المستخدم</Label>
                            <Input 
                              value={hawkUser} 
                              onChange={e => {
                                const val = e.target.value;
                                setHawkUser(val);
                                setParentCredentials(prev => ({
                                  ...prev,
                                  [activeParentId]: { ...prev[activeParentId], username: val }
                                }));
                              }} 
                              className="rounded-xl border-slate-200 text-xs md:text-sm h-10" 
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[11px] font-black text-slate-500">كلمة المرور</Label>
                            <Input 
                              type="text" 
                              value={hawkPass} 
                              onChange={e => {
                                const val = e.target.value;
                                setHawkPass(val);
                                setParentCredentials(prev => ({
                                  ...prev,
                                  [activeParentId]: { ...prev[activeParentId], password: val }
                                }));
                              }} 
                              className="rounded-xl border-slate-200 text-xs md:text-sm h-10" 
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })()}

                {/* 2. حسابات شركات التوصيل Cards */}
                {(currentUser?.sourceProviderIds || []).map((provId) => {
                  const provider = providers.find(p => p.id === provId);
                  const providerName = provider?.name || (provId === 'jood' ? 'شركة الجود' : provId === 'shaya' ? 'شركة الشائع' : `شركة ${provId}`);
                  const username = sourceCredentials[provId]?.username || '';
                  const password = sourceCredentials[provId]?.password || '';
                  return (
                    <Card key={provId} className="card-modern overflow-hidden border-none shadow-xl">
                      <div className="h-1.5 bg-indigo-600 w-full" />
                      <CardContent className="p-5 space-y-4">
                        <div className="flex items-center gap-3 mb-2 pb-1">
                          <div className="w-10 h-10 bg-indigo-50 text-indigo-600 border border-indigo-150 rounded-xl flex items-center justify-center shadow-sm shrink-0 font-black text-xs">
                            {provId.toUpperCase()}
                          </div>
                          <div>
                            <h5 className="font-black text-slate-800 text-sm leading-tight">{providerName}</h5>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="space-y-1.5">
                            <Label className="text-[11px] font-black text-slate-500">اسم المستخدم</Label>
                            <Input 
                              value={username} 
                              onChange={e => {
                                const nextCreds = { ...sourceCredentials };
                                nextCreds[provId] = { ...nextCreds[provId], username: e.target.value };
                                setSourceCredentials(nextCreds);
                                if (provId === 'jood') setJoodUser(e.target.value);
                                if (provId === 'shaya') setShayaUser(e.target.value);
                              }} 
                              className="rounded-xl border-slate-200 text-xs md:text-sm h-10" 
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[11px] font-black text-slate-500">كلمة المرور</Label>
                            <Input 
                              type="text" 
                              value={password} 
                              onChange={e => {
                                const nextCreds = { ...sourceCredentials };
                                nextCreds[provId] = { ...nextCreds[provId], password: e.target.value };
                                setSourceCredentials(nextCreds);
                                if (provId === 'jood') setJoodPass(e.target.value);
                                if (provId === 'shaya') setShayaPass(e.target.value);
                              }} 
                              className="rounded-xl border-slate-200 text-xs md:text-sm h-10" 
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}

                {(currentUser?.sourceProviderIds || []).length === 0 && (
                  <div className="col-span-full bg-slate-50 border border-slate-100 rounded-3xl p-12 text-center text-slate-400 italic font-black text-sm">
                    لا توجد شركات مصدر مربوطة بهذا الحساب.
                  </div>
                )}
              </div>

              {/* Action Save Bar */}
              <div className="flex justify-end pt-4 border-t border-slate-100/50">
                <Button 
                  onClick={async () => {
                    await handleSaveSettings();
                    setCurrentView('main');
                  }} 
                  className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white rounded-2xl px-12 py-6 text-sm font-black shadow-lg shadow-blue-100 transition-all hover:-translate-y-0.5"
                >
                  حفظ وتأكيد الإعدادات
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  </div>

      {/* Modal Popup */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[85vh] md:h-[80vh]"
            >
              <div className={cn("px-4 md:px-6 py-4 md:py-5 border-b flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-colors duration-500", modalColor, "text-white")}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-white shrink-0 backdrop-blur-md border border-white/30">
                    <ListChecks size={22} />
                  </div>
                  <div>
                    <h3 className="font-black text-base md:text-xl truncate">قائمة الطلبات: {modalTitle}</h3>
                    <p className="text-[10px] md:text-xs font-medium opacity-80">إجمالي العناصر المكتشفة: {modalData.length}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1 sm:flex-none h-9 text-[10px] md:text-xs font-bold bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white"
                    onClick={() => {
                      const allIds = modalData.map(r => r.idWasl_Value).join('\n');
                      navigator.clipboard.writeText(allIds);
                      toast.success('تم نسخ جميع الوصولات');
                    }}
                  >
                    <Copy size={14} className="ml-1" />
                    نسخ الكل
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setIsModalOpen(false)}
                    className="rounded-full hover:bg-white/10 text-white shrink-0 h-9 w-9"
                  >
                    <XCircle size={24} />
                  </Button>
                </div>
              </div>
              
              <div className="flex-1 min-h-0 overflow-auto bg-slate-50/30 flex flex-col">
                <div className="min-w-[900px] md:min-w-full p-2 md:p-4 flex-1 flex flex-col">
                  <Table className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex-1">
                    <TableHeader className="bg-slate-100/80 sticky top-0 z-10">
                      <TableRow>
                        <TableHead className="text-right font-black w-12 md:w-16 text-xs text-slate-700">ت</TableHead>
                        <TableHead className="text-right font-black text-xs text-slate-700">رقم الوصل</TableHead>
                        <TableHead className="text-right font-black text-xs text-slate-700">الحالة</TableHead>
                        <TableHead className="text-right font-black text-xs text-slate-700">نوع الحالة</TableHead>
                        <TableHead className="text-right font-black text-xs text-slate-700">قيمة التنزيل</TableHead>
                        <TableHead className="text-right font-black text-xs text-slate-700">الملاحظات</TableHead>
                        <TableHead className="text-center font-black text-xs text-slate-700">كود</TableHead>
                        <TableHead className="text-center font-black w-10 md:w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {modalData.map((r, i) => {
                        const isSelected = selectedResult?.idWasl_Value === r.idWasl_Value && selectedResult?.Sequence === r.Sequence;
                        const isEdited = editedIds.has(`${r.idWasl_Value}-${r.Sequence}`);
                        
                        return (
                          <TableRow 
                            key={i} 
                            className={cn(
                              "hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0",
                              isSelected && "bg-blue-50/50 ring-1 ring-inset ring-blue-200",
                              isEdited && !isSelected && "bg-green-50/30"
                            )}
                          >
                            <TableCell className="text-slate-500 font-mono text-[10px] md:text-xs font-bold">{r.Sequence || (i + 1)}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-black text-blue-700 text-xs md:text-sm">{r.idWasl_Value}</span>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-7 w-7 md:h-8 md:w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                                  onClick={() => {
                                    navigator.clipboard.writeText(r.idWasl_Value);
                                    toast.success('تم نسخ رقم الوصل');
                                  }}
                                  title="نسخ رقم الوصل"
                                >
                                  <Copy size={12} />
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {r.Status.split(',').map((s, idx) => (
                                  <Badge key={idx} variant="outline" className="text-[9px] md:text-[10px] font-bold border-slate-300 bg-white px-2 py-0.5 text-slate-700">
                                    {s.trim()}
                                  </Badge>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell className="text-[10px] md:text-xs font-black text-slate-800">{r.Status_Type || '-'}</TableCell>
                            <TableCell className="font-mono text-[10px] md:text-xs font-black text-slate-900">
                              {r.Download ? r.Download.replace('من', 'الى') : '0'}
                            </TableCell>
                            <TableCell 
                              className={cn(
                                "max-w-[150px] md:max-w-[250px] truncate text-slate-700 text-[10px] md:text-xs font-medium cursor-pointer hover:text-blue-600 hover:underline",
                                isEdited && "text-green-700 font-bold"
                              )}
                              onClick={() => setSelectedResult(r)}
                            >
                              {r.Notes || <span className="opacity-40 italic">بدون ملاحظات</span>}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge className={cn(
                                "w-7 h-7 md:w-9 md:h-9 rounded-xl flex items-center justify-center p-0 font-black text-[11px] md:text-sm shadow-sm",
                                r.StatusNumber === '2' ? 'bg-green-500 text-white' :
                                r.StatusNumber === '3' ? 'bg-indigo-500 text-white' :
                                r.StatusNumber === '4' ? 'bg-red-500 text-white' : 'bg-slate-200 text-slate-500'
                              )}>
                                {r.StatusNumber}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 md:h-9 md:w-9 text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                                onClick={() => {
                                  navigator.clipboard.writeText(r.idWasl_Value);
                                  toast.success('تم نسخ رقم الوصل');
                                }}
                                title="نسخ رقم الوصل"
                              >
                                <Copy size={14} />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {modalData.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-32 text-slate-500 font-bold italic">
                            لا توجد بيانات لهذه الفئة حالياً
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
              
              <div className="px-4 md:px-6 py-4 md:py-5 border-t border-slate-100 bg-white flex justify-between items-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <div className="flex items-center gap-4">
                  <p className="text-xs md:text-sm font-black text-slate-800">إجمالي العناصر: {modalData.length}</p>
                  <div className="h-4 w-px bg-slate-200 hidden sm:block" />
                  <p className="text-[10px] md:text-xs font-bold text-slate-500 hidden sm:block">تم التحديث: {format(new Date(), 'HH:mm:ss')}</p>
                </div>
                <Button onClick={() => setIsModalOpen(false)} className={cn("text-white rounded-xl px-8 md:px-12 h-10 md:h-12 text-sm md:text-base font-black shadow-lg transition-all active:scale-95", modalColor)}>إغلاق النافذة</Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Note Detail Modal */}
      <AnimatePresence>
        {selectedResult && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedResult(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden p-6"
            >
              <div className="mb-4 border-b border-slate-100 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">رقم الوصل</span>
                    <div className="flex items-center gap-2 bg-blue-50 px-3 py-1 rounded-lg border border-blue-100">
                      <span className="font-mono font-black text-blue-700 text-sm">{selectedResult.idWasl_Value}</span>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 text-blue-400 hover:text-blue-600 hover:bg-blue-100"
                        onClick={() => {
                          navigator.clipboard.writeText(selectedResult.idWasl_Value);
                          toast.success('تم نسخ رقم الوصل');
                        }}
                      >
                        <Copy size={12} />
                      </Button>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setSelectedResult(null)} className="rounded-full h-8 w-8">
                    <XCircle size={20} className="text-slate-400" />
                  </Button>
                </div>
                <h3 className="font-black text-lg text-slate-800">تفاصيل الملاحظة</h3>
              </div>
              
              <div className="space-y-4">
                <textarea 
                  value={editingNote}
                  onChange={(e) => setEditingNote(e.target.value)}
                  className="w-full bg-slate-50 p-4 rounded-xl border border-slate-100 min-h-[150px] text-slate-700 font-medium leading-relaxed focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                  placeholder="اكتب الملاحظة هنا..."
                />
                
                <div className="flex flex-wrap gap-2">
                  <Button 
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(editingNote);
                      toast.success('تم نسخ الملاحظة');
                    }}
                    className="rounded-xl gap-2 flex-1"
                  >
                    <Copy size={16} />
                    نسخ
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={handlePasteReplace}
                    className="rounded-xl gap-2 flex-1 border-amber-200 text-amber-700 hover:bg-amber-50"
                  >
                    <ArrowRightLeft size={16} />
                    لصق واستبدال
                  </Button>
                </div>
              </div>
              
              <div className="mt-8 flex gap-3">
                <Button variant="ghost" onClick={() => setSelectedResult(null)} className="flex-1 rounded-xl">إلغاء</Button>
                <Button onClick={handleSaveNote} className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black shadow-lg shadow-blue-100">حفظ الملاحظة</Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Shortcut Modal */}
      <AnimatePresence>
        {isShortcutModalOpen && editingShortcut && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsShortcutModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]"
            >
              <div className="bg-blue-600 p-6 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <Plus size={24} />
                  </div>
                  <h3 className="text-xl font-black">{editingShortcut.id ? 'تعديل اختصار' : 'إضافة اختصار جديد'}</h3>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setIsShortcutModalOpen(false)} className="rounded-full hover:bg-white/10 text-white">
                  <XCircle size={24} />
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="space-y-2">
                  <Label className="text-sm font-bold text-slate-700">مصدر البحث (شركة التوصيل)</Label>
                  <div className={cn(
                    "grid gap-3",
                    (currentUser?.sourceProviderIds || []).length === 1 ? "grid-cols-1" : "grid-cols-2"
                  )}>
                    {(currentUser?.sourceProviderIds || []).map((provId) => {
                      const provider = providers.find(p => p.id === provId);
                      const providerName = provider?.name || (provId === 'jood' ? 'شركة الجود' : provId === 'shaya' ? 'شركة الشائع' : `شركة ${provId}`);
                      return (
                        <button 
                          key={provId}
                          type="button"
                          onClick={() => setEditingShortcut({
                            ...editingShortcut,
                            settings: { ...editingShortcut.settings, searchSource: provId }
                          })}
                          className={cn(
                            "flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all text-sm font-bold",
                            editingShortcut.settings.searchSource === provId 
                              ? "border-blue-600 bg-blue-50 text-blue-700 shadow-sm" 
                              : "border-slate-100 bg-white text-slate-500 hover:border-slate-200"
                          )}
                        >
                          {providerName}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-bold text-slate-700">اسم الاختصار</Label>
                  <Input 
                    value={editingShortcut.name}
                    onChange={(e) => setEditingShortcut({...editingShortcut, name: e.target.value})}
                    placeholder="مثلاً: جلب طلبات اليوم - الجود"
                    className="rounded-xl border-slate-200 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-bold text-slate-700">لون الزر</Label>
                  <div className="flex flex-wrap gap-2">
                    {SHORTCUT_COLORS.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setEditingShortcut({ ...editingShortcut, color: c.id })}
                        className={cn(
                          "w-10 h-10 rounded-xl border-2 transition-all flex items-center justify-center",
                          c.bg,
                          c.border,
                          editingShortcut.color === c.id ? "ring-2 ring-blue-500 ring-offset-2 scale-110" : "opacity-80 hover:opacity-100"
                        )}
                        title={c.name}
                      >
                        {editingShortcut.color === c.id && (
                          <div className={cn("w-2 h-2 rounded-full", c.id === 'white' ? "bg-blue-600" : "bg-white")} />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-bold text-slate-700">كلمة البحث ({currentParentName})</Label>
                    <Input 
                      value={editingShortcut.settings.keyword}
                      onChange={(e) => setEditingShortcut({
                        ...editingShortcut, 
                        settings: {...editingShortcut.settings, keyword: e.target.value}
                      })}
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-bold text-slate-700">الحالة ({currentParentName})</Label>
                    <select 
                      value={editingShortcut.settings.statusCode}
                      onChange={(e) => setEditingShortcut({
                        ...editingShortcut, 
                        settings: {...editingShortcut.settings, statusCode: e.target.value}
                      })}
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <Label className="text-sm font-black text-slate-800">إعدادات التاريخ</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                      { id: 'today', label: 'اليوم' },
                      { id: 'auto_range', label: 'تلقائي' },
                      { id: 'single', label: 'يوم محدد' },
                      { id: 'range', label: 'نطاق' }
                    ].map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setEditingShortcut({
                          ...editingShortcut, 
                          settings: {...editingShortcut.settings, joodMode: m.id}
                        })}
                        className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                          editingShortcut.settings.joodMode === m.id 
                            ? 'bg-blue-600 text-white border-blue-600 shadow-md' 
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>

                  {editingShortcut.settings.joodMode === 'auto_range' && (
                    <select 
                      value={editingShortcut.settings.autoRange}
                      onChange={(e) => setEditingShortcut({
                        ...editingShortcut, 
                        settings: {...editingShortcut.settings, autoRange: e.target.value}
                      })}
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {AUTO_RANGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  )}

                  {editingShortcut.settings.joodMode === 'single' && (
                    <Input 
                      type="date" 
                      value={editingShortcut.settings.singleDate}
                      onChange={(e) => setEditingShortcut({
                        ...editingShortcut, 
                        settings: {...editingShortcut.settings, singleDate: e.target.value}
                      })}
                      className="rounded-xl"
                    />
                  )}

                  {editingShortcut.settings.joodMode === 'range' && (
                    <div className="grid grid-cols-2 gap-2">
                      <Input 
                        type="date" 
                        value={editingShortcut.settings.startDate}
                        onChange={(e) => setEditingShortcut({
                          ...editingShortcut, 
                          settings: {...editingShortcut.settings, startDate: e.target.value}
                        })}
                        className="rounded-xl"
                      />
                      <Input 
                        type="date" 
                        value={editingShortcut.settings.endDate}
                        onChange={(e) => setEditingShortcut({
                          ...editingShortcut, 
                          settings: {...editingShortcut.settings, endDate: e.target.value}
                        })}
                        className="rounded-xl"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
                <div>
                  {editingShortcut.id && (
                    <Button 
                      variant="ghost" 
                      onClick={() => {
                        deleteShortcut(editingShortcut.id);
                        setIsShortcutModalOpen(false);
                      }}
                      className="text-red-500 hover:text-red-600 hover:bg-red-50 rounded-xl gap-2"
                    >
                      <Trash2 size={16} />
                      حذف
                    </Button>
                  )}
                </div>
                <div className="flex gap-3">
                  <Button variant="ghost" onClick={() => setIsShortcutModalOpen(false)} className="rounded-xl">إلغاء</Button>
                  <Button onClick={saveShortcut} className="bg-blue-600 text-white rounded-xl px-8 hover:bg-blue-700">حفظ الاختصار</Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>



      {/* Replacement Rules Modal */}
      <AnimatePresence>
        {isRulesModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsRulesModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] md:max-h-[80vh]"
            >
              <div className="px-4 md:px-6 py-3 md:py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center text-white shrink-0">
                    <ArrowRightLeft size={18} />
                  </div>
                  <h3 className="font-black text-sm md:text-lg text-slate-800">قواعد استبدال الملاحظات</h3>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setIsRulesModalOpen(false)}
                  className="rounded-full hover:bg-slate-200 shrink-0"
                >
                  <XCircle size={20} className="text-slate-400" />
                </Button>
              </div>
              
              <div className="flex-1 overflow-hidden p-4 md:p-6">
                <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <p className="text-[10px] md:text-sm text-slate-500">إذا وجدت الكلمة في الملاحظة، سيتم استبدال الملاحظة بأكملها بالجملة الجديدة.</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setReplacementRules([...replacementRules, { find: '', replace: '' }])}
                    className="w-full sm:w-auto h-8 text-[10px] md:text-xs text-blue-600 border-blue-200"
                  >
                    <Plus size={14} className="ml-1" />
                    إضافة قاعدة
                  </Button>
                </div>
                
                <ScrollArea className="h-[300px] md:h-[400px] pr-2 md:pr-4">
                  <div className="space-y-3">
                    {replacementRules.map((rule, i) => (
                      <div key={i} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 md:gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100 relative">
                        <div className="flex-1 space-y-1">
                          <Label className="text-[9px] md:text-[10px] text-slate-400 font-bold">إذا وجدت...</Label>
                          <Input 
                            placeholder="الكلمة المفتاحية" 
                            value={rule.find} 
                            onChange={e => {
                              const newRules = [...replacementRules];
                              newRules[i].find = e.target.value;
                              setReplacementRules(newRules);
                            }} 
                            className="h-8 md:h-9 text-xs md:text-sm bg-white" 
                          />
                        </div>
                        <div className="hidden sm:flex pt-5">
                          <ArrowLeft size={16} className="text-slate-400" />
                        </div>
                        <div className="flex-1 space-y-1">
                          <Label className="text-[9px] md:text-[10px] text-slate-400 font-bold">استبدل الملاحظة بـ...</Label>
                          <Input 
                            placeholder="الجملة الكاملة" 
                            value={rule.replace} 
                            onChange={e => {
                              const newRules = [...replacementRules];
                              newRules[i].replace = e.target.value;
                              setReplacementRules(newRules);
                            }} 
                            className="h-8 md:h-9 text-xs md:text-sm bg-white" 
                          />
                        </div>
                        <div className="absolute top-2 left-2 sm:static sm:pt-5">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => setReplacementRules(replacementRules.filter((_, idx) => idx !== i))} 
                            className="h-7 w-7 md:h-9 md:w-9 text-red-400 hover:text-red-600 hover:bg-red-50"
                          >
                            <Trash2 size={14} md:size={16} />
                          </Button>
                        </div>
                      </div>
                    ))}
                    {replacementRules.length === 0 && (
                      <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-2xl text-slate-400 italic text-xs md:text-sm">
                        لا توجد قواعد استبدال نشطة حالياً
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
              
              <div className="px-4 md:px-6 py-3 md:py-4 border-t border-slate-100 bg-slate-50 flex justify-end">
                <Button onClick={() => setIsRulesModalOpen(false)} className="w-full sm:w-auto bg-slate-900 text-white rounded-xl px-8 md:px-10 h-9 md:h-10 text-xs md:text-sm">حفظ وإغلاق</Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="mt-12 border-t border-slate-200 bg-white/50 backdrop-blur-sm py-8">
        <div className="container mx-auto px-4 text-center">
          <p className="text-slate-600 text-sm font-bold">منصة مطابق © 2026</p>
          <div className="mt-4 flex items-center justify-center gap-6">
            <div className="flex items-center gap-2 text-slate-700 hover:text-blue-600 transition-colors cursor-pointer">
              <History size={16} />
              <span className="text-xs font-black">سجل العمليات</span>
            </div>
            <div className="flex items-center gap-2 text-slate-700 hover:text-blue-600 transition-colors cursor-pointer">
              <SettingsIcon size={16} />
              <span className="text-xs font-black">الإعدادات المتقدمة</span>
            </div>
          </div>
        </div>
      </footer>
      {/* Process Configuration Modal */}
      <AnimatePresence>
        {isProcessConfigModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsProcessConfigModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-2xl md:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]"
            >
              <div className="px-5 md:px-8 py-4 md:py-6 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-600 rounded-xl md:rounded-2xl flex items-center justify-center text-white shadow-lg">
                    <Activity size={20} className="md:w-6 md:h-6" />
                  </div>
                  <div>
                    <h3 className="font-black text-base md:text-xl text-slate-800">إعدادات عملية الجلب</h3>
                    <p className="text-[10px] md:text-xs text-slate-500">قم بتحديد معايير البحث والمدة قبل البدء</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setIsProcessConfigModalOpen(false)} className="rounded-full h-8 w-8 md:h-10 md:w-10">
                  <XCircle size={20} className="text-slate-400 md:w-6 md:h-6" />
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 md:p-8 space-y-6 md:space-y-8">
                {/* Source Selection */}
                <div className="space-y-3 md:space-y-4">
                  <Label className="text-xs md:text-sm font-black text-slate-800">مصدر البحث</Label>
                  <div className={cn(
                    "grid gap-3 md:gap-4",
                    (currentUser?.sourceProviderIds || []).length === 1 ? "grid-cols-1" : "grid-cols-2"
                  )}>
                    {(currentUser?.sourceProviderIds || []).map((provId) => {
                      const provider = providers.find(p => p.id === provId);
                      const providerName = provider?.name || (provId === 'jood' ? 'شركة الجود' : provId === 'shaya' ? 'شركة الشائع' : `شركة ${provId}`);
                      return (
                        <button 
                          key={provId}
                          onClick={() => setSearchSource(provId)}
                          className={cn(
                            "flex items-center justify-center gap-2 md:gap-3 p-3 md:p-4 rounded-xl md:rounded-2xl border-2 transition-all font-black text-xs md:text-sm",
                            searchSource === provId 
                              ? "border-blue-600 bg-blue-50 text-blue-700 shadow-md" 
                              : "border-slate-100 bg-white text-slate-400 hover:border-slate-200"
                          )}
                        >
                          {providerName}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Search Params */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  <div className="space-y-1.5 md:space-y-2">
                    <Label className="text-[10px] md:text-xs font-black text-slate-500 uppercase">الكلمة البحثية</Label>
                    <Input value={keyword} onChange={e => setKeyword(e.target.value)} className="rounded-xl md:rounded-2xl h-10 md:h-12 border-slate-200 text-sm" />
                  </div>
                  <div className="space-y-1.5 md:space-y-2">
                    <Label className="text-[10px] md:text-xs font-black text-slate-500 uppercase">كود الحالة</Label>
                    <select 
                      value={statusCode} 
                      onChange={e => setStatusCode(e.target.value)}
                      className="w-full h-10 md:h-12 px-3 md:px-4 rounded-xl md:rounded-2xl border border-slate-200 bg-white font-bold text-sm"
                    >
                      {STATUS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                  </div>
                </div>

                {/* Date Selection */}
                <div className="space-y-3 md:space-y-4">
                  <Label className="text-xs md:text-sm font-black text-slate-800">النطاق الزمني</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                      { id: 'today', label: 'اليوم' },
                      { id: 'auto_range', label: 'تلقائي' },
                      { id: 'single', label: 'يوم محدد' },
                      { id: 'range', label: 'نطاق' }
                    ].map(mode => (
                      <button 
                        key={mode.id} 
                        onClick={() => setJoodMode(mode.id)}
                        className={cn(
                          "py-2 md:py-3 rounded-xl text-[10px] md:text-xs font-bold transition-all border",
                          joodMode === mode.id 
                            ? "bg-blue-600 text-white border-blue-600 shadow-md" 
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                        )}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>

                  <div className="mt-2 md:mt-4">
                    {joodMode === 'auto_range' && (
                      <select 
                        value={autoRange} 
                        onChange={e => setAutoRange(e.target.value)}
                        className="w-full h-10 md:h-12 px-3 md:px-4 rounded-xl md:rounded-2xl border border-slate-200 bg-white font-bold text-sm"
                      >
                        {AUTO_RANGE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                    )}
                    {joodMode === 'single' && (
                      <Input type="date" value={singleDate} onChange={e => setSingleDate(e.target.value)} className="rounded-xl md:rounded-2xl h-10 md:h-12 text-sm" />
                    )}
                    {joodMode === 'range' && (
                      <div className="grid grid-cols-2 gap-3 md:gap-4">
                        <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="rounded-xl md:rounded-2xl h-10 md:h-12 text-sm" />
                        <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="rounded-xl md:rounded-2xl h-10 md:h-12 text-sm" />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-5 md:p-8 bg-slate-50 border-t border-slate-100 flex gap-3 md:gap-4 shrink-0">
                <Button variant="ghost" onClick={() => setIsProcessConfigModalOpen(false)} className="flex-1 h-12 md:h-14 rounded-xl md:rounded-2xl font-black text-sm md:text-base">إلغاء</Button>
                <Button 
                  onClick={() => {
                    setIsProcessConfigModalOpen(false);
                    runProcess();
                  }} 
                  className="flex-[2] h-12 md:h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-xl md:rounded-2xl font-black shadow-lg shadow-blue-100 text-sm md:text-base"
                >
                  بدء العملية الآن
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Update Info Modal */}
      <AnimatePresence>
        {isUpdateInfoModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsUpdateInfoModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[32px] shadow-2xl overflow-hidden"
            >
              <div className="p-8 space-y-6">
                <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 mb-2">
                  <Package size={32} />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <h3 className="text-2xl font-black text-slate-900">سجل التحديثات</h3>
                    <span className="px-3 py-1 bg-blue-50 text-blue-600 text-xs font-black rounded-lg border border-blue-100">
                      V أولي
                    </span>
                  </div>
                  <p className="text-slate-500 text-sm font-bold">آخر الإضافات والمميزات الجديدة للنظام</p>
                </div>

                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-4">
                    <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center text-green-600 shrink-0">
                      <Zap size={20} />
                    </div>
                    <div>
                      <h4 className="font-black text-slate-800 text-sm mb-1">تحسين سرعة الجلب</h4>
                      <p className="text-slate-500 text-xs leading-relaxed font-bold">
                        تم تطوير النظام لجلب البيانات بسرعة فائقة بنبضة واحدة، مما يقلل وقت الانتظار بشكل كبير خاصة عند جلب فترات زمنية طويلة.
                      </p>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-4">
                    <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600 shrink-0">
                      <Activity size={20} />
                    </div>
                    <div>
                      <h4 className="font-black text-slate-800 text-sm mb-1">استمرارية الدخول</h4>
                      <p className="text-slate-500 text-xs leading-relaxed font-bold">
                        النظام الآن يحفظ جلسة دخولك تلقائياً لتبدأ العمل فوراً، دون الحاجة للانتظار لإعادة تسجيل الدخول في كل عملية.
                      </p>
                    </div>
                  </div>
                </div>

                <Button 
                  onClick={() => setIsUpdateInfoModalOpen(false)}
                  className="w-full h-14 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-2xl shadow-xl shadow-slate-100 transition-all active:scale-95"
                >
                  فهمت ذلك
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
