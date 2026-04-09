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
  ChevronLeft
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

interface Shortcut {
  id: string;
  name: string;
  settings: {
    keyword: string;
    statusCode: string;
    joodMode: string;
    autoRange: string;
    singleDate: string;
    startDate: string;
    endDate: string;
  };
}

const STATUS_OPTIONS = [
  { label: "غير مؤكد", value: '0' },
  { label: "بحوزة مندوب استلام", value: '14' },
  { label: "قيد التنفيذ", value: '1' },
  { label: "قيد التنفيذ بحوزة مندوب", value: '10' },
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
  // State: View Management
  const [currentView, setCurrentView] = useState<'main' | 'analysis' | 'updater'>('main');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isShortcutModalOpen, setIsShortcutModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalColor, setModalColor] = useState('bg-blue-600');
  const [modalData, setModalData] = useState<MatchedResult[]>([]);
  const [selectedNote, setSelectedNote] = useState<string | null>(null);
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
  const [keyword, setKeyword] = useState('الجود');
  const [statusCode, setStatusCode] = useState('10');
  const [joodMode, setJoodMode] = useState('today');
  const [autoRange, setAutoRange] = useState('7');
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
  const [logs, setLogs] = useState<{ text: string; type: 'info' | 'success' | 'error' | 'default' }[]>([]);
  
  const logEndRef = useRef<HTMLDivElement>(null);

  // Load settings from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('app_settings');
    if (saved) {
      const data = JSON.parse(saved);
      setHawkUser(data.hawkUser || '');
      setHawkPass(data.hawkPass || '');
      setJoodUser(data.joodUser || '');
      setJoodPass(data.joodPass || '');
      setKeyword(data.keyword || 'الجود');
      setStatusCode(data.statusCode || '10');
      setJoodMode(data.joodMode || 'today');
      setAutoRange(data.autoRange || '7');
      setSingleDate(data.singleDate || format(new Date(), 'yyyy-MM-dd'));
      setStartDate(data.startDate || format(new Date(), 'yyyy-MM-dd'));
      setEndDate(data.endDate || format(new Date(), 'yyyy-MM-dd'));
      setReplacementRules(data.replacementRules || []);
      setShortcuts(data.shortcuts || []);
    }
  }, []);

  // Auto-save settings
  useEffect(() => {
    const data = {
      hawkUser, hawkPass, joodUser, joodPass, keyword, statusCode,
      joodMode, autoRange, singleDate, startDate, endDate, replacementRules,
      shortcuts
    };
    localStorage.setItem('app_settings', JSON.stringify(data));
  }, [hawkUser, hawkPass, joodUser, joodPass, keyword, statusCode, joodMode, autoRange, singleDate, startDate, endDate, replacementRules, shortcuts]);

  // Scroll logs to bottom
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const addLog = (text: string, type: 'info' | 'success' | 'error' | 'default' = 'default') => {
    setLogs(prev => [...prev, { text, type }]);
  };

  // Shortcuts Logic
  const openShortcutModal = (shortcut?: Shortcut) => {
    if (shortcut) {
      setEditingShortcut(shortcut);
    } else {
      setEditingShortcut({
        id: '',
        name: '',
        settings: {
          keyword,
          statusCode,
          joodMode,
          autoRange,
          singleDate,
          startDate,
          endDate
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

  const saveShortcut = () => {
    if (!editingShortcut || !editingShortcut.name) {
      toast.error('يرجى إدخال اسم الاختصار');
      return;
    }
    
    if (editingShortcut.id) {
      setShortcuts(prev => prev.map(s => s.id === editingShortcut.id ? editingShortcut : s));
      toast.success('تم تحديث الاختصار');
    } else {
      const newShortcut = { ...editingShortcut, id: Date.now().toString() };
      setShortcuts(prev => [...prev, newShortcut]);
      toast.success('تم إضافة الاختصار');
    }
    setIsShortcutModalOpen(false);
  };

  const deleteShortcut = (id: string) => {
    setShortcuts(prev => prev.filter(s => s.id !== id));
    toast.success('تم حذف الاختصار');
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
    if (!hawkUser || !hawkPass || !joodUser || !joodPass) {
      toast.error('يرجى إدخال جميع بيانات تسجيل الدخول');
      addLog('خطأ: بيانات الدخول ناقصة', 'error');
      return;
    }

    const activeKeyword = customSettings?.keyword || keyword;
    const activeStatusCode = customSettings?.statusCode || statusCode;
    
    // Store active settings for display in statistics
    setActiveSettings(customSettings || {
      keyword,
      statusCode,
      joodMode,
      autoRange,
      singleDate,
      startDate,
      endDate
    });

    setIsLoading(true);
    setProgress(0);
    setLogs([]);
    addLog('بدء العملية المتكاملة...', 'info');
    addLog(`إعدادات صقور نينوى: كلمة البحث='${activeKeyword}', كود الحالة='${activeStatusCode}'`, 'info');

    try {
      // 1. Hawk Process
      addLog('جاري تسجيل الدخول وجلب طلبات صقور نينوى...', 'info');
      const hawkRes = await axios.post('/api/hawk/process', {
        username: hawkUser,
        password: hawkPass,
        filterKeyword: activeKeyword,
        statusCode: activeStatusCode
      });
      
      if (!hawkRes.data || !Array.isArray(hawkRes.data.orders)) {
        throw new Error('فشل في جلب بيانات صقور نينوى: استجابة غير صالحة من السيرفر');
      }
      
      setHawkOrders(hawkRes.data.orders);
      setProgress(30);
      addLog(hawkRes.data.message || 'تم جلب بيانات صقور نينوى بنجاح', 'success');

      // 2. Jood Process
      const joodDates = getJoodDates(customSettings);
      addLog(`بدء جلب طلبات شركة الجود لـ ${joodDates.length} أيام...`, 'info');
      
      let allJoodOrders: JoodOrder[] = [];
      for (let i = 0; i < joodDates.length; i++) {
        const date = joodDates[i];
        addLog(`جاري جلب بيانات يوم: ${date} (${i + 1}/${joodDates.length})...`, 'info');
        
        const joodRes = await axios.post('/api/jood/process', {
          username: joodUser,
          password: joodPass,
          dates: [date]
        });
        
        if (!joodRes.data || !Array.isArray(joodRes.data.orders)) {
          throw new Error(`فشل في جلب بيانات الجود ليوم ${date}: استجابة غير صالحة من السيرفر`);
        }
        
        allJoodOrders = [...allJoodOrders, ...joodRes.data.orders];
        addLog(`تم جلب ${joodRes.data.orders.length} طلب ليوم ${date}`, 'success');
        
        // Update progress incrementally from 30% to 80%
        const joodProgress = 30 + ((i + 1) / joodDates.length) * 50;
        setProgress(Math.round(joodProgress));
      }
      
      setJoodOrders(allJoodOrders);
      addLog(`اكتمل جلب جميع طلبات الجود. الإجمالي: ${allJoodOrders.length}`, 'success');

      // 3. Matching Logic
      addLog('جاري مطابقة البيانات وتطبيق قواعد الاستبدال...', 'info');
      
      const hawkOrdersList = hawkRes.data.orders;
      const joodOrdersList = allJoodOrders;
      
      const results: MatchedResult[] = hawkOrdersList.map((order: Order) => {
        const matches = joodOrdersList.filter((j: JoodOrder) => j.idWasl_Value === order.idWasl_Value);
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
          
          // Apply replacement rules: If keyword found, replace ENTIRE note
          let finalNotes = result.Notes;
          replacementRules.forEach(rule => {
            if (rule.find && rule.replace && finalNotes.includes(rule.find)) {
              finalNotes = rule.replace;
            }
          });
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
      addLog(`اكتملت عملية المطابقة بنجاح لـ ${results.length} طلب.`, 'success');
      toast.success('اكتملت العملية بنجاح');
    } catch (error: any) {
      const msg = error.response?.data?.error || error.message;
      addLog(`فشل: ${msg}`, 'error');
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
    let filtered: MatchedResult[] = [];
    
    if (filterType === 'delivered') {
      filtered = matchedResults.filter(r => 
        r.Match_Count === 1 && 
        !r.Status_Type && 
        !r.Status.includes('واصل جزئي') &&
        (r.Status === 'تم التسليم' || r.Status.startsWith('تم المحاسبه') || r.Status.startsWith('تم محاسبة'))
      );
    } else if (filterType === 'partial') {
      filtered = matchedResults.filter(r => r.Status_Type || r.Status.includes('واصل جزئي'));
    } else if (filterType === 'executing') {
      filtered = matchedResults.filter(r => 
        r.Match_Count === 1 && 
        !r.Status_Type && 
        !r.Status.includes('واصل جزئي') &&
        r.Status.includes('قيد التنفيذ')
      );
    } else if (filterType === 'delayed') {
      filtered = matchedResults.filter(r => 
        r.Match_Count === 1 && 
        !r.Status_Type && 
        !r.Status.includes('واصل جزئي') &&
        (r.Status === 'مؤجل' || r.Status === 'اعادة ارسال')
      );
    } else if (filterType === 'rejected') {
      filtered = matchedResults.filter(r => 
        r.Match_Count === 1 && 
        !r.Status_Type && 
        !r.Status.includes('واصل جزئي') &&
        (r.Status.includes('رفض') || r.Status.includes('راجع'))
      );
    } else if (filterType === 'unconfirmed') {
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
    } else if (filterType === 'noMatch') {
      filtered = matchedResults.filter(r => r.Match_Count === 0);
    }

    setModalTitle(label);
    setModalColor(color);
    setModalData(filtered);
    setIsModalOpen(true);
  };

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
    if (!hawkUser || !hawkPass) {
      toast.error('يرجى إدخال بيانات صقور نينوى');
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
    addLog(`بدء تحديث السيرفر لـ ${finalUrls.length} رابط...`, 'info');
    
    // Scroll to logs
    setTimeout(() => {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);

    try {
      const res = await axios.post('/api/update-server', {
        username: hawkUser,
        password: hawkPass,
        urls: finalUrls
      });
      addLog(res.data.message, 'success');
      toast.success(res.data.message);
    } catch (error: any) {
      const msg = error.response?.data?.error || error.message;
      addLog(`فشل التحديث: ${msg}`, 'error');
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#EBEFF3] text-slate-900 font-sans selection:bg-blue-100" dir="rtl">
      <Toaster position="bottom-left" richColors />
      
      {/* Header - Modern Redesign */}
      <header className="bg-slate-950 text-white shadow-2xl relative overflow-hidden">
        <div className="container mx-auto px-6 py-6 md:py-8 relative z-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="relative">
                <div className="bg-white/10 p-3.5 rounded-2xl backdrop-blur-xl border border-white/20 shadow-2xl relative z-10 group transition-all">
                  <LayoutDashboard size={28} className="text-blue-400" />
                </div>
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-black tracking-tight text-right leading-tight">
                  منصة العمليات <span className="text-blue-400">الموحدة</span>
                </h1>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-3 bg-white/5 px-5 py-2.5 rounded-2xl border border-white/10 backdrop-blur-xl">
                <div className="w-2.5 h-2.5 bg-green-400 rounded-full shadow-[0_0_10px_rgba(74,222,128,0.4)]" />
                <span className="text-xs font-bold tracking-wide opacity-90">النظام متصل</span>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setIsSettingsModalOpen(true)}
                className="w-12 h-12 rounded-2xl bg-white/5 hover:bg-white/15 text-white transition-all active:scale-95 border border-white/10"
              >
                <SettingsIcon size={22} />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Top Navigation Bar - Modern Segmented Control */}
      <nav className="bg-white/60 backdrop-blur-2xl border-b border-slate-200/60 sticky top-0 z-50 py-3">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center">
            <div className="bg-slate-200/50 p-1.5 rounded-[22px] flex items-center gap-1.5 border border-slate-200/50">
              {[
                { id: 'main', label: 'الرئيسية', fullLabel: 'الإعدادات الرئيسية', icon: SettingsIcon, color: 'text-blue-600', bg: 'bg-blue-50' },
                { id: 'analysis', label: 'الإحصائيات', fullLabel: 'التحليل والنتائج', icon: Activity, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                { id: 'updater', label: 'التحديث', fullLabel: 'أداة التحديث الذكي', icon: RefreshCw, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setCurrentView(tab.id as any)}
                  className={cn(
                    "flex items-center gap-2.5 py-2.5 md:py-3 px-5 md:px-8 rounded-[18px] transition-all duration-500 font-black text-xs md:text-sm relative overflow-hidden group",
                    currentView === tab.id 
                      ? cn("bg-white shadow-[0_4px_20px_rgba(0,0,0,0.08)]", tab.color) 
                      : "text-slate-500 hover:text-slate-900 hover:bg-white/40"
                  )}
                >
                  <tab.icon size={18} className={cn("transition-all duration-500", currentView === tab.id ? cn(tab.color, "scale-110") : "text-slate-400 group-hover:scale-110")} />
                  <span className="hidden md:inline">{tab.fullLabel}</span>
                  <span className="md:hidden">{tab.label}</span>
                  {currentView === tab.id && (
                    <motion.div 
                      layoutId="activeTabIndicator"
                      className={cn("absolute bottom-0 left-0 right-0 h-0.5", 
                        tab.id === 'main' ? 'bg-blue-600' : 
                        tab.id === 'analysis' ? 'bg-indigo-600' : 'bg-emerald-600'
                      )}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-6">
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
                    <h3 className="text-lg font-black text-slate-800">الاختصارات المخصصة</h3>
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
                    {shortcuts.length === 0 && (
                      <div className="text-slate-400 text-sm italic py-4">لا توجد اختصارات محفوظة حالياً...</div>
                    )}
                    {shortcuts.map((s) => (
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
                              <Button
                                onClick={(e) => handleExpandShortcut(s.id, e)}
                                className="h-20 px-8 bg-white border border-slate-200 hover:border-blue-500 hover:bg-blue-50 text-slate-700 rounded-2xl shadow-sm flex flex-col items-center justify-center gap-1 transition-all min-w-[12rem]"
                              >
                                <span className="text-sm font-black">{s.name}</span>
                                <span className="text-[10px] opacity-50">{s.settings.keyword} - {STATUS_OPTIONS.find(o => o.value === s.settings.statusCode)?.label}</span>
                              </Button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {/* Main Action Buttons */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                <Button 
                  onClick={runProcess} 
                  disabled={isLoading}
                  className="md:col-span-2 h-24 md:h-32 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 hover:from-blue-500 hover:to-indigo-700 text-white rounded-3xl shadow-[0_20px_50px_rgba(59,130,246,0.2)] transition-all active:scale-95 flex flex-col gap-1 md:gap-2 relative overflow-hidden group border-none"
                >
                  <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="flex items-center gap-3 relative z-10">
                    {isLoading ? <RefreshCw className="animate-spin" size={24} /> : <Activity size={24} />}
                    <span className="text-lg sm:text-xl md:text-2xl font-black tracking-tight">بدء الجلب والمطابقة</span>
                  </div>
                </Button>

                <div className="grid grid-cols-2 md:grid-cols-1 gap-4">
                  <Button 
                    variant="outline"
                    onClick={() => setIsSettingsModalOpen(true)}
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
                      {logs.map((log, i) => (
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
                      {logs.length === 0 && (
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
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                <div className="space-y-1">
                  <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">تحليل وإحصائيات المطابقة</h2>
                </div>
                <Button 
                  onClick={exportToExcel} 
                  variant="outline" 
                  className="w-full sm:w-auto h-12 px-6 rounded-2xl border-slate-200 hover:border-blue-500 hover:bg-blue-50 text-slate-700 hover:text-blue-700 font-black transition-all"
                >
                  <Download className="ml-2" size={18} />
                  تصدير إكسل
                </Button>
              </div>

              {/* Source Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                <Card className="card-modern overflow-hidden group border-none shadow-xl">
                  <div className="h-2 bg-blue-600 w-full" />
                  <CardContent className="p-8">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 transition-transform">
                          <FileSpreadsheet size={24} />
                        </div>
                        <div>
                          <CardTitle className="text-slate-800 text-xl font-black">صقور نينوى</CardTitle>
                        </div>
                      </div>
                      <Badge className="bg-blue-600 text-white rounded-lg px-3 py-1 font-black">HAWK</Badge>
                    </div>
                    <div className="flex items-end justify-between">
                      <div className="space-y-1">
                        <p className="text-slate-400 text-[10px] font-black uppercase tracking-wider">إجمالي الطلبات</p>
                        <p className="text-5xl font-black tracking-tighter text-slate-900">{hawkOrders.length.toLocaleString()}</p>
                      </div>
                      <div className="text-left space-y-2">
                        <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 text-[10px] font-bold text-slate-600">
                          الحالة: {STATUS_OPTIONS.find(o => o.value === (activeSettings?.statusCode || statusCode))?.label}
                        </div>
                        <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 text-[10px] font-bold text-slate-600">
                          الكلمة: {activeSettings?.keyword || keyword}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="card-modern overflow-hidden group border-none shadow-xl">
                  <div className="h-2 bg-slate-900 w-full" />
                  <CardContent className="p-8">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-900 transition-transform">
                          <Database size={24} />
                        </div>
                        <div>
                          <CardTitle className="text-slate-800 text-xl font-black">شركة الجود</CardTitle>
                        </div>
                      </div>
                      <Badge className="bg-slate-900 text-white rounded-lg px-3 py-1 font-black">JOOD</Badge>
                    </div>
                    <div className="flex items-end justify-between">
                      <div className="space-y-1">
                        <p className="text-slate-400 text-[10px] font-black uppercase tracking-wider">الطلبات المجلوبة</p>
                        <p className="text-5xl font-black tracking-tighter text-slate-900">{joodOrders.length.toLocaleString()}</p>
                      </div>
                      <div className="text-left">
                        <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 text-[10px] font-bold text-slate-600">
                          النطاق: {
                            (activeSettings?.joodMode || joodMode) === 'today' ? 'اليوم' : 
                            (activeSettings?.joodMode || joodMode) === 'auto_range' ? `تلقائي (${activeSettings?.autoRange || autoRange} يوم)` : 
                            'مخصص'
                          }
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
                  <h3 className="text-lg font-black text-slate-800">نتائج المطابقة النهائية</h3>
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
                      className="group cursor-pointer"
                    >
                      <Card className="card-modern h-full border-none shadow-lg hover:translate-y-[-4px] transition-all overflow-hidden relative">
                        <div className={cn("absolute top-0 left-0 w-1 h-full", item.color)} />
                        <CardContent className="p-6">
                          <div className="flex items-center justify-between mb-4">
                            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg", item.color)}>
                              <item.icon size={20} />
                            </div>
                            <span className="text-3xl font-black tracking-tighter text-slate-900">{item.count.toLocaleString()}</span>
                          </div>
                          <div className="space-y-1">
                            <h4 className="font-black text-slate-800 text-sm">{item.label}</h4>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{item.desc}</p>
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
              <div className="space-y-1">
                <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">أداة تحديث الطلبات (linkM)</h2>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
                <div className="lg:col-span-1 space-y-6">
                  <Card className="card-modern overflow-hidden border-none shadow-xl">
                    <div className="bg-slate-950 px-6 py-4 border-b border-white/5">
                      <h3 className="font-black text-white flex items-center gap-3 text-sm">
                        <ShieldCheck size={18} className="text-blue-400" />
                        حالة الجلسة
                      </h3>
                    </div>
                    <CardContent className="p-6 space-y-6">
                      <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex items-center gap-4">
                        <div className="w-3 h-3 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                        <span className="text-xs font-black text-blue-700">الجلسة نشطة ومؤمنة</span>
                      </div>
                      
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
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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
                                onClick={() => setUpdaterStatus({...updaterStatus, [opt.id]: !updaterStatus[opt.id as keyof typeof updaterStatus]})}
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
                  <Card className="rounded-[24px] overflow-hidden border-none shadow-xl bg-[#0F172A] p-5 h-[200px] relative">
                    <div className="absolute top-0 right-0 p-3">
                      <div className="w-2 h-2 bg-blue-500 rounded-full" />
                    </div>
                    <ScrollArea className="h-full">
                      <div className="space-y-2 font-mono">
                        <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-3 border-b border-white/5 pb-2">سجل التحديث</div>
                        {logs.filter(l => l.text.includes('تحديث')).length === 0 && (
                          <div className="text-slate-600 italic text-[11px] py-4">في انتظار بدء التحديث...</div>
                        )}
                        {logs.filter(l => l.text.includes('تحديث')).map((log, i) => (
                          <div key={i} className={cn(
                            "flex gap-3 text-[11px] border-r-2 pr-3 py-0.5",
                            log.type === 'success' ? "border-green-500/50 text-green-400" :
                            log.type === 'error' ? "border-red-500/50 text-red-400" : "border-blue-500/50 text-blue-400"
                          )}>
                            <span className="text-slate-600">[{format(new Date(), 'HH:mm:ss')}]</span>
                            <span className="font-sans">{log.text}</span>
                          </div>
                        ))}
                        <div ref={logEndRef} />
                      </div>
                    </ScrollArea>
                  </Card>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

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
                      {modalData.map((r, i) => (
                        <TableRow key={i} className="hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0">
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
                            className="max-w-[150px] md:max-w-[250px] truncate text-slate-700 text-[10px] md:text-xs font-medium cursor-pointer hover:text-blue-600 hover:underline" 
                            onClick={() => r.Notes && setSelectedNote(r.Notes)}
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
                      ))}
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
        {selectedNote && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedNote(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-lg text-slate-800">تفاصيل الملاحظة</h3>
                <Button variant="ghost" size="icon" onClick={() => setSelectedNote(null)} className="rounded-full">
                  <XCircle size={20} />
                </Button>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 min-h-[100px] text-slate-700 font-medium leading-relaxed">
                {selectedNote}
              </div>
              <div className="mt-6 flex justify-between items-center">
                <Button 
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(selectedNote);
                    toast.success('تم نسخ الملاحظة');
                  }}
                  className="rounded-xl gap-2"
                >
                  <Copy size={16} />
                  نسخ الملاحظة
                </Button>
                <Button onClick={() => setSelectedNote(null)} className="bg-slate-900 text-white rounded-xl px-6">إغلاق</Button>
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
              className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="bg-blue-600 p-6 text-white flex items-center justify-between">
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

              <div className="p-6 space-y-6">
                <div className="space-y-2">
                  <Label className="text-sm font-bold text-slate-700">اسم الاختصار</Label>
                  <Input 
                    value={editingShortcut.name}
                    onChange={(e) => setEditingShortcut({...editingShortcut, name: e.target.value})}
                    placeholder="مثلاً: جلب طلبات اليوم - الجود"
                    className="rounded-xl border-slate-200 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-bold text-slate-700">كلمة البحث (صقور)</Label>
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
                    <Label className="text-sm font-bold text-slate-700">الحالة (صقور)</Label>
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
                  <Label className="text-sm font-black text-slate-800">إعدادات التاريخ (الجود)</Label>
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

              <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
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

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl bg-[#F8FAFC] rounded-2xl md:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] md:max-h-[90vh]"
            >
              <div className="px-5 md:px-8 py-4 md:py-6 border-b border-slate-200 flex items-center justify-between bg-white">
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="w-8 h-8 md:w-10 md:h-10 bg-blue-600 rounded-lg md:rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-100 shrink-0">
                    <SettingsIcon size={20} className="md:w-6 md:h-6" />
                  </div>
                  <div>
                    <h3 className="font-black text-base md:text-xl text-slate-800">إعدادات النظام والربط</h3>
                    <p className="text-[10px] md:text-xs text-slate-500 font-medium hidden sm:block">قم بضبط حسابات الدخول ومعايير الجلب والمطابقة</p>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setIsSettingsModalOpen(false)}
                  className="rounded-full hover:bg-slate-100 h-8 w-8 md:h-10 md:w-10 shrink-0"
                >
                  <XCircle size={20} className="text-slate-400 md:w-6 md:h-6" />
                </Button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-5 md:p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                  {/* Hawk Settings */}
                  <div className="space-y-3 md:space-y-4">
                    <div className="flex items-center gap-2 text-blue-600 font-black text-sm md:text-base">
                      <ShieldCheck size={18} className="md:w-5 md:h-5" />
                      <h4>يوزر التحديث (صقور نينوى)</h4>
                    </div>
                    <Card className="border-slate-200 shadow-sm rounded-2xl">
                      <CardContent className="p-4 md:p-6 space-y-3 md:space-y-4">
                        <div className="space-y-1.5 md:space-y-2">
                          <Label className="text-[10px] md:text-xs font-bold text-slate-500">اسم المستخدم</Label>
                          <Input value={hawkUser} onChange={e => setHawkUser(e.target.value)} className="rounded-xl border-slate-200 focus:ring-blue-500 h-9 md:h-10 text-xs md:text-sm" />
                        </div>
                        <div className="space-y-1.5 md:space-y-2">
                          <Label className="text-[10px] md:text-xs font-bold text-slate-500">كلمة المرور</Label>
                          <Input type="password" value={hawkPass} onChange={e => setHawkPass(e.target.value)} className="rounded-xl border-slate-200 focus:ring-blue-500 h-9 md:h-10 text-xs md:text-sm" />
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Basic Process Settings */}
                  <div className="space-y-3 md:space-y-4">
                    <div className="flex items-center gap-2 text-slate-700 font-black text-sm md:text-base">
                      <Filter size={18} className="md:w-5 md:h-5" />
                      <h4>معايير جلب البيانات</h4>
                    </div>
                    <Card className="border-slate-200 shadow-sm rounded-2xl">
                      <CardContent className="p-4 md:p-6 space-y-3 md:space-y-4">
                        <div className="space-y-1.5 md:space-y-2">
                          <Label className="text-[10px] md:text-xs font-bold text-slate-500">الكلمة البحثية (Keyword)</Label>
                          <Input value={keyword} onChange={e => setKeyword(e.target.value)} className="rounded-xl border-slate-200 focus:ring-blue-500 h-9 md:h-10 text-xs md:text-sm" />
                        </div>
                        <div className="space-y-1.5 md:space-y-2">
                          <Label className="text-[10px] md:text-xs font-bold text-slate-500">حالة الطلب المستهدفة</Label>
                          <select 
                            value={statusCode} 
                            onChange={e => setStatusCode(e.target.value)}
                            className="w-full h-9 md:h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs md:text-sm focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                          >
                            {STATUS_OPTIONS.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Jood Settings */}
                  <div className="md:col-span-2 space-y-3 md:space-y-4">
                    <div className="flex items-center gap-2 text-blue-600 font-black text-sm md:text-base">
                      <Database size={18} className="md:w-5 md:h-5" />
                      <h4>حساب شركة الجود وإعدادات التاريخ</h4>
                    </div>
                    <Card className="border-slate-200 shadow-sm rounded-2xl">
                      <CardContent className="p-4 md:p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                          <div className="space-y-3 md:space-y-4">
                            <div className="space-y-1.5 md:space-y-2">
                              <Label className="text-[10px] md:text-xs font-bold text-slate-500">اسم المستخدم (الجود)</Label>
                              <Input value={joodUser} onChange={e => setJoodUser(e.target.value)} className="rounded-xl border-slate-200 h-9 md:h-10 text-xs md:text-sm" />
                            </div>
                            <div className="space-y-1.5 md:space-y-2">
                              <Label className="text-[10px] md:text-xs font-bold text-slate-500">كلمة المرور (الجود)</Label>
                              <Input type="password" value={joodPass} onChange={e => setJoodPass(e.target.value)} className="rounded-xl border-slate-200 h-9 md:h-10 text-xs md:text-sm" />
                            </div>
                          </div>
                          
                          <div className="space-y-3 md:space-y-4 md:border-r border-slate-100 md:pr-8">
                            <Label className="text-xs md:text-sm font-black text-slate-700">تحديد نطاق تاريخ الجلب</Label>
                            <div className="grid grid-cols-2 gap-2 md:gap-3">
                              {[
                                { id: 'today', label: 'اليوم فقط' },
                                { id: 'auto_range', label: 'مدى تلقائي' },
                                { id: 'single', label: 'يوم محدد' },
                                { id: 'range', label: 'مدى مخصص' },
                              ].map(mode => (
                                <button 
                                  key={mode.id} 
                                  onClick={() => setJoodMode(mode.id)}
                                  className={cn(
                                    "flex items-center justify-center gap-2 p-2 md:p-3 rounded-xl border-2 transition-all text-[10px] md:text-xs font-bold",
                                    joodMode === mode.id 
                                      ? "border-blue-600 bg-blue-50 text-blue-700 shadow-sm" 
                                      : "border-slate-100 bg-white text-slate-500 hover:border-slate-200"
                                  )}
                                >
                                  {mode.label}
                                </button>
                              ))}
                            </div>

                            <div className="mt-1 md:mt-2">
                              {joodMode === 'auto_range' && (
                                <select 
                                  value={autoRange} 
                                  onChange={e => setAutoRange(e.target.value)}
                                  className="w-full h-9 md:h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs md:text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                  {AUTO_RANGE_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                  ))}
                                </select>
                              )}
                              {joodMode === 'single' && (
                                <Input type="date" value={singleDate} onChange={e => setSingleDate(e.target.value)} className="rounded-xl h-9 md:h-10 text-xs md:text-sm" />
                              )}
                              {joodMode === 'range' && (
                                <div className="grid grid-cols-2 gap-2">
                                  <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="rounded-xl h-9 md:h-10 text-xs md:text-sm" />
                                  <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="rounded-xl h-9 md:h-10 text-xs md:text-sm" />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
              
              <div className="px-5 md:px-8 py-4 md:py-6 border-t border-slate-200 bg-white flex justify-end">
                <Button onClick={() => setIsSettingsModalOpen(false)} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white rounded-xl md:rounded-2xl px-8 md:px-12 h-10 md:h-12 text-sm md:text-base font-black shadow-lg shadow-blue-100">حفظ الإعدادات</Button>
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
          <p className="text-slate-600 text-sm font-bold">منصة العمليات الموحدة © 2026</p>
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
    </div>
  );
}
