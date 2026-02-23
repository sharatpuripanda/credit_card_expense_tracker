import { useState, useMemo, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { motion } from "framer-motion";
import {
  PlusCircle, Trash2, Plus, CreditCard, Gift, ShoppingBag,
  Wallet, TrendingUp, IndianRupee, Percent, ArrowDownCircle,
  ArrowUpCircle, CalendarDays,
} from "lucide-react";

/* ── constants ── */
const DEFAULT_WALLETS = ["amazon", "flipkart"];
const DEFAULT_SAVINGS_PCT = 5;

const WALLET_COLORS = {
  amazon:   { bg: "bg-orange-50",  border: "border-orange-200", text: "text-orange-700",  badge: "bg-orange-100 text-orange-800" },
  flipkart: { bg: "bg-blue-50",    border: "border-blue-200",   text: "text-blue-700",    badge: "bg-blue-100 text-blue-800" },
  myntra:   { bg: "bg-pink-50",    border: "border-pink-200",   text: "text-pink-700",    badge: "bg-pink-100 text-pink-800" },
  swiggy:   { bg: "bg-amber-50",   border: "border-amber-300",  text: "text-amber-700",   badge: "bg-amber-100 text-amber-800" },
  zomato:   { bg: "bg-red-50",     border: "border-red-200",    text: "text-red-700",     badge: "bg-red-100 text-red-800" },
};
const FALLBACK_COLOR = { bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-700", badge: "bg-purple-100 text-purple-800" };
const wc = (w) => WALLET_COLORS[w?.toLowerCase()] || FALLBACK_COLOR;

const SUMMARY_STYLES = [
  { bg: "bg-violet-50",  border: "border-violet-200",  text: "text-violet-700",  icon: IndianRupee },
  { bg: "bg-sky-50",     border: "border-sky-200",     text: "text-sky-700",     icon: CalendarDays },
  { bg: "bg-indigo-50",  border: "border-indigo-200",  text: "text-indigo-700",  icon: CreditCard },
  { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", icon: TrendingUp },
  { bg: "bg-green-50",   border: "border-green-200",   text: "text-green-700",   icon: Percent },
  { bg: "bg-teal-50",    border: "border-teal-200",    text: "text-teal-700",    icon: Gift },
  { bg: "bg-cyan-50",    border: "border-cyan-200",    text: "text-cyan-700",    icon: ArrowDownCircle },
  { bg: "bg-lime-50",    border: "border-lime-200",    text: "text-lime-700",    icon: ArrowUpCircle },
  { bg: "bg-rose-50",    border: "border-rose-200",    text: "text-rose-700",    icon: IndianRupee },
];

/* ── billing cycle 24th→23rd ── */
function getBillingCycleRange() {
  const now = new Date(), day = now.getDate();
  if (day >= 24) {
    return {
      cycleStart: new Date(now.getFullYear(), now.getMonth(), 24),
      cycleEnd:   new Date(now.getFullYear(), now.getMonth() + 1, 23, 23, 59, 59),
    };
  }
  return {
    cycleStart: new Date(now.getFullYear(), now.getMonth() - 1, 24),
    cycleEnd:   new Date(now.getFullYear(), now.getMonth(), 23, 23, 59, 59),
  };
}

function fmtCycle() {
  const { cycleStart, cycleEnd } = getBillingCycleRange();
  const f = (d) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return `${f(cycleStart)} – ${f(cycleEnd)}`;
}

/* ══════════════════════════════════════════════════════════════ */
export default function SBCashbackTracker() {
  /* ── persisted state ── */
  const load = (key, fallback) => {
    const s = typeof window !== "undefined" ? localStorage.getItem(key) : null;
    return s ? JSON.parse(s) : fallback;
  };

  const [transactions, setTransactions] = useState(() => load("sb-transactions", []));
  const [giftCards, setGiftCards]       = useState(() => load("sb-giftcards", []));
  const [customWallets, setCustomWallets] = useState(() => load("sb-wallets", []));

  useEffect(() => localStorage.setItem("sb-transactions", JSON.stringify(transactions)), [transactions]);
  useEffect(() => localStorage.setItem("sb-giftcards", JSON.stringify(giftCards)), [giftCards]);
  useEffect(() => localStorage.setItem("sb-wallets", JSON.stringify(customWallets)), [customWallets]);

  const allWallets = useMemo(() => {
    // Always include defaults + custom + any wallet already used in gift cards
    const fromGiftCards = giftCards.map((g) => g.wallet?.toLowerCase()).filter(Boolean);
    return [...new Set([...DEFAULT_WALLETS, ...customWallets, ...fromGiftCards].map((w) => w.toLowerCase()))];
  }, [customWallets, giftCards]);

  /* ── form state ── */
  const todayStr = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    date: todayStr, description: "", amount: "", savingsPct: String(DEFAULT_SAVINGS_PCT),
    type: "card", wallet: "amazon", giftCardId: "", gcDiscountPct: "",
  });
  const [newWalletName, setNewWalletName] = useState("");
  const [showAddWallet, setShowAddWallet] = useState(false);
  const [manageWallets, setManageWallets] = useState(false);

  // Auto-compute savings when amount or savingsPct changes
  const amountNum = Number(form.amount) || 0;
  const savingsPct = Number(form.savingsPct) || 0;
  const gcDiscountPct = Number(form.gcDiscountPct) || 0;

  // Successive discount: A + B - (A*B/100)
  // e.g. 3% GC discount + 5% savings = 3 + 5 - (3*5/100) = 7.85%
  const isGCPurchase = form.type === "giftcard_purchase";
  const isIncome = form.type === "income";
  const isExpense = !isIncome;
  const effectivePct = isGCPurchase && gcDiscountPct > 0
    ? savingsPct + gcDiscountPct - (savingsPct * gcDiscountPct / 100)
    : savingsPct;
  const totalSaving = amountNum * (effectivePct / 100);
  const gcDiscountSaving = isGCPurchase ? amountNum * (gcDiscountPct / 100) : 0;
  const baseSaving = amountNum * (savingsPct / 100);
  const actualPaid = isGCPurchase ? amountNum - gcDiscountSaving : amountNum;

  /* ── add / remove wallet ── */
  const addWallet = () => {
    const name = newWalletName.trim().toLowerCase();
    if (!name || allWallets.includes(name)) return;
    setCustomWallets([...customWallets, name]);
    setNewWalletName("");
    setShowAddWallet(false);
    setForm({ ...form, wallet: name });
  };

  const removeWallet = (name) => {
    setCustomWallets(customWallets.filter((w) => w.toLowerCase() !== name.toLowerCase()));
    if (form.wallet === name) setForm({ ...form, wallet: "amazon" });
  };

  /* ── add / remove transaction ── */
  const addTransaction = () => {
    if (!form.amount || !form.description) return;
    const dateVal = form.date || todayStr;
    const txnId = Date.now();

    let linkedGiftCardId = "";

    if (form.type === "giftcard_purchase") {
      const gcId = txnId; // same ID links transaction ↔ gift card
      linkedGiftCardId = String(gcId);
      setGiftCards([...giftCards, {
        id: gcId, wallet: form.wallet, originalAmount: amountNum,
        remainingAmount: amountNum, description: form.description, date: dateVal,
        discountPct: gcDiscountPct, paidAmount: actualPaid,
      }]);
    }

    if (form.type === "giftcard_spend" && form.giftCardId) {
      linkedGiftCardId = form.giftCardId;
      setGiftCards((prev) => prev.map((gc) =>
        gc.id === Number(form.giftCardId)
          ? { ...gc, remainingAmount: Math.max(0, gc.remainingAmount - amountNum) }
          : gc
      ));
    }

    setTransactions([...transactions, {
      ...form, id: txnId, amount: amountNum, savings: isIncome ? 0 : totalSaving,
      savingsPct: isIncome ? 0 : savingsPct, gcDiscountPct: form.type === "giftcard_purchase" ? gcDiscountPct : 0,
      paidAmount: actualPaid, date: dateVal, linkedGiftCardId,
    }]);

    setForm((prev) => ({
      date: todayStr, description: "", amount: "", savingsPct: String(DEFAULT_SAVINGS_PCT),
      type: "card", wallet: prev.wallet, giftCardId: "", gcDiscountPct: "",
    }));
  };

  const removeTransaction = (id) => {
    const txn = transactions.find((t) => t.id === id);
    if (txn) {
      if (txn.type === "giftcard_purchase") {
        // Remove the gift card that was created with this transaction
        const gcId = Number(txn.linkedGiftCardId || txn.id);
        setGiftCards((prev) => prev.filter((gc) => gc.id !== gcId));
      }
      if (txn.type === "giftcard_spend" && txn.linkedGiftCardId) {
        // Restore the amount back to the gift card
        setGiftCards((prev) => prev.map((gc) =>
          gc.id === Number(txn.linkedGiftCardId)
            ? { ...gc, remainingAmount: gc.remainingAmount + txn.amount }
            : gc
        ));
      }
    }
    setTransactions(transactions.filter((t) => t.id !== id));
  };

  const removeGiftCard = (gcId) => {
    setGiftCards((prev) => prev.filter((gc) => gc.id !== gcId));
  };


  /* ── summary calculations ── */
  const summary = useMemo(() => {
    const expenseTxns = transactions.filter((t) => t.type !== "income");
    const incomeTxns = transactions.filter((t) => t.type === "income");

    const overallSpent = expenseTxns.reduce((s, t) => s + t.amount, 0);
    const totalIncome = incomeTxns.reduce((s, t) => s + t.amount, 0);
    const netBalance = totalIncome - overallSpent;

    const cardSpend = transactions
      .filter((t) => t.type === "card" || t.type === "giftcard_purchase")
      .reduce((s, t) => s + t.amount, 0);
    const overallSavings = expenseTxns.reduce((s, t) => s + Number(t.savings || 0), 0);
    const totalGiftLeft = giftCards.reduce((s, g) => s + g.remainingAmount, 0);

    const walletBalances = {};
    for (const w of allWallets) {
      walletBalances[w] = giftCards.filter((g) => g.wallet === w).reduce((s, g) => s + g.remainingAmount, 0);
    }

    const { cycleStart, cycleEnd } = getBillingCycleRange();
    const inCycle = (t) => {
      if (!t.date) return false;
      const d = new Date(t.date + "T00:00:00");
      return d >= cycleStart && d <= cycleEnd;
    };
    const billingCycleSpend = expenseTxns.filter(inCycle).reduce((s, t) => s + t.amount, 0);
    const cycleIncome = incomeTxns.filter(inCycle).reduce((s, t) => s + t.amount, 0);

    // Today's spend
    const todayISO = new Date().toISOString().split("T")[0];
    const todaySpend = expenseTxns
      .filter((t) => t.date === todayISO)
      .reduce((s, t) => s + t.amount, 0);

    return { overallSpent, totalIncome, netBalance, cardSpend, overallSavings, totalGiftLeft, walletBalances, billingCycleSpend, cycleIncome, todaySpend };
  }, [transactions, giftCards, allWallets]);

  /* ── render ── */
  const showWallet = form.type === "giftcard_purchase";
  const showGCPicker = form.type === "giftcard_spend";
  const showSavings = isExpense;

  const cycleLabel = fmtCycle();

  const summaryCards = [
    { title: "Overall Spent",                       value: summary.overallSpent,      idx: 0 },
    { title: "Today's Spend",                       value: summary.todaySpend,        idx: 1 },
    { title: `Cycle Spend (${cycleLabel})`,         value: summary.billingCycleSpend, idx: 2 },
    { title: `Cycle Income (${cycleLabel})`,        value: summary.cycleIncome,       idx: 3 },
    { title: "SBI Card Utilized",                   value: summary.cardSpend,         idx: 4 },
    { title: "Overall Savings",                     value: summary.overallSavings,    idx: 5 },
    { title: "Total Income",                        value: summary.totalIncome,       idx: 6 },
    { title: "Total Gift Cards Left",               value: summary.totalGiftLeft,     idx: 7 },
    { title: "Net Balance",                         value: summary.netBalance,        idx: 8 },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto grid gap-6">

        {/* HEADER */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
          <img src="/sbi-logo.svg" alt="SBI" className="w-10 h-10" />
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-800 to-blue-500 bg-clip-text text-transparent">
            SBI Credit Card & Gift Card Tracker
          </h1>
        </motion.div>

        {/* ── INPUT FORM ── */}
        <Card className="rounded-2xl shadow-md border-indigo-100 border">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <PlusCircle size={18} className="text-indigo-500" />
              <span className="font-semibold text-indigo-900">New Transaction</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <Field label="Date">
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </Field>
              <Field label="Description">
                <Input placeholder="e.g. Swiggy, Amazon order" value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </Field>
              <Field label="Amount (₹)">
                <Input type="number" placeholder="0" value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </Field>
              {showSavings && (
                <Field label={`Savings % (default ${DEFAULT_SAVINGS_PCT}%)`}>
                  <Input type="number" placeholder={String(DEFAULT_SAVINGS_PCT)} value={form.savingsPct}
                    onChange={(e) => setForm({ ...form, savingsPct: e.target.value })} />
                </Field>
              )}
              <Field label="Type">
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="card">Card Spend</SelectItem>
                    <SelectItem value="daily_spend">Daily Spend (Cash/UPI)</SelectItem>
                    <SelectItem value="giftcard_purchase">Buy Gift Card</SelectItem>
                    <SelectItem value="giftcard_spend">Spend Gift Card</SelectItem>
                    <SelectItem value="income">Income / Money Received</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              {/* Wallet picker — only for gift card purchase */}
              {showWallet && (
                <Field label="Platform">
                  {showAddWallet ? (
                    <div className="flex gap-1">
                      <Input placeholder="e.g. PS5, Myntra" value={newWalletName}
                        onChange={(e) => setNewWalletName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && addWallet()} />
                      <Button onClick={addWallet} size="icon" className="shrink-0 bg-emerald-600 hover:bg-emerald-700">
                        <Plus size={14} />
                      </Button>
                      <Button onClick={() => setShowAddWallet(false)} size="icon" variant="ghost" className="shrink-0 text-slate-400">
                        ✕
                      </Button>
                    </div>
                  ) : manageWallets ? (
                    <div className="flex flex-col gap-1">
                      {allWallets.map((w) => {
                        const isDefault = DEFAULT_WALLETS.includes(w);
                        return (
                          <div key={w} className="flex items-center justify-between rounded-md border px-2 py-1 text-sm">
                            <span>{w.charAt(0).toUpperCase() + w.slice(1)}</span>
                            {!isDefault && (
                              <button onClick={() => removeWallet(w)}
                                className="text-red-400 hover:text-red-600 ml-2" title="Remove">
                                <Trash2 size={13} />
                              </button>
                            )}
                            {isDefault && <span className="text-xs text-muted-foreground">default</span>}
                          </div>
                        );
                      })}
                      <Button onClick={() => setManageWallets(false)} variant="ghost" className="text-xs h-7">
                        Done
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-1">
                      <Select value={form.wallet} onValueChange={(v) => setForm({ ...form, wallet: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {allWallets.map((w) => (
                            <SelectItem key={w} value={w}>{w.charAt(0).toUpperCase() + w.slice(1)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button onClick={() => setShowAddWallet(true)} size="icon" variant="ghost"
                        className="shrink-0 text-indigo-500 hover:text-indigo-700" title="Add new platform">
                        <Plus size={16} />
                      </Button>
                      {customWallets.length > 0 && (
                        <Button onClick={() => setManageWallets(true)} size="icon" variant="ghost"
                          className="shrink-0 text-red-400 hover:text-red-600" title="Remove a platform">
                          <Trash2 size={14} />
                        </Button>
                      )}
                    </div>
                  )}
                </Field>
              )}

              {/* Gift card discount — only for gift card purchase */}
              {showWallet && (
                <Field label="Gift Card Discount %">
                  <Input type="number" placeholder="0" value={form.gcDiscountPct}
                    onChange={(e) => setForm({ ...form, gcDiscountPct: e.target.value })} />
                </Field>
              )}

              {/* Gift card picker — only for spending */}
              {showGCPicker && (
                <Field label="Gift Card">
                  <Select value={form.giftCardId} onValueChange={(v) => setForm({ ...form, giftCardId: v })}>
                    <SelectTrigger><SelectValue placeholder="Select Gift Card" /></SelectTrigger>
                    <SelectContent>
                      {giftCards.filter((g) => g.remainingAmount > 0).map((g) => (
                        <SelectItem key={g.id} value={String(g.id)}>
                          {g.wallet} • ₹{g.remainingAmount} left
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}

              <div className="flex flex-col justify-end">
                <Button onClick={addTransaction} className="gap-2 w-full bg-indigo-600 hover:bg-indigo-700 text-white">
                  <PlusCircle size={16} /> Add
                </Button>
              </div>
            </div>

            {/* Live savings preview */}
            {amountNum > 0 && isExpense && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="mt-4 p-3 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 text-sm">
                <div className="flex flex-wrap gap-x-6 gap-y-1">
                  <span className="text-emerald-700">
                    Base saving ({savingsPct}%): <b>₹{baseSaving.toFixed(2)}</b>
                  </span>
                  {isGCPurchase && gcDiscountPct > 0 && (
                    <span className="text-teal-700">
                      + GC discount ({gcDiscountPct}%) → successive: {savingsPct} + {gcDiscountPct} − ({savingsPct}×{gcDiscountPct}/100) = <b>{effectivePct.toFixed(2)}%</b>
                    </span>
                  )}
                  <span className="text-emerald-800 font-semibold">
                    Total saved: ₹{totalSaving.toFixed(2)}
                  </span>
                  {isGCPurchase && gcDiscountPct > 0 && (
                    <span className="text-slate-600">
                      You pay: ₹{actualPaid.toFixed(2)} for ₹{amountNum} card
                    </span>
                  )}
                </div>
              </motion.div>
            )}
          </CardContent>
        </Card>

        {/* ── SUMMARY CARDS ── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {summaryCards.map(({ title, value, idx }) => {
            const s = SUMMARY_STYLES[idx % SUMMARY_STYLES.length];
            const Icon = s.icon;
            return (
              <motion.div key={title} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}>
                <Card className={`rounded-2xl shadow-sm border ${s.border} ${s.bg}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Icon size={14} className={s.text} />
                      <p className={`text-xs font-medium ${s.text}`}>{title}</p>
                    </div>
                    <p className="text-xl font-bold text-slate-800">₹{Number(value || 0).toFixed(2)}</p>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* ── PER-WALLET GIFT CARD BALANCES ── */}
        {Object.entries(summary.walletBalances).some(([, v]) => v > 0) && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(summary.walletBalances).filter(([, v]) => v > 0).map(([wallet, bal]) => {
              const c = wc(wallet);
              return (
                <Card key={wallet} className={`rounded-2xl shadow-sm border ${c.border} ${c.bg}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Wallet size={14} className={c.text} />
                      <p className={`text-xs font-medium ${c.text}`}>{wallet.charAt(0).toUpperCase() + wallet.slice(1)} Gift Left</p>
                    </div>
                    <p className="text-xl font-bold text-slate-800">₹{bal.toFixed(2)}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* ── GIFT CARD LIST ── */}
        <Card className="rounded-2xl shadow-sm border border-amber-100">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Gift size={18} className="text-amber-500" />
              <h2 className="text-lg font-semibold text-amber-900">Your Gift Cards</h2>
            </div>
            <div className="grid gap-2">
              {giftCards.length === 0 && (
                <p className="text-sm text-muted-foreground">No gift cards yet.</p>
              )}
              {giftCards.map((g) => {
                const c = wc(g.wallet);
                const pct = g.originalAmount > 0 ? (g.remainingAmount / g.originalAmount) * 100 : 0;
                return (
                  <div key={g.id} className={`flex items-center justify-between border rounded-xl p-3 ${c.bg} ${c.border}`}>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.badge}`}>
                          {g.wallet}
                        </span>
                        <span className="font-medium text-slate-800">₹{g.originalAmount}</span>
                        {g.discountPct > 0 && (
                          <span className="text-xs text-emerald-600">({g.discountPct}% off → paid ₹{g.paidAmount})</span>
                        )}
                      </div>
                      <div className="mt-1.5 w-full bg-slate-200 rounded-full h-1.5">
                        <div className="bg-emerald-500 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Remaining: ₹{g.remainingAmount} • {g.date}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeGiftCard(g.id)}
                      className="text-red-400 hover:text-red-600 hover:bg-red-50 shrink-0 ml-2">
                      <Trash2 size={16} />
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* ── TRANSACTIONS ── */}
        <Card className="rounded-2xl shadow-sm border border-slate-200">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <ShoppingBag size={18} className="text-slate-500" />
              <h2 className="text-lg font-semibold text-slate-800">Transactions</h2>
            </div>
            <div className="grid gap-2">
              {transactions.length === 0 && (
                <p className="text-sm text-muted-foreground">No transactions yet.</p>
              )}
              {transactions.map((t) => {
                const typeColor = t.type === "card"
                  ? "bg-indigo-100 text-indigo-700"
                  : t.type === "giftcard_purchase"
                    ? "bg-amber-100 text-amber-700"
                    : t.type === "income"
                      ? "bg-green-100 text-green-700"
                      : t.type === "daily_spend"
                        ? "bg-rose-100 text-rose-700"
                        : "bg-emerald-100 text-emerald-700";
                const typeLabel = { card: "Card", giftcard_purchase: "GC Buy", giftcard_spend: "GC Spend", income: "Income", daily_spend: "Daily" }[t.type] || t.type;
                const isIncomeRow = t.type === "income";
                return (
                  <div key={t.id} className={`flex justify-between items-center border rounded-xl p-3 hover:bg-slate-50 transition-colors ${isIncomeRow ? "border-green-200 bg-green-50/50" : ""}`}>
                    <div>
                      <p className="font-medium text-slate-800">{t.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColor}`}>
                          {typeLabel}
                        </span>
                        {t.wallet && t.type !== "card" && t.type !== "income" && t.type !== "daily_spend" && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${wc(t.wallet).badge}`}>
                            {t.wallet}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">{t.date || "No date"}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className={`font-semibold ${isIncomeRow ? "text-green-600" : "text-slate-800"}`}>
                          {isIncomeRow ? "+" : ""}₹{t.amount}
                        </span>
                        {t.savings > 0 && (
                          <p className="text-xs text-emerald-600">saved ₹{Number(t.savings).toFixed(2)}</p>
                        )}
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removeTransaction(t.id)}
                        className="text-red-400 hover:text-red-600 hover:bg-red-50">
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ── tiny helper ── */
function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-500">{label}</label>
      {children}
    </div>
  );
}
