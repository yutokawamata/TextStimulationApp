import React from 'react';
import styles from '../styles/components/TextManageModal.module.css';

interface TextManageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: () => void;
  onDelete: () => void;
  onReorder: () => void;
  hasStories: boolean;
  canReorder: boolean;
}

export const TextManageModal: React.FC<TextManageModalProps> = ({
  isOpen,
  onClose,
  onAdd,
  onDelete,
  onReorder,
  hasStories,
  canReorder,
}) => {
  // デバッグ用ログ
  React.useEffect(() => {
    if (isOpen) {
      console.log('[TextManageModal] hasStories:', hasStories, 'canReorder:', canReorder);
    }
  }, [isOpen, hasStories, canReorder]);

  if (!isOpen) return null;

  const handleAdd = () => {
    onClose();
    onAdd();
  };

  const handleDelete = () => {
    onClose();
    onDelete();
  };

  const handleReorder = () => {
    onClose();
    onReorder();
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>文章リスト変更</h2>
          <button className={styles.closeButton} onClick={onClose}>
            ×
          </button>
        </div>
        
        <div className={styles.content}>
          <p className={styles.description}>操作を選択してください</p>
          
          <div className={styles.buttonGroup}>
            <button
              type="button"
              className={`button ${styles.actionButton} ${styles.addButton}`}
              onClick={handleAdd}
            >
              <span className={styles.icon}>➕</span>
              <span className={styles.label}>文章追加</span>
            </button>

            <button
              type="button"
              className={`button ${styles.actionButton} ${styles.deleteButton}`}
              onClick={handleDelete}
              disabled={!hasStories}
            >
              <span className={styles.icon}>🗑️</span>
              <span className={styles.label}>文章削除</span>
            </button>

            <button
              type="button"
              className={`button ${styles.actionButton} ${styles.reorderButton}`}
              onClick={handleReorder}
              disabled={!canReorder}
            >
              <span className={styles.icon}>↕️</span>
              <span className={styles.label}>文章並び替え</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
