'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Search } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import classics from '@/lib/classics.json';
import { annotateText } from '@/lib/classic-glosses';
import { findTextMatches, searchClassics, searchTargetId, type TextMatch } from '@/lib/classic-search';

const searchableParagraphs = [
  ...classics.daodejing.flatMap((chapter) => chapter.paragraphs.map((text, i) => ({
    id: `dao-${chapter.number}-${i}`, title: `道德经 · Part ${Math.ceil(chapter.number / 9)} · 第${chapter.title}`,
    route: `#knowledge/daodejing/${Math.ceil(chapter.number / 9)}`, text,
  }))),
  ...classics.qiwulun.map((text, i) => ({ id: `qiwu-${i}`, title: `齐物论 · 段落 ${i + 1}`, route: '#knowledge/qiwulun', text })),
];

function HighlightedText({ text, offset, matches, paragraph }: { text: string; offset: number; matches: TextMatch[]; paragraph: string }) {
  const pieces = [];
  let cursor = 0;
  for (const match of matches) {
    const start = Math.max(0, match.start - offset);
    const end = Math.min(text.length, match.end - offset);
    if (end <= start) continue;
    pieces.push(text.slice(cursor, start));
    pieces.push(<mark key={match.start} id={match.start >= offset ? searchTargetId(paragraph, match.start) : undefined} tabIndex={-1}>{text.slice(start, end)}</mark>);
    cursor = end;
  }
  pieces.push(text.slice(cursor));
  return <>{pieces}</>;
}

function AnnotatedParagraph({ text, notes, query, paragraph }: { text: string; notes: boolean; query: string; paragraph: string }) {
  const matches = findTextMatches(text, query);
  let offset = 0;
  return <p>{annotateText(text).map((chunk, i) => {
    const content = <HighlightedText text={chunk.text} offset={offset} matches={matches} paragraph={paragraph} />;
    offset += chunk.text.length;
    return <Fragment key={i}>{chunk.gloss ? <span>
      <ruby>{content}<rp>（</rp><rt>{chunk.gloss.pinyin}</rt><rp>）</rp></ruby>
      {notes && <span className="classic-note">（{chunk.gloss.note}）</span>}
    </span> : content}</Fragment>;
  })}</p>;
}

function scrollToSearchHit(hash: string) {
  const params = new URLSearchParams(hash.split('?')[1]);
  const paragraph = params.get('paragraph');
  if (!paragraph) return;
  const target = document.getElementById(searchTargetId(paragraph, Number(params.get('start'))));
  target?.focus({ preventScroll: true });
  target?.scrollIntoView({ block: 'center' });
}

export function KnowledgeLibrary() {
  const [selection, setSelection] = useState('');
  const [notes, setNotes] = useState(true);
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchClassics(searchableParagraphs, query), [query]);
  useEffect(() => {
    const sync = () => {
      const hash = window.location.hash;
      setSelection(hash);
      const savedQuery = new URLSearchParams(hash.split('?')[1]).get('q');
      if (savedQuery !== null) setQuery(savedQuery);
      if (!hash.includes('?')) window.scrollTo(0, 0);
    };
    sync(); window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  useEffect(() => {
    const frame = requestAnimationFrame(() => scrollToSearchHit(selection));
    return () => cancelAnimationFrame(frame);
  }, [selection]);
  const route = selection.split('?')[0];
  const dao = route.startsWith('#knowledge/daodejing');
  const qiwu = route === '#knowledge/qiwulun';
  const part = Math.min(9, Math.max(1, Math.floor(Number(route.split('/')[2]) || 1)));
  const chapters = classics.daodejing.slice((part - 1) * 9, part * 9);
  return <main className="knowledge-page">
    <a className="page-back" href={dao || qiwu ? '#knowledge' : '#top'}><ArrowLeft size={17} />{dao || qiwu ? '返回知识库' : '返回工作台'}</a>
    <section className="classic-search" aria-label="知识库全文搜索">
      <label htmlFor="classic-search-input">搜索原文</label>
      <div className="classic-search-field"><Search size={18} aria-hidden="true" />
        <Input id="classic-search-input" type="search" placeholder="输入词语或句子，如：上善若水" value={query} onChange={(event) => setQuery(event.target.value)} aria-describedby="classic-search-hint" aria-controls="classic-search-results" />
        {query && <Button variant="ghost" onClick={() => setQuery('')}>清空</Button>}
      </div>
      <p id="classic-search-hint">搜索《道德经》《齐物论》全文，可忽略标点和空格。</p>
      <output>{query.trim() ? (results.length ? `找到 ${results.length} 处，点击结果定位原文。` : '没有找到匹配的原文，试试更短的词语。') : ''}</output>
      <ul id="classic-search-results" className="classic-search-results">
        {results.map((result) => <li key={`${result.id}-${result.start}`}><a href={result.href} onClick={() => {
          if (window.location.hash === result.href) scrollToSearchHit(result.href);
        }}><strong>{result.title}</strong><span>{result.before}<mark>{result.matched}</mark>{result.after}</span></a></li>)}
      </ul>
    </section>
    {!dao && !qiwu ? <>
      <header className="knowledge-heading"><p className="section-kicker">KNOWLEDGE LIBRARY · 公开阅读</p><h1>知识库</h1><p>读经典，留一处慢慢理解的地方。</p></header>
      <div className="book-grid">
        <article className="book-card"><div className="book-spine">道</div><div><span>老子 · 先秦</span><h2>道德经</h2><p>八十一章，九个 Part。原文、注音与随文简释。</p><a href="#knowledge/daodejing/1">开始阅读 <ArrowRight size={17} /></a></div></article>
        <article className="book-card"><div className="book-spine">庄</div><div><span>庄子 · 内篇第二</span><h2>齐物论</h2><p>从天籁到梦蝶，按原文自然段阅读全文。</p><a href="#knowledge/qiwulun">开始阅读 <ArrowRight size={17} /></a></div></article>
      </div>
      <section className="library-editorial"><BookOpen size={20} /><p>简体整理，保留底本文字及异体字。生僻词上方为现代普通话拼音，括号内是本站整理的简短助读释义；古籍异读、断句及解释有分歧，不作为唯一训诂结论。正文来源及许可见各书阅读页。</p></section>
    </> : <>
      <header className="knowledge-heading"><p className="section-kicker">{dao ? '老子 · 王弼本经文' : '庄子 · 内篇第二'}</p><h1>{dao ? '道德经' : '齐物论'}</h1><p>{dao ? `Part ${part} / 9 · 第 ${(part - 1) * 9 + 1}—${part * 9} 章` : '全文 · 依底本自然段排列'}</p></header>
      <div className="reading-toolbar"><label htmlFor="classic-notes"><Checkbox id="classic-notes" checked={notes} onCheckedChange={setNotes} />显示括号简释</label><span>生僻词上方注音 · 正文可直接选中复制</span></div>
      <div className="reader-layout">
        <nav className="reader-toc" aria-label={dao ? '道德经分组目录' : '齐物论段落目录'}>
          <h2>阅读目录</h2>
          {dao ? Array.from({ length: 9 }, (_, i) => <a key={i} aria-current={part === i + 1 ? 'page' : undefined} href={`#knowledge/daodejing/${i + 1}`}><strong>Part {i + 1}</strong><span>第 {i * 9 + 1}—{i * 9 + 9} 章</span></a>) : classics.qiwulun.map((p, i) => <button key={i} onClick={() => document.getElementById(`qiwu-${i}`)?.scrollIntoView({ behavior: 'smooth' })}>{String(i + 1).padStart(2, '0')} · {p.slice(0, 7)}…</button>)}
        </nav>
        <div className="reader-paper">
          {dao ? chapters.map((chapter) => <article className="classic-chapter" key={chapter.number}><h2>第{chapter.title}</h2>{chapter.paragraphs.map((p, i) => <AnnotatedParagraph key={i} text={p} notes={notes} query={query} paragraph={`dao-${chapter.number}-${i}`} />)}</article>) : classics.qiwulun.map((p, i) => <article id={`qiwu-${i}`} className="classic-chapter" key={i}><h2 className="paragraph-number">段落 {String(i + 1).padStart(2, '0')}</h2><AnnotatedParagraph text={p} notes={notes} query={query} paragraph={`qiwu-${i}`} /></article>)}
          {dao && <nav className="reader-pagination" aria-label="切换分组">{part > 1 ? <a href={`#knowledge/daodejing/${part - 1}`}><ArrowLeft size={16} />上一 Part</a> : <span />}{part < 9 ? <a href={`#knowledge/daodejing/${part + 1}`}>下一 Part<ArrowRight size={16} /></a> : <a href="#knowledge">返回书架</a>}</nav>}
          <aside className="classic-source"><h2>版本与助读说明</h2><p>原文：<a href={dao ? classics.sources.daodejing : classics.sources.qiwulun} target="_blank" rel="noreferrer">维基文库 · {dao ? '《道德经（王弼本）》' : '《庄子·齐物论》'}</a>，整理日期 {classics.retrieved}。{dao ? '仅收经文，不收王弼注文和卷后跋文；每九章分组仅为本站阅读编排，不是古籍原有分卷。' : '保留底本自然段，去除网页上的异文悬浮提示。'}</p><p>简释为本站编写的阅读提示，不是古人原文；词义依语境简化，异读处从常见读法。字音参考<a href="https://www.zdic.net/" target="_blank" rel="noreferrer">汉典</a>。原典属于公版作品；所用维基文库整理内容依 <a href="https://creativecommons.org/licenses/by-sa/4.0/deed.zh-hans" target="_blank" rel="noreferrer">CC BY-SA 4.0</a> 标注来源，本页整理文本与简释同许可。未复制现代整篇译文。</p></aside>
        </div>
      </div>
    </>}
  </main>;
}
