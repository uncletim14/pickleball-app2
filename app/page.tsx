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
      return [{ id: 'sanda', label: '散打區', subLabel: 'Open Play', max: 24 }];
    }
    return [
      { id: 'sanda', label: '散打區', subLabel: 'Open Play', max: 16 },
      { id: 'newbie', label: '新手區', subLabel: 'Beginner Friendly', max: 8 },
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
    const code = window.prompt("輸入 4 碼密碼取消：");
    if (code === p.edit_code) { if (window.confirm("確定取消？")) { await supabase.from('tournament_participants').delete().eq('id', p.id); fetchParticipants(); } }
    else if (code !== null) { alert("密碼錯誤！"); }
  };

  const currentList = participants.filter(p => p.category === activeTab && p.day_key === selectedDay.key);
  const currentMax = categories.find(c => c.label === activeTab)?.max || 16;

  return (
    <main className="min-h-screen bg-slate-900 p-4 md:p-8 text-slate-100 font-sans tracking-tight">
      <div className="max-w-3xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-black text-emerald-400 mb-2 italic tracking-widest uppercase">
            七賢國小匹克交流團
          </h1>
          <p className="text-slate-500 text-sm mb-4 italic font-bold">每週六 18:00 自動更新下週日期</p>
          <div className="flex justify-center gap-2 flex-wrap">
            {dayOptions.map(d => (
              <button key={d.key} onClick={() => setSelectedDay(d)} className={`px-4 py-2 rounded-xl font-bold transition-all ${selectedDay.key === d.key ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-slate-800 text-slate-500 hover:text-slate-300'}`}>
                {d.label}
              </button>
            ))}
          </div>
        </header>

        {/* 🌟 這裡已將字體放大為 text-2xl 並加厚字體 */}
        <div className="flex gap-3 mb-8">
          {categories.map(cat => (
            <button 
              key={cat.id} 
              onClick={() => setActiveTab(cat.label)} 
              className={`flex-1 py-6 px-2 rounded-2xl transition-all border-2 flex flex-col items-center justify-center ${activeTab === cat.label ? 'bg-slate-800 border-emerald-500 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]' : 'bg-slate-900 border-slate-800 text-slate-600'}`}
            >
              <span className="text-2xl font-black mb-1">{cat.label}</span>
              <span className="text-sm font-bold opacity-70 mb-1">({cat.max}人)</span>
              <span className="text-[11px] font-bold uppercase tracking-[0.2em]">{cat.subLabel}</span>
            </button>
          ))}
        </div>

        <div className="grid md:grid-cols-5 gap-6">
          <form onSubmit={handleRegister} className="md:col-span-2 bg-slate-800 p-6 rounded-3xl h-fit space-y-4 border border-slate-700 shadow-2xl">
            <h2 className="font-bold text-xl text-white mb-2">選手報名</h2>
            <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="您的姓名 Name" className="w-full bg-slate-900 p-4 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 border border-slate-700 text-white" />
            <input type="password" maxLength={4} required value={formData.edit_code} onChange={e => setFormData({...formData, edit_code: e.target.value})} placeholder="4 碼取消密碼 Pwd" className="w-full bg-slate-900 p-4 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 border border-slate-700 text-white" />
            <button className="w-full bg-emerald-500 py-4 rounded-xl font-black text-xl hover:bg-emerald-400 transition-all shadow-lg text-white">確認送出</button>
          </form>

          <div className="md:col-span-3">
            <div className="flex justify-between items-center mb-4 px-2">
              <h2 className="font-bold text-xl">目前清單</h2>
              <span className="bg-slate-800 px-3 py-1 rounded-full text-xs text-slate-400">剩餘正取：{Math.max(0, currentMax - currentList.length)}</span>
            </div>

            <div className="space-y-2">
              {currentList.map((p, i) => (
                <div key={p.id} className="bg-slate-800/40 p-4 rounded-2xl flex justify-between items-center border border-slate-800">
                  <div className="flex items-center gap-3">
                    <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${i >= currentMax ? 'bg-orange-500/10 text-orange-500' : 'bg-emerald-500/10 text-emerald-400'}`}>
                      {i >= currentMax ? `備取 Waiting ${i - currentMax + 1}` : `No. ${i + 1}`}
                    </span>
                    <span className="font-bold text-lg">{p.name}</span>
                  </div>
                  <button onClick={() => handleCancel(p)} className="text-xs text-slate-600 hover:text-red-400 px-2 py-1 transition-colors">取消</button>
                </div>
              ))}
              {currentList.length === 0 && <div className="text-center py-16 text-slate-600 italic font-bold">目前尚無報名資料</div>}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}