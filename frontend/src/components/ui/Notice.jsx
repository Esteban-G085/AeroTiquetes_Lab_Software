import { cn } from '@/utils/cn'
import Icon from './Icon'

const ICONS = { danger: 'alert', warning: 'alert', info: 'info', success: 'check' }

/** Aviso en línea (errores de formulario, notas). danger/warning se anuncian como alerta; el resto, como estado. */
export default function Notice({ tone = 'info', className, children, ...rest }) {
  return (
    <div className={cn('at-notice', `at-notice--${tone}`, className)} role={tone === 'danger' ? 'alert' : 'status'} {...rest}>
      <Icon name={ICONS[tone]} size={18} className="at-notice__icon" />
      <div>{children}</div>
    </div>
  )
}
