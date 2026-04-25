'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// 🛑🛑🛑 系統功能開關 🛑🛑🛑
const ENABLE_LOGIN_SYSTEM = false; 

// 🆕 新手體驗開關：(下週不開放，設為 false)
const HAS_NOVICE_SESSION = false; 

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

// 🤖 自動計算日期的「日曆大腦」
const getFormattedDate = (targetDayOfWeek: number) => {
  const now = new Date();
  const currentDay = now.getDay(); 
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - currentDay);
  
  if (currentDay === 6) {
    sunday.setDate(sunday.getDate() + 7);
  }
  
  const targetDate = new Date(sunday);
  targetDate.setDate(sunday.getDate() + targetDayOfWeek);
  
  return `${targetDate.getMonth() + 1}/${targetDate.getDate()}`;
};

export default function PickleballRegistration() {
  // 🌟 場次設定：星期一已修正為 24 人
  const eventDays = [
    { id: 'novice', dayOfWeek: 1, label: HAS_NOVICE_SESSION ? `新手體驗 (${getFormattedDate(1)})` : `新手體驗`, time: HAS_NOVICE_SESSION ? '19:00 - 21:20' : '待公告', location: '七賢國小', maxPlayers: 8, fee: 0 },
    { id: 'mon', dayOfWeek: 1, label: `星期一 (${getFormattedDate(1)})`, time: '19:00 - 21:20', location: '七賢國小', maxPlayers: 24, fee: 100 },
    { id: 'tue', dayOfWeek: 2, label: `星期二 (${getFormattedDate(2)})`, time: '19:00 - 21:20', location: '七賢國小', maxPlayers: 14, fee: 100 },
    { id: 'thu', dayOfWeek: 4, label: `星期四 (${getFormattedDate(4)})`, time: '19:00 - 21:20', location: '七賢國小', maxPlayers: 24, fee: 100 },
    { id: 'fri_novice', dayOfWeek: 5, label: `週五 (新手組) (${getFormattedDate(5)})`, time: '19:00 - 21:20', location: '七賢國小', maxPlayers: 8, fee: 100 },
    { id: 'fri_regular', dayOfWeek: 5, label: `週五 (散打組) (${getFormattedDate(5)})`, time: '19:00 - 21:20', location: '七賢國小', maxPlayers: 16, fee: 100 },
  ];

  const [activeTab, setActiveTab] = useState(eventDays[0].id);
  const [name, setName] = useState('');
  const [peopleCount, setPeopleCount] = useState<number | ''>(1);
  const [paddleCount, setPaddleCount] = useState<number | ''>(0);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(true);

  useEffect(() => {
    const checkStatus = () => {
      const now = new Date();
      const day = now.getDay(); 
      const hour = now.getHours(); 
      if (day === 6 && hour < 18) {
        setIsRegistrationOpen(false);
      } else {
        setIsRegistrationOpen(true);
      }
    };
    checkStatus();
    const clockInterval = setInterval(checkStatus, 60000);
    fetchParticipants();
    return () => clearInterval(clockInterval);
  }, []);

  const fetchParticipants = async () => {
    setIsLoading(true);
    const { data, error } = await supabase.from('participants').select('*').order('id', { ascending: true });
    if (!error && data) setParticipants(data);
    setIsLoading(false);
  };

  const activeEvent = eventDays.find(d => d.id === activeTab)!;

  const hasEventPassed = (eventDayOfWeek: number) => {
    const now = new Date();
    const currentDay = now.getDay();
    if (currentDay === 0 || currentDay === 6) return false;
    return currentDay > eventDayOfWeek;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { alert("請輸入 LINE 群組暱稱或 ID！ (Please enter your LINE ID)"); return; }
    const finalPeople = Number(peopleCount) || 1;
    const finalPaddle = activeEvent.fee === 0 ? 0 : (Number(paddleCount) || 0);

    const confirmMessage = `📌 請確認報名資訊：\n\n📅 場次：${activeEvent.label}\n👥 人數：${finalPeople} 人${activeEvent.fee !== 0 ? `\n🏸 球拍：${finalPaddle} 支` : ''}\n\n確定要送出嗎？`;
    if (!window.confirm(confirmMessage)) return;

    const dayParticipants = participants.filter(p => p.day_id === activeTab);
    const confirmedTotal = dayParticipants.filter(p => p.status === 'confirmed').reduce((sum, p) => sum + p.people_count, 0);
    const waitlistCount = dayParticipants.filter(p => p.status === 'waitlist').length;
    const availableSpots = Math.max(0, activeEvent.maxPlayers - confirmedTotal);
    
    let insertData = [];
    if (availableSpots === 0 || waitlistCount > 0) {
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
      setName(''); setPeopleCount(1); setPaddleCount(0);
      alert("報名完成！ (Registration Successful!)");
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
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6 flex justify-center items-center gap-3 text-center">
          <img src="/七賢匹克球LOGO.png" alt="Logo" className="w-16 h-16 md:w-20 md:h-20 rounded-full object-cover" />
          七賢國小匹克球交流團
        </h1>
        
        <div className="flex gap-2 mb-6 border-b pb-2 overflow-x-auto whitespace-nowrap">
          {eventDays.map((day) => (
            <button
              key={day.id}
              onClick={() => setActiveTab(day.id)}
              className={`px-4 py-2 rounded-t-lg font-medium transition ${activeTab === day.id ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
            >
              {day.id === 'novice' ? '🐣 新手體驗' : day.label}
            </button>
          ))}
        </div>

        <div className="bg-blue-50 p-4 rounded-lg mb-6 text-blue-700 space-y-1 text-sm md:text-base">
          <p><strong>🕒 時間 (Time)：</strong> {activeEvent.label} {activeEvent.time}</p>
          <p><strong>📍 地點 (Location)：</strong> {activeEvent.location}</p>
          <p><strong>💰 費用 (Fee)：</strong> {activeEvent.fee === 0 ? <span className="text-green-600 font-bold">免費 (Free)</span> : `${activeEvent.fee} / 人 (租借球拍 Paddle rental +50)`}</p>
          <p><strong>👥 剩餘正取 (Available spots)：</strong> <span className="text-red-600 font-bold">{Math.max(0, activeEvent.maxPlayers - totalConfirmed)} 人</span></p>
          
          {(activeTab === 'novice' || activeTab === 'fri_novice') && (
            <div className="mt-3 pt-3 border-t border-blue-200 text-blue-800">
              <p className="font-medium">🌟 <strong>For English Speakers:</strong></p>
              <p className="text-xs md:text-sm mt-1">Welcome to our beginner session! Please note that no formal instruction is provided; this is a friendly play session designed for new players to practice together. If you don't have a paddle, you can rent one for NT$50. Please enter your LINE Name or ID below to register.</p>
            </div>
          )}
        </div>

        {!isRegistrationOpen ? (
          <div className="mb-8 p-8 bg-yellow-50 rounded-lg border border-yellow-200 text-center shadow-sm">
            <div className="text-5xl mb-4">⏳</div>
            <h2 className="text-xl font-bold text-yellow-800 mb-2">目前暫停報名</h2>
            <p className="text-yellow-700 font-medium">下週場次將於 <strong>星期六晚上 18:00</strong> 準時開放</p>
          </div>
        ) : activeTab === 'novice' && !HAS_NOVICE_SESSION ? (
          <div className="mb-8 p-8 bg-gray-50 rounded-lg border border-gray-200 text-center shadow-sm">
            <div className="text-5xl mb-4">💤</div>
            <h2 className="text-xl font-bold text-gray-500 mb-2">本週無新手體驗場</h2>
            <p className="text-gray-400 font-medium">請密切留意 LINE 群組下週通知喔！</p>
          </div>
        ) : hasEventPassed(activeEvent.dayOfWeek) ? (
          <div className="mb-8 p-8 bg-gray-100 rounded-lg border border-gray-300 text-center shadow-sm">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-xl font-bold text-gray-600 mb-2">本場次已結束</h2>
            <p className="text-gray-500 font-medium">期待下週再與您一起揮灑汗水！</p>
          </div>
        ) : (
          <form onSubmit={handleRegister} className="mb-8 space-y-4 bg-gray-50 p-4 rounded-lg border">
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="請輸入 LINE 群組暱稱或 ID (LINE Name / ID)" className="w-full border rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500" required />
            <div className="flex gap-4">
              <div className="flex-1"><label className="text-xs text-gray-500 ml-1">報名人數 (People)</label><input type="number" min="1" value={peopleCount === '' ? '' : peopleCount} onChange={(e) => setPeopleCount(e.target.value === '' ? '' : parseInt(e.target.value))} className="w-full border rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500" /></div>
              {activeEvent.fee !== 0 && (
                <div className="flex-1"><label className="text-xs text-gray-500 ml-1">租借球拍 (Rent Paddle)</label><input type="number" min="0" value={paddleCount === '' ? '' : paddleCount} onChange={(e) => setPaddleCount(e.target.value === '' ? '' : parseInt(e.target.value))} className="w-full border rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500" /></div>
              )}
            </div>
            <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition shadow-md">送出報名 (Submit)</button>
          </form>
        )}

        {isLoading ? (
          <div className="text-center py-10 text-gray-400">連線資料庫中...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h2 className="font-bold text-green-600 border-b-2 border-green-200 mb-3 flex justify-between"><span>✅ 報名成功</span><span>{totalConfirmed}/{activeEvent.maxPlayers}</span></h2>
              <ul className="space-y-2">
                {confirmedList.length === 0 && <p className="text-gray-400 text-xs">尚無人報名</p>}
                {confirmedList.map((p, i) => (
                  <li key={p.id} className="text-sm bg-green-50 p-2 rounded border border-green-100 flex justify-between items-center shadow-sm">
                    <span>{i+1}. {p.name} <span className="font-bold text-blue-600">({p.people_count}人)</span></span>
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