"use client";

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Headphones, Newspaper, User, Gift, Clock, ScrollText } from "lucide-react";
import ProductCard from '@/components/ProductCard';
import PaymentModal from '@/components/PaymentModal';
import InfoModal from '@/components/InfoModal';
import JarvisIndustriesModal from '@/components/JarvisIndustriesModal';
import LegalDocsModal from '@/components/LegalDocsModal';
import { useAuth } from '@/hooks/use-auth';
import { useSale } from '@/hooks/use-sale';

const JARVIS_INDUSTRIES_ID = 'jarvis-industries';

const products = [
  {
    id: 'jarvis-hud',
    name: 'Jarvis',
    description: 'Персональный AI поверх рабочего стола — прозрачный HUD в стиле Iron Man с распознаванием речи и Vision.',
    fullInfo: '🦾 JARVIS HUD — твой персональный AI поверх рабочего стола\n\nПомнишь Тони Старка, который говорил «Джарвис, статус систем» — и в воздухе разворачивался голубой HUD? Теперь это работает у тебя на ПК.\n\nРаспознаёт речь локально, отвечает голосом, думает через ваш API KEY.\n\n━━━━━━━━━━━━━━━━━━━━━\n\n🔥 Что внутри:\n\n🔹 Прозрачный HUD-оверлей в стиле Iron Man Mark I\n🔹 Виджеты: CPU / RAM / GPU / часы / радар / now-playing\n🔹 Wake-word активация — микрофон не палит звук в облако\n🔹 Vision — Джарвис видит твой экран и комментирует\n🔹 Память на 30 дней, помнит контекст диалогов\n🔹 Проактивные уведомления: батарея, перегрев, Windows-нотификации\n🔹 Click-through — не мешает играм и работе\n🔹 Горячая клавиша Ctrl+Alt+J — настройки поверх любого окна\n\n🔐 Привязка к HWID · 14 дней офлайн-grace\n🇷🇺 Полностью на русском\n\n━━━━━━━━━━━━━━━━━━━━━\n\nНе просто «голосовой помощник». Это интерфейс из фильма, который работает.\n\n🔐 Лицензия\n• 1 ключ = 1 ПК (привязка к железу)\n• 14 дней работы без интернета\n\n━━━━━━━━━━━━━━━━━━━━━\n📦 Версия: 0.1.0',
    price: '6999',
    image: '/assets/jarvis-hud.jpg',
    isComingSoon: false,
    isNew: true
  },
  {
    id: 'ghost-gpt',
    name: 'Ghost GPT',
    description: 'Невидимый AI-оверлей поверх любого окна — не палится в OBS, Discord, Zoom, Teams и Skype.',
    fullInfo: '👻 Ghost GPT — AI, которого не видит никто, кроме тебя\n\nПрозрачный оверлей поверх любого окна, который не палится в OBS, Discord, Zoom, Teams и Skype. Зрители стрима, собеседник на созвоне и собеседник на интервью — все они видят твой обычный экран. А ты видишь ответы GPT в реальном времени.\n\n━━━━━━━━━━━━━━━━━━━━━\n\n🎙 Слышит микрофон + системный звук\nЗахватывает голос собеседника через loopback (WASAPI) — не надо настраивать виртуальные кабели.\n\n🧠 Локальное распознавание речи\nWhisper (ggml-small.bin) работает офлайн прямо на твоём ПК. Звук никуда не уходит.\n\n⚡ Push-to-Talk на боковой кнопке мыши\nЗажал Mouse 5 → Ghost GPT слушает → отпустил → ответ GPT уже на экране.\n\n━━━━━━━━━━━━━━━━━━━━━\n\n🔥 Что внутри:\n\n🔹 Невидимость для screen capture (WDA_EXCLUDEFROMCAPTURE)\n🔹 VAD — отсекает тишину автоматически\n🔹 4 LLM на выбор: OpenAI · Anthropic Claude · OpenRouter · Gemini\n🔹 История диалога — 24 последних сообщения в контексте\n🔹 Свой ключ (BYOK) — платишь только провайдеру\n🔹 Тёмный минималистичный UI с красным акцентом\n🔹 Single-exe установка через Inno Setup\n\n🔐 Активация: Telegram-бот выдаёт ключ под твоё железо (HWID)\n🇷🇺 Полный русский, и распознавание, и ответы\n\n━━━━━━━━━━━━━━━━━━━━━\n\n▎ Идеально для: технических интервью, онлайн-экзаменов, созвонов, стримов, где нужна вторая голова рядом.',
    price: '3900',
    image: '/assets/ghost-gpt.jpg',
    isComingSoon: false,
    isNew: true
  },
];

const Index = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { isActive: isSaleActive, showBanner, isUpcoming, countdown, percent, getDiscountedPrice } = useSale();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [isJarvisIndustriesOpen, setIsJarvisIndustriesOpen] = useState(false);
  const [isLegalDocsOpen, setIsLegalDocsOpen] = useState(false);

  const handlePay = (productName: string, productId: string) => {
    if (productId === JARVIS_INDUSTRIES_ID) {
      setIsJarvisIndustriesOpen(true);
      return;
    }

    setSelectedProduct(productName);
    setIsPayModalOpen(true);
  };

  const handleInfo = (productName: string) => {
    setSelectedProduct(productName);
    setIsInfoModalOpen(true);
  };

  const currentProduct = products.find(p => p.name === selectedProduct) || null;
  // Цена со скидкой, если распродажа активна
  const currentProductPrice = currentProduct
    ? (isSaleActive ? getDiscountedPrice(parseInt(currentProduct.price) || 0) : (parseInt(currentProduct.price) || 0))
    : 0;

  return (
    <div className="min-h-screen bg-black font-sans text-white flex flex-col">

      {/* На ПК — iPad frame, на телефоне — полный экран */}
      <div
        ref={containerRef}
        className="
          flex flex-col flex-1
          w-full h-screen
          sm:relative sm:mx-auto sm:my-auto sm:w-full sm:max-w-[1024px] sm:h-[768px]
          sm:rounded-[40px] sm:border-[12px] sm:border-zinc-900
          sm:shadow-[0_0_100px_rgba(0,0,0,0.8)]
          bg-black overflow-hidden
        "
      >
        {/* Header */}
        <header className="pt-safe pt-4 sm:pt-10 pb-3 sm:pb-6 px-4 sm:px-12 flex justify-between items-center bg-black/80 backdrop-blur-xl z-20 flex-shrink-0">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Магазин</p>
            <p className="text-base sm:text-xl font-black tracking-tighter uppercase italic">Apex Technology</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsLegalDocsOpen(true)}
              className="h-9 sm:h-10 px-3 sm:px-3.5 rounded-full border border-white/10 bg-zinc-900 text-zinc-300 hover:text-white hover:border-white/20 active:scale-95 transition-all flex items-center gap-1.5"
              aria-label="Документы и соглашения"
            >
              <ScrollText size={14} />
              <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider">Документы</span>
            </button>
            <button
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden border border-white/10 active:scale-95 transition-transform bg-zinc-900 flex items-center justify-center"
              onClick={() => profile ? navigate('/profile') : navigate('/login')}
            >
              {profile ? (
                profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white font-black text-sm uppercase">{profile.username.charAt(0)}</span>
                )
              ) : (
                <User size={16} className="text-zinc-400" />
              )}
            </button>
          </div>
        </header>

        {/* Карточки */}
        <main className="flex-1 overflow-y-auto px-3 sm:px-12 pb-3 sm:pb-12">

          {/* 🎉 RELEASE Banner — Jarvis · Ghost GPT вышли в полной версии */}
          {showBanner && (
            <div className="mb-3 sm:mb-6 relative overflow-hidden rounded-2xl sm:rounded-3xl">
              {/* Фоновый градиент: фиолетово-синий праздничный */}
              <div className={`absolute inset-0 ${isSaleActive
                ? 'bg-gradient-to-br from-fuchsia-600 via-violet-600 to-blue-600'
                : 'bg-gradient-to-br from-violet-900 via-indigo-900 to-blue-900'}`} />
              {/* Тёмный оверлей */}
              <div className="absolute inset-0 bg-black/50" />
              {/* Мерцающий glow */}
              {isSaleActive && (
                <div className="absolute -inset-[1px] rounded-2xl sm:rounded-3xl bg-gradient-to-r from-fuchsia-500 via-purple-400 to-blue-500 opacity-60 blur-sm animate-pulse" />
              )}
              {/* Шиммер */}
              <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl sm:rounded-3xl">
                <div className="absolute -inset-y-4 -left-1/2 w-1/3 rotate-12 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
              </div>
              {/* Конфетти-эмодзи в углах */}
              {isSaleActive && (
                <>
                  <span className="absolute top-2 right-12 text-xl sm:text-2xl opacity-70 animate-pulse">✨</span>
                  <span className="absolute bottom-3 left-8 text-base sm:text-xl opacity-60 animate-pulse" style={{ animationDelay: '0.4s' }}>🎊</span>
                  <span className="absolute top-1/2 right-4 text-sm sm:text-lg opacity-50 animate-pulse" style={{ animationDelay: '0.8s' }}>⭐</span>
                </>
              )}

              <div className="relative px-4 py-4 sm:px-6 sm:py-5">
                {isSaleActive ? (
                  <>
                    {/* Верх: бейдж RELEASE + таймер */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="bg-white text-black text-[10px] sm:text-xs font-black px-2.5 py-1 rounded-full uppercase tracking-widest animate-pulse">
                          🎉 РЕЛИЗ
                        </span>
                        <span className="bg-gradient-to-r from-fuchsia-400 to-purple-400 text-white text-[10px] sm:text-xs font-black px-2.5 py-1 rounded-full uppercase tracking-widest">
                          v1.0 · FULL
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-black/60 border border-white/20 rounded-xl px-3 py-1.5">
                        <Clock size={12} className="text-fuchsia-300" />
                        <span className="font-mono text-sm sm:text-base font-black text-white tabular-nums">
                          {countdown}
                        </span>
                        <span className="text-[9px] text-white/40 uppercase font-bold ml-0.5">до конца</span>
                      </div>
                    </div>
                    {/* Главная строка: продукты + скидка */}
                    <div className="flex items-end justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-white/90 text-xs sm:text-sm font-bold uppercase tracking-wider mb-1">
                          🦾 Jarvis · 👻 Ghost GPT
                        </p>
                        <p className="text-2xl sm:text-4xl font-black text-white uppercase leading-tight tracking-tight drop-shadow-[0_2px_12px_rgba(217,70,239,0.6)]">
                          ВСЕ В ПОЛНОЙ ВЕРСИИ!
                        </p>
                        <p className="text-white/70 text-[11px] sm:text-sm font-bold mt-1.5">
                          В честь релиза — <span className="text-white font-black">−{percent}%</span> на всё · до 7 июня 20:00 МСК
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="bg-white text-black px-3 py-2 rounded-2xl shadow-lg">
                          <p className="text-2xl sm:text-3xl font-black leading-none tracking-tighter">−{percent}%</p>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="bg-white/15 border border-white/30 text-white text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest">
                          ⏳ Скоро релиз
                        </span>
                        <span className="bg-fuchsia-500/30 border border-fuchsia-400/40 text-fuchsia-100 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest">
                          v1.0
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-black/40 border border-white/10 rounded-xl px-3 py-1.5">
                        <Clock size={12} className="text-fuchsia-300" />
                        <span className="font-mono text-sm font-black text-white tabular-nums">{countdown}</span>
                        <span className="text-[9px] text-white/30 uppercase font-bold ml-0.5">до старта</span>
                      </div>
                    </div>
                    <p className="text-white/80 text-xs sm:text-sm font-bold uppercase tracking-wider mb-1">
                      🦾 Jarvis · 👻 Ghost GPT
                    </p>
                    <p className="text-xl sm:text-3xl font-black text-white uppercase leading-tight tracking-tight">
                      РЕЛИЗ ПОЛНЫХ ВЕРСИЙ
                    </p>
                    <p className="text-white/60 text-xs sm:text-sm mt-1">
                      6 июня · скидка <span className="text-white font-black">−{percent}%</span> на 24 часа
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.3em] mb-3 sm:mb-6">
            Рекомендуемые товары
          </p>
          {/* Мобиль: 1 колонка. ПК: 2 колонки */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6">
            {products.map((product) => {
              const originalPrice = parseInt(product.price) || 0;
              const discountedPrice = isSaleActive && !product.isComingSoon && originalPrice > 0
                ? getDiscountedPrice(originalPrice)
                : undefined;

              return (
                <ProductCard
                  key={product.id}
                  name={product.name}
                  description={product.description}
                  price={product.price}
                  image={product.image}
                  isComingSoon={product.isComingSoon}
                  isNew={(product as any).isNew}
                  isBeta={product.id === 'jarvis-max'}
                  hasMacOS={product.id === 'jarvis-max'}
                  isMonthly={(product as any).isMonthly}
                  onPay={() => handlePay(product.name, product.id)}
                  onInfo={() => handleInfo(product.name)}
                  salePrice={discountedPrice}
                />
              );
            })}
          </div>
        </main>

        {/* Bottom Nav */}
        <nav className="pb-safe pb-4 sm:pb-10 pt-3 sm:pt-4 px-6 sm:px-10 flex justify-between items-center border-t border-white/5 bg-black/90 backdrop-blur-xl z-20 flex-shrink-0">
          <button
            onClick={() => window.open('https://t.me/vibetechhSupport?direct', '_blank')}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 active:scale-90 transition-transform text-zinc-400"
          >
            <Headphones size={20} />
          </button>
          <div className="w-12 h-1 bg-white/10 rounded-full" />
          <button
            onClick={() => window.open('https://t.me/ApexTechhh', '_blank')}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 active:scale-90 transition-transform text-zinc-400"
          >
            <Newspaper size={20} />
          </button>
        </nav>
      </div>

      <PaymentModal
        isOpen={isPayModalOpen}
        onClose={() => setIsPayModalOpen(false)}
        productName={selectedProduct || ""}
        productId={currentProduct?.id}
        productPrice={currentProductPrice}
        containerRef={containerRef}
      />

      <InfoModal
        isOpen={isInfoModalOpen}
        onClose={() => setIsInfoModalOpen(false)}
        product={currentProduct}
        containerRef={containerRef}
      />

      <JarvisIndustriesModal
        isOpen={isJarvisIndustriesOpen}
        onClose={() => setIsJarvisIndustriesOpen(false)}
      />



      <LegalDocsModal
        isOpen={isLegalDocsOpen}
        onClose={() => setIsLegalDocsOpen(false)}
      />
    </div>
  );
};

export default Index;