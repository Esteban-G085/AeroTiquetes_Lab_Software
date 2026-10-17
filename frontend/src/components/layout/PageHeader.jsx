/** Encabezado de pantalla: título (h1 serif), subtítulo y acciones. */
export default function PageHeader({ eyebrow, title, subtitle, actions }) {
  return (
    <header className="at-pageheader at-enter">
      <div>
        {eyebrow && <p className="at-pageheader__eyebrow">{eyebrow}</p>}
        <h1 className="at-pageheader__title">{title}</h1>
        {subtitle && <p className="at-pageheader__sub">{subtitle}</p>}
      </div>
      {actions && <div className="at-pageheader__actions">{actions}</div>}
    </header>
  )
}
