import type { ReactNode } from 'react';

interface PopupProps {
  open: boolean;
  title: string;
  children?: ReactNode;
  /** Action buttons rendered in the footer. */
  actions?: ReactNode;
  onClose?: () => void;
}

/**
 * Custom in-app modal. The project forbids native browser dialogs
 * (alert/confirm), so all confirmations and errors route through this.
 */
export function Popup({ open, title, children, actions, onClose }: PopupProps) {
  if (!open) return null;
  return (
    <div className="popup-scrim" role="presentation" onClick={onClose}>
      <div
        className="popup-card"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="popup-title">{title}</h2>
        {children && <div className="popup-body">{children}</div>}
        {actions && <div className="popup-actions">{actions}</div>}
      </div>
    </div>
  );
}
