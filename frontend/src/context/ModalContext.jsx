import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import ConfirmationModal from '../components/ui/ConfirmationModal';

const ModalContext = createContext(null);

export function ModalProvider({ children }) {
  const [modalState, setModalState] = useState({
    isOpen: false,
    title: '',
    message: null,
    type: 'warning',
    confirmLabel: 'Confirm',
    cancelLabel: 'Cancel',
    confirmVariant: undefined,
    isLoading: false,
    closeOnBackdrop: true,
    closeOnEscape: true,
    showCloseButton: true,
    autoFocus: 'cancel',
  });

  const resolverRef = useRef(null);

  const closeModal = useCallback(() => {
    if (resolverRef.current) {
      resolverRef.current(false);
      resolverRef.current = null;
    }
    setModalState((prev) => ({ ...prev, isOpen: false, isLoading: false }));
  }, []);

  const handleConfirm = useCallback(() => {
    if (resolverRef.current) {
      resolverRef.current(true);
      resolverRef.current = null;
    }
    setModalState((prev) => ({ ...prev, isOpen: false, isLoading: false }));
  }, []);

  /**
   * Programmatic confirmation dialog returning a Promise<boolean>.
   * Resolves to `true` if user clicks confirm, `false` if cancelled or dismissed.
   */
  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setModalState({
        isOpen: true,
        title: options.title || 'Confirm Action',
        message: options.message || null,
        type: options.type || 'warning',
        confirmLabel: options.confirmLabel || 'Confirm',
        cancelLabel: options.cancelLabel !== undefined ? options.cancelLabel : 'Cancel',
        confirmVariant: options.confirmVariant,
        isLoading: false,
        closeOnBackdrop: options.closeOnBackdrop !== undefined ? options.closeOnBackdrop : true,
        closeOnEscape: options.closeOnEscape !== undefined ? options.closeOnEscape : true,
        showCloseButton: options.showCloseButton !== undefined ? options.showCloseButton : true,
        autoFocus: options.autoFocus || (options.type === 'danger' || options.type === 'warning' ? 'cancel' : 'confirm'),
      });
    });
  }, []);

  /**
   * Programmatic alert / feedback dialog returning a Promise<void>.
   * Resolves when dismissed.
   */
  const alert = useCallback((options) => {
    return new Promise((resolve) => {
      resolverRef.current = () => resolve();
      const isString = typeof options === 'string';
      const title = isString ? 'Notice' : (options.title || 'Notice');
      const message = isString ? options : options.message;
      const type = isString ? 'info' : (options.type || 'info');
      const confirmLabel = isString ? 'Dismiss' : (options.confirmLabel || 'Dismiss');

      setModalState({
        isOpen: true,
        title,
        message,
        type,
        confirmLabel,
        cancelLabel: null, // Single button for alert mode
        confirmVariant: type === 'danger' || type === 'error' ? 'danger' : 'primary',
        isLoading: false,
        closeOnBackdrop: !isString && options.closeOnBackdrop !== undefined ? options.closeOnBackdrop : true,
        closeOnEscape: true,
        showCloseButton: true,
        autoFocus: 'confirm',
      });
    });
  }, []);

  const showModal = useCallback((config) => {
    setModalState({
      isOpen: true,
      ...config,
    });
  }, []);

  return (
    <ModalContext.Provider value={{ confirm, alert, showModal, closeModal }}>
      {children}
      <ConfirmationModal
        isOpen={modalState.isOpen}
        title={modalState.title}
        message={modalState.message}
        type={modalState.type}
        confirmLabel={modalState.confirmLabel}
        cancelLabel={modalState.cancelLabel}
        confirmVariant={modalState.confirmVariant}
        isLoading={modalState.isLoading}
        closeOnBackdrop={modalState.closeOnBackdrop}
        closeOnEscape={modalState.closeOnEscape}
        showCloseButton={modalState.showCloseButton}
        autoFocus={modalState.autoFocus}
        onConfirm={handleConfirm}
        onCancel={closeModal}
        onClose={closeModal}
      />
    </ModalContext.Provider>
  );
}

export function useModal() {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
}
