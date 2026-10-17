import { useId } from 'react'

/**
 * Ilustración de marca: cielo, nubes y una ruta de vuelo punteada entre dos ciudades.
 * Es 100 % vectorial (ligera, sin fotos) y decorativa: aria-hidden.
 * El contenedor pone el degradado (clase .at-sky); esto dibuja encima.
 */
export default function SkyArt({ className = '', variant = 'tall' }) {
  const id = useId()

  // Variante panorámica para franjas anchas y bajas (portada del perfil): la ruta queda en la franja central
  if (variant === 'wide') {
    return (
      <svg className={`at-skyart ${className}`} viewBox="0 0 1200 240" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
        <defs>
          <radialGradient id={`${id}-glow`} cx="72%" cy="10%" r="50%">
            <stop offset="0" stopColor="#8eb3f6" stopOpacity=".5" />
            <stop offset="1" stopColor="#8eb3f6" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${id}-trail`} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="1" stopColor="#fff" stopOpacity=".85" />
          </linearGradient>
        </defs>
        <rect width="1200" height="240" fill={`url(#${id}-glow)`} />
        <g fill="#fff">
          {[[80, 40, 1.4], [200, 120, 1.1], [420, 30, 1.5], [560, 90, 1], [760, 36, 1.3], [980, 70, 1.5], [1120, 30, 1.2], [1100, 150, 1]].map(([x, y, r]) => (
            <circle key={`${x}${y}`} cx={x} cy={y} r={r} opacity=".6" />
          ))}
        </g>
        <g className="at-skyart__cloud at-skyart__cloud--a" fill="#fff" opacity=".12">
          <rect x="60" y="170" width="260" height="40" rx="20" /><circle cx="130" cy="170" r="30" /><circle cx="200" cy="160" r="38" />
        </g>
        <g className="at-skyart__cloud at-skyart__cloud--b" fill="#fff" opacity=".1">
          <rect x="900" y="150" width="280" height="44" rx="22" /><circle cx="980" cy="150" r="34" /><circle cx="1060" cy="140" r="44" />
        </g>
        <path d="M340 190 C 470 50, 700 25, 870 88" fill="none" stroke={`url(#${id}-trail)`} strokeWidth="3" strokeLinecap="round" strokeDasharray="2 12" />
        <circle cx="340" cy="190" r="6" fill="#fff" /><circle cx="340" cy="190" r="13" fill="none" stroke="#fff" strokeOpacity=".4" />
        <g transform="translate(870 88) rotate(110) scale(2.4) translate(-12 -12)">
          <path fill="#fff" d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
        </g>
      </svg>
    )
  }

  return (
    <svg className={`at-skyart ${className}`} viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={`${id}-sun`} cx="78%" cy="18%" r="45%">
          <stop offset="0" stopColor="#8eb3f6" stopOpacity=".5" />
          <stop offset="1" stopColor="#8eb3f6" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-trail`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#fff" stopOpacity=".85" />
        </linearGradient>
      </defs>

      <rect width="800" height="600" fill={`url(#${id}-sun)`} />

      {/* estrellas / puntos de luz */}
      <g fill="#fff">
        {[[190, 90, 1.6], [250, 170, 1.2], [340, 60, 1.4], [470, 110, 1], [560, 70, 1.5], [620, 150, 1.1], [200, 300, 1], [610, 330, 1.3]].map(([x, y, r]) => (
          <circle key={`${x}${y}`} cx={x} cy={y} r={r} opacity=".6" />
        ))}
      </g>

      {/* nubes */}
      <g className="at-skyart__cloud at-skyart__cloud--a" fill="#fff" opacity=".13">
        <rect x="40" y="410" width="260" height="46" rx="23" />
        <circle cx="120" cy="410" r="34" /><circle cx="190" cy="398" r="44" /><circle cx="250" cy="414" r="28" />
      </g>
      <g className="at-skyart__cloud at-skyart__cloud--b" fill="#fff" opacity=".1">
        <rect x="470" y="470" width="300" height="52" rx="26" />
        <circle cx="560" cy="470" r="38" /><circle cx="640" cy="456" r="50" /><circle cx="715" cy="476" r="30" />
      </g>
      <g className="at-skyart__cloud at-skyart__cloud--c" fill="#fff" opacity=".08">
        <rect x="330" y="250" width="180" height="34" rx="17" />
        <circle cx="390" cy="250" r="24" /><circle cx="445" cy="242" r="32" />
      </g>

      {/* ruta de vuelo */}
      {/* Toda la acción queda en la franja central (x 160-640): así se ve completa aunque el contenedor
          sea vertical y el SVG se recorte por los lados. */}
      <path d="M190 395 C 235 225, 430 150, 590 235" fill="none" stroke={`url(#${id}-trail)`} strokeWidth="3" strokeLinecap="round" strokeDasharray="2 12" />
      <circle cx="190" cy="395" r="7" fill="#fff" /><circle cx="190" cy="395" r="15" fill="none" stroke="#fff" strokeOpacity=".4" />
      <g transform="translate(590 235) rotate(118) scale(2.6) translate(-12 -12)">
        <path fill="#fff" d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
      </g>
    </svg>
  )
}
