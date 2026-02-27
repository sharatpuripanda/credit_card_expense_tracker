-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- 1. Transactions table
create table if not exists transactions (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  data jsonb not null,
  created_at timestamptz default now()
);

-- 2. Gift cards table
create table if not exists gift_cards (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  data jsonb not null,
  created_at timestamptz default now()
);

-- 3. Investments table
create table if not exists investments (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  data jsonb not null,
  created_at timestamptz default now()
);

-- 4. User settings (wallets, preferences, etc.)
create table if not exists user_settings (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  key text not null,
  data jsonb not null,
  created_at timestamptz default now(),
  unique(user_id, key)
);

-- 5. Enable Row Level Security on all tables
alter table transactions enable row level security;
alter table gift_cards enable row level security;
alter table investments enable row level security;
alter table user_settings enable row level security;

-- 6. RLS Policies — users can only access their own data
create policy "Users can read own transactions" on transactions for select using (auth.uid() = user_id);
create policy "Users can insert own transactions" on transactions for insert with check (auth.uid() = user_id);
create policy "Users can delete own transactions" on transactions for delete using (auth.uid() = user_id);

create policy "Users can read own gift_cards" on gift_cards for select using (auth.uid() = user_id);
create policy "Users can insert own gift_cards" on gift_cards for insert with check (auth.uid() = user_id);
create policy "Users can delete own gift_cards" on gift_cards for delete using (auth.uid() = user_id);

create policy "Users can read own investments" on investments for select using (auth.uid() = user_id);
create policy "Users can insert own investments" on investments for insert with check (auth.uid() = user_id);
create policy "Users can delete own investments" on investments for delete using (auth.uid() = user_id);

create policy "Users can read own settings" on user_settings for select using (auth.uid() = user_id);
create policy "Users can insert own settings" on user_settings for insert with check (auth.uid() = user_id);
create policy "Users can update own settings" on user_settings for update using (auth.uid() = user_id);
create policy "Users can delete own settings" on user_settings for delete using (auth.uid() = user_id);
