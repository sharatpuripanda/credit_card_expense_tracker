import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { motion } from "framer-motion";
import {
  PlusCircle, Trash2, Plus, Gift, ShoppingBag,
  Wallet, TrendingUp, IndianRupee, Percent, ArrowDownCircle,
  ArrowUpCircle, CalendarDays, Landmark, Download, Upload, LogOut,
  Eye, EyeOff, Lock,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import {
  fetchTransactions, insertTransaction, deleteTransaction, replaceAllTransactions,
  fetchGiftCards, upsertGiftCards,
  fetchWallets, saveWallets,
  fetchInvestments, upsertInvestments,
} from "@/lib/db";

/* ── constants ── */
const DEFAULT_WALLETS = ["amazon", "flipkart"];
const DEFAULT_SAVINGS_PCT = 5;
const DEFAULT_INVEST_CATEGORIES = ["FD", "Mutual Fund", "SIP", "Stocks", "PPF", "NPS"];

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
  { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", icon: TrendingUp },
  { bg: "bg-green-50",   border: "border-green-200",   text: "text-green-700",   icon: Percent },
  { bg: "bg-teal-50",    border: "border-teal-200",    text: "text-teal-700",    icon: Gift },
  { bg: "bg-cyan-50",    border: "border-cyan-200",    text: "text-cyan-700",    icon: ArrowDownCircle },
  { bg: "bg-lime-50",    border: "border-lime-200",    text: "text-lime-700",    icon: ArrowUpCircle },
  { bg: "bg-rose-50",    border: "border-rose-200",    text: "text-rose-700",    icon: IndianRupee },
  { bg: "bg-amber-50",   border: "border-amber-200",   text: "text-amber-700",   icon: Landmark },
  { bg: "bg-indigo-50",  border: "border-indigo-200",  text: "text-indigo-700",  icon: Wallet },
];

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

function isThisYear(dateStr) {
  if (!dateStr) return false;
  return new Date(dateStr + "T00:00:00").getFullYear() === new Date().getFullYear();
}

/* ══════════════════════════════════════════════════════════════ */
export default function SBCashbackTracker() {
  const { user, signOut } = useAuth();
  const userId = user.id;

  const [transactions, setTransactions] = useState([]);
  const [giftCards, setGiftCards]       = useState([]);
  const [customWallets, setCustomWallets] = useState([]);
  const [investments, setInvestments]   = useState([]);
  const [dbLoading, setDbLoading]       = useState(true);
  // All amounts hidden by default; tap eye icon next to any value to peek
  const [revealed, setRevealed] = useState({});
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [newPin, setNewPin] = useState("");
  const [settingPin, setSettingPin] = useState(false);
  const [pendingPeekKey, setPendingPeekKey] = useState(null);

  const pinKey = `sb-pin-${userId}`;
  const getPin = () => typeof window !== "undefined" ? localStorage.getItem(pinKey) : null;

  const peek = (key) => {
    if (revealed[key]) {
      // Already showing — just hide it
      setRevealed((prev) => ({ ...prev, [key]: false }));
      return;
    }
    const pin = getPin();
    if (!pin) {
      // No PIN set — reveal directly
      setRevealed((prev) => ({ ...prev, [key]: true }));
      return;
    }
    // PIN is set — ask for it
    setPendingPeekKey(key);
    setPinInput("");
    setPinError("");
    setShowPinModal(true);
  };

  const unlockPeek = () => {
    if (pinInput === getPin()) {
      if (pendingPeekKey === "__reveal_all__") {
        // Reveal all values
        setRevealed({});
        // We'll use a special flag
        setRevealed((prev) => {
          const all = { ...prev };
          // Just set a global reveal flag
          all.__all__ = true;
          return all;
        });
      } else if (pendingPeekKey) {
        setRevealed((prev) => ({ ...prev, [pendingPeekKey]: true }));
      }
      setShowPinModal(false);
      setPinInput("");
      setPinError("");
      setPendingPeekKey(null);
    } else {
      setPinError("Wrong PIN");
    }
  };

  const saveNewPin = () => {
    if (newPin.length < 4) {
      setPinError("PIN must be at least 4 digits");
      return;
    }
    localStorage.setItem(pinKey, newPin);
    setSettingPin(false);
    setShowPinModal(false);
    setNewPin("");
    setPinError("");
  };

  const openSetPin = () => {
    setSettingPin(true);
    setShowPinModal(true);
    setNewPin("");
    setPinError("");
  };

  // Helper: returns masked or real value + eye toggle button
  const amt = (value, key) => {
    const show = revealed[key] || revealed.__all__;
    return (
      <span className="inline-flex items-center gap-1">
        <span>{show ? `₹${Number(value || 0).toFixed(2)}` : "••••"}</span>
        <button onClick={() => peek(key)} className="text-slate-400 hover:text-slate-600 shrink-0" type="button">
          {show ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>
      </span>
    );
  };

  // Track whether initial load is done to avoid saving back on mount
  const loaded = useRef(false);

  // ── Load from Supabase on mount ──
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [txns, gcs, wallets, invs] = await Promise.all([
          fetchTransactions(userId),
          fetchGiftCards(userId),
          fetchWallets(userId),
          fetchInvestments(userId),
        ]);
        if (cancelled) return;
        setTransactions(txns);
        setGiftCards(gcs);
        setCustomWallets(wallets);
        setInvestments(invs);
      } catch (err) {
        console.error("Failed to load data:", err);
      } finally {
        if (!cancelled) {
          setDbLoading(false);
          // Small delay so the initial setState doesn't trigger saves
          setTimeout(() => { loaded.current = true; }, 100);
        }
      }
    }
    load();
    return () => { cancelled = true; };
  }, [userId]);

  // ── Sync gift cards to Supabase when they change ──
  useEffect(() => {
    if (!loaded.current) return;
    upsertGiftCards(userId, giftCards).catch(console.error);
  }, [giftCards, userId]);

  // ── Sync wallets to Supabase when they change ──
  useEffect(() => {
    if (!loaded.current) return;
    saveWallets(userId, customWallets).catch(console.error);
  }, [customWallets, userId]);

  // ── Sync investments to Supabase when they change ──
  useEffect(() => {
    if (!loaded.current) return;
    upsertInvestments(userId, investments).catch(console.error);
  }, [investments, userId]);

  const allWallets = useMemo(() => {
    const fromGC = giftCards.map((g) => g.wallet?.toLowerCase()).filter(Boolean);
    return [...new Set([...DEFAULT_WALLETS, ...customWallets, ...fromGC].map((w) => w.toLowerCase()))];
  }, [customWallets, giftCards]);

  /* ── export / import for permanent backup ── */
  const exportData = useCallback(() => {
    const data = { transactions, giftCards, customWallets, investments, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `sbi-tracker-backup-${new Date().toISOString().split("T")[0]}.json`;
    a.click(); URL.revokeObjectURL(url);
  }, [transactions, giftCards, customWallets, investments]);

  const importData = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = ".json";
    input.onchange = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          if (data.transactions) {
            setTransactions(data.transactions);
            await replaceAllTransactions(userId, data.transactions);
          }
          if (data.giftCards) setGiftCards(data.giftCards);
          if (data.customWallets) setCustomWallets(data.customWallets);
          if (data.investments) setInvestments(data.investments);
        } catch { /* ignore bad file */ }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [userId]);

  /* ── form state ── */
  const todayStr = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    date: todayStr, description: "", amount: "", savingsPct: String(DEFAULT_SAVINGS_PCT),
    type: "card", wallet: "amazon", giftCardId: "", gcDiscountPct: "", investCategory: "FD",
  });
  const [newWalletName, setNewWalletName] = useState("");
  const [showAddWallet, setShowAddWallet] = useState(false);
  const [manageWallets, setManageWallets] = useState(false);

  const amountNum = Number(form.amount) || 0;
  const savingsPct = Number(form.savingsPct) || 0;
  const gcDiscountPct = Number(form.gcDiscountPct) || 0;

  const isGCPurchase = form.type === "giftcard_purchase";
  const isIncome = form.type === "income";
  const isInvestment = form.type === "investment";
  const isExpense = !isIncome && !isInvestment;

  const effectivePct = isGCPurchase && gcDiscountPct > 0
    ? savingsPct + gcDiscountPct - (savingsPct * gcDiscountPct / 100)
    : savingsPct;
  const totalSaving = isExpense ? amountNum * (effectivePct / 100) : 0;
  const gcDiscountSaving = isGCPurchase ? amountNum * (gcDiscountPct / 100) : 0;
  const baseSaving = amountNum * (savingsPct / 100);
  const actualPaid = isGCPurchase ? amountNum - gcDiscountSaving : amountNum;

  const addWallet = () => {
    const name = newWalletName.trim().toLowerCase();
    if (!name || allWallets.includes(name)) return;
    setCustomWallets([...customWallets, name]);
    setNewWalletName(""); setShowAddWallet(false);
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

    if (isGCPurchase) {
      linkedGiftCardId = String(txnId);
      setGiftCards([...giftCards, {
        id: txnId, wallet: form.wallet, originalAmount: amountNum,
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
    if (isInvestment) {
      setInvestments([...investments, {
        id: txnId, category: form.investCategory, amount: amountNum,
        description: form.description, date: dateVal,
      }]);
    }

    const newTxn = {
      ...form, id: txnId, amount: amountNum, savings: totalSaving,
      savingsPct: isExpense ? savingsPct : 0,
      gcDiscountPct: isGCPurchase ? gcDiscountPct : 0,
      paidAmount: actualPaid, date: dateVal, linkedGiftCardId,
      investCategory: isInvestment ? form.investCategory : "",
    };
    setTransactions([...transactions, newTxn]);
    insertTransaction(userId, newTxn).catch(console.error);

    setForm((prev) => ({
      date: todayStr, description: "", amount: "", savingsPct: String(DEFAULT_SAVINGS_PCT),
      type: "card", wallet: prev.wallet, giftCardId: "", gcDiscountPct: "", investCategory: prev.investCategory,
    }));
  };

  const removeTransaction = (id) => {
    const txn = transactions.find((t) => t.id === id);
    if (txn) {
      if (txn.type === "giftcard_purchase") {
        setGiftCards((prev) => prev.filter((gc) => gc.id !== Number(txn.linkedGiftCardId || txn.id)));
      }
      if (txn.type === "giftcard_spend" && txn.linkedGiftCardId) {
        setGiftCards((prev) => prev.map((gc) =>
          gc.id === Number(txn.linkedGiftCardId)
            ? { ...gc, remainingAmount: gc.remainingAmount + txn.amount } : gc
        ));
      }
      if (txn.type === "investment") {
        setInvestments((prev) => prev.filter((inv) => inv.id !== txn.id));
      }
    }
    setTransactions(transactions.filter((t) => t.id !== id));
    deleteTransaction(userId, id).catch(console.error);
  };

  const removeGiftCard = (gcId) => setGiftCards((prev) => prev.filter((gc) => gc.id !== gcId));
  const removeInvestment = (invId) => setInvestments((prev) => prev.filter((inv) => inv.id !== invId));

  /* ── summary ── */
  const summary = useMemo(() => {
    const expenseThisYear = transactions.filter((t) => t.type !== "income" && t.type !== "investment" && isThisYear(t.date));
    const incomeThisYear = transactions.filter((t) => t.type === "income" && isThisYear(t.date));
    const investThisYear = transactions.filter((t) => t.type === "investment" && isThisYear(t.date));

    const overallSpent = expenseThisYear.reduce((s, t) => s + t.amount, 0);
    const totalIncome = incomeThisYear.reduce((s, t) => s + t.amount, 0);
    const overallSavings = expenseThisYear.reduce((s, t) => s + Number(t.savings || 0), 0);
    const totalInvested = investThisYear.reduce((s, t) => s + t.amount, 0);

    // All-time net balance
    const allIncome = transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const allExpense = transactions.filter((t) => t.type !== "income" && t.type !== "investment").reduce((s, t) => s + t.amount, 0);
    const netBalance = allIncome - allExpense;

    const totalGCBought = expenseThisYear.filter((t) => t.type === "giftcard_purchase").reduce((s, t) => s + t.amount, 0);
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
    const allTxns = transactions;
    const cycleExpense = allTxns.filter((t) => t.type !== "income" && t.type !== "investment").filter(inCycle).reduce((s, t) => s + t.amount, 0);
    const cycleIncome = allTxns.filter((t) => t.type === "income").filter(inCycle).reduce((s, t) => s + t.amount, 0);
    const cycleGCBought = allTxns.filter((t) => t.type === "giftcard_purchase").filter(inCycle).reduce((s, t) => s + t.amount, 0);
    const cycleGCSpent = allTxns.filter((t) => t.type === "giftcard_spend").filter(inCycle).reduce((s, t) => s + t.amount, 0);
    const cycleInvested = allTxns.filter((t) => t.type === "investment").filter(inCycle).reduce((s, t) => s + t.amount, 0);
    const cycleSavings = allTxns.filter((t) => t.type !== "income" && t.type !== "investment").filter(inCycle).reduce((s, t) => s + Number(t.savings || 0), 0);
    const cycleGCDiscount = allTxns.filter((t) => t.type === "giftcard_purchase").filter(inCycle).reduce((s, t) => {
      const gcDisc = Number(t.gcDiscountPct || 0);
      return s + (gcDisc > 0 ? t.amount * (gcDisc / 100) : 0);
    }, 0);

    return { overallSpent, totalIncome, netBalance, overallSavings, totalGiftLeft, totalGCBought, totalInvested, walletBalances, cycleExpense, cycleIncome, cycleGCBought, cycleGCSpent, cycleInvested, cycleSavings, cycleGCDiscount };
  }, [transactions, giftCards, allWallets]);

  /* ── render ── */
  if (dbLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-indigo-50">
        <p className="text-slate-500 text-sm">Loading your data...</p>
      </div>
    );
  }

  const showWallet = isGCPurchase;
  const showGCPicker = form.type === "giftcard_spend";
  const showSavings = isExpense;
  const showInvestCategory = isInvestment;
  const cycleLabel = fmtCycle();
  const year = new Date().getFullYear();

  const summaryCards = [
    // ── Yearly (from Jan) ──
    { title: `Overall Spent (${year})`,             value: summary.overallSpent,   idx: 0 },
    { title: `Overall Savings (${year})`,           value: summary.overallSavings, idx: 1 },
    { title: `Total Income (${year})`,              value: summary.totalIncome,    idx: 2 },
    { title: `Total Invested (${year})`,            value: summary.totalInvested,  idx: 3 },
    { title: `Gift Cards Bought (${year})`,         value: summary.totalGCBought,  idx: 4 },
    { title: "Total Gift Cards Left",               value: summary.totalGiftLeft,  idx: 5 },
    // ── Billing Cycle (24th–24th) ──
    { title: `Cycle Spend (${cycleLabel})`,         value: summary.cycleExpense,   idx: 6 },
    { title: `Cycle Income (${cycleLabel})`,        value: summary.cycleIncome,    idx: 7 },
    { title: `Cycle Savings (${cycleLabel})`,       value: summary.cycleSavings,   idx: 8 },
    { title: `Cycle GC Discount (${cycleLabel})`,   value: summary.cycleGCDiscount, idx: 9 },
    { title: `Cycle GC Bought (${cycleLabel})`,     value: summary.cycleGCBought,  idx: 10 },
    { title: `Cycle GC Spent (${cycleLabel})`,      value: summary.cycleGCSpent,   idx: 11 },
    { title: `Cycle Invested (${cycleLabel})`,      value: summary.cycleInvested,  idx: 12 },
    // ── All Time ──
    { title: "Net Balance (All Time)",              value: summary.netBalance,     idx: 13 },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto grid gap-6">

        {/* HEADER */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/sbi-logo.svg" alt="SBI" className="w-10 h-10" />
            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-800 to-blue-500 bg-clip-text text-transparent">
              SBI Card & Finance Tracker
            </h1>
          </div>
          <div className="flex gap-2">
            <Button onClick={openSetPin} variant="ghost" size="icon" title={getPin() ? "Change PIN" : "Set PIN"}>
              <Lock size={18} className={getPin() ? "text-emerald-500" : "text-slate-500"} />
            </Button>
            <Button onClick={exportData} variant="ghost" size="icon" title="Export backup">
              <Download size={18} className="text-slate-500" />
            </Button>
            <Button onClick={importData} variant="ghost" size="icon" title="Import backup">
              <Upload size={18} className="text-slate-500" />
            </Button>
            <Button onClick={signOut} variant="ghost" size="icon" title="Sign out">
              <LogOut size={18} className="text-slate-500" />
            </Button>
          </div>
        </motion.div>


        {/* ── PIN MODAL ── */}
        {showPinModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
            onClick={() => { setShowPinModal(false); setSettingPin(false); setPendingPeekKey(null); }}>
            <Card className="rounded-2xl shadow-lg w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
              <CardContent className="p-6">
                <div className="flex flex-col items-center gap-2 mb-4">
                  <Lock size={24} className="text-indigo-500" />
                  <h2 className="text-base font-semibold text-slate-800">
                    {settingPin ? (getPin() ? "Change PIN" : "Set Your PIN") : "Enter PIN"}
                  </h2>
                </div>
                {settingPin ? (
                  <div className="grid gap-3">
                    <Input type="password" inputMode="numeric" placeholder="Enter a 4+ digit PIN"
                      value={newPin} onChange={(e) => setNewPin(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && saveNewPin()} autoFocus />
                    {pinError && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-2">{pinError}</p>}
                    <Button onClick={saveNewPin} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">Save PIN</Button>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    <Input type="password" inputMode="numeric" placeholder="Enter PIN"
                      value={pinInput} onChange={(e) => setPinInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && unlockPeek()} autoFocus />
                    {pinError && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-2">{pinError}</p>}
                    <Button onClick={unlockPeek} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">Unlock</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

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
                <Input placeholder="e.g. Swiggy, SBI FD" value={form.description}
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
                    <SelectItem value="investment">Investment (FD/MF/SIP)</SelectItem>
                    <SelectItem value="income">Income / Money Received</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              {showInvestCategory && (
                <Field label="Investment Type">
                  <Select value={form.investCategory} onValueChange={(v) => setForm({ ...form, investCategory: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DEFAULT_INVEST_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}

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
                      <Button onClick={() => setShowAddWallet(false)} size="icon" variant="ghost" className="shrink-0 text-slate-400">✕</Button>
                    </div>
                  ) : manageWallets ? (
                    <div className="flex flex-col gap-1">
                      {allWallets.map((w) => {
                        const isDef = DEFAULT_WALLETS.includes(w);
                        return (
                          <div key={w} className="flex items-center justify-between rounded-md border px-2 py-1 text-sm">
                            <span>{w.charAt(0).toUpperCase() + w.slice(1)}</span>
                            {!isDef ? <button onClick={() => removeWallet(w)} className="text-red-400 hover:text-red-600 ml-2"><Trash2 size={13} /></button>
                              : <span className="text-xs text-muted-foreground">default</span>}
                          </div>
                        );
                      })}
                      <Button onClick={() => setManageWallets(false)} variant="ghost" className="text-xs h-7">Done</Button>
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
                      <Button onClick={() => setShowAddWallet(true)} size="icon" variant="ghost" className="shrink-0 text-indigo-500 hover:text-indigo-700"><Plus size={16} /></Button>
                      {customWallets.length > 0 && (
                        <Button onClick={() => setManageWallets(true)} size="icon" variant="ghost" className="shrink-0 text-red-400 hover:text-red-600"><Trash2 size={14} /></Button>
                      )}
                    </div>
                  )}
                </Field>
              )}
              {showWallet && (
                <Field label="Gift Card Discount %">
                  <Input type="number" placeholder="0" value={form.gcDiscountPct}
                    onChange={(e) => setForm({ ...form, gcDiscountPct: e.target.value })} />
                </Field>
              )}
              {showGCPicker && (
                <Field label="Gift Card">
                  <Select value={form.giftCardId} onValueChange={(v) => setForm({ ...form, giftCardId: v })}>
                    <SelectTrigger><SelectValue placeholder="Select Gift Card" /></SelectTrigger>
                    <SelectContent>
                      {giftCards.filter((g) => g.remainingAmount > 0).map((g) => (
                        <SelectItem key={g.id} value={String(g.id)}>{g.wallet} • ₹{g.remainingAmount} left</SelectItem>
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

            {amountNum > 0 && isExpense && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="mt-4 p-3 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 text-sm">
                <div className="flex flex-wrap gap-x-6 gap-y-1">
                  <span className="text-emerald-700">Base saving ({savingsPct}%): <b>₹{baseSaving.toFixed(2)}</b></span>
                  {isGCPurchase && gcDiscountPct > 0 && (
                    <span className="text-teal-700">+ GC discount ({gcDiscountPct}%) → successive: {savingsPct}+{gcDiscountPct}−({savingsPct}×{gcDiscountPct}/100) = <b>{effectivePct.toFixed(2)}%</b></span>
                  )}
                  <span className="text-emerald-800 font-semibold">Total saved: ₹{totalSaving.toFixed(2)}</span>
                  {isGCPurchase && gcDiscountPct > 0 && (
                    <span className="text-slate-600">You pay: ₹{actualPaid.toFixed(2)} for ₹{amountNum} card</span>
                  )}
                </div>
              </motion.div>
            )}
          </CardContent>
        </Card>

        {/* ── SUMMARY CARDS ── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-3">
          {summaryCards.map(({ title, value, idx, isCount }) => {
            const s = SUMMARY_STYLES[idx % SUMMARY_STYLES.length];
            const Icon = s.icon;
            return (
              <motion.div key={title} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}>
                <Card className={`rounded-2xl shadow-sm border ${s.border} ${s.bg}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Icon size={14} className={s.text} />
                      <p className={`text-xs font-medium ${s.text}`}>{title}</p>
                    </div>
                    <p className="text-xl font-bold text-slate-800">
                      {isCount ? value : <span className="text-xl font-bold text-slate-800">{amt(value, `summary-${idx}`)}</span>}
                    </p>
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
                    <p className="text-xl font-bold text-slate-800">{amt(bal, `wallet-${wallet}`)}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* ── INVESTMENTS LIST ── */}
        {investments.length > 0 && (
          <Card className="rounded-2xl shadow-md border-fuchsia-100 border">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Landmark size={18} className="text-fuchsia-500" />
                <span className="font-semibold text-fuchsia-900">Your Investments</span>
              </div>
              <div className="grid gap-2">
                {investments.map((inv) => (
                  <motion.div key={inv.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="flex items-center justify-between p-3 rounded-xl bg-fuchsia-50 border border-fuchsia-200">
                    <div className="flex items-center gap-3">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-fuchsia-100 text-fuchsia-700 font-medium">{inv.category}</span>
                      <span className="text-sm font-medium text-slate-700">{inv.description}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-slate-500">{inv.date}</span>
                      <span className="font-bold text-fuchsia-700">{amt(inv.amount, `inv-${inv.id}`)}</span>
                      <button onClick={() => removeInvestment(inv.id)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── GIFT CARDS LIST ── */}
        {giftCards.length > 0 && (
          <Card className="rounded-2xl shadow-md border-teal-100 border">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Gift size={18} className="text-teal-500" />
                <span className="font-semibold text-teal-900">Your Gift Cards</span>
              </div>
              <div className="grid gap-2">
                {giftCards.map((gc) => {
                  const c = wc(gc.wallet);
                  const pct = gc.originalAmount > 0 ? (gc.remainingAmount / gc.originalAmount) * 100 : 0;
                  return (
                    <motion.div key={gc.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className={`p-3 rounded-xl border ${c.border} ${c.bg}`}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.badge}`}>
                            {gc.wallet}
                          </span>
                          <span className="font-bold text-slate-800">{amt(gc.originalAmount, `gc-orig-${gc.id}`)}</span>
                          {gc.discountPct > 0 && revealed[`gc-orig-${gc.id}`] && (
                            <span className="text-xs text-slate-500">({gc.discountPct}% off → paid ₹{gc.paidAmount?.toFixed(2) ?? gc.originalAmount})</span>
                          )}
                        </div>
                        <button onClick={() => removeGiftCard(gc.id)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                        <span>{amt(gc.remainingAmount, `gc-rem-${gc.id}`)} • {gc.date}</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full ${pct > 50 ? "bg-emerald-400" : pct > 20 ? "bg-amber-400" : "bg-red-400"}`}
                          style={{ width: `${pct}%` }} />
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── TRANSACTIONS LIST ── */}
        {transactions.length > 0 && (
          <Card className="rounded-2xl shadow-md border-slate-200 border">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <ShoppingBag size={18} className="text-slate-500" />
                <span className="font-semibold text-slate-800">Transactions</span>
              </div>
              <div className="grid gap-2">
                {[...transactions].reverse().map((t) => {
                  const isInc = t.type === "income";
                  const isInv = t.type === "investment";
                  const isGCBuy = t.type === "giftcard_purchase";
                  const isGCSpend = t.type === "giftcard_spend";
                  const typeLabel = isInc ? "Income" : isInv ? "Invest" : isGCBuy ? "GC Buy" : isGCSpend ? "GC Spend" : t.type === "daily_spend" ? "Daily" : "Card";
                  const typeBg = isInc ? "bg-green-100 text-green-700"
                    : isInv ? "bg-fuchsia-100 text-fuchsia-700"
                    : isGCBuy ? "bg-teal-100 text-teal-700"
                    : isGCSpend ? "bg-cyan-100 text-cyan-700"
                    : t.type === "daily_spend" ? "bg-amber-100 text-amber-700"
                    : "bg-indigo-100 text-indigo-700";
                  return (
                    <motion.div key={t.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-100 hover:border-slate-200 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${typeBg}`}>{typeLabel}</span>
                        {(isGCBuy || isGCSpend) && t.wallet && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${wc(t.wallet).badge}`}>{t.wallet}</span>
                        )}
                        {isInv && t.investCategory && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-fuchsia-50 text-fuchsia-600 font-medium shrink-0">{t.investCategory}</span>
                        )}
                        <span className="text-sm text-slate-700 truncate">{t.description}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs text-slate-400">{t.date}</span>
                        <span className={`font-bold ${isInc ? "text-green-600" : "text-slate-800"}`}>
                          {amt(t.amount, `txn-${t.id}`)}
                        </span>
                        {t.savings > 0 && (
                          <span className="text-xs text-emerald-600">saved {amt(t.savings, `txn-sav-${t.id}`)}</span>
                        )}
                        <button onClick={() => removeTransaction(t.id)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

      </div>{/* end max-w-6xl grid */}
    </div>
  );
}

/* ── helper ── */
function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-500">{label}</label>
      {children}
    </div>
  );
}
