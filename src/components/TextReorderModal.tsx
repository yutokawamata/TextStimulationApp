import React, { useState, useEffect } from 'react';
import styles from '../styles/components/TextModal.module.css';

interface StoryInfo {
  filename: string;
  label: string;
}

interface TextReorderModalProps {
  isOpen: boolean;
  onClose: () => void;
  stories: StoryInfo[];
  gradeFolder: string;
  gradeLabel: string;
  onReorder: (token: string, reorderedStories: StoryInfo[]) => Promise<void>;
}

export const TextReorderModal: React.FC<TextReorderModalProps> = ({
  isOpen,
  onClose,
  stories,
  gradeFolder,
  gradeLabel,
  onReorder,
}) => {
  const [orderedStories, setOrderedStories] = useState<StoryInfo[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // モーダルが開かれたら、現在の順番をコピー
      setOrderedStories([...stories]);
      setSelectedIndex(null);
    }
  }, [isOpen, stories]);

  const handleMoveUp = () => {
    if (selectedIndex === null || selectedIndex === 0) return;
    
    const newStories = [...orderedStories];
    // 選択された要素と1つ上の要素を入れ替え
    [newStories[selectedIndex - 1], newStories[selectedIndex]] = 
    [newStories[selectedIndex], newStories[selectedIndex - 1]];
    
    setOrderedStories(newStories);
    setSelectedIndex(selectedIndex - 1);
  };

  const handleMoveDown = () => {
    if (selectedIndex === null || selectedIndex === orderedStories.length - 1) return;
    
    const newStories = [...orderedStories];
    // 選択された要素と1つ下の要素を入れ替え
    [newStories[selectedIndex], newStories[selectedIndex + 1]] = 
    [newStories[selectedIndex + 1], newStories[selectedIndex]];
    
    setOrderedStories(newStories);
    setSelectedIndex(selectedIndex + 1);
  };

  const handleSave = async () => {
    // sessionStorageからトークンを取得
    const token = sessionStorage.getItem('github_token') || '';
    if (!token.trim()) {
      alert('GitHub Personal Access Tokenが設定されていません。\n文章リスト変更画面でトークンを入力してください。');
      return;
    }

    setIsSaving(true);
    try {
      await onReorder(token, orderedStories);
      onClose();
      alert('文章の並び替えを保存しました。\nリストに反映されるまで時間がかかる場合があります。');
    } catch (error) {
      console.error('並び替えの保存に失敗:', error);
      alert(`並び替えの保存に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>文章の並び替え: {gradeLabel}</h2>
        
        <div className={styles.reorderContainer}>
          <div className={styles.reorderList}>
            {orderedStories.map((story, index) => (
              <div
                key={story.filename}
                className={`${styles.reorderItem} ${selectedIndex === index ? styles.selected : ''}`}
                onClick={() => setSelectedIndex(index)}
              >
                <span className={styles.reorderNumber}>{index + 1}.</span>
                <span className={styles.reorderLabel}>{story.label}</span>
              </div>
            ))}
          </div>

          <div className={styles.reorderButtons}>
            <button
              type="button"
              className={`button ${styles.moveButton}`}
              onClick={handleMoveUp}
              disabled={selectedIndex === null || selectedIndex === 0}
            >
              ↑ 上へ
            </button>
            <button
              type="button"
              className={`button ${styles.moveButton}`}
              onClick={handleMoveDown}
              disabled={selectedIndex === null || selectedIndex === orderedStories.length - 1}
            >
              ↓ 下へ
            </button>
          </div>
        </div>

        <div className={styles.modalActions}>
          <button
            type="button"
            className={`button ${styles.cancelButton}`}
            onClick={onClose}
            disabled={isSaving}
          >
            キャンセル
          </button>
          <button
            type="button"
            className={`button ${styles.submitButton}`}
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
};
