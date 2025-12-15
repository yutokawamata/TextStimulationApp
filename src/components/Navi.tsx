import React, { useState } from 'react';
import styles from '../styles/components/Navi.module.css';

/**
 * アラートメッセージを表示するコンポーネント
 */
const AlertMessage = ({ message, onClose }: { message: string; onClose: () => void }) => {
  return (
    <div className={styles.alertOverlay}>
      <div className={styles.alertBox}>
        <p>{message}</p>
        <button className={styles.alertButton} onClick={onClose}>OK</button>
      </div>
    </div>
  );
};

/**
 * ナビゲーションボタンの設定
 */
interface NavigationButton {
  text: string;
  onClick: () => void;
}

/**
 * ナビゲーション設定の型
 */
interface NavigationConfig {
  showBackButton: boolean;
  backButtonAction?: () => void;
  backButtonText?: string;
  showButtons: NavigationButton[];
}

/**
 * ナビゲーションの状態に基づいてボタンの設定を決定する
 * @param currentApp - 現在のアプリ状態 ('selector' | 'kanji' | 'text' | 'text_home' | 'mode_selection' | 'completion')
 * @param showStartScreen - スタート画面の状態 (0: スタート画面, 1: 文節表示画面)
 * @param onBackToHome - アプリ選択画面に戻る関数
 * @param onBackToTextHome - 文章選択画面に戻る関数
 * @returns 表示するボタンの設定
 */
const getNavigationConfig = (
  currentApp: 'selector' | 'kanji' | 'text' | 'text_home' | 'mode_selection' | 'completion',
  showStartScreen: number,
  onBackToHome: () => void,
  onBackToTextHome: () => void
): NavigationConfig => {
  // アプリ選択画面: ナビバーを表示しない
  if (currentApp === 'selector') {
    return { showBackButton: false, showButtons: [] };
  }

  // 漢字アプリ（iframe表示）: 戻るボタンのみ（アプリ選択画面へ）
  if (currentApp === 'kanji') {
    return {
      showBackButton: true,
      backButtonAction: onBackToHome,
      showButtons: []
    };
  }

  // 文章刺激アプリのホーム画面（文章選択画面）: カスタムボタン（アプリ選択画面へ）
  if (currentApp === 'text_home') {
    return {
      showBackButton: true,
      backButtonAction: onBackToHome,
      backButtonText: 'アプリ選択画面',
      showButtons: []
    };
  }

  // 文章刺激アプリのスタート画面: ナビバー非表示
  if (currentApp === 'text' && showStartScreen === 0) {
    return {
      showBackButton: false,
      showButtons: []
    };
  }

  // 文章刺激アプリの文節表示画面（練習中）: ナビバー非表示
  if (currentApp === 'text' && showStartScreen === 1) {
    return {
      showBackButton: false,
      showButtons: []
    };
  }

  // モード選択画面: カスタムボタン（文章選択画面へ）
  if (currentApp === 'mode_selection') {
    return {
      showBackButton: true,
      backButtonAction: onBackToTextHome,
      backButtonText: '文章選択へ戻る',
      showButtons: []
    };
  }

  // 完了画面: ナビバー非表示
  if (currentApp === 'completion') {
    return {
      showBackButton: false,
      showButtons: []
    };
  }

  return { showBackButton: false, showButtons: [] };
};

/**
 * ナビゲーションコンポーネント
 * 画面遷移のためのナビゲーションボタンを提供する
 */
interface NaviProps {
  currentApp: 'selector' | 'kanji' | 'text' | 'text_home' | 'mode_selection' | 'completion';
  showStartScreen: number;
  onBackToHome: () => void;
  onBackToTextHome: () => void;
}

export const Navi: React.FC<NaviProps> = ({
  currentApp,
  showStartScreen,
  onBackToHome,
  onBackToTextHome
}) => {
  // アラート表示のための状態
  const [alertMessage, setAlertMessage] = useState('');
  const [showAlertBox, setShowAlertBox] = useState(false);

  // アラートを閉じる関数
  const closeAlert = () => {
    setShowAlertBox(false);
  };

  // アプリ選択画面ではナビバーを表示しない
  if (currentApp === 'selector') {
    return null;
  }

  const config = getNavigationConfig(currentApp, showStartScreen, onBackToHome, onBackToTextHome);

  // ナビバーを表示しない場合
  if (!config.showBackButton && (!config.showButtons || config.showButtons.length === 0)) {
    return null;
  }

  return (
    <>
      <div className={styles.container}>
        {/* 左側：戻るボタン */}
        <div className={styles.leftButtons}>
          {config.showBackButton && (
            <button
              className={styles.button}
              onClick={config.backButtonAction}
            >
              {config.backButtonText || '＜戻る'}
            </button>
          )}
        </div>

        {/* 右側：その他のボタン群 */}
        <div className={styles.rightButtons}>
          {config.showButtons && config.showButtons.length > 0 && (
            <div className={styles.buttonContainer}>
              {config.showButtons.map((button, index) => (
                <button
                  key={index}
                  className={styles.button}
                  onClick={button.onClick}
                >
                  {button.text}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* アラートメッセージ */}
      {showAlertBox && (
        <AlertMessage
          message={alertMessage}
          onClose={closeAlert}
        />
      )}
    </>
  );
};

