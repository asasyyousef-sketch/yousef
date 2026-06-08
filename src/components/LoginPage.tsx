import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, Globe } from 'lucide-react';
import { motion } from 'motion/react';
import axios from 'axios';
import { toast } from 'sonner';
import { UserConfig } from '../types';

interface LoginPageProps {
  onLoginSuccess: (user: UserConfig) => void;
}

// Brand SVG Logo matching the screenshot precisely
export function LogoIcon({ className = "w-16 h-16", color = "white" }: { className?: string; color?: string }) {
  const isWhite = color === "white";
  return (
    <div className="flex flex-col items-center justify-center select-none">
      <svg viewBox="0 0 120 120" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Core Stylized "M" Structure with high-contrast geometric curves */}
        <path
          d="M25 82C25 87.5 29.5 92 35 92C40.5 92 45 87.5 45 82V52L60 66L75 52V82C75 87.5 79.5 92 85 92C90.5 92 95 87.5 95 82V38C95 32 88.5 28 83 31L60 47L37 31C31.5 28 25 32 25 38V82Z"
          fill={isWhite ? "currentColor" : "#0052e0"}
        />
        {/* Symmetrical matching circuit connection lines and dots */}
        <line
          x1="39"
          y1="45"
          x2="51"
          y2="54"
          stroke={isWhite ? "#0052e0" : "white"}
          strokeWidth="4"
          strokeLinecap="round"
        />
        <circle
          cx="39"
          cy="45"
          r="6.5"
          fill={isWhite ? "#0052e0" : "white"}
        />

        <line
          x1="81"
          y1="45"
          x2="69"
          y2="54"
          stroke={isWhite ? "#0052e0" : "white"}
          strokeWidth="4"
          strokeLinecap="round"
        />
        <circle
          cx="81"
          cy="45"
          r="6.5"
          fill={isWhite ? "#0052e0" : "white"}
        />
      </svg>
      <h1 className="mt-3 text-3xl md:text-4xl font-black tracking-tight" style={{ fontFamily: 'Alexandria, sans-serif' }}>
        مطابق
      </h1>
    </div>
  );
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  // Binds name to email field for 100% backend compatibility
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailOrUsername.trim() || !password.trim()) {
      toast.error('يرجى إدخال البريد الإلكتروني وكلمة المرور');
      return;
    }

    setIsLoading(true);
    try {
      // Calls existing backend login flow with compatible username/password fields
      const response = await axios.post('/api/login', {
        username: emailOrUsername.trim(),
        password: password.trim()
      });

      if (response.data && response.data.user) {
        toast.success(`أهلاً بك، تم تسجيل الدخول بنجاح!`);
        onLoginSuccess(response.data.user);
      } else {
        toast.error('حدثت مشكلة غير متوقعة أثناء معالجة تسجيل الدخول');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      const errorMessage = error.response?.data?.error || 'فشل الاتصال بالخادم، يرجى التأكد من تشغيل الشبكة.';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnsupportedFeature = (feature: string) => {
    toast.info(`${feature} غير مفعلة في بيئة العمل التجريبية الحالية.`, {
      description: 'لتفعيلها يرجى ربط حسابات الإنتاج مع المسؤول.'
    });
  };

  return (
    <div className="min-h-screen flex text-slate-900 bg-[#f8fafc] dir-rtl select-none transition-colors duration-300" style={{ direction: 'rtl' }}>
      
      {/* 40% BRAND SIDE PANEL: Desktop Only */}
      <div className="hidden md:flex md:w-[38%] bg-gradient-to-b from-[#0052e0] via-[#0047c5] to-[#013596] text-white flex-col justify-between p-12 relative overflow-hidden">
        {/* Background Ambient Aesthetics */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-cyan-400/10 rounded-full blur-3xl animate-pulse" />
        
        {/* Logo and Branding at Top */}
        <div className="z-10 mt-12">
          <LogoIcon className="w-24 h-24 text-white" color="white" />
          <p className="mt-4 text-center text-sm text-blue-100 font-medium tracking-wide max-w-[280px] mx-auto leading-relaxed">
            منصة تشغيل وإدارة لشركات الشحن والتحديث
          </p>
        </div>

        {/* Beautiful vector waves in side panel footer matching the screenshot styling */}
        <div className="absolute bottom-0 left-0 right-0 h-32 opacity-20 pointer-events-none">
          <svg className="w-full h-full" viewBox="0 0 400 120" preserveAspectRatio="none">
            <path
              d="M0,80 C120,120 280,40 400,80 L400,120 L0,120 Z"
              fill="rgba(255,255,255,0.2)"
            />
            <path
              d="M0,60 C150,110 250,30 400,70 L400,120 L0,120 Z"
              fill="rgba(255,255,255,0.1)"
            />
          </svg>
        </div>

        {/* Global indicator */}
        <div className="z-10 flex items-center justify-center gap-2 text-xs text-blue-200/80 font-medium">
          <Globe size={14} className="animate-spin-slow" />
          <span>منصة مطابق ترحب بكم © 2026</span>
        </div>
      </div>

      {/* 60% FORM WORKSPACE: Desktop Layout & Integrated Full Blue Mobile Screen */}
      <div className="w-full md:w-[62%] flex items-center justify-center p-6 sm:p-12 md:p-16 bg-gradient-to-b from-[#0052e0] to-[#013596] md:from-[#f8fafc] md:to-[#f8fafc] text-white md:text-slate-900 transition-all duration-300 relative">
        <div className="absolute top-0 right-0 w-full h-full md:hidden pointer-events-none overflow-hidden">
          <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-cyan-400/10 rounded-full blur-3xl" />
          <svg className="absolute bottom-0 left-0 right-0 w-full h-32 opacity-15" viewBox="0 0 400 120" preserveAspectRatio="none">
            <path d="M0,80 C120,120 280,40 400,80 L400,120 L0,120 Z" fill="rgba(255,255,255,0.15)" />
            <path d="M0,60 C150,110 250,30 400,70 L400,120 L0,120 Z" fill="rgba(255,255,255,0.08)" />
          </svg>
        </div>

        {/* Center Container */}
        <div className="w-full max-w-sm md:max-w-md z-15">
          
          {/* Logo only visible on mobile screens */}
          <div className="md:hidden flex flex-col items-center mb-10 text-white">
            <LogoIcon className="w-20 h-20" color="white" />
            <p className="mt-3 text-center text-xs text-white/70 max-w-[240px] leading-relaxed">
              منصة تشغيل وإدارة لشركات الشحن والتحديث
            </p>
          </div>

          {/* Desktop Heading & Greeting */}
          <div className="hidden md:block mb-8">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900" style={{ fontFamily: 'Alexandria, sans-serif' }}>
              مرحباً بعودتك
            </h2>
            <p className="mt-2 text-slate-500 text-sm">
              سجل الدخول للمتابعة
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email Field */}
            <div className="space-y-1.5 text-right">
              <label className="block text-xs md:text-sm font-semibold text-white/90 md:text-slate-700">
                البريد الإلكتروني
              </label>
              <div className="relative group/input">
                <span className="absolute inset-y-0 left-4 pl-0.5 flex items-center pointer-events-none text-white/50 md:text-slate-400 group-focus-within/input:text-white md:group-focus-within/input:text-[#0052e0] transition-colors">
                  <Mail size={18} />
                </span>
                <input
                  type="text"
                  required
                  dir="ltr"
                  value={emailOrUsername}
                  onChange={(e) => setEmailOrUsername(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full h-12 pl-12 pr-4 bg-white/10 md:bg-white text-white md:text-slate-900 placeholder-white/40 md:placeholder-slate-400 border border-white/20 md:border-slate-200 rounded-2xl md:rounded-xl focus:outline-none focus:border-white md:focus:border-[#0052e0] focus:ring-4 focus:ring-white/10 md:focus:ring-[#0052e0]/10 hover:bg-white/15 md:hover:bg-slate-50 transition-all font-medium text-left text-sm"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5 text-right">
              <label className="block text-xs md:text-sm font-semibold text-white/90 md:text-slate-700">
                كلمة المرور
              </label>
              <div className="relative group/input">
                <span className="absolute inset-y-0 left-4 pl-0.5 flex items-center pointer-events-none text-white/50 md:text-slate-400 group-focus-within/input:text-white md:group-focus-within/input:text-[#0052e0] transition-colors">
                  <Lock size={18} />
                </span>
                
                {/* Reveal Password Eye Button */}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-4 pr-0.5 flex items-center text-white/50 md:text-slate-400 hover:text-white md:hover:text-[#0052e0] transition-colors focus:outline-none z-10"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>

                <input
                  type={showPassword ? "text" : "password"}
                  required
                  dir="ltr"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-12 pl-12 pr-12 bg-white/10 md:bg-white text-white md:text-slate-900 placeholder-white/40 md:placeholder-slate-400 border border-white/20 md:border-slate-200 rounded-2xl md:rounded-xl focus:outline-none focus:border-white md:focus:border-[#0052e0] focus:ring-4 focus:ring-white/10 md:focus:ring-[#0052e0]/10 hover:bg-white/15 md:hover:bg-slate-50 transition-all font-medium text-left text-sm"
                />
              </div>
            </div>

            {/* Checkbox "Remember Me" and "Forgot Password" */}
            <div className="flex items-center justify-between text-xs md:text-sm font-semibold pt-1">
              <label className="flex items-center gap-2 cursor-pointer group text-white/90 md:text-slate-600">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded-md border-white/30 md:border-slate-300 text-[#0052e0] bg-white/10 md:bg-white focus:ring-[#0052e0]/20 cursor-pointer accent-[#0052e0]"
                />
                <span>تذكرني</span>
              </label>
              <button
                type="button"
                onClick={() => handleUnsupportedFeature('استعادة كلمة المرور')}
                className="text-white/80 md:text-[#0052e0] hover:text-white md:hover:text-[#0042b4] hover:underline"
              >
                نسيت كلمة المرور؟
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 mt-4 bg-white md:bg-[#0052e0] text-[#0052e0] md:text-white font-bold rounded-2xl md:rounded-xl hover:bg-white/95 md:hover:bg-[#0047c5] transition-all flex items-center justify-center gap-2 shadow-lg shadow-black/10 md:shadow-[#0052e0]/20 border border-transparent disabled:opacity-50"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className={`w-4 h-4 rounded-full border-2 animate-spin ${
                    'border-blue-600/30 border-t-blue-600 md:border-white/30 md:border-t-white'
                  }`} />
                  جاري تسجيل الدخول...
                </span>
              ) : (
                <span>تسجيل الدخول</span>
              )}
            </button>

            {/* Divider "Or" */}
            <div className="flex items-center my-6">
              <div className="flex-1 border-t border-white/10 md:border-slate-200" />
              <span className="px-3 text-xs font-semibold text-white/50 md:text-slate-400">أو</span>
              <div className="flex-1 border-t border-white/10 md:border-slate-200" />
            </div>

            {/* SSO / Single Sign-On */}
            <button
              type="button"
              onClick={() => handleUnsupportedFeature('تسجيل الدخول الموحد')}
              className="w-full h-12 bg-white/5 md:bg-white border border-white/20 md:border-slate-200 text-white md:text-slate-700 font-bold rounded-2xl md:rounded-xl hover:bg-white/10 md:hover:bg-slate-50 transition-all text-xs md:text-sm"
            >
              تسجيل الدخول عبر SSO
            </button>

            {/* Create Account Link */}
            <div className="text-center mt-6 text-xs md:text-sm font-semibold">
              <span className="text-white/60 md:text-slate-500">ليس لديك حساب؟ </span>
              <button
                type="button"
                onClick={() => handleUnsupportedFeature('إنشاء حساب جديد')}
                className="text-white md:text-[#0052e0] font-black hover:underline"
              >
                إنشاء حساب
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
