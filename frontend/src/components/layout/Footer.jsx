import { Wordmark } from '@/components/brand'

/** Pie sencillo: marca y año. Sin enlaces a páginas que no existen. */
export default function Footer() {
  return (
    <footer className="at-footer">
      <div className="container at-footer__row">
        <Wordmark size={28} />
        <p className="at-footer__copy">© {new Date().getFullYear()} AeroTiquetes · Reservas en línea</p>
      </div>
    </footer>
  )
}
