import React from 'react';
import styles from '../styles/components/AppSelector.module.css';

/**
 * 戻るボタンコンポーネント
 * 
 * iframe表示画面で使用される戻るボタンです。
 */
interface BackButtonProps {
  onClick: () => void;
  style?: React.CSSProperties;
}

export const BackButton: React.FC<BackButtonProps> = ({ onClick, style }) => {
  return (
    <button 
      type="button" 
      className={styles.iframeBackButton} 
      onClick={onClick}
      style={style}
    >
      ← ホームに戻る
    </button>
  );
};

