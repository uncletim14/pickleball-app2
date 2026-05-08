'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type Participant = {
  id: number;
  name: string;
  category: string;
  day_key: string;
  edit_code: string;
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
  const [formData, setFormData] = useState({ name: '', edit_code: '' });
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
    setIsLoading(true);
    const { data, error } = await supabase.from('tournament_participants').select('*').order('id', { ascending: true });
    if (!error && data) setParticipants(data);
    setIsLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.edit_code.length !== 4) { alert("請設定 4 位數取消密碼"); return; }
    const isDuplicate = participants.some(p => p.name.trim() === formData.name.trim() && p.category === activeTab && p.day_key === selectedDay.key);
    if (isDuplicate) { alert(`「${formData.name}」已經在名單中囉！`); return; }
    const categoryList = participants.filter(p => p.category === activeTab && p.day_key === selectedDay.key);
    const currentMax = categories.find(c => c.label === activeTab)?.max || 16;
    if (categoryList.length >= currentMax) { if (!window.confirm(`正取已滿，報名後將列為「備取第 ${categoryList.length - currentMax + 1} 位」，確定嗎？`)) return; }
    const { error } = await supabase.from('tournament_participants').insert([{ name: formData.name.trim(), category: activeTab, day_key: selectedDay.key, edit_code: formData.edit_code }]);
    if (!error) { alert("報名成功！"); setFormData({ name: '', edit_code: '' }); fetchParticipants(); }
  };

  const handleCancel = async (p: Participant) => {
    const code = window.prompt("輸入 4 碼密碼取消報名：");
    if (code === p.edit_code) { if (window.confirm("確定取消報名嗎？")) { await supabase.from('tournament_participants').delete().eq('id', p.id); fetchParticipants(); } }
    else if (code !== null) { alert("密碼錯誤！"); }
  };

  const currentList = participants.filter(p => p.category === activeTab && p.day_key === selectedDay.key);
  const currentMax = categories.find(c => c.label === activeTab)?.max || 16;

  return (
    <main className="min-h-screen bg-slate-900 p-4 md:p-8 text-slate-100 font-sans tracking-tight">
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-10">
          <h1 className="text-4xl md:text-5xl font-black text-emerald-400 mb-3 italic tracking-widest uppercase">
            七賢國小匹克交流團
          </h1>
          <p className="text-slate-500 text-sm mb-6 font-bold">每週六 18:00 自動更新下週日期</p>
          <div className="flex justify-center gap-3 flex-wrap">
            {dayOptions.map(d => (
              <button key={d.key} onClick={() => setSelectedDay(d)} className={`px-5 py-3 rounded-2xl font-bold transition-all ${selectedDay.key === d.key ? 'bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.4)]' : 'bg-slate-800 text-slate-500 hover:text-slate-300'}`}>
                {d.label}
              </button>
            ))}
          </div>
        </header>

        {/* 🌟 核心按鈕：字體放大兩倍，整體高度與寬度也同步提升 🌟 */}
        <div className="flex gap-4 mb-12">
          {categories.map(cat => (
            <button 
              key={cat.id} 
              onClick={() => setActiveTab(cat.label)} 
              className={`flex-1 py-10 px-4 rounded-[2rem] transition-all border-4 flex flex-col items-center justify-center ${activeTab === cat.label ? 'bg-slate-800 border-emerald-500 text-emerald-400 shadow-[0_0_40px_rgba(16,185,129,0.3)]' : 'bg-slate-900 border-slate-800 text-slate-700'}`}
            >
              <span className="text-5xl font-black mb-3">{cat.label}</span>
              <span className="text-2xl font-black opacity-90 mb-2">({cat.max}人)</span>
              <span className="text-sm font-black uppercase tracking-[0.3em]">{cat.subLabel}</span>
            </button>
          ))}
        </div>

        <div className="grid md:grid-cols-5 gap-8">
          <form onSubmit={handleRegister} className="md:col-span-2 bg-slate-800 p-8 rounded-[2.5rem] h-fit space-y-5 border border-slate-700 shadow-2xl">
            <h2 className="font-bold text-2xl text-white mb-2">選手報名</h2>
            <div>
              <label className="text-xs text-slate-500 ml-1">您的姓名 Name</label>
              <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="請輸入姓名" className="w-full bg-slate-900 p-5 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/50 border border-slate-700 text-xl text-white" />
            </div>
            <div>
              <label className="text-xs text-slate-500 ml-1">4 碼密碼 Pwd (取消用)</label>
              <input type="password" maxLength={4} required value={formData.edit_code} onChange={e => setFormData({...formData, edit_code: e.target.value})} placeholder="設定密碼" className="w-full bg-slate-900 p-5 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/50 border border-slate-700 text-xl text-white" />
            </div>
            <button className="w-full bg-emerald-500 py-5 rounded-2xl font-black text-2xl hover:bg-emerald-400 transition-all shadow-xl active:scale-95 text-white">確認送出</button>
          </form>

          <div className="md:col-span-3">
            <div className="flex justify-between items-center mb-6 px-2">
              <h2 className="font-bold text-2xl">目前清單</h2>
              <span className="bg-slate-800 px-4 py-2 rounded-full text-sm text-slate-400">剩餘正取：{Math.max(0, currentMax - currentList.length)}</span>
            </div>

            <div className="space-y-3">
              {currentList.map((p, i) => (
                <div key={p.id} className="bg-slate-800/40 p-5 rounded-3xl flex justify-between items-center border border-slate-800 hover:border-slate-600 transition-all">
                  <div className="flex items-center gap-4">
                    <span className={`text-xs font-black px-3 py-1 rounded-full ${i >= currentMax ? 'bg-orange-500/10 text-orange-500' : 'bg-emerald-500/10 text-emerald-400'}`}>
                      {i >= currentMax ? `備取 Waiting ${i - currentMax + 1}` : `正取 No. ${i + 1}`}
                    </span>
                    <span className="font-bold text-xl">{p.name}</span>
                  </div>
                  <button onClick={() => handleCancel(p)} className="text-sm text-slate-600 hover:text-red-400 px-3 py-1 transition-colors">取消</button>
                </div>
              ))}
              {currentList.length === 0 && <div className="text-center py-20 text-slate-600 italic font-bold text-xl">目前尚無報名資料</div>}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}