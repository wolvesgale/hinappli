-- Update payment method options and attendance schema adjustments

-- Ensure payment_method column exists and enforces allowed values
alter table public.transactions
  add column if not exists payment_method text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'transactions_payment_method_check'
  ) then
    alter table public.transactions
      add constraint transactions_payment_method_check
      check (payment_method in ('cash', 'paypay_credit', 'tsuke'));
  end if;
end $$;

-- Migrate existing paypay values to the new key
update public.transactions
  set payment_method = 'paypay_credit'
  where payment_method = 'paypay';

-- Helpful indexes for reporting
create index if not exists idx_tx_biz_date_method on public.transactions(biz_date, payment_method);
create index if not exists idx_tx_created_at on public.transactions(created_at);

-- Attendance table adjustments for manual edits
alter table public.attendances
  alter column user_id drop not null,
  add column if not exists user_email text,
  add column if not exists companion_checked boolean default false;

create index if not exists idx_att_biz_date on public.attendances((start_time::date));

-- Owner role should have full access to transactions
drop policy if exists "tx_owner_select_all" on public.transactions;
create policy "tx_owner_select_all" on public.transactions
for select to authenticated
using (
  exists (select 1 from public.user_roles ur
          where ur.email = auth.email() and ur.role = 'owner')
);

drop policy if exists "tx_self_select" on public.transactions;
create policy "tx_self_select" on public.transactions
for select to authenticated
using (created_by = auth.email());

-- Optional: extend insert/update/delete policies as needed for owners
