import { NextResponse } from "next/server";
import { getRequestUser, isMembershipPlan, PLAN_PRICES, razorpayRequest } from "../../../../lib/payment-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getRequestUser(request);
    if (!user) return NextResponse.json({ error: "Please sign in before making a payment." }, { status: 401 });

    const body: { plan?: unknown } = await request.json();
    if (!isMembershipPlan(body.plan)) return NextResponse.json({ error: "Please choose a valid membership plan." }, { status: 400 });
    const plan = body.plan;
    const planDetails = PLAN_PRICES[plan];
    const receipt = `fc_${user.id.slice(0, 16)}_${Date.now().toString(36)}`;

    const order = await razorpayRequest<{ id: string; amount: number; currency: string }>("/orders", {
      method: "POST",
      body: JSON.stringify({
        amount: planDetails.amount,
        currency: "INR",
        receipt,
        notes: {
          fairchance_user_id: user.id,
          fairchance_plan: plan,
        },
      }),
    });

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      name: "FairChance",
      description: planDetails.label,
    });
  } catch {
    return NextResponse.json({ error: "Could not create the Razorpay test order. Check your server environment variables." }, { status: 500 });
  }
}
