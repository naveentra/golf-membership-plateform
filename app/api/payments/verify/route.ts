import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import {
  activateVerifiedSubscription,
  getRequestUser,
  isMembershipPlan,
  PLAN_PRICES,
  razorpayCredentials,
  razorpayRequest,
} from "../../../../lib/payment-server";

export const runtime = "nodejs";

type RazorpayOrder = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  notes?: Record<string, string>;
};

type RazorpayPayment = {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
};

function validIdentifier(value: unknown) {
  return typeof value === "string" && /^[A-Za-z0-9_]{8,100}$/.test(value);
}

export async function POST(request: Request) {
  try {
    const user = await getRequestUser(request);
    if (!user) return NextResponse.json({ error: "Please sign in before verifying a payment." }, { status: 401 });

    const body = await request.json();
    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = body;
    if (!validIdentifier(orderId) || !validIdentifier(paymentId) || typeof signature !== "string" || !/^[a-f0-9]{64}$/i.test(signature)) {
      return NextResponse.json({ error: "Invalid payment response." }, { status: 400 });
    }

    const { keySecret } = razorpayCredentials();
    const expectedSignature = createHmac("sha256", keySecret).update(`${orderId}|${paymentId}`).digest("hex");
    const signatureMatches = timingSafeEqual(Buffer.from(expectedSignature, "hex"), Buffer.from(signature, "hex"));
    if (!signatureMatches) return NextResponse.json({ error: "Payment signature verification failed." }, { status: 400 });

    const [order, payment] = await Promise.all([
      razorpayRequest<RazorpayOrder>(`/orders/${orderId}`),
      razorpayRequest<RazorpayPayment>(`/payments/${paymentId}`),
    ]);
    const plan = order.notes?.fairchance_plan;
    if (!isMembershipPlan(plan) || order.notes?.fairchance_user_id !== user.id || order.id !== orderId) {
      return NextResponse.json({ error: "This order is not valid for the signed-in account." }, { status: 400 });
    }
    const expectedAmount = PLAN_PRICES[plan].amount;
    if (
      order.amount !== expectedAmount ||
      order.currency !== "INR" ||
      order.status !== "paid" ||
      payment.id !== paymentId ||
      payment.order_id !== orderId ||
      payment.amount !== expectedAmount ||
      payment.currency !== "INR" ||
      payment.status !== "captured"
    ) {
      return NextResponse.json({ error: "Payment has not been captured successfully yet." }, { status: 400 });
    }

    const subscription = await activateVerifiedSubscription({ userId: user.id, plan, orderId, payment });
    return NextResponse.json({
      success: true,
      subscription: { plan: subscription.plan, renewalDate: subscription.renewal_date },
    });
  } catch {
    return NextResponse.json({ error: "Could not verify the Razorpay payment. Your membership was not activated." }, { status: 500 });
  }
}
