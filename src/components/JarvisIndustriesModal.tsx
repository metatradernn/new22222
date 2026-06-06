"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { X, CheckCircle, Loader2, Upload, ImageIcon, Copy, ExternalLink, ArrowRight, User, Bell, CreditCard, Wallet, Landmark, Bitcoin, Smartphone, ChevronRight, Zap, Brain, Monitor, Eye, Shield, Heart, BookOpen, Palette, ChevronDown } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useAuth } from "@/hooks/use-auth";
import { useCurrency } from "@/hooks/use-currency";
import { useSale } from "@/hooks/use-sale";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import PrivacyPolicyStep from "@/components/PrivacyPolicyStep";
import PrivacyPolicyConsentStep from "@/components/PrivacyPolicyConsentStep";

import { supabase } from '@/integrations/supabase/client';
import { METACORE_FN_BASE } from '@/integrations/supabase/metacore-client';

const TIERS = [
  {
    id: 'mk1',
    name: 'MK-I',
    fullName: 'Jarvis Industries MK-I',
    label: 'Низкий тариф',
    tokens: 10000,
    price: 1490,
    color: 'cyan',
    image: '/assets/jarvis-industries-mk1.jpg',
    description: 'Базовый доступ к Jarvis Industries. Идеально для начала.',
    features: ['10 000 токенов', 'Базовые функции ИИ', 'Группа MK-I'],
    gradient: 'from-cyan-950/60 to-black',
    border: 'border-cyan-500/30',
    badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    glow: 'shadow-cyan-500/10',
  },
  {
    id: 'mk2',
    name: 'MK-II',
    fullName: 'Jarvis Industries MK-II',
    label: 'Средний тариф',
    tokens: 30000,
    price: 3490,
    color: 'green',
    image: '/assets/jarvis-industries-mk2.jpg',
    description: 'Расширенный доступ с увеличенным лимитом токенов.',
    features: ['30 000 токенов', 'Расширенные функции ИИ', 'Группа MK-II', 'Приоритетная поддержка'],
    gradient: 'from-green-950/60 to-black',
    border: 'border-green-500/30',
    badge: 'bg-green-500/20 text-green-300 border-green-500/30',
    glow: 'shadow-green-500/10',
    popular: true,
  },
  {
    id: 'mk3',
    name: 'MK-III',
    fullName: 'Jarvis Industries MK-III',
    label: 'Высокий тариф',
    tokens: 60000,
    price: 5990,
    color: 'red',
    image: '/assets/jarvis-industries-mk3.jpg',
    description: 'Максимальный доступ для профессионального использования.',
    features: ['60 000 токенов', 'Все функции ИИ', 'Группа MK-III', 'VIP поддержка', 'Ранний доступ к обновлениям'],
    gradient: 'from-red-950/60 to-black',
    border: 'border-red-500/30',
    badge: 'bg-red-500/20 text-red-300 border-red-500/30',
    glow: 'shadow-red-500/10',
  },
];

const PLATEGA_METHODS = [
  { id: 'sbp',    name: 'СБП / Карты РФ',            icon: <Smartphone className="w-4 h-4" />, badge: 'Авто'   },
  { id: 'crypto', name: 'Криптовалюта (CryptoBot)',  icon: <Bitcoin className="w-4 h-4" />,    badge: 'Авто'   },
];

const MANUAL_METHODS = [
  {
    id: 'kazakhstan',
    name: 'Карта Казахстана',
    icon: <CreditCard className="w-4 h-4" />,
    badge: 'Ручной',
    country: '🇰🇿 Казахстан',
    currency: 'KZT',
    symbol: '₸',
    infoUrl: 'https://t.me/vibetechhSupport',
    requisites: [
      { label: 'Номер карты', value: '4400 4303 5866 6060' },
      { label: 'Получатель', value: 'YEGOR LYASHENKO' },
    ],
  },
  {
    id: 'belarus',
    name: 'Карта Беларуси',
    icon: <CreditCard className="w-4 h-4" />,
    badge: 'Ручной',
    country: '🇧🇾 Беларусь',
    currency: 'BYN',
    symbol: 'Br',
    infoUrl: 'https://t.me/vibetechhSupport',
    requisites: [
      { label: 'Номер карты', value: '4400 4303 5866 6060' },
      { label: 'Получатель', value: 'YEGOR LYASHENKO' },
    ],
  },
];

const METHOD_NAMES: Record<string, string> = {
  sbp: 'СБП (Россия)',
  crypto: 'Криптовалюта (CryptoBot)',
  kazakhstan: 'Карта Казахстана (ручной)',
  belarus: 'Карта Беларуси (ручной)',
};

interface JarvisIndustriesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = 'privacy' | 'privacy-policy' | 'info' | 'tier' | 'payment' | 'pending' | 'requisites' | 'screenshot' | 'sending' | 'success';

const JarvisIndustriesModal: React.FC<JarvisIndustriesModalProps> = ({ isOpen, onClose }) => {
  const { profile } = useAuth();
  const { convertPrice, getSymbol, convertTo } = useCurrency();
  const { isActive: isSaleActive, percent: salePercent, getDiscountedPrice } = useSale();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('privacy');
  const [selectedTier, setSelectedTier] = useState<typeof TIERS[0] | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const agreementAccepted = localStorage.getItem('vibe_privacy_policy_accepted') === '1';
    const policyAccepted = localStorage.getItem('vibe_privacy_policy_consent_accepted') === '1';
    setStep(!agreementAccepted ? 'privacy' : !policyAccepted ? 'privacy-policy' : 'info');
    setSelectedTier(null);
    setSelectedMethod(null);
    setScreenshot(null);
    setScreenshotPreview(null);
    setErrorMsg('');
    setPaymentUrl(null);
    setTransactionId(null);
    setIsLoading(false);
  }, [isOpen]);

  useEffect(() => {
    if (step === 'success') {
      setCountdown(3);
      const interval = setInterval(() => {
        setCountdown(prev => {
          if (prev === null || prev <= 1) { clearInterval(interval); return null; }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [step]);

  const handleClose = () => {
    setStep('info');
    setSelectedTier(null);
    setSelectedMethod(null);
    setScreenshot(null);
    setScreenshotPreview(null);
    setErrorMsg('');
    setPaymentUrl(null);
    setTransactionId(null);
    setIsLoading(false);
    onClose();
  };

  const goToProfile = () => {
    handleClose();
    navigate('/profile');
  };

  const handleCheckStatus = async () => {
    if (!transactionId || !profile || !selectedTier) {
      goToProfile();
      return;
    }

    setIsCheckingStatus(true);
    setErrorMsg('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${METACORE_FN_BASE}/platega-webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`,
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRnc3FleGxta25uYmRlaWtyamJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5MDI0ODEsImV4cCI6MjA5NTQ3ODQ4MX0.UbuUvgif9vlm6KRHRNHkXkxvB3JGI2y0D5SsKvze-MY',
        },
        body: JSON.stringify({ action: 'check', transactionId, profileId: profile.id }),
      });
      const data = await res.json();
      console.log('[JI] check-payment result:', data);

      if (data.status === 'CONFIRMED') {
        setStep('success');
        setTimeout(() => goToProfile(), 3000);
      } else {
        goToProfile();
      }
    } catch (e) {
      console.error('[JI] check-payment error:', e);
      goToProfile();
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const isPlatega = PLATEGA_METHODS.some(m => m.id === selectedMethod);
  const selectedManual = MANUAL_METHODS.find(m => m.id === selectedMethod) || null;

  // Цена с учётом скидки
  const getTierDisplayPrice = (tier: typeof TIERS[0]) =>
    isSaleActive ? getDiscountedPrice(tier.price) : tier.price;

  const getPriceForMethod = (currency: string, symbol: string): string => {
    if (!selectedTier) return '';
    const displayPrice = getTierDisplayPrice(selectedTier);
    if (currency !== 'RUB') {
      return `${convertTo(displayPrice, currency as any)} ${symbol}`;
    }
    return `${displayPrice.toLocaleString('ru-RU')} ₽`;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScreenshot(file);
    const reader = new FileReader();
    reader.onload = (ev) => setScreenshotPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const callPlatega = async () => {
    if (!profile || !selectedTier || !selectedMethod) return;

    setIsLoading(true);
    setErrorMsg('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${METACORE_FN_BASE}/platega-webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`,
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRnc3FleGxta25uYmRlaWtyamJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5MDI0ODEsImV4cCI6MjA5NTQ3ODQ4MX0.UbuUvgif9vlm6KRHRNHkXkxvB3JGI2y0D5SsKvze-MY',
        },
        body: JSON.stringify({
          action: 'create',
          profileId: profile.id,
          productId: `jarvis_industries_${selectedTier.id}`,
          productName: selectedTier.fullName,
          price: getTierDisplayPrice(selectedTier),
          telegramId: profile.telegram_id,
          username: profile.username,
          paymentMethodId: selectedMethod,
          currency: 'RUB',
          isJarvisIndustries: true,
          tier: selectedTier.id,
        }),
      });

      const data = await response.json();
      console.log('[JI] callPlatega response:', response.status, data);

      if (!response.ok || data?.error) {
        setErrorMsg(data?.error || `Ошибка создания платежа (${response.status})`);
        return;
      }

      setPaymentUrl(data.redirect);
      setTransactionId(data.transactionId);
      setStep('pending');
      window.open(data.redirect, '_blank');
    } catch (e) {
      console.error('[JI] callPlatega error:', e);
      setErrorMsg('Ошибка соединения с платёжным сервисом');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendScreenshot = async () => {
    if (!screenshot || !profile || !selectedTier) return;
    setStep('sending');
    setErrorMsg('');

    const methodName = METHOD_NAMES[selectedMethod || ''] || selectedMethod || '';

    try {
      // 1. Создаём заявку в БД
      const { data, error } = await supabase
        .from('jarvis_industries_purchases')
        .insert({
          profile_id: profile.id,
          tier: selectedTier.id,
          tier_name: selectedTier.fullName,
          tokens: selectedTier.tokens,
          price: getTierDisplayPrice(selectedTier),
          status: 'pending',
          payment_method: methodName,
          username: profile.username,
          telegram_id: profile.telegram_id,
          purchased_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error || !data) throw new Error(error?.message || 'Ошибка создания заявки');

      console.log('[JI] Purchase created:', data.id);

      // 2. Отправляем уведомление через edge function
      try {
        const fd = new FormData();
        fd.append('purchase_id', data.id);
        fd.append('is_ji', 'true');
        fd.append('photo', screenshot, screenshot.name || 'screenshot.jpg');

        const { data: { session } } = await supabase.auth.getSession();
        const fnRes = await fetch('https://dgsqexlmknnbdeikrjba.supabase.co/functions/v1/send-notification', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token || 'anon'}`,
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRnc3FleGxta25uYmRlaWtyamJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5MDI0ODEsImV4cCI6MjA5NTQ3ODQ4MX0.UbuUvgif9vlm6KRHRNHkXkxvB3JGI2y0D5SsKvze-MY',
          },
          body: fd,
        });
        const fnText = await fnRes.text();
        console.log('[JI] send-notification status:', fnRes.status, 'response:', fnText);
        if (!fnRes.ok) {
          console.error('[JI] send-notification FAILED:', fnRes.status, fnText);
          toast.error('Ошибка отправки уведомления: ' + fnText.substring(0, 100));
        }
      } catch (e) {
        console.error('[JI] send-notification exception:', e);
        toast.error('Ошибка соединения при отправке уведомления');
      }

      setStep('success');
      setTimeout(() => goToProfile(), 3000);

    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Ошибка отправки';
      setErrorMsg(msg);
      setStep('screenshot');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Скопировано!');
  };

  const getTitle = () => {
    switch (step) {
      case 'privacy': return 'Пользовательское соглашение';
      case 'privacy-policy': return 'Политика конфиденциальности';
      case 'info': return 'Jarvis Industries';
      case 'tier': return 'Выберите тариф';
      case 'payment': return `Оплата — ${selectedTier?.name}`;
      case 'pending': return 'Ожидание оплаты';
      case 'requisites': return 'Реквизиты';
      case 'screenshot': return '📎 Скриншот оплаты';
      case 'sending': return '📎 Скриншот оплаты';
      case 'success': return '✅ Заявка отправлена!';
    }
  };

  const getSubtitle = () => {
    switch (step) {
      case 'privacy': return 'Перед покупкой ознакомьтесь с пользовательским соглашением.';
      case 'privacy-policy': return 'Ознакомьтесь с политикой конфиденциальности и подтвердите согласие.';
      case 'info': return 'Apex Technology — персональный цифровой дворецкий нового поколения';
      case 'tier': return 'Jarvis Industries — выберите подходящий тариф';
      case 'payment': return `${selectedTier?.fullName} — ${selectedTier?.price.toLocaleString('ru-RU')} ₽`;
      case 'pending': return `${selectedTier?.fullName} — ожидаем подтверждение оплаты`;
      case 'requisites': return `${selectedTier?.fullName} — ${selectedTier?.price.toLocaleString('ru-RU')} ₽`;
      case 'screenshot': return 'Прикрепите скриншот оплаты';
      case 'sending': return 'Отправляем заявку...';
      case 'success': return 'Мы проверим оплату и активируем доступ';
    }
  };

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={handleClose}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-[201] w-[92%] max-w-[500px] -translate-x-1/2 -translate-y-1/2 border border-zinc-800 bg-black p-6 shadow-2xl rounded-[32px] outline-none max-h-[90vh] overflow-y-auto data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">

          {/* Header */}
          <div className="mb-5">
            <div className="flex justify-between items-start">
              <DialogPrimitive.Title className="text-xl font-bold uppercase tracking-tight text-white">
                {getTitle()}
              </DialogPrimitive.Title>
              <button onClick={handleClose} className="text-zinc-500 hover:text-white transition-colors flex-shrink-0 ml-4">
                <X className="h-5 w-5" />
              </button>
            </div>
            <DialogPrimitive.Description className="text-zinc-500 text-xs text-left mt-1">
              {getSubtitle()}
            </DialogPrimitive.Description>
          </div>

          {/* PRIVACY */}
          {step === 'privacy' && (
            <PrivacyPolicyStep
              onAccept={() => {
                localStorage.setItem('vibe_privacy_policy_accepted', '1');
                const policyAccepted = localStorage.getItem('vibe_privacy_policy_consent_accepted') === '1';
                setStep(policyAccepted ? 'info' : 'privacy-policy');
                toast.success('Пользовательское соглашение принято');
              }}
              onDecline={() => {
                toast.error('Для покупки необходимо принять пользовательское соглашение');
                handleClose();
              }}
            />
          )}

          {/* PRIVACY POLICY */}
          {step === 'privacy-policy' && (
            <PrivacyPolicyConsentStep
              onAccept={() => {
                localStorage.setItem('vibe_privacy_policy_consent_accepted', '1');
                setStep('info');
                toast.success('Политика конфиденциальности принята');
              }}
              onDecline={() => {
                toast.error('Для покупки необходимо принять политику конфиденциальности');
                handleClose();
              }}
            />
          )}

          {/* INFO */}
          {step === 'info' && (
            <div className="space-y-4">
              {/* Hero */}
              <div className="relative overflow-hidden rounded-2xl border border-white/10">
                <img src="/assets/jarvis-industries-mk3.jpg" alt="Jarvis Industries" className="w-full h-36 object-cover opacity-80" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent flex flex-col justify-end p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-black bg-red-500/90 text-white px-2 py-0.5 rounded-full uppercase tracking-widest">Apex Technology</span>
                    <span className="text-[10px] font-black bg-white/10 text-white px-2 py-0.5 rounded-full uppercase tracking-widest border border-white/10">🎙️ Голос JARVIS из фильма</span>
                  </div>
                  <p className="text-white font-black text-lg uppercase tracking-tight leading-tight">Операционная надстройка HUD</p>
                  <p className="text-zinc-400 text-[11px] mt-0.5">Реальный голос JARVIS из «Железного человека» — не синтез, а оригинальный актёрский голос</p>
                </div>
              </div>

              {/* Features grid */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { icon: <Brain size={16} />, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20', title: 'AI & Голос', desc: 'GPT-5.4, STT/TTS, Wikipedia, ElevenLabs' },
                  { icon: <Monitor size={16} />, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', title: 'Система', desc: 'Управление окнами, файлами, питанием, звуком' },
                  { icon: <Eye size={16} />, color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20', title: 'Зрение', desc: 'Анализ экрана, перехват ссылок, INTERCEPTOR' },
                  { icon: <Shield size={16} />, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20', title: 'Мониторинг', desc: 'CPU, RAM, диск, процессы, алерты в реальном времени' },
                  { icon: <Zap size={16} />, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20', title: 'Автоматизация', desc: 'Loadouts, макросы, цепочки команд, .exe запуск' },
                  { icon: <Heart size={16} />, color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20', title: 'Bio-Sync', desc: 'Pomodoro, защита глаз 20-20-20, стресс-монитор' },
                  { icon: <BookOpen size={16} />, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20', title: 'Органайзер', desc: 'AI-заметки, напоминания, карты, FORGE, DATALINK' },
                  { icon: <Palette size={16} />, color: 'text-pink-400', bg: 'bg-pink-500/10 border-pink-500/20', title: 'HUD Интерфейс', desc: 'Дизайн Iron Man, Reactor HUD, темы, 3D-глобус' },
                ].map((f, i) => (
                  <div key={i} className={`rounded-2xl border p-3 ${f.bg}`}>
                    <div className={`${f.color} mb-1.5`}>{f.icon}</div>
                    <p className="text-white font-bold text-[12px] leading-tight">{f.title}</p>
                    <p className="text-zinc-500 text-[10px] mt-0.5 leading-snug">{f.desc}</p>
                  </div>
                ))}
              </div>

              {/* Voice highlight */}
              <div className="relative overflow-hidden rounded-2xl border border-red-500/20 bg-gradient-to-r from-red-950/40 to-black p-4">
                <div className="absolute right-3 top-3 text-4xl opacity-10">🎙️</div>
                <p className="text-[10px] font-black uppercase tracking-widest text-red-400 mb-1">Эксклюзивно</p>
                <p className="text-white font-black text-sm leading-tight">Реальный голос JARVIS из «Железного человека»</p>
                <p className="text-zinc-500 text-[11px] mt-1 leading-relaxed">Не синтез и не имитация — оригинальный актёрский голос, который вы слышали в фильме. Ваш персональный дворецкий говорит именно так.</p>
              </div>

              <Button
                onClick={() => setStep('tier')}
                className="w-full h-14 bg-white text-black font-black uppercase rounded-2xl hover:bg-zinc-200 active:scale-95 transition-all"
              >
                <span className="flex items-center gap-2">
                  Выбрать тариф <ChevronDown size={18} />
                </span>
              </Button>
            </div>
          )}

          {/* TIER SELECTION */}
          {step === 'tier' && (
            <div className="space-y-3">
              {TIERS.map((tier) => (
                <div
                  key={tier.id}
                  onClick={() => { setSelectedTier(tier); setStep('payment'); }}
                  className={`relative overflow-hidden rounded-2xl border cursor-pointer transition-all active:scale-[0.98] hover:border-white/20 ${tier.border} bg-gradient-to-r ${tier.gradient} shadow-lg ${tier.glow}`}
                >
                  {tier.popular && (
                    <div className="absolute top-3 right-3 text-[10px] font-black bg-green-500 text-black px-2 py-0.5 rounded-full uppercase tracking-widest">
                      Популярный
                    </div>
                  )}
                  <div className="flex items-center gap-4 p-4">
                    <div className="w-14 h-14 rounded-2xl overflow-hidden flex-shrink-0 border border-white/10">
                      <img src={tier.image} alt={tier.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-white text-base uppercase tracking-tight">{tier.name}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${tier.badge}`}>
                          {tier.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Zap size={11} className="text-zinc-500" />
                        <span className="text-xs text-zinc-400 font-medium">{tier.tokens.toLocaleString('ru-RU')} токенов</span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {tier.features.slice(1).map((f, i) => (
                          <span key={i} className="text-[9px] text-zinc-600 bg-white/3 px-1.5 py-0.5 rounded-lg">{f}</span>
                        ))}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {isSaleActive && (
                        <div className="text-xs text-zinc-500 line-through font-medium text-right">{tier.price.toLocaleString('ru-RU')} ₽</div>
                      )}
                      <div className={`text-lg font-black ${isSaleActive ? 'text-rose-400' : 'text-white'}`}>
                        {getTierDisplayPrice(tier).toLocaleString('ru-RU')} ₽
                      </div>
                      {isSaleActive && (
                        <div className="text-[9px] text-rose-400 font-bold">-{salePercent}%</div>
                      )}
                      <ChevronRight size={16} className="text-zinc-600 ml-auto mt-1" />
                    </div>
                  </div>
                </div>
              ))}

              {!profile && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-4">
                  <p className="text-yellow-400 text-sm">Войдите в аккаунт для покупки</p>
                </div>
              )}
            </div>
          )}

          {/* PAYMENT METHOD */}
          {step === 'payment' && selectedTier && (
            <div className="space-y-4">
              {/* Tier summary */}
              <div className={`flex items-center gap-3 p-4 rounded-2xl border bg-gradient-to-r ${selectedTier.gradient} ${selectedTier.border}`}>
                <img src={selectedTier.image} alt={selectedTier.name} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-black text-white text-sm uppercase">{selectedTier.name} — {selectedTier.label}</p>
                  <p className="text-xs text-zinc-400">{selectedTier.tokens.toLocaleString('ru-RU')} токенов</p>
                </div>
                <div className="text-right">
                  {isSaleActive && (
                    <div className="text-xs text-zinc-500 line-through">{selectedTier.price.toLocaleString('ru-RU')} ₽</div>
                  )}
                  <p className={`font-black text-lg ${isSaleActive ? 'text-rose-400' : 'text-white'}`}>
                    {getTierDisplayPrice(selectedTier).toLocaleString('ru-RU')} ₽
                  </p>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600 mb-2 px-1">💳 Платёжные методы</p>
                <div className="space-y-2">
                  {PLATEGA_METHODS.map((method) => (
                    <div key={method.id} onClick={() => setSelectedMethod(method.id)}
                      className={`flex items-center rounded-2xl border transition-all cursor-pointer ${selectedMethod === method.id ? 'border-white bg-zinc-900' : 'border-transparent bg-zinc-900/50 hover:bg-zinc-800/80'}`}>
                      <div className="flex-1 flex items-center gap-3 p-4">
                        <span className="text-zinc-400">{method.icon}</span>
                        <span className="font-medium text-[14px] text-zinc-100">{method.name}</span>
                        {method.badge && <span className="text-[10px] bg-white/10 text-zinc-400 px-2 py-0.5 rounded-full">{method.badge}</span>}
                      </div>
                      <span className="text-sm font-mono text-zinc-500 pr-4">{getTierDisplayPrice(selectedTier).toLocaleString('ru-RU')} ₽</span>
                    </div>
                  ))}
                  {MANUAL_METHODS.map((method) => (
                    <div key={method.id} onClick={() => setSelectedMethod(method.id)}
                      className={`flex items-center rounded-2xl border transition-all cursor-pointer ${selectedMethod === method.id ? 'border-white bg-zinc-900' : 'border-transparent bg-zinc-900/50 hover:bg-zinc-800/80'}`}>
                      <div className="flex-1 flex items-center gap-3 p-4">
                        <span className="text-zinc-400">{method.icon}</span>
                        <span className="font-medium text-[14px] text-zinc-100">{method.name}</span>
                        {method.badge && <span className="text-[10px] bg-white/10 text-zinc-400 px-2 py-0.5 rounded-full">{method.badge}</span>}
                      </div>
                      <span className="text-sm font-mono text-zinc-500 pr-4">
                        {getPriceForMethod(method.currency, method.symbol)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {errorMsg && <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4"><p className="text-red-400 text-sm">{errorMsg}</p></div>}
              {!profile && <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-4"><p className="text-yellow-400 text-sm">Войдите в аккаунт для оплаты</p></div>}

              <div className="flex gap-3">
                <button onClick={() => { setStep('tier'); setSelectedMethod(null); }} className="h-14 px-5 rounded-2xl border border-white/10 text-zinc-500 hover:text-white transition-all font-bold text-sm">
                  ← Назад
                </button>
                <Button
                  onClick={() => {
                    if (!selectedMethod) { setErrorMsg('Выберите способ оплаты'); return; }
                    if (!profile) { setErrorMsg('Войдите в аккаунт'); return; }
                    setErrorMsg('');
                    if (isPlatega) {
                      void callPlatega();
                    } else {
                      setStep('requisites');
                    }
                  }}
                  disabled={!selectedMethod || isLoading}
                  className="flex-1 h-14 bg-white text-black font-black uppercase rounded-2xl hover:bg-zinc-200 disabled:opacity-30 active:scale-95 transition-all"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2"><Loader2 className="animate-spin" size={18} /> Открываем оплату...</span>
                  ) : isPlatega ? (
                    `Оплатить ${getTierDisplayPrice(selectedTier).toLocaleString('ru-RU')} ₽`
                  ) : (
                    'Показать реквизиты'
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* REQUISITES */}
          {step === 'requisites' && selectedManual && selectedTier && (
            <div className="space-y-4">
              {selectedManual.requisites.map((req, i) => (
                <div key={i} className="bg-zinc-900/60 p-4 rounded-2xl border border-white/5 flex justify-between items-center">
                  <div>
                    <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">{req.label}</p>
                    <p className="font-mono text-base tracking-wider text-white mt-1">{req.value}</p>
                  </div>
                  <button onClick={() => { navigator.clipboard.writeText(req.value); toast.success('Скопировано!'); }} className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl transition-colors ml-3"><Copy size={16} /></button>
                </div>
              ))}
              <div className="bg-zinc-900/30 p-4 rounded-2xl border border-white/5 space-y-1">
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  Переведите{" "}
                  <span className="text-white font-bold">
                    {getPriceForMethod(selectedManual.currency, selectedManual.symbol)}
                  </span>{" "}
                  по реквизитам выше и укажите в комментарии название тарифа.
                </p>
                {selectedManual.currency !== 'RUB' && (
                  <p className="text-[10px] text-zinc-600">
                    = {getTierDisplayPrice(selectedTier).toLocaleString('ru-RU')} ₽ по актуальному курсу
                  </p>
                )}
              </div>
              <button onClick={() => window.open(selectedManual.infoUrl, '_blank')} className="w-full flex items-center justify-center gap-2 text-zinc-500 hover:text-white text-sm transition-colors py-2">
                <ExternalLink size={14} /> Инструкция по оплате
              </button>
              <div className="flex gap-3">
                <button onClick={() => { setStep('payment'); }} className="h-14 px-5 rounded-2xl border border-white/10 text-zinc-500 hover:text-white transition-all font-bold text-sm">
                  ← Назад
                </button>
                <Button
                  onClick={() => { setStep('screenshot'); }}
                  className="flex-1 h-14 bg-white text-black font-black uppercase rounded-2xl hover:bg-zinc-200"
                >
                  Я оплатил — прикрепить скриншот
                </Button>
              </div>
            </div>
          )}

          {step === 'pending' && selectedTier && (
            <div className="space-y-4">
              <div className="bg-zinc-900/50 p-5 rounded-2xl border border-white/5 space-y-3">
                <p className="text-zinc-300 text-sm font-medium text-center">Страница оплаты открыта в новой вкладке.</p>
                <div className="flex items-start gap-3 bg-white/3 rounded-xl p-3 border border-white/5">
                  <User size={14} className="text-zinc-500 flex-shrink-0 mt-0.5" />
                  <p className="text-zinc-500 text-xs leading-relaxed">
                    После оплаты нажмите кнопку ниже — мы проверим статус и активируем доступ к <span className="text-white font-bold">{selectedTier.name}</span> автоматически.
                  </p>
                </div>
                {transactionId && (
                  <div className="rounded-xl border border-white/5 bg-black/40 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600">Transaction ID</p>
                    <p className="mt-1 font-mono text-xs text-zinc-300 break-all">{transactionId}</p>
                  </div>
                )}
              </div>

              {errorMsg && <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4"><p className="text-red-400 text-sm">{errorMsg}</p></div>}

              <Button onClick={handleCheckStatus} disabled={isCheckingStatus} className="w-full h-14 bg-white text-black font-black uppercase rounded-2xl hover:bg-zinc-200 active:scale-95 transition-all disabled:opacity-60">
                {isCheckingStatus
                  ? <span className="flex items-center gap-2"><Loader2 className="animate-spin" size={18} /> Проверяем оплату...</span>
                  : <span className="flex items-center gap-2"><CheckCircle size={18} /> Я оплатил — проверить статус <ArrowRight size={16} /></span>
                }
              </Button>

              <button onClick={() => paymentUrl && window.open(paymentUrl, '_blank')} className="w-full text-center text-zinc-500 hover:text-white text-sm transition-colors py-2">
                Открыть страницу оплаты снова
              </button>
            </div>
          )}

          {/* SCREENSHOT */}
          {(step === 'screenshot' || step === 'sending') && (
            <div className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${screenshotPreview ? 'border-white/20' : 'border-zinc-700 hover:border-zinc-500'}`}
              >
                {screenshotPreview ? (
                  <div className="space-y-3">
                    <img src={screenshotPreview} alt="Скриншот" className="w-full max-h-48 object-contain rounded-xl" />
                    <p className="text-zinc-500 text-xs">Нажмите, чтобы заменить</p>
                  </div>
                ) : (
                  <div className="space-y-3 py-4">
                    <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center mx-auto">
                      <ImageIcon className="text-zinc-500" size={28} />
                    </div>
                    <div>
                      <p className="text-white font-bold">Прикрепите скриншот оплаты</p>
                      <p className="text-zinc-500 text-xs mt-1">JPG, PNG — нажмите для выбора</p>
                    </div>
                  </div>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
              {errorMsg && <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4"><p className="text-red-400 text-sm">{errorMsg}</p></div>}
              <Button
                onClick={handleSendScreenshot}
                disabled={!screenshot || step === 'sending'}
                className="w-full h-14 bg-white text-black font-black uppercase rounded-2xl hover:bg-zinc-200 disabled:opacity-40"
              >
                {step === 'sending'
                  ? <span className="flex items-center gap-2"><Loader2 className="animate-spin" size={18} /> Отправляем...</span>
                  : <span className="flex items-center gap-2"><Upload size={18} /> Отправить заявку</span>
                }
              </Button>
            </div>
          )}

          {/* SUCCESS */}
          {step === 'success' && selectedTier && (
            <div className="flex flex-col gap-4 py-2">
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="relative">
                  <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center border border-white/10">
                    <CheckCircle className="text-white" size={40} />
                  </div>
                  <div className="absolute -top-1 -right-1 w-7 h-7 bg-green-500 rounded-full flex items-center justify-center border-2 border-black">
                    <span className="text-xs">✓</span>
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-white font-black text-xl uppercase tracking-tight">Заявка принята!</p>
                  <p className="text-zinc-500 text-sm mt-1">«{selectedTier.fullName}»</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 px-1">Что происходит дальше</p>
                <div className="flex items-start gap-3 bg-zinc-900/60 border border-white/5 rounded-2xl p-4">
                  <div className="w-8 h-8 bg-yellow-500/10 border border-yellow-500/20 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bell size={14} className="text-yellow-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Проверка оплаты</p>
                    <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">Администратор проверит ваш чек. Обычно до 30 минут.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 bg-zinc-900/60 border border-white/5 rounded-2xl p-4">
                  <div className="w-8 h-8 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                    <User size={14} className="text-zinc-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Ссылка появится в профиле</p>
                    <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">После одобрения ссылка на группу <span className="text-white font-bold">{selectedTier.name}</span> будет в «Мои покупки».</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button onClick={goToProfile} className="flex-[2] h-14 bg-white text-black font-black uppercase rounded-2xl hover:bg-zinc-200 active:scale-95 transition-all">
                  <span className="flex items-center gap-2">
                    <User size={16} />
                    {countdown !== null ? `Профиль через ${countdown}...` : 'Перейти в профиль'}
                    <ArrowRight size={16} />
                  </span>
                </Button>
                <Button onClick={handleClose} variant="outline" className="flex-1 h-14 border-white/10 text-zinc-400 hover:text-white rounded-2xl font-bold bg-transparent">
                  Закрыть
                </Button>
              </div>
            </div>
          )}

        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

export default JarvisIndustriesModal;