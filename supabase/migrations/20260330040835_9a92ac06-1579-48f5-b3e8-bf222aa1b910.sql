-- Add deduplication key for synced history records
ALTER TABLE public.records
ADD COLUMN IF NOT EXISTS sync_key text;

CREATE UNIQUE INDEX IF NOT EXISTS records_sync_key_unique_idx
ON public.records (sync_key)
WHERE sync_key IS NOT NULL;

-- Broadcast commands for active/future sessions (sync, clear histories)
CREATE TABLE IF NOT EXISTS public.admin_sync_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  command_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true
);

ALTER TABLE public.admin_sync_commands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read sync commands"
ON public.admin_sync_commands
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can create sync commands"
ON public.admin_sync_commands
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete sync commands"
ON public.admin_sync_commands
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS admin_sync_commands_created_at_idx
ON public.admin_sync_commands (created_at DESC);

CREATE INDEX IF NOT EXISTS admin_sync_commands_active_idx
ON public.admin_sync_commands (is_active, created_at DESC);