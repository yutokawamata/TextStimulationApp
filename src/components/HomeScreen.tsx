import React, { useMemo, useState, useEffect } from 'react';
import styles from '../styles/components/HomeScreen.module.css';
import { TextUploadModal } from './TextUploadModal';
import { TextDeleteModal } from './TextDeleteModal';

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
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');

  // ファイル一覧を読み込む
  useEffect(() => {
    // 常にgh-pagesの最新のtext-list.jsonを参照
    const timestamp = new Date().getTime();
    const url = `https://yutokawamata.github.io/TextStimulationApp/data/text-list.json?t=${timestamp}`;
    fetch(url, {
      cache: 'no-cache',
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    })
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
  const reloadTextList = (delay: number = 0) => {
    // GitHub Pages側の更新が反映されるまで少し待つ
    setTimeout(() => {
      setIsLoading(true);
      // キャッシュバスティング: タイムスタンプを追加して最新のファイルを取得
      const timestamp = new Date().getTime();
      const url = `https://yutokawamata.github.io/TextStimulationApp/data/text-list.json?t=${timestamp}`;
      fetch(url, {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      })
        .then(response => response.json())
        .then((data: TextListData) => {
          setTextListData(data);
          
          // 現在選択されている学年を保持
          const currentGrade = data.grades.find(g => g.folder === selectedGradeFolder);
          
          if (currentGrade) {
            // 現在の学年が存在する場合、選択を維持
            setSelectedGradeFolder(currentGrade.folder);
            
            // 現在選択されているストーリーがまだ存在するか確認
            const currentStory = currentGrade.stories.find(s => s.filename === selectedStoryFilename);
            
            if (!currentStory) {
              // 削除された場合は、その学年の最初のストーリーを選択（または空）
              if (currentGrade.stories.length > 0) {
                setSelectedStoryFilename(currentGrade.stories[0].filename);
              } else {
                setSelectedStoryFilename('');
              }
            }
          } else if (data.grades.length > 0) {
            // 現在の学年が存在しない場合は、最初の学年を選択
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
    }, delay);
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

            <button
              type="button"
              className={`button ${styles.deleteButton}`}
              onClick={() => setIsDeleteModalOpen(true)}
            >
              文章削除
            </button>
          </div>

          <div className={styles.storyBlock}>
            <div className={styles.storyHeader}>
              <label className={styles.sectionLabel} htmlFor="story-select">
                文章リスト
              </label>
              <button
                type="button"
                className={styles.refreshButton}
                onClick={() => reloadTextList(0)}
                title="リストを更新"
              >
                🔄
              </button>
            </div>
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
        onUploadSuccess={() => {
          setIsUploadModalOpen(false);
          setIsProcessing(true);
          setProcessingMessage('アップロード完了！リストを更新しています...\n（約20秒お待ちください）\n\n※ アップロード直後は、キャッシュの影響で新しい文章がリストに表示されない場合があります。時間が経てば自動的に表示されます。');
          reloadTextList(20000);
          setTimeout(() => {
            setIsProcessing(false);
            setProcessingMessage('');
          }, 20000);
        }}
      />

      <TextDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        grades={textListData?.grades || []}
        onDeleteSuccess={() => {
          setIsDeleteModalOpen(false);
          setIsProcessing(true);
          setProcessingMessage('削除完了！リストを更新しています...\n（約20秒お待ちください）\n\n※ 削除直後は、キャッシュの影響で削除した文章がリストに表示される場合があります。時間が経てば自動的に消えます。');
          reloadTextList(20000);
          setTimeout(() => {
            setIsProcessing(false);
            setProcessingMessage('');
          }, 20000);
        }}
      />

      <div className={styles.footer}>
        <p>※音声はVOICEVOXを使用させていただいております。</p>
        <span className={styles.version}>ver.20251012-1</span>
      </div>

      {/* 処理中オーバーレイ */}
      {isProcessing && (
        <div className={styles.processingOverlay}>
          <div className={styles.processingContent}>
            <div className={styles.spinner}></div>
            <p className={styles.processingMessage}>{processingMessage}</p>
          </div>
        </div>
      )}
    </div>
  );
};
