import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: "Tournoi de l'été · Systerel Ping-pong",
  description:
    'Scores, classements et tableaux du tournoi de ping-pong Systerel.',
  metadataBase: new URL('https://dayonixe.github.io/'),
  openGraph: {
    title: "Tournoi de l'été · Systerel Ping-pong",
    description:
      'Suivez les scores, les classements et la course aux grandes finales.',
    type: 'website',
    locale: 'fr_FR',
    images: [
      {
        url: '/Systerel_PingPongTournament/og.png',
        width: 1731,
        height: 909,
        alt: "Affiche du tournoi de ping-pong de l'été",
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: "Tournoi de l'été · Systerel Ping-pong",
    description:
      'Suivez les scores, les classements et la course aux grandes finales.',
    images: ['/Systerel_PingPongTournament/og.png'],
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
