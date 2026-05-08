'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import Image from 'next/image';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type Participant = {
  id: number;
  name: string;
  category: string;
  day_key: string;
  edit_code: string;
  count: number; // 新增：記錄該筆報名的人數
};

export default function QiXianPickleball() {
  const getUpcomingDates = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const startOffset = (dayOfWeek === 6 && now.getHours() >= 18) || dayOfWeek === 0 ? 7 : 0;
    
    const getTargetDate = (targetDay: number) => {
      const d = new Date();
      d.setDate(now.getDate() - dayOfWeek + targetDay + startOffset);
      return d;
    };

    const mon = getTargetDate(1);
    const thu = getTargetDate(4);
    const fri = getTargetDate(5);

    const format = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
    const formatKey = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

    return [
      { label: `週一 (${format(mon)})`, key: formatKey(mon), type: 'normal' },
      { label: `週四 (${format(thu)})`, key: formatKey(thu), type: 'thu_special' },
      { label: `週五 (${format(fri)})`, key: formatKey(fri), type: 'normal' },
    ];
  };

  const dayOptions = getUpcomingDates();
  const [selectedDay, setSelectedDay] = useState(dayOptions[0]);

  const getCategories = (dayType: string) => {
    if (dayType === 'thu_special') {
      return [{ id: 'sanda', label: '散打區', subLabel: 'OPEN PLAY', max: 24 }];
    }
    return [
      { id: 'sanda', label: '散打區', subLabel: 'OPEN PLAY', max: 16 },
      { id: 'newbie', label: '新手區', subLabel: 'BEGINNER FRIENDLY', max: 8 },
    ];
  };

  const categories = getCategories(selectedDay.type);
  const [activeTab, setActiveTab] = useState(categories[0].label);
  const [formData, setFormData] = useState({ name: '', edit_code: '', count: '1' });
  const [participants, setParticipants] = useState<Participant[]>([]);

  useEffect(() => {
    document.title = "七賢國小匹克交流團報名系統";
    fetchParticipants();
  }, []);

  useEffect(() => {
    if (!categories.find(c => c.label === activeTab)) {
      setActiveTab(categories[0].label);
    }
  }, [selectedDay]);

  const fetchParticipants = async () => {
    const { data, error } = await supabase.from('tournament_participants').select('*').order('id', { ascending: true });
    if (!error && data) setParticipants(data);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const regCount = parseInt(formData.count);
    if (formData.edit_code.length !== 4) { alert("請設定 4 位數取消密碼"); return; }
    
    // 計算該類別目前總人數（加總每一筆的 count）
    const categoryList = participants.filter(p => p.category === activeTab && p.day_key === selectedDay.key);
    const totalFilled = categoryList.reduce((sum, p) => sum + (p.count || 1), 0);
    const currentMax = categories.find(c => c.label === activeTab)?.max || 16;

    if (totalFilled >= currentMax) {
      if (!window.confirm(`正取已滿，此筆報名 (${regCount}位) 將全部列為備取，確定嗎？`)) return;
    }

    const { error } = await supabase.from('tournament_participants').insert([{
      name: formData.name.trim(),
      category: activeTab,
      day_key: selectedDay.key,
      edit_code: formData.edit_code,
      count: regCount
    }]);

    if (!error) {
      alert(`報名成功！已登記 ${regCount} 位。`);
      setFormData({ name: '', edit_code: '', count: '1' });
      fetchParticipants();
    }
  };

  const handleCancel = async (p: Participant) => {
    const code = window.prompt("輸入 4 碼密碼取消：");
    if (code === p.edit_code) {
      if (window.confirm(`確定要取消「${p.name}」共 ${p.count} 位的報名嗎？`)) {
        await supabase.from('tournament_participants').delete().eq('id', p.id);
        fetchParticipants();
      }
    } else if (code !== null) { alert("密碼錯誤！"); }
  };

  // 計算邏輯
  const currentList = participants.filter(p => p.category === activeTab && p.day_key === selectedDay.key);
  const currentMax = categories.find(c => c.label === activeTab)?.max || 16;
  
  // 計算目前累積人數（用來判斷正備取）
  let runningTotal = 0;

  return (
    <main className="min-h-screen bg-slate-900 p-4 md:p-8 text-slate-100 font-sans tracking-tight">
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-8">
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 mb-4">
            <Image src="/七賢LOGO.png" alt="LOGO" width={80} height={80} className="rounded-full shadow-lg" />
            <h1 className="text-4xl md:text-5xl font-black text-emerald-400 italic tracking-widest uppercase">七賢國小匹克交流團</h1>
          </div>
          
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 mb-6 inline-block">
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-emerald-400 font-bold">
              <span>🕒 時間：19:00 - 21:20</span>
              <span>💰 費用：$100 / 人</span>
              <span>🏸 租借球拍：$50 / 支</span>
              <span className="text-orange-400">⚠️ 一人最多報 4 位</span>
            </div>
          </div>

          <div className="flex justify-center gap-3 flex-wrap">
            {dayOptions.map(d => (
              <button key={d.key} onClick={() => setSelectedDay(d)} className={`px-5 py-3 rounded-2xl font-bold transition-all ${selectedDay.key === d.key ? 'bg-emerald-500 text-white shadow-lg' : 'bg-slate-800 text-slate-500'}`}>
                {d.label}
              </button>
            ))}
          </div>
        </header>

        <div className="flex gap-4 mb-10">
          {categories.map(cat => (
            <button key={cat.id} onClick={() => setActiveTab(cat.label)} className={`flex-1 py-10 px-4 rounded-[2rem] transition-all border-4 flex flex-col items-center justify-center ${activeTab === cat.label ? 'bg-slate-800 border-emerald-500 text-emerald-400 shadow-xl' : 'bg-slate-900 border-slate-800 text-slate-700'}`}>
              <span className="text-5xl font-black mb-3">{cat.label}</span>
              <span className="text-2xl font-black opacity-90">({cat.max}人)</span>
              <span className="text-sm font-black uppercase tracking-widest mt-2">{cat.subLabel}</span>
            </button>
          ))}
        </div>

        <div className="grid md:grid-cols-5 gap-8">
          <form onSubmit={handleRegister} className="md:col-span-2 bg-slate-800 p-8 rounded-[2.5rem] space-y-5 border border-slate-700 shadow-2xl">
            <h2 className="font-bold text-2xl text-white">選手報名</h2>
            
            <div>
              <label className="text-xs text-slate-500 ml-1">報名人數 Number of Players</label>
              <select 
                value={formData.count} 
                onChange={e => setFormData({...formData, count: e.target.value})}
                className="w-full bg-slate-900 p-5 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/50 border border-slate-700 text-xl text-white appearance-none"
              >
                <option value="1">1 位</option>
                <option value="2">2 位</option>
                <option value="3">3 位</option>
                <option value="4">4 位</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-500 ml-1">代表姓名 Name</label>
              <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="請輸入姓名" className="w-full bg-slate-900 p-5 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/50 border border-slate-700 text-xl text-white" />
            </div>
            
            <div>
              <label className="text-xs text-slate-500 ml-1">4 碼密碼 (取消用)</label>
              <input type="password" maxLength={4} required value={formData.edit_code} onChange={e => setFormData({...formData, edit_code: e.target.value})} placeholder="設定密碼" className="w-full bg-slate-900 p-5 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/50 border border-slate-700 text-xl text-white" />
            </div>
            
            <button className="w-full bg-emerald-500 py-5 rounded-2xl font-black text-2xl hover:bg-emerald-400 transition-all text-white">確認送出</button>
          </form>

          <div className="md:col-span-3">
            <div className="flex justify-between items-center mb-6 px-2">
              <h2 className="font-bold text-2xl">目前清單</h2>
              {/* 計算總人數 */}
              <span className="bg-slate-800 px-4 py-2 rounded-full text-sm text-slate-400">
                目前總計：{currentList.reduce((sum, p) => sum + (p.count || 1), 0)} / {currentMax} 人
              </span>
            </div>

            <div className="space-y-3">
              {currentList.map((p) => {
                const pCount = p.count || 1;
                const isWaitlist = runningTotal >= currentMax;
                runningTotal += pCount;
                
                return (
                  <div key={p.id} className="bg-slate-800/40 p-5 rounded-3xl flex justify-between items-center border border-slate-800">
                    <div className="flex items-center gap-4">
                      <span className={`text-xs font-black px-3 py-1 rounded-full ${isWaitlist ? 'bg-orange-500/10 text-orange-500' : 'bg-emerald-500/10 text-emerald-400'}`}>
                        {isWaitlist ? '備取 Waiting' : '正取 No.'}
                      </span>
                      <div className="flex flex-col">
                        <span className="font-bold text-xl">{p.name}</span>
                        <span className="text-sm text-slate-500 font-bold">共 {pCount} 位</span>
                      </div>
                    </div>
                    <button onClick={() => handleCancel(p)} className="text-sm text-slate-600 hover:text-red-400 px-3 py-1">取消</button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}