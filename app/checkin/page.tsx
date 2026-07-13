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
  is_present?: boolean;
};

export default function CheckInPage() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [message, setMessage] = useState<{ text: string; isSuccess: boolean } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // 取得今天的日期 Key (格式: YYYY-M-D)
  const getTodayKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  };

  const todayKey = getTodayKey();

  // 檢查目前時間是否在 18:30 ~ 21:00 之間
  const isTimeValid = () => {
    const now = new Date();
    const currentHour = now.getHours() + now.getMinutes() / 60;
    // 🌟 調整：18.5 代表 18:30，21 代表 21:00 準時關門
    return currentHour >= 18.5 && currentHour <= 21;
  };

  useEffect(() => {
    fetchTodayParticipants();
  }, []);

  const fetchTodayParticipants = async () => {
    setLoading(true);
    // 撈出今天這場活動、而且還沒有報到過 (is_present != true) 的人
    const { data, error } = await supabase
      .from('tournament_participants')
      .select('*')
      .eq('day_key', todayKey)
      .or('is_present.eq.false,is_present.is.null')
      .order('id', { ascending: true });

    if (!error && data) {
      setParticipants(data);
    }
    setLoading(false);
  };

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!isTimeValid()) {
      setMessage({ text: '❌ 未到報到時間或已過報到時間！(開放時間：18:30 ~ 21:00)', isSuccess: false });
      return;
    }

    if (!selectedId) {
      setMessage({ text: '❌ 請選擇您的名字', isSuccess: false });
      return;
    }

    const player = participants.find(p => p.id === parseInt(selectedId));
    if (!player) return;

    if (password !== player.edit_code) {
      setMessage({ text: '❌ 密碼錯誤，請重新輸入！', isSuccess: false });
      return;
    }

    // 驗證成功，將資料庫中的 is_present 改為 true
    const { error } = await supabase
      .from('tournament_participants')
      .update({ is_present: true })
      .eq('id', player.id);

    if (!error) {
      setMessage({ text: `🎉 【${player.name}】現場報到成功！歡迎入場 🏸`, isSuccess: true });
      setPassword('');
      setSelectedId('');
      fetchTodayParticipants(); // 重新整理選單
    } else {
      setMessage({ text: '❌ 報到失敗，請洽提姆大叔。', isSuccess: false });
    }
  };

  return (
    <main className="min-h-screen bg-slate-900 p-4 md:p-8 text-slate-100 flex flex-col items-center justify-center font-sans tracking-tight">
      <div className="max-w-md w-full bg-slate-800 p-8 md:p-10 rounded-[3rem] border border-slate-700 shadow-2xl space-y-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 bg-emerald-500 text-slate-900 px-4 py-1 font-black text-xs uppercase tracking-widest">
          LIVE
        </div>
        
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-black text-emerald-400 italic tracking-wider">七賢匹克球團</h1>
          <p className="text-slate-400 font-bold text-lg">📱 現場自主到場報到系統</p>
          <p className="text-slate-500 text-xs bg-slate-900/50 py-1 rounded-full inline-block px-4 border border-slate-700">
            ⏰ 今日開放時間：18:30 - 21:00
          </p>
        </div>

        {message && (
          <div className={`p-4 rounded-2xl text-center font-bold text-lg border ${
            message.isSuccess 
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
              : 'bg-red-500/10 text-red-400 border-red-500/30'
          }`}>
            {message.text}
          </div>
        )}

        {!isTimeValid() ? (
          <div className="bg-slate-900/50 p-8 rounded-2xl border border-slate-700 text-center space-y-2">
            <p className="text-xl font-bold text-slate-400">🔒 目前非現場報到時段</p>
            <p className="text-slate-500 text-sm">請於球聚當天 18:30 ~ 21:00 之間到場掃碼報到</p>
          </div>
        ) : loading ? (
          <div className="text-center text-slate-400 font-bold py-6 animate-pulse">撈取今日名單中...</div>
        ) : participants.length === 0 ? (
          <div className="bg-slate-900/50 p-8 rounded-2xl border border-slate-700 text-center space-y-2">
            <p className="text-xl font-bold text-emerald-400">✨ 今日已全數報到完畢</p>
            <p className="text-slate-500 text-sm">或目前尚無人報名此場次</p>
          </div>
        ) : (
          <form onSubmit={handleCheckIn} className="space-y-6">
            <div>
              <label className="text-xs text-slate-500 font-black tracking-widest uppercase italic">1. 選擇您的名字</label>
              <select 
                value={selectedId} 
                onChange={e => setSelectedId(e.target.value)}
                className="w-full bg-slate-900 p-5 rounded-2xl border border-slate-700 text-xl font-black text-white mt-2 appearance-none cursor-pointer"
              >
                <option value="">-- 請選擇您的名字 --</option>
                {participants.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-yellow-400 font-black tracking-widest uppercase italic">2. 輸入您的報名密碼 (4 碼)</label>
              <input 
                type="password" 
                maxLength={4} 
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="請輸入報名時設定的 4 位數密碼" 
                className="w-full bg-slate-900 p-5 rounded-2xl border border-slate-700 text-xl font-black text-white mt-2 text-center tracking-widest"
              />
            </div>

            <button className="w-full bg-emerald-500 py-5 rounded-2xl font-black text-2xl hover:bg-emerald-400 text-white transition-all active:scale-95 shadow-lg shadow-emerald-500/20 uppercase italic">
              確認到場報到
            </button>
          </form>
        )}
      </div>
    </main>
  );
}