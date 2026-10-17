import Modal from './Modal'
import Button from './Button'

/** Confirmación de acciones destructivas (ej. eliminar administrador, HU23). */
export default function ConfirmDialog({
  open, title, message, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar',
  danger = false, loading = false, onConfirm, onCancel,
}) {
  return (
    <Modal
      open={open} title={title} onClose={onCancel}
      footer={
        <>
          <Button variant="outline-secondary" onClick={onCancel} disabled={loading}>{cancelLabel}</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
        </>
      }
    >
      <p className="mb-0">{message}</p>
    </Modal>
  )
}
