export const reportParts = [
  { key: 'work', title: '今日工作计划', question: '', placeholder: '依据计划，今天要完成什么？' },
  { key: 'delivery', title: '今日提交资料', question: '今天是否需要提交资料？', placeholder: '需要提交的资料、接收人及时间…' },
  { key: 'help', title: '需要协助的事项', question: '今天是否需要向别人寻求帮助？', placeholder: '遇到什么问题，希望谁提供什么帮助？' },
  { key: 'meeting', title: '会议与预约', question: '今天是否需要组织会议或预约讨论？', placeholder: '会议主题、参与人和预约时间…' },
] as const;

export type PartKey = typeof reportParts[number]['key'];
export interface ReportItem { id: string; text: string; done: boolean; origin?: string }
export interface ReportPart { enabled: boolean; items: ReportItem[] }
export interface DailyReport { date: string; parts: Record<PartKey, ReportPart> }

export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function previousDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return localDate(new Date(year, month - 1, day - 1, 12));
}
export function newReportItem(): ReportItem {
  return { id: crypto.randomUUID(), text: '', done: false };
}
export function emptyReport(date: string): DailyReport {
  return { date, parts: Object.fromEntries(reportParts.map(({ key }) => [key, {
    enabled: key === 'work', items: [{ id: `${date}-${key}-first`, text: '', done: false }],
  }])) as Record<PartKey, ReportPart> };
}

// Copy rather than move: yesterday's history remains unchanged. Origin keys
// also prevent duplicates when a carried item continues across several days.
export function carryUnfinished(target: DailyReport, source?: DailyReport) {
  const result = structuredClone(target);
  let added = 0;
  if (!source || source.date !== previousDate(target.date)) return { report: result, added };
  for (const { key } of reportParts) {
    if (!source.parts[key].enabled) continue;
    const part = result.parts[key];
    for (const item of source.parts[key].items) {
      if (item.done || !item.text.trim()) continue;
      const origin = item.origin ?? `${source.date}:${key}:${item.id}`;
      if (part.items.some((entry) => entry.origin === origin)) continue;
      part.items.push({ ...item, id: crypto.randomUUID(), origin, done: false });
      part.enabled = true;
      added++;
    }
    if (part.items.some((item) => item.text.trim())) {
      part.items = part.items.filter((item) => item.text.trim());
    }
  }
  return { report: result, added };
}
