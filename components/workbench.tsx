'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  ArrowUpRight,
  ArrowLeft,
  BookOpen,
  BriefcaseBusiness,
  Check,
  Clock3,
  FileText,
  Globe2,
  Leaf,
  ListChecks,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type {
  ItemStatus,
  ItemType,
  PrivateItem,
} from '@/lib/database.types';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import { DailyReportModule } from '@/components/daily-report';
import { releases } from '@/lib/releases';

const linkGroups = [
  {
    title: '工作工具',
    icon: BriefcaseBusiness,
    tone: 'clay',
    links: [
      { name: 'GitHub', note: '代码与项目', href: 'https://github.com' },
      { name: 'Supabase', note: '数据与认证', href: 'https://supabase.com' },
      { name: 'Notion', note: '知识与协作', href: 'https://notion.so' },
    ],
  },
  {
    title: '学习资源',
    icon: BookOpen,
    tone: 'moss',
    links: [
      { name: 'Coursera', note: '系统课程', href: 'https://coursera.org' },
      { name: 'arXiv', note: '论文检索', href: 'https://arxiv.org' },
      { name: 'MDN', note: 'Web 文档', href: 'https://developer.mozilla.org' },
    ],
  },
  {
    title: '常看网站',
    icon: Globe2,
    tone: 'sky',
    links: [
      { name: '少数派', note: '效率与生活', href: 'https://sspai.com' },
      { name: '知乎', note: '问题与讨论', href: 'https://zhihu.com' },
      { name: 'Bilibili', note: '视频与课程', href: 'https://bilibili.com' },
    ],
  },
];

const typeMeta: Record<ItemType, { label: string; icon: typeof ListChecks }> = {
  task: { label: '任务', icon: ListChecks },
  study: { label: '学习', icon: BookOpen },
  note: { label: '笔记', icon: FileText },
};

const statusMeta: Record<ItemStatus, string> = {
  planned: '计划中',
  active: '进行中',
  done: '已完成',
};

interface ItemDraft {
  item_type: ItemType;
  title: string;
  content: string;
  status: ItemStatus;
  progress: number;
  due_date: string;
}

const emptyDraft: ItemDraft = {
  item_type: 'task',
  title: '',
  content: '',
  status: 'planned',
  progress: 0,
  due_date: '',
};

type FormSubmitHandler = NonNullable<ComponentProps<'form'>['onSubmit']>;

function formatDate(date: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date));
}

export function Workbench() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const searchRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [items, setItems] = useState<PrivateItem[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState('');
  const [loginOpen, setLoginOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PrivateItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<PrivateItem | null>(null);
  const [draft, setDraft] = useState<ItemDraft>(emptyDraft);
  const [filter, setFilter] = useState<'all' | ItemType>('all');
  const [saving, setSaving] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const reportDirty = useRef(false);
  const onReportDirtyChange = useCallback((dirty: boolean) => { reportDirty.current = dirty; }, []);

  const visibleGroups = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase();
    if (!keyword) return linkGroups;
    return linkGroups
      .map((group) => ({
        ...group,
        links: group.links.filter((link) =>
          `${link.name} ${link.note}`.toLocaleLowerCase().includes(keyword),
        ),
      }))
      .filter((group) => group.links.length > 0);
  }, [search]);

  const fetchItems = useCallback(async () => {
    if (!supabase || !session) return;
    setDataLoading(true);
    setDataError('');
    const { data, error } = await supabase
      .from('private_items')
      .select('*')
      .order('updated_at', { ascending: false });
    if (error) setDataError(`读取失败：${error.message}`);
    else setItems(data ?? []);
    setDataLoading(false);
  }, [session, supabase]);

  useEffect(() => {
    if (!supabase) {
      setAuthReady(true);
      return;
    }

    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthReady(true);
      if (!nextSession) {
        reportDirty.current = false;
        setItems([]);
        setReportOpen(false);
      }
    });

    return () => data.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (session) void fetchItems();
  }, [fetchItems, session]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const filteredItems = useMemo(
    () => items.filter((item) => filter === 'all' || item.item_type === filter),
    [filter, items],
  );

  const counts = useMemo(
    () => ({
      active: items.filter((item) => item.status === 'active').length,
      done: items.filter((item) => item.status === 'done').length,
      study: items.filter((item) => item.item_type === 'study').length,
    }),
    [items],
  );

  const openCreate = () => {
    setEditingItem(null);
    setDraft(emptyDraft);
    setDataError('');
    setEditorOpen(true);
  };

  const openEdit = (item: PrivateItem) => {
    setEditingItem(item);
    setDraft({
      item_type: item.item_type,
      title: item.title,
      content: item.content,
      status: item.status,
      progress: item.progress,
      due_date: item.due_date ?? '',
    });
    setDataError('');
    setEditorOpen(true);
  };

  const saveItem: FormSubmitHandler = async (event) => {
    event.preventDefault();
    if (!supabase || !session || !draft.title.trim()) return;
    setSaving(true);
    setDataError('');

    const payload = {
      item_type: draft.item_type,
      title: draft.title.trim(),
      content: draft.content.trim(),
      status: draft.status,
      progress: Math.max(0, Math.min(100, Number(draft.progress) || 0)),
      due_date: draft.due_date || null,
      updated_at: new Date().toISOString(),
    };

    const result = editingItem
      ? await supabase.from('private_items').update(payload).eq('id', editingItem.id)
      : await supabase.from('private_items').insert({
          ...payload,
          user_id: session.user.id,
        });

    if (result.error) {
      setDataError(`保存失败：${result.error.message}`);
    } else {
      setEditorOpen(false);
      await fetchItems();
    }
    setSaving(false);
  };

  const removeItem = async () => {
    if (!supabase || !deleteItem) return;
    const target = deleteItem;
    setDeleteItem(null);
    setDataError('');
    const { error } = await supabase.from('private_items').delete().eq('id', target.id);
    if (error) setDataError(`删除失败：${error.message}`);
    else setItems((current) => current.filter((item) => item.id !== target.id));
  };

  const signOut = async () => {
    if (!supabase) return;
    if (reportDirty.current && !window.confirm('每日汇报有未保存修改，退出将丢弃这些修改。确定退出？')) return;
    await supabase.auth.signOut();
  };

  return (
    <>
    <main className="site-shell" hidden={reportOpen && Boolean(session)}>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="返回首页">
          <span className="brand-mark"><Leaf size={17} strokeWidth={2.2} /></span>
          <span>我的工作台</span>
        </a>
        <nav className="topnav" aria-label="主导航">
          <a className="is-active" href="#links">导航</a>
          <a href="#now">现在</a>
          <a href="#about">关于</a>
          <a href="#changelog">升版日志</a>
          {session && <a href="#private">私密空间</a>}
        </nav>
        {session ? (
          <Button variant="outline" className="login-link" onClick={signOut}>
            <LogOut /> 退出
          </Button>
        ) : (
          <Button variant="outline" className="login-link" onClick={() => setLoginOpen(true)}>
            <LockKeyhole /> 私密空间
          </Button>
        )}
      </header>

      <section className="intro" id="top">
        <div>
          <p className="eyebrow"><span /> PERSONAL WORKSPACE · 2026</p>
          <h1>把常用入口与<br />正在发生的事，放在一起。</h1>
          <p className="intro-copy">
            这是一个安静、好用的个人工作台：快速抵达常用工具，记录学习与项目进展，
            也给尚未完成的想法留一块生长的地方。
          </p>
        </div>
        <aside className="now-card" id="now">
          <div className="now-card-label"><Clock3 size={15} /> 现在 / NOW</div>
          <p>正在搭建个人知识系统，整理 CFD、编程与长期学习记录。</p>
          <span>更新于 2026.09</span>
        </aside>
      </section>

      <section className="link-section" id="links">
        <div className="section-heading">
          <div>
            <p className="section-kicker">QUICK ACCESS</p>
            <h2>常用入口</h2>
          </div>
          <label className="search-shell">
            <Search size={16} />
            <span className="sr-only">搜索常用网站</span>
            <input
              ref={searchRef}
              aria-label="搜索常用网站"
              placeholder="搜索网站…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <kbd>⌘ K</kbd>
          </label>
        </div>

        {visibleGroups.length ? (
          <div className="link-grid">
            {visibleGroups.map((group) => {
              const Icon = group.icon;
              return (
                <article className={`link-group ${group.tone}`} key={group.title}>
                  <div className="group-title">
                    <span><Icon size={17} /></span>
                    <h3>{group.title}</h3>
                  </div>
                  <div className="group-links">
                    {group.links.map((link) => (
                      <a href={link.href} target="_blank" rel="noreferrer" key={link.name}>
                        <span>
                          <strong>{link.name}</strong>
                          <small>{link.note}</small>
                        </span>
                        <ArrowUpRight size={17} />
                      </a>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="search-empty">没有找到匹配的入口，换个关键词试试。</div>
        )}
      </section>

      <PrivateDesk
        configured={Boolean(supabase)}
        authReady={authReady}
        session={session}
        items={filteredItems}
        counts={counts}
        filter={filter}
        setFilter={setFilter}
        loading={dataLoading}
        error={dataError}
        onLogin={() => setLoginOpen(true)}
        onCreate={openCreate}
        onOpenReport={() => { setReportOpen(true); window.scrollTo(0, 0); }}
        onEdit={openEdit}
        onDelete={setDeleteItem}
      />

      <section className="about-strip" id="about">
        <div>
          <p className="section-kicker">ABOUT THIS SPACE</p>
          <h2>一半是入口，一半是记忆。</h2>
        </div>
        <p>
          公开区域帮助访客了解我在做什么；私密区域只为日常工作服务。
          这里不会保存密码、API 密钥或其他应交给专业密码管理器的机密。
        </p>
      </section>

      <section className="release-log" id="changelog" aria-labelledby="release-log-title">
        <p className="section-kicker">CHANGELOG</p>
        <h2 id="release-log-title">升版记录日志</h2>
        {releases.map((release) => <article className="release-entry" key={release.version}>
          <div className="release-meta"><strong>v{release.version}</strong><time dateTime={release.date}>{release.date}</time></div>
          <h3>{release.title}</h3>
          <ul>{release.changes.map((change) => <li key={change}>{change}</li>)}</ul>
          <p>{release.note}</p>
        </article>)}
      </section>

      <footer>
        <span>© 2026 我的工作台 · <a href="#changelog">v{releases[0].version} · 升版日志</a></span>
        <span className="footer-security"><ShieldCheck size={14} /> Supabase Auth + RLS</span>
      </footer>

      <LoginDialog
        open={loginOpen}
        onOpenChange={setLoginOpen}
        supabase={supabase}
      />

      <ItemEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        draft={draft}
        setDraft={setDraft}
        editing={Boolean(editingItem)}
        saving={saving}
        error={dataError}
        onSubmit={saveItem}
      />

      <AlertDialog open={Boolean(deleteItem)} onOpenChange={(open) => !open && setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia><Trash2 /></AlertDialogMedia>
            <AlertDialogTitle>删除这条记录？</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleteItem?.title}”会从数据库中永久移除，此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={removeItem}>确认删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
    {session && <div hidden={!reportOpen}>
      <main className="report-page">
        <Button variant="outline" onClick={() => {
          setReportOpen(false);
          requestAnimationFrame(() => document.getElementById('private')?.scrollIntoView());
        }}><ArrowLeft />返回私密空间</Button>
        <DailyReportModule key={session.user.id} userId={session.user.id} onDirtyChange={onReportDirtyChange} />
      </main>
    </div>}
    </>
  );
}

interface PrivateDeskProps {
  configured: boolean;
  authReady: boolean;
  session: Session | null;
  items: PrivateItem[];
  counts: { active: number; done: number; study: number };
  filter: 'all' | ItemType;
  setFilter: (value: 'all' | ItemType) => void;
  loading: boolean;
  error: string;
  onLogin: () => void;
  onCreate: () => void;
  onOpenReport: () => void;
  onEdit: (item: PrivateItem) => void;
  onDelete: (item: PrivateItem) => void;
}

function PrivateDesk({
  configured,
  authReady,
  session,
  items,
  counts,
  filter,
  setFilter,
  loading,
  error,
  onLogin,
  onCreate,
  onOpenReport,
  onEdit,
  onDelete,
}: PrivateDeskProps) {
  if (!authReady) {
    return (
      <section className="private-teaser" id="private" aria-busy="true">
        <div className="private-icon"><LoaderCircle className="spin" size={20} /></div>
        <div><p className="section-kicker">PRIVATE DESK</p><h2>正在检查登录状态…</h2></div>
      </section>
    );
  }

  if (!configured || !session) {
    return (
      <section className="private-teaser" id="private">
        <div className="private-icon"><LockKeyhole size={20} /></div>
        <div>
          <p className="section-kicker">PRIVATE DESK</p>
          <h2>{configured ? '你的记录，只对你可见' : '私密空间等待连接'}</h2>
          <p>
            {configured
              ? '登录后管理任务、学习进度和私人笔记。匿名访客不会触发任何私密数据请求。'
              : '复制 .env.example 为 .env.local 并填入 Supabase 项目地址与 Publishable Key。'}
          </p>
        </div>
        <Button onClick={onLogin} disabled={!configured}>
          {configured ? '登录查看' : '尚未配置'}
        </Button>
      </section>
    );
  }

  return (
    <section className="private-desk" id="private">
      <div className="desk-heading">
        <div>
          <p className="section-kicker"><ShieldCheck size={13} /> PRIVATE · RLS PROTECTED</p>
          <h2>欢迎回来，继续今天的进度。</h2>
          <p>{session.user.email}</p>
        </div>
        <Button className="create-button" onClick={onCreate}><Plus /> 新建记录</Button>
      </div>

      <div className="private-feature-grid" aria-label="私密空间功能">
        <button className="private-feature-card" onClick={onOpenReport}>
          <span className="private-feature-icon"><ListChecks size={22} /></span>
          <span><strong>每日工作汇报</strong><small>工作计划、提交资料、寻求帮助与会议预约</small></span>
          <ArrowUpRight size={20} aria-hidden="true" />
        </button>
      </div>

      <div className="metric-grid">
        <div><span>进行中</span><strong>{counts.active}</strong><small>条记录</small></div>
        <div><span>已完成</span><strong>{counts.done}</strong><small>条记录</small></div>
        <div><span>学习记录</span><strong>{counts.study}</strong><small>个主题</small></div>
      </div>

      <div className="desk-toolbar">
        <div className="filter-tabs" aria-label="筛选记录">
          {([
            ['all', '全部'],
            ['task', '任务'],
            ['study', '学习'],
            ['note', '笔记'],
          ] as const).map(([value, label]) => (
            <Button
              key={value}
              size="sm"
              variant={filter === value ? 'default' : 'ghost'}
              onClick={() => setFilter(value)}
            >
              {label}
            </Button>
          ))}
        </div>
        <span>{items.length} 条</span>
      </div>

      {error && <div className="desk-error" role="alert">{error}</div>}
      {loading ? (
        <div className="desk-empty"><LoaderCircle className="spin" /> 正在读取你的数据…</div>
      ) : items.length ? (
        <div className="item-list">
          {items.map((item) => {
            const meta = typeMeta[item.item_type];
            const Icon = meta.icon;
            return (
              <article className="private-item" key={item.id}>
                <div className={`item-type item-type-${item.item_type}`}><Icon /></div>
                <div className="item-body">
                  <div className="item-title-row">
                    <div>
                      <span>{meta.label} · {statusMeta[item.status]}</span>
                      <h3>{item.title}</h3>
                    </div>
                    <div className="item-actions">
                      <Button size="icon-sm" variant="ghost" aria-label={`编辑 ${item.title}`} onClick={() => onEdit(item)}><Pencil /></Button>
                      <Button size="icon-sm" variant="ghost" aria-label={`删除 ${item.title}`} onClick={() => onDelete(item)}><Trash2 /></Button>
                    </div>
                  </div>
                  {item.content && <p>{item.content}</p>}
                  <div className="item-footer">
                    <div className="progress-track" aria-label={`进度 ${item.progress}%`}><span style={{ width: `${item.progress}%` }} /></div>
                    <strong>{item.progress}%</strong>
                    <time>{item.due_date ? `截止 ${formatDate(item.due_date)}` : `更新 ${formatDate(item.updated_at)}`}</time>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="desk-empty">
          <Sparkles />
          <strong>这里还很安静</strong>
          <span>创建第一条任务、学习记录或笔记。</span>
          <Button variant="outline" onClick={onCreate}><Plus /> 新建记录</Button>
        </div>
      )}
    </section>
  );
}

interface LoginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supabase: ReturnType<typeof getSupabaseBrowserClient>;
}

function LoginDialog({ open, onOpenChange, supabase }: LoginDialogProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const login: FormSubmitHandler = async (event) => {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError('');
    const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
    if (loginError) setError('登录失败，请检查邮箱、密码和 Supabase 配置。');
    else {
      setPassword('');
      onOpenChange(false);
      requestAnimationFrame(() => document.querySelector('#private')?.scrollIntoView({ behavior: 'smooth' }));
    }
    setBusy(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="auth-dialog">
        <DialogHeader>
          <div className="dialog-icon"><LockKeyhole /></div>
          <DialogTitle>进入私密空间</DialogTitle>
          <DialogDescription>此处不提供注册入口，仅使用 Supabase 中预先创建的管理员账号。</DialogDescription>
        </DialogHeader>
        <form className="dialog-form" onSubmit={login}>
          <label htmlFor="login-email">
            <span>邮箱</span>
            <Input id="login-email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
          </label>
          <label htmlFor="login-password">
            <span>密码</span>
            <Input id="login-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="auth-security-note"><ShieldCheck /> 登录会话由 Supabase Auth 管理；前端不会保存明文密码。</div>
          <DialogFooter className="dialog-actions">
            <Button type="submit" size="lg" disabled={busy || !supabase}>
              {busy ? <><LoaderCircle className="spin" /> 正在登录</> : '安全登录'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface ItemEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: ItemDraft;
  setDraft: (draft: ItemDraft) => void;
  editing: boolean;
  saving: boolean;
  error: string;
  onSubmit: FormSubmitHandler;
}

function ItemEditor({ open, onOpenChange, draft, setDraft, editing, saving, error, onSubmit }: ItemEditorProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="editor-dialog">
        <DialogHeader>
          <DialogTitle>{editing ? '编辑记录' : '新建记录'}</DialogTitle>
          <DialogDescription>任务、学习与笔记共用一套轻量字段，后续可以再拆成独立模块。</DialogDescription>
        </DialogHeader>
        <form className="dialog-form editor-form" onSubmit={onSubmit}>
          <div className="form-row">
            <label htmlFor="item-type">
              <span>类型</span>
              <NativeSelect id="item-type" className="w-full" value={draft.item_type} onChange={(event) => setDraft({ ...draft, item_type: event.target.value as ItemType })}>
                <NativeSelectOption value="task">任务</NativeSelectOption>
                <NativeSelectOption value="study">学习</NativeSelectOption>
                <NativeSelectOption value="note">笔记</NativeSelectOption>
              </NativeSelect>
            </label>
            <label htmlFor="item-status">
              <span>状态</span>
              <NativeSelect id="item-status" className="w-full" value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as ItemStatus })}>
                <NativeSelectOption value="planned">计划中</NativeSelectOption>
                <NativeSelectOption value="active">进行中</NativeSelectOption>
                <NativeSelectOption value="done">已完成</NativeSelectOption>
              </NativeSelect>
            </label>
          </div>
          <label htmlFor="item-title">
            <span>标题</span>
            <Input id="item-title" required maxLength={120} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="例如：完成湍流模型笔记" />
          </label>
          <label htmlFor="item-content">
            <span>内容</span>
            <Textarea id="item-content" maxLength={4000} value={draft.content} onChange={(event) => setDraft({ ...draft, content: event.target.value })} placeholder="记录下一步、关键结论或上下文…" />
          </label>
          <div className="form-row">
            <label htmlFor="item-progress">
              <span>进度（0–100）</span>
              <Input id="item-progress" type="number" min={0} max={100} value={draft.progress} onChange={(event) => setDraft({ ...draft, progress: Number(event.target.value) })} />
            </label>
            <label htmlFor="item-due-date">
              <span>截止日期（可选）</span>
              <Input id="item-due-date" type="date" value={draft.due_date} onChange={(event) => setDraft({ ...draft, due_date: event.target.value })} />
            </label>
          </div>
          <p className="sensitive-warning">请勿在普通数据库记录中保存密码、恢复码、API 密钥或身份证件。</p>
          {error && <p className="form-error" role="alert">{error}</p>}
          <DialogFooter className="dialog-actions">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
            <Button type="submit" disabled={saving || !draft.title.trim()}>
              {saving ? <><LoaderCircle className="spin" /> 保存中</> : <><Check /> 保存记录</>}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
