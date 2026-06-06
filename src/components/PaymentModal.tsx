"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { CreditCard, Wallet, Landmark, Bitcoin, X, ExternalLink, Loader2, CheckCircle, Copy, Smartphone, Upload, ImageIcon, User, ArrowRight, Bell } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useAuth } from "@/hooks/use-auth";
import { useCurrency } from "@/hooks/use-currency";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import PrivacyPolicyStep from "@/components/PrivacyPolicyStep";
import PrivacyPolicyConsentStep from "@/components/PrivacyPolicyConsentStep";
import { supabase } from '@/integrations/supabase/client';
import { METACORE_PAYMENT_URL, METACORE_FN_BASE, METACORE_SUPABASE_KEY } from '@/integrations/supabase/metacore-client';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  productId?: string;
  productPrice?: number;
  containerRef?: React.RefObject<HTMLDivElement>;
}

const PLATEGA_METHODS = [
  { id: 'sbp',    name: 'СБП / Карты РФ',             icon: <Smartphone className="w-4 h-4" />, badge: 'Авто',   country: '🇷🇺 Россия',   currency: 'RUB',  symbol: '₽', rate: 1.0 },
  { id: 'crypto', name: 'Криптовалюта (CryptoBot)',   icon: <Bitcoin className="w-4 h-4" />,    badge: 'Авто',   country: '🌍 Весь мир', currency: 'USDT', symbol: '$', rate: 0.011 },
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


const PaymentModal: React.FC<PaymentModalProps> = ({ isOpen, onClose, productName, productId, productPrice }) => {
  const { profile } = useAuth();
  const { currency, convertPrice, getSymbol, convertTo } = useCurrency();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'pending' | 'screenshot' | 'sending' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [showRequisites, setShowRequisites] = useState(false);
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);

  useEffect(() => {
    if (status === 'success') {
      setCountdown(3);
      const interval = setInterval(() => {
        setCountdown(prev => {
          if (prev === null || prev <= 1) { clearInterval(interval); return null; }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [status]);

  useEffect(() => {
    if (!isOpen) return;
    const agreementAccepted = localStorage.getItem('vibe_privacy_policy_accepted') === '1';
    const policyAccepted = localStorage.getItem('vibe_privacy_policy_consent_accepted') === '1';
    const fullyAccepted = agreementAccepted && policyAccepted;
    setPrivacyAccepted(fullyAccepted);
    setShowPrivacy(!agreementAccepted);
    setShowPrivacyPolicy(agreementAccepted && !policyAccepted);
  }, [isOpen]);

  const isPlatega = PLATEGA_METHODS.some(m => m.id === selectedMethod);
  const selectedManual = MANUAL_METHODS.find(m => m.id === selectedMethod) || null;

  const priceInCurrency = productPrice
    ? `${convertPrice(productPrice)} ${getSymbol()}`
    : '';

  const getPriceForMethod = (methodCurrency: string, methodSymbol: string): string => {
    if (!productPrice) return '';
    const currencyMap: Record<string, string> = {
      'RUB': 'RUB', 'KZT': 'KZT', 'UAH': 'UAH',
      'BYN': 'BYN', 'USD': 'USD', 'EUR': 'EUR',
      'PLN': 'PLN', 'GBP': 'GBP', 'TRY': 'TRY', 'USDT': 'USD',
    };
    const mapped = currencyMap[methodCurrency];
    if (mapped && mapped !== 'RUB') {
      return `${convertTo(productPrice, mapped as any)} ${methodSymbol}`;
    }
    return `${productPrice.toLocaleString('ru-RU')} ₽`;
  };

  const copyToClipboard = (text: string) => { navigator.clipboard.writeText(text); toast.success('Скопировано!'); };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScreenshot(file);
    const reader = new FileReader();
    reader.onload = (ev) => setScreenshotPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSendScreenshot = async () => {
    if (!screenshot || !profile) return;
    setStatus('sending');
    setErrorMsg('');

    const methodName = METHOD_NAMES[selectedMethod || ''] || selectedMethod || '';
    const isJI = productId?.startsWith('jarvis_industries_');

    try {
      // 1. Создаём заявку в БД
      let purchaseId: string | null = null;

      if (isJI) {
        const tier = productId!.replace('jarvis_industries_', '');
        const { data, error } = await supabase
          .from('jarvis_industries_purchases')
          .insert({
            profile_id: profile.id,
            tier,
            tier_name: productName,
            tokens: 0,
            price: productPrice || 0,
            status: 'pending',
            payment_method: methodName,
            username: profile.username,
            telegram_id: profile.telegram_id,
            purchased_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (error || !data) throw new Error(error?.message || 'Ошибка создания заявки');
        purchaseId = data.id;
      } else {
        const { data, error } = await supabase
          .from('purchases')
          .insert({
            profile_id: profile.id,
            product_id: productId || productName.toLowerCase().replace(/\s+/g, '_'),
            product_name: productName,
            price: productPrice || 0,
            status: 'pending',
            payment_method: methodName,
          })
          .select()
          .single();

        if (error || !data) throw new Error(error?.message || 'Ошибка создания заявки');
        purchaseId = data.id;
      }

      console.log('[PM] Purchase created:', purchaseId);

      // 2. Отправляем уведомление через edge function
      try {
        const fd = new FormData();
        fd.append('purchase_id', purchaseId!);
        fd.append('is_ji', isJI ? 'true' : 'false');
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
        console.log('[PM] send-notification status:', fnRes.status, 'response:', fnText);
        if (!fnRes.ok) {
          console.error('[PM] send-notification FAILED:', fnRes.status, fnText);
          toast.error('Ошибка отправки уведомления: ' + fnText.substring(0, 100));
        }
      } catch (e) {
        console.error('[PM] send-notification exception:', e);
        toast.error('Ошибка соединения при отправке уведомления');
      }

      setStatus('success');
      setTimeout(() => { onClose(); navigate('/profile'); }, 3000);

    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Ошибка отправки';
      setErrorMsg(msg);
      setStatus('screenshot');
    }
  };

  const callPlatega = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const url = `${METACORE_FN_BASE}/platega-webhook`;

      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token || ''}`,
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRnc3FleGxta25uYmRlaWtyamJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5MDI0ODEsImV4cCI6MjA5NTQ3ODQ4MX0.UbuUvgif9vlm6KRHRNHkXkxvB3JGI2y0D5SsKvze-MY',
      };

      const body = {
        action: 'create',
        profileId: profile!.id,
        productId: productId || productName.toLowerCase().replace(/\s+/g, '_'),
        productName,
        price: productPrice || 0,
        telegramId: profile!.telegram_id,
        username: profile!.username,
        paymentMethodId: selectedMethod,
        currency: 'RUB',
      };

      const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
      const data = await response.json();
      console.log('[callPlatega] response:', response.status, data);
      if (!response.ok || data?.error) {
        setErrorMsg(data?.error || `Ошибка создания платежа (${response.status})`);
      } else {
        setPaymentUrl(data.redirect);
        setTransactionId(data.transactionId);
        setStatus('pending');
        window.open(data.redirect, '_blank');
      }
    } catch (e) {
      console.error('[callPlatega] error:', e);
      setErrorMsg('Ошибка соединения с платёжным сервисом');
    }
    setIsLoading(false);
  };

  const handlePay = async () => {
    if (!privacyAccepted) { setShowPrivacy(true); return; }
    if (!selectedMethod) { setErrorMsg('Выберите способ оплаты'); return; }
    if (!profile) { setErrorMsg('Необходимо войти в аккаунт'); return; }
    setErrorMsg('');
    if (isPlatega) {
      await callPlatega();
    } else {
      setShowRequisites(true);
    }
  };

  const goToProfile = () => {
    // Сбрасываем состояние
    setSelectedMethod(null); setPaymentUrl(null); setTransactionId(null);
    setStatus('idle'); setErrorMsg(''); setShowRequisites(false);
    setScreenshot(null); setScreenshotPreview(null);
    // Закрываем и переходим
    onClose();
    navigate('/profile');
  };

  const handleCheckStatus = async () => {
    if (!transactionId || !profile) { goToProfile(); return; }

    setIsLoading(true);
    setErrorMsg('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const checkUrl = `${METACORE_FN_BASE}/platega-webhook`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token || ''}`,
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRnc3FleGxta25uYmRlaWtyamJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5MDI0ODEsImV4cCI6MjA5NTQ3ODQ4MX0.UbuUvgif9vlm6KRHRNHkXkxvB3JGI2y0D5SsKvze-MY',
      };
      const res = await fetch(checkUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'check', transactionId, profileId: profile.id }),
      });
      const data = await res.json();
      console.log('[PM] check-payment result:', data);
      if (data.status === 'CONFIRMED') {
        setStatus('success');
        setTimeout(() => { onClose(); navigate('/profile'); }, 3000);
      } else {
        goToProfile();
      }
    } catch (e) {
      console.error('[PM] check-payment error:', e);
      goToProfile();
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedMethod(null); setPaymentUrl(null); setTransactionId(null);
    setStatus('idle'); setErrorMsg(''); setShowRequisites(false);
    setScreenshot(null); setScreenshotPreview(null);
    setShowPrivacy(false);
    setShowPrivacyPolicy(false);
    onClose();
  };

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={handleClose}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-[201] w-[92%] max-w-[480px] -translate-x-1/2 -translate-y-1/2 border border-zinc-800 bg-black p-6 shadow-2xl rounded-[32px] outline-none max-h-[88vh] overflow-y-auto data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">

          {/* Header */}
          <div className="mb-5">
            <div className="flex justify-between items-start">
              <DialogPrimitive.Title className="text-xl font-bold uppercase tracking-tight text-white">
                {showPrivacy ? 'Пользовательское соглашение' : showPrivacyPolicy ? 'Политика конфиденциальности' : status === 'success' ? '✅ Заявка отправлена!' : status === 'screenshot' || status === 'sending' ? '📎 Скриншот оплаты' : showRequisites ? 'Реквизиты' : 'ОПЛАТА ЗАКАЗА'}
              </DialogPrimitive.Title>
              <button onClick={handleClose} className="text-zinc-500 hover:text-white transition-colors flex-shrink-0 ml-4">
                <X className="h-5 w-5" />
              </button>
            </div>
            <DialogPrimitive.Description className="text-zinc-500 text-xs text-left mt-1">
              {showPrivacy
                ? 'Перед покупкой ознакомьтесь с пользовательским соглашением.'
                : showPrivacyPolicy
                  ? 'Ознакомьтесь с политикой конфиденциальности и подтвердите согласие.'
                  : status === 'success'
                    ? 'Мы проверим оплату и активируем товар'
                    : `«${productName}» — ${priceInCurrency}`}
            </DialogPrimitive.Description>
          </div>

          {showPrivacy ? (
            <PrivacyPolicyStep
              onAccept={() => {
                localStorage.setItem('vibe_privacy_policy_accepted', '1');
                setShowPrivacy(false);
                const policyAccepted = localStorage.getItem('vibe_privacy_policy_consent_accepted') === '1';
                if (policyAccepted) {
                  setPrivacyAccepted(true);
                } else {
                  setShowPrivacyPolicy(true);
                }
                toast.success('Пользовательское соглашение принято');
              }}
              onDecline={() => {
                toast.error('Для покупки необходимо принять пользовательское соглашение');
                handleClose();
              }}
            />
          ) : showPrivacyPolicy ? (
            <PrivacyPolicyConsentStep
              onAccept={() => {
                localStorage.setItem('vibe_privacy_policy_consent_accepted', '1');
                setPrivacyAccepted(true);
                setShowPrivacyPolicy(false);
                toast.success('Политика конфиденциальности принята');
              }}
              onDecline={() => {
                toast.error('Для покупки необходимо принять политику конфиденциальности');
                handleClose();
              }}
            />
          ) : (
            <>
              {/* Успех */}
              {status === 'success' && (
                <div className="flex flex-col gap-4 py-2">
                  {/* Иконка успеха */}
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
                      <p className="text-zinc-500 text-sm mt-1">«{productName}»</p>
                    </div>
                  </div>

                  {/* Шаги что будет дальше */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 px-1">Что происходит дальше</p>

                    <div className="flex items-start gap-3 bg-zinc-900/60 border border-white/5 rounded-2xl p-4">
                      <div className="w-8 h-8 bg-yellow-500/10 border border-yellow-500/20 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Bell size={14} className="text-yellow-400" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">Проверка оплаты</p>
                        <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">Администратор проверит ваш чек. Обычно это занимает до 30 минут.</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 bg-zinc-900/60 border border-white/5 rounded-2xl p-4">
                      <div className="w-8 h-8 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                        <User size={14} className="text-zinc-400" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">Ссылки появятся в профиле</p>
                        <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">После одобрения все ссылки и доступы к продукту будут в разделе <span className="text-white font-bold">«Мои покупки»</span> в вашем профиле.</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 bg-zinc-900/60 border border-white/5 rounded-2xl p-4">
                      <div className="w-8 h-8 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                        <CheckCircle size={14} className="text-zinc-400" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">Получите доступ</p>
                        <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">Нажмите кнопку <span className="text-white font-bold">«Получить продукт»</span> в профиле — вас добавят в закрытую группу.</p>
                      </div>
                    </div>
                  </div>

                  {/* Кнопки */}
                  <div className="flex gap-3 pt-2">
                    <Button
                      onClick={goToProfile}
                      className="flex-[2] h-14 bg-white text-black font-black uppercase rounded-2xl hover:bg-zinc-200 active:scale-95 transition-all"
                    >
                      <span className="flex items-center gap-2">
                        <User size={16} />
                        {countdown !== null ? `Профиль через ${countdown}...` : 'Перейти в профиль'}
                        <ArrowRight size={16} />
                      </span>
                    </Button>
                    <Button
                      onClick={handleClose}
                      variant="outline"
                      className="flex-1 h-14 border-white/10 text-zinc-400 hover:text-white hover:border-white/20 rounded-2xl font-bold bg-transparent"
                    >
                      Закрыть
                    </Button>
                  </div>
                </div>
              )}

              {/* Загрузка скриншота */}
              {(status === 'screenshot' || status === 'sending') && (
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
                    disabled={!screenshot || status === 'sending'}
                    className="w-full h-14 bg-white text-black font-black uppercase rounded-2xl hover:bg-zinc-200 disabled:opacity-40"
                  >
                    {status === 'sending' ? (
                      <span className="flex items-center gap-2"><Loader2 className="animate-spin" size={18} /> Отправляем...</span>
                    ) : (
                      <span className="flex items-center gap-2"><Upload size={18} /> Отправить заявку</span>
                    )}
                  </Button>
                </div>
              )}

              {/* Ожидание Platega */}
              {status === 'pending' && (
                <div className="space-y-4">
                  <div className="bg-zinc-900/50 p-5 rounded-2xl border border-white/5 space-y-3">
                    <p className="text-zinc-300 text-sm font-medium text-center">Страница оплаты открыта в новой вкладке.</p>
                    <div className="flex items-start gap-3 bg-white/3 rounded-xl p-3 border border-white/5">
                      <User size={14} className="text-zinc-500 flex-shrink-0 mt-0.5" />
                      <p className="text-zinc-500 text-xs leading-relaxed">
                        После оплаты нажмите кнопку ниже — мы проверим статус и перенаправим вас в <span className="text-white font-bold">профиль</span>, где появятся все ссылки на продукт.
                      </p>
                    </div>
                  </div>
                  {errorMsg && <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4"><p className="text-red-400 text-sm">{errorMsg}</p></div>}
                  <Button onClick={handleCheckStatus} disabled={isLoading} className="w-full h-14 bg-white text-black font-black uppercase rounded-2xl hover:bg-zinc-200 active:scale-95 transition-all disabled:opacity-60">
                    {isLoading
                      ? <span className="flex items-center gap-2"><Loader2 className="animate-spin" size={18} /> Проверяем оплату...</span>
                      : <span className="flex items-center gap-2"><CheckCircle size={18} /> Я оплатил — проверить статус <ArrowRight size={16} /></span>
                    }
                  </Button>
                  <button onClick={() => paymentUrl && window.open(paymentUrl, '_blank')} className="w-full text-center text-zinc-500 hover:text-white text-sm transition-colors py-2">
                    Открыть страницу оплаты снова
                  </button>
                </div>
              )}

              {/* Ручные реквизиты */}
              {showRequisites && selectedManual && status === 'idle' && (
                <div className="space-y-4">
                  {selectedManual.requisites.map((req, i) => (
                    <div key={i} className="bg-zinc-900/60 p-4 rounded-2xl border border-white/5 flex justify-between items-center">
                      <div>
                        <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">{req.label}</p>
                        <p className="font-mono text-base tracking-wider text-white mt-1">{req.value}</p>
                      </div>
                      <button onClick={() => copyToClipboard(req.value)} className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl transition-colors ml-3"><Copy size={16} /></button>
                    </div>
                  ))}
                  <div className="bg-zinc-900/30 p-4 rounded-2xl border border-white/5 space-y-1">
                    <p className="text-[11px] text-zinc-500 leading-relaxed">
                      Переведите{" "}
                      <span className="text-white font-bold">
                        {getPriceForMethod(selectedManual.currency, selectedManual.symbol)}
                      </span>{" "}
                      по реквизитам выше и укажите в комментарии название товара.
                    </p>
                    {selectedManual.currency !== 'RUB' && (
                      <p className="text-[10px] text-zinc-600">
                        = {productPrice?.toLocaleString('ru-RU')} ₽ по актуальному курсу
                      </p>
                    )}
                  </div>
                  <button onClick={() => window.open(selectedManual.infoUrl, '_blank')} className="w-full flex items-center justify-center gap-2 text-zinc-500 hover:text-white text-sm transition-colors py-2">
                    <ExternalLink size={14} /> Инструкция по оплате
                  </button>
                  <Button
                    onClick={() => { setStatus('screenshot'); }}
                    className="w-full h-14 bg-white text-black font-black uppercase rounded-2xl hover:bg-zinc-200"
                  >
                    Я оплатил — прикрепить скриншот
                  </Button>
                </div>
              )}

              {/* Выбор метода */}
              {!showRequisites && status === 'idle' && (
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600 mb-2 px-1">
                      💳 Платёжные методы
                    </p>
                    <div className="space-y-2">
                      {PLATEGA_METHODS.map((method) => (
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

                  <Button onClick={handlePay} disabled={isLoading || !selectedMethod}
                    className="w-full h-14 bg-white text-black font-black uppercase text-sm tracking-widest rounded-2xl hover:bg-zinc-200 transition-all active:scale-95">
                    {isLoading ? (
                      <Loader2 className="animate-spin" size={20} />
                    ) : isPlatega ? (
                      `Оплатить ${priceInCurrency}`
                    ) : (
                      'Показать реквизиты'
                    )}
                  </Button>
                </div>
              )}
            </>
          )}

        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

export default PaymentModal;