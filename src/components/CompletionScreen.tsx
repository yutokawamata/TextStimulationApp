import React from 'react';
import styles from '../styles/components/CompletionScreen.module.css';

/**
 * 完了画面コンポーネント
 * 
 * 全文節モードの練習完了後に表示される画面です。
 * - 左側: 頑張りました画像
 * - 右側: 読み上げに要した時間と「おわり」ボタン
 */
interface CompletionScreenProps {
  elapsedTime: number; // 経過時間（ミリ秒）
  onFinish: () => void; // 「おわり」ボタンが押された時に呼ばれるコールバック
}

/**
 * ミリ秒を「X分Y秒」形式の文字列に変換する
 * @param milliseconds - ミリ秒
 * @returns 「X分Y秒」形式の文字列
 */
const formatTime = (milliseconds: number): string => {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  
  if (minutes > 0) {
    return `${minutes}分${seconds}秒`;
  } else {
    return `${seconds}秒`;
  }
};

export const CompletionScreen: React.FC<CompletionScreenProps> = ({ elapsedTime, onFinish }) => {
  const timeText = formatTime(elapsedTime);

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        {/* 左側: 頑張りました画像 */}
        <div className={styles.leftSection}>
          <img 
            src={`${process.env.PUBLIC_URL || ''}/hardwork.png`}
            alt="頑張りました"
            className={styles.image}
          />
        </div>

        {/* 右側: 時間表示とおわりボタン */}
        <div className={styles.rightSection}>
          {/* 時間表示 */}
          <div className={styles.timeDisplay}>
            <p className={styles.timeText}>{timeText} でした。</p>
          </div>

          {/* おわりボタン */}
          <button
            type="button"
            className={`button ${styles.finishButton}`}
            onClick={onFinish}
          >
            おわり
          </button>
        </div>
      </div>
    </div>
  );
};

