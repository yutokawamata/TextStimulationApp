import React, { useMemo, useState, useEffect } from 'react';
import styles from '../styles/components/HomeScreen.module.css';
import { TextUploadModal } from './TextUploadModal';

export type TextAppSettings = {
  gradeFolder: string; // 学年フォルダ名（例: "1年生"）
  storyFilename: string; // テキストファイル名（例: "森へ行こう.txt"）
  voiceMode: 'voice-on' | 'voice-off' | 'full-text';
};

interface GradeInfo {
  folder: string;
  label: string;
  stories: StoryInfo[];
}

interface StoryInfo {
  filename: string;
  label: string;
}

interface TextListData {
  grades: GradeInfo[];
}

interface HomeScreenProps {
  onProceed: (settings: TextAppSettings) => void;
  onBack: () => void;
}

const voiceOptions: { value: TextAppSettings['voiceMode']; label: string }[] = [
  { value: 'voice-on', label: '音声あり' },
  { value: 'voice-off', label: '音声なし' },
  { value: 'full-text', label: '全文節' },
];

export const HomeScreen: React.FC<HomeScreenProps> = ({ onProceed, onBack }) => {
  const [textListData, setTextListData] = useState<TextListData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedGradeFolder, setSelectedGradeFolder] = useState<string>('');
  const [selectedStoryFilename, setSelectedStoryFilename] = useState<string>('');
  const [voiceMode, setVoiceMode] = useState<TextAppSettings['voiceMode']>('voice-on');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // ファイル一覧を読み込む
  useEffect(() => {
    fetch(`${process.env.PUBLIC_URL}/data/text-list.json`)
      .then(response => response.json())
      .then((data: TextListData) => {
        setTextListData(data);
        if (data.grades.length > 0) {
          const firstGrade = data.grades[0];
          setSelectedGradeFolder(firstGrade.folder);
          if (firstGrade.stories.length > 0) {
            setSelectedStoryFilename(firstGrade.stories[0].filename);
          }
        }
        setIsLoading(false);
      })
      .catch(error => {
        console.error('ファイル一覧の読み込みに失敗しました:', error);
        setIsLoading(false);
      });
  }, []);

  // 選択された学年の文章一覧を取得
  const selectedGradeInfo = useMemo(() => {
    if (!textListData) return null;
    return textListData.grades.find(grade => grade.folder === selectedGradeFolder);
  }, [textListData, selectedGradeFolder]);

  // 学年が変更されたら、最初の文章を選択
  useEffect(() => {
    if (selectedGradeInfo && selectedGradeInfo.stories.length > 0) {
      setSelectedStoryFilename(selectedGradeInfo.stories[0].filename);
    } else {
      setSelectedStoryFilename('');
    }
  }, [selectedGradeInfo]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedStoryFilename || !selectedGradeFolder) {
      return;
    }
    onProceed({
      gradeFolder: selectedGradeFolder,
      storyFilename: selectedStoryFilename,
      voiceMode,
    });
  };

  // ファイル一覧を再読み込み
  const reloadTextList = () => {
    setIsLoading(true);
    // キャッシュバスティング: タイムスタンプを追加して最新のファイルを取得
    const timestamp = new Date().getTime();
    fetch(`${process.env.PUBLIC_URL}/data/text-list.json?t=${timestamp}`)
      .then(response => response.json())
      .then((data: TextListData) => {
        setTextListData(data);
        if (data.grades.length > 0) {
          const firstGrade = data.grades[0];
          setSelectedGradeFolder(firstGrade.folder);
          if (firstGrade.stories.length > 0) {
            setSelectedStoryFilename(firstGrade.stories[0].filename);
          }
        }
        setIsLoading(false);
      })
      .catch(error => {
        console.error('ファイル一覧の読み込みに失敗しました:', error);
        setIsLoading(false);
      });
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        <p>読み込み中...</p>
      </div>
    );
  }

  if (!textListData || textListData.grades.length === 0) {
    return (
      <div className={styles.container}>
        <p>ファイル一覧を読み込めませんでした。</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>文章刺激アプリ</h1>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.selectionGrid}>
          <div className={styles.selectionBlock}>
            <label className={styles.sectionLabel} htmlFor="grade-select">
              文章選択
            </label>
            <select
              id="grade-select"
              className={styles.gradeSelect}
              value={selectedGradeFolder}
              onChange={(event) => setSelectedGradeFolder(event.target.value)}
            >
              {textListData.grades.map((grade) => (
                <option key={grade.folder} value={grade.folder}>
                  {grade.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={`button ${styles.addButton}`}
              onClick={() => setIsUploadModalOpen(true)}
            >
              文章追加
            </button>
          </div>

          <div className={styles.storyBlock}>
            <label className={styles.sectionLabel} htmlFor="story-select">
              文章リスト
            </label>
            <select
              id="story-select"
              className={styles.storySelect}
              size={5}
              value={selectedStoryFilename}
              onChange={(event) => setSelectedStoryFilename(event.target.value)}
              disabled={!selectedGradeInfo || selectedGradeInfo.stories.length === 0}
            >
              {selectedGradeInfo?.stories.map((story) => (
                <option key={story.filename} value={story.filename}>
                  {story.label}
                </option>
              ))}
            </select>
          </div>
        </div>

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

        <button
          type="submit"
          className={`button ${styles.actionButton}`}
          disabled={!selectedStoryFilename || !selectedGradeFolder}
        >
          つぎへ
        </button>
      </form>

      <TextUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        grades={textListData?.grades || []}
        onUploadSuccess={reloadTextList}
      />

      <div className={styles.footer}>
        <p>※音声はVOICEVOXを使用させていただいております。</p>
        <span className={styles.version}>ver.20251012-1</span>
      </div>
    </div>
  );
};
