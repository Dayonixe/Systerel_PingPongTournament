import tailwindcss from '@tailwindcss/postcss';
import vinext from 'vinext';
import { defineConfig } from 'vite';

const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1];
const isProjectSite = Boolean(
  process.env.GITHUB_ACTIONS === 'true' &&
  repositoryName &&
  !repositoryName.endsWith('.github.io'),
);

export default defineConfig({
  base: isProjectSite ? `/${repositoryName}/` : '/',
  css: { postcss: { plugins: [tailwindcss()] } },
  plugins: [vinext()],
});
