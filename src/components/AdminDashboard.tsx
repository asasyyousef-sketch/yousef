import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Building2, 
  Plus, 
  Edit, 
  Trash2, 
  ShieldCheck, 
  KeyRound, 
  Settings, 
  X, 
  Check, 
  Save, 
  Power,
  Layers,
  Link,
  TableProperties,
  Database,
  Search,
  Globe,
  CornerDownLeft,
  Grid,
  History,
  Activity,
  ChevronDown,
  ChevronUp,
  Calendar,
  Hash,
  Filter,
  CheckCircle2,
  XCircle,
  LogOut,
  Clock,
  CreditCard,
  Download,
  FileText,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { UserConfig, ShippingProvider, Shortcut } from '../types';

interface AdminDashboardProps {
  onLogout: () => void;
  currentUser: UserConfig;
}

export default function AdminDashboard({ onLogout, currentUser }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'users' | 'providers' | 'logs' | 'subscriptions'>('users');
  const [users, setUsers] = useState<UserConfig[]>([]);
  const [providers, setProviders] = useState<ShippingProvider[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Logs Monitoring panel state
  const [logs, setLogs] = useState<any[]>([]);
  const [logsSearch, setLogsSearch] = useState('');
  const [selectedLogsUser, setSelectedLogsUser] = useState('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [selectedLogForModal, setSelectedLogForModal] = useState<any | null>(null);

  // User Modal State
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Partial<UserConfig> | null>(null);

  // Shipping Provider Modal State
  const [isProviderModalOpen, setIsProviderModalOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<Partial<ShippingProvider> | null>(null);

  // User Shortcuts Customization Modal State for owner / admin
  const [isShortcutsEditorOpen, setIsShortcutsEditorOpen] = useState(false);
  const [shortcutsEditingUser, setShortcutsEditingUser] = useState<UserConfig | null>(null);
  const [userShortcuts, setUserShortcuts] = useState<Shortcut[]>([]);
  const [editingUserShortcut, setEditingUserShortcut] = useState<Shortcut | null>(null);
  const [isShortcutSubFormOpen, setIsShortcutSubFormOpen] = useState(false);

  // Owner Interactive Analytics Display
  const [showCharts, setShowCharts] = useState(true);
  const [hoveredHour, setHoveredHour] = useState<number | null>(null);
  const [nowTime, setNowTime] = useState(Date.now());
  const [analyticsDate, setAnalyticsDate] = useState<string>('');
  const [analyticsUser, setAnalyticsUser] = useState<string>('all');

  // Subscriptions filtering states
  const [subFilterSearch, setSubFilterSearch] = useState('');
  const [subFilterStatus, setSubFilterStatus] = useState<string>('all');

  useEffect(() => {
    const interval = setInterval(() => {
      setNowTime(Date.now());
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (logs && logs.length > 0 && !analyticsDate) {
      const parsedLogs = logs.map(log => parseLogDate(log.timestamp));
      const sorted = [...parsedLogs].sort((a, b) => b.getTime() - a.getTime());
      if (sorted.length > 0) {
        setAnalyticsDate(toLocalYMD(sorted[0]));
      }
    } else if (!analyticsDate) {
      setAnalyticsDate(toLocalYMD(new Date()));
    }
  }, [logs]);

  // Parses activity log details into a structured representation for table lists and modal popups.
  const parseLogDetails = (action: string, details: string) => {
    const result = {
      short: details,
      type: 'general',
      company: '',
      dates: [] as string[],
      count: 0,
      statusCode: '',
      keyword: '',
      successCount: 0,
      failCount: 0,
      hasStructure: false,
      // Custom new fields
      parentName: '',
      parentCount: 0,
      sourceName: '',
      sourceCount: 0,
      matchedCount: 0,
      duration: '',
      selectedOptions: [] as string[],
      deliveredCount: 0,
      delayedCount: 0,
      rejectedCount: 0,
      notesCount: 0
    };

    if (!details) return result;

    try {
      const trimmed = details.trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        const parsedJson = JSON.parse(trimmed);
        if (parsedJson.type === 'fetch_and_match') {
          result.type = 'fetch_and_match';
          result.hasStructure = true;
          result.parentName = parsedJson.parentName || '';
          result.parentCount = parsedJson.parentCount || 0;
          result.statusCode = parsedJson.statusCode || '';
          result.keyword = parsedJson.keyword || '';
          result.sourceName = parsedJson.sourceName || '';
          result.sourceCount = parsedJson.sourceCount || 0;
          result.dates = parsedJson.dates || [];
          result.matchedCount = parsedJson.matchedCount || 0;
          result.duration = parsedJson.duration || '';
          result.short = `جلب ومطابقة مدمجة | الشركة الأم: ${result.parentCount}، المصدر: ${result.sourceCount}، المقارنة: ${result.matchedCount} (${result.duration} ثانية)`;
          return result;
        } else if (parsedJson.type === 'update_with_stats') {
          result.type = 'update_with_stats';
          result.hasStructure = true;
          result.selectedOptions = parsedJson.selectedOptions || [];
          result.successCount = parsedJson.successCount || 0;
          result.failCount = parsedJson.failCount || 0;
          result.deliveredCount = parsedJson.deliveredCount || 0;
          result.delayedCount = parsedJson.delayedCount || 0;
          result.rejectedCount = parsedJson.rejectedCount || 0;
          result.notesCount = parsedJson.notesCount || 0;
          result.duration = parsedJson.duration || '';
          result.short = `تحديث السيرفر | ناجح: ${result.successCount}، فاشل: ${result.failCount}، الوقت: ${result.duration} ثانية`;
          return result;
        }
      }
    } catch (e) {
      console.warn('JSON parse error in parseLogDetails fallback:', e);
    }

    try {
      if (String(action).includes('تسجيل الدخول')) {
        result.type = 'login';
        result.short = 'تم تسجيل الدخول إلى النظام بنجاح.';
        result.hasStructure = true;
      } else if (String(action).includes('تسجيل الخروج')) {
        result.type = 'logout';
        result.short = 'تم تسجيل الخروج بنجاح.';
        result.hasStructure = true;
      } else if (String(action).includes('جلب طلبات المصدر')) {
        result.type = 'fetch_source';
        result.hasStructure = true;

        const companyMatch = details.match(/شركة شحن مصدر \(([^)]+)\)/);
        const datesMatch = details.match(/للتواريخ \(([^)]+)\)/);
        const totalMatch = details.match(/الإجمالي:\s*(\d+)/);

        if (companyMatch) result.company = companyMatch[1];
        if (datesMatch) {
          result.dates = datesMatch[1].split(',').map(d => d.trim()).filter(Boolean);
        }
        if (totalMatch) result.count = parseInt(totalMatch[1], 10);

        result.short = `جلب من الشحن المصدر (${result.company || 'غير محدد'}) | الإجمالي: ${result.count || 0} شحنة`;
      } else if (String(action).includes('جلب طلبات الشركة الأم')) {
        result.type = 'fetch_parent';
        result.hasStructure = true;

        const totalMatch = details.match(/وتصفية\s*(\d+)\s*طلب/);
        const codeMatch = details.match(/الكود للمطابقة:\s*([^،\)]+)/);
        const keywordMatch = details.match(/الكلمة:\s*([^)]+)/);

        if (totalMatch) result.count = parseInt(totalMatch[1], 10);
        if (codeMatch) result.statusCode = codeMatch[1].trim();
        if (keywordMatch) result.keyword = keywordMatch[1].trim();

        result.short = `استخراج وتصفية ${result.count || 0} طلب من الشركة الأم (حالة: ${result.statusCode || 'الكل'})`;
      } else if (String(action).includes('مزامنة وتحديث الحالات')) {
        result.type = 'sync';
        result.hasStructure = true;

        const successMatch = details.match(/العمليات الناجحة:\s*(\d+)/);
        const failMatch = details.match(/غير الناجحة:\s*(\d+)/);

        if (successMatch) result.successCount = parseInt(successMatch[1], 10);
        if (failMatch) result.failCount = parseInt(failMatch[1], 10);

        result.short = `تفريغ ومزامنة الحالة: نجاح (${result.successCount || 0})، فشل (${result.failCount || 0})`;
      }
    } catch (err) {
      console.warn('Error parsing log details', err);
    }

    return result;
  };

  // Safe Date parsing for Firestore/ISO dates
  const parseLogDate = (timestamp: any): Date => {
    if (!timestamp) return new Date();
    if (typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    }
    return new Date(timestamp);
  };

  // Helper to convert Date to local YYYY-MM-DD string
  const toLocalYMD = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Determines real-time session duration and active status for a specific user
  const getUserActiveSession = (username: string) => {
    const user = users.find(u => u.username === username);
    if (!user || !user.presence) {
      return { isActive: false, durationStr: '0 دقيقة', visits: 0, label: 'غير متصل' };
    }

    const presence = user.presence;
    const targetDateStr = analyticsDate || toLocalYMD(new Date());

    const isTargetDate = presence.todayDate === targetDateStr;
    const lastActiveMs = presence.lastActiveAt ? new Date(presence.lastActiveAt).getTime() : 0;
    const msSinceActive = nowTime - lastActiveMs;
    
    // Active if last active ping was in the last 45 seconds (ping runs every 15s)
    const isActive = isTargetDate && msSinceActive < 45000;

    const totalSeconds = isTargetDate ? (presence.todaySeconds || 0) : 0;
    const visits = isTargetDate ? (presence.todayVisits || 1) : 0;

    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;

    let durationStr = '';
    if (mins >= 60) {
      const h = Math.floor(mins / 60);
      const remMins = mins % 60;
      durationStr = `${h} س و ${remMins} د`;
    } else if (mins > 0) {
      durationStr = `${mins} د و ${secs} ث`;
    } else {
      durationStr = `${secs} ثانية`;
    }

    return {
      isActive,
      durationStr,
      visits,
      label: isActive ? 'نشط الآن' : 'خارج الجلسة'
    };
  };

  // Formulates stats for the dashboard
  const getTodayStats = () => {
    if (!logs || logs.length === 0) {
      return {
        userDurations: {} as { [key: string]: number },
        userLogins: {} as { [key: string]: number },
        userFetches: {} as { [key: string]: number },
        userUpdates: {} as { [key: string]: number },
        hourlyUpdates: Array(24).fill(0) as number[],
        hourlyFetches: Array(24).fill(0) as number[],
        totalDelivered: 0,
        totalDelayed: 0,
        totalRejected: 0,
        totalNotes: 0,
        targetDateLogsCount: 0,
        displayDateLabel: 'لا يوجد حركات مسجلة',
        isFallbackToMatches: false
      };
    }

    const parsedLogs = logs.map(log => {
      return { ...log, parsedDate: parseLogDate(log.timestamp) };
    });

    let targetDateLogs = parsedLogs;
    let targetDate = new Date();
    let isFallbackToMatches = false;

    if (analyticsDate) {
      targetDateLogs = parsedLogs.filter(log => toLocalYMD(log.parsedDate) === analyticsDate);
      targetDate = new Date(analyticsDate);
    } else {
      const now = new Date();
      const todayYMD = toLocalYMD(now);
      const hasLogsToday = parsedLogs.some(log => toLocalYMD(log.parsedDate) === todayYMD);
      if (hasLogsToday) {
        targetDateLogs = parsedLogs.filter(log => toLocalYMD(log.parsedDate) === todayYMD);
        targetDate = now;
      } else {
        const sortedByDate = [...parsedLogs].sort((a, b) => b.parsedDate.getTime() - a.parsedDate.getTime());
        if (sortedByDate.length > 0) {
          targetDate = sortedByDate[0].parsedDate;
          targetDateLogs = parsedLogs.filter(log => toLocalYMD(log.parsedDate) === toLocalYMD(targetDate));
          isFallbackToMatches = true;
        }
      }
    }

    const targetDateLogsCount = targetDateLogs.length;

    // Filter by selected user if not 'all'
    const targetDateLogsFiltered = analyticsUser === 'all'
      ? targetDateLogs
      : targetDateLogs.filter(log => log.username === analyticsUser);

    const userDurations: { [username: string]: number } = {};
    const userLogins: { [username: string]: number } = {};
    const userFetches: { [username: string]: number } = {};
    const userUpdates: { [username: string]: number } = {};

    const logsByUser: { [username: string]: any[] } = {};
    targetDateLogsFiltered.forEach(log => {
      const u = log.username || 'مجهول';
      if (!logsByUser[u]) logsByUser[u] = [];
      logsByUser[u].push(log);
    });

    Object.entries(logsByUser).forEach(([user, uLogs]) => {
      const sorted = [...uLogs].sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime());

      let totalStayMs = 0;
      let currentSessionStart = sorted[0].parsedDate.getTime();
      let lastLogTime = currentSessionStart;

      sorted.forEach((log) => {
        const time = log.parsedDate.getTime();
        const actionStr = String(log.action || '');

        if (actionStr.includes('تسجيل الدخول')) {
          userLogins[user] = (userLogins[user] || 0) + 1;
        }
        if (actionStr.includes('جلب ومطابقة') || actionStr.includes('جلب طلبات') || actionStr.includes('متكاملة')) {
          userFetches[user] = (userFetches[user] || 0) + 1;
        }
        if (actionStr.includes('تحديث') || actionStr.includes('مزامنة') || actionStr.includes('السيرفر')) {
          userUpdates[user] = (userUpdates[user] || 0) + 1;
        }

        const gapMs = time - lastLogTime;
        if (gapMs > 20 * 60 * 1000) {
          totalStayMs += (lastLogTime - currentSessionStart);
          currentSessionStart = time;
        }
        lastLogTime = time;
      });

      totalStayMs += (lastLogTime - currentSessionStart);
      let finalMins = Math.round(totalStayMs / 60000);
      if (totalStayMs > 0 && finalMins === 0) {
        finalMins = 1;
      }
      userDurations[user] = finalMins || 1;
    });

    const hourlyUpdates = Array(24).fill(0);
    const hourlyFetches = Array(24).fill(0);

    targetDateLogsFiltered.forEach(log => {
      const hour = log.parsedDate.getHours();
      const actionStr = String(log.action || '');

      if (actionStr.includes('تحديثومزامنة') || actionStr.includes('تحديث حالات') || actionStr.includes('تحديث الحالات') || actionStr.includes('تحديث السيرفر')) {
        hourlyUpdates[hour]++;
      } else if (actionStr.includes('تحديث') || actionStr.includes('مزامنة')) {
        hourlyUpdates[hour]++;
      }

      if (actionStr.includes('جلب') || actionStr.includes('مطابقة') || actionStr.includes('متكاملة')) {
        hourlyFetches[hour]++;
      }
    });

    let totalDelivered = 0;
    let totalDelayed = 0;
    let totalRejected = 0;
    let totalNotes = 0;

    targetDateLogsFiltered.forEach(log => {
      if (log.details) {
        try {
          const trimmed = log.details.trim();
          if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
            const parsedJson = JSON.parse(trimmed);
            if (parsedJson.type === 'update_with_stats') {
              totalDelivered += parsedJson.deliveredCount || 0;
              totalDelayed += parsedJson.delayedCount || 0;
              totalRejected += parsedJson.rejectedCount || 0;
              totalNotes += parsedJson.notesCount || 0;
            }
          }
        } catch {}
      }
    });

    let displayDateLabel = '';
    try {
      displayDateLabel = targetDate.toLocaleDateString('ar-EG', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    } catch {
      displayDateLabel = analyticsDate || targetDate.toDateString();
    }

    return {
      userDurations,
      userLogins,
      userFetches,
      userUpdates,
      hourlyUpdates,
      hourlyFetches,
      totalDelivered,
      totalDelayed,
      totalRejected,
      totalNotes,
      targetDateLogsCount: targetDateLogsFiltered.length,
      displayDateLabel,
      isFallbackToMatches
    };
  };

  // Initial Data Fetching
  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      const [usersRes, providersRes, logsRes] = await Promise.all([
        axios.get('/api/admin/users'),
        axios.get('/api/admin/providers'),
        axios.get('/api/admin/logs').catch(() => ({ data: { logs: [] } }))
      ]);
      setUsers(usersRes.data.users || []);
      setProviders(providersRes.data.providers || []);
      setLogs(logsRes?.data?.logs || []);
    } catch (error: any) {
      console.error('Failed to load admin panel data:', error);
      toast.error('حدث عطل أثناء جلب البيانات من الخادم، يرجى إعادة المحاولة.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Periodic background refresh for live presence ticks - Ultra-Reactive 1-Second Polling
  useEffect(() => {
    const refreshInterval = setInterval(async () => {
      // Pause polling entirely when the tab/window is in the background
      if (document.visibilityState !== 'visible') return;

      try {
        // Run clean parallel polling to zero-read memory endpoints every second
        const [usersRes, providersRes, logsRes] = await Promise.all([
          axios.get('/api/admin/users'),
          axios.get('/api/admin/providers'),
          axios.get('/api/admin/logs').catch(() => ({ data: { logs: [] } }))
        ]);
        setUsers(usersRes.data.users || []);
        setProviders(providersRes.data.providers || []);
        setLogs(logsRes?.data?.logs || []);
      } catch (e) {
        console.warn('Memory-first ultra-reactive dashboard polling failed:', e);
      }
    }, 1000); // 1-second ultra-reactive refresh

    return () => clearInterval(refreshInterval);
  }, []);

  // Monthly statistics compiler for user
  const getUserMonthlyStats = (targetUsername: string) => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-11
    
    let fetchCount = 0;
    let updateCount = 0;
    let totalRecordsScraped = 0;
    let totalRecordsUpdated = 0;

    logs.forEach(l => {
      if (l.username === targetUsername) {
        const logDate = new Date(l.timestamp);
        if (logDate.getFullYear() === currentYear && logDate.getMonth() === currentMonth) {
          if (l.action === 'عملية جلب ومطابقة متكاملة') {
            fetchCount++;
            try {
              const details = JSON.parse(l.details);
              if (details && typeof details.matchedCount === 'number') {
                totalRecordsScraped += details.matchedCount;
              }
            } catch(e) {}
          } else if (l.action === 'تحديث ومزامنة حالات السيرفر') {
            updateCount++;
            try {
              const details = JSON.parse(l.details);
              if (details) {
                if (typeof details.successCount === 'number') {
                  totalRecordsUpdated += details.successCount;
                } else if (typeof details.failCount === 'number') {
                  totalRecordsUpdated += details.failCount; // Fallback or add
                } else if (typeof details.deliveredCount === 'object') {
                  // Fallback counts inside object
                  const del = Object.values(details.deliveredCount).reduce((a: any, b: any) => a + b, 0);
                  const delay = Object.values(details.delayedCount || {}).reduce((a: any, b: any) => a + b, 0);
                  const rej = Object.values(details.rejectedCount || {}).reduce((a: any, b: any) => a + b, 0);
                  totalRecordsUpdated += Number(del) + Number(delay) + Number(rej);
                }
              }
            } catch(e) {}
          }
        }
      }
    });

    return {
      fetchCount,
      updateCount,
      totalRecordsScraped,
      totalRecordsUpdated
    };
  };

  // Helper printer mechanism
  const printHtml = (htmlContent: string) => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);
    
    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(htmlContent);
      doc.close();
      
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1500);
      }, 500);
    }
  };

  // PRINT: Single Receipt (وصل اشتراك رسمي)
  const handlePrintReceipt = (user: UserConfig) => {
    const sub = user.subscription;
    if (!sub) {
      toast.error('هذا الحساب لا يملك اشتراكاً مدوناً في الوقت الحالي.');
      return;
    }

    const stats = getUserMonthlyStats(user.username);
    const todayStr = new Date().toISOString().split('T')[0];
    const receiptSerial = `REC-${todayStr.replace(/-/g, '')}-${user.uid.slice(-4).toUpperCase()}`;

    const arabicStatus = {
      active: 'نشط ومفعّل (Premium)',
      trial: 'فترة تجريبية (Trial)',
      expired: 'منتهي الصلاحية (Expired)',
      canceled: 'ملغي أو مجمّد (Canceled)'
    }[sub.status || 'active'];

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>وصل اشتراك رسمي - ${user.username}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap');
          body {
            font-family: 'Cairo', sans-serif;
            margin: 0;
            padding: 40px;
            color: #1e293b;
            background-color: #ffffff;
            direction: rtl;
          }
          .invoice-box {
            max-width: 800px;
            margin: auto;
            border: 1px solid #e2e8f0;
            border-radius: 20px;
            padding: 40px;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);
            background: #fff;
            position: relative;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #3b82f6;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .logo {
            font-size: 24px;
            font-weight: 900;
            color: #1e3a8a;
          }
          .logo span {
            color: #3b82f6;
          }
          .title {
            text-align: left;
          }
          .title h1 {
            margin: 0;
            font-size: 20px;
            font-weight: 900;
            color: #1e293b;
          }
          .title p {
            margin: 5px 0 0 0;
            font-size: 11px;
            color: #64748b;
            font-weight: bold;
          }
          .info-grid {
            display: grid;
            grid-template-cols: 1fr 1fr;
            gap: 20px;
            margin-bottom: 30px;
          }
          .info-card {
            background-color: #f8fafc;
            border: 1px solid #f1f5f9;
            border-radius: 12px;
            padding: 15px 20px;
          }
          .info-card h3 {
            margin: 0 0 10px 0;
            font-size: 13px;
            color: #334155;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 5px;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            margin-bottom: 6px;
          }
          .info-row span:first-child {
            color: #64748b;
            font-weight: bold;
          }
          .info-row span:last-child {
            color: #0f172a;
            font-weight: 900;
          }
          .stats-card {
            background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
            border: 1px solid #bfdbfe;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 30px;
          }
          .stats-card h3 {
            margin: 0 0 15px 0;
            font-size: 14px;
            color: #1e40af;
            font-weight: 950;
            display: flex;
            align-items: center;
            gap: 6px;
          }
          .stats-grid {
            display: grid;
            grid-template-cols: 1fr 1fr;
            gap: 15px;
          }
          .stat-box {
            background: #ffffff;
            border: 1px solid #e2e8f0;
            padding: 10px 15px;
            border-radius: 8px;
            text-align: center;
          }
          .stat-box .num {
            font-size: 20px;
            font-weight: 900;
            color: #2563eb;
            margin-bottom: 2px;
          }
          .stat-box .lbl {
            font-size: 10px;
            color: #64748b;
            font-weight: 700;
          }
          .price-block {
            border: 2px dashed #e2e8f0;
            border-radius: 12px;
            padding: 15px 20px;
            background: #fafafa;
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 30px;
          }
          .price-title {
            font-size: 14px;
            font-weight: bold;
            color: #334155;
          }
          .price-value {
            font-size: 20px;
            font-weight: 900;
            color: #059669;
          }
          .notes-block {
            font-size: 11px;
            color: #64748b;
            background-color: #fcfcfc;
            border-left: 3px solid #64748b;
            padding: 10px 15px;
            border-radius: 4px;
            margin-bottom: 30px;
            font-weight: bold;
          }
          .signatures {
            display: flex;
            justify-content: space-between;
            margin-top: 50px;
            border-t: 1px italic #ddd;
            padding-top: 20px;
          }
          .sig-box {
            text-align: center;
            font-size: 11px;
            color: #475569;
            width: 150px;
          }
          .sig-box .line {
            border-bottom: 1px solid #94a3b8;
            margin-bottom: 8px;
            height: 30px;
          }
          @media print {
            body { padding: 0; background: none; }
            .invoice-box { border: none; box-shadow: none; padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="invoice-box">
          <div class="header">
            <div class="logo">
              المنصة<span>الذكية</span>
            </div>
            <div class="title">
              <h1>وصل تفعيل اشتراك الحساب</h1>
              <p>رقم السيريال: ${receiptSerial}</p>
            </div>
          </div>

          <div class="info-grid">
            <div class="info-card">
              <h3>معلومات العميل</h3>
              <div class="info-row">
                <span>اسم المحدِّث:</span>
                <span>${user.username}</span>
              </div>
              <div class="info-row">
                <span>الصلاحية بالمنصة:</span>
                <span>${user.role === 'admin' ? 'مدير منصة رئيسي' : 'محدِّث بيانات'}</span>
              </div>
              <div class="info-row">
                <span>رقم الحساب الفريد:</span>
                <span style="font-family: monospace; font-size: 11px;">${user.uid}</span>
              </div>
            </div>

            <div class="info-card">
              <h3>صلاحية وتواريخ الاشتراك</h3>
              <div class="info-row">
                <span>تاريخ الاشتراك:</span>
                <span>${sub.subscribedAt || todayStr}</span>
              </div>
              <div class="info-row">
                <span>تاريخ انتهاء الفتح:</span>
                <span style="color: #ef4444;">${sub.expiresAt}</span>
              </div>
              <div class="info-row">
                <span>حالة تذكرة الحساب:</span>
                <span>${arabicStatus}</span>
              </div>
            </div>
          </div>

          <div class="stats-card">
            <h3>📊 إنتاجية ونشاط المحدّث لهذا الشهر الحالي</h3>
            <div class="stats-grid">
              <div class="stat-box">
                <div class="num">${stats.fetchCount}</div>
                <div class="lbl">عمليات الجلب والمطابقة الكلية</div>
              </div>
              <div class="stat-box">
                <div class="num">${Number(stats.totalRecordsScraped).toLocaleString()}</div>
                <div class="lbl">إجمالي طلبات المصادر المجلوية</div>
              </div>
              <div class="stat-box">
                <div class="num">${stats.updateCount}</div>
                <div class="lbl">عمليات التحديث الفعلي للسيرفر</div>
              </div>
              <div class="stat-box">
                <div class="num">${Number(stats.totalRecordsUpdated).toLocaleString()}</div>
                <div class="lbl">إجمالي الحالات المزامنة مع السيرفر</div>
              </div>
            </div>
          </div>

          <div class="price-block">
            <span class="price-title">المبلغ الكلي المدفوع للاشتراك:</span>
            <span class="price-value">${Number(sub.pricePaid || 0).toLocaleString()} د.ع</span>
          </div>

          ${sub.notes ? `
            <div class="notes-block">
              📌 <strong>ملاحظة وتوجيه الإدارة:</strong> ${sub.notes}
            </div>
          ` : ''}

          <div class="signatures">
            <div class="sig-box">
              <div class="line"></div>
              <span>توقيع الملاك والمسؤول</span>
            </div>
            <div class="sig-box">
              <div class="line"></div>
              <span>ختم المنصة الذكية</span>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    printHtml(html);
    toast.success(`تم إعداد وإرسال الوصل للطباعة بنجاح للمستخدم: ${user.username}`);
  };

  // PRINT: Complete Subscriptions List Report (تقرير كشف عام)
  const handlePrintFullSubscriptionsReport = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const subUsers = users.filter(u => u.role !== 'admin');

    const tableRows = subUsers.map((u, index) => {
      const sub = u.subscription;
      const stats = getUserMonthlyStats(u.username);
      
      const subAt = sub?.subscribedAt || 'غير مدون';
      const expAt = sub?.expiresAt || 'غير فَعّال';
      const price = sub?.pricePaid ? `${Number(sub.pricePaid).toLocaleString()} د.ع` : 'مفتوح / دائم';
      
      let statusLabel = 'نشط';
      if (sub?.status === 'trial') statusLabel = 'تجريبي';
      else if (sub?.status === 'expired' || (sub?.expiresAt && sub.expiresAt < todayStr)) statusLabel = 'منتهي';
      else if (sub?.status === 'canceled') statusLabel = 'ملغي';

      return `
        <tr>
          <td>${index + 1}</td>
          <td><strong>${u.username}</strong></td>
          <td><span class="status-badge status-${sub?.status || 'active'}">${statusLabel}</span></td>
          <td>${subAt}</td>
          <td>${expAt}</td>
          <td><strong>${price}</strong></td>
          <td>${stats.fetchCount} جلب (${stats.totalRecordsScraped} طلب)</td>
          <td>${stats.updateCount} تحديث (${stats.totalRecordsUpdated} طلب)</td>
        </tr>
      `;
    }).join('');

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>كشف كلي باشتراكات المحدّثين - ${todayStr}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap');
          body {
            font-family: 'Cairo', sans-serif;
            margin: 0;
            padding: 30px;
            color: #1e293b;
            background-color: #ffffff;
            direction: rtl;
          }
          .title-area {
            text-align: center;
            border-bottom: 3px double #cbd5e1;
            padding-bottom: 15px;
            margin-bottom: 25px;
          }
          .title-area h1 {
            margin: 0;
            font-size: 18px;
            font-weight: 900;
            color: #0f172a;
          }
          .title-area p {
            margin: 5px 0 0 0;
            font-size: 11px;
            color: #64748b;
            font-weight: bold;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
            margin-bottom: 20px;
          }
          th, td {
            border: 1px solid #cbd5e1;
            padding: 10px;
            text-align: right;
          }
          th {
            background-color: #f1f5f9;
            color: #020617;
            font-weight: bold;
          }
          tr:nth-child(even) {
            background-color: #f8fafc;
          }
          .status-badge {
            font-size: 9px;
            font-weight: bold;
            padding: 2px 6px;
            border-radius: 4px;
          }
          .status-active { background-color: #dcfce7; color: #15803d; }
          .status-trial { background-color: #fef3c7; color: #d97706; }
          .status-expired { background-color: #fee2e2; color: #b91c1c; }
          .status-canceled { background-color: #f1f5f9; color: #475569; }
          .summary {
            font-size: 11px;
            font-weight: bold;
            margin-top: 30px;
            text-align: left;
            color: #475569;
          }
        </style>
      </head>
      <body>
        <div class="title-area">
          <h1>كشف الفتح والاشتراكات لجميع حسابات المحدِّثين في المنصة</h1>
          <p>تاريخ استصدار الكشف: ${new Date().toLocaleString('ar-IQ')} | إجمالي المحدِّثين: ${subUsers.length}</p>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 4%;">#</th>
              <th>اسم حساب المحدِّث</th>
              <th>حالة الاشتراك</th>
              <th>تاريخ التفعيل</th>
              <th>تاريخ الانتهاء</th>
              <th>المبلغ المدفوع</th>
              <th>معدل الجلب الفردي (هذا الشهر)</th>
              <th>معدل التحديث والرفع (هذا الشهر)</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>

        <div class="summary">
          كشف تلقائي مستخرج من قاعدة البيانات الذكية. الإدارة العليا.
        </div>
      </body>
      </html>
    `;

    printHtml(html);
    toast.success('تم إعداد الكشف والتقرير الشامل، جاري إرسال الطلب للطابعة.');
  };

  // DELETE User Handler
  const handleDeleteUser = async (uid: string, username: string) => {
    if (uid === currentUser.uid || uid === 'admin') {
      toast.error('لا يمكن حذف حساب المسؤول الرئيسي الجاري استخدامه');
      return;
    }
    
    if (!window.confirm(`هل أنت متأكد تماماً من حذف حساب المحدث [${username}]؟`)) {
      return;
    }

    try {
      await axios.delete(`/api/admin/users/${uid}`);
      toast.success(`تم حذف حساب المحدّث (${username}) بنجاح.`);
      setUsers(prev => prev.filter(u => u.uid !== uid));
    } catch (e: any) {
      toast.error(`فشل حذف المستخدم: ${e.response?.data?.error || e.message}`);
    }
  };

  // OPEN Edit/Create User Modal
  const handleOpenUserModal = (user?: UserConfig) => {
    const todayStr = new Date().toISOString().split('T')[0];
    if (user) {
      setEditingUser({ 
        ...user,
        subscription: user.subscription ? {
          status: user.subscription.status || 'active',
          expiresAt: user.subscription.expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          subscribedAt: user.subscription.subscribedAt || todayStr,
          pricePaid: user.subscription.pricePaid || 0,
          trialDays: user.subscription.trialDays || 0,
          notes: user.subscription.notes || ''
        } : {
          status: 'active',
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          subscribedAt: todayStr,
          pricePaid: 0,
          trialDays: 0,
          notes: ''
        }
      });
    } else {
      setEditingUser({
        uid: `usr_${Date.now()}`,
        username: '',
        password: '',
        role: 'mudhaddith',
        parentProviderId: 'hawk',
        sourceProviderIds: ['jood'],
        parentCredentials: { username: '', password: '' },
        sourceCredentials: {
          jood: { username: '', password: '' },
          shaya: { username: '', password: '' }
        },
        shortcuts: [],
        subscription: {
          status: 'active',
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          subscribedAt: todayStr,
          pricePaid: 0,
          trialDays: 0,
          notes: ''
        }
      });
    }
    setIsUserModalOpen(true);
  };

  // SAVE/UPDATE User
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    const u = editingUser as UserConfig;
    if (!u.username.trim() || !u.password.trim() || !u.parentProviderId) {
      toast.error('يرجى ملء جميع البيانات الأساسية للمحدّث (اسم الدخول، كلمة المرور والشركة الأم)');
      return;
    }

    try {
      const response = await axios.post('/api/admin/users', u);
      toast.success(response.data.message || 'تم تحديث حساب المحدث بنجاح في المنصة.');
      setIsUserModalOpen(false);
      setEditingUser(null);
      fetchAllData();
    } catch (error: any) {
      toast.error(`فشل في حفظ بيانات المحدّث: ${error.response?.data?.error || error.message}`);
    }
  };

  // Shortcuts management functions for Owner controls on each user
  const handleOpenShortcutsEditor = (u: UserConfig) => {
    setShortcutsEditingUser(u);
    setUserShortcuts(u.shortcuts || []);
    setEditingUserShortcut(null);
    setIsShortcutSubFormOpen(false);
    setIsShortcutsEditorOpen(true);
  };

  const handleLoadDefaultShortcuts = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const defaultTemplates: Shortcut[] = [
      {
        id: 'default-1-' + Date.now(),
        name: 'تحديث قيود الجود',
        color: 'blue',
        settings: {
          keyword: 'جود',
          statusCode: '10',
          joodMode: 'auto_range',
          autoRange: '3',
          singleDate: todayStr,
          startDate: todayStr,
          endDate: todayStr,
          searchSource: 'jood'
        }
      },
      {
        id: 'default-2-' + Date.now(),
        name: 'تحديث قيود الشائع',
        color: 'rose',
        settings: {
          keyword: 'شايع',
          statusCode: '10',
          joodMode: 'auto_range',
          autoRange: '3',
          singleDate: todayStr,
          startDate: todayStr,
          endDate: todayStr,
          searchSource: 'shaya'
        }
      },
      {
        id: 'default-3-' + Date.now(),
        name: 'تحديث مؤجلات الجود',
        color: 'amber',
        settings: {
          keyword: 'جود',
          statusCode: '3',
          joodMode: 'auto_range',
          autoRange: '7',
          singleDate: todayStr,
          startDate: todayStr,
          endDate: todayStr,
          searchSource: 'jood'
        }
      },
      {
        id: 'default-4-' + Date.now(),
        name: 'تحديث مؤجلات الشائع',
        color: 'indigo',
        settings: {
          keyword: 'شايع',
          statusCode: '3',
          joodMode: 'auto_range',
          autoRange: '7',
          singleDate: todayStr,
          startDate: todayStr,
          endDate: todayStr,
          searchSource: 'shaya'
        }
      }
    ];
    setUserShortcuts(defaultTemplates);
    toast.success('تم تحميل نماذج الاختصارات الافتراضية بنجاح.');
  };

  const handleOpenShortcutSubForm = (shortcut?: Shortcut) => {
    const todayStr = new Date().toISOString().split('T')[0];
    if (shortcut) {
      setEditingUserShortcut({ ...shortcut, settings: { ...shortcut.settings } });
    } else {
      setEditingUserShortcut({
        id: '',
        name: '',
        color: 'blue',
        settings: {
          keyword: '',
          statusCode: '10',
          joodMode: 'auto_range',
          autoRange: '3',
          singleDate: todayStr,
          startDate: todayStr,
          endDate: todayStr,
          searchSource: shortcutsEditingUser?.sourceProviderIds?.[0] || 'jood'
        }
      });
    }
    setIsShortcutSubFormOpen(true);
  };

  const handleSaveUserShortcut = () => {
    if (!editingUserShortcut || !editingUserShortcut.name.trim()) {
      toast.error('يرجى إدخال اسم الاختصار');
      return;
    }

    if (editingUserShortcut.id) {
      setUserShortcuts(prev => prev.map(s => s.id === editingUserShortcut.id ? editingUserShortcut : s));
      toast.success('تم تحديث الاختصار مؤقتاً.');
    } else {
      const newS = { ...editingUserShortcut, id: 'shortcut-' + Date.now() };
      setUserShortcuts(prev => [...prev, newS]);
      toast.success('تم إضافة الاختصار مؤقتاً.');
    }
    setIsShortcutSubFormOpen(false);
    setEditingUserShortcut(null);
  };

  const handleDeleteUserShortcut = (id: string) => {
    setUserShortcuts(prev => prev.filter(s => s.id !== id));
    toast.success('تم إزالة الاختصار.');
  };

  const handleSaveAllUserShortcuts = async () => {
    if (!shortcutsEditingUser) return;
    try {
      const updatedUser = {
        ...shortcutsEditingUser,
        shortcuts: userShortcuts
      };
      const response = await axios.post('/api/admin/users', updatedUser);
      toast.success('تم الاحتفاظ بالاختصارات وتحديث ملف المحدث بالخادم وقاعدة البيانات بنجاح.');
      setIsShortcutsEditorOpen(false);
      setShortcutsEditingUser(null);
      fetchAllData();
    } catch (err: any) {
      toast.error('فشل في حفظ الاختصارات على الخادم: ' + (err.response?.data?.error || err.message));
    }
  };

  // OPEN Edit/Create Shipping Provider Template
  const handleOpenProviderModal = (provider?: ShippingProvider) => {
    if (provider) {
      setEditingProvider({ ...provider });
    } else {
      setEditingProvider({
        id: '',
        name: '',
        type: 'source',
        loginUrl: '',
        searchUrl: '',
        loginCheck: 'logout',
        rowSelector: 'tr[id]',
        checkboxSelector: 'input[type="checkbox"][name="id[]"]',
        idWaslIndex: 1,
        sequenceIndex: 0,
        columns: [
          'Actions', 'Sequence', 'idWasl_Value', 'Client Name', 'Representative Name', 'Governorate',
          'Area', 'Customer Phone', 'Total Amount', 'Delivery Fee', 'Net Amount',
          'Customer Name', 'Order ID', 'Client Phone', 'Status', 'Status Type',
          'Download', 'Cargo Type', 'Pieces Count', 'Notes', 'Date Added'
        ]
      });
    }
    setIsProviderModalOpen(true);
  };

  // SAVE/UPDATE Provider
  const handleSaveProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProvider) return;

    const prov = editingProvider as ShippingProvider;
    if (!prov.id.trim() || !prov.name.trim() || !prov.loginUrl.trim() || !prov.searchUrl.trim() || !prov.loginCheck.trim()) {
      toast.error('يرجى ملء كافة حقول قالب شركة الشحن بنجاح (المعرف، الاسم، الروابط الفنية ومفتاح تسجيل الخروج)');
      return;
    }

    try {
      const response = await axios.post('/api/admin/providers', prov);
      toast.success(response.data.message || 'تم تحديث قالب شركة الشحن بنجاح في النظام.');
      setIsProviderModalOpen(false);
      setEditingProvider(null);
      fetchAllData();
    } catch (error: any) {
      toast.error(`فشل حفظ قالب شركة الشحن: ${error.response?.data?.error || error.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 relative pb-16 font-sans dir-rtl" style={{ direction: 'rtl' }}>
      {/* Admin Header */}
      <header className="bg-slate-900 text-white shadow-xl relative overflow-hidden shrink-0">
        <div className="absolute top-0 right-1/4 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="container mx-auto px-4 py-6 relative z-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
                <Settings size={28} className="animate-spin-slow" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-black tracking-tight flex items-center gap-2">
                  <span>لوحة تحكم منصة الأتمتة والربط المالي</span>
                  <Badge className="bg-blue-600 text-white hover:bg-blue-600 text-[10px] font-black mr-2">مسؤول الإدارة</Badge>
                </h1>
                <p className="text-slate-400 text-xs font-bold mt-1">المطور: {currentUser.username} | إدارة شفرات جلب البيانات والمحدثين</p>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto justify-end">
              <Button 
                variant="ghost" 
                onClick={onLogout}
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10 font-bold text-sm gap-2 h-11 px-5 rounded-xl border border-red-500/20"
              >
                <Power size={16} />
                تسجيل الخروج
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Admin Navigation Controls */}
      <div className="container mx-auto px-4 mt-8">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-6">
          <div className="flex flex-wrap bg-slate-100 p-1.5 rounded-2xl border border-slate-200 w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('users')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black transition-all ${
                activeTab === 'users' 
                  ? 'bg-white text-blue-600 shadow-md' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users size={16} />
              شؤون المحدِّثين ({users.length})
            </button>
            <button
              onClick={() => setActiveTab('providers')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black transition-all ${
                activeTab === 'providers' 
                  ? 'bg-white text-blue-600 shadow-md' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 size={16} />
              قوالب شركات الشحن ({providers.length})
            </button>
            <button
              onClick={() => setActiveTab('subscriptions')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black transition-all ${
                activeTab === 'subscriptions' 
                  ? 'bg-white text-blue-600 shadow-md' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CreditCard size={16} />
              صندوق الاشتراكات ({users.filter(u => u.role !== 'admin').length})
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black transition-all ${
                activeTab === 'logs' 
                  ? 'bg-white text-blue-600 shadow-md' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <History size={16} />
              سجل حركات المحدّثين ({logs.length})
            </button>
          </div>

          <div>
            {activeTab === 'users' && (
              <Button 
                onClick={() => handleOpenUserModal()} 
                className="w-full sm:w-auto h-11 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl shadow-lg shadow-blue-500/10 gap-2 px-6"
              >
                <Plus size={18} />
                إضافة محدِّث جديد
              </Button>
            )}
            {activeTab === 'providers' && (
              <Button 
                onClick={() => handleOpenProviderModal()} 
                className="w-full sm:w-auto h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl shadow-lg shadow-emerald-500/10 gap-2 px-6"
              >
                <Plus size={18} />
                إضافة قالب شركة
              </Button>
            )}
            {activeTab === 'subscriptions' && (
              <Button 
                onClick={() => handlePrintFullSubscriptionsReport()} 
                className="w-full sm:w-auto h-11 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl shadow-lg shadow-rose-500/10 gap-2 px-6"
              >
                <Download size={18} />
                تصدير كشف الاشتراكات (PDF)
              </Button>
            )}
            {activeTab === 'logs' && (
              <Button 
                onClick={() => fetchAllData()} 
                className="w-full sm:w-auto h-11 bg-slate-800 hover:bg-slate-700 text-white font-black rounded-xl shadow-lg gap-2 px-6"
              >
                <Activity size={18} />
                تحديث السجل فوراً
              </Button>
            )}
          </div>
        </div>

        {/* Tab Items Rendered */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-32 bg-white rounded-3xl border border-slate-200/60 shadow-xl gap-4">
            <span className="w-10 h-10 rounded-full border-4 border-slate-100 border-t-blue-600 animate-spin" />
            <span className="text-slate-500 font-bold text-sm">جاري جلب إعدادات المنصة وقاعدة البيانات...</span>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {activeTab === 'users' && (
              <motion.div
                key="users-tab"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6"
              >
                <Card className="rounded-3xl border-none shadow-xl bg-white overflow-hidden">
                  <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                    <CardTitle className="text-lg font-black text-slate-800 flex items-center gap-2">
                      <Users className="text-blue-600" size={20} />
                      قائمة المحدِّثين وحسابات شركات الشحن المفعلة
                    </CardTitle>
                    <CardDescription className="text-slate-400 font-bold text-xs mt-1">
                      يدير هذا المعيار حساب الدخول الخاص بكل محدّث والشركات والبيانات المحددة له لتشغيل Scraping
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader className="bg-slate-50/30">
                          <TableRow>
                            <TableHead className="text-right font-black text-xs text-slate-700 py-4 pr-6">المحدِّث</TableHead>
                            <TableHead className="text-right font-black text-xs text-slate-700">كلمة المرور</TableHead>
                            <TableHead className="text-right font-black text-xs text-slate-700">الصلاحية</TableHead>
                            <TableHead className="text-right font-black text-xs text-slate-700">الاشتراك والفتح</TableHead>
                            <TableHead className="text-right font-black text-xs text-slate-700">الشركة الأم</TableHead>
                            <TableHead className="text-right font-black text-xs text-slate-700">حسابات الشركة الأم</TableHead>
                            <TableHead className="text-right font-black text-xs text-slate-700">المصادر المفعّلة</TableHead>
                            <TableHead className="text-center font-black text-xs text-slate-700 w-32">الإجراءات</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {users.map((u) => (
                            <TableRow key={u.uid} className="hover:bg-slate-50/40 transition-colors">
                              <TableCell className="font-extrabold text-blue-800 py-4 pr-6 text-sm">{u.username}</TableCell>
                              <TableCell className="font-mono text-slate-600 text-xs font-semibold">{u.password}</TableCell>
                              <TableCell>
                                <Badge className={u.role === 'admin' ? 'bg-amber-100 text-amber-800 font-black border border-amber-200' : 'bg-blue-100 text-blue-800 font-black border border-blue-200'}>
                                  {u.role === 'admin' ? 'مدير منصة' : 'محدِّث بيانات'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {(() => {
                                  const sub = u.subscription;
                                  if (!sub) {
                                    return <Badge className="bg-emerald-100/80 text-emerald-800 border border-emerald-200 font-black text-[10px]">مفتوح / دائم</Badge>;
                                  }
                                  
                                  const today = new Date().toISOString().split('T')[0];
                                  const isExpired = sub.status === 'expired' || (sub.expiresAt && sub.expiresAt < today);
                                  
                                  let statusColor = "bg-emerald-100 text-emerald-800 border-emerald-200";
                                  let statusText = "نشط";
                                  
                                  if (isExpired) {
                                    statusColor = "bg-rose-100 text-rose-800 border-rose-200";
                                    statusText = "منتهي الصلاحية";
                                  } else if (sub.status === 'trial') {
                                    statusColor = "bg-amber-100 text-amber-800 border-amber-250";
                                    statusText = "تجريبي";
                                  } else if (sub.status === 'canceled') {
                                    statusColor = "bg-slate-100 text-slate-500 border-slate-200";
                                    statusText = "ملغي";
                                  }
                                  
                                  return (
                                    <div className="flex flex-col gap-0.5" dir="rtl">
                                      <Badge className={`${statusColor} font-black border text-[10px] w-fit`}>
                                        {statusText}
                                      </Badge>
                                      {sub.expiresAt && (
                                        <span className="text-[10px] font-bold text-slate-500 mt-1" dir="ltr">
                                          ينتهي: {sub.expiresAt}
                                        </span>
                                      )}
                                      {sub.notes && (
                                        <span className="text-[9px] font-bold text-indigo-500 max-w-[140px] truncate" title={sub.notes}>
                                          📌 {sub.notes}
                                        </span>
                                      )}
                                    </div>
                                  );
                                })()}
                              </TableCell>
                              <TableCell className="font-bold text-slate-700">
                                {providers.find(p => p.id === u.parentProviderId)?.name || (u.parentProviderId ? `شركة ${u.parentProviderId}` : 'غير محدد')}
                              </TableCell>
                              <TableCell className="font-semibold text-slate-400 text-xs">
                                {u.parentCredentials?.username ? (
                                  <span className="text-slate-600 font-mono">
                                    {u.parentCredentials.username} / {u.parentCredentials.password}
                                  </span>
                                ) : (
                                  <span className="italic">لم يدخل بعد</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {u.sourceProviderIds.map(srcId => {
                                    const srcName = providers.find(p => p.id === srcId)?.name || srcId;
                                    const creds = u.sourceCredentials?.[srcId];
                                    return (
                                      <div key={srcId} className="flex flex-col border border-slate-100 bg-slate-50 rounded-lg p-1.5 min-w-[120px]">
                                        <span className="text-xs font-black text-slate-800">{srcName}</span>
                                        {creds?.username ? (
                                          <span className="text-[10px] font-mono text-blue-600 mt-1">
                                            {creds.username} / {creds.password}
                                          </span>
                                        ) : (
                                          <span className="text-[10px] italic text-red-400 mt-1">بدون حساب</span>
                                        )}
                                      </div>
                                    );
                                  })}
                                  {u.sourceProviderIds.length === 0 && (
                                    <span className="text-xs italic text-slate-400">لا يوجد جهات مفعّلة</span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center justify-center gap-2">
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    onClick={() => handleOpenUserModal(u)}
                                    className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg"
                                    title="تعديل المحدّث"
                                  >
                                    <Edit size={16} />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    onClick={() => handleOpenShortcutsEditor(u)}
                                    className="h-8 w-8 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg"
                                    title="تخصيص الاختصارات"
                                  >
                                    <Sparkles size={16} />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    onClick={() => handleDeleteUser(u.uid, u.username)}
                                    className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg"
                                    title="حذف المحدّث"
                                  >
                                    <Trash2 size={16} />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                          {users.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={7} className="text-center py-20 italic text-slate-400 font-bold">
                                لا توجد حسابات محدثين مسجلة حتى الآن...
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {activeTab === 'providers' && (
              <motion.div
                key="providers-tab"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              >
                {providers.map((p) => (
                  <Card key={p.id} className="rounded-3xl border-none shadow-xl bg-white overflow-hidden flex flex-col justify-between">
                    <div>
                      <div className={`h-2 ${p.type === 'parent' ? 'bg-indigo-600' : 'bg-emerald-600'} w-full`} />
                      <CardHeader className="p-6">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-xl font-black text-slate-800">{p.name}</CardTitle>
                            <span className="text-slate-400 text-xs font-semibold">ID المقر: {p.id}</span>
                          </div>
                          <Badge className={p.type === 'parent' ? 'bg-indigo-100 text-indigo-800 font-black' : 'bg-emerald-100 text-emerald-800 font-black'}>
                            {p.type === 'parent' ? 'الشركة الأم' : 'شركة مصدر'}
                          </Badge>
                        </div>
                      </CardHeader>

                      <CardContent className="px-6 pb-6 space-y-4">
                        <div className="space-y-1">
                          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">رابط الدخول للوحة (Login API)</span>
                          <span className="text-xs font-mono text-slate-700 break-all block py-1.5 px-3 bg-slate-50 border border-slate-100 rounded-xl">
                            {p.loginUrl}
                          </span>
                        </div>

                        <div className="space-y-1">
                          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">بوابة البحث (Search API)</span>
                          <span className="text-xs font-mono text-slate-700 break-all block py-1.5 px-3 bg-slate-50 border border-slate-100 rounded-xl">
                            {p.searchUrl}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <span className="text-[10px] font-black text-slate-400 uppercase">مفتاح تسجيل الخروج</span>
                            <span className="text-xs font-semibold text-slate-600 block py-1.5 px-3 bg-slate-50 border border-slate-100 rounded-xl">
                              {p.loginCheck}
                            </span>
                          </div>

                          <div className="space-y-1">
                            <span className="text-[10px] font-black text-slate-400 uppercase">مستخلص الأسطر</span>
                            <span className="text-xs font-semibold text-slate-600 block py-1.5 px-3 bg-slate-50 border border-slate-100 rounded-xl">
                              {p.rowSelector || 'tr[id]'}
                            </span>
                          </div>
                        </div>

                        {p.type === 'parent' && (
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <span className="text-[10px] font-black text-slate-400 uppercase">مؤشر عمود الوصلة</span>
                              <span className="text-xs font-bold text-slate-600 block py-1.5 px-3 bg-slate-50 border border-slate-100 rounded-xl text-center">
                                {p.idWaslIndex}
                              </span>
                            </div>
                            <div className="space-y-1">
                              <span className="text-[10px] font-black text-slate-400 uppercase">مؤشر عمود التسلسل</span>
                              <span className="text-xs font-bold text-slate-600 block py-1.5 px-3 bg-slate-50 border border-slate-100 rounded-xl text-center">
                                {p.sequenceIndex}
                              </span>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </div>

                    <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
                      <Button 
                        onClick={() => handleOpenProviderModal(p)}
                        variant="ghost" 
                        size="sm" 
                        className="text-blue-600 hover:text-blue-700 hover:bg-white text-xs font-black gap-1.5 px-4 h-9 rounded-xl border border-blue-100"
                      >
                        <Edit size={14} />
                        تعديل المعايير والروابط
                      </Button>
                    </div>
                  </Card>
                ))}
              </motion.div>
            )}

            {activeTab === 'logs' && (() => {
              const stats = getTodayStats();
              const targetDateStr = analyticsDate || toLocalYMD(new Date());
              
              const userStats = users.map(u => {
                const user = u.username;
                const isTargetDate = u.presence?.todayDate === targetDateStr;
                const mins = isTargetDate ? Math.round((u.presence?.todaySeconds || 0) / 60) : 0;
                const fetches = stats.userFetches[user] || 0;
                const updates = stats.userUpdates[user] || 0;
                // Rely on live visits if target date is today, otherwise fallback to logins log count
                const logins = isTargetDate ? (u.presence?.todayVisits || 0) : (stats.userLogins[user] || 0);
                return { user, mins, fetches, updates, logins };
              })
              .filter(item => {
                if (analyticsUser && analyticsUser !== 'all') {
                  return item.user === analyticsUser;
                }
                return true;
              })
              .sort((a, b) => b.mins - a.mins);

              const maxMins = Math.max(...userStats.map(u => u.mins), 60);

              return (
                <motion.div
                  key="logs-tab"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  className="space-y-6"
                >
                  {/* --- CARD 1: EXPLANATORY HEAD PERFORMANCE PANEL WITH OWNER FILTERS --- */}
                  <div className="bg-gradient-to-l from-slate-900 to-indigo-950 rounded-3xl p-6 text-white border border-slate-800 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl text-right" />
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl" />
                    
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                      <div className="space-y-1 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          {stats.isFallbackToMatches && (
                            <span className="text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-md flex items-center gap-1">
                              ⚠️ لم تسجل حركات في هذا اليوم - عُرضت بيانات {stats.displayDateLabel}
                            </span>
                          )}
                          <span className="text-[10px] uppercase font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-md">
                            لوحة المراقبة الفنية لمالك المنصة
                          </span>
                        </div>
                        <h2 className="text-xl font-black tracking-tight text-white flex items-center gap-2 justify-end">
                          إحصائيات وقراءات يوم: {stats.displayDateLabel}
                        </h2>
                        <p className="text-xs text-slate-300 max-w-xl font-bold">
                          رصد وتحليل دقيق لمعدلات الجلب والتحديث، وتتبع مدة بقاء ونشاط المحدّثين الفوري داخل الموقع لتقييم الأداء الحالي.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowCharts(!showCharts)}
                        className="self-start md:self-center bg-white/10 hover:bg-white/15 active:bg-white/5 border border-white/10 text-white font-black text-xs px-4 py-2.5 rounded-xl transition-all flex items-center gap-2"
                      >
                        {showCharts ? 'إخفاء الرسوم والتحليلات البيانية' : 'عرض الرسوم والتحليلات البيانية'}
                        {showCharts ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    </div>

                    {/* Interactive Filters Bar (Date & User Picker) */}
                    <div className="mt-4 pt-4 border-t border-white/10 flex flex-wrap items-center justify-end gap-4 z-20 relative text-right">
                      {/* User filter */}
                      <div className="flex flex-col gap-1 text-right w-full sm:w-auto">
                        <label className="text-[10px] text-slate-350 font-black">فلترة إحصائيات المستخدمين</label>
                        <select
                          value={analyticsUser}
                          onChange={(e) => setAnalyticsUser(e.target.value)}
                          className="bg-slate-800 hover:bg-slate-750 border border-slate-700 text-white rounded-xl text-xs px-3.5 py-2 font-black focus:outline-none focus:ring-2 focus:ring-indigo-505/50 w-full sm:w-48 text-right cursor-pointer"
                        >
                          <option value="all">كافة المحدّثين (الكل)</option>
                          {users.map(u => (
                            <option key={u.uid} value={u.username}>{u.name || u.username}</option>
                          ))}
                        </select>
                      </div>

                      {/* Date filter */}
                      <div className="flex flex-col gap-1 text-right w-full sm:w-auto">
                        <label className="text-[10px] text-slate-350 font-black">اختر يوم التقرير والتحديثات</label>
                        <input
                          type="date"
                          value={analyticsDate || ''}
                          onChange={(e) => setAnalyticsDate(e.target.value)}
                          className="bg-slate-800 hover:bg-slate-750 border border-slate-700 text-white rounded-xl text-xs px-3.5 py-2 font-black focus:outline-none focus:ring-2 focus:ring-indigo-505/50 w-full sm:w-44 text-right cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* Quick Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-white/10 relative z-10 text-right">
                      <div className="space-y-1 bg-white/5 p-4 rounded-2xl border border-white/5">
                        <span className="text-[10px] font-black text-slate-400 block pb-0.5">إجمالي العمليات المسجلة</span>
                        <div className="flex items-baseline gap-1 justify-start flex-row-reverse">
                          <span className="text-xl font-black text-white font-sans">{stats.targetDateLogsCount}</span>
                          <span className="text-[10px] text-indigo-300 font-black">حركة نشطة</span>
                        </div>
                      </div>
                      <div className="space-y-1 bg-white/5 p-4 rounded-2xl border border-white/5">
                        <span className="text-[10px] font-black text-slate-400 block pb-0.5">طلبات تسليم (حالة 2)</span>
                        <div className="flex items-baseline gap-1 justify-start flex-row-reverse">
                          <span className="text-xl font-black text-emerald-400 font-sans">{stats.totalDelivered}</span>
                          <span className="text-[10px] text-emerald-300 font-black">طلب ناجح</span>
                        </div>
                      </div>
                      <div className="space-y-1 bg-white/5 p-4 rounded-2xl border border-white/5">
                        <span className="text-[10px] font-black text-slate-400 block pb-0.5">طلبات انتظار ومؤجل (حالة 3)</span>
                        <div className="flex items-baseline gap-1 justify-start flex-row-reverse">
                          <span className="text-xl font-black text-amber-400 font-sans">{stats.totalDelayed}</span>
                          <span className="text-[10px] text-amber-300 font-black">حالة معلّقة</span>
                        </div>
                      </div>
                      <div className="space-y-1 bg-white/5 p-4 rounded-2xl border border-white/5">
                        <span className="text-[10px] font-black text-slate-400 block pb-0.5">طلبات مرفوضة (حالة 4)</span>
                        <div className="flex items-baseline gap-1 justify-start flex-row-reverse">
                          <span className="text-xl font-black text-rose-400 font-sans">{stats.totalRejected}</span>
                          <span className="text-[10px] text-rose-300 font-black">طلب ملغى</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Collapsible Interactive Charts */}
                  <AnimatePresence>
                    {showCharts && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden space-y-6"
                      >
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        
                          {/* CARD A: USER ACTIVE SESSIONS & STAY TIME (UPDATED WITH REAL-TIME ACTIVE TICKERS) */}
                          <div className="lg:col-span-4 bg-white rounded-3xl p-6 border border-slate-200/60 shadow-lg flex flex-col justify-between min-h-[360px]">
                            <div className="space-y-1.5 text-right pb-3 border-b border-slate-100">
                              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 justify-end">
                                <Clock className="text-blue-500" size={16} />
                                حالة الجلسة ومدد التواجد بالموقع
                              </h3>
                              <p className="text-[11px] text-slate-400 font-bold">
                                مراقبة بث مباشر لحالة المحدّثين ونشاطهم الفعلي ومؤشر تتبع الجلسة بالثواني والدقائق.
                              </p>
                            </div>

                            <ScrollArea className="h-60 mt-4 pr-1.5">
                              {userStats.length === 0 ? (
                                <div className="text-center py-16 text-slate-400 font-bold text-xs italic">
                                  لا توجد حركات تواجد أو نشاط للمستخدم المحدد في هذا اليوم.
                                </div>
                              ) : (
                                <div className="space-y-5 text-right font-sans">
                                  {userStats.map((item, idx) => {
                                    const percentage = Math.min(100, Math.max(8, (item.mins / maxMins) * 100));
                                    const liveSession = getUserActiveSession(item.user);

                                    return (
                                      <div key={idx} className="space-y-1.5">
                                        <div className="flex items-center justify-between font-bold">
                                          <div className="flex items-center gap-1 font-sans">
                                            <span className="text-[9px] font-black bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                                              {item.logins} زيارة اليوم
                                            </span>
                                            <span className="text-[9px] font-black bg-blue-50 px-1.5 py-0.5 rounded text-blue-700">
                                              {item.fetches} جلب
                                            </span>
                                            <span className="text-[9px] font-black bg-emerald-50 px-1.5 py-0.5 rounded text-emerald-700">
                                              {item.updates} تحديث
                                            </span>
                                          </div>
                                          
                                          {/* Name and green pulsing badge */}
                                          <div className="flex items-center gap-1.5 justify-end">
                                            {liveSession.isActive ? (
                                              <span className="flex h-2 w-2 relative shrink-0">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                              </span>
                                            ) : (
                                              <span className="h-2 w-2 rounded-full bg-slate-300 shrink-0"></span>
                                            )}
                                            <span className="text-xs font-black text-slate-800 font-sans">{item.user}</span>
                                          </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-2 flex-row-reverse pb-1">
                                          {/* Styled bar */}
                                          <div className="w-full bg-slate-100 rounded-full h-3 relative overflow-hidden border border-slate-200/50">
                                            <div 
                                              style={{ width: `${percentage}%` }}
                                              className={`h-full rounded-full transition-all duration-1000 shadow-xs relative ${
                                                liveSession.isActive 
                                                  ? 'bg-gradient-to-r from-emerald-400 to-teal-500 animate-pulse' 
                                                  : 'bg-gradient-to-r from-blue-500 to-indigo-600'
                                              }`}
                                            />
                                          </div>
                                          
                                          {/* Time indicator and live session feedback */}
                                          <div className="flex flex-col text-left shrink-0 min-w-[100px]">
                                            <span className={`text-[10px] font-sans font-black ${liveSession.isActive ? 'text-emerald-600 font-extrabold' : 'text-slate-600'}`}>
                                              {liveSession.isActive ? 'نشط الآن' : 'خارج الجلسة'}
                                            </span>
                                            <span className="text-[9px] font-sans text-slate-400 font-bold">
                                              مدة النشاط: {liveSession.durationStr}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </ScrollArea>
                          </div>

                          {/* CARD B: 24h UPDATES & FETCHES DISTRIBUTION */}
                          <div className="lg:col-span-5 bg-white rounded-3xl p-6 border border-slate-200/60 shadow-lg flex flex-col justify-between min-h-[360px] relative">
                            <div className="space-y-1.5 text-right pb-3 border-b border-slate-100">
                              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 justify-end">
                                <Activity className="text-amber-500 animate-pulse" size={16} />
                                توزيع مرات التحديث والجلب (24 ساعة)
                              </h3>
                              <p className="text-[11px] text-slate-400 font-bold">
                                قياس التحديثات والجلب خلال كل ساعة من ساعات اليوم المختار لمتابعة فترات النشاط.
                              </p>
                            </div>

                            {/* Hover tooltip absolute overlay */}
                            <div className="relative h-44 mt-4 bg-slate-50/50 rounded-2xl border border-slate-100 p-2 flex items-center justify-center">
                              {(() => {
                                const hourlyUpdates = stats.hourlyUpdates;
                                const hourlyFetches = stats.hourlyFetches;
                                const maxVal = Math.max(...hourlyUpdates, ...hourlyFetches, 4);

                                const chartWidth = 500;
                                const chartHeight = 150;
                                const paddingLeft = 30;
                                const paddingRight = 10;
                                const paddingTop = 10;
                                const paddingBottom = 20;

                                const plotWidth = chartWidth - paddingLeft - paddingRight;
                                const plotHeight = chartHeight - paddingTop - paddingBottom;
                                const hourSlotWidth = plotWidth / 24;
                                const subBarWidth = Math.max(3, (hourSlotWidth - 4) / 2);

                                return (
                                  <div className="w-full h-full relative" onMouseLeave={() => setHoveredHour(null)}>
                                    
                                    {/* Tooltip Overlay */}
                                    {hoveredHour !== null && (
                                      <div className="absolute top-0 inset-x-0 mx-auto w-fit bg-slate-900 border border-slate-800 text-white rounded-xl py-1 px-2.5 shadow-xl flex items-center gap-2 text-[10px] z-20 font-black justify-center animate-fade-in">
                                        <span className="text-slate-400 font-sans">الساعة {hoveredHour}:00</span>
                                        <span className="text-blue-400 flex items-center gap-1">🟢 جلب: <b>{hourlyFetches[hoveredHour]}</b></span>
                                        <span className="text-amber-400 flex items-center gap-1">🟡 مزامنة: <b>{hourlyUpdates[hoveredHour]}</b></span>
                                      </div>
                                    )}

                                    {/* Responsive SVG Vector Chart */}
                                    <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-full text-slate-450 overflow-visible">
                                      {/* Grid Y lines */}
                                      {[0, 0.25, 0.5, 0.75, 1].map((ratio, gridIdx) => {
                                        const y = paddingTop + plotHeight * (1 - ratio);
                                        return (
                                          <line 
                                            key={gridIdx} 
                                            x1={paddingLeft} 
                                            y1={y} 
                                            x2={chartWidth - paddingRight} 
                                            y2={y} 
                                            stroke="#E2E8F0" 
                                            strokeWidth="0.5" 
                                            strokeDasharray="4 4"
                                          />
                                        );
                                      })}

                                      {/* Hourly columns loops */}
                                      {Array.from({ length: 24 }).map((_, hourNum) => {
                                        const xSlot = paddingLeft + hourNum * hourSlotWidth;
                                        
                                        // Calculate bars height
                                        const updVal = hourlyUpdates[hourNum] || 0;
                                        const fchVal = hourlyFetches[hourNum] || 0;

                                        const updHeight = (updVal / maxVal) * plotHeight;
                                        const fchHeight = (fchVal / maxVal) * plotHeight;

                                        const updY = chartHeight - paddingBottom - updHeight;
                                        const fchY = chartHeight - paddingBottom - fchHeight;

                                        const isHovered = hoveredHour === hourNum;

                                        return (
                                          <g 
                                            key={hourNum}
                                            className="cursor-pointer"
                                            onMouseEnter={() => setHoveredHour(hourNum)}
                                          >
                                            {/* Hover area trigger */}
                                            <rect 
                                              x={xSlot}
                                              y={paddingTop}
                                              width={hourSlotWidth}
                                              height={plotHeight}
                                              className="fill-transparent hover:fill-slate-500/5 transition-all"
                                            />

                                            {/* Fetch Bar (Blue) */}
                                            {fchVal > 0 && (
                                              <rect 
                                                x={xSlot + 1}
                                                y={fchY}
                                                width={subBarWidth}
                                                height={fchHeight}
                                                rx="1.5"
                                                className={`fill-blue-500 hover:fill-blue-600 transition-all ${isHovered ? 'brightness-110' : ''}`}
                                              />
                                            )}

                                            {/* Update Bar (Orange/Amber) */}
                                            {updVal > 0 && (
                                              <rect 
                                                x={xSlot + 1 + subBarWidth + 1}
                                                y={updY}
                                                width={subBarWidth}
                                                height={updHeight}
                                                rx="1.5"
                                                className={`fill-amber-500 hover:fill-amber-600 transition-all ${isHovered ? 'brightness-110' : ''}`}
                                              />
                                            )}

                                            {/* Hour label text (X Axis) */}
                                            {hourNum % 3 === 0 && (
                                              <text 
                                                x={xSlot + hourSlotWidth / 2} 
                                                y={chartHeight - 4} 
                                                textAnchor="middle" 
                                                className="text-[8px] font-sans font-black fill-slate-400"
                                              >
                                                {hourNum <= 9 ? `0${hourNum}` : hourNum}:00
                                              </text>
                                            )}
                                          </g>
                                        );
                                      })}

                                      {/* Left scale Y ticks */}
                                      <text x={paddingLeft - 5} y={paddingTop + 4} textAnchor="end" className="text-[8px] font-sans font-black fill-slate-400">{Math.round(maxVal)}</text>
                                      <text x={paddingLeft - 5} y={paddingTop + plotHeight / 2 + 4} textAnchor="end" className="text-[8px] font-sans font-black fill-slate-400">{Math.round(maxVal / 2)}</text>
                                      <text x={paddingLeft - 5} y={chartHeight - paddingBottom + 2} textAnchor="end" className="text-[8px] font-sans font-black fill-slate-400">0</text>
                                    </svg>
                                  </div>
                                );
                              })()}
                            </div>

                            {/* Legends Indicators */}
                            <div className="flex items-center justify-center gap-4 mt-3 bg-slate-50 py-2 px-3 rounded-xl border border-slate-100">
                              <span className="text-[10px] font-black text-slate-650 flex items-center gap-1">
                                <span className="w-2 h-2 rounded bg-blue-500" />
                                مرات الجلب والمطابقة (Fetches)
                              </span>
                              <span className="text-[10px] font-black text-slate-650 flex items-center gap-1">
                                <span className="w-2 h-2 rounded bg-amber-500" />
                                مزامنة وتحديث السيرفر (Updates)
                              </span>
                            </div>
                          </div>

                          {/* CARD C: STATUS COMPARISON METRIC BREAKDOWN (TOTAL COUNTER ONLY, NO PERCENTAGES AS REQUESTED) */}
                          <div className="lg:col-span-3 bg-white rounded-3xl p-6 border border-slate-200/60 shadow-lg flex flex-col justify-between min-h-[360px]">
                            <div className="space-y-1.5 text-right pb-3 border-b border-slate-100">
                              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 justify-end">
                                <CheckCircle2 className="text-emerald-500" size={16} />
                                إحصائيات المعالجة بالبرنامج
                              </h3>
                              <p className="text-[11px] text-slate-400 font-bold">
                                عدد العمليات التي قام المحدثون بمعالجتها وتحديث حالتها على السيرفر لهذا اليوم.
                              </p>
                            </div>

                            {(() => {
                              const { totalDelivered, totalDelayed, totalRejected } = stats;
                              const sum = totalDelivered + totalDelayed + totalRejected;

                              return (
                                <div className="space-y-4 flex-1 flex flex-col justify-center mt-3 text-right">
                                  
                                  {/* Total Counter Core Panel */}
                                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-center">
                                    <span className="text-[10px] font-black text-slate-400 block pb-1">إجمالي الطلبات المحدثة والمعدلة</span>
                                    <div className="text-3xl font-black text-indigo-950 font-sans tracking-tight">
                                      {sum}
                                    </div>
                                    <span className="text-[9px] text-indigo-650 font-black">طلب معالج بالكامل</span>
                                  </div>

                                  {/* Individual Simple Counters */}
                                  <div className="space-y-2.5 text-right">
                                    
                                    {/* 1. Delivered Counter */}
                                    <div className="flex items-center justify-between bg-emerald-50/50 border border-emerald-100 rounded-xl p-2.5 px-3">
                                      <div className="flex items-center gap-1.5 font-sans">
                                        <span className="text-sm font-black text-emerald-700 font-sans">{totalDelivered}</span>
                                        <span className="text-[9px] text-emerald-600 font-bold">طلبات</span>
                                      </div>
                                      <span className="text-xs font-black text-slate-700">تم التسليم (حالة 2)</span>
                                    </div>

                                    {/* 2. Delayed Counter */}
                                    <div className="flex items-center justify-between bg-amber-50/50 border border-amber-100 rounded-xl p-2.5 px-3">
                                      <div className="flex items-center gap-1.5 font-sans">
                                        <span className="text-sm font-black text-amber-700 font-sans">{totalDelayed}</span>
                                        <span className="text-[9px] text-amber-600 font-bold">طلبات</span>
                                      </div>
                                      <span className="text-xs font-black text-slate-700">المؤجل شحنه (حالة 3)</span>
                                    </div>

                                    {/* 3. Rejected Counter */}
                                    <div className="flex items-center justify-between bg-rose-50/50 border border-rose-100 rounded-xl p-2.5 px-3">
                                      <div className="flex items-center gap-1.5 font-sans">
                                        <span className="text-sm font-black text-rose-700 font-sans">{totalRejected}</span>
                                        <span className="text-[9px] text-rose-600 font-bold">طلبات</span>
                                      </div>
                                      <span className="text-xs font-black text-slate-700">المرفوض والملغي (حالة 4)</span>
                                    </div>

                                  </div>

                                </div>
                              );
                            })()}
                          </div>

                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* --- ORIGINAL LOGS LIST COMPONENT --- */}
                  <Card className="rounded-3xl border-none shadow-xl bg-white overflow-hidden">
                    <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-6">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="text-right">
                          <CardTitle className="text-lg font-black text-slate-800 flex items-center gap-2 justify-end">
                            <History className="text-indigo-600" size={20} />
                            سجل حركات ونشاط المحدِّثين الفوري
                          </CardTitle>
                          <CardDescription className="text-slate-400 font-bold text-xs mt-1">
                            يمكنك مراقبة كافة تحركات المستخدمين وسجلات جلب وتحديث ومعالجة الطلبات بالتوقيت الفعلي للعمليات
                          </CardDescription>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="flex items-center gap-1.5 min-w-[150px]">
                            <span className="text-xs font-black text-slate-500 whitespace-nowrap">فلترة بالمحدث:</span>
                            <select 
                              value={selectedLogsUser} 
                              onChange={(e) => setSelectedLogsUser(e.target.value)}
                              className="bg-slate-100 border border-slate-200 text-xs font-bold rounded-xl py-2 px-3 h-9 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                            >
                              <option value="all">كافة المحدّثين</option>
                              {users.map(u => (
                                <option key={u.uid} value={u.username}>{u.username}</option>
                              ))}
                            </select>
                          </div>

                          <div className="relative h-9 min-w-[200px]">
                            <Search size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <Input 
                              value={logsSearch}
                              onChange={(e) => setLogsSearch(e.target.value)}
                              placeholder="بحث في سجل العمليات..."
                              className="h-full pl-3 pr-9 border-slate-200 rounded-xl text-xs font-bold w-full bg-slate-50/50"
                            />
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <ScrollArea className="h-[550px] w-full">
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader className="bg-slate-50/35 sticky top-0 bg-white z-10 shadow-sm border-b">
                              <TableRow>
                                <TableHead className="text-right font-black text-xs text-slate-700 py-4 pr-6 w-52">تاريخ ووقت الحركة</TableHead>
                                <TableHead className="text-right font-black text-xs text-slate-700 w-36">اسم المحدّث</TableHead>
                                <TableHead className="text-right font-black text-xs text-slate-700 w-44">نوع العملية</TableHead>
                                <TableHead className="text-right font-black text-xs text-slate-700">تفاصيل النشاط (اضغط للتفاصيل الكاملة)</TableHead>
                                <TableHead className="text-center font-black text-xs text-slate-700 w-24">الإجراء</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {(() => {
                                const filteredLogs = logs.filter(log => {
                                  const matchesUser = selectedLogsUser === 'all' || log.username === selectedLogsUser;
                                  const keyword = logsSearch.trim().toLowerCase();
                                  const matchesKeyword = !keyword || 
                                    String(log.username || '').toLowerCase().includes(keyword) ||
                                    String(log.action || '').toLowerCase().includes(keyword) ||
                                    String(log.details || '').toLowerCase().includes(keyword);
                                  return matchesUser && matchesKeyword;
                                });

                                if (filteredLogs.length === 0) {
                                  return (
                                    <TableRow>
                                      <TableCell colSpan={5} className="text-center py-24 italic text-slate-400 font-bold bg-slate-50/30">
                                        لا توجد حركات مسجلة تطابق محددات البحث والفهرس لتعطيك تفاصيل.
                                      </TableCell>
                                    </TableRow>
                                  );
                                }

                                return filteredLogs.map((log, idx) => {
                                  const uniqueId = log.id || `${log.timestamp}-${log.username}-${idx}`;
                                  const parsed = parseLogDetails(log.action || '', log.details || '');

                                  let actionBadgeStyle = "bg-blue-50 text-blue-700 border-blue-100";
                                  if (log.action?.includes('تسجيل الدخول')) {
                                    actionBadgeStyle = "bg-emerald-50 text-emerald-700 border-emerald-100";
                                  } else if (log.action?.includes('تسجيل الخروج')) {
                                    actionBadgeStyle = "bg-slate-100 text-slate-700 border-slate-200";
                                  } else if (log.action?.includes('مؤقت')) {
                                    actionBadgeStyle = "bg-purple-55 text-purple-700 border-purple-100";
                                  } else if (log.action?.includes('خطأ') || log.action?.includes('فشل')) {
                                    actionBadgeStyle = "bg-red-55 text-red-700 border-red-100";
                                  } else if (log.action?.includes('مزامنة')) {
                                    actionBadgeStyle = "bg-amber-55 text-amber-700 border-amber-100";
                                  }

                                  let dayPart = '';
                                  let monthPart = '';
                                  let timePart = '';
                                  try {
                                    const d = new Date(log.timestamp);
                                    dayPart = d.toLocaleDateString('ar-EG', { day: 'numeric' });
                                    monthPart = d.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });
                                    timePart = d.toLocaleTimeString('ar-EG', {
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    });
                                  } catch (_) {}

                                  return (
                                    <TableRow 
                                      key={uniqueId}
                                      onClick={() => setSelectedLogForModal(log)}
                                      className="cursor-pointer transition-all border-b border-slate-100 select-none hover:bg-slate-50/80 active:bg-slate-100/50"
                                    >
                                      <TableCell className="py-3 pr-6">
                                        <div className="flex flex-col gap-1 items-start">
                                          <div className="flex items-center gap-1.5 bg-indigo-50/50 text-indigo-950 font-black text-[12px] px-2.5 py-1 rounded-lg border border-indigo-100/60 shadow-xs">
                                            <Calendar size={12} className="text-indigo-500 shrink-0" />
                                            <span>{dayPart} {monthPart}</span>
                                          </div>
                                          <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500 font-sans pr-1.5">
                                            <Clock size={11} className="text-slate-400 shrink-0" />
                                            <span>{timePart}</span>
                                          </div>
                                        </div>
                                      </TableCell>
                                      <TableCell className="font-extrabold text-blue-900 text-sm">
                                        {log.username}
                                      </TableCell>
                                      <TableCell>
                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-black border ${actionBadgeStyle}`}>
                                          {log.action}
                                        </span>
                                      </TableCell>
                                      <TableCell className="text-slate-700 font-bold text-xs leading-relaxed max-w-lg truncate">
                                        {parsed.short}
                                      </TableCell>
                                      <TableCell className="text-center pr-2">
                                        <Button 
                                          type="button"
                                          size="xs"
                                          variant="outline"
                                          className="h-8 rounded-xl text-[10px] font-black border-slate-200 text-indigo-700 bg-white hover:bg-indigo-50 hover:border-indigo-200 shadow-sm transition-all px-3"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedLogForModal(log);
                                          }}
                                        >
                                          التفاصيل الكاملة
                                        </Button>
                                      </TableCell>
                                    </TableRow>
                                  );
                                });
                              })()}
                            </TableBody>
                          </Table>
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })()}

            {activeTab === 'subscriptions' && (() => {
              const subUsers = users.filter(u => u.role !== 'admin');
              const todayYMD = new Date().toISOString().split('T')[0];
              
              // Calculate KPIs
              const activeCount = subUsers.filter(u => {
                const isExpired = u.subscription?.expiresAt && u.subscription.expiresAt < todayYMD;
                return u.subscription?.status === 'active' && !isExpired;
              }).length;
              
              const trialCount = subUsers.filter(u => u.subscription?.status === 'trial').length;
              const totalRevenueAmt = subUsers.reduce((sum, u) => sum + (u.subscription?.pricePaid || 0), 0);
              
              const expSoonCount = subUsers.filter(u => {
                if (!u.subscription?.expiresAt) return false;
                const today = new Date();
                today.setHours(0,0,0,0);
                const expiry = new Date(u.subscription.expiresAt);
                const diffTime = expiry.getTime() - today.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                return diffDays >= 0 && diffDays <= 3;
              }).length;

              // Filter users
              const filteredSubUsers = subUsers.filter(u => {
                const matchesSearch = u.username.toLowerCase().includes(subFilterSearch.toLowerCase());
                
                if (subFilterStatus === 'all') return matchesSearch;
                
                const statsStatus = u.subscription?.status || 'active';
                const isExpired = u.subscription?.expiresAt && u.subscription.expiresAt < todayYMD;
                
                if (subFilterStatus === 'active') {
                  return matchesSearch && statsStatus === 'active' && !isExpired;
                }
                if (subFilterStatus === 'expired') {
                  return matchesSearch && (statsStatus === 'expired' || !!isExpired);
                }
                if (subFilterStatus === 'trial') {
                  return matchesSearch && statsStatus === 'trial' && !isExpired;
                }
                if (subFilterStatus === 'canceled') {
                  return matchesSearch && statsStatus === 'canceled';
                }
                return matchesSearch;
              });

              return (
                <motion.div
                  key="subscriptions-tab"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  className="space-y-6"
                >
                  {/* Summary row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="rounded-2xl border-none shadow-md bg-white p-5 flex items-center justify-between">
                      <div className="space-y-1 text-right">
                        <span className="text-xs text-slate-400 font-bold block">الاشتراكات النشطة (المميزة)</span>
                        <h3 className="text-2xl font-black text-slate-800">{activeCount} حسابات</h3>
                      </div>
                      <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-100 text-emerald-600">
                        <ShieldCheck size={24} />
                      </div>
                    </Card>

                    <Card className="rounded-2xl border-none shadow-md bg-white p-5 flex items-center justify-between">
                      <div className="space-y-1 text-right">
                        <span className="text-xs text-slate-400 font-bold block">الحسابات في الفترة التجريبية</span>
                        <h3 className="text-2xl font-black text-slate-800">{trialCount} حسابات</h3>
                      </div>
                      <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-100 text-amber-600">
                        <Sparkles size={24} />
                      </div>
                    </Card>

                    <Card className="rounded-2xl border-none shadow-md bg-white p-5 flex items-center justify-between">
                      <div className="space-y-1 text-right">
                        <span className="text-xs text-slate-400 font-bold block">إجمالي المقبوضات المالية</span>
                        <h3 className="text-2xl font-black text-emerald-600 font-mono">{Number(totalRevenueAmt).toLocaleString()} د.ع</h3>
                      </div>
                      <div className="p-3.5 bg-blue-50 rounded-2xl border border-blue-100 text-blue-600">
                        <CreditCard size={24} />
                      </div>
                    </Card>

                    <Card className="rounded-2xl border-none shadow-md bg-white p-5 flex items-center justify-between">
                      <div className="space-y-1 text-right">
                        <span className="text-xs text-slate-400 font-bold block">أوشكت على الانتهاء (≤ 3 أيام)</span>
                        <h3 className="text-2xl font-black text-rose-600">{expSoonCount} حسابات</h3>
                      </div>
                      <div className="p-3.5 bg-rose-50 rounded-2xl border border-rose-100 text-rose-600">
                        <Clock size={24} />
                      </div>
                    </Card>
                  </div>

                  {/* Filter and controls header */}
                  <Card className="rounded-3xl border-none shadow-md bg-white overflow-hidden p-6">
                    <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                      <div className="flex flex-wrap gap-3 items-center w-full sm:w-auto">
                        <div className="relative flex-1 sm:w-64 min-w-[200px]">
                          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                          <Input 
                            value={subFilterSearch}
                            onChange={(e) => setSubFilterSearch(e.target.value)}
                            placeholder="ابحث عن اسم المحدِّث..."
                            className="bg-slate-50 border-slate-200 pl-10 pr-10 rounded-xl font-bold text-xs h-10 w-full"
                          />
                        </div>

                        <select
                          value={subFilterStatus}
                          onChange={(e) => setSubFilterStatus(e.target.value)}
                          className="h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[130px]"
                        >
                          <option value="all">كل الحالات</option>
                          <option value="active">نشط ومفعّل</option>
                          <option value="trial">تجريبي</option>
                          <option value="expired">منتهي الصلاحية</option>
                          <option value="canceled">ملغي الحساب</option>
                        </select>
                      </div>

                      <span className="text-xs text-slate-400 font-bold">
                        تم تصفية {filteredSubUsers.length} من أصل {subUsers.length} حساب محدّث فرعي.
                      </span>
                    </div>

                    {/* Table inside card */}
                    <div className="border border-slate-100 rounded-2xl mt-5 overflow-hidden">
                      <Table dir="rtl">
                        <TableHeader className="bg-slate-50 border-b border-slate-100">
                          <TableRow>
                            <TableHead className="text-right font-black text-xs text-slate-700 py-4 pr-6">#</TableHead>
                            <TableHead className="text-right font-black text-xs text-slate-700">اسم المحدِّث</TableHead>
                            <TableHead className="text-right font-black text-xs text-slate-700">دورة التفعيل</TableHead>
                            <TableHead className="text-right font-black text-xs text-slate-700">أيام الصلاحية</TableHead>
                            <TableHead className="text-right font-black text-xs text-slate-700">المبلغ المدفوع</TableHead>
                            <TableHead className="text-right font-black text-xs text-indigo-700">نشاط المصادر (هذا الشهر)</TableHead>
                            <TableHead className="text-right font-black text-xs text-emerald-700 font-bold">نشاط التحديث (هذا الشهر)</TableHead>
                            <TableHead className="text-center font-black text-xs text-slate-700">إجراءات المالك</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredSubUsers.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={8} className="text-center py-10 font-bold text-slate-400">
                                لا يوجد حسابات محدّثين تطابق الفلترة المحددة.
                              </TableCell>
                            </TableRow>
                          ) : (
                            filteredSubUsers.map((u, idx) => {
                              const sub = u.subscription;
                              const stats = getUserMonthlyStats(u.username);
                              const subAt = sub?.subscribedAt || 'غير مدون';
                              const expAt = sub?.expiresAt || 'غير فَعّال';
                              const price = sub?.pricePaid ? `${Number(sub.pricePaid).toLocaleString()} د.ع` : '0 د.ع';

                              // Generate Arabic remaining badge
                              const getRemDaysBadge = (exp: string) => {
                                if (!exp) return <Badge className="bg-slate-100 text-slate-500">لا يوجد تاريخ</Badge>;
                                const t = new Date();
                                t.setHours(0,0,0,0);
                                const ex = new Date(exp);
                                ex.setHours(0,0,0,0);
                                const diff = Math.ceil((ex.getTime() - t.getTime()) / (1000 * 60 * 60 * 24));

                                if (diff < 0) {
                                  return <span className="text-[10px] bg-red-50 text-red-700 border border-red-200 px-2 py-1 rounded-lg font-black block w-fit">منتهي منذ {Math.abs(diff)} يوم ⚠️</span>;
                                } else if (diff === 0) {
                                  return <span className="text-[10px] bg-rose-50 text-rose-700 border border-rose-200 px-2 py-1 rounded-lg font-black block w-fit">ينتهي اليوم 🚨</span>;
                                } else if (diff <= 3) {
                                  return <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-1 rounded-lg font-black block w-fit">بقي {diff} يوم فقط! 🔔</span>;
                                } else {
                                  return <span className="text-[10px] bg-slate-50 text-slate-600 border border-slate-200 px-2 py-1 rounded-lg font-bold block w-fit">متبقي {diff} يوم</span>;
                                }
                              };

                              let subStateText = 'نشط';
                              let subStateClass = 'bg-emerald-100/80 text-emerald-800 border border-emerald-250 font-bold text-[10px]';
                              const subExpired = sub?.expiresAt && sub.expiresAt < todayYMD;
                              
                              if (sub?.status === 'trial') {
                                subStateText = 'تجريبي';
                                subStateClass = 'bg-amber-100/80 text-amber-800 border border-amber-250 font-bold text-[10px]';
                              } else if (sub?.status === 'expired' || subExpired) {
                                subStateText = 'منتهي';
                                subStateClass = 'bg-rose-100/80 text-rose-800 border border-rose-250 font-bold text-[10px]';
                              } else if (sub?.status === 'canceled') {
                                subStateText = 'ملغي';
                                subStateClass = 'bg-slate-100/80 text-slate-500 border border-slate-200 font-bold text-[10px]';
                              }

                              return (
                                <TableRow key={u.uid} className="hover:bg-slate-50/50">
                                  <TableCell className="font-extrabold text-slate-400 py-4 pr-6">{idx + 1}</TableCell>
                                  <TableCell>
                                    <div className="flex flex-col text-right">
                                      <span className="font-black text-slate-800 text-sm">{u.username}</span>
                                      <span className="text-[10px] text-slate-400 font-bold">المعرف الفريد: {u.uid.slice(-6).toUpperCase()}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex flex-col text-right gap-1">
                                      <div className="flex gap-1.5 items-center">
                                        <Badge className={`${subStateClass} shrink-0`}>{subStateText}</Badge>
                                        <span className="text-xs text-slate-500 font-bold block">منذ: <strong className="font-mono">{subAt}</strong></span>
                                      </div>
                                      <span className="text-[10px] text-slate-400 font-bold">تاريخ الانتهاء: <strong className="font-mono text-rose-600">{expAt}</strong></span>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    {getRemDaysBadge(expAt)}
                                  </TableCell>
                                  <TableCell className="font-extrabold text-xs text-slate-800 font-mono">
                                    {price}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex flex-col text-right gap-0.5">
                                      <span className="text-xs font-black text-slate-800">{stats.fetchCount} دورات جلب</span>
                                      <span className="text-[10px] font-bold text-indigo-600">({stats.totalRecordsScraped.toLocaleString()} طلب مطابق)</span>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex flex-col text-right gap-0.5">
                                      <span className="text-xs font-black text-slate-800">{stats.updateCount} دورات تحديث</span>
                                      <span className="text-[10px] font-bold text-emerald-600">({stats.totalRecordsUpdated.toLocaleString()} طلب مزامن)</span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <div className="flex justify-center items-center gap-1.5">
                                      <Button
                                        onClick={() => handleOpenUserModal(u)}
                                        className="h-8 text-[11px] font-black bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-100 rounded-lg shrink-0 gap-1"
                                      >
                                        <RefreshCw size={12} />
                                        تجديد / تمديد الاشتراك
                                      </Button>
                                      <Button
                                        onClick={() => handlePrintReceipt(u)}
                                        className="h-8 text-[11px] font-black bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-100 rounded-lg shrink-0 gap-1"
                                      >
                                        <FileText size={12} />
                                        وصل الاشتراك والنشاط
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )
                            })
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </Card>
                </motion.div>
              );
            })()}
          </AnimatePresence>
        )}
      </div>

      {/* --- MODAL 1: CREATE / UPDATE USER --- */}
      <AnimatePresence>
        {isUserModalOpen && editingUser && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsUserModalOpen(false);
                setEditingUser(null);
              }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            
            <motion.form 
              onSubmit={handleSaveUser}
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="bg-slate-900 px-6 py-5 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-500/15 text-blue-400 border border-blue-500/25 rounded-xl">
                    <KeyRound size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black">{editingUser.username ? `تعديل حساب: ${editingUser.username}` : 'إضافة حساب محدِّث جديد'}</h3>
                    <p className="text-slate-400 text-[10px] font-bold mt-0.5">تحديد تفاصيل تسجيل الدخول والأذونات وربط شركات التوصيل</p>
                  </div>
                </div>
                <Button 
                  type="button"
                  variant="ghost" 
                  size="icon" 
                  onClick={() => {
                    setIsUserModalOpen(false);
                    setEditingUser(null);
                  }} 
                  className="rounded-full hover:bg-white/10 text-slate-400 hover:text-white"
                >
                  <X size={20} />
                </Button>
              </div>

              <ScrollArea className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 bg-[#FCFDFE]">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Internal Platform Credentials */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-black text-slate-700">اسم المستخدم على منصتنا</Label>
                    <Input 
                      required
                      placeholder="e.g. yousef_asasy"
                      value={editingUser.username || ''}
                      onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value })}
                      className="rounded-xl border-slate-200 focus:ring-blue-500 text-sm font-semibold h-11"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-black text-slate-700">كلمة مرور المنصة</Label>
                    <Input 
                      required
                      placeholder="كلمة مرور صريحة لتطابق المحدثين"
                      value={editingUser.password || ''}
                      onChange={(e) => setEditingUser({ ...editingUser, password: e.target.value })}
                      className="rounded-xl border-slate-200 focus:ring-blue-500 text-sm font-semibold h-11"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-black text-slate-700">الصلاحية والوظيفة</Label>
                    <select 
                      value={editingUser.role || 'mudhaddith'}
                      onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as 'admin' | 'mudhaddith' })}
                      className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="mudhaddith">محدِّث بيانات (Mudhaddith Role)</option>
                      <option value="admin">مالك المنصة (Admin Role)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-black text-slate-700">الشركة الأم الافتراضية للتحديث</Label>
                    <select 
                      value={editingUser.parentProviderId || 'hawk'}
                      onChange={(e) => setEditingUser({ ...editingUser, parentProviderId: e.target.value })}
                      className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {providers.filter(p => p.type === 'parent').map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Subscription & Account Activation Settings */}
                <div className="border border-slate-100 bg-[#F9FAFB] rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-sm font-black text-slate-800 flex items-center gap-2">
                      <Calendar className="text-blue-600" size={18} />
                      تنظيم وتفعيل اشتراك الحساب (التحكم بالوصول)
                    </span>
                    
                    {/* Presets Row */}
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          const start = new Date().toISOString().split('T')[0];
                          const end = new Date();
                          end.setDate(end.getDate() + 3);
                          setEditingUser({
                            ...editingUser,
                            subscription: {
                              ...(editingUser.subscription || { notes: '' }),
                              status: 'trial',
                              subscribedAt: start,
                              expiresAt: end.toISOString().split('T')[0],
                              trialDays: 3,
                              pricePaid: 0
                            }
                          });
                          toast.success('تم تحديد فترة تجريبية: 3 أيام');
                        }}
                        className="px-2 py-1 text-[10px] font-black bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg transition-colors"
                      >
                        🎁 3 أيام تجربة
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const start = new Date().toISOString().split('T')[0];
                          const end = new Date();
                          end.setDate(end.getDate() + 7);
                          setEditingUser({
                            ...editingUser,
                            subscription: {
                              ...(editingUser.subscription || { notes: '' }),
                              status: 'trial',
                              subscribedAt: start,
                              expiresAt: end.toISOString().split('T')[0],
                              trialDays: 7,
                              pricePaid: 0
                            }
                          });
                          toast.success('تم تحديد فترة تجريبية: 7 أيام');
                        }}
                        className="px-2 py-1 text-[10px] font-black bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg transition-colors"
                      >
                        🎁 7 أيام تجربة
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const start = new Date().toISOString().split('T')[0];
                          const end = new Date();
                          end.setMonth(end.getMonth() + 1);
                          setEditingUser({
                            ...editingUser,
                            subscription: {
                              ...(editingUser.subscription || { notes: '' }),
                              status: 'active',
                              subscribedAt: start,
                              expiresAt: end.toISOString().split('T')[0],
                              trialDays: 0,
                              pricePaid: 25000
                            }
                          });
                          toast.success('تم تجديد الاشتراك لمدة شهر (30 يوم)');
                        }}
                        className="px-2 py-1 text-[10px] font-black bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg transition-colors"
                      >
                        ⚡ تجديد شهر
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const start = new Date().toISOString().split('T')[0];
                          const end = new Date();
                          end.setMonth(end.getMonth() + 3);
                          setEditingUser({
                            ...editingUser,
                            subscription: {
                              ...(editingUser.subscription || { notes: '' }),
                              status: 'active',
                              subscribedAt: start,
                              expiresAt: end.toISOString().split('T')[0],
                              trialDays: 0,
                              pricePaid: 70000
                            }
                          });
                          toast.success('تم تجديد الاشتراك لمدة 3 أشهر');
                        }}
                        className="px-2 py-1 text-[10px] font-black bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg transition-colors"
                      >
                        ⚡ تجديد 3 أشهر
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-black text-slate-700">حالة اشتراك الحساب</Label>
                      <select 
                        value={editingUser.subscription?.status || 'active'}
                        onChange={(e) => setEditingUser({
                          ...editingUser,
                          subscription: {
                            ...(editingUser.subscription || { expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], notes: '' }),
                            status: e.target.value as any
                          }
                        })}
                        className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="active">نشط (Active)</option>
                        <option value="expired">منتهي الصلاحية (Expired)</option>
                        <option value="trial">تجريبي (Trial)</option>
                        <option value="canceled">ملغي الحساب (Canceled)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-black text-slate-700">تاريخ بدء تفعيل الدورة الإشتراكية</Label>
                      <Input 
                        type="date"
                        value={editingUser.subscription?.subscribedAt || ''}
                        onChange={(e) => setEditingUser({
                          ...editingUser,
                          subscription: {
                            ...(editingUser.subscription || { status: 'active', notes: '' }),
                            subscribedAt: e.target.value
                          }
                        })}
                        className="rounded-xl border-slate-200 h-10 bg-white text-xs font-bold"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-black text-slate-700">تاريخ انتهاء الفتح للصلاحية</Label>
                      <Input 
                        type="date"
                        value={editingUser.subscription?.expiresAt || ''}
                        onChange={(e) => setEditingUser({
                          ...editingUser,
                          subscription: {
                            ...(editingUser.subscription || { status: 'active', notes: '' }),
                            expiresAt: e.target.value
                          }
                        })}
                        className="rounded-xl border-slate-200 h-10 bg-white text-xs font-bold"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-black text-slate-700">المبلغ المدفوع للاشتراك (بالدينار العراقي أو USD)</Label>
                      <Input 
                        type="number"
                        placeholder="مثال: 25000"
                        value={editingUser.subscription?.pricePaid || 0}
                        onChange={(e) => setEditingUser({
                          ...editingUser,
                          subscription: {
                            ...(editingUser.subscription || { status: 'active', notes: '' }),
                            pricePaid: Number(e.target.value)
                          }
                        })}
                        className="rounded-xl border-slate-200 h-10 bg-white text-xs font-bold"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-black text-slate-700">ملاحظات تذكرة الاشتراك (تعليمات الإدارة)</Label>
                    <Input 
                      placeholder="أمثلة: تجديد سنوي، حساب تجريبي، عمولة تصفية"
                      value={editingUser.subscription?.notes || ''}
                      onChange={(e) => setEditingUser({
                        ...editingUser,
                        subscription: {
                          ...(editingUser.subscription || { status: 'active', expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] }),
                          notes: e.target.value
                        }
                      })}
                      className="rounded-xl border-slate-200 h-10 bg-white text-xs"
                    />
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-6 space-y-4">
                  {(() => {
                    const selectedParentName = providers.find(p => p.id === (editingUser.parentProviderId || 'hawk'))?.name || 'الشركة الأم';
                    return (
                      <>
                        <span className="text-sm font-black text-slate-800 flex items-center gap-2">
                          <ShieldCheck className="text-indigo-600" size={18} />
                          حساب تسجيل دخول الشركة الأم ({selectedParentName}) للمحدث
                        </span>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-indigo-50/40 border border-indigo-100 rounded-2xl p-4">
                          <div className="space-y-1">
                            <Label className="text-[11px] font-bold text-slate-600">اسم المستخدم ({selectedParentName})</Label>
                            <Input 
                              placeholder={`اسم مستخدم ${selectedParentName}`}
                              value={editingUser.parentCredentials?.username || ''}
                              onChange={(e) => setEditingUser({
                                ...editingUser,
                                parentCredentials: {
                                  username: e.target.value,
                                  password: editingUser.parentCredentials?.password || ''
                                }
                              })}
                              className="rounded-xl border-slate-200 h-10 bg-white"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px] font-bold text-slate-600">كلمة السر ({selectedParentName})</Label>
                            <Input 
                              placeholder={`كلمة مرور ${selectedParentName}`}
                              value={editingUser.parentCredentials?.password || ''}
                              onChange={(e) => setEditingUser({
                                ...editingUser,
                                parentCredentials: {
                                  username: editingUser.parentCredentials?.username || '',
                                  password: e.target.value
                                }
                              })}
                              className="rounded-xl border-slate-200 h-10 bg-white"
                            />
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* Assigned Shipping Source and shipping credentials */}
                <div className="border-t border-slate-100 pt-6 space-y-4">
                  <span className="text-sm font-black text-slate-800 flex items-center gap-2">
                    <Building2 className="text-emerald-600" size={18} />
                    ربط شرايح ومصادر جلب البيانات (أمان تفعيل المصادر)
                  </span>

                  <div className="space-y-4">
                    {providers.filter(p => p.type === 'source').map(p => {
                      const isChecked = editingUser.sourceProviderIds?.includes(p.id) || false;
                      const creds = editingUser.sourceCredentials?.[p.id] || { username: '', password: '' };

                      return (
                        <div key={p.id} className="border border-slate-100 bg-slate-50/60 p-4 rounded-3xl space-y-3">
                          <div className="flex items-center gap-3">
                            <Checkbox 
                              checked={isChecked}
                              onCheckedChange={(checked) => {
                                const activeSources = [...(editingUser.sourceProviderIds || [])];
                                if (checked) {
                                  if (!activeSources.includes(p.id)) activeSources.push(p.id);
                                } else {
                                  const index = activeSources.indexOf(p.id);
                                  if (index > -1) activeSources.splice(index, 1);
                                }
                                setEditingUser({ ...editingUser, sourceProviderIds: activeSources });
                              }}
                            />
                            <span className="text-xs font-black text-slate-800 flex items-center gap-2">{p.name}</span>
                            <Badge className={isChecked ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-500'}>
                              {isChecked ? 'نشط وقابل للاستعلام' : 'معطل'}
                            </Badge>
                          </div>

                          {isChecked && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white border border-slate-100 rounded-2xl p-3.5">
                              <div className="space-y-1">
                                <Label className="text-[10px] font-bold text-slate-500">اسم مستخدم الحساب لموقع {p.name}</Label>
                                <Input 
                                  placeholder={`User لـ ${p.name}`}
                                  value={creds.username}
                                  onChange={(e) => {
                                    const sourceCreds = { ...(editingUser.sourceCredentials || {}) };
                                    sourceCreds[p.id] = {
                                      username: e.target.value,
                                      password: creds.password
                                    };
                                    setEditingUser({ ...editingUser, sourceCredentials: sourceCreds });
                                  }}
                                  className="rounded-xl border-slate-200 h-9"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px] font-bold text-slate-500">كلمة مرور الحساب لموقع {p.name}</Label>
                                <Input 
                                  placeholder={`Pass لـ ${p.name}`}
                                  value={creds.password}
                                  onChange={(e) => {
                                    const sourceCreds = { ...(editingUser.sourceCredentials || {}) };
                                    sourceCreds[p.id] = {
                                      username: creds.username,
                                      password: e.target.value
                                    };
                                    setEditingUser({ ...editingUser, sourceCredentials: sourceCreds });
                                  }}
                                  className="rounded-xl border-slate-200 h-9"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </ScrollArea>

              <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-4 shrink-0 justify-end">
                <Button 
                  type="button"
                  variant="ghost" 
                  onClick={() => {
                    setIsUserModalOpen(false);
                    setEditingUser(null);
                  }} 
                  className="rounded-xl font-bold h-11 px-6 text-slate-500 hover:bg-slate-100/60"
                >
                  إلغاء
                </Button>
                <Button 
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-10 h-11 font-black shadow-lg shadow-blue-500/10 gap-2"
                >
                  <Save size={16} />
                  حفظ حساب المحدث
                </Button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>

      {/* --- MODAL 2: CREATE / UPDATE SHIPPING PROVIDER TEMPLATE --- */}
      <AnimatePresence>
        {isProviderModalOpen && editingProvider && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsProviderModalOpen(false);
                setEditingProvider(null);
              }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            
            <motion.form 
              onSubmit={handleSaveProvider}
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="bg-slate-900 px-6 py-5 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 rounded-xl">
                    <Database size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black">{editingProvider.name ? `قالب شركة شحن: ${editingProvider.name}` : 'إضافة قالب شركة شحن جديد'}</h3>
                    <p className="text-slate-400 text-[10px] font-bold mt-0.5">ضبط كود الأتمتة وجلب البيانات ومعايير Cheerio Selectors</p>
                  </div>
                </div>
                <Button 
                  type="button"
                  variant="ghost" 
                  size="icon" 
                  onClick={() => {
                    setIsProviderModalOpen(false);
                    setEditingProvider(null);
                  }} 
                  className="rounded-full hover:bg-white/10 text-slate-400 hover:text-white"
                >
                  <X size={20} />
                </Button>
              </div>

              <ScrollArea className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 bg-[#FCFDFE]">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-black text-slate-700">معرّف الشركة الرقمي الثابت (ID - Unique Key)</Label>
                    <Input 
                      required
                      placeholder="e.g. jood, shaya, hawk"
                      disabled={!!editingProvider.name} // Lock ID on update to prevent mismatch errors
                      value={editingProvider.id || ''}
                      onChange={(e) => setEditingProvider({ ...editingProvider, id: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '') })}
                      className="rounded-xl border-slate-200 focus:ring-blue-500 text-sm font-semibold h-11"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-black text-slate-700">اسم شركة الشحن</Label>
                    <Input 
                      required
                      placeholder="مثل: الشركة الموحدة، شركة الجود..."
                      value={editingProvider.name || ''}
                      onChange={(e) => setEditingProvider({ ...editingProvider, name: e.target.value })}
                      className="rounded-xl border-slate-200 focus:ring-blue-500 text-sm font-semibold h-11"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-black text-slate-700">الصلاحية والتصنيف لشركات المنصة</Label>
                    <select 
                      value={editingProvider.type || 'source'}
                      onChange={(e) => setEditingProvider({ ...editingProvider, type: e.target.value as 'parent' | 'source' })}
                      className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="source">شركة شحن مصدر (مثل الجود / الشائع)</option>
                      <option value="parent">الشركة الأم الموحدة الرئيسية</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-black text-slate-700">كلمة التحقق من نجاح الدخول في Html (Login Check Keyword)</Label>
                    <Input 
                      required
                      placeholder="الكلمة الموجودة بداخل Html بعد النجاح e.g. logout"
                      value={editingProvider.loginCheck || ''}
                      onChange={(e) => setEditingProvider({ ...editingProvider, loginCheck: e.target.value })}
                      className="rounded-xl border-slate-200 text-sm font-semibold h-11"
                    />
                  </div>
                </div>

                <div className="space-y-1.5 border-t border-slate-100 pt-5">
                  <Label className="text-xs font-black text-slate-700">رابط تسجيل الدخول (Login Endpoint Url)</Label>
                  <Input 
                    required
                    dir="ltr"
                    placeholder="https://example.com/login_db.php"
                    value={editingProvider.loginUrl || ''}
                    onChange={(e) => setEditingProvider({ ...editingProvider, loginUrl: e.target.value })}
                    className="rounded-xl border-slate-200 text-left text-xs font-mono h-11"
                  />
                </div>

                <div className="space-y-1.5 pt-1">
                  <Label className="text-xs font-black text-slate-700">رابط جلب الداتا والطلبات (Search/Query Endpoint Url)</Label>
                  <Input 
                    required
                    dir="ltr"
                    placeholder="https://example.com/search_wasl.php"
                    value={editingProvider.searchUrl || ''}
                    onChange={(e) => setEditingProvider({ ...editingProvider, searchUrl: e.target.value })}
                    className="rounded-xl border-slate-200 text-left text-xs font-mono h-11"
                  />
                </div>

                {/* Technical scraping parameters */}
                <div className="border-t border-slate-100 pt-6 space-y-4">
                  <span className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <TableProperties size={16} />
                    محددات حقول صفحات الجيم والبحث (Html Scraping Selectors)
                  </span>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 rounded-2xl p-4">
                    <div className="space-y-1">
                      <Label className="text-[11px] font-bold text-slate-600">كود جلب التحديد (Row Selector)</Label>
                      <Input 
                        placeholder="e.g. tr[id]"
                        value={editingProvider.rowSelector || 'tr[id]'}
                        onChange={(e) => setEditingProvider({ ...editingProvider, rowSelector: e.target.value })}
                        className="rounded-xl border-slate-200 h-10 bg-white font-mono text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px] font-bold text-slate-600">كود أزرار الخيار (Checkbox Selector)</Label>
                      <Input 
                        placeholder="e.g. input[type='checkbox']"
                        value={editingProvider.checkboxSelector || ''}
                        onChange={(e) => setEditingProvider({ ...editingProvider, checkboxSelector: e.target.value })}
                        className="rounded-xl border-slate-200 h-10 bg-white font-mono text-xs"
                      />
                    </div>
                  </div>

                  {editingProvider.type === 'parent' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 rounded-2xl p-4 pt-1">
                      <div className="space-y-1">
                        <Label className="text-[11px] font-bold text-slate-600">مؤشر خلية رقم الوصل (Zero-based Index)</Label>
                        <Input 
                          type="number"
                          value={editingProvider.idWaslIndex !== undefined ? editingProvider.idWaslIndex : 1}
                          onChange={(e) => setEditingProvider({ ...editingProvider, idWaslIndex: parseInt(e.target.value) || 0 })}
                          className="rounded-xl border-slate-200 h-10 bg-white"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[11px] font-bold text-slate-600">مؤشر خلية كود التسلسل (Zero-based Index)</Label>
                        <Input 
                          type="number"
                          value={editingProvider.sequenceIndex !== undefined ? editingProvider.sequenceIndex : 0}
                          onChange={(e) => setEditingProvider({ ...editingProvider, sequenceIndex: parseInt(e.target.value) || 0 })}
                          className="rounded-xl border-slate-200 h-10 bg-white"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-4 shrink-0 justify-end">
                <Button 
                  type="button"
                  variant="ghost" 
                  onClick={() => {
                    setIsProviderModalOpen(false);
                    setEditingProvider(null);
                  }} 
                  className="rounded-xl font-bold h-11 px-6 text-slate-500 hover:bg-slate-100/60"
                >
                  إلغاء
                </Button>
                <Button 
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-10 h-11 font-black shadow-lg shadow-emerald-500/10 gap-2"
                >
                  <Save size={16} />
                  حفظ قالب الشركة لشاحن الأتمتة
                </Button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>

      {/* --- MODAL 3: ACTIVITY LOG DETAILS --- */}
      <AnimatePresence>
        {selectedLogForModal && (() => {
          const parsed = parseLogDetails(selectedLogForModal.action || '', selectedLogForModal.details || '');
          let dayPart = '';
          let monthPart = '';
          let timePart = '';
          try {
            const d = new Date(selectedLogForModal.timestamp);
            dayPart = d.toLocaleDateString('ar-EG', { day: 'numeric' });
            monthPart = d.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });
            timePart = d.toLocaleTimeString('ar-EG', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            });
          } catch (_) {}

          let actionBadgeStyle = "bg-blue-50 text-blue-700 border-blue-200";
          if (selectedLogForModal.action?.includes('تسجيل الدخول')) {
            actionBadgeStyle = "bg-emerald-50 text-emerald-700 border-emerald-200";
          } else if (selectedLogForModal.action?.includes('تسجيل الخروج')) {
            actionBadgeStyle = "bg-slate-150 text-slate-700 border-slate-250";
          } else if (selectedLogForModal.action?.includes('خطأ') || selectedLogForModal.action?.includes('فشل')) {
            actionBadgeStyle = "bg-red-50 text-red-700 border-red-200";
          } else if (selectedLogForModal.action?.includes('مزامنة')) {
            actionBadgeStyle = "bg-amber-50 text-amber-700 border-amber-200";
          }

          return (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedLogForModal(null)}
                className="absolute inset-0 bg-slate-950/65 backdrop-blur-md"
              />
              
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 25 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 25 }}
                className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
              >
                {/* Header */}
                <div className="bg-slate-900 px-6 py-5 text-white flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-500/15 text-indigo-400 border border-indigo-500/25 rounded-2xl">
                      <Clock size={20} />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-right text-white leading-none">تفاصيل الحركة المسجلة</h3>
                      <p className="text-slate-400 text-[10px] font-bold mt-1 text-right leading-none">سجل التتبع والمراقبة الكامل لتحركات مستخدمي النظام</p>
                    </div>
                  </div>
                  <Button 
                    type="button"
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setSelectedLogForModal(null)} 
                    className="rounded-full hover:bg-white/10 text-slate-400 hover:text-white"
                  >
                    <X size={20} />
                  </Button>
                </div>

                {/* Body Content */}
                <ScrollArea className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 bg-[#FCFDFE] text-right" dir="rtl">
                  {/* Top Stats Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* User Card */}
                    <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4 flex items-center gap-3">
                      <div className="p-2 bg-blue-500/10 text-blue-600 rounded-xl">
                        <Users size={16} />
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-black text-slate-400 block mb-0.5">المستخدم المنفذ</span>
                        <span className="text-sm font-black text-slate-800">{selectedLogForModal.username}</span>
                      </div>
                    </div>

                    {/* Action Type Card */}
                    <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4 flex items-center gap-3">
                      <div className="p-2 bg-indigo-500/10 text-indigo-600 rounded-xl">
                        <Activity size={16} />
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-black text-slate-400 block mb-0.5">نوع العملية</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-black border ${actionBadgeStyle}`}>
                          {selectedLogForModal.action}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Date & Time Highlight */}
                  <div className="bg-indigo-50/40 border border-indigo-100 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-indigo-500/15 text-indigo-700 rounded-xl">
                        <Calendar size={18} />
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-black text-indigo-500 block">تاريخ الفعالية</span>
                        <span className="text-xs sm:text-sm font-black text-indigo-950 font-sans">{dayPart} {monthPart}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-indigo-500/15 text-indigo-700 rounded-xl">
                        <Clock size={18} />
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-black text-slate-500 block">وقت وتوقيت الفعالية</span>
                        <span className="text-xs sm:text-sm font-black text-slate-700 font-sans">{timePart}</span>
                      </div>
                    </div>
                  </div>

                  {/* Structural Render based on parsed details */}
                  <div className="space-y-5">
                    <span className="text-xs font-black text-slate-500 block border-b border-slate-100 pb-2">تفاصيل وبيان النشاط</span>

                    {/* --- NEW 1: INTEGRATED FETCH AND MATCH --- */}
                    {parsed.type === 'fetch_and_match' && (
                      <div className="space-y-4 text-right">
                        {/* Highlights Row */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="bg-indigo-50 border border-indigo-150 rounded-2xl p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-2.5 bg-indigo-500/10 text-indigo-700 rounded-xl">
                                <CheckCircle2 size={18} />
                              </div>
                              <div className="text-right">
                                <span className="text-[10px] font-black text-indigo-500 block mb-0.5">عدد المطابقات المقترنة</span>
                                <span className="text-lg font-black text-indigo-950">{parsed.matchedCount} طلب</span>
                              </div>
                            </div>
                          </div>

                          <div className="bg-amber-50 border border-amber-150 rounded-2xl p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-2.5 bg-amber-500/10 text-amber-700 rounded-xl">
                                <Clock size={18} />
                              </div>
                              <div className="text-right">
                                <span className="text-[10px] font-black text-amber-600 block mb-0.5">زمن جلب ومطابقة البيانات</span>
                                <span className="text-lg font-black text-amber-950 font-sans">{parsed.duration} ثانية</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Split Source/Parent Data Card */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* Parent Company Side */}
                          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-3">
                            <div className="flex items-center gap-2 border-b border-slate-150 pb-2 mb-2">
                              <Building2 className="text-blue-500 shrink-0" size={18} />
                              <span className="text-xs font-black text-slate-800">بيانات الشركة الأم ({parsed.parentName})</span>
                            </div>
                            <div className="text-xs space-y-2">
                              <div className="flex justify-between">
                                <span className="text-slate-500">الطلبات المستخرجة:</span>
                                <span className="font-extrabold text-slate-800">{parsed.parentCount} طلب</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-500">كود المطابقة:</span>
                                <span className="font-extrabold text-slate-800 font-mono">{parsed.statusCode}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-500">كلمة الفرز:</span>
                                <span className="font-extrabold text-slate-800">{parsed.keyword}</span>
                              </div>
                            </div>
                          </div>

                          {/* Source Company Side */}
                          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-3">
                            <div className="flex items-center gap-2 border-b border-slate-150 pb-2 mb-2">
                              <Building2 className="text-indigo-500 shrink-0" size={18} />
                              <span className="text-xs font-black text-slate-800">بيانات شركة شحن المصدر ({parsed.sourceName})</span>
                            </div>
                            <div className="text-xs space-y-2">
                              <div className="flex justify-between">
                                <span className="text-slate-500">الطلبات المسترجعة:</span>
                                <span className="font-extrabold text-slate-800">{parsed.sourceCount} طلب</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-500">التواريخ المحددة:</span>
                                <span className="font-extrabold text-slate-800 text-[10px] break-all">{parsed.dates.join(', ')}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* --- NEW 2: DETAILED UPDATE WITH STATS --- */}
                    {parsed.type === 'update_with_stats' && (
                      <div className="space-y-4 text-right">
                        {/* Top Performance Header Row */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="bg-emerald-50 border border-emerald-150 rounded-2xl p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-2.5 bg-emerald-500/10 text-emerald-700 rounded-xl">
                                <CheckCircle2 size={18} />
                              </div>
                              <div className="text-right">
                                <span className="text-[10px] font-black text-emerald-600 block mb-0.5">الحركات الناجحة بالكامل</span>
                                <span className="text-lg font-black text-emerald-950">{parsed.successCount} حركه</span>
                              </div>
                            </div>
                          </div>

                          <div className="bg-indigo-50 border border-indigo-150 rounded-2xl p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-2.5 bg-indigo-500/10 text-indigo-700 rounded-xl">
                                <Clock size={18} />
                              </div>
                              <div className="text-right">
                                <span className="text-[10px] font-black text-indigo-600 block mb-0.5">مدة عملية التحديث الكاملة</span>
                                <span className="text-lg font-black text-indigo-950 font-sans">{parsed.duration} ثانية</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Choice selections block */}
                        <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4 space-y-2">
                          <span className="text-xs font-black text-slate-500 block">خيارات التحديث النشطة التي تم تحديدها:</span>
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {parsed.selectedOptions.map((opt, oIdx) => (
                              <span key={oIdx} className="bg-indigo-100 text-indigo-800 border border-indigo-200 text-[10px] font-extrabold px-2.5 py-1 rounded-lg">
                                {opt}
                              </span>
                            ))}
                            {parsed.selectedOptions.length === 0 && (
                              <span className="text-slate-400 text-xs">لم يتم اختيار أي معيار مسبق</span>
                            )}
                          </div>
                        </div>

                        {/* Breakdown status grids (delivered, delay, rejects) */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {/* Delivered Box */}
                          <div className="bg-[#EDFDF5] border border-[#D5F9E6] rounded-2xl p-4 text-center">
                            <span className="text-[#10B981] text-base mb-1 block">🟢</span>
                            <span className="text-[10px] font-bold text-slate-400 block mb-0.5">تم التسليم (2)</span>
                            <span className="text-base font-black text-emerald-900">{parsed.deliveredCount} طلب</span>
                          </div>

                          {/* Deferred Box */}
                          <div className="bg-[#FFF8EB] border border-[#FFE8CC] rounded-2xl p-4 text-center">
                            <span className="text-[#F59E0B] text-base mb-1 block">🟠</span>
                            <span className="text-[10px] font-bold text-slate-400 block mb-0.5">المؤجل (3)</span>
                            <span className="text-base font-black text-amber-900">{parsed.delayedCount} طلب</span>
                          </div>

                          {/* Rejected Box */}
                          <div className="bg-[#FFF5F5] border border-[#FEE2E2] rounded-2xl p-4 text-center">
                            <span className="text-[#EF4444] text-base mb-1 block">🔴</span>
                            <span className="text-[10px] font-bold text-slate-400 block mb-0.5">الرفض (4)</span>
                            <span className="text-base font-black text-red-900">{parsed.rejectedCount} طلب</span>
                          </div>

                          {/* Notes/Change Notes Box */}
                          <div className="bg-[#F0F5FE] border border-[#DBE7FE] rounded-2xl p-4 text-center">
                            <span className="text-[#3B82F6] text-base mb-1 block">📝</span>
                            <span className="text-[10px] font-bold text-slate-400 block mb-0.5">الملاحظات</span>
                            <span className="text-base font-black text-blue-900">{parsed.notesCount} تحديث</span>
                          </div>
                        </div>

                        {/* Failures line if any */}
                        {parsed.failCount > 0 && (
                          <div className="flex items-center gap-2 bg-red-50 border border-red-100 p-3 rounded-xl text-xs text-red-800">
                            <span>🛑</span>
                            <span className="font-extrabold font-sans">توجد عدد {parsed.failCount} حركات لم تقبل التحديث بنجاح بسبب قيود الشبكة أو المواقع الخارجية.</span>
                          </div>
                        )}
                      </div>
                    )}

                    {parsed.type === 'login' && (
                      <div className="flex items-center gap-3 bg-emerald-50/60 border border-emerald-100 rounded-2xl p-4 text-right">
                        <CheckCircle2 className="text-emerald-500 shrink-0 select-none" size={24} />
                        <div>
                          <p className="text-emerald-900 font-extrabold text-sm mb-1">تسجيل دخول ناجح</p>
                          <p className="text-slate-600 text-xs">تمت مصادقة وتدقيق الحساب والولوج بنجاح وجاهز لاستعمال أدوات الأتمتة والفرز.</p>
                        </div>
                      </div>
                    )}

                    {parsed.type === 'logout' && (
                      <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-2xl p-4 text-right">
                        <LogOut className="text-slate-500 shrink-0 select-none" size={24} />
                        <div>
                          <p className="text-slate-800 font-extrabold text-sm mb-1">تسجيل خروج آمن</p>
                          <p className="text-slate-600 text-xs">تم تسجيل الخروج وتدمير جلسة العمل بنجاح لتأمين سلامة النظام ودون أثر.</p>
                        </div>
                      </div>
                    )}

                    {parsed.type === 'fetch_source' && (
                      <div className="space-y-4 text-right">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-150">
                            <span className="text-[10px] font-black text-slate-400 block mb-1">شركة الشحن المستهدفة</span>
                            <span className="text-xs font-black text-slate-800 flex items-center gap-2">
                              <Building2 className="text-indigo-500" size={16} />
                              {parsed.company || 'غير محدد'}
                            </span>
                          </div>
                          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-150">
                            <span className="text-[10px] font-black text-slate-400 block mb-1">عدد طلبات التفريغ الإجمالي</span>
                            <span className="text-xs font-black text-indigo-700 flex items-center gap-2">
                              <Hash className="text-indigo-500" size={16} />
                              {parsed.count} شحنة
                            </span>
                          </div>
                        </div>

                        {parsed.dates && parsed.dates.length > 0 && (
                          <div className="bg-indigo-50/10 rounded-2xl p-5 border border-indigo-100/50 text-right">
                            <span className="text-xs font-black text-slate-800 block mb-3 flex items-center gap-2">
                              <Calendar size={15} className="text-indigo-500" />
                              التواريخ المشمولة في طلب جلب وتفريغ البيانات ({parsed.dates.length} أيام):
                            </span>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                              {parsed.dates.map((date, dIdx) => (
                                <span key={dIdx} className="bg-white border border-slate-200 text-slate-800 font-mono text-xs font-extrabold px-3 py-2 rounded-xl text-center shadow-xs hover:border-indigo-200 transition-colors">
                                  {date}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {parsed.type === 'fetch_parent' && (
                      <div className="space-y-4 text-right">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-150">
                            <span className="text-[10px] font-black text-slate-400 block mb-1">الطلبات المسترجعة</span>
                            <span className="text-xs font-black text-slate-800 flex items-center gap-2">
                              <Hash className="text-blue-500" size={16} />
                              {parsed.count} طلب
                            </span>
                          </div>
                          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-150">
                            <span className="text-[10px] font-black text-slate-400 block mb-1">رمز الحالة للمطابقة</span>
                            <span className="text-xs font-black text-emerald-700 flex items-center gap-2">
                              <Filter className="text-emerald-500" size={16} />
                              {parsed.statusCode || 'غير محدد'}
                            </span>
                          </div>
                          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-150">
                            <span className="text-[10px] font-black text-slate-400 block mb-1">كلمة الفرز المحددة</span>
                            <span className="text-xs font-black text-slate-800 flex items-center gap-2">
                              <Search className="text-slate-400" size={16} />
                              {parsed.keyword || 'بدون تصفية'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {parsed.type === 'sync' && (
                      <div className="space-y-4 text-right">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="bg-emerald-50/40 rounded-2xl p-4 border border-emerald-150 flex items-center gap-3">
                            <CheckCircle2 className="text-emerald-500 shrink-0" size={20} />
                            <div>
                              <span className="text-[10px] font-black text-emerald-600 block mb-0.5">العمليات الناجحة</span>
                              <span className="text-xs font-black text-[#D97706] bg-[#FFFBEB] border border-[#FDE68A] hover:bg-[#FEF3C7] shadow-xs px-2.5 py-1.5 rounded-xl cursor-default">{parsed.successCount} عملية بنجاح</span>
                            </div>
                          </div>
                          <div className={`rounded-xl p-4 border flex items-center gap-3 ${
                            parsed.failCount > 0 
                            ? 'bg-red-50/40 border-red-150' 
                            : 'bg-slate-50/40 border-slate-150'
                          }`}>
                            <XCircle className={parsed.failCount > 0 ? "text-red-500 shrink-0" : "text-slate-400 shrink-0"} size={20} />
                            <div>
                              <span className="text-[10px] font-black text-slate-500 block mb-0.5">العمليات الفاشلة / المتعذرة</span>
                              <span className={`text-xs font-black ${parsed.failCount > 0 ? "text-red-700" : "text-slate-600"}`}>
                                {parsed.failCount} عملية
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Raw Details text block inside elegant container */}
                    <div className="bg-slate-950 rounded-2xl p-5 border border-slate-800 shadow-inner text-right">
                      <span className="text-[10px] font-black text-slate-500 block mb-2 font-mono">بيان الحركة الخام (RAW DETAILS)</span>
                      <p className="text-xs text-slate-300 font-mono whitespace-pre-line tracking-wide leading-relaxed selection:bg-slate-800">
                        {selectedLogForModal.details}
                      </p>
                    </div>
                  </div>
                </ScrollArea>

                <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-4 shrink-0 justify-between items-center" dir="rtl">
                  <span className="text-[10px] font-bold text-slate-400 font-mono">
                    LOG_ID: {selectedLogForModal.id || 'قيد الذاكرة العشوائية'}
                  </span>
                  <Button 
                    type="button"
                    onClick={() => setSelectedLogForModal(null)} 
                    className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl px-8 h-10 font-bold transition-all"
                  >
                    إغلاق النافذة
                  </Button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* --- MODAL 4: DYNAMIC SHORTCUT CUSTOMIZER (FOR ADMINS/OWNER) --- */}
      <AnimatePresence>
        {isShortcutsEditorOpen && shortcutsEditingUser && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 font-sans" dir="rtl">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!isShortcutSubFormOpen) {
                  setIsShortcutsEditorOpen(false);
                  setShortcutsEditingUser(null);
                }
              }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="bg-slate-900 px-6 py-5 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-amber-500/15 text-amber-400 border border-amber-500/25 rounded-xl">
                    <Sparkles size={20} />
                  </div>
                  <div className="text-right">
                    <h3 className="text-lg font-black">تخصيص اختصارات المستخدم: {shortcutsEditingUser.username}</h3>
                    <p className="text-slate-400 text-[10px] font-bold mt-0.5">إضافة، تعديل، حذف، أو تعيين الاختصارات للوحة تحكم المحدث الخاصة به</p>
                  </div>
                </div>
                <Button 
                  type="button"
                  variant="ghost" 
                  size="icon" 
                  onClick={() => {
                    setIsShortcutsEditorOpen(false);
                    setShortcutsEditingUser(null);
                  }} 
                  className="rounded-full hover:bg-white/10 text-slate-400 hover:text-white"
                >
                  <X size={20} />
                </Button>
              </div>

              {/* Main Content Area */}
              <div className="flex-1 overflow-hidden flex flex-col md:flex-row min-h-[400px]">
                
                {/* List of current shortcuts */}
                <div className={`flex-1 flex flex-col p-6 bg-slate-50 border-l border-slate-100 overflow-y-auto ${isShortcutSubFormOpen ? 'hidden md:flex' : 'flex'}`}>
                  <div className="flex items-center justify-between mb-4 shrink-0">
                    <span className="text-xs font-black text-slate-600">القائمة النشطة الآن ({userShortcuts.length})</span>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        onClick={handleLoadDefaultShortcuts}
                        variant="outline"
                        size="sm"
                        className="h-8 text-[11px] font-black hover:bg-slate-100 text-slate-700 rounded-lg gap-1 border-dashed"
                      >
                        تحميل النماذج الافتراضية
                      </Button>
                      <Button
                        type="button"
                        onClick={() => handleOpenShortcutSubForm()}
                        className="bg-amber-600 hover:bg-amber-700 text-white text-[11px] h-8 font-black rounded-lg gap-1 px-3"
                      >
                        <Plus size={12} />
                        إضافة اختصار جديد
                      </Button>
                    </div>
                  </div>

                  <ScrollArea className="flex-1 bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
                    {userShortcuts.length === 0 ? (
                      <div className="text-center py-20 italic text-slate-400 text-xs">
                        لا يوجد أي اختصار معرف لهذا المحدث. اضغط على أزرار التحكم بالأعلى للتخصيص.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {userShortcuts.map((shortcut) => {
                          let colorStyle = "bg-blue-50 text-blue-700 border-blue-200";
                          if (shortcut.color === 'rose') colorStyle = "bg-rose-50 text-rose-700 border-rose-200";
                          if (shortcut.color === 'amber') colorStyle = "bg-amber-50 text-amber-700 border-amber-200";
                          if (shortcut.color === 'indigo') colorStyle = "bg-indigo-50 text-indigo-700 border-indigo-200";
                          if (shortcut.color === 'emerald') colorStyle = "bg-emerald-50 text-emerald-700 border-emerald-200";

                          return (
                            <div 
                              key={shortcut.id}
                              className="p-3 bg-slate-50 hover:bg-slate-100/60 transition-colors border border-slate-200/60 rounded-xl flex items-center justify-between gap-4"
                            >
                              <div className="flex items-center gap-3">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-black border ${colorStyle}`}>
                                  {shortcut.name}
                                </span>
                                <div className="text-right">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-slate-400">الكلمة المفتاحية:</span>
                                    <span className="text-xs font-black text-slate-700">{shortcut.settings.keyword || 'غير محدد'}</span>
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[10px] font-bold text-slate-400">حالة القيد بالفلاتر:</span>
                                    <span className="text-[10px] font-black text-indigo-600">
                                      {shortcut.settings.statusCode === '10' ? 'جاهز للتوصيل' : shortcut.settings.statusCode === '3' ? 'المؤجل' : 'حالة أخرى'}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleOpenShortcutSubForm(shortcut)}
                                  className="h-7 w-7 text-blue-600 hover:bg-blue-50 rounded-lg"
                                  title="تعديل هذا الاختصار"
                                >
                                  <Edit size={12} />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteUserShortcut(shortcut.id)}
                                  className="h-7 w-7 text-red-500 hover:bg-red-50 rounded-lg"
                                  title="حذف هذا الاختصار"
                                >
                                  <Trash2 size={12} />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </ScrollArea>
                </div>

                {/* Sub-form to add/edit the active shortcut */}
                {isShortcutSubFormOpen && editingUserShortcut && (
                  <div className="w-full md:w-80 p-6 bg-white flex flex-col justify-between border-r border-slate-100 overflow-y-auto">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <span className="text-xs font-black text-slate-700">
                          {editingUserShortcut.id ? 'تعديل الاختصار المحدد' : 'إضافة اختصار جديد'}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setIsShortcutSubFormOpen(false);
                            setEditingUserShortcut(null);
                          }}
                          className="h-6 w-6 text-slate-400 hover:bg-slate-100 rounded-full"
                        >
                          <X size={14} />
                        </Button>
                      </div>

                      {/* Name input */}
                      <div className="space-y-1">
                        <Label className="text-[11px] font-black text-slate-600">اسم الزر اللوحي (الاختصار)</Label>
                        <Input
                          required
                          value={editingUserShortcut.name}
                          onChange={(e) => setEditingUserShortcut({ ...editingUserShortcut, name: e.target.value })}
                          placeholder="e.g. تحديث قيود الجود"
                          className="rounded-lg h-9 border-slate-200 text-xs font-bold"
                        />
                      </div>

                      {/* Color select selection tag */}
                      <div className="space-y-1">
                        <Label className="text-[11px] font-black text-slate-600">اللون المميز</Label>
                        <select
                          value={editingUserShortcut.color}
                          onChange={(e) => setEditingUserShortcut({ ...editingUserShortcut, color: e.target.value as any })}
                          className="w-full rounded-lg border border-slate-200 text-xs font-bold h-9 px-2 bg-white outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="blue">أزرق سماوي</option>
                          <option value="rose">وردي غامق</option>
                          <option value="amber">برتقالي دافئ</option>
                          <option value="indigo">نيلي عميق</option>
                          <option value="emerald">أخضر زمردي</option>
                        </select>
                      </div>

                      {/* Keyword */}
                      <div className="space-y-1">
                        <Label className="text-[11px] font-black text-slate-600">الكلمة المفتاحية للبحث الصريح</Label>
                        <Input
                          value={editingUserShortcut.settings.keyword || ''}
                          onChange={(e) => setEditingUserShortcut({
                            ...editingUserShortcut,
                            settings: { ...editingUserShortcut.settings, keyword: e.target.value }
                          })}
                          placeholder="يتم تطبيق تصفية بهذا النص"
                          className="rounded-lg h-9 border-slate-200 text-xs font-bold"
                        />
                      </div>

                      {/* Search source selector from active providers */}
                      <div className="space-y-1">
                        <Label className="text-[11px] font-black text-slate-600">جهة التحديث والبحث المستهدفة</Label>
                        <select
                          value={editingUserShortcut.settings.searchSource || 'jood'}
                          onChange={(e) => setEditingUserShortcut({
                            ...editingUserShortcut,
                            settings: { ...editingUserShortcut.settings, searchSource: e.target.value }
                          })}
                          className="w-full rounded-lg border border-slate-200 text-xs font-bold h-9 px-2 bg-white outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          {shortcutsEditingUser.sourceProviderIds.map((pId) => {
                            const found = providers.find(p => p.id === pId);
                            return (
                              <option key={pId} value={pId}>
                                {found ? found.name : pId}
                              </option>
                            );
                          })}
                          {shortcutsEditingUser.sourceProviderIds.length === 0 && (
                            <>
                              <option value="jood">الجود</option>
                              <option value="shaya">الشائع</option>
                            </>
                          )}
                        </select>
                      </div>

                      {/* Rule configuration stats codes */}
                      <div className="space-y-1">
                        <Label className="text-[11px] font-black text-slate-600">حالة القيد في نظامهم الداخلي</Label>
                        <select
                          value={editingUserShortcut.settings.statusCode || '10'}
                          onChange={(e) => setEditingUserShortcut({
                            ...editingUserShortcut,
                            settings: { ...editingUserShortcut.settings, statusCode: e.target.value }
                          })}
                          className="w-full rounded-lg border border-slate-200 text-xs font-bold h-9 px-2 bg-white outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="10">قيد جاهز للتوصيل (حالة 10)</option>
                          <option value="3">مؤجل من الزبون (حالة 3)</option>
                          <option value="4">مرفوض من الزبون (حالة 4)</option>
                        </select>
                      </div>

                      {/* Option mode */}
                      <div className="space-y-1">
                        <Label className="text-[11px] font-black text-slate-600">معيار نطاق التواريخ لتشغيل الاختصار</Label>
                        <select
                          value={editingUserShortcut.settings.joodMode || 'auto_range'}
                          onChange={(e) => setEditingUserShortcut({
                            ...editingUserShortcut,
                            settings: { ...editingUserShortcut.settings, joodMode: e.target.value as any }
                          })}
                          className="w-full rounded-lg border border-slate-200 text-xs font-bold h-9 px-2 bg-white outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="auto_range">نطاق تلقائي ذكي (أيام)</option>
                          <option value="today">تاريخ اليوم فقط</option>
                        </select>
                      </div>

                      {editingUserShortcut.settings.joodMode === 'auto_range' && (
                        <div className="space-y-1 animate-fadeIn">
                          <Label className="text-[11px] font-bold text-slate-600">عدد الأيام للوراء الذاتية</Label>
                          <Input
                            type="number"
                            min="1"
                            max="30"
                            value={editingUserShortcut.settings.autoRange || '3'}
                            onChange={(e) => setEditingUserShortcut({
                              ...editingUserShortcut,
                              settings: { ...editingUserShortcut.settings, autoRange: e.target.value }
                            })}
                            className="rounded-lg h-9 border-slate-200 text-xs font-bold"
                          />
                        </div>
                      )}
                    </div>

                    <Button
                      type="button"
                      onClick={handleSaveUserShortcut}
                      className="bg-slate-900 hover:bg-slate-800 text-white rounded-lg h-9 w-full text-xs font-black mt-6"
                    >
                      تأكيد الاختصار المؤقت
                    </Button>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-5 bg-slate-100 border-t border-slate-200 flex gap-3 shrink-0 justify-between items-center">
                <Button 
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsShortcutsEditorOpen(false);
                    setShortcutsEditingUser(null);
                  }} 
                  className="rounded-xl font-bold h-11 px-6 text-slate-500 hover:bg-white bg-transparent"
                >
                  إلغاء التعديلات المعلقة
                </Button>
                <Button 
                  type="button"
                  onClick={handleSaveAllUserShortcuts}
                  className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl px-10 h-11 font-black shadow-lg shadow-amber-500/10 gap-2"
                >
                  <Save size={16} />
                  حفظ وتثبيت كل الاختصارات للمستخدم الفاضل
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

