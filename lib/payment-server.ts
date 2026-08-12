import { createClient, type User } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "./supabase-admin";

export const PLAN_PRICES = {
  monthly: { amount: 99_900, label: "Monthly membership", months: 1 },
  yearly: { amount: 999_900, label: "Yearly membership", months: 12 },
} as const;

export type MembershipPlan = keyof typeof PLAN_PRICES;

type RazorpayPayment = {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
};

function requiredEnvironment(name: string) {
  const value = process.env[name];
  if (!value) throw new Error("Payment service is not configured.");
  return value;
}

export function isMembershipPlan(value: unknown): value is MembershipPlan {
  return value === "monthly" || value === "yearly";
}

export async function getRequestUser(request: Request): Promise<User | null> {
  const authorization = request.headers.get("authorization");
  const accessToken = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!accessToken) return null;

  const supabase = createClient(
    requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnvironment("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { data, error } = await supabase.auth.getUser(accessToken);
  return error ? null : data.user;
}

export function razorpayCredentials() {
  return {
    keyId: requiredEnvironment("NEXT_PUBLIC_RAZORPAY_KEY_ID"),
    keySecret: requiredEnvironment("RAZORPAY_KEY_SECRET"),
  };
}

export async function razorpayRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const { keyId, keySecret } = razorpayCredentials();
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  if (!response.ok) throw new Error("Razorpay request failed.");
  return response.json() as Promise<T>;
}

export function renewalDate(months: number) {
  const value = new Date();
  value.setMonth(value.getMonth() + months);
  return value.toISOString().slice(0, 10);
}

export async function activateVerifiedSubscription({
  userId,
  plan,
  orderId,
  payment,
}: {
  userId: string;
  plan: MembershipPlan;
  orderId: string;
  payment: RazorpayPayment;
}) {
  const supabaseAdmin = getSupabaseAdmin();
  const { data: existingPayment, error: existingPaymentError } = await supabaseAdmin
    .from("subscriptions")
    .select("id, user_id, status, plan, renewal_date")
    .eq("razorpay_payment_id", payment.id)
    .maybeSingle();

  if (existingPaymentError) throw new Error("Could not check the payment record.");
  if (existingPayment) {
    if (existingPayment.user_id !== userId) throw new Error("Payment belongs to a different account.");
    return { id: existingPayment.id, plan: existingPayment.plan, renewal_date: existingPayment.renewal_date, idempotent: true };
  }

  const { error: deactivateError } = await supabaseAdmin
    .from("subscriptions")
    .update({ status: "inactive" })
    .eq("user_id", userId)
    .eq("status", "active");
  if (deactivateError) throw new Error("Could not update the current membership.");

  const { data: currentSubscription, error: currentSubscriptionError } = await supabaseAdmin
    .from("subscriptions")
    .select("id")
    .eq("user_id", userId)
    .order("paid_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (currentSubscriptionError) throw new Error("Could not load the current membership.");

  const paidAt = new Date().toISOString();
  const values = {
    plan,
    status: "active" as const,
    renewal_date: renewalDate(PLAN_PRICES[plan].months),
    started_at: paidAt,
    paid_at: paidAt,
    razorpay_order_id: orderId,
    razorpay_payment_id: payment.id,
  };

  if (currentSubscription) {
    const { data, error } = await supabaseAdmin
      .from("subscriptions")
      .update(values)
      .eq("id", currentSubscription.id)
      .select("id, plan, renewal_date")
      .single();
    if (error) throw new Error("Could not activate the membership.");
    return { ...data, idempotent: false };
  }

  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .insert({ user_id: userId, ...values })
    .select("id, plan, renewal_date")
    .single();
  if (error) throw new Error("Could not activate the membership.");
  return { ...data, idempotent: false };
}
