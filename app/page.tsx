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
  is_present?: boolean;
  created_at?: string;
  review_status?: string; // 🆕 審核狀態：'approved' | 'pending'
};

export default function QiXianPickleball() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const getUpcomingDates = () => {
    const dayOfWeek = now.getDay(); 
    const hour = now.getHours();

    const isNextWeekCycle = (dayOfWeek === 6 && hour >= 22) || dayOfWeek === 0;
    
    const baseMon = new Date(now);
    const diffToMon = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    baseMon.setDate(now.getDate() - diffToMon);
    
    if (isNextWeekCycle) {
      baseMon.setDate(baseMon.getDate() + 7);
    }

    const getTargetDate = (offsetDays: number) => {
      const d = new Date(baseMon);
      d.setDate(baseMon.getDate() + offsetDays);
      d.setHours(0, 0, 0, 0);
      return d;
    };

    const mon = getTargetDate(0);
    const thu = getTargetDate(3);
    const fri = getTargetDate(4);
    const sat = getTargetDate(5); 

    const format = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
    const formatKey = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

    return [
      { label: `週一 (${format(mon)})`, key: formatKey(mon), dateObj: mon, type: 'mon_special' },
      { label: `週四 (${format(thu)})`, key: formatKey(thu), dateObj: thu, type: 'thu_special' },
      { label: `週五 (${format(fri)})`, key: formatKey(fri), dateObj: fri, type: 'fri_special' },
      { label: `週六 (${format(sat)})`, key: formatKey(sat), dateObj: sat, type: 'sat_special' }, 
    ];
  };

  const dayOptions = getUpcomingDates();
  const [selectedDay, setSelectedDay] = useState(dayOptions[0]);
  const [isCancelled, setIsCancelled] = useState<boolean>(false);

  // 🆕 週六早上／晚上場次切換（只有選到週六時才有意義），預設晚上場
  const [satSession, setSatSession] = useState<'AM' | 'PM'>('PM');
  const isSaturdaySelected = selectedDay.type === 'sat_special';
  // 🆕 真正用來查詢/寫入資料庫的 day_key：平日直接用 selectedDay.key；
  //    週六則依 satSession 決定要不要加上 _AM 後綴（與後台/新手區站台格式一致）
  const activeDayKey = isSaturdaySelected && satSession === 'AM' ? `${selectedDay.key}_AM` : selectedDay.key;

  // 🎯 新增：動態記錄後台設定的人數上限 (連動 0 人設定)
  const [dynamicMax, setDynamicMax] = useState<number | null>(null);

  const isTargetInNextCycle = () => {
    const today = new Date(now);
    today.setHours(0,0,0,0);
    return selectedDay.dateObj.getTime() > today.getTime() + (6 * 24 * 60 * 60 * 1000);
  };

  const isRegistrationOpen = !(isTargetInNextCycle() && (now.getDay() === 6 && now.getHours() < 22)); 
  
  // 🆕 週六早上場（9-12點）採用提早的截止／鎖定時間：8:30 截止新增、9:00 鎖定修改；
  //    其餘場次（含週六晚上）維持原本 18:30 截止、19:00 鎖定
  const isAmSession = isSaturdaySelected && satSession === 'AM';
  const cutoffHours = isAmSession ? 8.5 : 18.5;
  const lockHours = isAmSession ? 9 : 19;
  const cutoffTimeLabel = isAmSession ? '8:30' : '18:30';
  const lockTimeLabel = isAmSession ? '9:00' : '19:00';

  const isExpired = now.getTime() > selectedDay.dateObj.getTime() + (cutoffHours * 60 * 60 * 1000);
  const isAfter1900 = now.getTime() > selectedDay.dateObj.getTime() + (lockHours * 60 * 60 * 1000);
  
  // 🎯 修正：連動後台設定的動態人數與 0 人不開放邏輯
  const getCategories = (dayType: string) => {
    let defaultMax = 18;
    if (dayType === 'thu_special') defaultMax = 28;
    if (dayType === 'sat_special') defaultMax = 8;

    const finalMax = dynamicMax !== null ? dynamicMax : defaultMax;
    const isClosed = finalMax === 0;

    return [{ id: 'sanda', label: '散打區', subLabel: 'OPEN PLAY', max: finalMax, isClosed }];
  };

  const categories = getCategories(selectedDay.type);
  const [activeTab, setActiveTab] = useState(categories[0].label);
  const [formData, setFormData] = useState({ name: '', edit_code: '', count: '1' });
  const [participants, setParticipants] = useState<Participant[]>([]);
  // 🆕 黑名單清單（本站原本完全沒有黑名單檢查，這裡補上，讓自動停權真正生效）
  const [blacklists, setBlacklists] = useState<{ id: number; name: string; blocked_until: string }[]>([]);

  useEffect(() => {
    const currentCategories = getCategories(selectedDay.type);
    const validLabels = currentCategories.filter(c => !c.isClosed).map(c => c.label);
    if (validLabels.length > 0 && !validLabels.includes(activeTab)) {
      setActiveTab(validLabels[0]);
    }
  }, [selectedDay, dynamicMax]);

  useEffect(() => {
    document.title = "七賢國小匹克交流團報名系統";
    fetchParticipants();
    fetchEventStatus();
    fetchBlacklists(); // 🆕
  }, [selectedDay, activeTab, satSession]);

  const fetchParticipants = async () => {
    // 🆕 抓取全部報名（含待審核 pending），待審核者會顯示在清單中並標示「⏳審核中」，
    //    但排隊順序、正備取的判定方式維持依報名時間 (id) 先後排隊佔位
    const { data, error } = await supabase.from('tournament_participants').select('*').order('id', { ascending: true });
    if (!error && data) setParticipants(data);
  };

  // 🎯 修正：即時讀取後台 event_settings 表格的 open_play_max
  // 🆕 改用 activeDayKey，才能讓週六早上／晚上場次各自讀到獨立的人數上限設定
  const fetchEventStatus = async () => {
    const { data: statusData } = await supabase.from('event_status').select('is_cancelled').eq('day_key', activeDayKey).single();
    setIsCancelled(statusData ? statusData.is_cancelled : false);

    const { data: settingData } = await supabase.from('event_settings').select('open_play_max').eq('day_key', activeDayKey).single();
    if (settingData && settingData.open_play_max !== undefined && settingData.open_play_max !== null) {
      setDynamicMax(settingData.open_play_max);
    } else {
      setDynamicMax(null);
    }
  };

  // 🆕 抓取黑名單清單
  const fetchBlacklists = async () => {
    const { data } = await supabase.from('blacklists').select('*');
    if (data) setBlacklists(data);
  };

  // 管理員密碼 8888
  const handleToggleRainCancellation = async () => {
    const adminPassword = window.prompt("請輸入提姆大叔管理員密碼：");
    if (adminPassword !== '8888') {
      alert("密碼錯誤！");
      return;
    }

    const nextStatus = !isCancelled;
    const actionText = nextStatus ? "【因雨取消】" : "【球敘正常】";

    if (window.confirm(`確定要將 ${selectedDay.label}${isSaturdaySelected ? (satSession === 'AM' ? '早上場' : '晚上場') : ''} 設定為 ${actionText} 嗎？`)) {
      await supabase.from('event_status').upsert({ day_key: activeDayKey, is_cancelled: nextStatus });
      
      if (nextStatus) {
        await supabase
          .from('tournament_participants')
          .update({ is_present: true })
          .eq('day_key', activeDayKey);
      }

      setIsCancelled(nextStatus);
      fetchParticipants();
      alert(`已將 ${selectedDay.label} 變更為 ${actionText}！`);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCancelled) { alert("本場次因雨取消，暫停報名！"); return; }
    if (currentMax === 0) { alert("本場次不開放報名！"); return; } // 🎯 0 人阻擋
    if (!isRegistrationOpen) { alert("該場次尚未開放報名！請等候週六 22:00 開放。"); return; }
    if (isExpired) { alert(`該場次已截止報名！(每日 ${cutoffTimeLabel} 截止)`); return; }
    
    const regCount = parseInt(formData.count);
    const trimmedName = formData.name.trim();
    if (formData.edit_code.length !== 4) { alert("請設定 4 位數密碼"); return; }
    
    const isDuplicate = participants.some(p => p.day_key === activeDayKey && p.category === activeTab && p.name.toLowerCase() === trimmedName.toLowerCase());
    if (isDuplicate) { alert(`「${trimmedName}」已報名過此場次！`); return; }

    // 🆕 黑名單檢查（本站原本沒有這道檢查，這裡補上）
    const isBlocked = blacklists.some(b => b.name.trim() === trimmedName);
    if (isBlocked) {
      alert('⚠️ 您的帳號目前處於停權狀態，無法進行報名！如有疑問請洽幹部。');
      return;
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const featureLaunchDate = new Date('2026-07-13T00:00:00');
    const startDate = thirtyDaysAgo > featureLaunchDate ? thirtyDaysAgo : featureLaunchDate;
    const isoStartDate = startDate.toISOString();

    const { data: historyData, error: historyError } = await supabase
      .from('tournament_participants')
      .select('*')
      .eq('name', trimmedName)
      .eq('is_present', false) 
      .gte('created_at', isoStartDate); 

    let absentCount = 0;
    if (!historyError && historyData) {
      const rightNow = new Date();
      absentCount = historyData.filter(p => {
        // 🆕 day_key 可能帶有時段後綴（如 2026-8-8_AM），解析日期前先去除後綴避免 Invalid Date
        const datePart = p.day_key.split('_')[0];
        const matchDate = new Date(datePart);
        matchDate.setHours(19, 0, 0, 0);
        return rightNow.getTime() > matchDate.getTime();
      }).length;
    }

    // 🆕 累積 2 次（含）以上未到場 → 自動停權 30 天（僅本站，不同步新手區），並直接擋下這次報名
    const ABSENT_AUTO_BLOCK_THRESHOLD = 2;
    if (absentCount >= ABSENT_AUTO_BLOCK_THRESHOLD) {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 30);
      const blockedUntilStr = targetDate.toISOString().split('T')[0];

      const { error: autoBlockError } = await supabase
        .from('blacklists')
        .insert([{ name: trimmedName, blocked_until: blockedUntilStr }]);

      if (autoBlockError) {
        alert(`系統偵測到異常未到場次數，但停權寫入失敗：${autoBlockError.message}，請洽幹部處理。`);
        return;
      }

      alert(`⚠️ 系統偵測到【${trimmedName}】在過去 30 天內已累積 ${absentCount} 次「未到場」紀錄，已自動停權 30 天（至 ${blockedUntilStr} 止），本次報名無法送出。如有疑問請洽幹部。`);
      fetchBlacklists(); // 讓黑名單狀態即時反映
      return;
    }

    // 🆕 查詢此姓名是否已經在「審核通過白名單」中
    // 有 → 直接視為已審核 (approved)；沒有 → 標記為待審核 (pending)，需管理員審核
    const { data: approvedRecord, error: approvedCheckError } = await supabase
      .from('approved_names')
      .select('id')
      .eq('name', trimmedName)
      .maybeSingle();

    if (approvedCheckError) {
      alert(`系統檢查發生問題：${approvedCheckError.message}`);
      return;
    }

    const reviewStatus: 'approved' | 'pending' = approvedRecord ? 'approved' : 'pending';

    const { error } = await supabase.from('tournament_participants').insert([{
      name: trimmedName, category: activeTab, day_key: activeDayKey, edit_code: formData.edit_code, count: regCount,
      review_status: reviewStatus // 🆕 寫入審核狀態
    }]);

    if (!error) {
      setFormData({ name: '', edit_code: '', count: '1' });
      fetchParticipants();

      // 🆕 依審核狀態與缺席提醒組合對應的提示訊息
      let message = '';
      if (reviewStatus === 'pending') {
        message = '✅ 報名已送出！\n\n這是您第一次報名，需要管理員審核通過後才會確認正取/備取資格。審核通過後，您之後在本站或新手區網站報名都不需要再審核。';
      } else {
        message = '🎉 報名成功！期待您的參與！';
      }

      if (absentCount > 0) {
        message += `\n\n⚠️ 溫馨提醒：\n系統偵測到【${trimmedName}】在過去 30 天內共有 ${absentCount} 次「未到場報到」的紀錄。請球友記得準時出席，或於球聚當天 19:00 前線上取消，以免影響未來報名權限喔！`;
      }

      alert(message);
    }
  };

  const currentGroup = participants.filter(p => p.day_key === activeDayKey && p.category === activeTab);
  const currentMax = categories.find(c => c.label === activeTab)?.max ?? 18;
  const isCurrentClosed = categories.find(c => c.label === activeTab)?.isClosed || false;
  
  // 🆕 pending（審核中）與 approved（已審核）依「報名先後順序（id）」一起排隊佔用名額，
  //    這樣才符合「先報先贏」的邏輯：審核中的人依然照順位卡住位子。
  //    若該筆審核中的報名之後被管理員拒絕（會被刪除），名額會自動讓給後面備取的人遞補。
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

          <div className="mb-6">
            {isCancelled ? (
              <div className="bg-red-500/20 border-2 border-red-500 text-red-400 rounded-full px-8 py-3 inline-block shadow-2xl animate-bounce">
                <span className="text-2xl font-black tracking-wide">⛈️ 本場次因雨取消，球友不計缺席！</span>
              </div>
            ) : (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-full px-8 py-3 inline-block shadow-lg">
                <div className="text-lg font-bold text-emerald-400 flex flex-wrap justify-center gap-x-8 gap-y-2">
                  <span>🟢 今日球敘正常進行</span>
                  <span>🕒 {isAmSession ? '9:00 - 12:00' : '19:00 - 21:20'}</span>
                  <span>💰 $100 / 人</span>
                </div>
              </div>
            )}
          </div>

          <div className="mb-8 flex flex-col items-center gap-2">
            <span className="bg-orange-500/20 text-orange-400 border border-orange-500/40 px-6 py-2 rounded-full text-lg font-bold">
              📢 每週六晚上 22:00 開放下一週報名
            </span>
            <span className="bg-red-500/10 text-red-400 border border-red-500/30 px-5 py-1 rounded-full text-sm font-bold">
              ⚠️ 本場次於當天 {cutoffTimeLabel} 截止新增報名，{lockTimeLabel} 後關閉修改/取消
            </span>
            {/* 🆕 首次報名審核提醒 */}
            <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 px-5 py-1 rounded-full text-sm font-bold">
              ℹ️ 首次報名需管理員審核，審核通過後之後報名（含新手區網站）即可直接排入正備取
            </span>
          </div>

          <div className="flex justify-center gap-4 flex-wrap">
            {dayOptions.map(d => (
              <button key={d.key} onClick={() => setSelectedDay(d)} className={`px-6 py-4 rounded-2xl font-black text-xl transition-all ${selectedDay.key === d.key ? 'bg-emerald-500 text-white shadow-xl scale-105' : 'bg-slate-800 text-slate-500 hover:bg-slate-700'}`}>{d.label}</button>
            ))}
          </div>

          {/* 🆕 週六早上／晚上次選單：只有選到週六時才會顯示 */}
          {isSaturdaySelected && (
            <div className="flex justify-center gap-3 mt-4">
              <button
                onClick={() => setSatSession('AM')}
                className={`px-6 py-3 rounded-2xl font-black text-lg transition-all flex items-center gap-2 ${
                  satSession === 'AM'
                    ? 'bg-amber-400 text-slate-900 shadow-xl scale-105'
                    : 'bg-slate-800 text-slate-500 border-2 border-slate-700 hover:bg-slate-700'
                }`}
              >
                🌅 早上場 (9-12點)
              </button>
              <button
                onClick={() => setSatSession('PM')}
                className={`px-6 py-3 rounded-2xl font-black text-lg transition-all flex items-center gap-2 ${
                  satSession === 'PM'
                    ? 'bg-emerald-500 text-white shadow-xl scale-105'
                    : 'bg-slate-800 text-slate-500 border-2 border-slate-700 hover:bg-slate-700'
                }`}
              >
                🌙 晚上場
              </button>
            </div>
          )}
        </header>

        <div className="flex gap-4 mb-10">
          {categories.map(cat => (
            <button key={cat.id} onClick={() => { if (!cat.isClosed) setActiveTab(cat.label); }} className={`flex-1 py-8 px-4 rounded-[2rem] transition-all border-4 flex flex-col items-center justify-center ${activeTab === cat.label ? 'bg-slate-800 border-emerald-500 text-emerald-400 shadow-xl' : cat.isClosed ? 'bg-slate-900 border-slate-800/50 text-slate-600 cursor-not-allowed' : 'bg-slate-900 border-slate-800 text-slate-700 hover:bg-slate-800'}`}>
              <span className="text-4xl font-black mb-2">{cat.label}</span>
              <span className={`text-xl font-black ${cat.isClosed ? 'text-red-500/80' : 'opacity-90'}`}>
                {cat.isClosed ? '這周未開放 (0人)' : `(${cat.max}人)`}
              </span>
            </button>
          ))}
        </div>

        <div className="grid lg:grid-cols-5 gap-10">
          <div className="lg:col-span-2">
            {isCancelled ? (
              <div className="bg-slate-800/50 p-10 rounded-[3rem] border border-red-500/30 text-center shadow-inner space-y-2">
                <p className="text-3xl font-black text-red-400 italic">⛈️ 場次已取消</p>
                <p className="text-slate-400 font-bold">因雨打不開，大家辛苦了！下週見！</p>
              </div>
            ) : isCurrentClosed ? (
              <div className="bg-slate-800/50 p-10 rounded-[3rem] border border-red-500/30 text-center shadow-inner space-y-2">
                <p className="text-2xl font-bold text-red-400 italic">⚠️ 本場次未開放</p>
                <p className="text-slate-400 font-bold">幹部已將本場次人數設為 0 人，暫不開放報名。</p>
              </div>
            ) : !isRegistrationOpen ? (
              <div className="bg-slate-800/50 p-10 rounded-[3rem] border border-slate-700 text-center shadow-inner">
                <p className="text-2xl font-bold text-slate-400 italic">新場次尚未開放報名</p>
                <p className="text-slate-500 mt-2">請於本週六 22:00 後再來</p>
              </div>
            ) : isAfter1900 ? (
              <div className="bg-slate-800/50 p-10 rounded-[3rem] border border-slate-700 text-center shadow-inner">
                <p className="text-2xl font-bold text-slate-500 italic text-white uppercase">活動已開打 / 結束</p>
                <p className="text-slate-500 mt-2 italic text-sm">{lockTimeLabel} 後已關閉所有更動</p>
              </div>
            ) : isExpired ? (
              <div className="bg-slate-800/50 p-10 rounded-[3rem] border border-slate-700 text-center shadow-inner">
                <p className="text-2xl font-bold text-red-400 italic text-white uppercase">已截止報名</p>
                <p className="text-slate-500 mt-2 italic text-sm">{cutoffTimeLabel} 後僅限代表密碼修改/取消</p>
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
              <div className="flex items-center gap-3">
                <button 
                  onClick={handleToggleRainCancellation}
                  className={`px-4 py-2 rounded-xl text-sm font-black transition-all border ${
                    isCancelled 
                      ? 'bg-red-600/30 text-red-400 border-red-500/50 hover:bg-red-600 hover:text-white' 
                      : 'bg-emerald-600/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-600 hover:text-white'
                  }`}
                >
                  {isCancelled ? '⛈️ 因雨取消中 (點擊恢復)' : '🟢 球敘正常 (點擊取消)'}
                </button>
                <span className="bg-slate-800 px-6 py-3 rounded-full text-xl text-slate-400 font-black">
                  正取：{confirmedTotal} / {currentMax}
                </span>
              </div>
            </div>
            <div className="space-y-4">
              {listWithStatus.map((p) => {
                // 🆕 待審核的人顯示「⏳審核中」標籤，取代原本的正取/備取/已到場顯示
                const isPending = p.review_status === 'pending';
                const badgeText = isPending ? '⏳審核中' : (p.is_present ? '已到場' : p.status);
                const badgeColorClass = isPending
                  ? 'bg-amber-500 text-slate-900 shadow-lg'
                  : p.is_present
                  ? 'bg-blue-600 text-white shadow-md'
                  : p.status === '備取'
                  ? 'bg-orange-500 text-white shadow-lg'
                  : 'bg-emerald-500 text-white shadow-lg';

                return (
                <div key={p.id} className={`bg-slate-800/60 p-5 rounded-[2rem] flex flex-col sm:flex-row justify-between items-center border-2 transition-all gap-4 shadow-xl ${isPending ? 'border-amber-500/40 border-dashed' : 'border-slate-800 hover:border-emerald-500/50'}`}>
                  <div className="flex items-center gap-6 w-full sm:w-auto">
                    <span className={`text-xl font-black px-5 py-2 rounded-xl shrink-0 w-24 text-center ${badgeColorClass}`}>
                      {badgeText}
                    </span>
                    <div className="flex items-baseline gap-4">
                      <span className={`font-black text-4xl tracking-tight ${p.is_present ? 'text-slate-400 line-through' : 'text-white'}`}>{p.name}</span>
                      <span className="text-2xl text-emerald-400 font-black">{p.count}位</span>
                    </div>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <button disabled={isAfter1900 || isCancelled || isCurrentClosed} onClick={async () => {
                        const code = window.prompt("請輸入密碼：");
                        if (code === p.edit_code) {
                          const newCount = parseInt(window.prompt("新人數 (1-4)：", p.count.toString()) || "");
                          if (!isNaN(newCount) && newCount >= 1 && newCount <= 4) {
                            if (p.status === '正取' && newCount > p.count) {
                              const extraNeeded = newCount - p.count;
                              const currentRemaining = currentMax - confirmedTotal;

                              if (extraNeeded > currentRemaining) {
                                const confirmChange = window.confirm(
                                  `⚠️ 【正取轉備取警示】\n\n` +
                                  `您目前為正取 (${p.count}位)。\n` +
                                  `由於目前正取名額剩餘 ${currentRemaining < 0 ? 0 : currentRemaining} 位，若您將人數追加至 ${newCount} 位，您的報名將會【整體轉為備取】順序，並將原本的正取名額釋放給後方球友遞補。\n\n` +
                                  `請問確定要追加人數並轉為備取嗎？`
                                );

                                if (!confirmChange) return;

                                await supabase.from('tournament_participants').delete().eq('id', p.id);
                                await supabase.from('tournament_participants').insert([{
                                  name: p.name, category: p.category, day_key: p.day_key, edit_code: p.edit_code, count: newCount, review_status: p.review_status || 'approved'
                                }]);
                                fetchParticipants();
                                return;
                              }
                            }

                            await supabase.from('tournament_participants').update({ count: newCount }).eq('id', p.id);
                            fetchParticipants();
                          }
                        } else if (code) alert("密碼錯誤！");
                    }} className={`text-xl px-5 py-2 rounded-xl font-black w-24 ${isAfter1900 || isCancelled || isCurrentClosed ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-slate-700 text-white hover:bg-slate-600'}`}>修改</button>
                    <button disabled={isAfter1900 || isCancelled || isCurrentClosed} onClick={async () => {
                        const code = window.prompt("請輸入密碼：");
                        if (code === p.edit_code && window.confirm("確定取消報名？")) {
                          await supabase.from('tournament_participants').delete().eq('id', p.id);
                          fetchParticipants();
                        }
                    }} className={`text-xl px-5 py-2 rounded-xl font-black border-2 w-24 ${isAfter1900 || isCancelled || isCurrentClosed ? 'border-slate-800 text-slate-600 cursor-not-allowed' : 'border-red-900/50 text-red-500 bg-red-900/30 hover:bg-red-900/50'}`}>取消</button>
                  </div>
                </div>
                );
              })}
              {listWithStatus.length === 0 && <div className="text-center py-24 text-slate-700 font-black text-3xl italic">目前尚無人報名</div>}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
