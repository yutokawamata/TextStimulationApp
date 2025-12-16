import React, { useState, useEffect } from 'react';
import styles from '../styles/components/TextManageModal.module.css';

interface GradeInfo {
  folder: string;
  label: string;
  stories: Array<{ filename: string; label: string }>;
}

interface TextManageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (gradeFolder: string) => void;
  onDelete: (gradeFolder: string) => void;
  onReorder: (gradeFolder: string) => void;
  grades: GradeInfo[];
  initialGrade: string;
}

export const TextManageModal: React.FC<TextManageModalProps> = ({
  isOpen,
  onClose,
  onAdd,
  onDelete,
  onReorder,
  grades,
  initialGrade,
}) => {
  const [selectedGrade, setSelectedGrade] = useState<string>(initialGrade);
  const [githubToken, setGithubToken] = useState<string>('');

  // モーダルが開かれたときに初期学年とトークンを設定
  useEffect(() => {
    if (isOpen) {
      setSelectedGrade(initialGrade);
      // sessionStorageからトークンを読み込む
      const savedToken = sessionStorage.getItem('github_token') || '';
      setGithubToken(savedToken);
    }
  }, [isOpen, initialGrade]);

  if (!isOpen) return null;

  const selectedGradeInfo = grades.find(g => g.folder === selectedGrade);
  const hasStories = selectedGradeInfo ? selectedGradeInfo.stories.length > 0 : false;
  const canReorder = selectedGradeInfo ? selectedGradeInfo.stories.length > 1 : false;

  // トークンをsessionStorageに保存
  const saveToken = () => {
    if (githubToken.trim()) {
      sessionStorage.setItem('github_token', githubToken.trim());
    }
  };

  const handleAdd = () => {
    if (!githubToken.trim()) {
      alert('GitHub Personal Access Tokenを入力してください。');
      return;
    }
    saveToken();
    onClose();
    onAdd(selectedGrade);
  };

  const handleDelete = () => {
    if (!githubToken.trim()) {
      alert('GitHub Personal Access Tokenを入力してください。');
      return;
    }
    saveToken();
    onClose();
    onDelete(selectedGrade);
  };

  const handleReorder = () => {
    if (!githubToken.trim()) {
      alert('GitHub Personal Access Tokenを入力してください。');
      return;
    }
    saveToken();
    onClose();
    onReorder(selectedGrade);
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
          <div className={styles.formGroup}>
            <label className={styles.gradeLabel} htmlFor="grade-select-manage">
              学年を選択
            </label>
            <select
              id="grade-select-manage"
              className={styles.gradeSelect}
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
            >
              {grades.map((grade) => (
                <option key={grade.folder} value={grade.folder}>
                  {grade.label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.gradeLabel} htmlFor="github-token-manage">
              GitHub Personal Access Token
            </label>
            <input
              id="github-token-manage"
              type="password"
              value={githubToken}
              onChange={(e) => setGithubToken(e.target.value)}
              placeholder="トークンを入力してください"
              className={styles.tokenInput}
            />
          </div>

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

          <div className={styles.notice}>
            ⚠️ 変更後、リストに反映されるまで時間がかかる場合があります。<br />
            しばらく待ってからリロードボタン（🔄）を押してください。
          </div>
        </div>
      </div>
    </div>
  );
};
