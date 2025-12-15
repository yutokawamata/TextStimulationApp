// Reactの必要な機能をインポート
import React, { useState } from 'react';
// 共通スタイルシートをインポート
import './styles/common/global.css';
import './styles/common/components.css';
// コンポーネントをインポート
import { AppSelector } from './components/AppSelector';
import { KanjiAppViewer } from './components/KanjiAppViewer';
import { StartScreen } from './components/StartScreen';
import { TextDisplay } from './components/TextDisplay';
import { HomeScreen, TextAppSettings } from './components/HomeScreen';
import { ModeSelectionScreen } from './components/ModeSelectionScreen';
import { CompletionScreen } from './components/CompletionScreen';
import { Navi } from './components/Navi';

// メインのコンポーネント関数
const App = () => {
  // 外部アプリへのリンクURL（環境変数で上書き可能）
  // 本番環境ではGitHub PagesのURLを使用
  const KANJI_APP_URL = process.env.NODE_ENV === 'production'
    ? (process.env.REACT_APP_KANJI_APP_URL || 'https://yutokawamata.github.io/0120/')
    : (process.env.REACT_APP_KANJI_APP_URL || 'http://localhost:3001');

  // 状態管理のための変数（useStateフックを使用）
  // showStartScreen: スタート画面を表示するかどうかの状態 (0: スタート画面, 1: 文節表示画面)
  const [showStartScreen, setShowStartScreen] = useState(0);
  // showAppSelector: 2アプリを選択する画面を表示するかどうか
  const [showAppSelector, setShowAppSelector] = useState(true);
  // currentApp: 現在表示中のアプリ ('selector' | 'kanji' | 'text' | 'text_home' | 'mode_selection' | 'completion')
  const [currentApp, setCurrentApp] = useState<'selector' | 'kanji' | 'text' | 'text_home' | 'mode_selection' | 'completion'>('selector');
  // 文章刺激アプリの設定（学年フォルダ、ファイル名、音声モード）
  const [textAppSettings, setTextAppSettings] = useState<TextAppSettings | null>(null);
  // 全文節モードの経過時間（ミリ秒）
  const [elapsedTime, setElapsedTime] = useState<number>(0);

  // 漢字アプリを開く（iframeで埋め込み）
  const handleOpenKanjiApp = () => {
    setCurrentApp('kanji');
    setShowAppSelector(false);
  };

  // 文章刺激アプリ（ホーム画面）に進む
  const handleEnterTextHome = () => {
    setCurrentApp('text_home');
    setShowAppSelector(false);
    setShowStartScreen(0);
  };

  // ホーム画面で設定した内容を保持し、スタート画面へ遷移
  const handleProceedToTextApp = (settings: TextAppSettings) => {
    setTextAppSettings(settings);
    setCurrentApp('text');
    setShowStartScreen(0);
  };

  // スタート画面から文節表示へ遷移
  const handleStartReading = () => {
    setShowStartScreen(1);
  };

  // ホーム（アプリ選択画面）に戻る
  const handleBackToHome = () => {
    setCurrentApp('selector');
    setShowAppSelector(true);
    setShowStartScreen(0);
  };

  // 文章練習が終了した時の処理
  // 全文節モードの場合は完了画面に遷移、それ以外はモード選択画面に遷移
  const handleTextDisplayComplete = (elapsedTimeMs?: number) => {
    if (textAppSettings?.voiceMode === 'full-text' && elapsedTimeMs !== undefined) {
      // 全文節モードの場合、完了画面に遷移
      setElapsedTime(elapsedTimeMs);
      setCurrentApp('completion');
    } else {
      // それ以外のモードはモード選択画面に遷移
      setCurrentApp('mode_selection');
    }
  };

  // モード選択画面で「つぎへ」が押された時に、新しいモードで練習を開始
  const handleModeSelectionProceed = (voiceMode: TextAppSettings['voiceMode']) => {
    if (textAppSettings) {
      // 音声モードを更新して、スタート画面に戻る
      setTextAppSettings({
        ...textAppSettings,
        voiceMode
      });
      setCurrentApp('text');
      setShowStartScreen(0);
    }
  };


  // アプリ選択画面（ナビバーは表示しない）
  if (showAppSelector && currentApp === 'selector') {
    return (
      <AppSelector
        onSelectKanji={handleOpenKanjiApp}
        onSelectText={handleEnterTextHome}
      />
    );
    }

  // 漢字アプリ（iframe表示）
  // iframeの中に漢字チャレンジアプリのナビバーがあるため、
  // TextStimulationAppのNaviは表示しない
  if (currentApp === 'kanji') {
    return (
      <KanjiAppViewer
        kanjiAppUrl={KANJI_APP_URL}
        onBack={handleBackToHome}
      />
    );
  }

  // 文章刺激アプリのホーム画面
  if (currentApp === 'text_home') {
    return (
      <>
        <Navi
          currentApp={currentApp}
          showStartScreen={showStartScreen}
          onBackToHome={handleBackToHome}
        />
        <HomeScreen
          onProceed={handleProceedToTextApp}
          onBack={handleBackToHome}
        />
      </>
    );
  }

  // 文章刺激アプリのスタート画面
  if (currentApp === 'text') {
  if (showStartScreen === 0) {
      return (
        <>
          <Navi
            currentApp={currentApp}
            showStartScreen={showStartScreen}
            onBackToHome={handleBackToHome}
          />
          <StartScreen
            onStart={handleStartReading}
            onBack={handleBackToHome}
            voiceMode={textAppSettings?.voiceMode}
          />
        </>
      );
    }

    // 文節表示画面
    // TextDisplayコンポーネント内でテキストファイルを読み込む
    return (
      <>
        <Navi
          currentApp={currentApp}
          showStartScreen={showStartScreen}
          onBackToHome={handleBackToHome}
        />
        <TextDisplay
          textAppSettings={textAppSettings}
          onBack={handleBackToHome}
          onComplete={handleTextDisplayComplete}
        />
      </>
    );
  }

  // モード選択画面
  if (currentApp === 'mode_selection') {
    return (
      <>
        <Navi
          currentApp={currentApp}
          showStartScreen={showStartScreen}
          onBackToHome={handleBackToHome}
        />
        <ModeSelectionScreen
          onProceed={handleModeSelectionProceed}
          onBack={handleBackToHome}
          currentVoiceMode={textAppSettings?.voiceMode}
        />
      </>
    );
  }

  // 完了画面（全文節モードのみ）
  if (currentApp === 'completion') {
    return (
      <>
        <Navi
          currentApp={currentApp}
          showStartScreen={showStartScreen}
          onBackToHome={handleBackToHome}
        />
        <CompletionScreen
          elapsedTime={elapsedTime}
          onFinish={() => {
            // 「おわり」ボタンが押されたら文章選択画面（HomeScreen）に戻る
            setCurrentApp('text_home');
          }}
        />
      </>
    );
  }

  return null;
}

export default App;
