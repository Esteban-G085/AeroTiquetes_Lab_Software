import { useEffect, useState } from 'react'

/** Reloj que se actualiza cada `everyMs` (por defecto 30 s): sirve para cuentas regresivas reales de reservas. */
export function useNow(everyMs = 30_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), everyMs)
    return () => clearInterval(id)
  }, [everyMs])
  return now
}
