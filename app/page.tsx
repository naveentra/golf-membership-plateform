"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function Home() {
  const [screen, setScreen] = useState<"home" | "login" | "signup" | "dashboard" | "plans" | "admin" | "adminLogin">("home");
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState("");
  const [authError, setAuthError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthError("");
    setIsSubmitting(true);
    const form = new FormData(event.currentTarget);
    const fullName = String(form.get("fullName") || "");
    const password = String(form.get("password") || "");
    const result = screen === "signup"
      ? await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } })
      : await supabase.auth.signInWithPassword({ email, password });
    setIsSubmitting(false);
    if (result.error) {
      setAuthError(result.error.message);
      return;
    }
    if (screen === "signup" && !result.data.session) {
      setNotice("Account created. Please check your email and confirm your account, then sign in.");
      setScreen("login");
      return;
    }
    setNotice(`Welcome${fullName || email ? `, ${(fullName || email.split("@")[0])}` : ""}! Your FairChance account is active.`);
    setScreen("dashboard");
  };

  if (screen === "login" || screen === "signup") {
    return <main className="auth-shell">
      <button className="wordmark back" onClick={() => setScreen("home")}>Fair<i>Chance</i></button>
      <section className="auth-card">
        <p className="eyebrow">{screen === "signup" ? "START YOUR IMPACT" : "WELCOME BACK"}</p>
        <h1>{screen === "signup" ? "Play for more." : "Good to see you."}</h1>
        <p className="muted">{screen === "signup" ? "Create your account to track scores, support a cause and enter the draw." : "Sign in to see your scores, impact and rewards."}</p>
        <form onSubmit={submit}>
          {screen === "signup" && <label>Full name<input name="fullName" required placeholder="Your name" /></label>}
          <label>Email address<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></label>
          <label>Password<input name="password" required minLength={6} type="password" placeholder="At least 6 characters" /></label>
          {authError && <p className="auth-error">{authError}</p>}
          <button className="primary full" disabled={isSubmitting} type="submit">{isSubmitting ? "Please wait..." : screen === "signup" ? "Create my account" : "Sign in"} {!isSubmitting && <span>→</span>}</button>
        </form>
        <p className="switch">{screen === "signup" ? "Already a member?" : "New here?"} <button onClick={() => setScreen(screen === "signup" ? "login" : "signup")}>{screen === "signup" ? "Sign in" : "Create an account"}</button></p>
      </section>
    </main>;
  }

  if (screen === "dashboard") return <Dashboard onHome={() => setScreen("home")} onUpgrade={() => setScreen("plans")} notice={notice} />;
  if (screen === "plans") return <SubscriptionPlans onBack={() => setScreen("dashboard")} onPaymentSuccess={(paymentNotice) => { setNotice(paymentNotice); setScreen("dashboard"); }} />;
  if (screen === "adminLogin") return <AdminLogin onHome={() => setScreen("home")} onSuccess={() => setScreen("admin")} />;
  if (screen === "admin") return <Admin onHome={() => setScreen("home")} />;

  return <main>
    <nav className="nav"><button className="wordmark" onClick={() => setScreen("home")}>Fair<i>Chance</i></button><div className="navlinks"><a href="#how">How it works</a><a href="#impact">Our impact</a><button className="ghost" onClick={() => setScreen("adminLogin")}>Admin</button><button className="ghost" onClick={() => setScreen("login")}>Log in</button><button className="primary small" onClick={() => setScreen("signup")}>Join the club <span>→</span></button></div></nav>
    <section className="hero">
      <div className="orb orb-one" /><div className="orb orb-two" />
      <div className="hero-copy"><p className="eyebrow light">GOLF, WITH A BIGGER PURPOSE</p><h1>Every round<br /><em>can change</em> a life.</h1><p>Track your game, unlock monthly rewards and turn your membership into real support for causes you care about.</p><div className="hero-actions"><button className="primary" onClick={() => setScreen("signup")}>Start making impact <span>→</span></button><a href="#how" className="text-link">See how it works <b>↓</b></a></div></div>
      <div className="hero-stat"><span>Your impact this month</span><strong>₹12,48,000</strong><small>Going to 8 brilliant charities</small><div className="avatars"><b>✦</b><b>♥</b><b>◒</b><b>+</b></div></div>
      <div className="hero-card"><div className="card-top"><span>YOUR NEXT DRAW</span><b>14 DAYS</b></div><div className="draw-balls"><i>12</i><i>27</i><i>31</i><i>38</i><i>44</i></div><p>Enter with your latest five scores</p></div>
    </section>
    <section id="how" className="steps"><div><p className="eyebrow">A BETTER WAY TO PLAY</p><h2>Your game has<br />more to give.</h2></div><div className="step-grid"><article><span>01</span><h3>Join the club</h3><p>Choose a monthly or annual membership, then select a charity close to your heart.</p></article><article><span>02</span><h3>Log your scores</h3><p>Add your latest five Stableford scores. That&apos;s your unique entry to the monthly draw.</p></article><article><span>03</span><h3>Win & give back</h3><p>Stand a chance to win every month while a share of every membership supports your cause.</p></article></div></section>
    <section id="impact" className="impact"><p className="eyebrow light">IMPACT THAT ADDS UP</p><h2>When you play,<br /><em>everyone wins.</em></h2><div className="impact-numbers"><div><strong>18,200</strong><span>rounds played</span></div><div><strong>₹84L</strong><span>given to charities</span></div><div><strong>2,840</strong><span>members making impact</span></div></div></section>
    <footer><button className="wordmark" onClick={() => setScreen("adminLogin")}>Fair<i>Chance</i></button><span>Made for the game. Built for good.</span><button className="admin-link" onClick={() => setScreen("adminLogin")}>Admin portal →</button></footer>
  </main>;
}

type GolfScore = { id: string; score: number; played_on: string };
type MemberSubscription = { plan: "monthly" | "yearly"; status: "active" | "inactive" | "cancelled" | "past_due"; renewal_date: string | null; charity_percentage: number | null };

function Dashboard({ onHome, onUpgrade, notice }: { onHome: () => void; onUpgrade: () => void; notice: string }) {
  const [newScore, setNewScore] = useState("");
  const [playedOn, setPlayedOn] = useState(new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState<GolfScore[]>([]);
  const [userId, setUserId] = useState("");
  const [scoreError, setScoreError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [subscription, setSubscription] = useState<MemberSubscription | null>(null);

  useEffect(() => {
    const loadScores = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data, error } = await supabase.from("golf_scores").select("id, score, played_on").eq("user_id", user.id).order("played_on", { ascending: false }).limit(5);
      if (error) setScoreError(error.message);
      else setItems(data || []);
      const { data: subscriptionData, error: subscriptionError } = await supabase.from("subscriptions").select("plan, status, renewal_date, charity_percentage").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (subscriptionError) setScoreError(subscriptionError.message);
      else setSubscription(subscriptionData as MemberSubscription | null);
    };
    void loadScores();
  }, []);

  const addScore = async (event: FormEvent) => {
    event.preventDefault();
    const value = Number(newScore);
    if (!userId) { setScoreError("Please sign in again before adding a score."); return; }
    if (value < 1 || value > 45) { setScoreError("Score must be between 1 and 45."); return; }
    setIsSaving(true); setScoreError("");
    const { error } = await supabase.from("golf_scores").insert({ user_id: userId, score: value, played_on: playedOn });
    if (error) { setScoreError(error.code === "23505" ? "A score already exists for this date." : error.message); setIsSaving(false); return; }
    const { data: latestScores, error: refreshError } = await supabase.from("golf_scores").select("id, score, played_on").eq("user_id", userId).order("played_on", { ascending: false }).limit(5);
    if (refreshError) setScoreError(refreshError.message);
    else setItems(latestScores || []);
    setNewScore(""); setIsSaving(false);
  };

  const average = items.length ? Math.round(items.reduce((total, item) => total + item.score, 0) / items.length) : "-";
  const isActive = subscription?.status === "active";
  const planName = subscription?.plan === "yearly" ? "Annual" : "Monthly";
  const renewalLabel = subscription?.renewal_date ? new Date(`${subscription.renewal_date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
  return <main className="app-shell"><aside><button className="wordmark" onClick={onHome}>Fair<i>Chance</i></button><div className="profile-dot">AS</div><nav><a className="active">⌂ Overview</a><a>◎ My scores</a><a>♡ My charity</a><a>◌ Draws & rewards</a><a>⚙ Settings</a></nav><button className="signout" onClick={onHome}>← Sign out</button></aside><section className="dash"><header><div><p className="eyebrow">MEMBER DASHBOARD</p><h1>Hello, Alex <span>✦</span></h1></div><button className="primary small" onClick={onUpgrade}>{isActive ? "Change plan" : "Choose plan"}</button></header>{notice && <p className="notice">{notice}</p>}<div className="membership"><div><span className="pill">{isActive ? "● ACTIVE" : "○ INACTIVE"}</span><h2>{isActive ? "You&apos;re making every round count." : "Choose a plan to start making impact."}</h2><p>{isActive ? `${planName} membership · Renews on ${renewalLabel}` : "No active membership yet"}</p></div><strong>{isActive ? `${planName} plan` : "Not active"}<small>{isActive ? "Verified payment active" : "Choose a plan to continue"}</small></strong></div><div className="dash-grid"><section className="score-panel"><div className="panel-heading"><div><p className="eyebrow">YOUR LAST 5 SCORES</p><h2>Performance</h2></div><span className="average">Avg <b>{average}</b></span></div><div className="score-row">{items.length ? items.map((item) => <div key={item.id}><b>{item.score}</b><span>{new Date(`${item.played_on}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</span></div>) : <p className="empty-scores">No scores yet. Add your first score below.</p>}</div><form className="quick-score" onSubmit={addScore}><input type="number" min="1" max="45" value={newScore} onChange={e => setNewScore(e.target.value)} placeholder="Stableford score (1–45)" required /><input type="date" value={playedOn} onChange={e => setPlayedOn(e.target.value)} required /><button className="primary small" disabled={isSaving}>{isSaving ? "Saving..." : "Add score"}</button></form>{scoreError && <p className="score-error">{scoreError}</p>}</section><DrawSimulator scores={items.map((item) => item.score)} /></div><OfficialDrawResult scores={items.map((item) => item.score)} /><CharityPicker /><WinnerProofUploader /></section></main>;
}

function DrawSimulator({ scores }: { scores: number[] }) {
  const [numbers, setNumbers] = useState<number[]>([]);
  const draw = () => {
    const picked = new Set<number>();
    while (picked.size < 5) picked.add(Math.floor(Math.random() * 45) + 1);
    setNumbers([...picked].sort((a, b) => a - b));
  };
  const matches = numbers.filter((number) => scores.includes(number)).length;
  const prize = matches === 5 ? "40% jackpot share" : matches === 4 ? "35% reward-pool share" : matches === 3 ? "25% reward-pool share" : "Keep logging scores for the next draw";
  return <section className="draw-panel"><p className="eyebrow light">MONTHLY DRAW SIMULATOR</p><h2>Test your chance</h2>{numbers.length ? <><div className="result-balls">{numbers.map((number) => <b key={number}>{number}</b>)}</div><p><strong>{matches} of 5 matched.</strong> {prize}</p></> : <><strong>₹4,86,000</strong><p>Run a private simulation using your saved scores.</p></>}<button className="outline" onClick={draw}>{numbers.length ? "Run again" : "Run simulation"} →</button></section>;
}

type OfficialDraw = { id: string; title: string; draw_month: string; winning_numbers: number[] | null; prize_pool_inr: number };

function OfficialDrawResult({ scores }: { scores: number[] }) {
  const [draw, setDraw] = useState<OfficialDraw | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadOfficialDraw = async () => {
      const { data } = await supabase.from("draws").select("id, title, draw_month, winning_numbers, prize_pool_inr").eq("status", "published").order("draw_month", { ascending: false }).limit(1).maybeSingle();
      setDraw(data as OfficialDraw | null);
      setIsLoading(false);
    };
    void loadOfficialDraw();
  }, []);

  if (isLoading) return <section className="official-draw"><p className="eyebrow">OFFICIAL RESULTS</p><p>Checking the latest official draw…</p></section>;
  if (!draw?.winning_numbers) return <section className="official-draw"><p className="eyebrow">OFFICIAL RESULTS</p><h2>No official draw published yet.</h2><p>Keep your five scores ready—the published results will appear here.</p></section>;
  const matches = draw.winning_numbers.filter((number) => scores.includes(number)).length;
  return <section className="official-draw"><div className="panel-heading"><div><p className="eyebrow">OFFICIAL RESULTS</p><h2>{draw.title}</h2></div><span className="pill">PUBLISHED</span></div><div className="official-draw-body"><div className="official-balls">{draw.winning_numbers.map((number) => <b key={number}>{number}</b>)}</div><p>{new Date(`${draw.draw_month}T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" })} · Prize pool ₹{Number(draw.prize_pool_inr).toLocaleString("en-IN")}</p></div><strong>{scores.length === 5 ? `${matches} of 5 scores matched` : "Add five scores to check your result"}</strong></section>;
}

type RazorpayPaymentResponse = { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string };
type RazorpayFailure = { error?: { description?: string } };
type RazorpayCheckoutOptions = { key: string; amount: number; currency: string; name: string; description: string; order_id: string; prefill?: { email?: string }; theme?: { color: string }; handler: (response: RazorpayPaymentResponse) => void; modal?: { ondismiss: () => void } };
type RazorpayCheckout = { open: () => void; on: (event: "payment.failed", handler: (response: RazorpayFailure) => void) => void };

declare global { interface Window { Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayCheckout } }

function loadRazorpayCheckout() {
  return new Promise<boolean>((resolve) => {
    if (window.Razorpay) { resolve(true); return; }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(Boolean(window.Razorpay));
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function SubscriptionPlans({ onBack, onPaymentSuccess }: { onBack: () => void; onPaymentSuccess: (notice: string) => void }) {
  const [plan, setPlan] = useState<"monthly" | "yearly">("yearly");
  const [message, setMessage] = useState("");
  const [isPaying, setIsPaying] = useState(false);
  const [paymentStage, setPaymentStage] = useState("");
  const data = plan === "yearly" ? { amount: "₹9,999", monthly: "₹833/month", impact: "₹1,000 minimum yearly charity impact" } : { amount: "₹999", monthly: "billed monthly", impact: "₹100 minimum monthly charity impact" };
  const startPayment = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) { setMessage("Please sign in before continuing to payment."); return; }
    setIsPaying(true);
    setPaymentStage("Creating secure test order…");
    setMessage("");
    try {
      const orderResponse = await fetch("/api/payments/create-order", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ plan }) });
      const order = await orderResponse.json();
      if (!orderResponse.ok) throw new Error(order.error || "Could not create a payment order.");
      if (!await loadRazorpayCheckout() || !window.Razorpay) throw new Error("Razorpay Checkout could not be loaded. Check your connection and try again.");

      let checkoutStarted = false;
      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: order.name,
        description: order.description,
        order_id: order.orderId,
        prefill: { email: session.user.email },
        theme: { color: "#204d3b" },
        modal: { ondismiss: () => { if (!checkoutStarted) { setIsPaying(false); setPaymentStage(""); setMessage("Payment cancelled. Your membership has not been activated."); } } },
        handler: async (response) => {
          checkoutStarted = true;
          setPaymentStage("Verifying payment securely…");
          try {
            const verifyResponse = await fetch("/api/payments/verify", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify(response) });
            const verification = await verifyResponse.json();
            if (!verifyResponse.ok || !verification.success) throw new Error(verification.error || "Payment verification failed.");
            const membershipName = verification.subscription?.plan === "yearly" ? "annual" : "monthly";
            onPaymentSuccess(`Payment successful — your ${membershipName} FairChance membership is now active.`);
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "Payment verification failed. Your membership was not activated.");
            setIsPaying(false);
            setPaymentStage("");
          }
        },
      });
      checkout.on("payment.failed", () => { checkoutStarted = true; setIsPaying(false); setPaymentStage(""); setMessage("Payment failed. Your membership has not been activated."); });
      setPaymentStage("");
      checkout.open();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not start payment. Please try again.");
      setIsPaying(false);
      setPaymentStage("");
    }
  };
  return <main className="plans-shell"><button className="wordmark back" onClick={onBack}>← Fair<i>Chance</i></button><section className="plans"><p className="eyebrow">MEMBERSHIP</p><h1>Choose your <em>chance</em><br />to make impact.</h1><p className="plans-intro">Every membership enters you into the monthly reward draw and supports the charity you selected.</p><div className="plan-grid"><button disabled={isPaying} className={plan === "monthly" ? "plan-card selected" : "plan-card"} onClick={() => setPlan("monthly")}><span>MONTHLY</span><strong>₹999</strong><small>per month</small><p>Flexible monthly membership</p></button><button disabled={isPaying} className={plan === "yearly" ? "plan-card selected" : "plan-card"} onClick={() => setPlan("yearly")}><b className="save-badge">SAVE 17%</b><span>YEARLY</span><strong>₹9,999</strong><small>per year</small><p>Best value for committed players</p></button></div><div className="checkout-summary"><div><span>Selected plan</span><b>{plan === "yearly" ? "Annual membership" : "Monthly membership"}</b><small>{data.impact}</small></div><strong>{data.amount}<small>{data.monthly}</small></strong><button className="primary" disabled={isPaying} onClick={() => void startPayment()}>{isPaying ? paymentStage || "Opening checkout…" : "Continue to payment →"}</button></div>{message && <p className="payment-message">{message}</p>}</section></main>;
}

type Charity = { id: string; name: string; description: string | null };

function CharityPicker() {
  const [charities, setCharities] = useState<Charity[]>([]);
  const [selected, setSelected] = useState("");
  const [percentage, setPercentage] = useState(10);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const loadCharities = async () => {
      const { data } = await supabase.from("charities").select("id, name, description").order("is_featured", { ascending: false });
      setCharities(data || []);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: subscription } = await supabase.from("subscriptions").select("charity_id, charity_percentage").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (subscription?.charity_id) setSelected(subscription.charity_id);
      if (subscription?.charity_percentage) setPercentage(Number(subscription.charity_percentage));
    };
    void loadCharities();
  }, []);

  const saveChoice = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !selected) { setMessage("Choose a charity first."); return; }
    const { error } = await supabase.rpc("save_subscription_charity_choice", { p_charity_id: selected, p_charity_percentage: percentage });
    setMessage(error ? error.message : "Your charity choice has been saved.");
  };

  return <section className="charity-picker"><div><p className="eyebrow">YOUR CHARITY IMPACT</p><h2>Choose the cause you support</h2><p className="charity-copy">At least 10% of your membership contribution goes directly to your selected charity.</p></div><div className="charity-options">{charities.map((charity) => <button key={charity.id} className={selected === charity.id ? "charity-choice selected" : "charity-choice"} onClick={() => setSelected(charity.id)}><b>{charity.name}</b><span>{charity.description}</span></button>)}</div><div className="charity-save"><label>Contribution <b>{percentage}%</b><input type="range" min="10" max="50" value={percentage} onChange={(event) => setPercentage(Number(event.target.value))} /></label><button className="primary small" onClick={saveChoice}>Save charity</button></div>{message && <p className="charity-message">{message}</p>}</section>;
}

type WinnerProof = {
  id: string;
  draw_id: string;
  match_count: number;
  prize_amount_inr: number;
  proof_path: string | null;
  proof_uploaded_at: string | null;
  verification_status: "pending" | "approved" | "rejected";
  payment_status: "pending" | "paid";
  review_notes: string | null;
  draws?: { title: string; draw_month: string }[] | null;
  profiles?: { full_name: string | null }[] | null;
  signedUrl?: string | null;
};

const imageMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

async function getProofSignedUrl(path: string | null) {
  if (!path) return null;
  const { data, error } = await supabase.storage.from("winner-proofs").createSignedUrl(path, 60 * 60);
  return error ? null : data.signedUrl;
}

function winnerStatusLabel(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function WinnerProofUploader() {
  const [winners, setWinners] = useState<WinnerProof[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState("");
  const [message, setMessage] = useState("");

  const loadProofs = async () => {
    setIsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setMessage("Please sign in to manage winner proofs.");
      setIsLoading(false);
      return;
    }
    const { data, error } = await supabase.from("winners")
      .select("id, draw_id, match_count, prize_amount_inr, proof_path, proof_uploaded_at, verification_status, payment_status, review_notes, draws!winners_draw_id_fkey(title, draw_month)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) {
      setMessage(`${error.message} Run supabase/winner_proof_migration.sql in Supabase SQL Editor.`);
      setIsLoading(false);
      return;
    }
    const proofRows = (data || []) as WinnerProof[];
    const rowsWithUrls = await Promise.all(proofRows.map(async (winner) => ({ ...winner, signedUrl: await getProofSignedUrl(winner.proof_path) })));
    setWinners(rowsWithUrls);
    setIsLoading(false);
  };

  useEffect(() => { void loadProofs(); }, []);

  const uploadProof = async (winner: WinnerProof, file: File) => {
    if (!imageMimeTypes.has(file.type)) {
      setMessage("Upload a JPG, PNG, or WebP screenshot only.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage("Proof image must be 5 MB or smaller.");
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setMessage("Please sign in again before uploading."); return; }
    const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `${user.id}/${winner.id}-${Date.now()}.${extension}`;
    setUploadingId(winner.id);
    setMessage("");
    const { error: uploadError } = await supabase.storage.from("winner-proofs").upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) {
      setMessage(uploadError.message);
      setUploadingId("");
      return;
    }
    const { error: saveError } = await supabase.rpc("submit_winner_proof", { p_winner_id: winner.id, p_proof_path: path });
    if (saveError) {
      await supabase.storage.from("winner-proofs").remove([path]);
      setMessage(`${saveError.message} Run supabase/winner_proof_migration.sql in Supabase SQL Editor.`);
      setUploadingId("");
      return;
    }
    setMessage("Proof submitted. An admin will review it shortly.");
    setUploadingId("");
    await loadProofs();
  };

  return <section id="winner-proofs" className="proof-panel">
    <div className="panel-heading"><div><p className="eyebrow">WINNER VERIFICATION</p><h2>Upload your score proof</h2></div><span className="proof-lock">Private & secure</span></div>
    <p className="proof-intro">If you win an official draw, upload a screenshot of the five submitted Stableford scores here. Only you and FairChance administrators can open it.</p>
    {isLoading ? <p className="proof-empty">Loading winner records…</p> : winners.length === 0 ? <p className="proof-empty">No winner proof is needed right now. Your request will appear here after an official draw confirms a prize.</p> : <div className="proof-list">{winners.map((winner) => {
      const canUpload = winner.verification_status !== "approved" && winner.payment_status !== "paid";
      return <article className="proof-card" key={winner.id}>
        <div className="proof-card-heading"><div><b>{winner.draws?.[0]?.title || "FairChance draw"}</b><small>{winner.draws?.[0]?.draw_month ? new Date(`${winner.draws[0].draw_month}T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" }) : "Official winner"} · {winner.match_count} matches</small></div><span className={`status-chip ${winner.verification_status}`}>{winnerStatusLabel(winner.verification_status)}</span></div>
        <p><strong>₹{Number(winner.prize_amount_inr).toLocaleString("en-IN")}</strong> prize amount · Payment: {winnerStatusLabel(winner.payment_status)}</p>
        {winner.review_notes && <p className="review-note"><b>Admin note:</b> {winner.review_notes}</p>}
        <div className="proof-actions">{winner.signedUrl && <a className="proof-link" href={winner.signedUrl} target="_blank" rel="noreferrer">View submitted proof ↗</a>}{canUpload && <label className="proof-upload"><input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploadingId === winner.id} onChange={(event) => { const file = event.target.files?.[0]; event.currentTarget.value = ""; if (file) void uploadProof(winner, file); }} /><span>{uploadingId === winner.id ? "Uploading…" : winner.proof_path ? "Replace proof" : "Upload score screenshot"}</span></label>}</div>
      </article>;
    })}</div>}
    {message && <p className="proof-message">{message}</p>}
  </section>;
}

function AdminLogin({ onHome, onSuccess }: { onHome: () => void; onSuccess: () => void }) {
  const [message, setMessage] = useState("");
  const checkAccess = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setMessage("Please log in with your admin account first."); return; }
    const { data } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (data?.role === "admin") onSuccess(); else setMessage("This account is not an admin yet. Run the admin migration promotion line in Supabase.");
  };
  return <main className="auth-shell"><button className="wordmark back" onClick={onHome}>← Fair<i>Chance</i></button><section className="auth-card"><p className="eyebrow">SECURE ACCESS</p><h1>Admin portal</h1><p className="muted">Use your logged-in FairChance admin account to open management tools.</p><button className="primary full" onClick={checkAccess}>Open admin portal →</button>{message && <p className="auth-error admin-message">{message}</p>}</section></main>;
}

type Profile = { id: string; full_name: string | null; role: string; created_at: string };

function WinnerProofReviewPanel() {
  const [proofs, setProofs] = useState<WinnerProof[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [workingId, setWorkingId] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");

  const loadProofs = async () => {
    setIsLoading(true);
    const { data, error } = await supabase.from("winners")
      .select("id, draw_id, match_count, prize_amount_inr, proof_path, proof_uploaded_at, verification_status, payment_status, review_notes, profiles!winners_user_id_fkey(full_name), draws!winners_draw_id_fkey(title, draw_month)")
      .not("proof_path", "is", null)
      .order("proof_uploaded_at", { ascending: false });
    if (error) {
      setMessage(`${error.message} Run supabase/winner_proof_migration.sql in Supabase SQL Editor.`);
      setIsLoading(false);
      return;
    }
    const proofRows = (data || []) as WinnerProof[];
    const rowsWithUrls = await Promise.all(proofRows.map(async (proof) => ({ ...proof, signedUrl: await getProofSignedUrl(proof.proof_path) })));
    setProofs(rowsWithUrls);
    setIsLoading(false);
  };

  useEffect(() => { void loadProofs(); }, []);

  const review = async (proof: WinnerProof, status: "approved" | "rejected") => {
    setWorkingId(proof.id);
    setMessage("");
    const { error } = await supabase.rpc("review_winner_proof", {
      p_winner_id: proof.id,
      p_verification_status: status,
      p_review_notes: notes[proof.id] || null,
    });
    if (error) setMessage(error.message);
    else {
      setMessage(`Proof ${status}.`);
      await loadProofs();
    }
    setWorkingId("");
  };

  const markPaid = async (proof: WinnerProof) => {
    setWorkingId(proof.id);
    setMessage("");
    const { error } = await supabase.rpc("mark_winner_paid", { p_winner_id: proof.id });
    if (error) setMessage(error.message);
    else {
      setMessage("Winner marked as paid.");
      await loadProofs();
    }
    setWorkingId("");
  };

  const pendingCount = proofs.filter((proof) => proof.verification_status === "pending").length;
  return <section id="winner-review" className="table-panel proof-review-panel">
    <div className="panel-heading"><div><p className="eyebrow">WINNER VERIFICATION</p><h2>Submitted proof queue</h2></div><span className="review-count">{pendingCount} pending</span></div>
    <p>Open the private screenshot, check the score evidence, then approve or reject the claim. Approved prizes can be marked paid.</p>
    {isLoading ? <p className="proof-empty">Loading submitted proofs…</p> : proofs.length === 0 ? <p className="proof-empty">No submitted proofs are waiting for review.</p> : <div className="review-list">{proofs.map((proof) => <article className="review-card" key={proof.id}>
      <div className="review-card-heading"><div><b>{proof.profiles?.[0]?.full_name || "FairChance member"}</b><small>{proof.draws?.[0]?.title || "FairChance draw"} · {proof.proof_uploaded_at ? new Date(proof.proof_uploaded_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Submitted"}</small></div><span className={`status-chip ${proof.verification_status}`}>{winnerStatusLabel(proof.verification_status)}</span></div>
      <p className="review-prize"><b>₹{Number(proof.prize_amount_inr).toLocaleString("en-IN")}</b> · {proof.match_count} matched scores · Payment: {winnerStatusLabel(proof.payment_status)}</p>
      {proof.signedUrl ? <a className="proof-link" href={proof.signedUrl} target="_blank" rel="noreferrer">Open private score screenshot ↗</a> : <p className="review-note">The proof file could not be opened. Check Storage policies.</p>}
      <textarea value={notes[proof.id] ?? proof.review_notes ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [proof.id]: event.target.value }))} placeholder="Optional note for the member" />
      <div className="review-actions"><button type="button" className="ghost review-reject" disabled={workingId === proof.id || proof.payment_status === "paid"} onClick={() => void review(proof, "rejected")}>Reject</button><button type="button" className="primary small" disabled={workingId === proof.id || proof.payment_status === "paid"} onClick={() => void review(proof, "approved")}>{workingId === proof.id ? "Saving…" : "Approve proof"}</button>{proof.verification_status === "approved" && proof.payment_status !== "paid" && <button type="button" className="outline paid-button" disabled={workingId === proof.id} onClick={() => void markPaid(proof)}>Mark paid</button>}</div>
    </article>)}</div>}
    {message && <p className="proof-message">{message}</p>}
  </section>;
}

type AdminDraw = OfficialDraw & { status: "draft" | "published" | "completed"; mode: "random" | "algorithmic"; created_at: string };

function pickDrawNumbers() {
  const picked = new Set<number>();
  while (picked.size < 5) picked.add(Math.floor(Math.random() * 45) + 1);
  return [...picked].sort((a, b) => a - b);
}

function OfficialDrawManager() {
  const [title, setTitle] = useState("FairChance monthly draw");
  const [drawMonth, setDrawMonth] = useState(new Date().toISOString().slice(0, 7));
  const [prizePool, setPrizePool] = useState("486000");
  const [draftId, setDraftId] = useState("");
  const [numbers, setNumbers] = useState<number[]>([]);
  const [draws, setDraws] = useState<AdminDraw[]>([]);
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  const loadDraws = async () => {
    const { data, error } = await supabase.from("draws").select("id, title, draw_month, status, mode, winning_numbers, prize_pool_inr, created_at").order("draw_month", { ascending: false }).limit(6);
    if (error) { setMessage(error.message); return; }
    const savedDraws = (data || []) as AdminDraw[];
    setDraws(savedDraws);
    const currentDraft = savedDraws.find((draw) => draw.status === "draft");
    if (currentDraft && !draftId) {
      setDraftId(currentDraft.id);
      setTitle(currentDraft.title);
      setDrawMonth(currentDraft.draw_month.slice(0, 7));
      setPrizePool(String(currentDraft.prize_pool_inr));
    }
  };

  useEffect(() => { void loadDraws(); }, []);

  const saveDraft = async () => {
    const amount = Number(prizePool);
    if (!title.trim() || !drawMonth || !Number.isFinite(amount) || amount < 0) {
      setMessage("Enter a title, month, and valid prize pool.");
      return;
    }
    setIsSaving(true);
    setMessage("");
    const { data, error } = await supabase.rpc("save_draw_draft", {
      p_title: title,
      p_draw_month: `${drawMonth}-01`,
      p_mode: "random",
      p_prize_pool_inr: amount,
      p_draw_id: draftId || null,
    });
    if (error) setMessage(`${error.message} Run supabase/draw_management_migration.sql in Supabase SQL Editor.`);
    else {
      setDraftId(data as string);
      setMessage("Draft saved. Generate five numbers, then publish when ready.");
      await loadDraws();
    }
    setIsSaving(false);
  };

  const publish = async () => {
    if (!draftId) { setMessage("Save the draft before publishing it."); return; }
    if (numbers.length !== 5) { setMessage("Generate five official numbers first."); return; }
    if (!window.confirm("Publish this draw? Winning numbers and winner records will be locked.")) return;
    setIsPublishing(true);
    setMessage("");
    const { data, error } = await supabase.rpc("publish_draw_and_create_winners", { p_draw_id: draftId, p_winning_numbers: numbers });
    if (error) setMessage(`${error.message} Run supabase/draw_management_migration.sql in Supabase SQL Editor.`);
    else {
      const winnerCount = Array.isArray(data) ? data[0]?.winner_count : 0;
      setMessage(`Official draw published. ${winnerCount || 0} winner record(s) created.`);
      setDraftId("");
      setNumbers([]);
      await loadDraws();
    }
    setIsPublishing(false);
  };

  const loadDraft = (draw: AdminDraw) => {
    if (draw.status !== "draft") return;
    setDraftId(draw.id);
    setTitle(draw.title);
    setDrawMonth(draw.draw_month.slice(0, 7));
    setPrizePool(String(draw.prize_pool_inr));
    setNumbers([]);
    setMessage("Draft loaded.");
  };

  return <section className="table-panel draw-manager">
    <div className="panel-heading"><div><p className="eyebrow">DRAW MANAGEMENT</p><h2>Create official draw</h2></div><span className="pill">{draftId ? "DRAFT SAVED" : "NEW DRAFT"}</span></div>
    <p>Publish five official numbers to lock the result and automatically create winner records for members with at least three matches.</p>
    <div className="draw-form"><label>Draw title<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="August FairChance draw" /></label><label>Draw month<input type="month" value={drawMonth} onChange={(event) => setDrawMonth(event.target.value)} /></label><label>Prize pool (₹)<input type="number" min="0" value={prizePool} onChange={(event) => setPrizePool(event.target.value)} /></label></div>
    <div className="admin-draw-numbers">{numbers.length ? numbers.map((number) => <b key={number}>{number}</b>) : <span>Generate the five official numbers after saving the draft.</span>}</div>
    <div className="draw-actions"><button type="button" className="ghost draft-button" disabled={isSaving || isPublishing} onClick={() => void saveDraft()}>{isSaving ? "Saving…" : "Save draft"}</button><button type="button" className="outline admin-outline" disabled={isSaving || isPublishing} onClick={() => setNumbers(pickDrawNumbers())}>Generate numbers</button><button type="button" className="primary small" disabled={isSaving || isPublishing || !draftId || numbers.length !== 5} onClick={() => void publish()}>{isPublishing ? "Publishing…" : "Publish draw →"}</button></div>
    {message && <p className="draw-message">{message}</p>}
    {draws.length > 0 && <div className="draw-history"><p className="eyebrow">RECENT DRAWS</p>{draws.map((draw) => <div key={draw.id}><span><b>{draw.title}</b><small>{new Date(`${draw.draw_month}T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" })} · ₹{Number(draw.prize_pool_inr).toLocaleString("en-IN")}</small></span><em className={`draw-status ${draw.status}`}>{draw.status}</em>{draw.status === "draft" && <button type="button" className="ghost load-draft" onClick={() => loadDraft(draw)}>Load</button>}</div>)}</div>}
  </section>;
}

function Admin({ onHome }: { onHome: () => void }) {
  const [members, setMembers] = useState<Profile[]>([]);
  const [charityName, setCharityName] = useState("");
  const [charityDescription, setCharityDescription] = useState("");
  const [message, setMessage] = useState("");

  const loadMembers = async () => {
    const { data, error } = await supabase.from("profiles").select("id, full_name, role, created_at").order("created_at", { ascending: false }).limit(8);
    if (error) setMessage(error.message);
    else setMembers(data || []);
  };

  useEffect(() => { void loadMembers(); }, []);

  const addCharity = async (event: FormEvent) => {
    event.preventDefault();
    const { error } = await supabase.from("charities").insert({ name: charityName, description: charityDescription });
    setMessage(error ? error.message : "Charity added successfully.");
    if (!error) { setCharityName(""); setCharityDescription(""); }
  };

  return <main className="app-shell admin-shell">
    <aside><button className="wordmark" onClick={onHome}>Fair<i>Chance</i></button><p className="admin-badge">ADMIN PORTAL</p><nav><a className="active">▦ Overview</a><a>◉ Members</a><a>⌘ Draw management</a><a>♥ Charities</a><a href="#winner-review">✓ Winner verification</a></nav><button className="signout" onClick={onHome}>← Exit admin</button></aside>
    <section className="dash">
      <header><div><p className="eyebrow">ADMIN OVERVIEW</p><h1>FairChance control centre</h1></div></header>
      {message && <p className="notice">{message}</p>}
      <div className="metric-grid"><article><span>Registered members</span><strong>{members.length}</strong><small>Latest registered users shown below</small></article><article><span>August prize pool</span><strong>₹4.86L</strong><small>Configure after payment setup</small></article><article><span>Draw mode</span><strong>Random</strong><small>Algorithmic mode coming next</small></article></div>
      <div className="admin-grid">
        <OfficialDrawManager />
        <section className="table-panel"><p className="eyebrow">ADD CHARITY</p><h2>Charity management</h2><form className="admin-form" onSubmit={addCharity}><input required value={charityName} onChange={(e) => setCharityName(e.target.value)} placeholder="Charity name" /><input required value={charityDescription} onChange={(e) => setCharityDescription(e.target.value)} placeholder="Short description" /><button className="primary small">Add charity</button></form></section>
      </div>
      <WinnerProofReviewPanel />
      <section className="table-panel"><div className="panel-heading"><div><p className="eyebrow">MEMBERS</p><h2>Latest registered users</h2></div></div><div className="member-list">{members.length ? members.map((member) => <div key={member.id}><span><b>{member.full_name || "FairChance member"}</b><small>{new Date(member.created_at).toLocaleDateString("en-IN")}</small></span><em>{member.role}</em></div>) : <p>No member records available.</p>}</div></section>
    </section>
  </main>;
}
