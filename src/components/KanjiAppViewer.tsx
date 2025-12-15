import React from 'react';
import styles from '../styles/components/KanjiAppViewer.module.css';

/**
 * 漢字アプリビューアーコンポーネント
 * 
 * かんじチャレンジアプリをiframeで表示します。
 */
interface KanjiAppViewerProps {
  kanjiAppUrl: string;
  onBack: () => void;
}

export const KanjiAppViewer: React.FC<KanjiAppViewerProps> = ({ kanjiAppUrl, onBack }) => {
  return (
    <div className={styles.container}>
      {/* ナビゲーションバー（iframe外に配置） */}
      <div className={styles.navbar}>
        <button className={styles.backButton} onClick={onBack}>
          アプリ選択画面
        </button>
      </div>
      
      {/* iframe領域 */}
      <div className={styles.iframeContainer}>
        <iframe
          src={kanjiAppUrl}
          className={styles.iframe}
          title="かんじチャレンジ"
          allow="fullscreen"
        />
      </div>
    </div>
  );
};

