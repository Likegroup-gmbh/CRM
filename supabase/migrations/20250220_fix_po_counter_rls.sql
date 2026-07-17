-- Fix: po_counter ohne RLS
-- Tabelle wird nur über RPC increment_po_counter (SECURITY DEFINER) verwendet.
-- RLS aktivieren, keine permissiven Policies = direkter Zugriff blockiert, RPC funktioniert weiter.

ALTER TABLE public.po_counter ENABLE ROW LEVEL SECURITY;
