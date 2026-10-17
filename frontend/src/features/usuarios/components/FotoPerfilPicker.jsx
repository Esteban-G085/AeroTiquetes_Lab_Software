import { useEffect, useMemo, useRef } from 'react'
import { Icon } from '@/components/ui'

/** Selector circular de foto de perfil (opcional) con vista previa. Valida el archivo en el padre. */
export default function FotoPerfilPicker({ file, error, onChange }) {
  const inputRef = useRef(null)
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])

  // Libera la URL temporal al cambiar de foto o al desmontar
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])

  const pick = (e) => {
    const chosen = e.target.files?.[0] ?? null
    onChange(chosen)
    e.target.value = '' // permite volver a elegir el mismo archivo
  }

  return (
    <div className="us-foto">
      <button
        type="button" className="us-foto__btn" aria-labelledby="foto-label"
        onClick={() => inputRef.current?.click()}
      >
        {previewUrl
          ? <img src={previewUrl} alt="Vista previa de tu foto de perfil" />
          : <Icon name="user" size={34} />}
        <span className="us-foto__badge" aria-hidden="true"><Icon name="camera" size={14} /></span>
      </button>
      <div className="us-foto__text">
        <span className="us-foto__label" id="foto-label">Elegir foto de perfil</span>
        <span className="us-foto__hint">Opcional · JPG o PNG, hasta 2 MB</span>
        {file && <button type="button" className="us-foto__remove" onClick={() => onChange(null)}>Quitar foto</button>}
      </div>
      <input
        ref={inputRef} type="file" accept="image/jpeg,image/png" className="visually-hidden"
        tabIndex={-1} aria-label="Archivo de foto de perfil" onChange={pick}
      />
      {error && <div role="alert" className="us-foto__error">{error}</div>}
    </div>
  )
}
