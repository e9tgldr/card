-- Shop orders: physical-card pre-orders submitted from the landing page.

create table orders (
  id               uuid        primary key default gen_random_uuid(),
  tier             text        not null check (tier in ('basic','premium','collector')),
  customer_name    text        not null,
  customer_phone   text        not null,
  customer_address text        not null,
  notes            text,
  status           text        not null default 'pending'
                                check (status in ('pending','confirmed','shipped','cancelled')),
  created_at       timestamptz not null default now()
);

alter table orders enable row level security;

create policy "orders public insert"
  on orders for insert with check (true);
-- No select/update/delete policies: clients can submit but cannot read orders.
-- Admin tooling reads via service role.
