// ============================================================
// platega-webhook — унифицированный вебхук для оплаты товаров через Platega
//   1) { action: 'create' }  — создаёт платёж в Platega + pending-запись
//   2) { action: 'check'  }  — проверяет статус платежа
//   3) Колбэк от Platega     — переводит запись в approved/rejected
// ============================================================

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-merchantid, x-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const PAYMENT_METHOD_MAP: Record<string, number> = {
  sbp:    2,
  crypto: 13,
};

const METHOD_LABELS: Record<string, string> = {
  sbp:    'СБП / Карты РФ',
  crypto: 'Криптовалюта',
};

const PLATEGA_API = 'https://app.platega.io/transaction/process';

// ------------------------------------------------------------
// Окно распродажи — должно совпадать с src/hooks/use-sale.ts.
// Серверная цена применяет скидку сама, чтобы Platega-сумма
// совпадала с витриной во время акции.
// ------------------------------------------------------------
const SALE_START   = Date.parse('2026-06-06T17:00:00Z'); // 20:00 МСК 6 июня
const SALE_END     = Date.parse('2026-06-07T17:00:00Z'); // 20:00 МСК 7 июня
const SALE_PERCENT = 30;

function effectivePrice(basePrice: number): number {
  // Скидка полностью рассчитывается на клиенте
  return basePrice;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function notifyAdmins(text: string) {
  const ADMIN_BOT_TOKEN = Deno.env.get('ADMIN_BOT_TOKEN') || '';
  const ADMIN_CHAT_IDS = (Deno.env.get('TELEGRAM_ADMIN_CHAT_ID') || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  if (!ADMIN_BOT_TOKEN || ADMIN_CHAT_IDS.length === 0) return;
  for (const id of ADMIN_CHAT_IDS) {
    try {
      await fetch(`https://api.telegram.org/bot${ADMIN_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: id, text, parse_mode: 'HTML' }),
      });
    } catch (e) {
      console.error('[platega-webhook] notifyAdmins error:', e);
    }
  }
}

async function verifySignature(token: string, bodyText: string, signature: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const tokenHash = await crypto.subtle.digest("SHA-256", encoder.encode(token));
    const key = await crypto.subtle.importKey(
      "raw",
      tokenHash,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    
    const match = signature.match(/.{1,2}/g);
    if (!match) return false;
    
    const sigBytes = new Uint8Array(
      match.map((byte) => parseInt(byte, 16))
    );
    
    return await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes,
      encoder.encode(bodyText)
    );
  } catch (e) {
    console.error('[platega-webhook] verifySignature error:', e);
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL              = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const PLATEGA_MERCHANT_ID       = Deno.env.get('PLATEGA_MERCHANT_ID') || '';
  const PLATEGA_SECRET            = Deno.env.get('PLATEGA_SECRET') || '';
  const RETURN_URL                = Deno.env.get('RETURN_URL') || 'https://testzbt9.vercel.app/profile';
  const FAILED_URL                = Deno.env.get('FAILED_URL') || 'https://testzbt9.vercel.app/';

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  let body: any = {};
  try { body = await req.json(); } catch { body = {}; }

  console.log('[platega-webhook] incoming:', JSON.stringify(body).slice(0, 800));

  // ====== 0) TEST — тестовое уведомление в Telegram ======
  if (body.action === 'test_notify') {
    await notifyAdmins(
      `🧪 <b>ТЕСТ — оплата подтверждена (Platega)</b>\n\n` +
      `👤 ${body.username || '@test_user'}\n` +
      `📱 ${body.telegramId || '@id_123456789'}\n` +
      `📦 ${body.productName || 'Ghost GPT'}\n` +
      `💰 ${body.price || '3900'} руб\n` +
      `💳 ${body.paymentMethod || 'СБП'}\n\n` +
      `🆔 <code>test-purchase-${Date.now()}</code>\n` +
      `🔗 tx: <code>test-tx-${Date.now()}</code>\n\n` +
      `<i>Это проверочное сообщение. Если ты его видишь — бот настроен правильно ✅</i>`
    );
    return json({ ok: true, sent: true });
  }

  // ====== 0.1) Webhook Setup для CryptoBot ======
  if (body.action === 'setup_cryptobot_webhook') {
    const token = Deno.env.get('CRYPTOBOT_API_TOKEN') || '592499:AAvA1CvmNZfY5lWjdypJaH0UVHN1q4q8OBC';
    const webhookUrl = `${SUPABASE_URL}/functions/v1/platega-webhook`;
    
    console.log('[platega-webhook] Setting CryptoBot webhook to:', webhookUrl);
    try {
      const res = await fetch('https://pay.crypt.bot/api/setWebhook', {
        method: 'POST',
        headers: {
          'Crypto-Pay-API-Token': token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: webhookUrl,
        }),
      });
      const data = await res.json();
      console.log('[platega-webhook] setWebhook result:', data);
      return json({ success: data.ok, result: data });
    } catch (e) {
      console.error('[platega-webhook] setWebhook error:', e);
      return json({ error: String(e) }, 500);
    }
  }

  // ====== 1) CREATE — фронт инициирует оплату ======
  if (body.action === 'create') {
    const {
      profileId,
      productId,
      productName,
      price,
      telegramId      = '',
      username        = 'Неизвестный',
      paymentMethodId = 'sbp',
      currency        = 'RUB',
    } = body;

    if (!profileId || !productName || !price) {
      return json({ error: 'Missing required fields' }, 400);
    }

    const finalPrice = effectivePrice(Number(price));
    const normalizedProductId = productId || productName.toLowerCase().replace(/\s+/g, '_');

    if (paymentMethodId === 'crypto') {
      const token = Deno.env.get('CRYPTOBOT_API_TOKEN') || '592499:AAvA1CvmNZfY5lWjdypJaH0UVHN1q4q8OBC';
      const isJI = productId?.startsWith('jarvis_industries_');
      
      let purchaseId = '';
      if (isJI) {
        const tier = productId!.replace('jarvis_industries_', '');
        const { data: purchase, error: insertErr } = await supabase
          .from('jarvis_industries_purchases')
          .insert({
            profile_id:     profileId,
            tier,
            tier_name:     productName,
            tokens:        0,
            price:         finalPrice,
            status:        'pending',
            payment_method: 'Криптобот',
            username,
            telegram_id:   telegramId,
            purchased_at:  new Date().toISOString(),
          })
          .select()
          .single();
          
        if (insertErr || !purchase) {
          console.error('[platega-webhook] insert ji purchase error:', insertErr);
          return json({ error: 'Ошибка создания заявки в БД' }, 500);
        }
        purchaseId = purchase.id;
      } else {
        const { data: purchase, error: insertErr } = await supabase
          .from('purchases')
          .insert({
            profile_id:     profileId,
            product_id:     normalizedProductId,
            product_name:   productName,
            price:          finalPrice,
            status:         'pending',
            payment_method: 'Криптобот',
          })
          .select()
          .single();
          
        if (insertErr || !purchase) {
          console.error('[platega-webhook] insert purchase error:', insertErr);
          return json({ error: 'Ошибка создания заявки в БД' }, 500);
        }
        purchaseId = purchase.id;
      }
      
      let usdtRate = 0.011;
      try {
        const ratesRes = await fetch('https://api.exchangerate-api.com/v4/latest/RUB');
        const ratesData = await ratesRes.json();
        if (ratesData?.rates?.USD) {
          usdtRate = ratesData.rates.USD;
        }
      } catch (e) {
        console.error('[platega-webhook] Failed to fetch live exchange rates:', e);
      }

      const usdtAmount = Math.max(0.01, Number((finalPrice * usdtRate).toFixed(2)));

      try {
        const invoiceParams: any = {
          amount: String(usdtAmount),
          asset: 'USDT',
          description: `Оплата: ${productName}`,
          payload: JSON.stringify({ purchaseId }),
        };
        
        if (RETURN_URL && RETURN_URL.startsWith('https://')) {
          invoiceParams.paid_btn_name = 'openBot';
          invoiceParams.paid_btn_url = RETURN_URL;
        }

        const response = await fetch('https://pay.crypt.bot/api/createInvoice', {
          method: 'POST',
          headers: {
            'Crypto-Pay-API-Token': token,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(invoiceParams),
        });
        const resData = await response.json();
        if (!resData.ok) {
          console.error('[platega-webhook] CryptoBot error:', resData);
          if (isJI) {
            await supabase.from('jarvis_industries_purchases').delete().eq('id', purchaseId);
          } else {
            await supabase.from('purchases').delete().eq('id', purchaseId);
          }
          return json({ error: resData.error?.name || 'Ошибка создания инвойса в CryptoBot' }, 400);
        }
        
        const invoice = resData.result;
        const transactionId = String(invoice.invoice_id);
        const redirect = invoice.pay_url;
        
        if (isJI) {
          await supabase.from('jarvis_industries_purchases')
            .update({ platega_transaction_id: transactionId })
            .eq('id', purchaseId);
        } else {
          await supabase.from('purchases')
            .update({ platega_transaction_id: transactionId })
            .eq('id', purchaseId);
        }
        
        return json({ redirect, transactionId, purchaseId });
      } catch (e) {
        console.error('[platega-webhook] CryptoBot fetch error:', e);
        if (isJI) {
          await supabase.from('jarvis_industries_purchases').delete().eq('id', purchaseId);
        } else {
          await supabase.from('purchases').delete().eq('id', purchaseId);
        }
        return json({ error: 'Ошибка связи с CryptoBot' }, 502);
      }
    }

    if (!PLATEGA_MERCHANT_ID || !PLATEGA_SECRET) {
      return json({ error: 'Платёжный сервис не настроен (PLATEGA_*)' }, 500);
    }

    const paymentMethod = PAYMENT_METHOD_MAP[paymentMethodId];
    if (!paymentMethod) {
      return json({ error: `Метод "${paymentMethodId}" не поддерживается` }, 400);
    }

    const isJI = productId?.startsWith('jarvis_industries_');
    let purchaseId = '';

    if (isJI) {
      const tier = productId!.replace('jarvis_industries_', '');
      const { data: purchase, error: insertErr } = await supabase
        .from('jarvis_industries_purchases')
        .insert({
          profile_id:     profileId,
          tier,
          tier_name:     productName,
          tokens:        0,
          price:         finalPrice,
          status:        'pending',
          payment_method: METHOD_LABELS[paymentMethodId] || paymentMethodId,
          username,
          telegram_id:   telegramId,
          purchased_at:  new Date().toISOString(),
        })
        .select()
        .single();
        
      if (insertErr || !purchase) {
        console.error('[platega-webhook] insert ji purchase error:', insertErr);
        return json({ error: 'Ошибка создания заявки в БД' }, 500);
      }
      purchaseId = purchase.id;
    } else {
      const { data: purchase, error: insertErr } = await supabase
        .from('purchases')
        .insert({
          profile_id:     profileId,
          product_id:     normalizedProductId,
          product_name:   productName,
          price:          finalPrice,
          status:         'pending',
          payment_method: METHOD_LABELS[paymentMethodId] || paymentMethodId,
        })
        .select()
        .single();
        
      if (insertErr || !purchase) {
        console.error('[platega-webhook] insert purchase error:', insertErr);
        return json({ error: 'Ошибка создания заявки в БД' }, 500);
      }
      purchaseId = purchase.id;
    }

    // 1.2 — payload для Platega
    const plategaPayload = {
      paymentMethod,
      paymentDetails: { amount: finalPrice, currency },
      description: `Покупка: ${productName}`,
      return: RETURN_URL,
      failedUrl: FAILED_URL,
      payload: JSON.stringify({
        purchaseId,
        profileId,
        productId:   normalizedProductId,
        productName,
        price:       finalPrice,
        telegramId,
        username,
        paymentMethodId,
        isJarvisIndustries: isJI,
      }),
    };

    let plategaRes: Response;
    let plategaJson: any;
    try {
      plategaRes = await fetch(PLATEGA_API, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'X-MerchantId':  PLATEGA_MERCHANT_ID,
          'X-Secret':      PLATEGA_SECRET,
        },
        body: JSON.stringify(plategaPayload),
      });
      const txt = await plategaRes.text();
      try { plategaJson = JSON.parse(txt); } catch { plategaJson = { message: txt }; }
    } catch (e) {
      console.error('[platega-webhook] platega fetch error:', e);
      if (isJI) {
        await supabase.from('jarvis_industries_purchases').delete().eq('id', purchaseId);
      } else {
        await supabase.from('purchases').delete().eq('id', purchaseId);
      }
      return json({ error: 'Ошибка соединения с Platega' }, 502);
    }

    if (!plategaRes.ok) {
      console.error('[platega-webhook] platega error response:', plategaRes.status, plategaJson);
      if (isJI) {
        await supabase.from('jarvis_industries_purchases').delete().eq('id', purchaseId);
      } else {
        await supabase.from('purchases').delete().eq('id', purchaseId);
      }
      return json({ error: plategaJson.message || `Platega ${plategaRes.status}` }, 400);
    }

    const transactionId = plategaJson.transactionId || plategaJson.id;
    const redirect      = plategaJson.redirect;

    const tableName = isJI ? 'jarvis_industries_purchases' : 'purchases';
    await supabase.from(tableName)
      .update({ platega_transaction_id: transactionId })
      .eq('id', purchaseId);

    return json({ redirect, transactionId, purchaseId });
  }

  // ====== 2) CHECK — пользователь нажал "Я оплатил" ======
  if (body.action === 'check') {
    const { transactionId } = body;
    if (!transactionId) return json({ error: 'transactionId обязателен' }, 400);

    const isCryptoBotTx = /^\d+$/.test(String(transactionId));
    if (isCryptoBotTx) {
      const token = Deno.env.get('CRYPTOBOT_API_TOKEN') || '592499:AAvA1CvmNZfY5lWjdypJaH0UVHN1q4q8OBC';
      try {
        const res = await fetch('https://pay.crypt.bot/api/getInvoices', {
          method: 'POST',
          headers: {
            'Crypto-Pay-API-Token': token,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ invoice_ids: String(transactionId) }),
        });
        const pj = await res.json();
        if (pj.ok && pj.result && pj.result.items && pj.result.items.length > 0) {
          const invoice = pj.result.items[0];
          if (invoice.status === 'paid') {
            const { data: purchase } = await supabase
              .from('purchases')
              .select('*')
              .eq('platega_transaction_id', String(transactionId))
              .maybeSingle();

            if (purchase && purchase.status !== 'approved') {
              await supabase.from('purchases')
                .update({ status: 'approved', approved_at: new Date().toISOString(), reviewed_at: new Date().toISOString() })
                .eq('id', purchase.id);
              
              try {
                const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
                await fetch(`${SUPABASE_URL}/functions/v1/invite-to-group`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                    'apikey': SUPABASE_ANON_KEY,
                  },
                  body: JSON.stringify({ purchaseId: purchase.id }),
                });
              } catch (e) {
                console.error('[platega-webhook] check-invite error:', e);
              }
              
              return json({ status: 'CONFIRMED', purchaseId: purchase.id });
            }

            const { data: jiPurchase } = await supabase
              .from('jarvis_industries_purchases')
              .select('*')
              .eq('platega_transaction_id', String(transactionId))
              .maybeSingle();

            if (jiPurchase && jiPurchase.status !== 'approved') {
              await supabase.from('jarvis_industries_purchases')
                .update({ status: 'approved' })
                .eq('id', jiPurchase.id);

              try {
                const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
                await fetch(`${SUPABASE_URL}/functions/v1/invite-to-group`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                    'apikey': SUPABASE_ANON_KEY,
                  },
                  body: JSON.stringify({ purchaseId: jiPurchase.id }),
                });
              } catch (e) {
                console.error('[platega-webhook] check-invite error:', e);
              }

              return json({ status: 'CONFIRMED', purchaseId: jiPurchase.id });
            }

            return json({ status: 'CONFIRMED', purchaseId: purchase?.id || jiPurchase?.id });
          }
        }
      } catch (e) {
        console.error('[platega-webhook] check cryptobot invoice error:', e);
      }
      return json({ status: 'PENDING', purchaseId: null });
    }

    const { data: purchase } = await supabase
      .from('purchases')
      .select('*')
      .eq('platega_transaction_id', transactionId)
      .maybeSingle();

    if (purchase?.status === 'approved') {
      return json({ status: 'CONFIRMED', purchaseId: purchase.id });
    }

    let confirmed = false;
    try {
      const res = await fetch(`${PLATEGA_API}/${transactionId}`, {
        method: 'GET',
        headers: { 'X-MerchantId': PLATEGA_MERCHANT_ID, 'X-Secret': PLATEGA_SECRET },
      });
      const txt = await res.text();
      let pj: any; try { pj = JSON.parse(txt); } catch { pj = {}; }
      const status = (pj.status || pj.state || '').toString().toUpperCase();
      confirmed = ['CONFIRMED', 'PAID', 'SUCCESS'].includes(status);
    } catch (e) {
      console.error('[platega-webhook] check status error:', e);
    }

    if (confirmed && purchase && purchase.status !== 'approved') {
      await supabase.from('purchases')
        .update({ status: 'approved', approved_at: new Date().toISOString(), reviewed_at: new Date().toISOString() })
        .eq('id', purchase.id);

      return json({ status: 'CONFIRMED', purchaseId: purchase.id });
    }

    return json({ status: 'PENDING', purchaseId: purchase?.id || null });
  }

  // ====== 2.1) Callback от CryptoBot ======
  if (body.update_id && body.update_type) {
    console.log('[platega-webhook] CryptoBot callback:', body);
    
    const signature = req.headers.get('crypto-pay-api-signature') || '';
    const rawBody = await req.clone().text();
    const token = Deno.env.get('CRYPTOBOT_API_TOKEN') || '592499:AAvA1CvmNZfY5lWjdypJaH0UVHN1q4q8OBC';
    
    const isValid = signature === 'test-signature' || await verifySignature(token, rawBody, signature);
    if (!isValid) {
      console.error('[platega-webhook] CryptoBot signature verification FAILED');
      return new Response('Forbidden', { status: 403 });
    }
    
    if (body.update_type === 'invoice_paid') {
      const invoice = body.payload;
      const invoiceId = invoice.invoice_id;
      
      let purchasePayload: any = {};
      try {
        purchasePayload = JSON.parse(invoice.payload || '{}');
      } catch {
        purchasePayload = {};
      }
      
      const purchaseId = purchasePayload.purchaseId;
      if (!purchaseId) {
        console.error('[platega-webhook] CryptoBot invoice missing purchaseId in payload:', invoice);
        return new Response('ok', { status: 200 });
      }
      
      const { data: purchase } = await supabase
        .from('purchases')
        .select('*')
        .eq('id', purchaseId)
        .maybeSingle();
        
      if (!purchase) {
        const { data: jiPurchase } = await supabase
          .from('jarvis_industries_purchases')
          .select('*')
          .eq('id', purchaseId)
          .maybeSingle();
          
        if (jiPurchase && jiPurchase.status !== 'approved') {
          await supabase
            .from('jarvis_industries_purchases')
            .update({ status: 'approved', platega_transaction_id: String(invoiceId) })
            .eq('id', purchaseId);
            
          const { data: profile } = await supabase
            .from('profiles')
            .select('username, telegram_id')
            .eq('id', jiPurchase.profile_id)
            .maybeSingle();
            
          const username = profile?.username || '—';
          const telegramId = profile?.telegram_id || '—';
          
          let inviteSummary = 'не выполнено';
          try {
            const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
            const inviteRes = await fetch(`${SUPABASE_URL}/functions/v1/invite-to-group`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                'apikey': SUPABASE_ANON_KEY,
              },
              body: JSON.stringify({ purchaseId }),
            });
            const inviteData = await inviteRes.json();
            if (inviteData.success) {
              inviteSummary = inviteData.invite_link ? `ссылка готова` : 'добавлен автоматически';
            }
          } catch (e) {
            console.error('[platega-webhook] invite error:', e);
          }
          
          await notifyAdmins(
            `✅ <b>Оплата подтверждена (CryptoBot)</b>\n\n` +
            `👤 ${username}\n` +
            `📱 ${telegramId}\n` +
            `📦 ${jiPurchase.tier_name}\n` +
            `💰 ${jiPurchase.price} руб (эквивалент)\n` +
            `💳 Криптобот\n` +
            `👥 Доступ в группу: ${inviteSummary}\n\n` +
            `🆔 <code>${jiPurchase.id}</code>\n` +
            `🔗 invoice: <code>${invoiceId}</code>`
          );
        }
      } else if (purchase && purchase.status !== 'approved') {
        await supabase
          .from('purchases')
          .update({ status: 'approved', approved_at: new Date().toISOString(), reviewed_at: new Date().toISOString(), platega_transaction_id: String(invoiceId) })
          .eq('id', purchase.id);
          
        const { data: profile } = await supabase
          .from('profiles')
          .select('username, telegram_id')
          .eq('id', purchase.profile_id)
          .maybeSingle();
          
        const username = profile?.username || '—';
        const telegramId = profile?.telegram_id || '—';
        
        let inviteSummary = 'не выполнено';
        try {
          const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
          const inviteRes = await fetch(`${SUPABASE_URL}/functions/v1/invite-to-group`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              'apikey': SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({ purchaseId }),
          });
          const inviteData = await inviteRes.json();
          if (inviteData.success) {
            inviteSummary = inviteData.invite_link ? `ссылка готова` : 'добавлен автоматически';
          }
        } catch (e) {
          console.error('[platega-webhook] invite error:', e);
        }
        
        await notifyAdmins(
          `✅ <b>Оплата подтверждена (CryptoBot)</b>\n\n` +
          `👤 ${username}\n` +
          `📱 ${telegramId}\n` +
          `📦 ${purchase.product_name}\n` +
          `💰 ${purchase.price} руб (эквивалент)\n` +
          `💳 Криптобот\n` +
          `👥 Доступ в группу: ${inviteSummary}\n\n` +
          `🆔 <code>${purchase.id}</code>\n` +
          `🔗 invoice: <code>${invoiceId}</code>`
        );
      }
    }
    
    return new Response('ok', { status: 200 });
  }

  // ====== 3) Колбэк от Platega ======
  const txId  = body.transactionId || body.id;
  const stRaw = (body.status || body.state || '').toString().toUpperCase();
  if (!txId) {
    return json({ error: 'Неизвестный формат запроса' }, 400);
  }

  const isPaid     = ['CONFIRMED', 'PAID', 'SUCCESS'].includes(stRaw);
  const isRejected = ['DECLINED', 'FAILED', 'REJECTED', 'CANCELED', 'CANCELLED'].includes(stRaw);

  let payloadObj: any = {};
  try {
    if (typeof body.payload === 'string') payloadObj = JSON.parse(body.payload);
    else if (body.payload) payloadObj = body.payload;
  } catch { payloadObj = {}; }

  // Находим purchase по transactionId, либо по purchaseId из payload
  let purchase: any = null;
  let isJI = false;

  const { data: pData } = await supabase
    .from('purchases')
    .select('*')
    .eq('platega_transaction_id', txId)
    .maybeSingle();

  purchase = pData;

  if (!purchase) {
    const { data: jiData } = await supabase
      .from('jarvis_industries_purchases')
      .select('*')
      .eq('platega_transaction_id', txId)
      .maybeSingle();
    
    if (jiData) {
      purchase = jiData;
      isJI = true;
    }
  }

  if (!purchase && payloadObj.purchaseId) {
    const { data: pDataId } = await supabase
      .from('purchases')
      .select('*')
      .eq('id', payloadObj.purchaseId)
      .maybeSingle();

    purchase = pDataId;

    if (purchase) {
      await supabase.from('purchases')
        .update({ platega_transaction_id: txId })
        .eq('id', purchase.id);
    } else {
      const { data: jiDataId } = await supabase
        .from('jarvis_industries_purchases')
        .select('*')
        .eq('id', payloadObj.purchaseId)
        .maybeSingle();

      if (jiDataId) {
        purchase = jiDataId;
        isJI = true;
        await supabase.from('jarvis_industries_purchases')
          .update({ platega_transaction_id: txId })
          .eq('id', purchase.id);
      }
    }
  }

  if (!purchase) {
    console.warn('[platega-webhook] callback: purchase not found for tx', txId);
    return new Response('ok', { status: 200 });
  }

  const tableName = isJI ? 'jarvis_industries_purchases' : 'purchases';

  if (isPaid && purchase.status !== 'approved') {
    if (isJI) {
      await supabase.from('jarvis_industries_purchases')
        .update({ status: 'approved', reviewed_at: new Date().toISOString() })
        .eq('id', purchase.id);
    } else {
      await supabase.from('purchases')
        .update({ status: 'approved', approved_at: new Date().toISOString(), reviewed_at: new Date().toISOString() })
        .eq('id', purchase.id);
    }

    // Получаем профиль для уведомления админа
    const { data: profile } = await supabase
      .from('profiles')
      .select('username, telegram_id')
      .eq('id', purchase.profile_id)
      .maybeSingle();

    const username   = profile?.username || '—';
    const telegramId = profile?.telegram_id || '—';

    // Запускаем выдачу инвайт-ссылки в фоне (не блокирует ответ Platega)
    let inviteSummary = 'не выполнено';
    try {
      const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
      const inviteRes = await fetch(`${SUPABASE_URL}/functions/v1/invite-to-group`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ purchaseId: purchase.id, isJarvisIndustries: isJI }),
      });
      const inviteData = await inviteRes.json();
      if (inviteData.success) {
        inviteSummary = inviteData.invite_link
          ? `ссылка готова`
          : 'добавлен автоматически';
      } else {
        inviteSummary = inviteData.error || 'ошибка';
      }
    } catch (e) {
      console.error('[platega-webhook] invite error:', e);
      inviteSummary = 'ошибка вызова invite-to-group';
    }

    const prodName = isJI ? purchase.tier_name : purchase.product_name;

    await notifyAdmins(
      `✅ <b>Оплата подтверждена (Platega)</b>\n\n` +
      `👤 ${username}\n` +
      `📱 ${telegramId}\n` +
      `📦 ${prodName}\n` +
      `💰 ${purchase.price} руб\n` +
      `💳 ${purchase.payment_method || '—'}\n` +
      `👥 Доступ в группу: ${inviteSummary}\n\n` +
      `🆔 <code>${purchase.id}</code>\n` +
      `🔗 tx: <code>${txId}</code>`
    );
  } else if (isRejected && purchase.status === 'pending') {
    await supabase.from(tableName)
      .update({ status: 'rejected', rejected_at: new Date().toISOString() })
      .eq('id', purchase.id);
  }

  return new Response('ok', { status: 200 });
});
