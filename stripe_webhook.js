// Stripe Payment Webhook Handler
const stripe = require('stripe')(process.env.STRIPE_KEY);
const supabase = require('@supabase/supabase-js').createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

module.exports = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutComplete(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionCancelled(event.data.object);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;

      case 'invoice.paid':
        await handleInvoicePaid(event.data.object);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook processing error:', err);
    res.status(500).json({ error: err.message });
  }
};

const handleCheckoutComplete = async (session) => {
  const { metadata } = session;
  const firmId = metadata.firmId;

  try {
    // Update firm status to active
    await supabase
      .from('firms')
      .update({
        status: 'active',
        subscription_active: true,
        stripe_customer_id: session.customer,
        stripe_subscription_id: session.subscription
      })
      .eq('id', firmId);

    // Create initial bot
    await supabase.from('bots').insert({
      firm_id: firmId,
      name: 'Default Bot',
      services: ['consultatie'],
      languages: ['ro'],
      active: true
    });

    console.log(`✅ Firm ${firmId} activated successfully`);
  } catch (err) {
    console.error('Checkout completion error:', err);
    throw err;
  }
};

const handleSubscriptionCancelled = async (subscription) => {
  try {
    const firm = await supabase
      .from('firms')
      .select('id')
      .eq('stripe_subscription_id', subscription.id)
      .single();

    if (firm.data) {
      await supabase
        .from('firms')
        .update({
          status: 'cancelled',
          subscription_active: false
        })
        .eq('id', firm.data.id);

      // Deactivate all bots
      await supabase
        .from('bots')
        .update({ active: false })
        .eq('firm_id', firm.data.id);

      console.log(`✅ Subscription cancelled for firm ${firm.data.id}`);
    }
  } catch (err) {
    console.error('Subscription cancellation error:', err);
    throw err;
  }
};

const handlePaymentFailed = async (invoice) => {
  try {
    const firm = await supabase
      .from('firms')
      .select('id')
      .eq('stripe_customer_id', invoice.customer)
      .single();

    if (firm.data) {
      await supabase
        .from('firms')
        .update({ status: 'payment_failed' })
        .eq('id', firm.data.id);

      console.log(`⚠️ Payment failed for firm ${firm.data.id}`);
    }
  } catch (err) {
    console.error('Payment failure handling error:', err);
  }
};

const handleInvoicePaid = async (invoice) => {
  try {
    const firm = await supabase
      .from('firms')
      .select('id')
      .eq('stripe_customer_id', invoice.customer)
      .single();

    if (firm.data) {
      // Record billing history
      await supabase.from('billing_history').insert({
        firm_id: firm.data.id,
        amount: invoice.amount_paid / 100,
        currency: invoice.currency.toUpperCase(),
        status: 'paid',
        stripe_charge_id: invoice.charge
      });

      console.log(`✅ Invoice paid for firm ${firm.data.id}: €${invoice.amount_paid / 100}`);
    }
  } catch (err) {
    console.error('Invoice payment error:', err);
  }
};
