import React from 'react';
import styles from '../styles/components/AppSelector.module.css';

/**
 * アプリ選択画面コンポーネント
 * 
 * かんじチャレンジと文章刺激アプリの選択画面を表示します。
 */
interface AppSelectorProps {
  onSelectKanji: () => void;
  onSelectText: () => void;
}

export const AppSelector: React.FC<AppSelectorProps> = ({ onSelectKanji, onSelectText }) => {
  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <p className={styles.label}>アプリ選択画面</p>
        <button 
          type="button" 
          className={styles.button} 
          onClick={onSelectKanji}
        >
          かんじチャレンジ
        </button>
        <button 
          type="button" 
          className={styles.button} 
          onClick={onSelectText}
        >
          文章刺激アプリ
        </button>
      </div>
    </div>
  );
};

