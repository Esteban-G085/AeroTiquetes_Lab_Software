// Une clases CSS ignorando valores vacíos: cn('btn', cond && 'btn-sm')
export const cn = (...parts) => parts.filter(Boolean).join(' ')
