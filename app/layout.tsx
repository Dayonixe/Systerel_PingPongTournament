import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: "Tournoi de l'été · Systerel Ping-pong",
  description:
    'Scores, classements et tableaux du tournoi de ping-pong Systerel.',
  metadataBase: new URL('https://dayonixe.github.io/'),
  icons: {
    icon: '/Systerel_PingPongTournament/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
