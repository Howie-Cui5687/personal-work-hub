export const quickLinks = [
  { name: 'GitHub', note: '代码与项目', href: 'https://github.com', featured: true },
  { name: 'Supabase', note: '数据与认证', href: 'https://supabase.com', featured: true },
  { name: 'YouTube', note: '视频与学习', href: 'https://www.youtube.com', featured: true },
  { name: 'Notion', note: '知识与协作', href: 'https://notion.so', featured: false },
  { name: 'Coursera', note: '系统课程', href: 'https://coursera.org', featured: false },
  { name: 'arXiv', note: '论文检索', href: 'https://arxiv.org', featured: false },
  { name: 'MDN', note: 'Web 文档', href: 'https://developer.mozilla.org', featured: false },
  { name: '少数派', note: '效率与生活', href: 'https://sspai.com', featured: false },
  { name: '知乎', note: '问题与讨论', href: 'https://zhihu.com', featured: false },
  { name: 'Bilibili', note: '视频与课程', href: 'https://bilibili.com', featured: false },
];

export function searchQuickLinks(search: string) {
  const keyword = search.trim().toLocaleLowerCase();
  return quickLinks.filter((link) => keyword
    ? `${link.name} ${link.note} ${link.href}`.toLocaleLowerCase().includes(keyword)
    : link.featured);
}
