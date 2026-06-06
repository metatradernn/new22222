-- =========================================================================
-- ТЕСТОВЫЙ НАБОР ДЛЯ НАСТРОЙКИ И ПРОВЕРКИ КРИПТОБОТА (CRYPTOBOT)
-- =========================================================================

-- Шаг 1. Регистрируем вебхук в CryptoBot
-- Перед этим обязательно задеплойте измененную функцию:
-- supabase functions deploy platega-webhook --project-ref dgsqexlmknnbdeikrjba
--
-- Скопируйте и запустите этот блок в Supabase SQL Editor:

CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT net.http_post(
  url := 'https://dgsqexlmknnbdeikrjba.supabase.co/functions/v1/platega-webhook',
  body := '{"action": "setup_cryptobot_webhook"}'::jsonb,
  headers := '{"Content-Type": "application/json"}'::jsonb
);



-- Шаг 2. Симуляция оплаты (Тест бэкенда и вебхука)
-- Этот блок создаст тестовый заказ и сразу пошлет вебхук о его оплате.
-- Скопируйте и запустите этот блок в Supabase SQL Editor:

DO $$
DECLARE
  vprofileid UUID;
  vpurchaseid UUID;
  vresponseid BIGINT;
BEGIN
  -- 1. Находим первого пользователя из таблицы profiles
  SELECT id INTO vprofileid FROM profiles LIMIT 1;
  
  IF vprofileid IS NULL THEN
    RAISE EXCEPTION 'Ошибка: в вашей таблице profiles нет пользователей!';
  END IF;

  -- 2. Вставляем тестовую покупку со статусом pending (ожидает оплаты)
  INSERT INTO purchases (profile_id, product_id, product_name, price, status, payment_method)
  VALUES (vprofileid, 'ghost_gpt', 'Ghost GPT (Test)', 10, 'pending', 'Криптобот')
  RETURNING id INTO vpurchaseid;
  
  RAISE NOTICE 'Создана покупка с ID: %', vpurchaseid;

  -- 3. Имитируем отправку вебхука от CryptoBot об оплате этой покупки
  SELECT net.http_post(
    url := 'https://dgsqexlmknnbdeikrjba.supabase.co/functions/v1/platega-webhook',
    body := jsonb_build_object(
      'update_id', 99999,
      'update_type', 'invoice_paid',
      'payload', jsonb_build_object(
        'invoice_id', 99999,
        'status', 'paid',
        'fiat', 'RUB',
        'fiat_amount', '10',
        'payload', jsonb_build_object('purchaseId', vpurchaseid)::text
      )
    ),
    headers := '{"Content-Type": "application/json", "crypto-pay-api-signature": "test-signature"}'::jsonb
  ) INTO vresponseid;

  RAISE NOTICE 'Запрос отправлен. ID запроса: %. Статус покупки % обновится через пару секунд.', vresponseid, vpurchaseid;
END $$;



-- Шаг 3. Запрос проверки статуса (запустите через 5 секунд после Шага 2)
-- Проверяет, изменился ли статус на 'approved':

SELECT id, product_name, status, approved_at, payment_method 
FROM purchases 
ORDER BY purchased_at DESC 
LIMIT 1;
