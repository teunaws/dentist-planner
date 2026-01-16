
import { createBrowserClient } from '@supabase/ssr'


const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// Factory function for Next.js Client Components
export const createClient = () =>
  createBrowserClient<any>(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: { 'x-application-name': 'dentist-planner' },
    }
  })

// Singleton for backward compatibility with existing services
// Note: In strict Next.js apps, you should prefer using createClient() in components/hooks
// or context to avoid stale instances. However, for migration speed, we keep a singleton
// that lazily initializes on the client.
let supabaseInstance: ReturnType<typeof createClient> | undefined

export const supabase = new Proxy({} as ReturnType<typeof createClient>, {
  get: (_target, prop: keyof ReturnType<typeof createClient>) => {
    if (typeof window === 'undefined') {
      // Preventing server-side crash if services try to access it directly
      // This might throw if a service tries to use it during SSR, which is good (fail fast)
      // or we could return a dummy. For now, strict check.
      return (createClient() as any)[prop];
    }
    if (!supabaseInstance) {
      supabaseInstance = createClient()

      // Debug Auth Session
      supabaseInstance.auth.getSession().then(({ data }) => {
        console.log("🔐 Supabase Session Token:", data.session?.access_token ? "Exists (Good)" : "Missing (Bad)");
      });
    }
    return supabaseInstance[prop]
  }
})


