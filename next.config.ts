import type { NextConfig } from 'next';

const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? '';
const isUserOrOrganizationSite = repositoryName.endsWith('.github.io');
const githubPagesBasePath =
  process.env.GITHUB_ACTIONS === 'true' && repositoryName && !isUserOrOrganizationSite
    ? `/${repositoryName}`
    : '';

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  // This is a single-page export with fragment navigation. Keep prerendering
  // rooted at /; GitHub Pages supplies the repository prefix at serving time.
  assetPrefix: githubPagesBasePath
    ? `https://${process.env.GITHUB_REPOSITORY?.split('/')[0]}.github.io${githubPagesBasePath}`
    : undefined,
};

export default nextConfig;
