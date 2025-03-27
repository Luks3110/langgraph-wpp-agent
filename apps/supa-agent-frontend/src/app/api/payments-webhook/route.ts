import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import Stripe from "stripe";

type WebhookEvent = {
  event_type: string;
  type: string;
  stripe_event_id: string;
  created_at: string;
  modified_at: string;
  data: any;
};

type SubscriptionData = {
  stripe_id: string;
  user_id: string;
  price_id: string;
  stripe_price_id: string;
  currency: string;
  interval: string;
  status: string;
  current_period_start: number;
  current_period_end: number;
  cancel_at_period_end: boolean;
  amount: number;
  started_at: number;
  customer_id: string;
  metadata: Record<string, any>;
  canceled_at?: number;
  ended_at?: number;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, stripe-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Utility functions
async function logAndStoreWebhookEvent(
  supabaseClient: any,
  event: any,
  data: any,
): Promise<void> {
  const { error } = await supabaseClient.from("webhook_events").insert({
    event_type: event.type,
    type: event.type.split(".")[0],
    stripe_event_id: event.id,
    created_at: new Date(event.created * 1000).toISOString(),
    modified_at: new Date(event.created * 1000).toISOString(),
    data,
  } as WebhookEvent);

  if (error) {
    console.error("Error logging webhook event:", error);
    throw error;
  }
}

async function updateSubscriptionStatus(
  supabaseClient: any,
  stripeId: string,
  status: string,
): Promise<void> {
  const { error } = await supabaseClient
    .from("subscriptions")
    .update({ status })
    .eq("stripe_id", stripeId);

  if (error) {
    console.error("Error updating subscription status:", error);
    throw error;
  }
}

// Event handlers
async function handleSubscriptionCreated(
  supabaseClient: any,
  event: any,
  stripe: Stripe,
) {
  const subscription = event.data.object;
  console.log("Handling subscription created:", subscription.id);

  // Try to get user information
  let userId = subscription.metadata?.user_id || subscription.metadata?.userId;
  if (!userId) {
    try {
      const customer = await stripe.customers.retrieve(subscription.customer);
      // Check if customer is not deleted and has email
      if (!("deleted" in customer) && customer.email) {
        const { data: userData } = await supabaseClient
          .from("users")
          .select("id")
          .eq("email", customer.email)
          .single();

        userId = userData?.id;
      }

      if (!userId) {
        throw new Error("User not found");
      }
    } catch (error) {
      console.error("Unable to find associated user:", error);
      return NextResponse.json(
        { error: "Unable to find associated user" },
        { status: 400, headers: corsHeaders },
      );
    }
  }

  const subscriptionData: SubscriptionData = {
    stripe_id: subscription.id,
    user_id: userId,
    price_id: subscription.items.data[0]?.price.id,
    stripe_price_id: subscription.items.data[0]?.price.id,
    currency: subscription.currency,
    interval: subscription.items.data[0]?.plan.interval,
    status: subscription.status,
    current_period_start: subscription.current_period_start,
    current_period_end: subscription.current_period_end,
    cancel_at_period_end: subscription.cancel_at_period_end,
    amount: subscription.items.data[0]?.plan.amount ?? 0,
    started_at: subscription.start_date ?? Math.floor(Date.now() / 1000),
    customer_id: subscription.customer,
    metadata: subscription.metadata || {},
    canceled_at: subscription.canceled_at,
    ended_at: subscription.ended_at,
  };

  // First, check if a subscription with this stripe_id already exists
  const { data: existingSubscription } = await supabaseClient
    .from("subscriptions")
    .select("id")
    .eq("stripe_id", subscription.id)
    .maybeSingle();

  // Update subscription in database
  const { error } = await supabaseClient.from("subscriptions").upsert(
    {
      // If we found an existing subscription, use its UUID, otherwise let Supabase generate one
      ...(existingSubscription?.id ? { id: existingSubscription.id } : {}),
      ...subscriptionData,
    },
    {
      // Use stripe_id as the match key for upsert
      onConflict: "stripe_id",
    },
  );

  if (error) {
    console.error("Error creating subscription:", error);
    return NextResponse.json(
      { error: "Failed to create subscription" },
      { status: 500, headers: corsHeaders },
    );
  }

  return NextResponse.json(
    { message: "Subscription created successfully" },
    { status: 200, headers: corsHeaders },
  );
}

async function handleSubscriptionUpdated(supabaseClient: any, event: any) {
  const subscription = event.data.object;
  console.log("Handling subscription updated:", subscription.id);

  const { error } = await supabaseClient
    .from("subscriptions")
    .update({
      status: subscription.status,
      current_period_start: subscription.current_period_start,
      current_period_end: subscription.current_period_end,
      cancel_at_period_end: subscription.cancel_at_period_end,
      metadata: subscription.metadata,
      canceled_at: subscription.canceled_at,
      ended_at: subscription.ended_at,
    })
    .eq("stripe_id", subscription.id);

  if (error) {
    console.error("Error updating subscription:", error);
    return NextResponse.json(
      { error: "Failed to update subscription" },
      { status: 500, headers: corsHeaders },
    );
  }

  return NextResponse.json(
    { message: "Subscription updated successfully" },
    { status: 200, headers: corsHeaders },
  );
}

async function handleSubscriptionDeleted(supabaseClient: any, event: any) {
  const subscription = event.data.object;
  console.log("Handling subscription deleted:", subscription.id);

  try {
    await updateSubscriptionStatus(supabaseClient, subscription.id, "canceled");

    // If we have email in metadata, update user's subscription status
    if (subscription?.metadata?.email) {
      await supabaseClient
        .from("users")
        .update({ subscription: null })
        .eq("email", subscription.metadata.email);
    }

    return NextResponse.json(
      { message: "Subscription deleted successfully" },
      { status: 200, headers: corsHeaders },
    );
  } catch (error) {
    console.error("Error deleting subscription:", error);
    return NextResponse.json(
      { error: "Failed to process subscription deletion" },
      { status: 500, headers: corsHeaders },
    );
  }
}

async function handleCheckoutSessionCompleted(
  supabaseClient: any,
  event: any,
  stripe: Stripe,
) {
  const session = event.data.object;
  console.log("Handling checkout session completed:", session.id);

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;

  if (!subscriptionId) {
    console.log("No subscription ID found in checkout session");
    return NextResponse.json(
      { message: "No subscription in checkout session" },
      { status: 200, headers: corsHeaders },
    );
  }

  try {
    // Fetch the current subscription from Stripe to get the latest status
    const stripeSubscription =
      await stripe.subscriptions.retrieve(subscriptionId);

    const updatedStripeSubscription = await stripe.subscriptions.update(
      subscriptionId,
      {
        metadata: {
          ...session.metadata,
          checkoutSessionId: session.id,
        },
      },
    );

    const supabaseUpdateResult = await supabaseClient
      .from("subscriptions")
      .update({
        metadata: {
          ...session.metadata,
          checkoutSessionId: session.id,
        },
        user_id: session.metadata?.userId || session.metadata?.user_id,
        status: stripeSubscription.status,
        current_period_start: stripeSubscription.current_period_start,
        current_period_end: stripeSubscription.current_period_end,
        cancel_at_period_end: stripeSubscription.cancel_at_period_end,
      })
      .eq("stripe_id", subscriptionId);

    if (supabaseUpdateResult.error) {
      console.error(
        "Error updating Supabase subscription:",
        supabaseUpdateResult.error,
      );
      throw new Error(
        `Supabase update failed: ${supabaseUpdateResult.error.message}`,
      );
    }

    return NextResponse.json(
      { message: "Checkout session completed successfully", subscriptionId },
      { status: 200, headers: corsHeaders },
    );
  } catch (error: any) {
    console.error("Error processing checkout completion:", error);
    return NextResponse.json(
      {
        error: "Failed to process checkout completion",
        details: error.message,
      },
      { status: 500, headers: corsHeaders },
    );
  }
}

async function handleInvoicePaymentSucceeded(supabaseClient: any, event: any) {
  const invoice = event.data.object;
  console.log("Handling invoice payment succeeded:", invoice.id);

  const subscriptionId =
    typeof invoice.subscription === "string"
      ? invoice.subscription
      : invoice.subscription?.id;

  try {
    const { data: subscription } = await supabaseClient
      .from("subscriptions")
      .select("*")
      .eq("stripe_id", subscriptionId)
      .single();

    const webhookData = {
      event_type: event.type,
      type: "invoice",
      stripe_event_id: event.id,
      data: {
        invoiceId: invoice.id,
        subscriptionId,
        amountPaid: String(invoice.amount_paid / 100),
        currency: invoice.currency,
        status: "succeeded",
        email: subscription?.email || invoice.customer_email,
      },
    };

    await supabaseClient.from("webhook_events").insert(webhookData);

    return NextResponse.json(
      { message: "Invoice payment succeeded" },
      { status: 200, headers: corsHeaders },
    );
  } catch (error) {
    console.error("Error processing successful payment:", error);
    return NextResponse.json(
      { error: "Failed to process successful payment" },
      { status: 500, headers: corsHeaders },
    );
  }
}

async function handleInvoicePaymentFailed(supabaseClient: any, event: any) {
  const invoice = event.data.object;
  console.log("Handling invoice payment failed:", invoice.id);

  const subscriptionId =
    typeof invoice.subscription === "string"
      ? invoice.subscription
      : invoice.subscription?.id;

  try {
    const { data: subscription } = await supabaseClient
      .from("subscriptions")
      .select("*")
      .eq("stripe_id", subscriptionId)
      .single();

    const webhookData = {
      event_type: event.type,
      type: "invoice",
      stripe_event_id: event.id,
      data: {
        invoiceId: invoice.id,
        subscriptionId,
        amountDue: String(invoice.amount_due / 100),
        currency: invoice.currency,
        status: "failed",
        email: subscription?.email || invoice.customer_email,
      },
    };

    await supabaseClient.from("webhook_events").insert(webhookData);

    if (subscriptionId) {
      await updateSubscriptionStatus(
        supabaseClient,
        subscriptionId,
        "past_due",
      );
    }

    return NextResponse.json(
      { message: "Invoice payment failed" },
      { status: 200, headers: corsHeaders },
    );
  } catch (error) {
    console.error("Error processing failed payment:", error);
    return NextResponse.json(
      { error: "Failed to process failed payment" },
      { status: 500, headers: corsHeaders },
    );
  }
}

export async function POST(req: Request) {
  if (req.method === "OPTIONS") {
    return NextResponse.json({}, { headers: corsHeaders });
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json(
        { error: "No signature found" },
        { status: 400, headers: corsHeaders },
      );
    }

    const body = await req.text();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      return NextResponse.json(
        { error: "Webhook secret not configured" },
        { status: 500, headers: corsHeaders },
      );
    }

    let event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error("Error verifying webhook signature:", err);
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 400, headers: corsHeaders },
      );
    }

    // Create Supabase client with service role key to bypass RLS
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json(
        { error: "Supabase credentials not configured properly" },
        { status: 500, headers: corsHeaders },
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Log the webhook event
    await logAndStoreWebhookEvent(supabaseClient, event, event.data.object);

    // Handle the event based on type
    switch (event.type) {
      case "customer.subscription.created":
        return await handleSubscriptionCreated(supabaseClient, event, stripe);
      case "customer.subscription.updated":
        return await handleSubscriptionUpdated(supabaseClient, event);
      case "customer.subscription.deleted":
        return await handleSubscriptionDeleted(supabaseClient, event);
      case "checkout.session.completed":
        return await handleCheckoutSessionCompleted(
          supabaseClient,
          event,
          stripe,
        );
      case "invoice.payment_succeeded":
        return await handleInvoicePaymentSucceeded(supabaseClient, event);
      case "invoice.payment_failed":
        return await handleInvoicePaymentFailed(supabaseClient, event);
      default:
        return NextResponse.json(
          { message: `Unhandled event type: ${event.type}` },
          { status: 200, headers: corsHeaders },
        );
    }
  } catch (err: any) {
    console.error("Error processing webhook:", err);
    return NextResponse.json(
      { error: err.message },
      { status: 500, headers: corsHeaders },
    );
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}
