"use client"
import { useEffect, useState, useRef, use } from 'react'
import { supabase } from '@/lib/supabase'
import Cropper from 'react-easy-crop'
import { formatDistanceToNow, format, startOfMonth, endOfMonth, eachWeekOfInterval, startOfWeek, endOfWeek, addMonths, subMonths, isSameDay, eachDayOfInterval, differenceInMinutes, startOfDay } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { useRouter } from 'next/navigation'

// --- Utility Cropper ---
const createImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', (error) => reject(error))
    image.setAttribute('crossOrigin', 'anonymous')
    image.src = url
  })

async function getCroppedImg(imageSrc: string, pixelCrop: any) {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  canvas.width = pixelCrop.width
  canvas.height = pixelCrop.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height)
  return new Promise<Blob>((resolve) => canvas.toBlob((blob) => resolve(blob!), 'image/jpeg'))
}

export default function ProfileDashboard({ params }: { params: Promise<{ id: string }> }) {
  const profileId = use(params).id
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [schedules, setSchedules] = useState<any[]>([])
  
  // Waktu & Navigasi
  const [currentTime, setCurrentTime] = useState(new Date())
  const [viewMonth, setViewMonth] = useState(startOfMonth(new Date()))
  const [activeDate, setActiveDate] = useState(new Date())
  
  // Modals
  const [isSchedModalOpen, setIsSchedModalOpen] = useState(false)
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)
  
  // Forms
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ activity_name: '', start_time: '', end_time: '', kategori: 'Kuliah', lokasi: '' })
  const [profileForm, setProfileForm] = useState({ name: '' })
  const [settingsForm, setSettingsForm] = useState({ 
    notif_minutes: 10, 
    bg_color: '#0f1115', 
    card_color: '#1a1d24', 
    text_color: '#d1d5db', 
    accent_color: '#eab308' 
  })
  
  // Cropper State
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
  const [cropType, setCropType] = useState<'avatar' | 'banner'>('avatar')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchData()
    const timer = setInterval(() => {
      const now = new Date()
      setCurrentTime(now)
      checkNotifications(now)
    }, 10000)

    const channel = supabase.channel('realtime_schedules').on('postgres_changes', { event: '*', schema: 'public', table: 'schedules' }, () => fetchData()).subscribe()
    const profChannel = supabase.channel('realtime_profiles').on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${profileId}` }, () => fetchData()).subscribe()

    return () => { clearInterval(timer); supabase.removeChannel(channel); supabase.removeChannel(profChannel) }
  }, [profileId])

  const fetchData = async () => {
    const { data: profData } = await supabase.from('profiles').select('*').eq('id', profileId).single()
    const { data: schedData } = await supabase.from('schedules').select('*').eq('profile_id', profileId).order('start_time', { ascending: true })
    setProfile(profData)
    if (schedData) setSchedules(schedData)
  }

  // --- LOGIKA NOTIFIKASI ---
  const checkNotifications = (now: Date) => {
    if(!profile) return
    schedules.forEach(sched => {
      const diff = differenceInMinutes(new Date(sched.start_time), now)
      if (diff === profile.notif_minutes) {
        const audio = new Audio(profile.notif_sound_url || 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg')
        audio.play().catch(e => console.log('Audio blocked'))
      }
    })
  }

  // --- CROPPER HANDLERS ---
  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar'|'banner') => {
    if (e.target.files && e.target.files.length > 0) {
      setCropType(type)
      const reader = new FileReader()
      reader.addEventListener('load', () => setImageSrc(reader.result?.toString() || ''))
      reader.readAsDataURL(e.target.files[0])
    }
  }

  const saveCroppedImage = async () => {
    if (!imageSrc || !croppedAreaPixels) return
    const croppedImageBlob = await getCroppedImg(imageSrc, croppedAreaPixels)
    if (!croppedImageBlob) return

    const fileName = `${profileId}-${Date.now()}.jpg`
    const bucket = cropType === 'avatar' ? 'avatars' : 'banners'
    
    await supabase.storage.from(bucket).upload(fileName, croppedImageBlob)
    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(fileName)
    
    await supabase.from('profiles').update({ [cropType === 'avatar' ? 'avatar_url' : 'banner_url']: publicUrl }).eq('id', profileId)
    setImageSrc(null)
    fetchData()
  }

  // --- FORM & ACTION HANDLERS ---
  const saveSchedule = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // FIX: Konversi ke UTC (ISO String) agar zona waktu tidak meleset
    const payload = {
      ...form,
      start_time: new Date(form.start_time).toISOString(),
      end_time: new Date(form.end_time).toISOString(),
    }

    if (editId) await supabase.from('schedules').update(payload).eq('id', editId)
    else await supabase.from('schedules').insert([{ ...payload, profile_id: profileId }])
    
    setIsSchedModalOpen(false)
    setEditId(null)
    setForm({ activity_name: '', start_time: '', end_time: '', kategori: 'Kuliah', lokasi: '' })
    fetchData()
  }

  const deleteSchedule = async (id: string) => {
    if(confirm('Hapus jadwal ini?')) {
      await supabase.from('schedules').delete().eq('id', id)
      fetchData()
    }
  }

  const saveProfileName = async (e: React.FormEvent) => {
    e.preventDefault()
    await supabase.from('profiles').update({ name: profileForm.name }).eq('id', profileId)
    setIsProfileModalOpen(false)
    fetchData()
  }

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    await supabase.from('profiles').update(settingsForm).eq('id', profileId)
    setIsSettingsModalOpen(false)
    fetchData()
  }
  
  const handleSoundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0]
      const fileName = `${profileId}-${Date.now()}.mp3`
      await supabase.storage.from('sounds').upload(fileName, file)
      const { data: { publicUrl } } = supabase.storage.from('sounds').getPublicUrl(fileName)
      await supabase.from('profiles').update({ notif_sound_url: publicUrl }).eq('id', profileId)
      fetchData()
    }
  }

  const deleteProfile = async () => {
    if(confirm('PERINGATAN: Yakin ingin menghapus profil ini BESERTA SEMUA JADWALNYA secara permanen?')) {
      await supabase.from('profiles').delete().eq('id', profileId)
      router.push('/')
    }
  }

  if (!profile) return <div className="min-h-screen bg-[#0f1115] text-white p-10 flex justify-center items-center">Memuat profil...</div>

  // --- VARIABEL TEMA KUSTOM ---
  const t_bg = profile.bg_color || '#0f1115'
  const t_card = profile.card_color || '#1a1d24'
  const t_text = profile.text_color || '#d1d5db'
  const t_accent = profile.accent_color || '#eab308'

  // Data Waktu
  const weeksInMonth = eachWeekOfInterval({ start: viewMonth, end: endOfMonth(viewMonth) }, { weekStartsOn: 1 })
  const activeWeekStart = startOfWeek(activeDate, { weekStartsOn: 1 })
  const daysInActiveWeek = eachDayOfInterval({ start: activeWeekStart, end: endOfWeek(activeWeekStart, { weekStartsOn: 1 }) })
  
  // FIX: Menggunakan getTime() agar multi-hari terdeteksi 100% presisi
  const dailySchedules = schedules.filter(s => {
    const startDay = startOfDay(new Date(s.start_time)).getTime()
    const endDay = startOfDay(new Date(s.end_time)).getTime()
    const active = startOfDay(activeDate).getTime()
    return active >= startDay && active <= endDay
  })
  
  const upcomingSchedules = schedules.filter(s => new Date(s.start_time) > currentTime)
  const nextSchedule = upcomingSchedules.length > 0 ? upcomingSchedules[0] : null

  return (
    <div style={{ backgroundColor: t_bg, color: t_text }} className="min-h-screen font-sans pb-20 relative transition-colors duration-300">
      
      {/* TOMBOL KEMBALI */}
      <button onClick={() => router.push('/')} className="absolute top-4 left-4 z-10 bg-black/50 hover:bg-black text-white px-4 py-2 rounded-lg text-sm font-bold border border-gray-600 backdrop-blur-sm transition">
        &larr; Kembali
      </button>

      {/* TOMBOL NAVIGASI ATAS */}
      <div className="absolute top-4 left-4 z-10 flex gap-2">
        <button onClick={() => router.push('/')} className="bg-black/50 hover:bg-black text-white px-4 py-2 rounded-lg text-sm font-bold border border-gray-600 backdrop-blur-sm transition">
          &larr; Beranda
        </button>
        <button onClick={() => router.push('/master')} className="bg-black/50 hover:bg-black text-yellow-500 px-4 py-2 rounded-lg text-sm font-bold border border-gray-600 backdrop-blur-sm transition shadow-lg">
          📅 Jadwal Gabungan
        </button>
      </div>

      {/* HEADER & PROFIL */}
      <div className="relative h-48 group bg-black/30 border-b border-black/20">
        {profile.banner_url ? (
          <img src={profile.banner_url} className="w-full h-full object-cover opacity-70" alt="banner"/>
        ) : (
          <div className="w-full h-full" style={{ backgroundColor: t_card }} />
        )}
        <button onClick={() => { setCropType('banner'); fileInputRef.current?.click() }} className="absolute top-4 right-4 bg-black/50 hover:bg-black text-white px-3 py-1 rounded text-xs opacity-0 group-hover:opacity-100 transition">Ubah Banner</button>
      </div>

      <div className="max-w-5xl mx-auto px-6 relative">
        <div style={{ borderColor: t_bg }} className="absolute -top-16 left-6 w-32 h-32 rounded-full border-4 overflow-hidden shadow-xl group">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} className="w-full h-full object-cover" alt="pp" />
          ) : (
            <div style={{ backgroundColor: t_accent, color: t_bg }} className="w-full h-full flex items-center justify-center text-5xl font-bold">
              {profile.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div onClick={() => { setCropType('avatar'); fileInputRef.current?.click() }} className="absolute inset-0 bg-black/50 hidden group-hover:flex items-center justify-center cursor-pointer text-xs font-bold text-white transition">GANTI PP</div>
        </div>
        
        <input type="file" hidden accept="image/*" ref={fileInputRef} onChange={(e) => onFileChange(e, cropType)} />

        <div className="pt-20 pb-8 flex justify-between items-end border-b border-black/10">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{profile.name}</h1>
              <button onClick={() => { setProfileForm({name: profile.name}); setIsProfileModalOpen(true) }} className="text-xs px-2 py-1 rounded border border-current opacity-60 hover:opacity-100 transition">Edit Nama</button>
            </div>
            <p style={{ color: t_accent }} className="text-sm mt-1">ID: {profile.id.split('-')[0]}</p>
          </div>
          <div className="text-right flex flex-col items-end">
             <button onClick={() => { setSettingsForm({notif_minutes: profile.notif_minutes, bg_color: t_bg, card_color: t_card, text_color: t_text, accent_color: t_accent}); setIsSettingsModalOpen(true) }} className="mb-2 text-xs border border-current opacity-60 px-3 py-1 rounded hover:opacity-100 transition">⚙️ Pengaturan</button>
             <h2 style={{ color: t_accent }} className="text-4xl font-mono font-bold">{format(currentTime, 'HH:mm:ss')}</h2>
          </div>
        </div>

        {/* HIGHLIGHT BERIKUTNYA */}
        {nextSchedule && (
          <div style={{ backgroundColor: t_card, borderLeftColor: t_accent }} className="mt-8 border-l-4 p-6 rounded-lg shadow-lg">
            <p style={{ color: t_accent }} className="text-xs font-bold tracking-widest uppercase mb-2">• Berikutnya</p>
            <h2 className="text-3xl font-bold mb-2">{nextSchedule.activity_name}</h2>
            <div className="flex gap-4 text-sm opacity-70 mb-6">
              <span>📍 {nextSchedule.lokasi || '-'}</span>
              <span>{nextSchedule.kategori}</span>
              <span>{format(new Date(nextSchedule.start_time), 'EEEE, HH:mm', { locale: localeId })}</span>
            </div>
            <p style={{ color: t_accent }} className="text-5xl font-mono font-bold mb-1">{formatDistanceToNow(new Date(nextSchedule.start_time), { locale: localeId })}</p>
          </div>
        )}

        {/* NAVIGASI BULAN MINGGU */}
        <div style={{ backgroundColor: t_card }} className="mt-10 p-4 rounded-lg shadow-sm">
          <div className="flex justify-between items-center mb-4">
             <button onClick={() => setViewMonth(subMonths(viewMonth, 1))} className="text-xs px-3 py-1 bg-black/20 rounded hover:bg-black/40">Bulan Prev</button>
             <h3 className="text-xl font-bold uppercase">{format(viewMonth, 'MMMM yyyy', { locale: localeId })}</h3>
             <button onClick={() => setViewMonth(addMonths(viewMonth, 1))} className="text-xs px-3 py-1 bg-black/20 rounded hover:bg-black/40">Bulan Next</button>
          </div>
          
          <div className="flex flex-wrap gap-2 mb-6">
             {weeksInMonth.map((ws, idx) => {
               const isActive = isSameDay(activeWeekStart, ws)
               return (
                 <button key={idx} onClick={() => setActiveDate(ws)} 
                   style={isActive ? { backgroundColor: t_accent, color: t_bg, borderColor: t_accent } : { borderColor: 'currentColor' }} 
                   className={`text-xs px-3 py-2 rounded border border-opacity-20 ${isActive ? 'font-bold' : 'opacity-60 hover:opacity-100'}`}>
                   Minggu {idx + 1}
                 </button>
               )
             })}
          </div>

          <div className="w-full h-px bg-current opacity-10 mb-4" />

          <div className="flex justify-between items-center mb-2">
            <button onClick={() => setIsSchedModalOpen(true)} style={{ backgroundColor: t_accent, color: t_bg }} className="px-4 py-2 rounded text-sm font-bold transition opacity-90 hover:opacity-100">+ Tambah</button>
            <div className="flex gap-4 overflow-x-auto">
                {daysInActiveWeek.map((day, idx) => {
                    const isActive = isSameDay(day, activeDate)
                    
                    // FIX: Logika hitungan badge kegiatan multi-hari
                    const count = schedules.filter(s => {
                        const startDay = startOfDay(new Date(s.start_time)).getTime()
                        const endDay = startOfDay(new Date(s.end_time)).getTime()
                        const currentTabDay = startOfDay(day).getTime()
                        return currentTabDay >= startDay && currentTabDay <= endDay
                    }).length;

                    return (
                      <button key={idx} onClick={() => setActiveDate(day)} 
                        style={isActive ? { color: t_accent, borderBottomColor: t_accent } : { borderColor: 'transparent' }} 
                        className={`flex flex-col items-center pb-2 px-2 border-b-2 transition ${!isActive ? 'opacity-50 hover:opacity-100' : ''}`}>
                        <span className="font-bold">{format(day, 'EEEE', { locale: localeId })}</span>
                        <span className="text-xs">{format(day, 'dd MMM')}</span>
                        <span className="text-[10px] mt-1 opacity-70">{count} kegiatan</span>
                      </button>
                    )
                })}
            </div>
          </div>
        </div>

        {/* DAFTAR JADWAL HARIAN */}
        <div className="mt-8 space-y-4">
          {dailySchedules.map(sched => (
            <div key={sched.id} className="flex gap-6 group">
              <div className="w-16 text-right pt-4">
                <p className="font-mono text-sm">{format(new Date(sched.start_time), 'HH:mm')}</p>
                <p className="font-mono text-xs opacity-50">{format(new Date(sched.end_time), 'HH:mm')}</p>
              </div>
              <div className="relative border-l-2 pl-6 pb-6 w-full" style={{ borderColor: 'currentColor' }}>
                <div style={{ borderColor: t_accent, backgroundColor: t_bg }} className="absolute w-3 h-3 border-2 rounded-full -left-[7px] top-5"></div>
                <div style={{ backgroundColor: t_card }} className="p-4 rounded shadow-sm flex justify-between transition">
                  <div>
                    <h3 className="text-lg font-bold">{sched.activity_name}</h3>
                    <div className="flex gap-3 text-xs opacity-70 mt-2 items-center">
                      <span>📍 {sched.lokasi || '-'}</span>
                      <span className="border px-2 py-0.5 rounded border-current">{sched.kategori}</span>
                    </div>
                  </div>
                  <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition items-start">
                     <button onClick={() => {
                       setEditId(sched.id); 
                       // FIX: Format lokal (yyyy-MM-ddThh:mm) agar form terisi dengan jam yang benar
                       setForm({ 
                         activity_name: sched.activity_name, 
                         start_time: format(new Date(sched.start_time), "yyyy-MM-dd'T'HH:mm"), 
                         end_time: format(new Date(sched.end_time), "yyyy-MM-dd'T'HH:mm"), 
                         kategori: sched.kategori, 
                         lokasi: sched.lokasi 
                       }); 
                       setIsSchedModalOpen(true)
                     }} className="text-blue-400 text-sm hover:underline">Edit</button>
                     <button onClick={() => deleteSchedule(sched.id)} className="text-red-400 text-sm hover:underline">Hapus</button>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {dailySchedules.length === 0 && (
             <div className="text-center py-12 border border-dashed rounded-lg opacity-40">Tidak ada kegiatan.</div>
          )}
        </div>
      </div>

      {/* --- CROPPER MODAL --- */}
      {imageSrc && (
        <div className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-[100] p-4">
          <div className="relative w-full max-w-lg h-96 bg-black mb-4 rounded overflow-hidden">
            <Cropper image={imageSrc} crop={crop} zoom={zoom} aspect={cropType === 'avatar' ? 1 : 16/5} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={(_, croppedPixels) => setCroppedAreaPixels(croppedPixels as any)} />
          </div>
          <div className="flex gap-4">
            <button onClick={() => setImageSrc(null)} className="px-6 py-2 bg-gray-700 text-white rounded font-bold hover:bg-gray-600">Batal</button>
            <button onClick={saveCroppedImage} style={{ backgroundColor: t_accent, color: t_bg }} className="px-6 py-2 rounded font-bold">Potong & Simpan</button>
          </div>
        </div>
      )}

      {/* --- MODAL TAMBAH/EDIT JADWAL --- */}
      {isSchedModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div style={{ backgroundColor: t_card, borderTopColor: t_accent }} className="w-full max-w-md rounded-lg overflow-hidden border-t-4 shadow-2xl">
            <div className="p-6">
              <h2 className="font-bold tracking-widest mb-6 uppercase text-sm">
                 <span style={{ color: t_accent }} className="mr-2">•</span> {editId ? 'EDIT KEGIATAN' : 'TAMBAH KEGIATAN'}
              </h2>
              <form onSubmit={saveSchedule} className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="text-xs opacity-70 mb-1 block">Mulai</label>
                    <input type="datetime-local" required style={{ backgroundColor: t_bg, color: t_text }} className="w-full rounded p-2 outline-none text-sm border border-transparent focus:border-current" value={form.start_time} onChange={e => setForm({...form, start_time: e.target.value})} />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs opacity-70 mb-1 block">Selesai</label>
                    <input type="datetime-local" required style={{ backgroundColor: t_bg, color: t_text }} className="w-full rounded p-2 outline-none text-sm border border-transparent focus:border-current" value={form.end_time} onChange={e => setForm({...form, end_time: e.target.value})} />
                  </div>
                </div>
                <div>
                  <label className="text-xs opacity-70 mb-1 block">Kategori</label>
                  <select style={{ backgroundColor: t_bg, color: t_text }} className="w-full rounded p-2 outline-none text-sm border border-transparent focus:border-current" value={form.kategori} onChange={e => setForm({...form, kategori: e.target.value})}>
                    <option>Kuliah</option><option>Kegiatan</option><option>Ekskul/Ngajar</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs opacity-70 mb-1 block">Nama kegiatan</label>
                  <input type="text" required style={{ backgroundColor: t_bg, color: t_text }} className="w-full rounded p-2 outline-none text-sm border border-transparent focus:border-current" value={form.activity_name} onChange={e => setForm({...form, activity_name: e.target.value})} />
                </div>
                <div>
                  <label className="text-xs opacity-70 mb-1 block">Lokasi</label>
                  <input type="text" style={{ backgroundColor: t_bg, color: t_text }} className="w-full rounded p-2 outline-none text-sm border border-transparent focus:border-current" value={form.lokasi} onChange={e => setForm({...form, lokasi: e.target.value})} />
                </div>
                <div className="flex justify-end gap-3 pt-4 mt-6">
                  <button type="button" onClick={() => {setIsSchedModalOpen(false); setEditId(null)}} className="px-4 py-2 rounded text-sm opacity-70 hover:bg-black/20">Batal</button>
                  <button type="submit" style={{ backgroundColor: t_accent, color: t_bg }} className="px-6 py-2 rounded text-sm font-bold">Simpan</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL EDIT NAMA --- */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div style={{ backgroundColor: t_card, borderTopColor: t_accent }} className="w-full max-w-sm rounded-lg p-6 border-t-4 shadow-xl">
            <h2 className="font-bold mb-4 uppercase text-sm">Ubah Nama Profil</h2>
            <form onSubmit={saveProfileName} className="space-y-4">
              <input type="text" required style={{ backgroundColor: t_bg, color: t_text }} className="w-full rounded p-2 outline-none border border-transparent focus:border-current" value={profileForm.name} onChange={e => setProfileForm({name: e.target.value})} />
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setIsProfileModalOpen(false)} className="px-4 py-2 text-sm opacity-70">Batal</button>
                <button type="submit" style={{ backgroundColor: t_accent, color: t_bg }} className="px-4 py-2 text-sm font-bold rounded">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- SETTINGS MODAL & THEME BUILDER --- */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div style={{ backgroundColor: t_card, color: settingsForm.text_color }} className="w-full max-w-md rounded-lg p-6 border-t-4 border-gray-500 max-h-[90vh] overflow-y-auto">
            <h2 className="font-bold mb-4 uppercase">Pengaturan Tampilan & Suara</h2>
            
            {/* Preview Tema */}
            <div className="mb-6 p-4 rounded-lg shadow-inner" style={{ backgroundColor: settingsForm.bg_color, color: settingsForm.text_color }}>
              <p className="text-xs mb-2 opacity-70">Preview Tema:</p>
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold">Contoh Teks</span>
                <span style={{ color: settingsForm.accent_color }} className="font-mono text-xs">Aksen</span>
              </div>
              <div style={{ backgroundColor: settingsForm.card_color, borderLeftColor: settingsForm.accent_color }} className="p-3 border-l-4 rounded shadow-sm text-sm">
                Kotak Kegiatan / Card
              </div>
              <button style={{ backgroundColor: settingsForm.accent_color, color: settingsForm.bg_color }} className="mt-3 px-3 py-1 rounded text-xs font-bold">Tombol Aksen</button>
            </div>

            <form onSubmit={saveSettings} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="text-xs opacity-70 block mb-1">Latar Belakang</label>
                   <input type="color" className="w-full h-8 bg-transparent cursor-pointer" value={settingsForm.bg_color} onChange={e => setSettingsForm({...settingsForm, bg_color: e.target.value})} />
                </div>
                <div>
                   <label className="text-xs opacity-70 block mb-1">Warna Kotak (Card)</label>
                   <input type="color" className="w-full h-8 bg-transparent cursor-pointer" value={settingsForm.card_color} onChange={e => setSettingsForm({...settingsForm, card_color: e.target.value})} />
                </div>
                <div>
                   <label className="text-xs opacity-70 block mb-1">Warna Teks</label>
                   <input type="color" className="w-full h-8 bg-transparent cursor-pointer" value={settingsForm.text_color} onChange={e => setSettingsForm({...settingsForm, text_color: e.target.value})} />
                </div>
                <div>
                   <label className="text-xs opacity-70 block mb-1">Warna Aksen</label>
                   <input type="color" className="w-full h-8 bg-transparent cursor-pointer" value={settingsForm.accent_color} onChange={e => setSettingsForm({...settingsForm, accent_color: e.target.value})} />
                </div>
              </div>

              <div className="w-full h-px bg-current opacity-20 my-4" />

              <div>
                <label className="text-xs opacity-70 block mb-1">Notifikasi (Menit sebelum mulai)</label>
                <input type="number" style={{ backgroundColor: settingsForm.bg_color, color: settingsForm.text_color }} className="w-full p-2 rounded border border-transparent focus:border-current outline-none" value={settingsForm.notif_minutes} onChange={e => setSettingsForm({...settingsForm, notif_minutes: parseInt(e.target.value)})} />
              </div>
              <div style={{ backgroundColor: settingsForm.bg_color }} className="p-3 rounded">
                <label className="text-xs opacity-70 block mb-2">Upload Suara Notifikasi (MP3)</label>
                <input type="file" accept="audio/*" onChange={handleSoundUpload} className="text-xs" />
                {profile.notif_sound_url && <p className="text-xs text-green-500 mt-2 font-bold">✓ Suara khusus aktif</p>}
              </div>

              <div className="flex justify-between items-center pt-6 mt-2 border-t border-current border-opacity-20">
                <button type="button" onClick={deleteProfile} className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded font-bold transition">Hapus Profil</button>
                <div className="flex gap-2">
                   <button 
                     type="button" 
                     onClick={() => setSettingsForm({
                       ...settingsForm, 
                       bg_color: '#0f1115', 
                       card_color: '#1a1d24', 
                       text_color: '#d1d5db', 
                       accent_color: '#eab308'
                     })} 
                     className="px-3 py-2 text-xs border border-current opacity-60 hover:opacity-100 rounded transition"
                   >
                     Reset Tema
                   </button>
                   
                   <button type="button" onClick={() => setIsSettingsModalOpen(false)} className="px-4 py-2 text-sm opacity-70 hover:bg-black/20 rounded transition">Batal</button>
                   <button type="submit" style={{ backgroundColor: settingsForm.accent_color, color: settingsForm.bg_color }} className="px-4 py-2 text-sm font-bold rounded transition">Simpan</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}