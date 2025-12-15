import React from 'react';
import styles from '../styles/components/AppSelector.module.css';

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
    <div className={styles.iframeContainer}>
      <iframe
        src={kanjiAppUrl}
        className={styles.iframe}
        title="かんじチャレンジ"
        allow="fullscreen"
      />
    </div>
  );
};

