import Logo from './Logo'

/** Logo + nombre. `tone="light"` para fondos oscuros. */
export default function Wordmark({ size = 36, tone = 'dark', className }) {
  return (
    <span className={`at-wordmark at-wordmark--${tone}${className ? ` ${className}` : ''}`}>
      <Logo size={size} title="" />
      <span className="at-wordmark__text">AeroTiquetes</span>
    </span>
  )
}
