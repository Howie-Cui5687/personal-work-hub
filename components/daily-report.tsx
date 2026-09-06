'use client';

import { useEffect, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import { loadReport, saveReport } from '@/lib/daily-report-store';
import { ArrowRight, CalendarDays, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { carryUnfinished, emptyReport, localDate, newReportItem, previousDate, reportParts,
  type DailyReport, type PartKey, type ReportPart } from '@/lib/daily-report';

export function DailyReportModule({ userId, onDirtyChange }: { userId: string; onDirtyChange: (dirty: boolean) => void }) {
  const [date, setDate] = useState('');
  const [reports, setReports] = useState<Record<string, DailyReport>>({});
  const [reading, setReading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadedDate, setLoadedDate] = useState('');
  const [revision, setRevision] = useState<number | null>(null);
  const [reload, setReload] = useState(0);
  useEffect(() => { setDate(localDate()); }, []);
  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  useEffect(() => {
    if (!date) return;
    let cancelled = false;
    setBusy(true); setLoadedDate(''); setError(''); setMessage('');
    const client = getSupabaseBrowserClient();
    if (!client) { setError('尚未配置 Supabase。'); setBusy(false); return; }
    void loadReport(client, userId, date).then((result) => {
      if (cancelled) return;
      setReports({ [date]: result.report }); setRevision(result.revision);
      setDirty(false); setLoadedDate(date);
      setMessage(result.revision === null ? '当天尚无云端记录，填写后点击保存。' : '已加载云端汇报。');
    }).catch((err: Error) => { if (!cancelled) setError(`读取失败：${err.message}`); })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [date, userId, reload]);
  if (!date) return null;
  const report = reports[date] ?? emptyReport(date);
  const today = localDate();
  const visibleItems = reportParts.flatMap(({ key }) => report.parts[key].enabled ? report.parts[key].items.filter((item) => item.text.trim()) : []);
  const ready = loadedDate === date;
  function changeDate(nextDate: string) {
    if (busy || nextDate === date) return;
    if (dirty && !window.confirm('当前修改尚未保存，切换日期会丢弃这些修改。确定继续？')) return;
    setDirty(false); setLoadedDate(''); setDate(nextDate);
  }
  async function save() {
    const client = getSupabaseBrowserClient();
    if (!client || !ready || busy) return;
    setBusy(true); setError('');
    try {
      const nextRevision = await saveReport(client, userId, report, revision);
      setRevision(nextRevision); setDirty(false); setMessage('已保存到云端，刷新或换设备登录后可查看。');
    } catch (err) { setError(`保存失败：${err instanceof Error ? err.message : '网络异常，请重试。'}`); }
    finally { setBusy(false); }
  }
  async function carryYesterday() {
    const client = getSupabaseBrowserClient();
    if (!client || !ready || busy) return;
    setBusy(true); setError('');
    try {
      const source = await loadReport(client, userId, previousDate(today));
      const result = carryUnfinished(report, source.report);
      setReports((current) => ({ ...current, [date]: result.report }));
      if (result.added) setDirty(true);
      setMessage(result.added ? `已带入 ${result.added} 条，请点击保存到云端。昨天的记录保持不变。` : '昨天没有可带入的新事项。');
    } catch (err) { setError(`带入失败：${err instanceof Error ? err.message : '网络异常，请重试。'}`); }
    finally { setBusy(false); }
  }

  function updatePart(key: PartKey, change: (part: ReportPart) => ReportPart) {
    if (!ready || busy) return;
    setDirty(true);
    setReports((current) => {
      const existing = current[date] ?? emptyReport(date);
      return { ...current, [date]: { ...existing, parts: { ...existing.parts, [key]: change(existing.parts[key]) } } };
    });
    setMessage('');
  }

  return (
    <section className="daily-report" aria-labelledby="daily-report-title">
      <header className="report-heading">
        <div><p className="section-kicker">DAILY BRIEFING</p><h3 id="daily-report-title">每日工作汇报</h3><p>四个部分，逐条说清今天的安排。</p></div>
        <Button variant="outline" onClick={() => setReading(!reading)}>{reading ? '返回填写' : '口头汇报视图'}</Button>
      </header>
      <p className="report-preview-note">按日期保存，仅本人可读写。填写或勾选完成后，请点击“保存到云端”；只有显示保存成功，才代表修改已同步。</p>
      <div className="report-toolbar">
        <label className="report-date" htmlFor="report-date"><CalendarDays size={18} /><span>汇报日期</span><Input id="report-date" type="date" disabled={busy} value={date} onChange={(event) => { if (/^\d{4}-\d{2}-\d{2}$/.test(event.target.value)) changeDate(event.target.value); }} /></label>
        <Button variant="ghost" disabled={busy} onClick={() => changeDate(today)}>回到今天</Button>
        <Button variant="outline" disabled={date !== today || busy || !ready} onClick={carryYesterday}><ArrowRight size={16} />带入昨天未完成</Button>
        <Button disabled={busy || !ready || !dirty} onClick={save}>{busy ? '处理中…' : dirty ? '保存到云端 *' : '无待保存修改'}</Button>
        <Button variant="ghost" disabled={busy} onClick={() => { if (!dirty || window.confirm('重新加载会丢弃未保存修改。请先复制需要保留的文字。继续？')) setReload((value) => value + 1); }}>重新加载</Button>
      </div>
      <div className="report-status"><span>{date === today ? '今天' : date} · {visibleItems.length} 条事项 · {visibleItems.filter((item) => item.done).length} 条已完成</span><span>选“否”会隐藏事项，再选“是”可恢复。</span></div>
      {message && <output className="report-message block">{message}</output>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {busy && <output className="block">正在连接云端…</output>}
      <fieldset disabled={busy || !ready} className={`report-parts ${reading ? 'report-reading' : ''}`}>
        <legend className="sr-only">每日汇报内容</legend>
        {reportParts.map((meta, index) => {
          const part = report.parts[meta.key];
          return <section className="report-part" key={meta.key} aria-labelledby={`part-${meta.key}`}>
            <div className="report-part-heading"><span className="report-number">0{index + 1}</span><div><h4 id={`part-${meta.key}`}>{meta.title}</h4>{meta.question && <p id={`question-${meta.key}`}>{meta.question}</p>}</div>
              {meta.key !== 'work' && !reading && <RadioGroup className="report-choice" aria-labelledby={`question-${meta.key}`} value={part.enabled ? 'yes' : 'no'} onValueChange={(value) => updatePart(meta.key, (current) => ({ ...current, enabled: value === 'yes' }))}>
                <label htmlFor={`${meta.key}-yes`}><RadioGroupItem id={`${meta.key}-yes`} value="yes" />是</label><label htmlFor={`${meta.key}-no`}><RadioGroupItem id={`${meta.key}-no`} value="no" />否</label>
              </RadioGroup>}
              {reading && meta.key !== 'work' && <span className="report-answer">{part.enabled ? '是' : '否'}</span>}
            </div>
            {part.enabled && (reading ? <ol className="report-spoken-list">{part.items.filter((item) => item.text.trim()).map((item) => <li key={item.id}>{item.text}{item.done && <span>（已完成）</span>}</li>)}{!part.items.some((item) => item.text.trim()) && <li className="report-muted">尚未填写事项</li>}</ol> : <div className="report-entries">
              {part.items.map((item, itemIndex) => <div className="report-entry" key={item.id}>
                <label className="report-item-text" htmlFor={`report-${item.id}`}><span>事项 {itemIndex + 1}{item.origin && <small> · 延续事项</small>}</span><Textarea id={`report-${item.id}`} maxLength={2000} className={item.done ? 'report-item-done' : ''} value={item.text} placeholder={meta.placeholder} onChange={(event) => updatePart(meta.key, (current) => ({ ...current, items: current.items.map((entry) => entry.id === item.id ? { ...entry, text: event.target.value } : entry) }))} /></label>
                <div className="report-entry-actions"><label htmlFor={`done-${item.id}`}><Checkbox id={`done-${item.id}`} checked={item.done} onCheckedChange={(done) => updatePart(meta.key, (current) => ({ ...current, items: current.items.map((entry) => entry.id === item.id ? { ...entry, done } : entry) }))} />已完成</label>
                  <Button variant="ghost" size="icon" aria-label={`移除${meta.title}事项 ${itemIndex + 1}`} onClick={() => updatePart(meta.key, (current) => ({ ...current, items: current.items.length === 1 ? [newReportItem()] : current.items.filter((entry) => entry.id !== item.id) }))}><Trash2 size={16} /></Button>
                </div>
              </div>)}
              <Button variant="outline" onClick={() => updatePart(meta.key, (current) => ({ ...current, items: [...current.items, newReportItem()] }))}><Plus size={16} />添加事项</Button>
            </div>)}
          </section>;
        })}
      </fieldset>
    </section>
  );
}
