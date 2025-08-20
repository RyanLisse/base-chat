export interface Chats {
  id: string
  title: string
  created_at: string | null
  updated_at: string | null
  model: string
  system_prompt: string | null
  user_id: string
  public: boolean
  project_id: string | null
}