import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

console.log("Cek URL Supabase:", supabaseUrl)
console.log("Cek Key Supabase:", supabaseAnonKey ? "Key Terbaca!" : "KOSONG/UNDEFINED")