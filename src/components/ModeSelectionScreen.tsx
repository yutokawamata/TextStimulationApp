import React, { useState } from 'react';
import styles from '../styles/components/ModeSelectionScreen.module.css';
import { TextAppSettings } from './HomeScreen';

/**
 * モード選択画面コンポーネント
 * 
 * 文章練習が終わった後に表示される画面で、次の練習のモードを選択します。
 * - 音声あり、音声なし、全文節の3つのモードから選択
 * - 「つぎへ」ボタンで次の練習を開始
 */

interface ModeSelectionScreenProps {
  onProceed: (voiceMode: TextAppSettings['voiceMode']) => void;
  onBack: () => void;
  currentVoiceMode?: TextAppSettings['voiceMode'];
}

const voiceOptions: { value: TextAppSettings['voiceMode']; label: string }[] = [
  { value: 'voice-on', label: '音声あり' },
  { value: 'voice-off', label: '音声なし' },
  { value: 'full-text', label: '全文節' },
];

export const ModeSelectionScreen: React.FC<ModeSelectionScreenProps> = ({
  onProceed,
  onBack,
  currentVoiceMode = 'voice-on'
}) => {
  const [voiceMode, setVoiceMode] = useState<TextAppSettings['voiceMode']>(currentVoiceMode);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onProceed(voiceMode);
  };

  return (
    <div className={styles.container}>
      <form className={styles.form} onSubmit={handleSubmit}>
        {/* モード選択のラジオボタン */}
        <div className={styles.voiceOptions}>
          {voiceOptions.map((option) => (
            <label key={option.value} className={styles.voiceOption}>
              <input
                type="radio"
                name="voice-mode"
                value={option.value}
                checked={voiceMode === option.value}
                onChange={(event) =>
                  setVoiceMode(event.target.value as TextAppSettings['voiceMode'])
                }
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>

        {/* つぎへボタン */}
        <button
          type="submit"
          className={`button ${styles.actionButton}`}
        >
          つぎへ
        </button>
      </form>
    </div>
  );
};

