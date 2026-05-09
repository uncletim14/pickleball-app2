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
};

export default function QiXianPickleball() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const getUpcomingDates = () => {
    const dayOfWeek = now.getDay(); // 0(日) 到 6(六)
    const hour = now.getHours();

    // 🌟 邏輯優化：找出這三場球賽屬於「哪一週」的基準日
    // 規則：週六 18:00 之前，顯示「本週」；週六 18:00 之後（含週日整天），顯示「下週」。
    const isNextWeekCycle = (dayOfWeek === 6 && hour >= 18) || dayOfWeek === 0;
    
    // 找出本週週一的日期
    const baseMon = new Date(now);
    const diffToMon = dayOfWeek === 0 ? 6 : dayOfWeek - 1; 
    baseMon.setDate(now.getDate() - diffToMon);
    
    // 如果進入下週週期，將基準週一往後推 7 天
    if (isNextWeekCycle) {
      baseMon.setDate(baseMon.getDate() + 7);
    }

    const getTargetDate = (offsetDays: number) => {
      const d = new Date(baseMon);
      d.setDate(baseMon.getDate() + offsetDays);
      d.setHours(0, 0, 0, 0);
      return d;
    };

    // 基準是週一(0)，所以週四是 +3，週五是 +4
    const mon = getTargetDate(0);
    const thu = getTargetDate(3);
    const fri = getTargetDate(4);

    const format = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
    const formatKey = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

    return [
      { label: `週一 (${format(mon)})`, key: formatKey(mon), dateObj: mon, type: 'normal' },
      { label: `週四 (${format(thu)})`, key: formatKey(thu), dateObj: thu, type: 'thu_special' },
      { label: `週五 (${format(fri)})`, key: formatKey(fri), dateObj: fri, type: 'normal' },
    ];
  };

  const dayOptions = getUpcomingDates();
  const [selectedDay, setSelectedDay] = useState(dayOptions[0]);

  // 過期判定：場次當天晚上 22:00 後鎖定
  const isExpired = now.getTime() > selectedDay.dateObj.getTime() + (22 * 60 * 60 * 1000);
  
  const getCategories = (dayType: string) => {
    if (dayType === 'thu_special') return [{ id: 'sanda', label: '散打區', subLabel: 'OPEN PLAY', max: 24 }];
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
    if (!error && data) setParticipants(data);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isExpired) { alert("該場次已結束！"); return; }
    const regCount = parseInt(formData.count);
    const trimmedName = formData.name.trim();
    if (formData.edit_code.length !== 4) { alert("請設定 4 位數密碼"); return; }
    
    const isDuplicate = participants.some(p => p.day_key === selectedDay.key && p.category === activeTab && p.name.toLowerCase() === trimmedName.toLowerCase());
    if (isDuplicate) { alert(`「${trimmedName}」已報名過此場次！`); return; }

    const { error } = await supabase.from('tournament_participants').insert([{
      name: trimmedName, category: activeTab, day_key: selectedDay.key, edit_code: formData.edit_code, count: regCount
    }]);

    if (!error) {
      setFormData({ name: '', edit_code: '', count: '1' });
      fetchParticipants();
      alert("報名完成！");
    }
  };

  const currentGroup = participants.filter(p => p.category === activeTab && p.day_key === selectedDay.key);
  const currentMax = categories.find(c => c.label === activeTab)?.max || 16;
  let runningTotal = 0;
  let hasMetWaitlist = false; 
  const listWithStatus = currentGroup.map(p => {
    if (hasMetWaitlist || (runningTotal + p.count > currentMax)) {
      hasMetWaitlist = true; 
      return { ...p, status: '備取' };
    } else {
      runningTotal += p.count;
      return { ...p, status: '正取' };
    }
  });
  const confirmedTotal = listWithStatus.filter(p => p.status === '正取').reduce((sum, p) => sum + p.count, 0);

  return (
    <main className="min-h-screen bg-slate-900 p-4 md:p-8 text-slate-100 font-sans tracking-tight">
      <div className="max-w-5xl mx-auto">
        <header className="text-center mb-10">
          <div className="flex flex-col md:flex-row items-center justify-center gap-6 mb-6">
            <Image src="/七賢LOGO.png" alt="LOGO" width={80} height={80} className="rounded-full shadow-2xl" />
            <h1 className="text-4xl md:text-6xl font-black text-emerald-400 italic tracking-widest uppercase text-shadow-sm">七賢國小匹克交流團</h1>
          </div>
          
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-full px-8 py-3 mb-4 inline-block shadow-lg">
            <div className="text-lg font-bold text-emerald-400 flex flex-wrap justify-center gap-x-8 gap-y-2">
              <span>🕒 19:00 - 21:20</span>
              <span>💰 $100 / 人</span>
              <span>🏸 拍子租借 $50</span>
            </div>
          </div>

          <div className="mb-8">
            <span className="bg-orange-500/20 text-orange-400 border border-orange-500/40 px-6 py-2 rounded-full text-lg font-bold">
              📢 每週六晚上 18:00 開放下一週報名
            </span>
          </div>

          <div className="flex justify-center gap-4 flex-wrap">
            {dayOptions.map(d => (
              <button key={d.key} onClick={() => setSelectedDay(d)} className={`px-6 py-4 rounded-2xl font-black text-xl transition-all ${selectedDay.key === d.key ? 'bg-emerald-500 text-white shadow-xl scale-105' : 'bg-slate-800 text-slate-500 hover:bg-slate-700'}`}>{d.label}</button>
            ))}
          </div>
        </header>

        <div className="flex gap-4 mb-10">
          {categories.map(cat => (
            <button key={cat.id} onClick={() => setActiveTab(cat.label)} className={`flex-1 py-8 px-4 rounded-[2rem] transition-all border-4 flex flex-col items-center justify-center ${activeTab === cat.label ? 'bg-slate-800 border-emerald-500 text-emerald-400 shadow-xl' : 'bg-slate-900 border-slate-800 text-slate-700'}`}>
              <span className="text-4xl font-black mb-2">{cat.label}</span>
              <span className="text-xl font-black opacity-90">({cat.max}人)</span>
            </button>
          ))}
        </div>

        <div className="grid lg:grid-cols-5 gap-10">
          <div className="lg:col-span-2">
            {isExpired ? (
              <div className="bg-slate-800/50 p-10 rounded-[3rem] border border-slate-700 text-center shadow-inner">
                <p className="text-2xl font-bold text-slate-400 italic">場次已結束</p>
                <p className="text-slate-500 mt-2 italic text-sm">名單保留一週供查閱</p>
              </div>
            ) : (
              <form onSubmit={handleRegister} className="bg-slate-800 p-10 rounded-[3rem] space-y-6 border border-slate-700 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-emerald-500 text-slate-900 px-4 py-1 font-black text-xs uppercase">Open</div>
                <h2 className="font-black text-3xl text-white mb-4 italic uppercase">快速報名</h2>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-slate-500 font-black tracking-widest uppercase italic">1. 人數</label>
                    <select value={formData.count} onChange={e => setFormData({...formData, count: e.target.value})} className="w-full bg-slate-900 p-6 rounded-2xl border border-slate-700 text-2xl font-black text-white appearance-none mt-2">
                      {[1,2,3,4].map(n => <option key={n} value={n}>{n} 位</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-slate-500 font-black tracking-widest uppercase italic">2. 代表姓名</label>
                    <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="代表姓名" className="w-full bg-slate-900 p-6 rounded-2xl border border-slate-700 text-2xl font-black text-white mt-2" />
                  </div>
                  <div>
                    <label className="text-sm text-yellow-400 font-black tracking-widest uppercase italic">3. 密碼 (4 碼)</label>
                    <input type="password" maxLength={4} required value={formData.edit_code} onChange={e => setFormData({...formData, edit_code: e.target.value})} placeholder="修改取消用" className="w-full bg-slate-900 p-6 rounded-2xl border border-slate-700 text-2xl font-black text-white mt-2" />
                  </div>
                  <button className="w-full bg-emerald-500 py-6 rounded-2xl font-black text-3xl hover:bg-emerald-400 text-white transition-all active:scale-95 shadow-lg shadow-emerald-500/20 uppercase italic">確認報名</button>
                </div>
              </form>
            )}
          </div>

          <div className="lg:col-span-3">
            <div className="flex justify-between items-center mb-8 px-4">
              <h2 className="font-black text-4xl italic tracking-tighter uppercase text-white">報名清單</h2>
              <span className="bg-slate-800 px-6 py-3 rounded-full text-xl text-slate-400 font-black">
                正取：{confirmedTotal} / {currentMax}
              </span>
            </div>
            <div className="space-y-4">
              {listWithStatus.map((p) => (
                <div key={p.id} className="bg-slate-800/60 p-5 rounded-[2rem] flex flex-col sm:flex-row justify-between items-center border-2 border-slate-800 hover:border-emerald-500/50 transition-all gap-4 shadow-xl">
                  <div className="flex items-center gap-6 w-full sm:w-auto">
                    <span className={`text-xl font-black px-5 py-2 rounded-xl shrink-0 w-24 text-center ${ p.status === '備取' ? 'bg-orange-500 text-white shadow-lg' : 'bg-emerald-500 text-white shadow-lg'}`}>
                      {p.status}
                    </span>
                    <div className="flex items-baseline gap-4">
                      <span className="font-black text-4xl text-white tracking-tight">{p.name}</span>
                      <span className="text-2xl text-emerald-400 font-black">{p.count}位</span>
                    </div>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <button disabled={isExpired} onClick={async () => {
                        const code = window.prompt("請輸入密碼：");
                        if (code === p.edit_code) {
                          const newCount = parseInt(window.prompt("新人數 (1-4)：", p.count.toString()) || "");
                          if (!isNaN(newCount)) {
                            await supabase.from('tournament_participants').update({ count: newCount }).eq('id', p.id);
                            fetchParticipants();
                          }
                        } else if (code) alert("密碼錯誤！");
                    }} className={`text-xl px-5 py-2 rounded-xl font-black w-24 ${isExpired ? 'bg-slate-800 text-slate-600' : 'bg-slate-700 text-white hover:bg-slate-600'}`}>修改</button>
                    <button disabled={isExpired} onClick={async () => {
                        const code = window.prompt("請輸入密碼：");
                        if (code === p.edit_code && window.confirm("確定取消報名？")) {
                          await supabase.from('tournament_participants').delete().eq('id', p.id);
                          fetchParticipants();
                        }
                    }} className={`text-xl px-5 py-2 rounded-xl font-black border-2 w-24 ${isExpired ? 'border-slate-800 text-slate-600' : 'border-red-900/50 text-red-500 bg-red-900/30 hover:bg-red-900/50'}`}>取消</button>
                  </div>
                </div>
              ))}
              {listWithStatus.length === 0 && <div className="text-center py-24 text-slate-700 font-black text-3xl italic">目前尚無人報名</div>}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}