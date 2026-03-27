
-- Add columns for INCIDENCIA, OT, CS to records
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS incidencia text;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS ot text;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS cs text;

-- Add unique constraint on ip for ip_base (for upsert)
ALTER TABLE public.ip_base ADD CONSTRAINT ip_base_ip_unique UNIQUE (ip);

-- Delete all test records
DELETE FROM public.records;
