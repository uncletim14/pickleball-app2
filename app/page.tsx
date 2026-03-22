'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// 🛑🛑🛑 系統功能開關 🛑🛑🛑
// false = 關閉登入功能，大家可以手動輸入姓名 (目前狀態)
// true  = 開啟登入功能，強制大家必須用 Google 登入才能報名 (測試中先開啟)
const ENABLE_LOGIN_SYSTEM = false; 

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type Participant = {
  id: number;
  name: string;
  status: 'confirmed' | 'waitlist';
  day_id: string;
  people_count: number;
  paddle_count: number;
};

export default function PickleballRegistration() {
  const eventDays = [
    { id: 'tue', label: '星期二 (3/24)', time: '19:00 - 21:20', location: '七賢國小', maxPlayers: 10, fee: 100 },
    { id: 'thu', label: '星期四 (3/26)', time: '19:00 - 21:20', location: '七賢國小', maxPlayers: 16, fee: 100 },
    { id: 'fri', label: '星期五 (3/27)', time: '19:00 - 21:20', location: '七賢國小', maxPlayers: 24, fee: 100 },
  ];

  const [activeTab, setActiveTab] = useState(eventDays[0].id);
  const [name, setName] = useState('');
  const [peopleCount, setPeopleCount] = useState<number | ''>(1);
  const [paddleCount, setPaddleCount] = useState<number | ''>(0);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    if (ENABLE_LOGIN_SYSTEM) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setUser(session?.user ?? null);
        // 登入時自動帶入 Google 名字，但後續允許使用者自己修改
        if (session?.user?.user_metadata?.full_name && !name) {
          setName(session.user.user_metadata.full_name);
        }
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null);
        if (session?.user?.user_metadata?.full_name) {
          setName(session.user.user_metadata.full_name);
        } else {
          setName('');
        }
      });
      fetchParticipants();
      return () => subscription.unsubscribe();
    } else {
      fetchParticipants();
    }
  }, []);

  const fetchParticipants = async () => {
    setIsLoading(true);
    const { data, error } = await supabase.from('participants').select('*').order('id', { ascending: true });
    if (!error && data) setParticipants(data);
    setIsLoading(false);
  };

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
    if (error) alert("登入失敗：" + error.message);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const activeEvent = eventDays.find(d => d.id === activeTab)!;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      alert("請輸入姓名！");
      return;
    }

    // --- 升級：現在無論有沒有登入，都強制檢查姓名格式 (因為登入後也能自己改名了) ---
    const nameRegex = /^[a-zA-Z\u4e00-\u9fa5\s]+$/;
    if (!nameRegex.test(name)) {
      alert("姓名格式錯誤：只能輸入「中文」或「英文」，請勿使用特殊符號！");
      return;
    }
    // -------------------------------------------------------------------------

    const finalPeople = Number(peopleCount) || 1;
    const finalPaddle = Number(paddleCount) || 0;

    const confirmMessage = `📌 請確認報名資訊：\n\n📅 日期：${activeEvent.label}\n👥 人數：${finalPeople} 人\n🏸 球拍：${finalPaddle} 支\n\n確定要送出嗎？`;
    if (!window.confirm(confirmMessage)) return;

    const dayParticipants = participants.filter(p => p.day_id === activeTab);
    const confirmedTotal = dayParticipants.filter(p => p.status === 'confirmed').reduce((sum, p) => sum + p.people_count, 0);
    const availableSpots = Math.max(0, activeEvent.maxPlayers - confirmedTotal);
    let insertData = [];

    if (availableSpots === 0) {
      insertData.push({ name, status: 'waitlist', day_id: activeTab, people_count: finalPeople, paddle_count: finalPaddle });
    } else if (finalPeople <= availableSpots) {
      insertData.push({ name, status: 'confirmed', day_id: activeTab, people_count: finalPeople, paddle_count: finalPaddle });
    } else {
      const waitCount = finalPeople - availableSpots;
      insertData.push({ name: name + ' (部分正取)', status: 'confirmed', day_id: activeTab, people_count: availableSpots, paddle_count: finalPaddle });
      insertData.push({ name: name + ' (部分候補)', status: 'waitlist', day_id: activeTab, people_count: waitCount, paddle_count: 0 });
    }

    const { data, error } = await supabase.from('participants').insert(insertData).select();

    if (!error && data) {
      setParticipants([...participants, ...data]);
      
      // 送出報名後，如果他改過名字，我們幫他把名字恢復成 Google 預設的名字，方便他報名下一場
      if (ENABLE_LOGIN_SYSTEM && user?.user_metadata?.full_name) {
        setName(user.user_metadata.full_name);
      } else {
        setName('');
      }
      
      setPeopleCount(1);
      setPaddleCount(0);
      alert("報名完成！");
    } else if (error) {
      alert("報名失敗：" + error.message);
    }
  };

  const currentDayParticipants = participants.filter(p => p.day_id === activeTab);
  const confirmedList = currentDayParticipants.filter(p => p.status === 'confirmed');
  const waitlistList = currentDayParticipants.filter(p => p.status === 'waitlist');
  const totalConfirmed = confirmedList.reduce((sum, p) => sum + p.people_count, 0);

  return (
    <main className="min-h-screen bg-gray-100 p-4 md:p-8 font-sans">
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6 text-center">🏓 七賢國小匹克球交流團</h1>
        
        <div className="flex gap-2 mb-6 border-b pb-2 overflow-x-auto whitespace-nowrap">
          {eventDays.map((day) => (
            <button
              key={day.id}
              onClick={() => setActiveTab(day.id)}
              className={`px-4 py-2 rounded-t-lg font-medium transition ${activeTab === day.id ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
            >
              {day.label}
            </button>
          ))}
        </div>

        <div className="bg-blue-50 p-4 rounded-lg mb-6 text-gray-700 space-y-1 text-sm md:text-base">
          <p><strong>🕒 時間：</strong> {activeEvent.label} {activeEvent.time}</p>
          <p><strong>📍 地點：</strong> {activeEvent.location}</p>
          <p><strong>💰 費用：</strong> {activeEvent.fee} / 人 (租借球拍 +50)</p>
          <p><strong>👥 剩餘正取：</strong> <span className="text-red-600 font-bold">{Math.max(0, activeEvent.maxPlayers - totalConfirmed)} 人</span></p>
        </div>

        {ENABLE_LOGIN_SYSTEM ? (
          !user ? (
            <div className="mb-8 p-8 bg-gray-50 rounded-lg border text-center">
              <p className="text-gray-600 mb-4 font-medium">請先登入，以確認您的報名身分。</p>
              <button onClick={handleGoogleLogin} className="bg-white border border-gray-300 text-gray-700 font-bold py-3 px-6 rounded-lg hover:bg-gray-100 transition shadow-sm flex items-center justify-center mx-auto gap-3">
                <span className="text-xl">🌐</span> 使用 Google 帳號登入
              </button>
            </div>
          ) : (
            <form onSubmit={handleRegister} className="mb-8 space-y-4 bg-gray-50 p-4 rounded-lg border">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-green-600 font-bold flex items-center gap-1">✅ 已登入身分</span>
                <button type="button" onClick={handleLogout} className="text-xs text-red-500 hover:underline">登出帳號</button>
              </div>
              
              {/* --- 這裡解除了鎖定，使用者可以自由修改名字了！ --- */}
              <input 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)}
                placeholder="請輸入報名姓名 (限中英文)" 
                className="w-full border rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500 bg-white" 
                required
              />
              {/* ------------------------------------------------ */}

              <div className="flex gap-4">
                <div className="flex-1"><label className="text-xs text-gray-500 ml-1">報名人數</label><input type="number" min="1" value={peopleCount === '' ? '' : peopleCount} onChange={(e) => setPeopleCount(e.target.value === '' ? '' : parseInt(e.target.value))} className="w-full border rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500" /></div>
                <div className="flex-1"><label className="text-xs text-gray-500 ml-1">租借球拍</label><input type="number" min="0" value={paddleCount === '' ? '' : paddleCount} onChange={(e) => setPaddleCount(e.target.value === '' ? '' : parseInt(e.target.value))} className="w-full border rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500" /></div>
              </div>
              <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition shadow-md">送出報名</button>
            </form>
          )
        ) : (
          <form onSubmit={handleRegister} className="mb-8 space-y-4 bg-gray-50 p-4 rounded-lg border">
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="報名姓名 (限中英文)" className="w-full border rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500" required />
            <div className="flex gap-4">
              <div className="flex-1"><label className="text-xs text-gray-500 ml-1">報名人數</label><input type="number" min="1" value={peopleCount === '' ? '' : peopleCount} onChange={(e) => setPeopleCount(e.target.value === '' ? '' : parseInt(e.target.value))} className="w-full border rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500" /></div>
              <div className="flex-1"><label className="text-xs text-gray-500 ml-1">租借球拍</label><input type="number" min="0" value={paddleCount === '' ? '' : paddleCount} onChange={(e) => setPaddleCount(e.target.value === '' ? '' : parseInt(e.target.value))} className="w-full border rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500" /></div>
            </div>
            <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition shadow-md">送出報名</button>
          </form>
        )}

        {isLoading ? (
          <div className="text-center py-10 text-gray-400">連線資料庫中...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h2 className="font-bold text-green-600 border-b-2 border-green-200 mb-3 flex justify-between">
                <span>✅ 報名成功</span>
                <span>{totalConfirmed}/{activeEvent.maxPlayers}</span>
              </h2>
              <ul className="space-y-2">
                {confirmedList.length === 0 && <p className="text-gray-400 text-xs">尚無人報名</p>}
                {confirmedList.map((p, i) => (
                  <li key={p.id} className="text-sm bg-green-50 p-2 rounded border border-green-100 flex justify-between items-center shadow-sm">
                    <span>{i+1}. {p.name} <span className="font-bold text-blue-600">({p.people_count}人)</span></span>
                    {p.paddle_count > 0 && <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full">拍x{p.paddle_count}</span>}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="font-bold text-orange-500 border-b-2 border-orange-200 mb-3">⏳ 候補名單</h2>
              <ul className="space-y-2">
                {waitlistList.length === 0 && <p className="text-gray-400 text-xs">目前無人候補</p>}
                {waitlistList.map((p, i) => (
                  <li key={p.id} className="text-sm bg-orange-50 p-2 rounded border border-orange-100 shadow-sm">
                    候補 {i+1}. {p.name} <span className="font-bold text-blue-600">({p.people_count}人)</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}