import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export function getOrCreateSessionId(): string {
  const SESSION_KEY = 'expense_tracker_session_id'
  let sessionId = localStorage.getItem(SESSION_KEY)

  if (!sessionId) {
    sessionId = crypto.randomUUID()
    localStorage.setItem(SESSION_KEY, sessionId)
  }

  return sessionId
}

const sessionId = getOrCreateSessionId()

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: {
      'x-session-id': sessionId
    }
  }
})

export { sessionId }
