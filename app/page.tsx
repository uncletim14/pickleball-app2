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
  day_key: string; // 用來存具體日期，例如 2024-05-13
  edit_code: string;
};

export default function QiXianSanda() {
  // --- 📅 自動日期計算邏輯 ---
  const getUpcomingDates = () => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0是週日, 6是週六
    
    // 如果今天是週六(6)或週日(0)，就顯示下週的日期
    const startOffset = (dayOfWeek === 6 || dayOfWeek === 0) ? 7 : 0;
    
    const getTargetDate = (targetDay: number) => {
      const d = new Date();
      // 先回到這週日，再加天數
      d.setDate(now.getDate() - dayOfWeek + targetDay + startOffset);
      return d;
    };

    const mon = getTargetDate(1);
    const thu = getTargetDate(4);
    const fri = getTargetDate(5);

    const format = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
    const formatKey = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

    return [
      { label: `週一 (${format(mon)})`, key: formatKey(mon) },
      { label: `週四 (${format(thu)})`, key: formatKey(thu) },
      { label: `週五 (${format(fri)})`, key: formatKey(fri) },
    ];
  };

  const dayOptions = getUpcomingDates();
  const [selectedDay, setSelectedDay] = useState(dayOptions[0]);

  // 固定組別
  const categories = [
    { id: 'sanda', label: '散打區', max: 16 },
    { id: 'newbie', label: '新手區', max: 8 },
  ];

  const [activeTab, setActiveTab] = useState(categories[0].label);
  const [formData, setFormData] = useState({ name: '', edit_code: '' });
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    document.title = "七賢匹克球團報名系統";
    fetchParticipants();
  }, []);

  const fetchParticipants = async () => {
    setIsLoading(true);
    const { data, error } = await supabase.from('tournament_participants').select('*').order('id', { ascending: true });
    if (!error && data) setParticipants(data);
    setIsLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.edit_code.length !== 4) { alert("請設定 4 位數取消密碼"); return; }

    const isDuplicate = participants.some(p => 
      p.name.trim() === formData.name.trim() && p.category === activeTab && p.day_key === selectedDay.key
    );
    if (isDuplicate) { alert(`「${formData.name}」已經在名單中囉！`); return; }

    const categoryList = participants.filter(p => p.category === activeTab && p.day_key === selectedDay.key);
    const currentMax = categories.find(c => c.label === activeTab)?.max || 16;

    if (categoryList.length >= currentMax) {
      if (!window.confirm(`正取已滿，報名後列為「備取第 ${categoryList.length - currentMax + 1} 位」，確定嗎？`)) return;
    }

    const { error } = await supabase.from('tournament_participants').insert([{
      name: formData.name.trim(),
      category: activeTab,
      day_key: selectedDay.key, // 存入具體日期 key
      edit_code: formData.edit_code
    }]);

    if (!error) {
      alert("報名成功！");
      setFormData({ name: '', edit_code: '' });
      fetchParticipants();
    } else {
      alert("報名失敗：" + error.message);
    }
  };

  const handleCancel = async (p: Participant) => {
    const code = window.prompt("輸入 4 碼密碼取消：");
    if (code === p.edit_code) {
      if (window.confirm("確定取消？")) {
        await supabase.from('tournament_participants').delete().eq('id', p.id);
        fetchParticipants();
      }
    } else if (code !== null) { alert("密碼錯誤！"); }
  };

  const currentList = participants.filter(p => p.category === activeTab && p.day_key === selectedDay.key);
  const currentMax = categories.find(c => c.label === activeTab)?.max || 16;

  return (
    <main className="min-h-screen bg-slate-900 p-4 md:p-8 text-slate-100">
      <div className="max-w-3xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-3xl font-black text-emerald-400 mb-2">七賢匹克球團 報名系統</h1>
          <p className="text-slate-500 text-sm mb-4">每週六自動更新日期</p>
          <div className="flex justify-center gap-2 mt-4 flex-wrap">
            {dayOptions.map(d => (
              <button key={d.key} onClick={() => setSelectedDay(d)} className={`px-4 py-2 rounded-lg font-bold transition-all ${selectedDay.key === d.key ? 'bg-white text-slate-900 shadow-lg' : 'bg-slate-800 text-slate-500'}`}>
                {d.label}
              </button>
            ))}
          </div>
        </header>

        <div className="flex gap-2 mb-6">
          {categories.map(cat => (
            <button key={cat.id} onClick={() => setActiveTab(cat.label)} className={`flex-1 py-3 rounded-xl font-bold transition-all ${activeTab === cat.label ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' : 'bg-slate-800 text-slate-500'}`}>
              {cat.label} (上限 {cat.max})
            </button>
          ))}
        </div>

        <div className="grid md:grid-cols-5 gap-6">
          <form onSubmit={handleRegister} className="md:col-span-2 bg-slate-800 p-6 rounded-2xl h-fit space-y-4 border border-slate-700">
            <h2 className="font-bold border-l-4 border-emerald-500 pl-2">{selectedDay.label} 報名</h2>
            <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="選手姓名" className="w-full bg-slate-900 p-3 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500" />
            <input type="password" maxLength={4} required value={formData.edit_code} onChange={e => setFormData({...formData, edit_code: e.target.value})} placeholder="4 碼取消密碼" className="w-full bg-slate-900 p-3 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500" />
            <button className="w-full bg-emerald-500 py-4 rounded-xl font-black text-lg hover:bg-emerald-400 shadow-lg transition-all">確認報名</button>
          </form>

          <div className="md:col-span-3">
            <div className="flex justify-between items-end mb-4">
              <h2 className="font-bold border-l-4 border-emerald-500 pl-2">報名清單</h2>
              <span className="text-xs text-slate-400">剩餘正取：{Math.max(0, currentMax - currentList.length)}</span>
            </div>

            <div className="space-y-2">
              {currentList.map((p, i) => (
                <div key={p.id} className="bg-slate-800 p-4 rounded-xl flex justify-between items-center border border-slate-700">
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${i >= currentMax ? 'bg-orange-500/20 text-orange-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                      {i >= currentMax ? '備取' : '正取'}
                    </span>
                    <span className="font-bold text-lg">{p.name}</span>
                  </div>
                  <button onClick={() => handleCancel(p)} className="text-xs text-slate-600 hover:text-red-400">取消</button>
                </div>
              ))}
              {currentList.length === 0 && <div className="text-center py-10 text-slate-500 bg-slate-800/30 rounded-xl border border-dashed border-slate-700">目前尚無人報名</div>}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}