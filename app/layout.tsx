import type { Metadata, Viewport } from 'next';
import { PwaRegistration } from './pwa-registration';
import './globals.css';

const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1];
const isGitHubProjectPage = Boolean(
  process.env.GITHUB_ACTIONS === 'true' &&
  repositoryName &&
  !repositoryName.endsWith('.github.io'),
);
const basePath = isGitHubProjectPage ? `/${repositoryName}` : '';
const withBasePath = (path: string) => `${basePath}${path}`;

export const metadata: Metadata = {
  title: "Tournoi de l'été · Systerel Ping-pong",
  applicationName: 'Systerel Ping-pong',
  description:
    'Scores, classements et tableaux du tournoi de ping-pong Systerel.',
  metadataBase: new URL(`https://dayonixe.github.io${basePath}/`),
  manifest: withBasePath('/manifest.webmanifest'),
  icons: {
    icon: [
      {
        url: withBasePath('/favicon.svg'),
        type: 'image/svg+xml',
      },
    ],
    apple: [
      {
        url: withBasePath('/icons/apple-touch-icon.png'),
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Systerel TT',
  },
};

export const viewport: Viewport = {
  themeColor: '#123d36',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>
        {children}
        <PwaRegistration />
      </body>
    </html>
  );
}
