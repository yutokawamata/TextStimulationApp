// 統合PWA用のService Worker
// 文章刺激アプリと漢字チャレンジアプリの両方の音声をキャッシュ

const CACHE_VERSION = 'v1';
const STATIC_CACHE = `static-cache-${CACHE_VERSION}`;
const AUDIO_CACHE = `audio-cache-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dynamic-cache-${CACHE_VERSION}`;

// 静的リソースのキャッシュリスト（TextStimulationAppのみ）
const staticFilesToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/logo192.png',
  '/logo512.png'
];

// インストール時の処理
self.addEventListener('install', event => {
  console.log('[Service Worker] インストール中...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('[Service Worker] 静的リソースをキャッシュ中...');
        return cache.addAll(staticFilesToCache);
      })
      .catch(error => {
        console.error('[Service Worker] 静的リソースのキャッシュに失敗:', error);
      })
  );
  // 新しいService Workerをすぐにアクティベート
  self.skipWaiting();
});

// アクティベート時の処理
self.addEventListener('activate', event => {
  console.log('[Service Worker] アクティベート中...');
  const currentCaches = [STATIC_CACHE, AUDIO_CACHE, DYNAMIC_CACHE];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (!currentCaches.includes(cacheName)) {
            console.log('[Service Worker] 古いキャッシュを削除:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // すべてのクライアントで新しいService Workerを使用
  return self.clients.claim();
});

// フェッチ時の処理
self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);
  
  // 音声ファイルの処理（両アプリ共通）
  // - TextStimulationApp: /public/data/voice/**/*.wav
  // - KanjiChallengeApp: /0120/**/*.mp3 または /Kanji/Sound/**/*.mp3
  if (
    requestUrl.pathname.includes('/voice/') ||
    requestUrl.pathname.includes('/Kanji/Sound/') ||
    requestUrl.pathname.includes('/0120/') && requestUrl.pathname.match(/\.(mp3)$/i) ||
    event.request.url.match(/\.(mp3|wav)$/i)
  ) {
    console.log('[Service Worker] 音声ファイルリクエスト:', requestUrl.pathname);
    event.respondWith(audioCache(event.request));
    return;
  }
  
  // 画像ファイルの処理（キャッシュファースト戦略）
  if (
    requestUrl.pathname.includes('/Kanji/Illust/') || 
    requestUrl.pathname.includes('/Images/') ||
    event.request.url.match(/\.(jpg|jpeg|png|gif|svg|webp)$/i)
  ) {
    event.respondWith(cacheFirst(event.request, DYNAMIC_CACHE));
    return;
  }
  
  // その他のリクエストはネットワークファースト戦略
  event.respondWith(networkFirst(event.request));
});

// 音声専用キャッシュ戦略（Cache First with Network Fallback）
async function audioCache(request) {
  try {
    // 1. キャッシュを確認
    const cache = await caches.open(AUDIO_CACHE);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      console.log('[Service Worker] 音声キャッシュから返却:', request.url);
      return cachedResponse;
    }
    
    // 2. キャッシュにない場合はネットワークから取得
    console.log('[Service Worker] ネットワークから音声を取得:', request.url);
    const networkResponse = await fetch(request);
    
    // 3. 正常なレスポンスの場合はキャッシュに保存
    if (networkResponse && networkResponse.status === 200) {
      console.log('[Service Worker] 音声をキャッシュに保存:', request.url);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[Service Worker] 音声取得エラー:', error);
    // オフライン時やエラー時の処理
    return new Response('音声ファイルの取得に失敗しました', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// キャッシュファースト戦略
async function cacheFirst(request, cacheName) {
  try {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      console.log('[Service Worker] キャッシュから返却:', request.url);
      return cachedResponse;
    }
    
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      console.log('[Service Worker] リソースをキャッシュに保存:', request.url);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[Service Worker] リソース取得エラー:', error);
    return new Response('リソースの取得に失敗しました', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// ネットワークファースト戦略
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[Service Worker] ネットワークエラー、キャッシュを確認:', request.url);
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // HTMLナビゲーションの場合はindex.htmlを返す
    if (request.mode === 'navigate') {
      const indexResponse = await caches.match('/index.html');
      if (indexResponse) {
        return indexResponse;
      }
    }
    
    return new Response('オフラインです。このリソースはキャッシュされていません。', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// メッセージハンドラ（キャッシュクリアなどの操作用）
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            console.log('[Service Worker] キャッシュをクリア:', cacheName);
            return caches.delete(cacheName);
          })
        );
      })
    );
  }
});
