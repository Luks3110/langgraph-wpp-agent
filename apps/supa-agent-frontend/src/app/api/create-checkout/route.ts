import { NextResponse } from "next/server";
import Stripe from "stripe";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-customer-email",
};

export async function POST(req: Request) {
  if (req.method === "OPTIONS") {
    return NextResponse.json({}, { headers: corsHeaders });
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

    const { price_id, user_id, return_url } = await req.json();

    if (!price_id || !user_id || !return_url) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400, headers: corsHeaders },
      );
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price: price_id,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${return_url}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${return_url}?canceled=true`,
      customer_email: req.headers.get("X-Customer-Email") || undefined,
      metadata: {
        user_id,
      },
    } as any);

    return NextResponse.json(
      { sessionId: session.id, url: session.url },
      { status: 200, headers: corsHeaders },
    );
  } catch (error: any) {
    console.error("Error creating checkout session:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 400, headers: corsHeaders },
    );
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}
