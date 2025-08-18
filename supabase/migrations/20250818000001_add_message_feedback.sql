-- Create message feedback table
CREATE TABLE IF NOT EXISTS message_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feedback VARCHAR(20) NOT NULL CHECK (feedback IN ('upvote', 'downvote')),
  comment TEXT,
  langsmith_run_id VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_message_feedback_message_id ON message_feedback(message_id);
CREATE INDEX IF NOT EXISTS idx_message_feedback_user_id ON message_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_message_feedback_langsmith_run_id ON message_feedback(langsmith_run_id);

-- Create unique constraint to prevent duplicate feedback per user per message
CREATE UNIQUE INDEX IF NOT EXISTS idx_message_feedback_unique_user_message 
ON message_feedback(message_id, user_id);

-- Add reasoning effort column to messages table if it exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'messages') THEN
        ALTER TABLE messages ADD COLUMN IF NOT EXISTS reasoning_effort VARCHAR(10) DEFAULT 'medium' CHECK (reasoning_effort IN ('low', 'medium', 'high'));
        ALTER TABLE messages ADD COLUMN IF NOT EXISTS enable_file_search BOOLEAN DEFAULT false;
        ALTER TABLE messages ADD COLUMN IF NOT EXISTS langsmith_run_id VARCHAR(255);
        
        -- Add indexes for new columns
        CREATE INDEX IF NOT EXISTS idx_messages_reasoning_effort ON messages(reasoning_effort);
        CREATE INDEX IF NOT EXISTS idx_messages_enable_file_search ON messages(enable_file_search);
        CREATE INDEX IF NOT EXISTS idx_messages_langsmith_run_id ON messages(langsmith_run_id);
    END IF;
END $$;

-- Update updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at on message_feedback
DROP TRIGGER IF EXISTS update_message_feedback_updated_at ON message_feedback;
CREATE TRIGGER update_message_feedback_updated_at
    BEFORE UPDATE ON message_feedback
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();