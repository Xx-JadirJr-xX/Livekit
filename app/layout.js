import './globals.css';

export const metadata = {
  title: 'LiveKit Local PoC',
  description: 'WebRTC App for local network',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, backgroundColor: '#f0f2f5' }}>{children}</body>
    </html>
  );
}
