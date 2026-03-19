'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);


type Participant = {
  id: number;          // 
  name: string;
  status: 'confirmed' | 'waitlist';
  day_id: string;
  people_count: number; // 
  paddle_count: number;
};

export default function PickleballRegistration() {
  const eventDays = [
    { id: 'tue', label: '星期二', time: '19:00 - 21:00', location: '七賢國小', maxPlayers: 10, fee: 100 },
    { id: 'thu', label: '星期四', time: '19:00 - 21:00', location: '七賢國小', maxPlayers: 16, fee: 100 },
    { id: 'fri', label: '星期五', time: '19:00 - 21:00', location: '七賢國小', maxPlayers: 24, fee: 100 },
  ];

  const [activeTab, setActiveTab] = useState(eventDays[0].id);
  const [name, setName] = useState('');
  // 修正：允許狀態暫時是空的字串，解決輸入「12」的問題
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
    
    // 如果使用者把格子清空，預設幫他算 1 人 / 0 拍
    const finalPeopleCount = Number(peopleCount) || 1;
    const finalPaddleCount = Number(paddleCount) || 0;

    if (!name.trim() || finalPeopleCount < 1) return;

    // 計算目前正取人數與剩餘名額
    const dayParticipants = participants.filter(p => p.day_id === activeTab);
    const confirmedTotalPeople = dayParticipants
      .filter(p => p.status === 'confirmed')
      .reduce((sum, p) => sum + p.people_count, 0);

    const availableSpots = Math.max(0, activeEvent.maxPlayers - confirmedTotalPeople);

    // 準備要寫入資料庫的資料 (可能是一筆，也可能是被切成兩半的兩筆)
    let insertData = [];

    if (availableSpots === 0) {
      // 情況一：名額已滿，全部轉候補
      insertData.push({
        name: name,
        status: 'waitlist',
        day_id: activeTab,
        people_count: finalPeopleCount,
        paddle_count: finalPaddleCount
      });
    } else if (finalPeopleCount <= availableSpots) {
      // 情況二：名額足夠，全部正取
      insertData.push({
        name: name,
        status: 'confirmed',
        day_id: activeTab,
        people_count: finalPeopleCount,
        paddle_count: finalPaddleCount
      });
    } else {
      // 情況三：名額不夠，需要把人切成兩半！(部分正取，部分候補)
      const waitlistCount = finalPeopleCount - availableSpots;
      
      insertData.push({
        name: name + ' (部分正取)',
        status: 'confirmed',
        day_id: activeTab,
        people_count: availableSpots,
        paddle_count: finalPaddleCount // 球拍全部掛在正取這筆
      });
      
      insertData.push({
        name: name + ' (部分候補)',
        status: 'waitlist',
        day_id: activeTab,
        people_count: waitlistCount,
        paddle_count: 0 // 候補的這筆就不重複算球拍了
      });
    }

    // 寫入資料庫
    const { data, error } = await supabase
      .from('participants')
      .insert(insertData) // 可以一次塞入多筆資料！
      .select();

    if (error) {
      alert('報名失敗：' + error.message);
      return;
    }

    if (data) {
      setParticipants([...participants, ...data]);
      setName('');
      setPeopleCount(1);
      setPaddleCount(0);
    }
  };

  const currentDayParticipants = participants.filter(p => p.day_id === activeTab);
  const confirmedList = currentDayParticipants.filter(p => p.status === 'confirmed');
  const waitlistList = currentDayParticipants.filter(p => p.status === 'waitlist');
  
  const currentConfirmedCount = confirmedList.reduce((sum, p) => sum + p.people_count, 0);
  
  // 動態計算應繳總金額 (防呆：如果格子空著就當作 1 人 0 拍來算錢)
  const displayPeople = Number(peopleCount) || 1;
  const displayPaddle = Number(paddleCount) || 0;
  const totalFee = (activeEvent.fee * displayPeople) + (50 * displayPaddle);

  return (
    <main className="min-h-screen bg-gray-100 p-8 font-sans">
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-md overflow-hidden p-6">
        
        <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center">🏓 七賢國小匹克球交流團</h1>

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

        <div className="bg-blue-50 p-4 rounded-lg mb-6 text-gray-700 space-y-2">
          <p><strong>🕒 時間：</strong> {activeEvent.label} {activeEvent.time}</p>
          <p><strong>📍 地點：</strong> {activeEvent.location}</p>
          <p><strong>💰 場地費：</strong> NT$ {activeEvent.fee} / 人</p>
          <p><strong>🏸 租借球拍：</strong> NT$ 50 / 支</p>
          <p><strong>👥 剩餘名額：</strong> <span className="text-red-600 font-bold">{Math.max(0, activeEvent.maxPlayers - currentConfirmedCount)} 人</span></p>
        </div>

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
                  value={peopleCount === '' ? '' : peopleCount}
                  onChange={(e) => setPeopleCount(e.target.value === '' ? '' : parseInt(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="1"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">租借球拍數量</label>
                <input
                  type="number"
                  min="0"
                  value={paddleCount === '' ? '' : paddleCount}
                  onChange={(e) => setPaddleCount(e.target.value === '' ? '' : parseInt(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="0"
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

        {isLoading ? (
          <div className="text-center text-gray-500 py-8">資料同步中，請稍候...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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