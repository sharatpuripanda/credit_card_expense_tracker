import { supabase } from "./supabase";

/* ── Transactions ── */
export async function fetchTransactions(userId) {
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data.map((r) => ({ ...r.data, _rowId: r.id }));
}

export async function insertTransaction(userId, txn) {
  const { error } = await supabase
    .from("transactions")
    .insert({ user_id: userId, data: txn });
  if (error) throw error;
}

export async function deleteTransaction(userId, txnId) {
  // txnId is the app-level id stored inside data
  const { data, error: fetchErr } = await supabase
    .from("transactions")
    .select("id, data")
    .eq("user_id", userId);
  if (fetchErr) throw fetchErr;
  const row = data.find((r) => r.data?.id === txnId);
  if (row) {
    const { error } = await supabase.from("transactions").delete().eq("id", row.id);
    if (error) throw error;
  }
}

export async function replaceAllTransactions(userId, txns) {
  // Delete all then re-insert (used for import)
  await supabase.from("transactions").delete().eq("user_id", userId);
  if (txns.length > 0) {
    const rows = txns.map((t) => ({ user_id: userId, data: t }));
    const { error } = await supabase.from("transactions").insert(rows);
    if (error) throw error;
  }
}

/* ── Gift Cards ── */
export async function fetchGiftCards(userId) {
  const { data, error } = await supabase
    .from("gift_cards")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data.map((r) => ({ ...r.data, _rowId: r.id }));
}

export async function upsertGiftCards(userId, giftCards) {
  await supabase.from("gift_cards").delete().eq("user_id", userId);
  if (giftCards.length > 0) {
    const rows = giftCards.map((g) => ({ user_id: userId, data: g }));
    const { error } = await supabase.from("gift_cards").insert(rows);
    if (error) throw error;
  }
}

/* ── Custom Wallets ── */
export async function fetchWallets(userId) {
  const { data, error } = await supabase
    .from("user_settings")
    .select("data")
    .eq("user_id", userId)
    .eq("key", "wallets")
    .single();
  if (error && error.code !== "PGRST116") throw error; // PGRST116 = no rows
  return data?.data ?? [];
}

export async function saveWallets(userId, wallets) {
  const { error } = await supabase
    .from("user_settings")
    .upsert({ user_id: userId, key: "wallets", data: wallets }, { onConflict: "user_id,key" });
  if (error) throw error;
}

/* ── Investments ── */
export async function fetchInvestments(userId) {
  const { data, error } = await supabase
    .from("investments")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data.map((r) => ({ ...r.data, _rowId: r.id }));
}

export async function upsertInvestments(userId, investments) {
  await supabase.from("investments").delete().eq("user_id", userId);
  if (investments.length > 0) {
    const rows = investments.map((inv) => ({ user_id: userId, data: inv }));
    const { error } = await supabase.from("investments").insert(rows);
    if (error) throw error;
  }
}
