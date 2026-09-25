"use client"
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { format, startOfDay } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { useRouter } from 'next/navigation'

export default function MasterDashboard() {
  const router = useRouter()
  const [allSchedules, setAllSchedules] = useState<any[]>([])

  useEffect(() => {
    fetchMaster()
    const channel = supabase.channel('master_sync').on('postgres_changes', { event: '*', schema: 'public', table: 'schedules' }, () => {
      fetchMaster()
    }).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const fetchMaster = async () => {
    const { data } = await supabase
      .from('schedules')
      .select(`*, profiles(name, avatar_url, accent_color)`)
      .order('start_time', { ascending: true })
    
    if (data) {
      // Hanya tampilkan jadwal dari hari ini dan seterusnya
      const upcoming = data.filter(s => new Date(s.start_time) >= startOfDay(new Date()))
      setAllSchedules(upcoming)
    }
  }

  // Logika untuk mengelompokkan jadwal berdasarkan Tanggal
  const groupedSchedules = allSchedules.reduce((acc, sched) => {
    const dateStr = format(new Date(sched.start_time), 'yyyy-MM-dd')
    if (!acc[dateStr]) acc[dateStr] = []
    acc[dateStr].push(sched)
    return acc
  }, {} as Record<string, any[]>)

  return (
    <div className="min-h-screen bg-[#0f1115] text-gray-300 p-8 font-sans pb-20">
      <button onClick={() => router.back()} className="mb-6 bg-black/50 hover:bg-black text-white px-4 py-2 rounded-lg text-sm font-bold border border-gray-800 transition">
        &larr; Kembali
      </button>
      
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-2 text-white text-center tracking-widest uppercase">
          <span className="text-yellow-500 mr-2">•</span> JADWAL GABUNGAN
        </h1>
        <p className="text-center text-gray-500 mb-12">Tabel jadwal dari seluruh akun yang terdaftar</p>

        {Object.keys(groupedSchedules).length === 0 ? (
          <div className="text-center py-12 border border-gray-800 border-dashed rounded-lg">
            <p className="text-gray-500">Tidak ada jadwal mendatang.</p>
          </div>
        ) : (
          Object.keys(groupedSchedules).map(dateStr => {
            const schedulesForDate = groupedSchedules[dateStr]
            const displayDate = format(new Date(dateStr), 'EEEE, dd MMMM yyyy', { locale: localeId })
            
            return (
              <div key={dateStr} className="mb-10">
                {/* Header Tanggal */}
                <h2 className="text-xl font-bold text-yellow-500 mb-4 border-b border-gray-800 pb-2">
                  {displayDate}
                </h2>
                
                {/* Tabel Responsif */}
                <div className="overflow-x-auto bg-[#1a1d24] rounded-lg shadow-xl border border-gray-800">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#0f1115] text-gray-400 text-xs uppercase tracking-wider">
                        <th className="p-4 border-b border-gray-800 w-40">Waktu</th>
                        <th className="p-4 border-b border-gray-800">Nama Kegiatan</th>
                        <th className="p-4 border-b border-gray-800">Pemilik (Akun)</th>
                        <th className="p-4 border-b border-gray-800">Kategori</th>
                        <th className="p-4 border-b border-gray-800">Lokasi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {schedulesForDate.map((sched: any) => (
                        <tr key={sched.id} className="hover:bg-gray-900 transition">
                          <td className="p-4 whitespace-nowrap">
                            <span className="font-mono text-sm text-white">{format(new Date(sched.start_time), 'HH:mm')}</span>
                            <span className="text-xs text-gray-500 ml-1">- {format(new Date(sched.end_time), 'HH:mm')}</span>
                          </td>
                          <td className="p-4 font-bold text-white">{sched.activity_name}</td>
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              {/* Foto Profil Mini */}
                              <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0" style={{ border: `2px solid ${sched.profiles?.accent_color || '#eab308'}` }}>
                                {sched.profiles?.avatar_url ? (
                                  <img src={sched.profiles.avatar_url} className="w-full h-full object-cover" alt="pp" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-xs font-bold text-black" style={{ backgroundColor: sched.profiles?.accent_color || '#eab308' }}>
                                    {sched.profiles?.name?.charAt(0).toUpperCase()}
                                  </div>
                                )}
                              </div>
                              {/* Nama Profil */}
                              <span className="text-sm font-medium">{sched.profiles?.name}</span>
                            </div>
                          </td>
                          <td className="p-4 text-sm text-gray-400">
                            <span className="border border-gray-700 px-2 py-1 rounded text-xs">{sched.kategori}</span>
                          </td>
                          <td className="p-4 text-sm text-gray-400">{sched.lokasi || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}