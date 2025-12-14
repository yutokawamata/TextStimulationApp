import React, { useEffect, useState } from 'react';
import styles from '../styles/components/StartScreen.module.css';
import '../styles/common/components.css';
import { TextAppSettings } from './HomeScreen';

/**
 * 練習開始画面コンポーネント
 * 
 * 文章刺激アプリの練習開始前の説明画面を表示します。
 * - 左側: スタートボタン
 * - 右側: 音声モードに応じた説明文（縦書き表示）
 * 
 * 説明文はテキストファイルから読み込み、空行で列を区切ります。
 * 各列内の文節は全角スペースで結合して1つの文字列として表示します。
 */

type VoiceMode = TextAppSettings['voiceMode'] | undefined;

// 音声モードと説明テキストファイルの対応表
const explanationFiles: Record<string, string> = {
  'voice-on': 'voice.txt',      // 音声ありモード
  'voice-off': 'novoice.txt',   // 音声なしモード
  'full-text': 'alltext.txt',   // 全文節モード
};

const defaultFile = 'voice.txt'; // デフォルトの説明ファイル

interface StartScreenProps {
  onStart: () => void;
  onBack: () => void;
  voiceMode?: VoiceMode;
}

export const StartScreen: React.FC<StartScreenProps> = ({ onStart, onBack, voiceMode }) => {
  // 説明文の各列を保持（空行で区切られた各ブロックが1つの文字列として格納される）
  const [instructions, setInstructions] = useState<string[]>([]);
  // エラーメッセージを保持
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const modeKey = voiceMode ?? 'voice-on';
    const fileName = explanationFiles[modeKey] ?? defaultFile;
    const basePath = process.env.PUBLIC_URL || '';

    fetch(`${basePath}/data/explanation/${fileName}`)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.text();
      })
      .then(text => {
        // テキストを行に分割（改行コードを考慮）
        const lines = text.split(/\r?\n/).map(line => line.trim());
        
        // 空行で区切って列に分ける
        // 各列内の文節は全角スペース（　）で結合して1つの文字列にする
        const columns: string[] = [];
        let currentColumnLines: string[] = [];

        for (const line of lines) {
          if (line === '') {
            // 空行が見つかったら、現在の列を全角スペースで結合して保存
            // これにより、空行までのすべての文節が1つの列として扱われる
            if (currentColumnLines.length > 0) {
              columns.push(currentColumnLines.join('　'));
              currentColumnLines = [];
            }
          } else {
            // 空行でなければ現在の列に追加
            currentColumnLines.push(line);
          }
        }
        
        // 最後の列が空でなければ追加（ファイル末尾に空行がない場合の処理）
        if (currentColumnLines.length > 0) {
          columns.push(currentColumnLines.join(' '));
        }

        setInstructions(columns);
        setErrorMessage(null);
      })
      .catch(error => {
        console.error('説明テキストの読み込みに失敗しました:', error);
        setInstructions([]);
        setErrorMessage('説明テキストを読み込めませんでした。');
      });
  }, [voiceMode]); // voiceModeが変更されたら再読み込み

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        {/* 左側: スタートボタン */}
        <div className={styles.leftSection}>
          <button className={`button ${styles.startButton}`} onClick={onStart}>
            スタート
          </button>
        </div>

        {/* 右側: 説明文（縦書き表示） */}
        <div className={styles.rightSection}>
          <div className={styles.instructions}>
            {/* エラー表示 */}
            {errorMessage && (
              <div className={styles.instructionColumn}>
                <div className={styles.instructionText}>{errorMessage}</div>
              </div>
            )}
            {/* 読み込み中表示 */}
            {!errorMessage && instructions.length === 0 && (
              <div className={styles.instructionColumn}>
                <div className={styles.instructionText}>読み込み中...</div>
              </div>
            )}
            {/* 説明文の各列を表示（空行で区切られた各ブロックが1列として表示される） */}
            {instructions.map((column, index) => (
              <div key={index} className={styles.instructionColumn}>
                <div className={styles.instructionText}>
                  {column}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

