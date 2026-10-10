import './globals.css';
import { Space_Grotesk, Figtree } from 'next/font/google';

const display = Space_Grotesk({ subsets: ['latin'], variable: '--font-display', weight: ['500', '700'] });
const body = Figtree({ subsets: ['latin'], variable: '--font-body' });

export const metadata = {
  title: 'Physics Quiz',
  description: 'Interactive physics question bank',
  icons: {
    icon: '/icon.svg',
  },
};

export const viewport = { themeColor: '#05061a' };

// purely decorative floating equations (deterministic, no randomness => no hydration mismatch)
const FORMULAS = [
  ['E = mc²', 6, 12, 0], ['F = ma', 82, 22, 4], ['v = λf', 14, 58, 8], ['ΔxΔp ≥ ħ/2', 70, 66, 2],
  ['PV = nRT', 38, 84, 6], ['p = mv', 90, 48, 10], ['F = G·m₁m₂/r²', 4, 86, 12], ['ΔS ≥ 0', 56, 8, 14],
  ['V = IR', 24, 30, 3], ['λ = h/p', 76, 90, 9],
];

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <div className="cosmos" aria-hidden="true">
          <div className="nebula n1" />
          <div className="nebula n2" />
          <div className="nebula n3" />
          <div className="stars s1" />
          <div className="stars s2" />
          {FORMULAS.map(([t, x, y, d], i) => (
            <span key={i} className="eq" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `-${d * 2}s`, animationDuration: `${26 + (i % 4) * 6}s` }}>{t}</span>
          ))}
        </div>
        <div className="app">{children}</div>
      </body>
    </html>
  );
}
