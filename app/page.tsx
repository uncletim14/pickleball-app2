'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type Participant = {
  id?: number;
  name: string;
  status: 'confirmed' | 'waitlist';
  day_id: string;
  people_count: number; // 新增：報名人數
  paddle_count: number; // 新增：球拍數量
};

export default function PickleballRegistration() {
  // 已經幫您把金額 fee 改成 100 元了！
  const eventDays = [
    { id: 'tue', label: '星期二', time: '19:00 - 21:00', location: '七賢國小', maxPlayers: 10, fee: 100 },
    { id: 'thu', label: '星期四', time: '19:00 - 21:00', location: '七賢國小', maxPlayers: 16, fee: 100 },
    { id: 'fri', label: '星期五', time: '19:00 - 21:00', location: '七賢國小', maxPlayers: 24, fee: 100 },
  ];

  const [activeTab, setActiveTab] = useState(eventDays[0].id);
  const [name, setName] = useState('');
  const [peopleCount, setPeopleCount] = useState(1); // 預設 1 人
  const [paddleCount, setPaddleCount] = useState(0); // 預設 0 支球拍
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

    if (error) {
      alert('資料庫連線錯誤：' + error.message);
    } else if (data) {
      setParticipants(data);
    }
    setIsLoading(false);
  };

  const activeEvent = eventDays.find(d => d.id === activeTab)!;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || peopleCount < 1) return;

    // 計算目前「已經報名成功的總人數」(把每個人的 people_count 加起來)
    const dayParticipants = participants.filter(p => p.day_id === activeTab);
    const confirmedTotalPeople = dayParticipants
      .filter(p => p.status === 'confirmed')
      .reduce((sum, p) => sum + p.people_count, 0);

    // 如果 已經成功的人數 + 這次想報名的人數 超過上限，就整組轉候補
    const status = (confirmedTotalPeople + peopleCount) <= activeEvent.maxPlayers ? 'confirmed' : 'waitlist';

    // 寫入資料庫
    const { data, error } = await supabase
      .from('participants')
      .insert([{ 
        name: name, 
        status: status, 
        day_id: activeTab,
        people_count: peopleCount,
        paddle_count: paddleCount
      }])
      .select();

    if (error) {
      alert('報名失敗：' + error.message);
      return;
    }

    if (data) {
      setParticipants([...participants, data[0]]);
      setName('');
      setPeopleCount(1); // 報名成功後重置回 1 人
      setPaddleCount(0); // 報名成功後重置回 0 支
    }
  };

  const currentDayParticipants = participants.filter(p => p.day_id === activeTab);
  const confirmedList = currentDayParticipants.filter(p => p.status === 'confirmed');
  const waitlistList = currentDayParticipants.filter(p => p.status === 'waitlist');
  
  // 計算目前成功總人數（顯示在畫面上）
  const currentConfirmedCount = confirmedList.reduce((sum, p) => sum + p.people_count, 0);

  // 動態計算應繳總金額
  const totalFee = (activeEvent.fee * peopleCount) + (50 * paddleCount);

  return (
    <main className="min-h-screen bg-gray-100 p-8 font-sans">
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-md overflow-hidden p-6">
        
        <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center">🏓 七賢國小匹克球交流團</h1>

        {/* 選擇天數 */}
        <div className="flex gap-2 mb-6 border-b border-gray-200 pb-2">
          {eventDays.map((day) => (
            <button
              key={day.id}
              onClick={() => setActiveTab(day.id)}
              className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${
                activeTab === day.id ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
              }`}
            >
              {day.label}
            </button>
          ))}
        </div>

        {/* 活動資訊 */}
        <div className="bg-blue-50 p-4 rounded-lg mb-6 text-gray-700 space-y-2">
          <p><strong>🕒 時間：</strong> {activeEvent.label} {activeEvent.time}</p>
          <p><strong>📍 地點：</strong> {activeEvent.location}</p>
          <p><strong>💰 場地費：</strong> NT$ {activeEvent.fee} / 人</p>
          <p><strong>🏸 租借球拍：</strong> NT$ 50 / 支</p>
          <p><strong>👥 剩餘名額：</strong> <span className="text-red-600 font-bold">{Math.max(0, activeEvent.maxPlayers - currentConfirmedCount)} 人</span> (超過上限自動轉候補)</p>
        </div>

        {/* 報名表單 */}
        <form onSubmit={handleRegister} className="mb-8 bg-gray-50 p-4 rounded-lg border border-gray-200">
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">代表姓名或暱稱</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="請輸入姓名"
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                required
              />
            </div>
            
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">報名人數</label>
                <input
                  type="number"
                  min="1"
                  value={peopleCount}
                  onChange={(e) => setPeopleCount(parseInt(e.target.value) || 1)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">租借球拍數量</label>
                <input
                  type="number"
                  min="0"
                  value={paddleCount}
                  onChange={(e) => setPaddleCount(parseInt(e.target.value) || 0)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <div className="flex justify-between items-center mt-2 pt-4 border-t border-gray-200">
              <div className="text-lg font-bold text-gray-800">
                應繳總額：<span className="text-blue-600">NT$ {totalFee}</span>
              </div>
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition-colors"
              >
                送出報名
              </button>
            </div>
          </div>
        </form>

        {/* 名單顯示區域 */}
        {isLoading ? (
          <div className="text-center text-gray-500 py-8">資料同步中，請稍候...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 正取名單 */}
            <div>
              <h2 className="text-xl font-semibold text-green-600 border-b-2 border-green-200 pb-2 mb-3">
                ✅ 報名成功 ({currentConfirmedCount}/{activeEvent.maxPlayers})
              </h2>
              {confirmedList.length === 0 ? (
                <p className="text-gray-400 text-sm">目前尚無人報名</p>
              ) : (
                <ul className="space-y-2">
                  {confirmedList.map((p, index) => (
                    <li key={p.id} className="bg-green-50 px-3 py-2 rounded border border-green-100 text-gray-700 flex justify-between items-center">
                      <span>{index + 1}. {p.name} <span className="text-sm font-bold text-blue-600">({p.people_count}人)</span></span>
                      {p.paddle_count > 0 && (
                        <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full">
                          借拍 x {p.paddle_count}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* 候補名單 */}
            <div>
              <h2 className="text-xl font-semibold text-orange-500 border-b-2 border-orange-200 pb-2 mb-3">
                ⏳ 候補名單
              </h2>
              {waitlistList.length === 0 ? (
                <p className="text-gray-400 text-sm">目前無人候補</p>
              ) : (
                <ul className="space-y-2">
                  {waitlistList.map((p, index) => (
                    <li key={p.id} className="bg-orange-50 px-3 py-2 rounded border border-orange-100 text-gray-700 flex justify-between items-center">
                      <span>候補 {index + 1}. {p.name} <span className="text-sm font-bold text-blue-600">({p.people_count}人)</span></span>
                      {p.paddle_count > 0 && (
                        <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full">
                          借拍 x {p.paddle_count}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}