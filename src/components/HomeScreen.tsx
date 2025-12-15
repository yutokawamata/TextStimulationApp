import React, { useMemo, useState, useEffect } from 'react';
import styles from '../styles/components/HomeScreen.module.css';
import { TextUploadModal } from './TextUploadModal';
import { TextDeleteModal } from './TextDeleteModal';
import { TextReorderModal } from './TextReorderModal';
import { TextManageModal } from './TextManageModal';

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
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isReorderModalOpen, setIsReorderModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  const reloadTimeoutRef = React.useRef<number | null>(null);

  // ファイル一覧を読み込む
  useEffect(() => {
    const timestamp = new Date().getTime();
    
    // 環境に応じてURLを切り替え
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const basePath = process.env.PUBLIC_URL || '';
    
    // ローカル環境ではローカルのtext-list.jsonを、本番環境ではGitHub Pagesのものを参照
    const url = isLocalhost
      ? `${basePath}/data/text-list.json?t=${timestamp}`
      : `https://yutokawamata.github.io/TextStimulationApp/data/text-list.json?t=${timestamp}`;
    
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
    const gradeInfo = textListData.grades.find(grade => grade.folder === selectedGradeFolder);
    console.log('[HomeScreen] selectedGradeInfo:', gradeInfo, 'stories count:', gradeInfo?.stories.length);
    return gradeInfo;
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

  // GitHub APIでファイル一覧を取得してtext-list.jsonを再生成
  const regenerateTextListJson = async (token: string): Promise<void> => {
    const githubOwner = process.env.REACT_APP_GITHUB_OWNER || 'yutokawamata';
    const githubRepo = process.env.REACT_APP_GITHUB_REPO || 'TextStimulationApp';
    const githubBranch = 'gh-pages';
    const gradeOrder = ['1年生', '2年生', '3年生', '4年生', '5年生', '6年生'];

    // 各学年フォルダからファイル一覧を取得
    const newGrades: GradeInfo[] = [];
    
    for (const gradeFolder of gradeOrder) {
      try {
        const response = await fetch(
          `https://api.github.com/repos/${githubOwner}/${githubRepo}/contents/data/text/${gradeFolder}?ref=${githubBranch}`,
          {
            headers: {
              'Authorization': `token ${token}`,
              'Accept': 'application/vnd.github.v3+json',
            },
          }
        );

        if (response.ok) {
          const files = await response.json();
          
          // .txtファイルのみ抽出（placeholder.txtを除く）
          const stories: StoryInfo[] = files
            .filter((file: any) => 
              file.type === 'file' && 
              file.name.endsWith('.txt') && 
              file.name !== 'placeholder.txt'
            )
            .map((file: any) => ({
              filename: file.name,
              label: file.name.replace('.txt', '')
            }))
            .sort((a: StoryInfo, b: StoryInfo) => 
              a.filename.localeCompare(b.filename, 'ja')
            );

          newGrades.push({
            folder: gradeFolder,
            label: gradeFolder,
            stories: stories
          });
        }
      } catch (error) {
        console.warn(`学年フォルダ ${gradeFolder} の取得に失敗:`, error);
        // エラーでも続行（空の学年として追加）
        newGrades.push({
          folder: gradeFolder,
          label: gradeFolder,
          stories: []
        });
      }
    }

    // 現在のtext-list.jsonのSHAを取得
    const getResponse = await fetch(
      `https://api.github.com/repos/${githubOwner}/${githubRepo}/contents/data/text-list.json?ref=${githubBranch}`,
      {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    );

    if (!getResponse.ok) {
      throw new Error('text-list.jsonの取得に失敗しました。');
    }

    const fileData = await getResponse.json();
    
    // 新しいtext-list.jsonの内容を生成
    const newContent = { grades: newGrades };
    const updatedContent = JSON.stringify(newContent, null, 2);
    
    // Base64エンコード（UTF-8対応）
    const encoder = new TextEncoder();
    const utf8Bytes = encoder.encode(updatedContent);
    let binaryStr = '';
    for (let i = 0; i < utf8Bytes.length; i++) {
      binaryStr += String.fromCharCode(utf8Bytes[i]);
    }
    const base64Encoded = btoa(binaryStr);
    
    // text-list.jsonを更新
    const updateResponse = await fetch(
      `https://api.github.com/repos/${githubOwner}/${githubRepo}/contents/data/text-list.json`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: 'Regenerate text-list.json from repository files',
          content: base64Encoded,
          sha: fileData.sha,
          branch: githubBranch,
        }),
      }
    );

    if (!updateResponse.ok) {
      const errorData = await updateResponse.json();
      throw new Error(`text-list.jsonの更新に失敗しました: ${errorData.message}`);
    }
  };

  // 並び替えを保存（GitHub APIでtext-list.jsonを更新）
  const handleReorder = async (token: string, reorderedStories: StoryInfo[]): Promise<void> => {
    const githubOwner = process.env.REACT_APP_GITHUB_OWNER || 'yutokawamata';
    const githubRepo = process.env.REACT_APP_GITHUB_REPO || 'TextStimulationApp';
    const githubBranch = 'gh-pages';

    if (!textListData) {
      throw new Error('text-list.jsonが読み込まれていません');
    }

    // 現在のtext-list.jsonを取得し、選択された学年の文章順序だけを更新
    const updatedGrades = textListData.grades.map(grade => {
      if (grade.folder === selectedGradeFolder) {
        return {
          ...grade,
          stories: reorderedStories
        };
      }
      return grade;
    });

    const updatedData: TextListData = {
      grades: updatedGrades
    };

    // JSONを文字列化してBase64エンコード
    const jsonString = JSON.stringify(updatedData, null, 2);
    const base64Encoded = btoa(unescape(encodeURIComponent(jsonString)));

    // 現在のtext-list.jsonのSHAを取得
    const getResponse = await fetch(
      `https://api.github.com/repos/${githubOwner}/${githubRepo}/contents/data/text-list.json?ref=${githubBranch}`,
      {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    );

    if (!getResponse.ok) {
      throw new Error('text-list.jsonの取得に失敗しました');
    }

    const fileData = await getResponse.json();

    // text-list.jsonを更新
    const updateResponse = await fetch(
      `https://api.github.com/repos/${githubOwner}/${githubRepo}/contents/data/text-list.json`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: `Reorder stories in ${selectedGradeFolder}`,
          content: base64Encoded,
          sha: fileData.sha,
          branch: githubBranch,
        }),
      }
    );

    if (!updateResponse.ok) {
      const errorData = await updateResponse.json();
      throw new Error(`text-list.jsonの更新に失敗しました: ${errorData.message}`);
    }

    // 更新後、リストを再読み込み
    await reloadTextList();
  };

  // ファイル一覧を再読み込み
  const reloadTextList = async (delay: number = 0, regenerate: boolean = false) => {
    // regenerate=trueの場合、GitHub APIでtext-list.jsonを再生成
    if (regenerate) {
      const token = prompt('GitHub Personal Access Tokenを入力してください:');
      if (!token) {
        alert('トークンが入力されていないため、リロードをキャンセルしました。');
        return;
      }

      setIsProcessing(true);
      setProcessingMessage('GitHubから最新のファイル一覧を取得しています...\ntext-list.jsonを再生成中...');

      try {
        console.log('[再生成] text-list.jsonの再生成を開始');
        await regenerateTextListJson(token);
        console.log('[再生成] text-list.jsonの再生成完了');
        
        setProcessingMessage('text-list.json更新完了！\n画面を更新しています...\n（約20秒お待ちください）');
        
        // GitHub Pages側の更新が反映されるまで待つ
        console.log('[再生成] 20秒後にリロードします');
        window.location.hash = 'regenerate'; // リロード完了を識別するためのフラグ
        
        // 既存のタイムアウトがあればクリア
        if (reloadTimeoutRef.current !== null) {
          clearTimeout(reloadTimeoutRef.current);
        }
        
        reloadTimeoutRef.current = window.setTimeout(() => {
          console.log('[再生成] リロードを実行');
          loadTextListFromGitHubPages();
          reloadTimeoutRef.current = null;
        }, 20000);

      } catch (error) {
        console.error('[再生成] text-list.jsonの再生成に失敗しました:', error);
        alert(`エラー: ${error instanceof Error ? error.message : '不明なエラー'}`);
        setIsProcessing(false);
        setProcessingMessage('');
      }
    } else {
      // 通常のリロード（text-list.jsonを読み込むだけ）
      console.log('[リロード] 通常リロードを実行');
      
      // 既存のタイムアウトがあればクリア
      if (reloadTimeoutRef.current !== null) {
        clearTimeout(reloadTimeoutRef.current);
      }
      
      if (delay > 0) {
        reloadTimeoutRef.current = window.setTimeout(() => {
          loadTextListFromGitHubPages();
          reloadTimeoutRef.current = null;
        }, delay);
      } else {
        loadTextListFromGitHubPages();
      }
    }
  };
  
  // クリーンアップ: コンポーネントがアンマウントされる時にタイムアウトをクリア
  useEffect(() => {
    return () => {
      if (reloadTimeoutRef.current !== null) {
        clearTimeout(reloadTimeoutRef.current);
      }
    };
  }, []);

  // text-list.jsonを読み込む（環境に応じてローカルまたはGitHub Pagesから）
  const loadTextListFromGitHubPages = () => {
    console.log('[ロード] text-list.jsonの読み込みを開始');
    setIsLoading(true);
    // キャッシュバスティング: タイムスタンプを追加して最新のファイルを取得
    const timestamp = new Date().getTime();
    
    // 環境に応じてURLを切り替え
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const basePath = process.env.PUBLIC_URL || '';
    
    const url = isLocalhost
      ? `${basePath}/data/text-list.json?t=${timestamp}`
      : `https://yutokawamata.github.io/TextStimulationApp/data/text-list.json?t=${timestamp}`;
    
    console.log('[ロード] URL:', url);
    
    fetch(url, {
      cache: 'no-cache',
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    })
      .then(response => {
        console.log('[ロード] レスポンス取得:', response.status);
        return response.json();
      })
      .then((data: TextListData) => {
        console.log('[ロード] データ取得完了:', data);
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
        
        console.log('[ロード] UIを更新完了');
        setIsLoading(false);
        setIsProcessing(false);
        setProcessingMessage('');
        
        // リロード完了を通知（再生成の場合のみ）
        if (window.location.hash === '#regenerate') {
          alert('text-list.jsonの再生成とリロードが完了しました！');
          window.location.hash = '';
        }
      })
      .catch(error => {
        console.error('[ロード] ファイル一覧の読み込みに失敗しました:', error);
        setIsLoading(false);
        setIsProcessing(false);
        setProcessingMessage('');
        alert('リロードに失敗しました。もう一度お試しください。');
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
              学年選択
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
              className={`button ${styles.manageButton}`}
              onClick={() => setIsManageModalOpen(true)}
            >
              📝 文章リスト変更
            </button>
          </div>

          <div className={styles.storyBlock}>
            <div className={styles.storyHeader}>
              <label className={styles.sectionLabel} htmlFor="story-select">
                文章リスト
              </label>
              <div className={styles.refreshButtons}>
                <button
                  type="button"
                  className={styles.refreshButton}
                  onClick={() => reloadTextList(0, false)}
                  title="リストを更新（キャッシュクリア）"
                >
                  🔄
                </button>
              </div>
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

      <TextManageModal
        isOpen={isManageModalOpen}
        onClose={() => setIsManageModalOpen(false)}
        onAdd={() => setIsUploadModalOpen(true)}
        onDelete={() => setIsDeleteModalOpen(true)}
        onReorder={() => setIsReorderModalOpen(true)}
        hasStories={!!selectedGradeInfo && selectedGradeInfo.stories.length > 0}
        canReorder={!!selectedGradeInfo && selectedGradeInfo.stories.length > 1}
      />

      <TextReorderModal
        isOpen={isReorderModalOpen}
        onClose={() => setIsReorderModalOpen(false)}
        stories={selectedGradeInfo?.stories || []}
        gradeFolder={selectedGradeFolder}
        gradeLabel={selectedGradeInfo?.label || ''}
        onReorder={handleReorder}
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
