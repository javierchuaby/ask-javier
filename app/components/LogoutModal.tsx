"use client";

interface LogoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function LogoutModal({ isOpen, onClose, onConfirm }: LogoutModalProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black z-50 transition-[var(--transition-opacity)]"
        style={{ opacity: "var(--opacity-backdrop)" }}
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-[500px] mx-4">
          <div
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-3xl p-10 shadow-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Log out</h2>
            <p className="text-[var(--text-secondary)] mb-6">Are you sure you want to log out?</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-[var(--radius-md)] text-[var(--text-primary)] hover:bg-[var(--button-hover)] transition-[var(--transition-colors)]"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                className="px-4 py-2 rounded-[var(--radius-md)] bg-[var(--input-button-bg)] text-[var(--input-button-color)] hover:bg-[var(--input-button-hover)] transition-[var(--transition-colors)]"
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
