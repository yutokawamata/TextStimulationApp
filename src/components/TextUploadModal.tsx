import React, { useState, useRef } from 'react';
import styles from '../styles/components/TextUploadModal.module.css';

interface TextUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  grades: Array<{ folder: string; label: string }>;
  onUploadSuccess: () => void;
}

export const TextUploadModal: React.FC<TextUploadModalProps> = ({
  isOpen,
  onClose,
  grades,
  onUploadSuccess,
}) => {
  const [selectedGrade, setSelectedGrade] = useState<string>('');
  const [textFile, setTextFile] = useState<File | null>(null);
  const [voiceFiles, setVoiceFiles] = useState<File[]>([]);
  const [githubToken, setGithubToken] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const textFileInputRef = useRef<HTMLInputElement>(null);
  const voiceFolderInputRef = useRef<HTMLInputElement>(null);

  // モーダルが閉じられたときにリセット
  React.useEffect(() => {
    if (!isOpen) {
      setSelectedGrade('');
      setTextFile(null);
      setVoiceFiles([]);
      setGithubToken('');
      setError('');
      if (textFileInputRef.current) {
        textFileInputRef.current.value = '';
      }
      if (voiceFolderInputRef.current) {
        voiceFolderInputRef.current.value = '';
      }
    }
  }, [isOpen]);

  // テキストファイルの選択
  const handleTextFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setTextFile(null);
      return;
    }

    // ファイル形式チェック（.txtのみ）
    if (!file.name.toLowerCase().endsWith('.txt')) {
      setError('テキストファイルは.txt形式のみ対応しています。');
      setTextFile(null);
      if (textFileInputRef.current) {
        textFileInputRef.current.value = '';
      }
      return;
    }

    setTextFile(file);
    setError('');
  };

  // 音声フォルダの選択（webkitdirectory属性でフォルダ全体を選択）
  const handleVoiceFolderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) {
      setVoiceFiles([]);
      return;
    }

    // ファイル形式チェック（.wavのみ）
    const invalidFiles = files.filter(
      (file) => !file.name.toLowerCase().endsWith('.wav')
    );
    if (invalidFiles.length > 0) {
      setError('音声ファイルは.wav形式のみ対応しています。');
      setVoiceFiles([]);
      if (voiceFolderInputRef.current) {
        voiceFolderInputRef.current.value = '';
      }
      return;
    }

    // 音声ファイルの順番チェック（001.wavから順番になっているか）
    const sortedFiles = files.sort((a, b) => {
      const numA = parseInt(a.name.match(/^(\d+)\.wav$/i)?.[1] || '0');
      const numB = parseInt(b.name.match(/^(\d+)\.wav$/i)?.[1] || '0');
      return numA - numB;
    });

    // 001.wavから始まっているかチェック
    const firstFileName = sortedFiles[0]?.name.toLowerCase();
    if (!firstFileName || !firstFileName.startsWith('001.wav')) {
      setError('音声ファイルは001.wavから始まる必要があります。');
      setVoiceFiles([]);
      if (voiceFolderInputRef.current) {
        voiceFolderInputRef.current.value = '';
      }
      return;
    }

    // 連番になっているかチェック
    for (let i = 0; i < sortedFiles.length; i++) {
      const expectedNum = i + 1;
      const fileName = sortedFiles[i].name.toLowerCase();
      const fileNum = parseInt(fileName.match(/^(\d+)\.wav$/)?.[1] || '0');
      const expectedFileName = `${String(expectedNum).padStart(3, '0')}.wav`;

      if (fileNum !== expectedNum || fileName !== expectedFileName) {
        setError(
          `音声ファイルは001.wavから順番になっている必要があります。${expectedFileName}が見つかりません。`
        );
        setVoiceFiles([]);
        if (voiceFolderInputRef.current) {
          voiceFolderInputRef.current.value = '';
        }
        return;
      }
    }

    setVoiceFiles(sortedFiles);
    setError('');
  };

  // GitHub APIを使用してファイルをアップロードする関数
  const uploadFileToGitHub = async (
    path: string,
    content: string,
    message: string,
    token: string
  ): Promise<void> => {
    const githubOwner = process.env.REACT_APP_GITHUB_OWNER || 'yutokawamata';
    const githubRepo = process.env.REACT_APP_GITHUB_REPO || 'TextStimulationApp';
    const githubBranch = 'gh-pages'; // デプロイ先のブランチ

    if (!token) {
      throw new Error('GitHub Personal Access Tokenが入力されていません。');
    }

    // ファイルが既に存在するか確認（SHAを取得するため）
    let sha: string | undefined;
    try {
      const getResponse = await fetch(
        `https://api.github.com/repos/${githubOwner}/${githubRepo}/contents/${path}?ref=${githubBranch}`,
        {
          headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        }
      );
      if (getResponse.ok) {
        const fileData = await getResponse.json();
        sha = fileData.sha;
      }
    } catch (err) {
      // ファイルが存在しない場合は新規作成
    }

    // ファイルをBase64エンコード
    const base64Content = btoa(unescape(encodeURIComponent(content)));

    // ファイルをアップロード
    const response = await fetch(
      `https://api.github.com/repos/${githubOwner}/${githubRepo}/contents/${path}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
          },
        body: JSON.stringify({
          message,
          content: base64Content,
          branch: githubBranch,
          ...(sha && { sha }), // 既存ファイルの場合はSHAを含める
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `GitHub APIエラー: ${response.status}`);
    }
  };

  // バイナリファイルをGitHubにアップロードする関数
  const uploadBinaryFileToGitHub = async (
    path: string,
    file: File,
    message: string,
    token: string
  ): Promise<void> => {
    const githubOwner = process.env.REACT_APP_GITHUB_OWNER || 'yutokawamata';
    const githubRepo = process.env.REACT_APP_GITHUB_REPO || 'TextStimulationApp';
    const githubBranch = 'gh-pages';

    // バイナリファイルをBase64エンコード
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const binaryString = String.fromCharCode.apply(null, Array.from(uint8Array));
    const base64Content = btoa(binaryString);

    // 既存ファイルのSHAを取得（存在する場合）
    let sha: string | undefined;
    try {
      const getResponse = await fetch(
        `https://api.github.com/repos/${githubOwner}/${githubRepo}/contents/${path}?ref=${githubBranch}`,
        {
          headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        }
      );
      if (getResponse.ok) {
        const fileData = await getResponse.json();
        sha = fileData.sha;
      }
    } catch {
      // ファイルが存在しない場合は無視
    }

    // バイナリファイルをアップロード
    const response = await fetch(
      `https://api.github.com/repos/${githubOwner}/${githubRepo}/contents/${path}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          content: base64Content,
          branch: githubBranch,
          ...(sha && { sha }),
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `GitHub APIエラー: ${response.status}`);
    }
  };

  // text-list.jsonを更新する関数
  const updateTextListJson = async (gradeFolder: string, storyFileName: string, storyLabel: string, token: string): Promise<void> => {
    const githubOwner = process.env.REACT_APP_GITHUB_OWNER || 'yutokawamata';
    const githubRepo = process.env.REACT_APP_GITHUB_REPO || 'TextStimulationApp';
    const githubBranch = 'gh-pages'; // デプロイ先のブランチ

    if (!token) {
      throw new Error('GitHub Personal Access Tokenが入力されていません。');
    }

    // 現在のtext-list.jsonを取得（gh-pagesブランチから）
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

    // 新しい文章を追加
    const gradeIndex = currentContent.grades.findIndex((g: any) => g.folder === gradeFolder);
    if (gradeIndex >= 0) {
      // 学年が既に存在する場合
      const storyExists = currentContent.grades[gradeIndex].stories.some(
        (s: any) => s.filename === storyFileName
      );
      if (!storyExists) {
        currentContent.grades[gradeIndex].stories.push({
          filename: storyFileName,
          label: storyLabel,
        });
      }
    } else {
      // 新しい学年を追加
      const gradeLabel = grades.find(g => g.folder === gradeFolder)?.label || gradeFolder;
      currentContent.grades.push({
        folder: gradeFolder,
        label: gradeLabel,
        stories: [{
          filename: storyFileName,
          label: storyLabel,
        }],
      });
    }

    // text-list.jsonを更新（gh-pagesブランチに）
    const updatedContent = JSON.stringify(currentContent, null, 2);
    
    // Base64エンコード（UTF-8対応）
    const encoder = new TextEncoder();
    const utf8Bytes = encoder.encode(updatedContent);
    let binaryStr = '';
    for (let i = 0; i < utf8Bytes.length; i++) {
      binaryStr += String.fromCharCode(utf8Bytes[i]);
    }
    const base64Encoded = btoa(binaryStr);
    
    // gh-pagesブランチに直接アップロード
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
          message: `Add new text: ${storyLabel}`,
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

  // アップロード処理
  const handleUpload = async () => {
    // バリデーション
    if (!selectedGrade) {
      setError('学年を選択してください。');
      return;
    }

    if (!textFile) {
      setError('テキストファイルを選択してください。');
      return;
    }

    if (voiceFiles.length === 0) {
      setError('音声ファイルフォルダを選択してください。');
      return;
    }

    if (!githubToken) {
      setError('GitHub Personal Access Tokenを入力してください。');
      return;
    }

    setIsUploading(true);
    setError('');

    try {
      const textFileName = textFile.name;
      const storyFolderName = textFileName.replace(/\.txt$/, '');
      const storyLabel = storyFolderName; // ファイル名をラベルとして使用（必要に応じて変更可能）

      console.log('[アップロード処理] 開始:', { selectedGrade, textFileName, storyFolderName, voiceFilesCount: voiceFiles.length });

      // GitHub APIを使用してアップロード
      const textFileContent = await textFile.text();
      
      // テキストファイルをアップロード（gh-pagesブランチに）
      console.log('[アップロード処理] テキストファイルをアップロード中:', `data/text/${selectedGrade}/${textFileName}`);
      await uploadFileToGitHub(
        `data/text/${selectedGrade}/${textFileName}`,
        textFileContent,
        `Add text file: ${textFileName}`,
        githubToken
      );
      console.log('[アップロード処理] テキストファイルのアップロード完了');

      // 音声ファイルをアップロード（gh-pagesブランチに）
      console.log('[アップロード処理] 音声ファイルをアップロード中:', voiceFiles.length, '個');
      for (let i = 0; i < voiceFiles.length; i++) {
        const voiceFile = voiceFiles[i];
        console.log(`[アップロード処理] 音声ファイル ${i + 1}/${voiceFiles.length}:`, voiceFile.name);
        await uploadBinaryFileToGitHub(
          `data/voice/${selectedGrade}/${storyFolderName}/${voiceFile.name}`,
          voiceFile,
          `Add voice file: ${voiceFile.name}`,
          githubToken
        );
      }
      console.log('[アップロード処理] 音声ファイルのアップロード完了');

      // text-list.jsonを更新
      console.log('[アップロード処理] text-list.jsonを更新中');
      await updateTextListJson(selectedGrade, textFileName, storyLabel, githubToken);
      console.log('[アップロード処理] text-list.jsonの更新完了');

      console.log('[アップロード処理] すべてのアップロード処理が完了しました');

      // 成功時の処理（親コンポーネントでモーダルを閉じる）
      onUploadSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ファイルの処理に失敗しました。');
      console.error('エラー:', err);
    } finally {
      setIsUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={isUploading ? undefined : onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>文章追加</h2>
          <button className={styles.closeButton} onClick={onClose} disabled={isUploading}>
            ×
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="grade-select">
              学年 <span className={styles.required}>*</span>
            </label>
            <select
              id="grade-select"
              className={styles.select}
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
              disabled={isUploading}
            >
              <option value="">選択してください</option>
              {grades.map((grade) => (
                <option key={grade.folder} value={grade.folder}>
                  {grade.label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="text-file">
              テキストファイル <span className={styles.required}>*</span>
            </label>
            <input
              id="text-file"
              ref={textFileInputRef}
              type="file"
              accept=".txt"
              onChange={handleTextFileChange}
              className={styles.fileInput}
              disabled={isUploading}
            />
            {textFile && (
              <p className={styles.fileName}>選択中: {textFile.name}</p>
            )}
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="voice-folder">
              音声ファイルフォルダ <span className={styles.required}>*</span>
            </label>
            <input
              id="voice-folder"
              ref={voiceFolderInputRef}
              type="file"
              accept=".wav"
              {...({ webkitdirectory: '', directory: '' } as any)}
              multiple
              onChange={handleVoiceFolderChange}
              className={styles.fileInput}
              disabled={isUploading}
            />
            {voiceFiles.length > 0 && (
              <p className={styles.fileName}>
                選択中: {voiceFiles.length}個のファイル
                <br />
                <span className={styles.fileList}>
                  {voiceFiles.slice(0, 5).map((f) => f.name).join(', ')}
                  {voiceFiles.length > 5 && ` ...他${voiceFiles.length - 5}個`}
                </span>
              </p>
            )}
          </div>

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
              disabled={isUploading}
            />
            <p className={styles.helpText}>
              取得方法: GitHub &gt; Settings &gt; Developer settings &gt; Personal access tokens &gt; Tokens (classic)
              <br />
              必要な権限: repo (すべてのリポジトリへのアクセス)
            </p>
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.actions}>
            <button
              type="button"
              className={`button ${styles.cancelButton}`}
              onClick={onClose}
              disabled={isUploading}
            >
              キャンセル
            </button>
            <button
              type="button"
              className={`button ${styles.uploadButton}`}
              onClick={handleUpload}
              disabled={isUploading || !selectedGrade || !textFile || voiceFiles.length === 0 || !githubToken}
            >
              {isUploading ? 'アップロード中...' : 'アップロード'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

