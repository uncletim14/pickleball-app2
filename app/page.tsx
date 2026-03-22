'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 定義參加者格式 (確保 Vercel 不會報錯)
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
    { id: 'tue', label: '星期二 (3/24)', time: '19:00 - 21:00', location: '七賢國小', maxPlayers: 10, fee: 100 },
    { id: 'thu', label: '星期四 (3/26)', time: '19:00 - 21:00', location: '七賢國小', maxPlayers: 16, fee: 100 },
    { id: 'fri', label: '星期五 (3/27)', time: '19:00 - 21:00', location: '七賢國小', maxPlayers: 24, fee: 100 },
  ];

  const [activeTab, setActiveTab] = useState(eventDays[0].id);
  const [name, setName] = useState('');
  const [peopleCount, setPeopleCount] = useState<number | ''>(1);
  const [paddleCount, setPaddleCount] = useState<number | ''>(0);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchParticipants();
  }, []);

  const fetchParticipants = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('participants')
      .select('*')
      .order('id', { ascending: true });

    if (!error && data) {
      setParticipants(data);
    }
    setIsLoading(false);
  };

  const activeEvent = eventDays.find(d => d.id === activeTab)!;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. 中英文姓名檢查
    const nameRegex = /^[a-zA-Z\u4e00-\u9fa5\s]+$/;
    if (!name.trim()) {
      alert("請輸入姓名！");
      return;
    }
    if (!nameRegex.test(name)) {
      alert("姓名格式錯誤：只能輸入「中文」或「英文」，不可以使用特殊符號喔！");
      return;
    }

    const finalPeople = Number(peopleCount) || 1;
    const finalPaddle = Number(paddleCount) || 0;

    // 2. 計算剩餘名額與分流邏輯
    const dayParticipants = participants.filter(p => p.day_id === activeTab);
    const confirmedTotal = dayParticipants
      .filter(p => p.status === 'confirmed')
      .reduce((sum, p) => sum + p.people_count, 0);

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
      setName('');
      setPeopleCount(1);
      setPaddleCount(0);
    } else if (error) {
      alert("報名失敗：" + error.message);
    }
  };

  const currentDayParticipants = participants.filter(p => p.day_id === activeTab);
  const confirmedList = currentDayParticipants.filter(p => p.status === 'confirmed');
  const waitlistList = currentDayParticipants.filter(p => p.status === 'waitlist');
  const totalConfirmed = confirmedList.reduce((sum, p) => sum + p.people_count, 0);

  return (
    <main className="min-h-screen bg-gray-100 p-8 font-sans">
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-md p-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center">🏓 七賢國小匹克球交流團</h1>
        
        <div className="flex gap-2 mb-6 border-b pb-2 overflow-x-auto">
          {eventDays.map((day) => (
            <button
              key={day.id}
              onClick={() => setActiveTab(day.id)}
              className={`px-4 py-2 rounded-t-lg font-medium whitespace-nowrap ${activeTab === day.id ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
            >
              {day.label}
            </button>
          ))}
        </div>

        <div className="bg-blue-50 p-4 rounded-lg mb-6 text-gray-700 space-y-1">
          <p>🕒 {activeEvent.label} {activeEvent.time}</p>
          <p>📍 {activeEvent.location}</p>
          <p>💰 費用：{activeEvent.fee} / 人 (球拍借用 +50)</p>
          <p>👥 剩餘名額：<span className="text-red-600 font-bold">{Math.max(0, activeEvent.maxPlayers - totalConfirmed)} 人</span></p>
        </div>

        <form onSubmit={handleRegister} className="mb-8 space-y-4 bg-gray-50 p-4 rounded-lg border">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="請輸入姓名 (中英文)"
            className="w-full border rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-sm text-gray-600">報名人數</label>
              <input
                type="number"
                min="1"
                value={peopleCount === '' ? '' : peopleCount}
                onChange={(e) => setPeopleCount(e.target.value === '' ? '' : parseInt(e.target.value))}
                className="w-full border rounded-lg px-4 py-2 outline-none"
              />
            </div>
            <div className="flex-1">
              <label className="text-sm text-gray-600">租借球拍</label>
              <input
                type="number"
                min="0"
                value={paddleCount === '' ? '' : paddleCount}
                onChange={(e) => setPaddleCount(e.target.value === '' ? '' : parseInt(e.target.value))}
                className="w-full border rounded-lg px-4 py-2 outline-none"
              />
            </div>
          </div>
          <button type="submit" className="w-full bg-blue-600 text-white font-bold py-2 rounded-lg hover:bg-blue-700 transition">
            送出報名
          </button>
        </form>

        {isLoading ? (
          <div className="text-center py-10 text-gray-500">讀取中...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h2 className="font-bold text-green-600 border-b-2 border-green-200 mb-3">✅ 報名成功 ({totalConfirmed}/{activeEvent.maxPlayers})</h2>
              <ul className="space-y-1">
                {confirmedList.map((p, i) => (
                  <li key={p.id} className="text-sm bg-green-50 p-2 rounded flex justify-between">
                    <span>{i+1}. {p.name} ({p.people_count}人)</span>
                    {p.paddle_count > 0 && <span className="text-xs bg-orange-100 px-1 rounded">拍x{p.paddle_count}</span>}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="font-bold text-orange-500 border-b-2 border-orange-200 mb-3">⏳ 候補名單</h2>
              <ul className="space-y-1">
                {waitlistList.map((p, i) => (
                  <li key={p.id} className="text-sm bg-orange-50 p-2 rounded flex justify-between">
                    <span>{i+1}. {p.name} ({p.people_count}人)</span>
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