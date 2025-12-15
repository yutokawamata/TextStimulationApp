import React, { useState, useEffect } from 'react';
import styles from '../styles/components/TextDeleteModal.module.css';

interface TextDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  grades: Array<{ folder: string; label: string; stories: Array<{ filename: string; label: string }> }>;
  onDeleteSuccess: () => void;
}

export const TextDeleteModal: React.FC<TextDeleteModalProps> = ({
  isOpen,
  onClose,
  grades,
  onDeleteSuccess,
}) => {
  const [selectedGrade, setSelectedGrade] = useState<string>('');
  const [selectedStory, setSelectedStory] = useState<string>('');
  const [githubToken, setGithubToken] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState(false);

  // モーダルが閉じられたときにリセット
  useEffect(() => {
    if (!isOpen) {
      setSelectedGrade('');
      setSelectedStory('');
      setGithubToken('');
      setError('');
    }
  }, [isOpen]);

  // 選択された学年の文章リスト
  const selectedGradeData = grades.find(g => g.folder === selectedGrade);
  const stories = selectedGradeData?.stories || [];

  // GitHub APIを使用してファイルを削除する関数
  const deleteFileFromGitHub = async (
    path: string,
    message: string,
    token: string
  ): Promise<void> => {
    const githubOwner = process.env.REACT_APP_GITHUB_OWNER || 'yutokawamata';
    const githubRepo = process.env.REACT_APP_GITHUB_REPO || 'TextStimulationApp';
    const githubBranch = 'gh-pages';

    // ファイルのSHAを取得
    const getResponse = await fetch(
      `https://api.github.com/repos/${githubOwner}/${githubRepo}/contents/${path}?ref=${githubBranch}`,
      {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    );

    if (!getResponse.ok) {
      if (getResponse.status === 404) {
        console.warn(`ファイルが見つかりません: ${path}`);
        return; // ファイルが存在しない場合はスキップ
      }
      throw new Error(`ファイル情報の取得に失敗しました: ${path}`);
    }

    const fileData = await getResponse.json();

    // ファイルを削除
    const deleteResponse = await fetch(
      `https://api.github.com/repos/${githubOwner}/${githubRepo}/contents/${path}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message,
          sha: fileData.sha,
          branch: githubBranch,
        }),
      }
    );

    if (!deleteResponse.ok) {
      const errorData = await deleteResponse.json();
      throw new Error(`ファイルの削除に失敗しました: ${errorData.message}`);
    }
  };

  // フォルダ内のすべてのファイルを削除する関数
  const deleteFolderFromGitHub = async (
    folderPath: string,
    token: string
  ): Promise<void> => {
    const githubOwner = process.env.REACT_APP_GITHUB_OWNER || 'yutokawamata';
    const githubRepo = process.env.REACT_APP_GITHUB_REPO || 'TextStimulationApp';
    const githubBranch = 'gh-pages';

    // フォルダ内のファイル一覧を取得
    const getResponse = await fetch(
      `https://api.github.com/repos/${githubOwner}/${githubRepo}/contents/${folderPath}?ref=${githubBranch}`,
      {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    );

    if (!getResponse.ok) {
      if (getResponse.status === 404) {
        console.warn(`フォルダが見つかりません: ${folderPath}`);
        return; // フォルダが存在しない場合はスキップ
      }
      throw new Error(`フォルダ情報の取得に失敗しました: ${folderPath}`);
    }

    const files = await getResponse.json();

    // 各ファイルを削除
    for (const file of files) {
      if (file.type === 'file') {
        await deleteFileFromGitHub(file.path, `Delete ${file.name}`, token);
      }
    }
  };

  // text-list.jsonを更新する関数
  const updateTextListJson = async (gradeFolder: string, storyFileName: string, token: string): Promise<void> => {
    const githubOwner = process.env.REACT_APP_GITHUB_OWNER || 'yutokawamata';
    const githubRepo = process.env.REACT_APP_GITHUB_REPO || 'TextStimulationApp';
    const githubBranch = 'gh-pages';

    // 現在のtext-list.jsonを取得
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
    // Base64デコード（UTF-8対応）
    const base64Content = fileData.content.replace(/\s/g, '');
    const binaryString = atob(base64Content);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const decodedContent = new TextDecoder('utf-8').decode(bytes);
    const currentContent = JSON.parse(decodedContent);

    // 文章を削除
    const gradeIndex = currentContent.grades.findIndex((g: any) => g.folder === gradeFolder);
    if (gradeIndex >= 0) {
      currentContent.grades[gradeIndex].stories = currentContent.grades[gradeIndex].stories.filter(
        (s: any) => s.filename !== storyFileName
      );
    }

    // text-list.jsonを更新
    const updatedContent = JSON.stringify(currentContent, null, 2);
    
    // Base64エンコード（UTF-8対応）
    const encoder = new TextEncoder();
    const utf8Bytes = encoder.encode(updatedContent);
    let binaryStr = '';
    for (let i = 0; i < utf8Bytes.length; i++) {
      binaryStr += String.fromCharCode(utf8Bytes[i]);
    }
    const base64Encoded = btoa(binaryStr);
    
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
          message: `Delete text: ${storyFileName}`,
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

  // 削除処理
  const handleDelete = async () => {
    if (!selectedGrade) {
      setError('学年を選択してください。');
      return;
    }

    if (!selectedStory) {
      setError('削除する文章を選択してください。');
      return;
    }

    if (!githubToken) {
      setError('GitHub Personal Access Tokenを入力してください。');
      return;
    }

    const confirmDelete = window.confirm(`「${selectedStory.replace('.txt', '')}」を削除してもよろしいですか？\n\nテキストファイルと音声ファイルがすべて削除されます。`);
    if (!confirmDelete) {
      return;
    }

    setIsDeleting(true);
    setError('');

    try {
      const storyFolderName = selectedStory.replace(/\.txt$/, '');

      console.log('[削除処理] 開始:', { selectedGrade, selectedStory, storyFolderName });

      // テキストファイルを削除
      console.log('[削除処理] テキストファイルを削除中:', `data/text/${selectedGrade}/${selectedStory}`);
      await deleteFileFromGitHub(
        `data/text/${selectedGrade}/${selectedStory}`,
        `Delete text file: ${selectedStory}`,
        githubToken
      );
      console.log('[削除処理] テキストファイルの削除完了');

      // 音声フォルダを削除
      console.log('[削除処理] 音声フォルダを削除中:', `data/voice/${selectedGrade}/${storyFolderName}`);
      await deleteFolderFromGitHub(
        `data/voice/${selectedGrade}/${storyFolderName}`,
        githubToken
      );
      console.log('[削除処理] 音声フォルダの削除完了');

      // text-list.jsonを更新
      console.log('[削除処理] text-list.jsonを更新中');
      await updateTextListJson(selectedGrade, selectedStory, githubToken);
      console.log('[削除処理] text-list.jsonの更新完了');

      console.log('[削除処理] すべての削除処理が完了しました');

      // 成功時の処理（親コンポーネントでモーダルを閉じる）
      onDeleteSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : '削除に失敗しました。');
      console.error('エラー:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>文章削除</h2>
          <button className={styles.closeButton} onClick={onClose}>
            ✕
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="grade">
              学年 <span className={styles.required}>*</span>
            </label>
            <select
              id="grade"
              value={selectedGrade}
              onChange={(e) => {
                setSelectedGrade(e.target.value);
                setSelectedStory(''); // 学年変更時に文章選択をリセット
              }}
              className={styles.select}
              disabled={isDeleting}
            >
              <option value="">学年を選択</option>
              {grades.map((grade) => (
                <option key={grade.folder} value={grade.folder}>
                  {grade.label}
                </option>
              ))}
            </select>
          </div>

          {selectedGrade && stories.length > 0 && (
            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="story">
                文章 <span className={styles.required}>*</span>
              </label>
              <select
                id="story"
                value={selectedStory}
                onChange={(e) => setSelectedStory(e.target.value)}
                className={styles.select}
                disabled={isDeleting}
              >
                <option value="">文章を選択</option>
                {stories.map((story) => (
                  <option key={story.filename} value={story.filename}>
                    {story.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {selectedGrade && stories.length === 0 && (
            <p className={styles.noStories}>この学年には文章がありません。</p>
          )}

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="github-token">
              GitHub Personal Access Token <span className={styles.required}>*</span>
            </label>
            <input
              id="github-token"
              type="password"
              value={githubToken}
              onChange={(e) => setGithubToken(e.target.value)}
              placeholder="GitHub Personal Access Tokenを入力"
              className={styles.textInput}
              disabled={isDeleting}
            />
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.actions}>
            <button
              type="button"
              className={`button ${styles.cancelButton}`}
              onClick={onClose}
              disabled={isDeleting}
            >
              キャンセル
            </button>
            <button
              type="button"
              className={`button ${styles.deleteButton}`}
              onClick={handleDelete}
              disabled={isDeleting || !selectedGrade || !selectedStory || !githubToken}
            >
              {isDeleting ? '削除中...' : '削除'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
