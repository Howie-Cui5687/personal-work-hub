'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, CalendarDays, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { carryUnfinished, emptyReport, localDate, newReportItem, previousDate, reportParts,
  type DailyReport, type PartKey, type ReportPart } from '@/lib/daily-report';

// Deliberately an in-memory design preview. No production data is written.
// Persistent storage will be connected only after approval of the migration.
export function DailyReportModule() {
  const [date, setDate] = useState('');
  const [reports, setReports] = useState<Record<string, DailyReport>>({});
  const [reading, setReading] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => { setDate(localDate()); }, []);
  if (!date) return null;
  const report = reports[date] ?? emptyReport(date);
  const today = localDate();
  const visibleItems = reportParts.flatMap(({ key }) => report.parts[key].enabled ? report.parts[key].items.filter((item) => item.text.trim()) : []);

  function updatePart(key: PartKey, change: (part: ReportPart) => ReportPart) {
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
      <p className="report-preview-note">交互预览 · 尚未接入云端保存。内容仅在当前页面临时保留，刷新或退出登录后清空，请先用测试内容体验。</p>
      <div className="report-toolbar">
        <label className="report-date" htmlFor="report-date"><CalendarDays size={18} /><span>汇报日期</span><Input id="report-date" type="date" value={date} onChange={(event) => { if (/^\d{4}-\d{2}-\d{2}$/.test(event.target.value)) { setDate(event.target.value); setMessage(''); } }} /></label>
        <Button variant="ghost" onClick={() => { setDate(today); setMessage(''); }}>回到今天</Button>
        <Button variant="outline" disabled={date !== today} onClick={() => {
          const result = carryUnfinished(report, reports[previousDate(today)]);
          setReports((current) => ({ ...current, [today]: result.report }));
          setMessage(result.added ? `已带入 ${result.added} 条未完成事项，昨天的内容保持不变。` : '昨天没有可带入的新事项：可能尚未填写、已完成，或已带入。');
        }}><ArrowRight size={16} />带入昨天未完成</Button>
      </div>
      <div className="report-status"><span>{date === today ? '今天' : date} · {visibleItems.length} 条事项 · {visibleItems.filter((item) => item.done).length} 条已完成</span><span>选“否”会隐藏事项，再选“是”可恢复。</span></div>
      {message && <output className="report-message block">{message}</output>}
      <div className={`report-parts ${reading ? 'report-reading' : ''}`}>
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
      </div>
    </section>
  );
}
