"use client"
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function Home() {
  const [profiles, setProfiles] = useState<any[]>([])
  const [newProfileName, setNewProfileName] = useState('')
  const [onlineUsers, setOnlineUsers] = useState<string[]>([])
  const router = useRouter()

  useEffect(() => {
    fetchProfiles()

    // --- LOGIKA PRESENCE (CEK SIAPA YANG ONLINE) ---
    // Kita buat channel khusus bernama 'online-users'
    const room = supabase.channel('online-users')

    room
      .on('presence', { event: 'sync' }, () => {
        // Ambil semua state presence saat ini
        const newState = room.presenceState()
        
        // Ekstrak ID profil dari orang-orang yang sedang terhubung
        const currentlyOnline: string[] = []
        for (const id in newState) {
          // Setiap orang bisa punya beberapa tab/koneksi, kita ambil profil_id pertama yang mereka kirim
          const presenceArray = newState[id] as any[]
          if (presenceArray.length > 0 && presenceArray[0].profile_id) {
            currentlyOnline.push(presenceArray[0].profile_id)
          }
        }
        
        // Simpan daftar ID yang online ke state
        setOnlineUsers(currentlyOnline)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Karena di Home kita belum tau user pakai profil yang mana,
          // kita hanya "mendengarkan" (track status kosong) agar bisa melihat siapa yang online.
          // Nanti di halaman profil masing-masing, barulah mereka mengirimkan 'profile_id' mereka.
          await room.track({ isHome: true })
        }
      })

    return () => {
      supabase.removeChannel(room)
    }
  }, [])

  const fetchProfiles = async () => {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: true })
    if (data) setProfiles(data)
  }

  const createProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newProfileName.trim()) return
    const { data } = await supabase.from('profiles').insert([{ name: newProfileName }]).select().single()
    if (data) router.push(`/profile/${data.id}`)
  }

  return (
    <div className="min-h-screen bg-[#0f1115] text-white flex flex-col items-center justify-center p-6 font-sans">
      <h1 className="text-3xl font-bold mb-12 tracking-widest flex items-center gap-4">
        <span className="text-yellow-500">•</span> PILIH PROFIL
      </h1>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl w-full">
        {profiles.map(p => {
          // Cek apakah ID profil ini ada di daftar onlineUsers
          const isOnline = onlineUsers.includes(p.id)

          return (
            <Link key={p.id} href={`/profile/${p.id}`} className="bg-[#1a1d24] border border-gray-800 p-6 rounded-2xl hover:border-yellow-500 hover:scale-105 transition-all flex flex-col items-center gap-4 group">
              <div className="w-20 h-20 rounded-full border-2 border-gray-600 overflow-hidden relative shadow-lg">
                
                {/* --- INDIKATOR ONLINE (TITIK HIJAU) --- */}
                {isOnline && (
                  <div className="absolute top-1 right-1 w-4 h-4 bg-green-500 border-2 border-[#1a1d24] rounded-full z-10 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.8)]"></div>
                )}
                
                {p.avatar_url ? (
                  <img src={p.avatar_url} className="w-full h-full object-cover group-hover:scale-110 transition duration-500" alt={p.name} />
                ) : (
                  <div className="w-full h-full bg-gray-800 flex items-center justify-center text-3xl font-bold text-gray-500">
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <p className="font-bold font-mono tracking-wider">{p.name}</p>
            </Link>
          )
        })}
      </div>

      <form onSubmit={createProfile} className="mt-16 flex gap-4 w-full max-w-md bg-[#1a1d24] p-2 rounded-xl border border-gray-800 focus-within:border-yellow-500 transition">
        <input type="text" value={newProfileName} onChange={e => setNewProfileName(e.target.value)} placeholder="Nama Profil Baru..." className="flex-1 bg-transparent px-4 py-2 outline-none text-sm" />
        <button type="submit" className="bg-yellow-500 text-black px-6 py-2 rounded-lg font-bold text-sm hover:bg-yellow-400 transition">BUAT</button>
      </form>

      <Link href="/master" className="mt-8 text-xs font-mono opacity-50 hover:opacity-100 hover:text-yellow-500 tracking-widest transition">
        LIHAT MASTER DASHBOARD
      </Link>
    </div>
  )
}