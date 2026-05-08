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
  count: number;
  status: string; 
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
  }, [selectedDay, activeTab]);

  const fetchParticipants = async () => {
    const { data, error } = await supabase.from('tournament_participants').select('*').order('id', { ascending: true });
    if (!error && data) {
      setParticipants(data);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const regCount = parseInt(formData.count);
    if (formData.edit_code.length !== 4) { alert("請設定 4 位數取消密碼"); return; }
    
    const currentList = participants.filter(p => p.category === activeTab && p.day_key === selectedDay.key);
    const totalFilled = currentList.filter(p => (p.status || '正取') === '正取').reduce((sum, p) => sum + (p.count || 1), 0);
    const currentMax = categories.find(c => c.label === activeTab)?.max || 16;

    let finalStatus = '正取';
    if ((totalFilled + regCount) > currentMax) {
      const remaining = currentMax - totalFilled;
      const msg = remaining > 0 
        ? `目前正取僅剩 ${remaining} 個名額，您的報名人數 (${regCount}位) 超過餘額。\n\n按「確定」將此筆 ${regCount} 位全數轉為【備取】？`
        : `正取已滿，此筆報名 (${regCount}位) 將全數列為【備取】，確定嗎？`;
      
      if (!window.confirm(msg)) return;
      finalStatus = '備取'; 
    }

    const { error } = await supabase.from('tournament_participants').insert([{
      name: formData.name.trim(),
      category: activeTab,
      day_key: selectedDay.key,
      edit_code: formData.edit_code,
      count: regCount,
      status: finalStatus 
    }]);

    if (!error) {
      alert(finalStatus === '備取' ? `已轉為備取登記！` : `報名成功！`);
      setFormData({ name: '', edit_code: '', count: '1' });
      fetchParticipants();
    }
  };

  const handleEdit = async (p: Participant) => {
    const code = window.prompt("請輸入 4 碼密碼以進行修改：");
    if (code === p.edit_code) {
      const newCountStr = window.prompt(`目前人數為 ${p.count} 位，請輸入新的人數 (1-4)：`, p.count.toString());
      const newCount = parseInt(newCountStr || "");
      if (isNaN(newCount) || newCount < 1 || newCount > 4) { alert("輸入無效"); return; }

      const categoryList = participants.filter(item => item.category === p.category && item.day_key === p.day_key);
      const currentTotalExcludeSelf = categoryList
        .filter(item => item.id !== p.id && (item.status || '正取') === '正取')
        .reduce((sum, item) => sum + (item.count || 0), 0);
      
      const currentMax = categories.find(c => c.label === p.category)?.max || 16;
      
      let newStatus = p.status || '正取';
      
      if (currentTotalExcludeSelf + newCount <= currentMax) {
        newStatus = '正取';
      } else {
        if ((p.status || '正取') === '正取') {
          if (!window.confirm("修改後人數將超過上限，是否要轉為【備取】？")) return;
          newStatus = '備取';
        } else {
          alert("名額仍不足，維持備取狀態。");
        }
      }

      const { error } = await supabase.from('tournament_participants').update({ count: newCount, status: newStatus }).eq('id', p.id);
      if (!error) { 
        alert(`已成功修改為 ${newCount} 位 (${newStatus})！`); 
        fetchParticipants(); 
      }
    } else if (code !== null) { alert("密碼錯誤！"); }
  };

  const handleCancel = async (p: Participant) => {
    const code = window.prompt("請輸入 4 碼密碼取消報名：");
    if (code === p.edit_code) {
      if (window.confirm(`確定要取消報名嗎？`)) {
        await supabase.from('tournament_participants').delete().eq('id', p.id);
        fetchParticipants();
      }
    } else if (code !== null) { alert("密碼錯誤！"); }
  };

  const currentList = participants.filter(p => p.category === activeTab && p.day_key === selectedDay.key);
  const currentMax = categories.find(c => c.label === activeTab)?.max || 16;
  const confirmedCount = currentList.filter(p => (p.status || '正取') === '正取').reduce((sum, p) => sum + (p.count || 0), 0);

  return (
    <main className="min-h-screen bg-slate-900 p-4 md:p-8 text-slate-100 font-sans tracking-tight">
      <div className="max-w-5xl mx-auto">
        <header className="text-center mb-10">
          <div className="flex flex-col md:flex-row items-center justify-center gap-6 mb-6">
            <Image src="/七賢LOGO.png" alt="LOGO" width={100} height={100} className="rounded-full shadow-2xl" />
            <h1 className="text-5xl md:text-6xl font-black text-emerald-400 italic tracking-widest uppercase">七賢國小匹克交流團</h1>
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-6 mb-8 inline-block text-2xl font-bold">
            <div className="flex flex-wrap justify-center gap-x-10 gap-y-3 text-emerald-400">
              <span>🕒 19:00 - 21:20</span> <span>💰 $100 / 人</span> <span>🏸 拍子租借 $50</span>
              <span className="text-orange-400">⚠️ 一人最高報 4 位</span>
            </div>
          </div>
          <div className="flex justify-center gap-4 flex-wrap">
            {dayOptions.map(d => (
              <button key={d.key} onClick={() => setSelectedDay(d)} className={`px-6 py-4 rounded-2xl font-black text-xl transition-all ${selectedDay.key === d.key ? 'bg-emerald-500 text-white shadow-xl' : 'bg-slate-800 text-slate-500 hover:bg-slate-700'}`}>{d.label}</button>
            ))}
          </div>
        </header>

        <div className="flex gap-6 mb-12">
          {categories.map(cat => (
            <button key={cat.id} onClick={() => setActiveTab(cat.label)} className={`flex-1 py-12 px-6 rounded-[3rem] transition-all border-4 flex flex-col items-center justify-center ${activeTab === cat.label ? 'bg-slate-800 border-emerald-500 text-emerald-400 shadow-xl' : 'bg-slate-900 border-slate-800 text-slate-700'}`}>
              <span className="text-6xl font-black mb-4">{cat.label}</span>
              <span className="text-3xl font-black opacity-90">({cat.max}人)</span>
            </button>
          ))}
        </div>

        <div className="grid lg:grid-cols-5 gap-10">
          <form onSubmit={handleRegister} className="lg:col-span-2 bg-slate-800 p-10 rounded-[3rem] space-y-6 border border-slate-700 shadow-2xl h-fit">
            <h2 className="font-black text-3xl text-white mb-4 italic">快速報名</h2>
            <div>
              <label className="text-sm text-slate-500 font-black uppercase tracking-widest">1. 選擇人數</label>
              <select value={formData.count} onChange={e => setFormData({...formData, count: e.target.value})} className="w-full bg-slate-900 p-6 rounded-2xl border border-slate-700 text-2xl font-black text-white appearance-none mt-2">
                {[1,2,3,4].map(n => <option key={n} value={n}>{n} 位</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm text-slate-500 font-black uppercase tracking-widest">2. 代表姓名</label>
              <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="輸入名字" className="w-full bg-slate-900 p-6 rounded-2xl border border-slate-700 text-2xl font-black text-white mt-2" />
            </div>
            <div>
              <label className="text-xl text-yellow-400 font-black uppercase tracking-widest">3. 密碼 (4 碼)</label>
              <input type="password" maxLength={4} required value={formData.edit_code} onChange={e => setFormData({...formData, edit_code: e.target.value})} placeholder="修改取消用" className="w-full bg-slate-900 p-6 rounded-2xl border border-slate-700 text-2xl font-black text-white mt-2" />
            </div>
            <button className="w-full bg-emerald-500 py-6 rounded-2xl font-black text-3xl hover:bg-emerald-400 text-white transition-all active:scale-95">確認報名</button>
          </form>

          <div className="lg:col-span-3">
            <div className="flex justify-between items-center mb-8 px-4">
              <h2 className="font-black text-4xl italic tracking-tighter">報名清單</h2>
              <span className="bg-slate-800 px-6 py-3 rounded-full text-xl text-slate-400 font-black">
                {confirmedCount} / {currentMax}
              </span>
            </div>
            <div className="space-y-4">
              {currentList.map((p) => (
                <div key={p.id} className="bg-slate-800/60 p-5 rounded-[2rem] flex flex-col sm:flex-row justify-between items-center border-2 border-slate-800 hover:border-emerald-500/50 transition-all gap-4">
                  <div className="flex items-center gap-6 w-full sm:w-auto">
                    <span className={`text-xl font-black px-5 py-2 rounded-xl shrink-0 w-24 text-center ${ (p.status || '正取') === '備取' ? 'bg-orange-500 text-white' : 'bg-emerald-500 text-white'}`}>
                      {p.status || '正取'}
                    </span>
                    <div className="flex items-baseline gap-4">
                      <span className="font-black text-4xl text-white tracking-tight">{p.name}</span>
                      <span className="text-2xl text-emerald-400 font-black">{p.count}位</span>
                    </div>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <button onClick={() => handleEdit(p)} className="text-xl bg-slate-700 text-white px-5 py-2 rounded-xl font-black w-24">修改</button>
                    <button onClick={() => handleCancel(p)} className="text-xl bg-red-900/30 text-red-500 px-5 py-2 rounded-xl font-black border-2 border-red-900/50 w-24">取消</button>
                  </div>
                </div>
              ))}
              {currentList.length === 0 && <div className="text-center py-24 text-slate-700 font-black text-3xl italic">目前尚無人報名</div>}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}