"use client"
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function Home() {
  const [profiles, setProfiles] = useState<any[]>([])
  const [newProfileName, setNewProfileName] = useState('')
  const router = useRouter()

  useEffect(() => {
    fetchProfiles()
  }, [])

  const fetchProfiles = async () => {
    const { data } = await supabase.from('profiles').select('*')
    if (data) setProfiles(data)
  }

  const createProfile = async () => {
    if (!newProfileName) return
    const { data } = await supabase
      .from('profiles')
      .insert([{ name: newProfileName }])
      .select()
    
    if (data) router.push(`/profile/${data[0].id}`)
  }

  return (
    <div className="min-h-screen bg-[#0f1115] text-gray-300 flex flex-col items-center justify-center p-4 font-sans">
      <h1 className="text-4xl font-bold mb-10 text-white tracking-widest uppercase">
        <span className="text-yellow-500 mr-2">•</span> PILIH PROFIL
      </h1>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12 w-full max-w-3xl">
        {profiles.map(p => (
          <button 
            key={p.id} 
            onClick={() => router.push(`/profile/${p.id}`)}
            className="bg-[#1a1d24] border border-gray-800 hover:border-yellow-500 p-6 rounded-xl flex flex-col items-center transition group shadow-lg"
          >
            <div className="w-20 h-20 rounded-full bg-gray-700 mb-4 overflow-hidden border-2 border-transparent group-hover:border-yellow-500 transition">
              {p.avatar_url ? (
                <img src={p.avatar_url} alt="pp" className="object-cover w-full h-full" />
              ) : (
                <div className="w-full h-full bg-yellow-600 flex items-center justify-center text-black text-2xl font-bold">
                  {p.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <span className="font-bold text-white group-hover:text-yellow-500 transition">{p.name}</span>
          </button>
        ))}
      </div>

      <div className="bg-[#1a1d24] p-4 rounded-xl flex gap-3 border border-gray-800 shadow-lg w-full max-w-md">
        <input 
          type="text" 
          placeholder="Nama Profil Baru..." 
          className="flex-1 px-4 py-2 bg-[#0f1115] border border-gray-700 focus:border-yellow-500 rounded text-white outline-none text-sm"
          value={newProfileName}
          onChange={(e) => setNewProfileName(e.target.value)}
        />
        <button onClick={createProfile} className="bg-yellow-500 text-black px-6 py-2 rounded font-bold hover:bg-yellow-400 text-sm transition">
          BUAT
        </button>
      </div>

      <button onClick={() => router.push('/master')} className="mt-12 text-gray-500 hover:text-yellow-500 text-sm uppercase tracking-widest transition">
        Lihat Master Dashboard
      </button>
    </div>
  )
}