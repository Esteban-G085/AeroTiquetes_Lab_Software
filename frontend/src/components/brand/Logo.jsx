import { useId } from 'react'

/** Marca de AeroTiquetes: avión sobre disco azul con órbita (reproducción vectorial de la identidad original). */
export default function Logo({ size = 48, title = 'AeroTiquetes', className }) {
  const gid = useId()
  return (
    <svg
      className={`at-logo${className ? ` ${className}` : ''}`}
      width={size} height={size} viewBox="0 0 100 100" role={title ? 'img' : undefined}
      aria-label={title || undefined} aria-hidden={title ? undefined : true}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5a8cee" />
          <stop offset="1" stopColor="#1d3f9a" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="50" fill={`url(#${gid})`} />
      <ellipse cx="50" cy="52" rx="38" ry="21" transform="rotate(-18 50 52)" fill="none" stroke="#fff" strokeOpacity=".5" strokeWidth="2.5" />
      <g transform="translate(50 50) rotate(50) scale(2.7) translate(-12 -12)">
        <path fill="#fff" d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
      </g>
    </svg>
  )
}
