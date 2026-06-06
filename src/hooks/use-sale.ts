import { useState, useEffect } from 'react';

// 🤝 APEX TECHNOLOGY — скидка 30% на 24 часа
// с 06.06.2026 20:00 по 07.06.2026 20:00 МСК (МСК = UTC+3)
const SALE_START = new Date('2026-06-06T17:00:00Z'); // 20:00 МСК 6 июня
const SALE_END   = new Date('2026-06-07T17:00:00Z'); // 20:00 МСК 7 июня
const SALE_PERCENT = 30;

function isSaleNow(): boolean {
  const now = Date.now();
  return now >= SALE_START.getTime() && now < SALE_END.getTime();
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00:00';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
}

export function useSale() {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const isActive = now >= SALE_START.getTime() && now < SALE_END.getTime();

  // Если скидка ещё не началась — считаем до начала
  // Если идёт — считаем до конца
  const targetMs = now < SALE_START.getTime()
    ? SALE_START.getTime() - now
    : isActive
      ? SALE_END.getTime() - now
      : 0;

  const countdown = formatCountdown(targetMs);

  // Показываем баннер: за 24ч до начала и во время скидки
  const showBanner = now >= SALE_START.getTime() - 24 * 60 * 60 * 1000 && now < SALE_END.getTime();

  // Статус для баннера
  const isUpcoming = now < SALE_START.getTime() && showBanner;

  function getDiscountedPrice(price: number): number {
    if (!isActive || price <= 0) return price;
    return Math.round(price * (1 - SALE_PERCENT / 100));
  }

  return {
    isActive,
    showBanner,
    isUpcoming,
    percent: SALE_PERCENT,
    countdown,
    getDiscountedPrice,
    saleStart: SALE_START,
    saleEnd: SALE_END,
  };
}
