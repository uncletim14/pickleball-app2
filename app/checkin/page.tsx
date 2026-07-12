// app/checkin/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type Participant = {
  id: number;
  name: string;
  day_key: string;
  edit_code: string;
  is_present: boolean;
};

export default function CheckInPage() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  // 取得今天日期的 key (格式: YYYY-M-D)
  const getTodayKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  };

  useEffect(() => {
    fetchTodayParticipants();
  }, []);

  const fetchTodayParticipants = async () => {
    const todayKey = getTodayKey();
    const { data, error } = await supabase
      .from('tournament_participants')
      .select('*')
      .eq('day_key', todayKey);
    
    if (!error && data) {
      // 僅篩選出還沒報到的人
      setParticipants(data.filter(p => !p.is_present));
    }
  };

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');

    // 🌟 嚴格防偷跑限制：限定當天 18:30 - 21:45 才能報到
    const now = new Date();
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();
    const totalMinutes = currentHour * 60 + currentMin;

    const startTime = 18 * 60 + 30; // 18:30
    const endTime = 21 * 60 + 45;   // 21:45

    if (totalMinutes < startTime || totalMinutes > endTime) {
      setMessage('❌ 未到報到時間！請於球聚當天 18:30 ~ 21:45 至現場掃碼報到。');
      return;
    }

    if (!selectedId) { setMessage('❌ 請選擇您的名字'); return; }

    const person = participants.find(p => p.id === parseInt(selectedId));
    if (!person) return;

    if (person.edit_code !== password) {
      setMessage('❌ 密碼錯誤！請輸入您報名時設定的 4 位數密碼。');
      return;
    }

    // 寫入 Supabase (直接借用現有的 tournament_participants 資料表)
    // 💡 提示：Supabase 會自動相容新欄位，初次寫入時會自動建立 is_present
    const { error } = await supabase
      .from('tournament_participants')
      .update({ is_present: true })
      .eq('id', person.id);

    if (!error) {
      setMessage(`🎉 【${person.name}】現場報到成功！歡迎入場 🏸`);
      setPassword('');
      setSelectedId('');
      fetchTodayParticipants();
    } else {
      setMessage('❌ 報到失敗，請洽提姆大叔。');
    }
  };

  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-800 p-8 rounded-[2.5rem] border border-slate-700 shadow-2xl">
        <h1 className="text-3xl font-black text-center text-emerald-400 mb-2 italic">七賢交流團 現場報到</h1>
        <p className="text-center text-slate-400 text-sm mb-6">歡迎到場！請選擇名字並輸入密碼完成登錄</p>

        {message && (
          <div className={`p-4 rounded-xl text-center font-bold mb-4 ${message.startsWith('🎉') ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
            {message}
          </div>
        )}

        <form onSubmit={handleCheckIn} className="space-y-5">
          <div>
            <label className="text-xs text-slate-500 font-bold tracking-wider uppercase">1. 選擇報名大名</label>
            <select 
              value={selectedId} 
              onChange={e => setSelectedId(e.target.value)}
              className="w-full bg-slate-900 p-4 rounded-xl border border-slate-700 font-bold mt-1 text-white text-lg"
            >
              <option value="">-- 請選擇您的名字 --</option>
              {participants.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-500 font-bold tracking-wider uppercase">2. 輸入報名密碼 (4 碼)</label>
            <input 
              type="password" 
              maxLength={4}
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="請輸入 4 位數密碼"
              className="w-full bg-slate-900 p-4 rounded-xl border border-slate-700 font-bold mt-1 text-white text-lg"
            />
          </div>

          <button className="w-full bg-emerald-500 py-4 rounded-xl font-black text-xl hover:bg-emerald-400 text-slate-900 transition-all shadow-lg mt-2">
            確認到場報到
          </button>
        </form>
      </div>
    </main>
  );
}
