import { NextResponse } from "next/server";
import Stripe from "stripe";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

export async function GET() {
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

    const plans = await stripe.plans.list({
      active: true,
    });

    return NextResponse.json(plans.data, {
      headers: corsHeaders,
      status: 200,
    });
  } catch (error: any) {
    console.error("Error getting products:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 400, headers: corsHeaders },
    );
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}
