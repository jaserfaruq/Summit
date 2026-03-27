-- Migration 006: Training Partners
-- Adds partnerships and partner_notifications tables for the training partners feature

-- partnerships: the connection between two users
CREATE TABLE partnerships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES profiles(id),
  recipient_id UUID NOT NULL REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'pending',          -- pending | accepted | declined
  requester_shares_scores BOOLEAN DEFAULT FALSE,   -- requester opts in to show scores
  recipient_shares_scores BOOLEAN DEFAULT FALSE,   -- recipient opts in to show scores
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- prevent duplicate partnerships
  CONSTRAINT unique_partnership UNIQUE (requester_id, recipient_id),
  -- prevent self-partnerships
  CONSTRAINT no_self_partner CHECK (requester_id != recipient_id)
);

-- Indexes for common queries
CREATE INDEX idx_partnerships_requester ON partnerships(requester_id, status);
CREATE INDEX idx_partnerships_recipient ON partnerships(recipient_id, status);

-- RLS: users can only see partnerships they are part of
ALTER TABLE partnerships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own partnerships" ON partnerships
  FOR SELECT USING (
    auth.uid() = requester_id OR auth.uid() = recipient_id
  );

CREATE POLICY "Users can create partnership requests" ON partnerships
  FOR INSERT WITH CHECK (
    auth.uid() = requester_id AND status = 'pending'
  );

CREATE POLICY "Users can update partnerships they're part of" ON partnerships
  FOR UPDATE USING (
    auth.uid() = requester_id OR auth.uid() = recipient_id
  );

CREATE POLICY "Users can delete partnerships they're part of" ON partnerships
  FOR DELETE USING (
    auth.uid() = requester_id OR auth.uid() = recipient_id
  );


-- partner_notifications: match alerts when weeks overlap
CREATE TABLE partner_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),          -- who receives the notification
  partner_id UUID NOT NULL REFERENCES profiles(id),        -- the matched partner
  partner_name TEXT NOT NULL,                               -- denormalized for display
  partnership_id UUID NOT NULL REFERENCES partnerships(id), -- link to the partnership
  week_number INT NOT NULL,                                 -- which week the match is for
  plan_id UUID NOT NULL REFERENCES training_plans(id),     -- user's plan
  partner_plan_id UUID NOT NULL REFERENCES training_plans(id), -- partner's plan
  match_type TEXT NOT NULL,                                 -- environment | dimension | both
  match_summary TEXT NOT NULL,                              -- "Alex also has climbing this week"
  matched_sessions JSONB NOT NULL,                          -- array of matched session details
  is_read BOOLEAN DEFAULT FALSE,
  is_dismissed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),

  -- one notification per partner per user per week
  CONSTRAINT unique_notification UNIQUE (user_id, partner_id, plan_id, week_number)
);

CREATE INDEX idx_partner_notifications_user ON partner_notifications(user_id, is_read);
CREATE INDEX idx_partner_notifications_week ON partner_notifications(user_id, plan_id, week_number);

-- RLS: users can only see their own notifications
ALTER TABLE partner_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own notifications" ON partner_notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications" ON partner_notifications
  FOR INSERT WITH CHECK (TRUE);  -- inserted by API, not directly by users

CREATE POLICY "Users can update own notifications" ON partner_notifications
  FOR UPDATE USING (auth.uid() = user_id);
