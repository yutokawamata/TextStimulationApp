import React, { useEffect, useRef, useState } from 'react';
import styles from '../styles/components/TextDisplay.module.css';
import { TextAppSettings } from './HomeScreen';

/**
 * 文節表示コンポーネント
 * 
 * 選択されたテキストファイルを読み込み、文節を1つずつ表示します。
 * - クリックまたはEnterキーで次の文節に進む
 * - 現在の文節のみを表示し、それ以外は非表示
 * - 音声ありモードでは、AudioContextを使用して音声をキャッシュし、タイムラグなく再生
 */

// AudioContextを使用した音声再生のためのグローバル変数
let audioContext: AudioContext | null = null;
let audioBufferCache: Record<string, AudioBuffer> = {};
let isAudioContextInitialized = false;
let isAudioEnabled = false;

/**
 * AudioContextを初期化する関数
 */
const initAudioContext = () => {
  if (isAudioContextInitialized) return;
  
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioContext = new AudioContextClass();
    isAudioContextInitialized = true;
    console.log('[音声初期化] AudioContextが初期化されました');
  } catch (error) {
    console.error('[音声初期化] AudioContextの初期化に失敗しました:', error);
    isAudioContextInitialized = false;
  }
};

/**
 * ユーザーインタラクションで音声再生を有効化する関数
 */
const enableAudio = (): Promise<void> => {
  if (isAudioEnabled) return Promise.resolve();
  
  return new Promise((resolve) => {
    initAudioContext();
    
    if (audioContext && audioContext.state === 'suspended') {
      audioContext.resume().then(() => {
        console.log('[音声初期化] AudioContextが再開されました');
        isAudioEnabled = true;
        resolve();
      }).catch(error => {
        console.warn('[音声初期化] AudioContextの再開に失敗しました:', error);
        resolve();
      });
    } else {
      // 無音の短い音声を再生して音声再生を有効化（フォールバック）
      const tempAudio = new Audio();
      tempAudio.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
      tempAudio.volume = 0.01;
      
      const playHandler = () => {
        console.log('[音声初期化] 音声再生が有効化されました');
        isAudioEnabled = true;
        tempAudio.removeEventListener('play', playHandler);
        tempAudio.removeEventListener('ended', endedHandler);
        tempAudio.removeEventListener('error', errorHandler);
        resolve();
      };
      
      const endedHandler = () => {
        tempAudio.removeEventListener('play', playHandler);
        tempAudio.removeEventListener('ended', endedHandler);
        tempAudio.removeEventListener('error', errorHandler);
        resolve();
      };
      
      const errorHandler = () => {
        console.warn('[音声初期化] 音声再生の有効化に失敗しました');
        tempAudio.removeEventListener('play', playHandler);
        tempAudio.removeEventListener('ended', endedHandler);
        tempAudio.removeEventListener('error', errorHandler);
        resolve();
      };
      
      tempAudio.addEventListener('play', playHandler);
      tempAudio.addEventListener('ended', endedHandler);
      tempAudio.addEventListener('error', errorHandler);
      
      tempAudio.play().catch(errorHandler);
    }
    
    // 5秒後にタイムアウト
    setTimeout(() => {
      if (!isAudioEnabled) {
        console.warn('[音声初期化] タイムアウトしましたが続行します');
        isAudioEnabled = true;
        resolve();
      }
    }, 5000);
  });
};

type Segment = {
  voiceFile: string;
  text: string;
  furigana?: string; // ふりがな（オプション）
  isLineBreak?: boolean; // 改行セグメントかどうか（オプション）
  // ふりがなの形式:
  // - 単一のふりがな: "もり" → 文節内の最初の漢字に振る
  // - 複数のふりがな（カンマ区切り）: "がっ,こう" → 文節内の漢字に順番に振る
  // - 漢字とふりがなの対応（コロン区切り）: "学:がっ,校:こう" → 指定された漢字に振る
};

interface TextDisplayProps {
  textAppSettings: TextAppSettings | null;
  onBack: () => void;
  onComplete?: (elapsedTime?: number) => void; // 文章練習が終了した時に呼ばれるコールバック（経過時間を渡す）
}

export const TextDisplay: React.FC<TextDisplayProps> = ({ 
  textAppSettings,
  onBack,
  onComplete
}) => {
  // テキストファイルから読み込んだ文節の配列
  const [segments, setSegments] = useState<Segment[]>([]);
  // 現在表示中の文節のインデックス
  const [currentSegment, setCurrentSegment] = useState(0);
  // ファイル読み込み中の状態
  const [isLoading, setIsLoading] = useState(true);
  // エラーメッセージ
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // 再生中の音声ソースを保持
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  // 音声ファイルパスのキャッシュ（キー: 文節インデックス、値: 音声ファイルパス）
  const audioPathCacheRef = useRef<Map<number, string>>(new Map());
  // 全文節モードの表示開始時刻（時間計測用）
  const fullTextStartTimeRef = useRef<number | null>(null);
  // 全文節モードのコンテナとテキスト表示要素の参照（デバッグ用）
  const containerFullTextRef = useRef<HTMLDivElement | null>(null);
  const textDisplayFullTextRef = useRef<HTMLDivElement | null>(null);

  /**
   * テキストファイルを読み込む
   * textAppSettingsが変更された時に実行される
   */
  useEffect(() => {
    // textAppSettingsが設定されている場合のみファイルを読み込む
    if (!textAppSettings) {
      setIsLoading(false);
      return;
    }

    const basePath = process.env.PUBLIC_URL || '';
    const filePath = `${basePath}/data/text/${textAppSettings.gradeFolder}/${textAppSettings.storyFilename}`;
    console.log('ファイル読み込み開始:', filePath);
    
    setIsLoading(true);
    setCurrentSegment(0); // 最初の文節にリセット
    
    // fetch APIを使ってテキストファイルを読み込む
    fetch(filePath)
      .then(response => {
        console.log('レスポンス受信:', response.status, response.statusText);
        
        // レスポンスが正常かチェック
        if (!response.ok) {
          console.error('HTTPエラー:', response.status, response.statusText);
          throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
        }
        
        console.log('レスポンス正常、テキスト変換中...');
        return response.text(); // レスポンスをテキスト形式に変換
      })
      .then(text => {
        console.log('テキスト受信完了、長さ:', text.length);
        
        // テキストが空でないかチェック
        if (!text || text.trim() === '') {
          console.error('エラー: ファイルが空です');
          throw new Error('ファイルが空です');
        }
        
    // テキストを改行で分割して配列にする
    // 空行も保持して改行として扱う
        const rows = text
          .split('\n')
          .map(line => line.replace(/\r$/, '')); // Windowsの改行コード対応

        // CSV形式（音声ファイル名, 文節, ふりがな）を解析
        // 3列目（ふりがな）はオプション（存在しない場合はundefined）
        // ふりがなの部分にはカンマが含まれる可能性があるため、最初の2つのカンマで分割する
        const parsedSegments: Segment[] = [];
        
        for (const row of rows) {
          // 空行の場合は改行セグメントを追加
          if (row.trim() === '') {
            parsedSegments.push({
              voiceFile: '',
              text: '',
              isLineBreak: true,
            });
            continue;
          }
          
          // 最初の2つのカンマで分割（音声ファイル名、文節、ふりがな）
          // 正規表現で最初の2つのカンマの位置を探す
          const firstCommaIndex = row.indexOf(',');
          const secondCommaIndex = firstCommaIndex >= 0 ? row.indexOf(',', firstCommaIndex + 1) : -1;
          
          let voiceFile = '';
          let text = '';
          let furigana: string | undefined = undefined;
          
          if (firstCommaIndex < 0) {
            // カンマが1つもない場合
            voiceFile = row.trim();
            text = voiceFile;
          } else if (secondCommaIndex < 0) {
            // カンマが1つだけの場合（音声ファイル名と文節のみ）
            voiceFile = row.substring(0, firstCommaIndex).trim();
            text = row.substring(firstCommaIndex + 1).trim();
          } else {
            // カンマが2つ以上ある場合
            voiceFile = row.substring(0, firstCommaIndex).trim();
            text = row.substring(firstCommaIndex + 1, secondCommaIndex).trim();
            // 2つ目のカンマ以降をすべてふりがなとして扱う（カンマを含む）
            furigana = row.substring(secondCommaIndex + 1).trim();
          }
          
          // テキストが空でない場合のみ追加
          if (text.length > 0) {
            parsedSegments.push({
              voiceFile,
              text,
              furigana: furigana && furigana.length > 0 ? furigana : undefined,
            });
          }
        }

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/68d2cc49-45a6-4a5e-8838-9aef7ac147a9', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: 'TextDisplay.tsx:240',
            message: 'パースされたセグメント確認',
            data: {
              totalSegments: parsedSegments.length,
              lineBreakCount: parsedSegments.filter(s => s.isLineBreak).length,
              first20Segments: parsedSegments.slice(0, 20).map((s, idx) => ({
                index: idx,
                isLineBreak: s.isLineBreak,
                text: s.text.substring(0, 10)
              }))
            },
            timestamp: Date.now(),
            sessionId: 'debug-session',
            runId: 'run1',
            hypothesisId: 'C'
          })
        }).catch(() => {});
        // #endregion

        console.log('分割された文節:', parsedSegments);
        console.log('文節数:', parsedSegments.length);
        
        // 文節が存在するかチェック
    if (parsedSegments.length === 0) {
          console.error('エラー: 文節が見つかりません');
          throw new Error('文節が見つかりません');
        }

        // 文節の配列を状態に保存
        console.log('文節を状態に保存中...');
    setSegments(parsedSegments);
        // 最初の非改行セグメントを見つける
        let firstNonLineBreakIndex = 0;
        while (firstNonLineBreakIndex < parsedSegments.length && parsedSegments[firstNonLineBreakIndex]?.isLineBreak) {
          firstNonLineBreakIndex++;
        }
        setCurrentSegment(firstNonLineBreakIndex); // 最初の非改行文節にリセット
        
        // 読み込み完了の状態に変更
        console.log('読み込み完了');
        setIsLoading(false);
        setErrorMessage(null);
      })
      .catch(error => {
        // エラーが発生した場合の処理
        console.error('=== ファイル読み込みエラー ===');
        console.error('エラータイプ:', error.name);
        console.error('エラーメッセージ:', error.message);
        console.error('エラースタック:', error.stack);
        console.error('========================');
        
        // エラー用のデフォルト文節を設定
        setSegments([{ voiceFile: '', text: 'ファイルの読み込みに失敗しました。' }]);
        setErrorMessage('ファイルの読み込みに失敗しました。');
        setIsLoading(false);
      });
  }, [textAppSettings]); // textAppSettingsが変更された時に実行

  // コンポーネントのアンマウント時に音声を停止
  useEffect(() => {
    return () => {
      if (currentSourceRef.current) {
        try {
          currentSourceRef.current.stop();
        } catch (e) {
          // 既に停止している場合は無視
        }
        currentSourceRef.current = null;
      }
    };
  }, []);

  /**
   * 音声ファイルのパスを解決し、事前にバッファを読み込む
   */
  useEffect(() => {
    audioPathCacheRef.current.clear();

    if (!textAppSettings || textAppSettings.voiceMode !== 'voice-on' || segments.length === 0) {
      return;
    }

    let disposed = false;

    const preload = async () => {
      // 音声再生を有効化
      await enableAudio();

      for (let i = 0; i < segments.length; i++) {
        if (disposed) {
          break;
        }
        const segment = segments[i];
        if (!segment.voiceFile) {
          continue;
        }
        try {
          const audioPath = await resolveAudioPath(segment.voiceFile, textAppSettings);
          if (!disposed && audioPath) {
            audioPathCacheRef.current.set(i, audioPath);
            // バッファを事前に読み込む（エラーが発生しても続行）
            try {
              await loadAudioBuffer(audioPath);
            } catch (bufferError) {
              // デコードエラーが発生しても、パスはキャッシュしておく
              // 再生時にAudio要素でフォールバックできるようにする
              console.warn(`音声バッファの事前読み込みに失敗しました (文節${i}):`, bufferError);
            }
          }
        } catch (error) {
          console.warn(`音声の事前読み込みに失敗しました (文節${i}):`, error);
        }
      }
    };

    preload();

    return () => {
      disposed = true;
      const cache = audioPathCacheRef.current;
      if (cache) {
        cache.clear();
      }
    };
  }, [segments, textAppSettings]);

  /**
   * 全文節モードの表示開始時刻を記録する
   * segmentsが設定され、全文節モードの場合に実行される
   */
  useEffect(() => {
    if (textAppSettings?.voiceMode === 'full-text' && segments.length > 0 && !isLoading) {
      if (fullTextStartTimeRef.current === null) {
        fullTextStartTimeRef.current = Date.now();
        console.log('[全文節モード] 表示開始時刻を記録:', fullTextStartTimeRef.current);
      }
    } else {
      // 全文節モードでない場合、またはsegmentsがクリアされた場合は時刻をリセット
      fullTextStartTimeRef.current = null;
    }
  }, [segments, textAppSettings, isLoading]);

  /**
   * 全文節モードのレイアウト値を確認（デバッグ用）
   */
  useEffect(() => {
    // 通常モードと全文節モードの両方でレイアウト値を確認
    if (!textAppSettings) {
      return;
    }

    // 通常モードの場合
    if (textAppSettings.voiceMode !== 'full-text') {
      // レイアウト値を確認するためのタイマー（DOMが更新された後に実行）
      const timer = setTimeout(() => {
        const containerNormal = document.querySelector(`.${styles.containerNormal}`);
        const textDisplay = document.querySelector(`.${styles.textDisplay}`);
        if (containerNormal && textDisplay) {
          const containerRect = containerNormal.getBoundingClientRect();
          const textDisplayRect = textDisplay.getBoundingClientRect();
          const containerStyles = window.getComputedStyle(containerNormal);
          const textDisplayStyles = window.getComputedStyle(textDisplay);
          const naviElement = document.querySelector('[class*="Navi"]');
          const naviRect = naviElement ? naviElement.getBoundingClientRect() : null;

          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/68d2cc49-45a6-4a5e-8838-9aef7ac147a9', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              location: 'TextDisplay.tsx:383',
              message: '通常モードレイアウト値確認',
              data: {
                containerRect: {
                  top: containerRect.top,
                  bottom: containerRect.bottom,
                  height: containerRect.height,
                  width: containerRect.width
                },
                textDisplayRect: {
                  top: textDisplayRect.top,
                  bottom: textDisplayRect.bottom,
                  height: textDisplayRect.height,
                  width: textDisplayRect.width
                },
                naviRect: naviRect ? {
                  top: naviRect.top,
                  bottom: naviRect.bottom,
                  height: naviRect.height,
                  width: naviRect.width
                } : null,
                containerStyles: {
                  display: containerStyles.display,
                  alignItems: containerStyles.alignItems,
                  justifyContent: containerStyles.justifyContent,
                  paddingTop: containerStyles.paddingTop,
                  marginTop: containerStyles.marginTop
                },
                textDisplayStyles: {
                  writingMode: textDisplayStyles.writingMode,
                  marginTop: textDisplayStyles.marginTop,
                  paddingTop: textDisplayStyles.paddingTop
                }
              },
              timestamp: Date.now(),
              sessionId: 'debug-session',
              runId: 'run1',
              hypothesisId: 'D'
            })
          }).catch(() => {});
          // #endregion
        }
      }, 100);

      return () => clearTimeout(timer);
    }

    // 全文節モードの場合
    if (textAppSettings.voiceMode === 'full-text') {
      // レイアウト値を確認するためのタイマー（DOMが更新された後に実行）
      const timer = setTimeout(() => {
        if (containerFullTextRef.current && textDisplayFullTextRef.current) {
          const container = containerFullTextRef.current;
          const textDisplay = textDisplayFullTextRef.current;
          const containerRect = container.getBoundingClientRect();
          const textDisplayRect = textDisplay.getBoundingClientRect();
          const containerStyles = window.getComputedStyle(container);
          const textDisplayStyles = window.getComputedStyle(textDisplay);

          // 文節要素と改行要素を確認
          const segmentElements = Array.from(textDisplay.querySelectorAll(`.${styles.textSegment}`));
          const lineBreakElements = Array.from(textDisplay.querySelectorAll(`.${styles.lineBreak}`));
          const segmentRects: Array<{top: number, height: number, margin: string}> = [];
          segmentElements.forEach((seg, idx) => {
            const rect = seg.getBoundingClientRect();
            const segStyles = window.getComputedStyle(seg as Element);
            segmentRects.push({
              top: rect.top,
              height: rect.height,
              margin: segStyles.margin
            });
          });

          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/68d2cc49-45a6-4a5e-8838-9aef7ac147a9', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              location: 'TextDisplay.tsx:377',
              message: '全文節モードレイアウト値確認',
              data: {
                containerRect: {
                  top: containerRect.top,
                  bottom: containerRect.bottom,
                  height: containerRect.height,
                  width: containerRect.width
                },
                textDisplayRect: {
                  top: textDisplayRect.top,
                  bottom: textDisplayRect.bottom,
                  height: textDisplayRect.height,
                  width: textDisplayRect.width
                },
                containerStyles: {
                  display: containerStyles.display,
                  alignItems: containerStyles.alignItems,
                  justifyContent: containerStyles.justifyContent,
                  alignContent: containerStyles.alignContent,
                  height: containerStyles.height,
                  paddingTop: containerStyles.paddingTop,
                  marginTop: containerStyles.marginTop
                },
                textDisplayStyles: {
                  writingMode: textDisplayStyles.writingMode,
                  alignSelf: textDisplayStyles.alignSelf,
                  marginTop: textDisplayStyles.marginTop,
                  marginLeft: textDisplayStyles.marginLeft,
                  paddingTop: textDisplayStyles.paddingTop,
                  fontSize: textDisplayStyles.fontSize
                },
                segmentCount: segmentElements.length,
                lineBreakCount: lineBreakElements.length,
                segmentRects: segmentRects.slice(0, 10), // 最初の10個のみ
                parsedSegmentsInfo: {
                  total: segmentElements.length,
                  lineBreaks: lineBreakElements.length
                }
              },
              timestamp: Date.now(),
              sessionId: 'debug-session',
              runId: 'run1',
              hypothesisId: 'A'
            })
          }).catch(() => {});
          // #endregion

          // 空行の処理を確認（stateのsegmentsを使用）
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/68d2cc49-45a6-4a5e-8838-9aef7ac147a9', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              location: 'TextDisplay.tsx:450',
              message: '空行処理確認',
              data: {
                segmentsWithLineBreaks: segments.filter(s => s.isLineBreak).length,
                totalSegments: segments.length,
                firstFewSegments: segments.slice(0, 20).map((s, idx) => ({
                  index: idx,
                  isLineBreak: s.isLineBreak,
                  text: s.text.substring(0, 10)
                }))
              },
              timestamp: Date.now(),
              sessionId: 'debug-session',
              runId: 'run1',
              hypothesisId: 'B'
            })
          }).catch(() => {});
          // #endregion
        }
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [textAppSettings?.voiceMode, segments, textAppSettings]);

  /**
   * 現在の文節に対応した音声を再生する
   */
  useEffect(() => {
    if (!textAppSettings || textAppSettings.voiceMode !== 'voice-on') {
      if (currentSourceRef.current) {
        try {
          currentSourceRef.current.stop();
        } catch (e) {
          // 既に停止している場合は無視
        }
        currentSourceRef.current = null;
      }
      return;
    }

    const segment = segments[currentSegment];
    if (!segment || !segment.voiceFile) {
      if (currentSourceRef.current) {
        try {
          currentSourceRef.current.stop();
        } catch (e) {
          // 既に停止している場合は無視
        }
        currentSourceRef.current = null;
      }
      return;
    }

    const playAudio = async () => {
      // 音声再生を有効化
      await enableAudio();

      // 既存の音声を停止
      if (currentSourceRef.current) {
        try {
          currentSourceRef.current.stop();
        } catch (e) {
          // 既に停止している場合は無視
        }
        currentSourceRef.current = null;
      }

      // キャッシュから音声パスを取得
      let audioPath: string | undefined = audioPathCacheRef.current.get(currentSegment);
      if (!audioPath) {
        // キャッシュに無い場合は解決を試みる
        const resolvedPath = await resolveAudioPath(segment.voiceFile, textAppSettings);
        if (resolvedPath) {
          audioPath = resolvedPath;
          audioPathCacheRef.current.set(currentSegment, audioPath);
        }
      }

      if (!audioPath) {
        console.warn('音声ファイルのパスを解決できませんでした');
        return;
      }

      // AudioContextを使用して再生
      if (isAudioContextInitialized && audioContext) {
        try {
          console.log('[音声再生] AudioContextで再生を試みます:', audioPath);
          const buffer = await loadAudioBuffer(audioPath);
          const source = audioContext!.createBufferSource();
          source.buffer = buffer;
          source.connect(audioContext!.destination);
          
          currentSourceRef.current = source;
          source.start(0);
          console.log('[音声再生] AudioContextで再生開始:', audioPath);
          
          source.onended = () => {
            console.log('[音声再生] AudioContextで再生終了:', audioPath);
            currentSourceRef.current = null;
          };
        } catch (error) {
          // デコードエラーやその他のエラーが発生した場合は、Audio要素でフォールバック
          if (error instanceof Error && error.name === 'EncodingError') {
            console.warn('[音声再生] 音声ファイルのデコードに失敗しました。Audio要素で再生を試みます:', error, audioPath);
          } else {
            console.error('[音声再生] AudioContextでの再生に失敗しました:', error, audioPath);
          }
          // フォールバック: 通常のAudio要素を使用
          playWithAudioElement(audioPath);
        }
      } else {
        // AudioContextが利用できない場合は通常のAudio要素を使用
        console.log('[音声再生] AudioContextが利用できないため、Audio要素を使用:', audioPath);
        playWithAudioElement(audioPath);
      }
    };

    playAudio();
  }, [segments, currentSegment, textAppSettings]);

  /**
   * 通常のAudioオブジェクトを使用して音声を再生する関数（フォールバック用）
   */
  const playWithAudioElement = (audioPath: string) => {
    console.log('[音声再生] Audio要素で再生を試みます:', audioPath);
    const audio = new Audio(audioPath);
    
    audio.addEventListener('error', (e) => {
      console.error('[音声再生] Audio要素でエラーが発生しました:', e, audioPath);
    });
    
    audio.addEventListener('loadstart', () => {
      console.log('[音声再生] 読み込み開始:', audioPath);
    });
    
    audio.addEventListener('canplay', () => {
      console.log('[音声再生] 再生可能になりました:', audioPath);
    });
    
    audio.play().catch(err => {
      if (err.name === 'AbortError') {
        return;
      }
      console.error('[音声再生] 再生に失敗しました:', err, audioPath);
    });
  };

  /**
   * 音声ファイルのパスを解決する
   * 
   * CSVファイルから取得した音声ファイル名（例: "001"）から、
   * 実際の音声ファイルのパス（例: "/data/voice/1年生/森へ行こう/001.wav"）を解決します。
   * 
   * 解決ロジック:
   * 1. テキストファイル名から拡張子を除去（例: "01_森へ行こう.txt" → "01_森へ行こう"）
   * 2. 先頭の番号とアンダースコアを除去（例: "01_森へ行こう" → "森へ行こう"）
   * 3. 両方のディレクトリ名を候補として試行
   * 4. 音声ファイル名に拡張子がない場合は、.wavと.mp3を自動的に試行
   * 5. Content-Typeがaudio/で始まるファイルのみを有効とみなす
   * 
   * @param voiceFile - CSVから取得した音声ファイル名（例: "001"）
   * @param settings - アプリの設定（学年フォルダ、文章ファイル名など）
   * @returns 解決された音声ファイルのパス、見つからない場合はnull
   */
  const resolveAudioPath = async (voiceFile: string, settings: TextAppSettings): Promise<string | null> => {
    const basePath = process.env.PUBLIC_URL || '';
    // テキストファイル名から拡張子を除去（例: "01_森へ行こう.txt" → "01_森へ行こう"）
    const storyBaseName = settings.storyFilename.replace(/\.[^/.]+$/, '');
    // 先頭の番号とアンダースコアを除去（例: "01_森へ行こう" → "森へ行こう"）
    const storyNameWithoutPrefix = storyBaseName.replace(/^[0-9]+_?/, '');
    // 両方のディレクトリ名を候補として試行（番号付きと番号なし）
    const storyDirCandidates = Array.from(new Set([storyBaseName, storyNameWithoutPrefix].filter(Boolean)));

    const rawVoiceFile = voiceFile.trim();
    // 拡張子が既に含まれているかチェック（例: "001.wav" → true, "001" → false）
    const hasExtension = /\.[^/.]+$/.test(rawVoiceFile);
    // 拡張子を除去したベースファイル名を取得（例: "001.wav" → "001"）
    const baseVoiceName = hasExtension ? rawVoiceFile.replace(/\.[^/.]+$/, '') : rawVoiceFile;

    // 拡張子付きのファイル名を優先的に生成
    // 音声ファイル名に拡張子がない場合（例: "001"）は、.wavと.mp3を自動的に試行
    const fileCandidates = Array.from(
      new Set(
        [
          // 拡張子が既にある場合はそのまま使用（例: "001.wav"）
          hasExtension ? rawVoiceFile : null,
          // 拡張子がない場合は、.wavと.mp3を追加（例: "001" → "001.wav", "001.mp3"）
          !hasExtension && baseVoiceName ? `${baseVoiceName}.wav` : null,
          !hasExtension && baseVoiceName ? `${baseVoiceName}.mp3` : null,
          // 念のため、baseVoiceNameからも生成（拡張子がある場合でも）
          baseVoiceName && baseVoiceName !== rawVoiceFile ? `${baseVoiceName}.wav` : null,
          baseVoiceName && baseVoiceName !== rawVoiceFile ? `${baseVoiceName}.mp3` : null,
        ].filter(Boolean) as string[]
      )
    );

    if (fileCandidates.length === 0 || storyDirCandidates.length === 0) {
      console.warn('[音声パス解決] 候補がありません:', { voiceFile, storyDirCandidates, fileCandidates });
      return null;
    }

    // URLエンコード用のヘルパー関数（日本語や特殊文字を含むパスに対応）
    const encodeSegment = (value: string) => encodeURIComponent(value);

    // ファイルの存在確認（直接fetchで試行、エラーが発生しなければ有効とみなす）
    // 拡張子付きのファイル名を優先的に試行（拡張子なしのパスでHTMLが返ってくるのを防ぐ）
    const sortedFileCandidates = [...fileCandidates].sort((a, b) => {
      const aHasExt = /\.[^/.]+$/.test(a);
      const bHasExt = /\.[^/.]+$/.test(b);
      // 拡張子がある方を優先（-1で前に、1で後ろに）
      if (aHasExt && !bHasExt) return -1;
      if (!aHasExt && bHasExt) return 1;
      return 0;
    });

    for (const dir of storyDirCandidates) {
      for (const fileName of sortedFileCandidates) {
        const audioPath = `${basePath}/data/voice/${encodeSegment(settings.gradeFolder)}/${encodeSegment(dir)}/${encodeSegment(fileName)}`;
        console.log('[音声パス解決] 試行中:', audioPath);
        
        try {
          // 直接fetchで試行（HEADリクエストはCORSで失敗する可能性があるため）
          // 最初の数バイトだけ取得して存在確認
          const response = await fetch(audioPath, { 
            method: 'GET',
            headers: { 'Range': 'bytes=0-1023' } // 最初の1KBだけ取得
          });
          
          // 200 OK または 206 Partial Content なら成功
          if (response.ok || response.status === 206) {
            // Content-Typeを確認して音声ファイルかどうかチェック（厳密に）
            const contentType = response.headers.get('content-type') || '';
            const isAudioFile = contentType.startsWith('audio/');
            
            if (isAudioFile) {
              console.log('[音声パス解決] 音声ファイルが見つかりました:', audioPath, 'Content-Type:', contentType);
              return audioPath;
            } else if (response.status === 206 && contentType === '') {
              // Rangeリクエストで206が返ってきた場合、Content-Typeが空でも音声ファイルの可能性がある
              // 実際にデコードを試みて確認
              try {
                const arrayBuffer = await response.arrayBuffer();
                if (audioContext) {
                  await audioContext.decodeAudioData(arrayBuffer.slice(0));
                  console.log('[音声パス解決] 音声ファイルとして有効と確認:', audioPath);
                  return audioPath;
                }
              } catch (decodeError) {
                console.log('[音声パス解決] デコードテスト失敗、次の候補を試行:', audioPath);
                continue;
              }
            } else {
              console.log('[音声パス解決] ファイルは存在するが音声ファイルではない:', audioPath, 'Content-Type:', contentType);
              // HTMLが返ってきた場合は、そのパスは無効なので次の候補を試す
              continue;
            }
          } else {
            console.log('[音声パス解決] ファイルが見つかりませんでした:', audioPath, 'Status:', response.status);
          }
        } catch (error) {
          // エラーが発生しても次の候補を試す
          console.log('[音声パス解決] 試行失敗:', audioPath, error);
          continue;
        }
      }
    }

    console.warn('[音声パス解決] 音声ファイルが見つかりませんでした:', { 
      voiceFile, 
      gradeFolder: settings.gradeFolder,
      storyFilename: settings.storyFilename,
      storyDirCandidates, 
      fileCandidates 
    });
    return null;
  };

  /**
   * 音声ファイルを読み込み、AudioBufferとしてキャッシュする
   */
  const loadAudioBuffer = async (audioPath: string): Promise<AudioBuffer> => {
    // キャッシュから取得
    if (audioBufferCache[audioPath]) {
      return audioBufferCache[audioPath];
    }

    if (!audioContext) {
      throw new Error('AudioContextが初期化されていません');
    }

    // ファイルを読み込む
    const response = await fetch(audioPath);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    
    // デコードを試みる（エラーが発生した場合はそのままthrow）
    try {
      const buffer = await audioContext.decodeAudioData(arrayBuffer);
      // キャッシュに保存
      audioBufferCache[audioPath] = buffer;
      return buffer;
    } catch (decodeError) {
      // デコードエラーの場合は、EncodingErrorとして再throw
      const error = decodeError instanceof Error 
        ? new Error(`音声ファイルのデコードに失敗しました: ${decodeError.message}`)
        : new Error('音声ファイルのデコードに失敗しました');
      (error as any).name = 'EncodingError';
      throw error;
    }
  };

  /**
   * 文節内の漢字のみにふりがなを振る関数
   * 
   * @param text - 文節のテキスト（例: "学校の"）
   * @param furigana - ふりがな（例: "がっこう" または "がっ,こう" または "学:がっ,校:こう"）
   * @returns ふりがなが振られたJSX要素
   */
  const renderTextWithFurigana = (text: string, furigana?: string): React.ReactNode => {
    // ふりがながない場合は通常のテキストを返す
    if (!furigana) {
      return text;
    }

    // 漢字を検出する正規表現（CJK統合漢字の範囲）
    const kanjiRegex = /[\u4E00-\u9FAF]/g;
    const kanjiMatches = Array.from(text.matchAll(kanjiRegex));
    
    // 漢字が含まれていない場合は通常のテキストを返す
    if (kanjiMatches.length === 0) {
      return text;
    }

    // ふりがなの形式を判定（シンプルな方式に統一）
    // 1. カンマが含まれている場合: "がっ,こう" → 漢字の順番にふりがなを振る（空文字の場合はスキップ）
    // 2. その他: "もり" → 最初の漢字にふりがなを振る
    // 
    // 例:
    // - "もり" → 最初の漢字「森」に「もり」
    // - "がっ,こう" → 「学」に「がっ」、「校」に「こう」
    // - "と,しょ,しつ" → 「図」に「と」、「書」に「しょ」、「室」に「しつ」
    // - "よ" → 「読」に「よ」（最初の漢字のみ）
    // - "と,,しつ" → 「図」に「と」、「書」はスキップ、「室」に「しつ」（空文字でスキップ）
    // 
    // 注意: 同じ漢字が複数回出現する場合でも、順番通りにふりがなを振るため、
    // 各漢字の出現位置（インデックス）をキーとして管理する

    // 各漢字の出現位置（インデックス）をキーとして、ふりがなを管理
    const furiganaByIndex: Map<number, string> = new Map();
    
    if (furigana.includes(',')) {
      // 形式: "がっ,こう" → 漢字の順番にふりがなを振る（空文字の場合はスキップ）
      const furiganaList = furigana.split(',').map(f => f.trim());
      kanjiMatches.forEach((match, index) => {
        if (index < furiganaList.length && match.index !== undefined) {
          const furi = furiganaList[index];
          // 空文字でない場合のみふりがなを設定
          if (furi && furi.length > 0) {
            furiganaByIndex.set(match.index, furi);
          }
        }
      });
    } else {
      // 形式: "もり" → 最初の漢字にふりがなを振る
      if (kanjiMatches[0] && kanjiMatches[0].index !== undefined) {
        furiganaByIndex.set(kanjiMatches[0].index, furigana);
      }
    }

    // テキストを分割して、漢字にはふりがなを振り、それ以外はそのまま表示
    const result: React.ReactNode[] = [];
    let lastIndex = 0;

    kanjiMatches.forEach((match) => {
      const matchIndex = match.index ?? 0;
      const kanji = match[0];
      
      // 漢字の前のテキストを追加
      if (matchIndex > lastIndex) {
        result.push(text.substring(lastIndex, matchIndex));
      }
      
      // 漢字にふりがなを振る（出現位置をキーとして取得）
      const furi = furiganaByIndex.get(matchIndex);
      if (furi) {
        result.push(
          <ruby key={`ruby-${matchIndex}`}>
            {kanji}
            <rt>{furi}</rt>
          </ruby>
        );
      } else {
        // ふりがなが指定されていない漢字はそのまま表示
        result.push(kanji);
      }
      
      lastIndex = matchIndex + kanji.length;
    });

    // 残りのテキストを追加
    if (lastIndex < text.length) {
      result.push(text.substring(lastIndex));
    }

    return <>{result}</>;
  };

  /**
   * 次の文節に進む関数
   * 最後の文節に到達したら、onCompleteコールバックを呼び出す
   * 改行セグメントの場合はスキップして次の文節に進む
   */
  const handleNextSegment = () => {
    let nextSegment = currentSegment + 1;
    
    // 改行セグメントをスキップ
    while (nextSegment < segments.length && segments[nextSegment]?.isLineBreak) {
      nextSegment++;
    }
    
    if (nextSegment < segments.length) {
      setCurrentSegment(nextSegment);
    } else {
      // 最後の文節に到達したら、練習完了としてモード選択画面に遷移
      if (onComplete) {
        onComplete();
      }
    }
  };

  /**
   * キーボードのキーが押された時の処理
   */
  const handleKeyPress = (event: React.KeyboardEvent) => {
    // Enterキーが押された場合
    if (event.key === 'Enter') {
      handleNextSegment();
    }
  };

  // 読み込み中の表示
  if (isLoading) {
    return (
      <div className={styles.container}>
        <p>読み込み中...</p>
      </div>
    );
  }

  // エラー表示
  if (errorMessage) {
    return (
      <div className={styles.container}>
        <p>{errorMessage}</p>
      </div>
    );
  }

  // 全文節モードの場合: 全ての文節を一度に表示し、左下に「つぎへ」ボタンを表示
  if (textAppSettings?.voiceMode === 'full-text') {
    return (
      <div ref={containerFullTextRef} className={styles.containerFullText}>
        <div ref={textDisplayFullTextRef} className={styles.textDisplayFullText}>
          {/* セグメントを4文節ごとに列としてグループ化 */}
          {(() => {
            const columns: Segment[][] = [];
            let currentColumn: Segment[] = [];
            const SEGMENTS_PER_COLUMN = 4; // 1列に4文節
            
            segments.forEach((segment) => {
              // 改行セグメントの場合は列を区切る
              if (segment.isLineBreak) {
                if (currentColumn.length > 0) {
                  columns.push(currentColumn);
                  currentColumn = [];
                }
              } else {
                currentColumn.push(segment);
                // 4文節に達したら列を区切る
                if (currentColumn.length >= SEGMENTS_PER_COLUMN) {
                  columns.push(currentColumn);
                  currentColumn = [];
                }
              }
            });
            
            // 最後の列を追加
            if (currentColumn.length > 0) {
              columns.push(currentColumn);
            }
            
            // flex-direction: row-reverseで右から左に表示されるため、reverse()は不要
            return columns.map((column, columnIndex) => (
              <div key={columnIndex} className={styles.textColumn}>
                {column.map((segment, segmentIndex) => (
                  <span
                    key={segmentIndex}
                    className={`${styles.textSegment} ${styles.textSegmentVisible} ${segmentIndex === 0 ? styles.textSegmentFirstInColumn : ''}`}
                  >
                    {/* ふりがなが存在する場合は漢字のみにふりがなを振る、ない場合は通常のテキスト */}
                    {renderTextWithFurigana(segment.text, segment.furigana)}
                  </span>
                ))}
              </div>
            ));
          })()}
        </div>
        {/* 左下に「つぎへ」ボタンを表示 */}
        <button
          type="button"
          className={`button ${styles.nextButton}`}
          onClick={() => {
            if (onComplete) {
              // 全文節モードの表示開始時刻から現在までの経過時間を計算
              const elapsedTime = fullTextStartTimeRef.current 
                ? Date.now() - fullTextStartTimeRef.current 
                : 0;
              console.log('[全文節モード] 経過時間:', elapsedTime, 'ms');
              onComplete(elapsedTime);
            }
          }}
        >
          つぎへ
        </button>
      </div>
    );
  }

  // 通常モード（音声あり/音声なし）: 文節ごとに1つずつ表示
  return (
    <div 
      className={styles.containerNormal}
      onClick={handleNextSegment}
      onKeyDown={handleKeyPress}
      tabIndex={0}
    >
      <div className={styles.textDisplay}>
        {/* セグメントを4文節ごとに列としてグループ化 */}
        {(() => {
          type ColumnData = {segments: Segment[], nonLineBreakStartIndex: number};
          const columns: ColumnData[] = [];
          let currentColumn: Segment[] = [];
          let nonLineBreakIndex = 0; // 改行セグメントを除いたインデックス
          const SEGMENTS_PER_COLUMN = 4; // 1列に4文節
          
          segments.forEach((segment) => {
            // 改行セグメントの場合は列を区切る
            if (segment.isLineBreak) {
              if (currentColumn.length > 0) {
                columns.push({segments: currentColumn, nonLineBreakStartIndex: nonLineBreakIndex - currentColumn.length});
                currentColumn = [];
              }
            } else {
              if (currentColumn.length === 0) {
                // 列の開始インデックスを記録
              }
              currentColumn.push(segment);
              nonLineBreakIndex++;
              // 4文節に達したら列を区切る
              if (currentColumn.length >= SEGMENTS_PER_COLUMN) {
                columns.push({segments: currentColumn, nonLineBreakStartIndex: nonLineBreakIndex - currentColumn.length});
                currentColumn = [];
              }
            }
          });
          
          // 最後の列を追加
          if (currentColumn.length > 0) {
            columns.push({segments: currentColumn, nonLineBreakStartIndex: nonLineBreakIndex - currentColumn.length});
          }
          
          // flex-direction: row-reverseで右から左に表示されるため、reverse()は不要
          return columns.map((columnData, columnIndex) => (
            <div key={columnIndex} className={styles.textColumn}>
              {columnData.segments.map((segment, segmentIndex) => {
                const globalIndex = columnData.nonLineBreakStartIndex + segmentIndex;
                return (
                  <span
                    key={segmentIndex}
                    className={`${styles.textSegment} ${
                      // 現在の文節のみを表示、それ以外は非表示
                      globalIndex === currentSegment ? styles.textSegmentVisible : styles.textSegmentHidden
                    } ${segmentIndex === 0 ? styles.textSegmentFirstInColumn : ''}`}
                  >
                    {/* ふりがなが存在する場合は漢字のみにふりがなを振る、ない場合は通常のテキスト */}
                    {renderTextWithFurigana(segment.text, segment.furigana)}
                  </span>
                );
              })}
            </div>
          ));
        })()}
      </div>
    </div>
  );
};

