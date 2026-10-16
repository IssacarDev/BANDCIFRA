'use client';
import { getChordShape } from '@/lib/chordShapes';

/** Mini-diagrama de violão/guitarra (6 cordas, 5 casas). */
export default function ChordDiagram({ chord, capo = 0 }: { chord: string; capo?: number }) {
  const frets = getChordShape(chord);
  if (!frets) {
    return <div className="p-3 text-xs text-muted">Sem diagrama para {chord}</div>;
  }

  const W = 124, H = 150, left = 26, top = 42, sx = 17, sy = 20, rows = 5;
  const played = frets.filter((f) => f > 0);
  const min = played.length ? Math.min(...played) : 1;
  const max = played.length ? Math.max(...played) : 1;
  const base = max <= rows ? 1 : min;
  const x = (s: number) => left + s * sx;
  const y = (f: number) => top + (f - base + 0.5) * sy;

  const barreStrings = frets.map((f, i) => (f === min && f > 0 ? i : -1)).filter((i) => i >= 0);
  const hasBarre = min > 0 && barreStrings.length >= 3;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Diagrama de ${chord}`}>
      <text x={W / 2} y={16} textAnchor="middle" fontSize="15" fontWeight="700" fill="rgb(var(--chord))">
        {chord}
      </text>
      {capo > 0 && (
        <text x={W / 2} y={30} textAnchor="middle" fontSize="9" fill="rgb(var(--muted))">
          capo {capo}ª casa
        </text>
      )}
      {/* trastes */}
      {Array.from({ length: rows + 1 }).map((_, i) => (
        <line
          key={i}
          x1={x(0)} x2={x(5)} y1={top + i * sy} y2={top + i * sy}
          stroke="rgb(var(--fg))" strokeWidth={i === 0 && base === 1 ? 3.5 : 1} opacity={i === 0 && base === 1 ? 1 : 0.55}
        />
      ))}
      {/* cordas */}
      {Array.from({ length: 6 }).map((_, s) => (
        <line key={s} x1={x(s)} x2={x(s)} y1={top} y2={top + rows * sy} stroke="rgb(var(--fg))" strokeWidth="1" opacity="0.7" />
      ))}
      {base > 1 && (
        <text x={4} y={top + sy * 0.7} fontSize="10" fill="rgb(var(--muted))">
          {base}ª
        </text>
      )}
      {hasBarre && (
        <rect
          x={x(barreStrings[0]) - 5} width={x(barreStrings[barreStrings.length - 1]) - x(barreStrings[0]) + 10}
          y={y(min) - 5} height={10} rx={5} fill="rgb(var(--fg))"
        />
      )}
      {frets.map((f, s) => {
        if (f < 0)
          return (
            <text key={s} x={x(s)} y={top - 5} textAnchor="middle" fontSize="11" fill="rgb(var(--muted))">×</text>
          );
        if (f === 0)
          return <circle key={s} cx={x(s)} cy={top - 8} r={3.5} fill="none" stroke="rgb(var(--muted))" strokeWidth="1.2" />;
        if (hasBarre && f === min) return null;
        return <circle key={s} cx={x(s)} cy={y(f)} r={5.5} fill="rgb(var(--fg))" />;
      })}
    </svg>
  );
}
