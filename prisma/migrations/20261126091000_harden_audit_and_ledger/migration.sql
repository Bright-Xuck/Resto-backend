-- Audit rows must never be changed or deleted (NFR-11).
CREATE OR REPLACE FUNCTION identity.reject_row_change()
RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'This table is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_append_only
    BEFORE UPDATE OR DELETE ON identity.audit_logs
    FOR EACH ROW EXECUTE FUNCTION identity.reject_row_change();

-- Wallet ledger rows are append-only so balances can always be rebuilt.
CREATE TRIGGER wallet_ledger_entries_append_only
    BEFORE UPDATE OR DELETE ON payments.wallet_ledger_entries
    FOR EACH ROW EXECUTE FUNCTION identity.reject_row_change();

-- Money must never be stored as a negative amount.
ALTER TABLE ordering.orders
    ADD CONSTRAINT orders_total_non_negative CHECK (total_fcfa >= 0);

ALTER TABLE catalog.menu_items
    ADD CONSTRAINT menu_items_price_non_negative CHECK (price_fcfa >= 0);

ALTER TABLE payments.payments
    ADD CONSTRAINT payments_amount_non_negative CHECK (amount_fcfa >= 0);

ALTER TABLE payments.refunds
    ADD CONSTRAINT refunds_amount_positive CHECK (amount_fcfa > 0);

-- A wallet cannot go below zero; the service checks this too.
ALTER TABLE payments.wallets
    ADD CONSTRAINT wallets_balance_non_negative CHECK (balance_fcfa >= 0);
