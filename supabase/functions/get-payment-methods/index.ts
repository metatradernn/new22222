import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PLATEGA_SECRET = Deno.env.get('PLATEGA_SECRET');
    const PLATEGA_MERCHANT_ID = Deno.env.get('PLATEGA_MERCHANT_ID');

    if (!PLATEGA_SECRET || !PLATEGA_MERCHANT_ID) {
      return new Response(JSON.stringify({ error: 'Не настроены credentials' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Получаем все доступные методы
    const [methodsRes, merchantRes] = await Promise.all([
      fetch('https://app.platega.io/transaction/payment_methods', {
        headers: { 'X-MerchantId': PLATEGA_MERCHANT_ID, 'X-Secret': PLATEGA_SECRET },
      }),
      fetch(`https://app.platega.io/merchant/${PLATEGA_MERCHANT_ID}`, {
        headers: { 'X-MerchantId': PLATEGA_MERCHANT_ID, 'X-Secret': PLATEGA_SECRET },
      }),
    ]);

    const methodsText = await methodsRes.text();
    const merchantText = await merchantRes.text();

    console.log("[get-payment-methods] methodsRes status:", methodsRes.status, "body:", methodsText);
    console.log("[get-payment-methods] merchantRes status:", merchantRes.status, "body:", merchantText);

    let methodsData = {};
    try { methodsData = JSON.parse(methodsText); } catch(e) { methodsData = { errorParsing: e.message, text: methodsText }; }

    let merchantData = {};
    try { merchantData = JSON.parse(merchantText); } catch(e) { merchantData = { errorParsing: e.message, text: merchantText }; }

    return new Response(JSON.stringify({ methods: methodsData, merchant: merchantData }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("[get-payment-methods] Error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
