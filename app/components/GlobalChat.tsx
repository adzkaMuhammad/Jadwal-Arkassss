"use client"
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'

// --- KOMPONEN CUSTOM VOICE NOTE ALA IG DM ---
const VoiceNotePlayer = ({ url }: { url: string }) => {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)

  const waveBars = [12, 18, 14, 24, 28, 16, 20, 26, 14, 18, 12, 16, 22, 14, 18]

  const togglePlay = () => {
    if (!audioRef.current) return
    if (isPlaying) audioRef.current.pause()
    else audioRef.current.play()
    setIsPlaying(!isPlaying)
  }

  const onTimeUpdate = () => {
    if (!audioRef.current) return
    setCurrentTime(audioRef.current.currentTime)
    setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100)
  }

  const onLoadedMetadata = () => { if (audioRef.current) setDuration(audioRef.current.duration) }
  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || !isFinite(seconds)) return '0:00'
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s < 10 ? '0' : ''}${s}`
  }

  return (
    <div className="flex items-center gap-2 bg-black/20 rounded-2xl py-2 px-3 w-[220px] mb-1">
      <button type="button" onClick={togglePlay} className="w-8 h-8 flex-shrink-0 bg-[#3797f0] hover:bg-blue-500 rounded-full flex items-center justify-center text-white transition shadow-sm text-xs">
        {isPlaying ? '⏸' : '▶'}
      </button>
      <div className="flex-1 relative h-8 flex items-center cursor-pointer group">
        <div className="absolute inset-0 flex items-center justify-between gap-[2px] px-1 pointer-events-none">
          {waveBars.map((h, i) => {
            const barPercent = (i / waveBars.length) * 100;
            const isFilled = progress > barPercent;
            return <div key={i} className={`w-[3px] rounded-full transition-colors duration-100 ${isFilled ? 'bg-[#3797f0]' : 'bg-gray-500/50'}`} style={{ height: `${h}px` }} />
          })}
        </div>
        <input type="range" min="0" max="100" value={progress || 0} onChange={(e) => {
            if (audioRef.current) {
              const newTime = (Number(e.target.value) / 100) * audioRef.current.duration;
              audioRef.current.currentTime = newTime;
              setProgress(Number(e.target.value));
            }
          }}
          className="absolute inset-0 w-full opacity-0 cursor-pointer z-20"
        />
      </div>
      <span className="text-[10px] font-mono text-gray-300 w-7 text-right flex-shrink-0">{formatTime(isPlaying ? currentTime : duration)}</span>
      <audio ref={audioRef} src={url} onTimeUpdate={onTimeUpdate} onLoadedMetadata={onLoadedMetadata} onEnded={() => setIsPlaying(false)} className="hidden" />
    </div>
  )
}

// --- KOMPONEN UTAMA CHAT ---
export default function GlobalChat({ currentProfileId, accentColor }: { currentProfileId: string, accentColor: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<any[]>([])
  const [profiles, setProfiles] = useState<Record<string, any>>({})
  const [input, setInput] = useState('')
  
  const [replyTo, setReplyTo] = useState<any | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [showEmoji, setShowEmoji] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  
  const [isRecording, setIsRecording] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  
  const endOfMessagesRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const docInputRef = useRef<HTMLInputElement>(null)
  
 const emojis = [
  // Gestur & Tangan (Termasuk daftar asli)
  '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤝', '🙏', '👏', '🙌', '👐', '💪', '👋', '🤙', '👆', '👇', '👈', '👉',

  // Wajah & Emosi
  '😀', '😃', '😄', '😁', '😅', '😂', '🤣', '🥲', '😊', '😇', '🥰', '😍', '🤩', '😘', '😋', '😜', '🤪', 
  '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😒', '🙄', '😬', '😌', '😔', '😪', '🤤', '😴', '😷', '🤢', '🤮', 
  '🥵', '🥶', '🤯', '🥳', '😎', '🤓', '🧐', '😕', '😟', '😮', '😲', '😳', '🥺', '😨', '😰', '😢', '😭', 
  '😱', '😖', '😞', '😩', '😫', '😤', '😡', '🤬', '😈', '💀', '💩', '🤡', '👻', '👽', '🤖',

  // Bagian Tubuh
  '👀', '👁️', '👅', '👄', '🧠', '🦴',

  // Hati & Cinta
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘',

  // Simbol, Objek, & Alam
  '💡', '✅', '❌', '⚠️', '⛔', '🚫', '🔥', '🎉', '🎊', '✨', '🌟', '⭐', '💫', '💥', '💯', '🚀', '🛸', 
  '📌', '📍', '🔔', '🔕', '🗑️', '⚙️', '🔧', '🔍', '🔎', '💰', '💸', '🎁', '🎈', '🏆', '🎵', '🎶',
  '🌞', '🌝', '🌛', '🌍', '🌎', '🌏', '🌈', '⚡', '❄️', '💧', '🌊'
];

  useEffect(() => {
    fetchInitialData()
    const channel = supabase.channel('chat_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
        if (payload.eventType === 'INSERT') setMessages(prev => [...prev, payload.new])
        if (payload.eventType === 'UPDATE') setMessages(prev => prev.map(m => m.id === payload.new.id ? payload.new : m))
        if (payload.eventType === 'DELETE') setMessages(prev => prev.filter(m => m.id !== payload.old.id))
      }).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  useEffect(() => {
    if (isOpen) scrollToBottom()
  }, [messages, isOpen])

  // LOGIKA BACA PESAN (READ RECEIPTS)
  useEffect(() => {
    if (isOpen && messages.length > 0) {
      const lastMsg = messages[messages.length - 1]
      // Jika pesan terakhir bukan milik kita dan ID kita belum ada di daftar seen_by
      if (lastMsg.profile_id !== currentProfileId && !(lastMsg.seen_by || []).includes(currentProfileId)) {
        const newSeenBy = [...(lastMsg.seen_by || []), currentProfileId]
        supabase.from('messages').update({ seen_by: newSeenBy }).eq('id', lastMsg.id).then()
      }
    }
  }, [isOpen, messages, currentProfileId])

  const fetchInitialData = async () => {
    const { data: profData } = await supabase.from('profiles').select('*')
    if (profData) {
      const profMap = profData.reduce((acc, p) => ({ ...acc, [p.id]: p }), {})
      setProfiles(profMap)
    }
    const { data: msgData } = await supabase.from('messages').select('*').order('created_at', { ascending: true }).limit(100)
    if (msgData) setMessages(msgData)
  }

  const scrollToBottom = () => endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return
    if (editId) {
      await supabase.from('messages').update({ content: input, is_edited: true }).eq('id', editId)
    } else {
      await supabase.from('messages').insert([{ profile_id: currentProfileId, content: input, reply_to_id: replyTo ? replyTo.id : null }])
    }
    setInput(''); setReplyTo(null); setEditId(null); setShowEmoji(false)
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { alert("Maksimal gambar 2MB."); return }

    setIsUploading(true)
    const fileName = `${currentProfileId}-${Date.now()}.jpg`
    const { error } = await supabase.storage.from('chat_images').upload(fileName, file)
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from('chat_images').getPublicUrl(fileName)
      await supabase.from('messages').insert([{ profile_id: currentProfileId, content: '📷 Mengirim gambar', image_url: publicUrl, reply_to_id: replyTo?.id || null }])
    }
    setReplyTo(null); setIsUploading(false)
  }

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { alert("Maksimal file dokumen 5MB."); return }

    setIsUploading(true)
    const fileName = `${currentProfileId}-${Date.now()}-${file.name}`
    const { error } = await supabase.storage.from('chat_files').upload(fileName, file)
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from('chat_files').getPublicUrl(fileName)
      await supabase.from('messages').insert([{ profile_id: currentProfileId, content: '📄 Mengirim dokumen', file_url: publicUrl, file_name: file.name, reply_to_id: replyTo?.id || null }])
    }
    setReplyTo(null); setIsUploading(false)
  }

  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop()
      setIsRecording(false)
      mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop())
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        mediaRecorderRef.current = new MediaRecorder(stream)
        audioChunksRef.current = []

        mediaRecorderRef.current.ondataavailable = (e) => audioChunksRef.current.push(e.data)
        mediaRecorderRef.current.onstop = async () => {
          setIsUploading(true)
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
          const fileName = `${currentProfileId}-${Date.now()}.webm`
          const { error } = await supabase.storage.from('chat_audio').upload(fileName, audioBlob)
          if (!error) {
            const { data: { publicUrl } } = supabase.storage.from('chat_audio').getPublicUrl(fileName)
            await supabase.from('messages').insert([{ profile_id: currentProfileId, content: '🎤 Voice Note', audio_url: publicUrl, reply_to_id: replyTo?.id || null }])
          }
          setIsUploading(false)
        }
        mediaRecorderRef.current.start()
        setIsRecording(true)
      } catch (err) {
        alert("Izin mikrofon ditolak.")
      }
    }
  }

  const deleteMessage = async (id: string) => {
    if(confirm('Hapus pesan ini?')) await supabase.from('messages').delete().eq('id', id)
  }

  // Cek apakah ada pesan baru untuk lencana merah
  const hasUnread = messages.length > 0 && 
                    messages[messages.length - 1].profile_id !== currentProfileId && 
                    !(messages[messages.length - 1].seen_by || []).includes(currentProfileId)

  if (!isOpen) {
    return (
      <button onClick={() => setIsOpen(true)} style={{ backgroundColor: accentColor }} className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center text-2xl shadow-2xl hover:scale-110 transition text-[#0f1115] relative">
        💬
        {hasUnread && (
          <span className="absolute top-0 right-0 w-4 h-4 bg-red-600 border-2 border-[#0f1115] rounded-full animate-pulse"></span>
        )}
      </button>
    )
  }

  return (
    <div className="fixed bottom-6 right-6 w-[380px] h-[600px] bg-[#1a1d24] border border-gray-700 rounded-xl shadow-2xl flex flex-col overflow-hidden z-50 font-sans">
      
      <div style={{ backgroundColor: accentColor }} className="px-4 py-3 flex justify-between items-center text-[#0f1115] shadow-md z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-black/20 flex items-center justify-center font-bold">👥</div>
          <h3 className="font-bold">Team Chat</h3>
        </div>
        <button onClick={() => setIsOpen(false)} className="opacity-70 hover:opacity-100 font-bold text-xl">&times;</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#0f1115]">
        {messages.map((msg, idx) => {
          const isMe = msg.profile_id === currentProfileId
          const sender = profiles[msg.profile_id]
          const repliedMsg = msg.reply_to_id ? messages.find(m => m.id === msg.reply_to_id) : null
          const isLastMessage = idx === messages.length - 1

          return (
            <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'} group items-end`}>
              
              <div className="w-8 h-8 rounded-full bg-gray-800 flex-shrink-0 border border-gray-600 overflow-hidden flex items-center justify-center text-xs font-bold text-gray-400">
                {sender?.avatar_url ? <img src={sender.avatar_url} className="w-full h-full object-cover" alt="PP" /> : sender?.name?.charAt(0).toUpperCase() || '?'}
              </div>
              
              <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[75%]`}>
                {!isMe && <span className="text-[10px] text-gray-500 mb-1 ml-1 font-bold">{sender?.name || 'Unknown'}</span>}
                
                <div className={`rounded-xl p-2.5 relative ${isMe ? 'bg-gray-800 text-white rounded-br-none' : 'bg-gray-900 text-gray-200 rounded-bl-none'} border border-gray-800 shadow-sm`}>
                  
                  {repliedMsg && (
                    <div className="mb-2 p-2 bg-black/30 border-l-2 border-yellow-500 rounded text-xs opacity-70 line-clamp-2">
                      <span className="font-bold text-yellow-500">{profiles[repliedMsg.profile_id]?.name}: </span>
                      {repliedMsg.image_url ? '📷 Foto' : repliedMsg.file_url ? '📄 Dokumen' : repliedMsg.audio_url ? '🎤 VN' : repliedMsg.content}
                    </div>
                  )}
                  
                  {msg.image_url && <img src={msg.image_url} alt="gambar" className="w-full rounded-md mb-1 max-h-[200px] object-cover cursor-pointer" onClick={() => window.open(msg.image_url, '_blank')} />}
                  
                  {msg.file_url && (
                    <a href={msg.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-black/20 p-2 rounded border border-gray-600 hover:bg-black/40 text-sm mb-1 transition">
                      <span className="text-xl">📄</span> <span className="line-clamp-1 break-all">{msg.file_name}</span>
                    </a>
                  )}

                  {msg.audio_url && <VoiceNotePlayer url={msg.audio_url} />}

                  {(!msg.image_url && !msg.file_url && !msg.audio_url) && <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>}
                  
                  <div className={`flex items-center gap-1 mt-1 opacity-50 text-[9px] ${isMe ? 'justify-end' : 'justify-start'}`}>
                    {msg.is_edited && <span>(diedit)</span>}
                    <span>{format(new Date(msg.created_at), 'HH:mm')}</span>
                  </div>

                  <div className={`absolute top-0 ${isMe ? '-left-16' : '-right-10'} opacity-0 group-hover:opacity-100 transition flex bg-black/50 rounded shadow p-1 gap-2`}>
                     <button onClick={() => {setReplyTo(msg); setEditId(null)}} className="text-xs hover:scale-125">↩️</button>
                     {isMe && (
                       <>
                         {(!msg.image_url && !msg.file_url && !msg.audio_url) && <button onClick={() => {setEditId(msg.id); setInput(msg.content); setReplyTo(null)}} className="text-xs hover:scale-125">✏️</button>}
                         <button onClick={() => deleteMessage(msg.id)} className="text-xs hover:scale-125">🗑️</button>
                       </>
                     )}
                  </div>
                </div>

                {/* AVATAR KECIL (READ RECEIPTS) DI BAWAH PESAN */}
                {isMe && isLastMessage && msg.seen_by && msg.seen_by.length > 0 && (
                  <div className="flex justify-end gap-1 mt-1 mr-1">
                    {msg.seen_by.map((id: string) => (
                      <div key={id} title={profiles[id]?.name} className="w-[14px] h-[14px] rounded-full overflow-hidden bg-gray-600 border border-[#0f1115]">
                        {profiles[id]?.avatar_url ? (
                          <img src={profiles[id].avatar_url} className="w-full h-full object-cover" alt="seen" />
                        ) : (
                          <span className="text-[7px] flex items-center justify-center h-full text-white">{profiles[id]?.name?.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}
        <div ref={endOfMessagesRef} />
        {isUploading && <div className="text-xs text-center opacity-50 font-bold animate-pulse">Mengunggah file...</div>}
      </div>

      {(replyTo || editId) && (
        <div className="bg-gray-800 border-t border-gray-700 p-2 flex justify-between items-center text-xs">
          <div className="line-clamp-1 opacity-70">
            {editId ? <span className="font-bold text-blue-400">✏️ Mengedit pesan...</span> : <span className="font-bold text-yellow-500">↩️ Membalas: {replyTo.image_url ? '📷 Foto' : replyTo.file_url ? '📄 Dokumen' : replyTo.audio_url ? '🎤 VN' : replyTo.content}</span>}
          </div>
          <button onClick={() => {setReplyTo(null); setEditId(null); setInput('')}} className="px-2 font-bold hover:text-red-400">✖</button>
        </div>
      )}

      <div className="p-3 bg-[#1a1d24] border-t border-gray-700 relative">
        {showEmoji && (
          <div className="absolute bottom-[65px] left-3 bg-[#1e212b] border border-gray-700 rounded-lg shadow-2xl p-3 z-50 w-[260px]">
            <div className="flex justify-between items-center mb-2 border-b border-gray-700 pb-2">
              <span className="text-xs font-bold text-gray-300">Pilih Emoji</span>
              <button type="button" onClick={() => setShowEmoji(false)} className="text-gray-400 hover:text-white text-lg leading-none font-bold">&times;</button>
            </div>
            <div className="grid grid-cols-6 gap-2 max-h-[200px] overflow-y-auto pr-1 custom-scrollbar">
              {emojis.map((e, idx) => (
                <button key={idx} type="button" onClick={() => setInput(prev => prev + e)} className="text-xl hover:scale-125 py-1 hover:bg-gray-700 rounded">{e}</button>
              ))}
            </div>
            <div className="absolute -bottom-2 left-6 w-4 h-4 bg-[#1e212b] border-b border-r border-gray-700 transform rotate-45"></div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex gap-2 items-end">
          <button type="button" onClick={() => setShowEmoji(!showEmoji)} className={`p-2 hover:opacity-100 text-lg transition ${showEmoji ? 'opacity-100 scale-110' : 'opacity-50'}`}>😀</button>
          <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 opacity-50 hover:opacity-100 text-lg transition" title="Kirim Gambar">📷</button>
          <input type="file" accept="image/*" hidden ref={fileInputRef} onChange={handleImageUpload} />
          <button type="button" onClick={() => docInputRef.current?.click()} className="p-2 opacity-50 hover:opacity-100 text-lg transition" title="Kirim File">📎</button>
          <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.zip" hidden ref={docInputRef} onChange={handleDocUpload} />
          <textarea value={input} onChange={e => setInput(e.target.value)} placeholder={isRecording ? "Merekam suara..." : "Ketik pesan..."} className="flex-1 bg-gray-800 text-sm text-white p-2 rounded-lg resize-none outline-none border border-transparent focus:border-gray-500 h-[40px] max-h-[100px]" onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e) } }} disabled={isRecording} />
          {input.trim() ? (
             <button type="submit" style={{ backgroundColor: accentColor }} className="p-2 rounded-lg text-[#0f1115] shadow-md">➤</button>
          ) : (
             <button type="button" onClick={toggleRecording} className={`p-2 rounded-full text-white shadow-md transition-all duration-300 flex items-center justify-center ${isRecording ? 'bg-red-500 scale-125 animate-pulse ring-4 ring-red-500/50 mr-1' : 'bg-gray-700 hover:bg-gray-600'}`}>🎤</button>
          )}
        </form>
      </div>
    </div>
  )
}