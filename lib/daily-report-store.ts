import type { SupabaseClient } from '@supabase/supabase-js';
import { emptyReport, reportParts, type DailyReport } from './daily-report';

export interface StoredReport { report: DailyReport; revision: number | null }
export function decodeReport(date: string, parts: unknown): DailyReport {
  const report = emptyReport(date);
  if (!parts || typeof parts !== 'object') throw new Error('汇报数据格式异常，请勿覆盖保存。');
  for (const { key } of reportParts) {
    const part = (parts as Record<string, unknown>)[key] as DailyReport['parts']['work'];
    if (!part || typeof part.enabled !== 'boolean' || !Array.isArray(part.items) || part.items.length < 1 ||
        part.items.some((item) => !item || typeof item.id !== 'string' || typeof item.text !== 'string' ||
          typeof item.done !== 'boolean' || (item.origin !== undefined && typeof item.origin !== 'string'))) {
      throw new Error('汇报数据格式异常，请勿覆盖保存。');
    }
    report.parts[key] = part;
  }
  report.parts.work.enabled = true;
  return report;
}
function storageError(error: { code?: string; message: string }): Error {
  if (error.code === '42P01' || error.code === 'PGRST205') return new Error('每日汇报数据表尚未建立，请先执行 daily_reports.sql。');
  if (error.code === '23505') return new Error('其他页面已保存这一天的汇报。请先保留当前文字，再重新加载云端内容。');
  return new Error(error.message);
}
export async function loadReport(client: SupabaseClient, userId: string, date: string): Promise<StoredReport> {
  const { data, error } = await client.from('daily_reports').select('parts, revision')
    .eq('user_id', userId).eq('report_date', date).maybeSingle();
  if (error) throw storageError(error);
  return data ? { report: decodeReport(date, data.parts), revision: data.revision } : { report: emptyReport(date), revision: null };
}
export async function saveReport(client: SupabaseClient, userId: string, report: DailyReport, revision: number | null): Promise<number> {
  decodeReport(report.date, report.parts);
  const payload = { user_id: userId, report_date: report.date, parts: report.parts };
  const query = revision === null
    ? client.from('daily_reports').insert(payload)
    : client.from('daily_reports').update({ parts: report.parts }).eq('user_id', userId).eq('report_date', report.date).eq('revision', revision);
  const { data, error } = await query.select('revision').maybeSingle();
  if (error) throw storageError(error);
  if (!data) throw new Error('云端记录已在其他页面更新，或登录权限已变化。当前输入已保留，请先复制文字，再重新加载。');
  return data.revision;
}
