-- Migration 007: Fix partner_notifications FK constraints
-- Add ON DELETE CASCADE to plan_id and partner_plan_id so deleting a plan
-- automatically cleans up related notifications (fixes "Failed to delete plan" errors)

-- Also add DELETE RLS policy (was missing — only SELECT, INSERT, UPDATE existed)

-- Drop existing FK constraints and re-add with CASCADE
ALTER TABLE partner_notifications
  DROP CONSTRAINT IF EXISTS partner_notifications_plan_id_fkey,
  ADD CONSTRAINT partner_notifications_plan_id_fkey
    FOREIGN KEY (plan_id) REFERENCES training_plans(id) ON DELETE CASCADE;

ALTER TABLE partner_notifications
  DROP CONSTRAINT IF EXISTS partner_notifications_partner_plan_id_fkey,
  ADD CONSTRAINT partner_notifications_partner_plan_id_fkey
    FOREIGN KEY (partner_plan_id) REFERENCES training_plans(id) ON DELETE CASCADE;

-- Add DELETE policy so users can clean up their own notifications
-- Only create if not already present
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'partner_notifications'
      AND policyname = 'Users can delete own notifications'
  ) THEN
    CREATE POLICY "Users can delete own notifications" ON partner_notifications
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;
