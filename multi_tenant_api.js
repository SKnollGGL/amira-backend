// ARIS Platform - Multi-Tenant API
// Handles firm signup, bot creation, subscription management

const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_KEY);
const supabase = require('@supabase/supabase-js');

const app = express();
app.use(express.json());
app.use(express.static('public'));

// Serve Alina chat on /alina-chat
app.get('/alina-chat', (req, res) => {
  const fs = require('fs');
  const path = require('path');
  const filePath = path.join(__dirname, 'public', 'alina_chat.html');

  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Chat file error:', err);
      return res.status(404).send('Chat file not found');
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(data);
  });
});

app.get('/alina_chat.html', (req, res) => {
  const fs = require('fs');
  const path = require('path');
  const filePath = path.join(__dirname, 'public', 'alina_chat.html');

  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Chat file error:', err);
      return res.status(404).send('Chat file not found');
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(data);
  });
});

// Multi-tenant Supabase clients
const getTenantDB = (firmId) => {
  return supabase.createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY,
    { headers: { 'X-Tenant-ID': firmId } }
  );
};

// ============ PHASE 1: FIRM SIGNUP ============
app.post('/api/firm/signup', async (req, res) => {
  const { firmName, email, country, planId } = req.body;

  try {
    // 1. Create firm record
    const firm = await supabase
      .from('firms')
      .insert({
        name: firmName,
        email: email,
        country: country,
        plan: planId,
        status: 'pending_payment',
        created_at: new Date()
      })
      .select()
      .single();

    // 2. Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      customer_email: email,
      line_items: [{
        price: getPriceId(planId),
        quantity: 1,
      }],
      mode: 'subscription',
      success_url: `${process.env.APP_URL}/firm/${firm.id}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_URL}/platform/pricing`,
      metadata: { firmId: firm.id }
    });

    res.json({
      firmId: firm.id,
      checkoutUrl: session.url
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ============ PHASE 2: PAYMENT WEBHOOK ============
app.post('/api/webhooks/stripe', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const event = stripe.webhooks.constructEvent(
    req.body,
    sig,
    process.env.STRIPE_WEBHOOK_SECRET
  );

  if (event.type === 'checkout.session.completed') {
    const { metadata } = event.data.object;
    const firmId = metadata.firmId;

    // Create firm instance
    await createFirmInstance(firmId);

    // Activate subscription
    await supabase
      .from('firms')
      .update({ status: 'active', subscription_active: true })
      .eq('id', firmId);
  }

  res.json({ received: true });
});

// ============ PHASE 3: BOT PROVISIONING ============
app.post('/api/firm/:firmId/create-bot', async (req, res) => {
  const { firmId } = req.params;
  const { botName, services, languages } = req.body;

  try {
    const tenantDB = getTenantDB(firmId);

    // 1. Create bot in firm's n8n instance
    const bot = await createN8nBot(firmId, {
      name: botName,
      services: services,
      languages: languages
    });

    // 2. Save to tenant database
    await tenantDB
      .from('bots')
      .insert({
        name: botName,
        n8n_id: bot.id,
        services: services,
        languages: languages,
        active: true
      });

    // 3. Generate webhook URL
    const webhookUrl = `${process.env.APP_URL}/webhook/${firmId}/${bot.id}`;

    res.json({
      botId: bot.id,
      webhookUrl: webhookUrl,
      status: 'active'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ PHASE 4: FIRM DASHBOARD ============
app.get('/api/firm/:firmId/dashboard', async (req, res) => {
  const { firmId } = req.params;
  const tenantDB = getTenantDB(firmId);

  const firm = await tenantDB.from('firms').select('*').single();
  const bots = await tenantDB.from('bots').select('*');
  const stats = await tenantDB.from('bot_stats').select('*');

  res.json({
    firm: firm.data,
    bots: bots.data,
    stats: {
      messages_month: stats.data?.reduce((sum, s) => sum + s.messages, 0) || 0,
      conversations: stats.data?.length || 0,
      active_bots: bots.data?.filter(b => b.active).length || 0
    }
  });
});

// ============ PHASE 5: ADMIN CONTROLS ============
app.put('/api/firm/:firmId/settings', async (req, res) => {
  const { firmId } = req.params;
  const { branding, languages, consultants } = req.body;
  const tenantDB = getTenantDB(firmId);

  await tenantDB.from('firm_config').update({
    branding: branding,
    languages: languages,
    consultants: consultants
  }).eq('firm_id', firmId);

  res.json({ success: true });
});

// ============ ADMIN ENDPOINTS ============
app.get('/api/admin/firms', async (req, res) => {
  const { status } = req.query;

  let query = supabase.from('firms').select('*,bots(count)');

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  res.json(data);
});

app.patch('/api/admin/firm/:firmId/status', async (req, res) => {
  const { firmId } = req.params;
  const { status } = req.body;

  const { error } = await supabase
    .from('firms')
    .update({ status })
    .eq('id', firmId);

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  res.json({ success: true });
});

app.get('/api/admin/analytics', async (req, res) => {
  const firms = await supabase
    .from('firms')
    .select('count')
    .eq('subscription_active', true);

  const revenue = await supabase
    .from('billing_history')
    .select('amount')
    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

  res.json({
    total_firms: firms.count,
    monthly_revenue: revenue.data?.reduce((sum, b) => sum + b.amount, 0) || 0,
    avg_plan_value: 0
  });
});

// Utilities
const getPriceId = (plan) => {
  const prices = {
    solo: 'price_solo_99',
    pro: 'price_pro_349',
    enterprise: 'price_enterprise_999'
  };
  return prices[plan];
};

const createN8nBot = async (firmId, config) => {
  const n8nApiKey = process.env.N8N_API_KEY;
  const n8nUrl = process.env.N8N_URL || 'https://arisconsulting.app.n8n.cloud/api/v1';

  try {
    const res = await fetch(`${n8nUrl}/workflows`, {
      method: 'POST',
      headers: {
        'X-N8N-API-KEY': n8nApiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: `${config.name} - ${firmId}`,
        nodes: getTemplateNodes(config),
        connections: getTemplateConnections(),
        settings: {
          executionOrder: 'v1'
        }
      })
    });

    const workflow = await res.json();
    return {
      id: workflow.id,
      name: workflow.name,
      status: 'active'
    };
  } catch (err) {
    console.error('n8n bot creation error:', err);
    throw err;
  }
};

const createFirmInstance = async (firmId) => {
  try {
    // 1. Create firm config in database
    await supabase.from('firm_config').insert({
      firm_id: firmId,
      branding: {
        logo: null,
        colors: { primary: '#667eea' }
      },
      languages: ['ro'],
      consultants: []
    });

    // 2. Create initial webhook entry
    const webhookUrl = `${process.env.APP_URL}/webhook/${firmId}`;

    return true;
  } catch (err) {
    console.error('Firm instance creation error:', err);
    throw err;
  }
};

const getTemplateNodes = (config) => {
  return [
    {
      id: 'webhook-in',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 1,
      parameters: {
        path: `/${config.name}`
      }
    },
    {
      id: 'code-process',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      parameters: {
        jsCode: 'return $input.all();'
      }
    },
    {
      id: 'claude-llm',
      type: 'n8n-nodes-base.http',
      typeVersion: 4,
      parameters: {
        url: 'https://api.anthropic.com/v1/messages',
        method: 'POST',
        headerParameters: {
          parameters: [
            { name: 'x-api-key', value: '={{ $env.CLAUDE_API_KEY }}' }
          ]
        }
      }
    }
  ];
};

const getTemplateConnections = () => {
  return {
    'webhook-in': { main: [[{ node: 'code-process', type: 'main', index: 0 }]] },
    'code-process': { main: [[{ node: 'claude-llm', type: 'main', index: 0 }]] }
  };
};

app.listen(3000, () => {
  console.log('🚀 ARIS Platform API running on port 3000');
});
