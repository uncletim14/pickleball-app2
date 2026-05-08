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
  day: string; // 新增星期欄位
  dupr: string;
  edit_code: string;
};

export default function QiXianSanda() {
  const days = ["星期一", "星期四", "星期五"];
  const [selectedDay, setSelectedDay] = useState("星期一");

  // 🌟 自動根據星期判斷組別
  const getCategories = (day: string) => {
    if (day === "星期一") {
      return [
        { id: 'sanda', label: '散打區', max: 16 },
        { id: 'newbie', label: '新手區', max: 8 },
      ];
    } else {
      // 星期四、五保留原本的設計
      return [
        { id: 'sanda', label: '散打區', max: 16 },
        { id: 'newbie', label: '新手區', max: 8 },
        { id: 'trial', label: '新手體驗', max: 4 }, // 假設原本是 4 人，您可以自行調整
      ];
    }
  };

  const categories = getCategories(selectedDay);
  const [activeTab, setActiveTab] = useState(categories[0].label);
  const [formData, setFormData] = useState({ name: '', dupr: '', edit_code: '' });
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    document.title = "七賢匹克球團報名系統";
    fetchParticipants();
  }, []);

  // 當切換星期時，自動把組別跳回第一個，避免選到消失的組別
  useEffect(() => {
    setActiveTab(categories[0].label);
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

    const isDuplicate = participants.some(p => 
      p.name.trim() === formData.name.trim() && p.category === activeTab && p.day === selectedDay
    );
    if (isDuplicate) { alert(`「${formData.name}」已經在名單中囉！`); return; }

    const categoryList = participants.filter(p => p.category === activeTab && p.day === selectedDay);
    const currentMax = categories.find(c => c.label === activeTab)?.max || 16;

    if (categoryList.length >= currentMax) {
      if (!window.confirm(`正取已滿，報名後列為「備取第 ${categoryList.length - currentMax + 1} 位」，確定嗎？`)) return;
    }

    const { error } = await supabase.from('tournament_participants').insert([{
      name: formData.name.trim(),
      category: activeTab,
      day: selectedDay,
      dupr: formData.dupr || '0',
      edit_code: formData.edit_code
    }]);

    if (!error) {
      alert("報名成功！");
      setFormData({ name: '', dupr: '', edit_code: '' });
      fetchParticipants();
    } else {
      alert("失敗：" + error.message);
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

  const currentList = participants.filter(p => p.category === activeTab && p.day === selectedDay);
  const currentMax = categories.find(c => c.label === activeTab)?.max || 16;

  return (
    <main className="min-h-screen bg-slate-900 p-4 md:p-8 text-slate-100">
      <div className="max-w-3xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-3xl font-black text-emerald-400 mb-2">七賢匹克球團 報名系統</h1>
          <div className="flex justify-center gap-4 mt-4">
            {days.map(d => (
              <button key={d} onClick={() => setSelectedDay(d)} className={`px-4 py-2 rounded-lg font-bold transition-all ${selectedDay === d ? 'bg-white text-slate-900' : 'bg-slate-800 text-slate-500'}`}>
                {d}
              </button>
            ))}
          </div>
        </header>

        <div className="flex gap-2 mb-6">
          {categories.map(cat => (
            <button key={cat.id} onClick={() => setActiveTab(cat.label)} className={`flex-1 py-3 rounded-xl font-bold transition-all ${activeTab === cat.label ? 'bg-emerald-500 shadow-lg' : 'bg-slate-800 text-slate-500'}`}>
              {cat.label} ({cat.max}人)
            </button>
          ))}
        </div>

        <div className="grid md:grid-cols-5 gap-6">
          <form onSubmit={handleRegister} className="md:col-span-2 bg-slate-800 p-5 rounded-2xl h-fit space-y-4">
            <h2 className="font-bold border-l-4 border-emerald-500 pl-2">{selectedDay} 報名表</h2>
            <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="選手姓名" className="w-full bg-slate-900 p-3 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500" />
            <input type="text" value={formData.dupr} onChange={e => setFormData({...formData, dupr: e.target.value})} placeholder="DUPR ID (選填)" className="w-full bg-slate-900 p-3 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500" />
            <input type="password" maxLength={4} required value={formData.edit_code} onChange={e => setFormData({...formData, edit_code: e.target.value})} placeholder="4 碼取消密碼" className="w-full bg-slate-900 p-3 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500" />
            <button className="w-full bg-emerald-500 py-3 rounded-lg font-bold hover:bg-emerald-400 transition-colors">確認報名</button>
          </form>

          <div className="md:col-span-3">
            <h2 className="font-bold mb-4 border-l-4 border-emerald-500 pl-2">目前名單 (剩餘正取：{Math.max(0, currentMax - currentList.length)})</h2>
            <div className="space-y-2">
              {currentList.map((p, i) => (
                <div key={p.id} className="bg-slate-800 p-3 rounded-xl flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] px-1 rounded ${i >= currentMax ? 'bg-orange-500/20 text-orange-400' : 'bg-emerald-500/20 text-emerald-400'}`}>{i >= currentMax ? '備取' : '正取'}</span>
                    <div>
                      <div className="font-bold">{p.name}</div>
                      <div className="text-[10px] text-slate-500">DUPR: {p.dupr}</div>
                    </div>
                  </div>
                  <button onClick={() => handleCancel(p)} className="text-xs text-slate-600 hover:text-red-400">取消</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}