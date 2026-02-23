import React, { useState, useMemo, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { motion } from "framer-motion";
import { PlusCircle, Trash2 } from "lucide-react";

// Billing cycle: 24th of previous month → 23rd of current month
function getBillingCycleRange() {
  const now = new Date();
  const day = now.getDate();
  let cycleStart, cycleEnd;

  if (day >= 24) {
    // We're in the cycle that started on the 24th of this month
    cycleStart = new Date(now.getFullYear(), now.getMonth(), 24);
    cycleEnd = new Date(now.getFullYear(), now.getMonth() + 1, 23, 23, 59, 59);
  } else {
    // We're in the cycle that started on the 24th of last month
    cycleStart = new Date(now.getFullYear(), now.getMonth() - 1, 24);
    cycleEnd = new Date(now.getFullYear(), now.getMonth(), 23, 23, 59, 59);
  }
  return { cycleStart, cycleEnd };
}

function formatCycleLabel() {
  const { cycleStart, cycleEnd } = getBillingCycleRange();
  const fmt = (d) =>
    d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return `${fmt(cycleStart)} – ${fmt(cycleEnd)}`;
}

export default function SBCashbackTracker() {
  // ================= STORAGE =================
  const [transactions, setTransactions] = useState(() => {
    const saved =
      typeof window !== "undefined"
        ? localStorage.getItem("sb-transactions")
        : null;
    return saved ? JSON.parse(saved) : [];
  });

  const [giftCards, setGiftCards] = useState(() => {
    const saved =
      typeof window !== "undefined"
        ? localStorage.getItem("sb-giftcards")
        : null;
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem("sb-transactions", JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem("sb-giftcards", JSON.stringify(giftCards));
  }, [giftCards]);

  // ================= FORMS =================
  const todayStr = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    date: todayStr,
    description: "",
    amount: "",
    savings: "",
    type: "card",
    wallet: "amazon",
    giftCardId: "",
  });

  // ================= ACTIONS =================
  const addTransaction = () => {
    if (!form.amount || !form.description) return;
    const amountNum = Number(form.amount);
    const savingsNum = Number(form.savings || 0);
    const dateVal = form.date || todayStr;

    if (form.type === "giftcard_purchase") {
      const newCard = {
        id: Date.now(),
        wallet: form.wallet,
        originalAmount: amountNum,
        remainingAmount: amountNum,
        description: form.description,
        date: dateVal,
      };
      setGiftCards([...giftCards, newCard]);
    }

    if (form.type === "giftcard_spend" && form.giftCardId) {
      setGiftCards((prev) =>
        prev.map((gc) => {
          if (gc.id === Number(form.giftCardId)) {
            return {
              ...gc,
              remainingAmount: Math.max(0, gc.remainingAmount - amountNum),
            };
          }
          return gc;
        })
      );
    }

    setTransactions([
      ...transactions,
      { ...form, id: Date.now(), amount: amountNum, savings: savingsNum, date: dateVal },
    ]);
    setForm({
      date: todayStr,
      description: "",
      amount: "",
      savings: "",
      type: "card",
      wallet: "amazon",
      giftCardId: "",
    });
  };

  const removeTransaction = (id) => {
    setTransactions(transactions.filter((t) => t.id !== id));
  };

  // ================= SUMMARY =================
  const summary = useMemo(() => {
    const overallSpent = transactions.reduce((s, t) => s + t.amount, 0);

    const cardSpend = transactions
      .filter((t) => t.type === "card" || t.type === "giftcard_purchase")
      .reduce((sum, t) => sum + t.amount, 0);

    const overallSavings = transactions.reduce(
      (s, t) => s + Number(t.savings || 0),
      0
    );

    const amazonBalance = giftCards
      .filter((g) => g.wallet === "amazon")
      .reduce((s, g) => s + g.remainingAmount, 0);

    const flipkartBalance = giftCards
      .filter((g) => g.wallet === "flipkart")
      .reduce((s, g) => s + g.remainingAmount, 0);

    const totalGiftLeft = giftCards.reduce(
      (s, g) => s + g.remainingAmount,
      0
    );

    // Billing cycle spend (24th to 24th)
    const { cycleStart, cycleEnd } = getBillingCycleRange();
    const billingCycleSpend = transactions
      .filter((t) => {
        if (!t.date) return false;
        const d = new Date(t.date + "T00:00:00");
        return d >= cycleStart && d <= cycleEnd;
      })
      .reduce((s, t) => s + t.amount, 0);

    const cashback = cardSpend * 0.01;

    return {
      overallSpent,
      cardSpend,
      amazonBalance,
      flipkartBalance,
      totalGiftLeft,
      billingCycleSpend,
      cashback,
      overallSavings,
    };
  }, [transactions, giftCards]);

  // ================= UI =================
  const showWallet = form.type === "giftcard_purchase";
  const showGiftCardPicker = form.type === "giftcard_spend";

  return (
    <div className="p-6 max-w-6xl mx-auto grid gap-6">
      <motion.h1
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-3xl font-bold"
      >
        SB Credit Card & Gift Card Tracker
      </motion.h1>

      {/* INPUT FORM */}
      <Card className="rounded-2xl shadow">
        <CardContent className="p-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Date</label>
            <Input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Description</label>
            <Input
              placeholder="e.g. Swiggy, Amazon order"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Amount (₹)</label>
            <Input
              type="number"
              placeholder="0"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Savings / Discount (₹)</label>
            <Input
              type="number"
              placeholder="0"
              value={form.savings}
              onChange={(e) => setForm({ ...form, savings: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Type</label>
            <Select
              value={form.type}
              onValueChange={(v) => setForm({ ...form, type: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="card">Card Spend</SelectItem>
                <SelectItem value="giftcard_purchase">Buy Gift Card</SelectItem>
                <SelectItem value="giftcard_spend">Spend Gift Card</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Only show wallet picker when buying a gift card */}
          {showWallet && (
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Platform</label>
              <Select
                value={form.wallet}
                onValueChange={(v) => setForm({ ...form, wallet: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Wallet" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="amazon">Amazon</SelectItem>
                  <SelectItem value="flipkart">Flipkart</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Only show gift card picker when spending a gift card */}
          {showGiftCardPicker && (
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Gift Card</label>
              <Select
                value={form.giftCardId}
                onValueChange={(v) => setForm({ ...form, giftCardId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Gift Card" />
                </SelectTrigger>
                <SelectContent>
                  {giftCards
                    .filter((g) => g.remainingAmount > 0)
                    .map((g) => (
                      <SelectItem key={g.id} value={String(g.id)}>
                        {g.wallet} • ₹{g.remainingAmount} left
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex flex-col justify-end">
            <Button onClick={addTransaction} className="gap-2 w-full">
              <PlusCircle size={16} /> Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* SUMMARY */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard title="Overall Spent" value={summary.overallSpent} />
        <SummaryCard title={`Cycle Spend (${formatCycleLabel()})`} value={summary.billingCycleSpend} />
        <SummaryCard title="SB Card Utilized" value={summary.cardSpend} />
        <SummaryCard title="Est. Cashback (1%)" value={summary.cashback} />
        <SummaryCard title="Overall Savings" value={summary.overallSavings} />
        <SummaryCard title="Amazon Gift Left" value={summary.amazonBalance} />
        <SummaryCard title="Flipkart Gift Left" value={summary.flipkartBalance} />
        <SummaryCard title="Total Gift Cards Left" value={summary.totalGiftLeft} />
      </div>

      {/* GIFT CARD LIST */}
      <Card className="rounded-2xl shadow">
        <CardContent className="p-4">
          <h2 className="text-xl font-semibold mb-3">Your Gift Cards</h2>
          <div className="grid gap-2">
            {giftCards.length === 0 && (
              <p className="text-sm text-muted-foreground">No gift cards yet.</p>
            )}
            {giftCards.map((g) => (
              <div
                key={g.id}
                className="flex justify-between border rounded-xl p-3"
              >
                <div>
                  <p className="font-medium">
                    {g.wallet} • ₹{g.originalAmount}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Remaining: ₹{g.remainingAmount}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* TRANSACTIONS */}
      <Card className="rounded-2xl shadow">
        <CardContent className="p-4">
          <h2 className="text-xl font-semibold mb-3">Transactions</h2>
          <div className="grid gap-2">
            {transactions.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No transactions yet.
              </p>
            )}
            {transactions.map((t) => (
              <div
                key={t.id}
                className="flex justify-between items-center border rounded-xl p-3"
              >
                <div>
                  <p className="font-medium">{t.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.date || "No date"} • {t.type}
                    {t.wallet && t.type !== "card" ? ` • ${t.wallet}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold">₹{t.amount}</span>
                  {t.savings > 0 && (
                    <span className="text-xs text-green-600">saved ₹{t.savings}</span>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeTransaction(t.id)}
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ title, value }) {
  return (
    <Card className="rounded-2xl shadow">
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{title}</p>
        <p className="text-2xl font-bold mt-1">
          ₹{Number(value || 0).toFixed(2)}
        </p>
      </CardContent>
    </Card>
  );
}
