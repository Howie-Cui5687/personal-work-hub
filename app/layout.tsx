import type { Metadata } from 'next';
import './globals.css';

const [githubOwner = '', githubRepository = ''] =
  process.env.GITHUB_REPOSITORY?.split('/') ?? [];
const githubPagesUrl = githubRepository.endsWith('.github.io')
  ? `https://${githubRepository}`
  : githubOwner && githubRepository
    ? `https://${githubOwner}.github.io/${githubRepository}`
    : '';
const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL || githubPagesUrl || 'http://localhost:3000'
).replace(/\/$/, '');

export const metadata: Metadata = {
  metadataBase: new URL(`${siteUrl}/`),
  title: '我的工作台 · 个人数字花园',
  description: '聚合常用入口，记录学习、项目与正在发生的事。',
  alternates: { canonical: siteUrl },
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    url: siteUrl,
    title: '我的工作台 · 个人数字花园',
    description: '入口、记录与正在发生的事。',
    images: [{ url: `${siteUrl}/og.png`, width: 1200, height: 630, alt: '我的工作台' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '我的工作台 · 个人数字花园',
    description: '入口、记录与正在发生的事。',
    images: [`${siteUrl}/og.png`],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
