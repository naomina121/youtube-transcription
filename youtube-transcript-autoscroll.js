// ============================================
// グローバル変数
// ============================================
let player; // YouTubeプレーヤーオブジェクト
let transcriptData = []; // トランスクリプトデータを格納
let currentTranscriptIndex = 0; // 現在のトランスクリプトインデックス
let timeUpdateInterval = null; // 時間更新用のインターバル

// ============================================
// YOUTUBEAPI
// ============================================
let tag = document.createElement('script');
tag.src = 'https://www.youtube.com/iframe_api';
let firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

// ============================================
// API準備完了時の処理
// ============================================
function onYouTubeIframeAPIReady() {
  // YouTubeの動画IDを取得
  const videoId = document.getElementById('player').getAttribute('data-id');

  if (!videoId) {
    return;
  }
  // frontmatterElが存在するか確認
  const ytVideo = document.getElementById('player');
  if (!ytVideo) {
    return;
  }

  console.log(`Initializing player for video ID: ${videoId}`); // ログ追加

  try {
    player = new YT.Player('player', {
      height: '360',
      width: '640',
      videoId: videoId,
      events: {
        // 'onReady'イベントハンドラを追加
        onReady: onPlayerReady,
        // 状態変更イベントを追加
        onStateChange: onPlayerStateChange
      },
    });
    console.log('YT.Player object created.'); // ログ追加
  } catch (error) {
    console.error('Error creating YT.Player:', error); // エラーハンドリング
  }
}

// ============================================
// プレーヤー準備完了時の処理
// ============================================
function onPlayerReady(event) {
  console.log('Player is ready.'); // ログ追加: プレーヤー準備完了を確認
  // プレーヤーが準備できてからクリックイベントを設定
  setupChapterClickEvents();
  // トランスクリプトの初期化
  initializeTranscript();
  // アコーディオンの監視を開始
  observeAccordion();
}

// ============================================
// プレーヤー状態変更時の処理
// ============================================
function onPlayerStateChange(event) {
  if (event.data === YT.PlayerState.PLAYING) {
    // 再生開始時にトランスクリプトの更新を開始
    startTranscriptTracking();
  } else {
    // 再生停止時にトランスクリプトの更新を停止
    stopTranscriptTracking();
  }
}

// ============================================
// トランスクリプト関連
// ============================================

// トランスクリプトデータの初期化
function initializeTranscript() {
  // HTMLからトランスクリプトデータを取得
  const transcriptSource = document.getElementById('transcript-source');

  if (!transcriptSource) {
    console.warn('Transcript source element not found');
    return;
  }

  // 複数の形式に対応
  const transcriptItems = transcriptSource.querySelectorAll('.transcript-segment, [data-timestamp]');

  if (transcriptItems.length > 0) {
    // データ属性形式の場合
    transcriptItems.forEach(item => {
      const timestamp = item.getAttribute('data-timestamp');
      const text = item.textContent.trim();

      if (timestamp && text) {
        const seconds = timeToSeconds(timestamp);
        transcriptData.push({ time: timestamp, text, seconds });
      }
    });
  } else {
    // プレーンテキスト形式の場合（後方互換性のため）
    const transcriptText = transcriptSource.textContent;
    const regex = /\((\d{2}:\d{2})\)\s*(.*?)(?=\(\d{2}:\d{2}\)|$)/gs;
    let match;

    while ((match = regex.exec(transcriptText)) !== null) {
      const time = match[1];
      const text = match[2].trim();
      const seconds = timeToSeconds(time);
      transcriptData.push({ time, text, seconds });
    }
  }

  console.log('Transcript data initialized:', transcriptData);
}

// トランスクリプトコンテナの作成
function createTranscriptContainer() {
  // 既存のコンテナがあれば削除
  const existingContainer = document.getElementById('transcript-container');
  if (existingContainer) {
    existingContainer.remove();
  }

  // HTMLを作成
  const html = `
    <div id="transcript-container" style="display: none;">
      <div id="transcript-box">
        <div id="transcript-content"></div>
      </div>
    </div>
  `;

  // アコーディオンの後に挿入
  const accordion = document.querySelector('.transcript-accordion');
  if (accordion) {
    accordion.insertAdjacentHTML('afterend', html);
  }

  // トランスクリプトの内容を生成
  const contentDiv = document.getElementById('transcript-content');
  transcriptData.forEach((item, index) => {
    const p = document.createElement('p');
    p.className = 'transcript-item';
    p.setAttribute('data-index', index);
    p.setAttribute('data-seconds', item.seconds);
    p.innerHTML = `<span class="transcript-time">${item.time}</span> ${item.text}`;

    // クリックで該当箇所にシーク
    p.addEventListener('click', () => {
      if (player && typeof player.seekTo === 'function') {
        player.seekTo(item.seconds, true);
      }
    });

    contentDiv.appendChild(p);
  });
}

// アコーディオンの開閉を監視
function observeAccordion() {
  // アコーディオンのdetails要素を取得
  const detailsElement = document.querySelector('.transcript-accordion');
  if (!detailsElement) {
    console.warn('Accordion element not found');
    return;
  }

  // MutationObserverで開閉を監視
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' && mutation.attributeName === 'open') {
        const isOpen = detailsElement.hasAttribute('open');
        handleAccordionToggle(isOpen);
      }
    });
  });

  // 監視開始
  observer.observe(detailsElement, { attributes: true });

  // 初期状態をチェック
  if (detailsElement.hasAttribute('open')) {
    handleAccordionToggle(true);
  }
}

// アコーディオンの開閉時の処理
function handleAccordionToggle(isOpen) {
  const container = document.getElementById('transcript-container');

  if (isOpen) {
    // コンテナがなければ作成
    if (!container) {
      createTranscriptContainer();
    } else {
      container.style.display = 'block';
    }

    // 現在の再生位置に合わせてスクロール
    if (player && typeof player.getCurrentTime === 'function') {
      const currentTime = player.getCurrentTime();
      scrollToCurrentTime(currentTime);
    }

    // 再生中であればトラッキングを開始
    if (player && player.getPlayerState() === YT.PlayerState.PLAYING) {
      startTranscriptTracking();
    }
  } else {
    // アコーディオンを閉じたときはコンテナを非表示
    if (container) {
      container.style.display = 'none';
    }
    stopTranscriptTracking();
  }
}

// トランスクリプトの追跡を開始
function startTranscriptTracking() {
  // 既存のインターバルがあればクリア
  stopTranscriptTracking();

  // 100ミリ秒ごとに現在時間をチェック
  timeUpdateInterval = setInterval(() => {
    if (player && typeof player.getCurrentTime === 'function') {
      const currentTime = player.getCurrentTime();
      updateTranscriptHighlight(currentTime);
    }
  }, 100);
}

// トランスクリプトの追跡を停止
function stopTranscriptTracking() {
  if (timeUpdateInterval) {
    clearInterval(timeUpdateInterval);
    timeUpdateInterval = null;
  }
}

// トランスクリプトのハイライトを更新
function updateTranscriptHighlight(currentTime) {
  // 現在の時間に対応するトランスクリプトアイテムを探す
  let activeIndex = -1;
  for (let i = transcriptData.length - 1; i >= 0; i--) {
    if (currentTime >= transcriptData[i].seconds) {
      activeIndex = i;
      break;
    }
  }

  // アクティブなアイテムが変わった場合のみ更新
  if (activeIndex !== currentTranscriptIndex && activeIndex !== -1) {
    currentTranscriptIndex = activeIndex;
    highlightTranscriptItem(activeIndex);
    scrollToTranscriptItem(activeIndex);
  }
}

// トランスクリプトアイテムをハイライト
function highlightTranscriptItem(index) {
  // すべてのハイライトを削除
  document.querySelectorAll('.transcript-item').forEach(item => {
    item.classList.remove('active');
  });

  // 指定されたアイテムをハイライト
  const activeItem = document.querySelector(`.transcript-item[data-index="${index}"]`);
  if (activeItem) {
    activeItem.classList.add('active');
  }
}

// トランスクリプトアイテムまでスクロール
function scrollToTranscriptItem(index) {
  const activeItem = document.querySelector(`.transcript-item[data-index="${index}"]`);
  const container = document.getElementById('transcript-box');

  if (activeItem && container) {
    // スムーズスクロール
    const itemTop = activeItem.offsetTop;
    const containerHeight = container.clientHeight;
    const itemHeight = activeItem.clientHeight;

    // アイテムを中央に配置
    const scrollPosition = itemTop - (containerHeight / 2) + (itemHeight / 2);

    container.scrollTo({
      top: scrollPosition,
      behavior: 'smooth'
    });
  }
}

// 指定時間に対応する位置にスクロール
function scrollToCurrentTime(seconds) {
  for (let i = transcriptData.length - 1; i >= 0; i--) {
    if (seconds >= transcriptData[i].seconds) {
      highlightTranscriptItem(i);
      scrollToTranscriptItem(i);
      currentTranscriptIndex = i;
      break;
    }
  }
}

// ============================================
// チャプターリスト関連（既存のコード）
// ============================================

// 時間文字列 (HH:MM:SS or MM:SS) を秒に変換する関数
function timeToSeconds(timeString) {
  const parts = timeString.split(':').map(Number);
  let seconds = 0;
  if (parts.length === 3) {
    // HH:MM:SS
    seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    // MM:SS
    seconds = parts[0] * 60 + parts[1];
  }
  return seconds;
}

// チャプターリストのクリックイベントを設定する関数
function setupChapterClickEvents() {
  console.log('Setting up chapter click events.'); // ログ追加
  const chapterListElement = document.getElementById('chapter-list');
  let text = chapterListElement.innerHTML;

  if (!chapterListElement) {
    console.warn('Element with id "chapter-list" not found.');
    return;
  }

  const lines = text.split('\n').filter((line) => line.trim() !== ''); // テキストを行ごとに分割
  const chapters = [];

  // 正規表現でタイムスタンプとタイトルを抽出
  const regex = /^(\d{1,2}:\d{2}(?::\d{2})?)\s+(.+)$/;

  lines.forEach((line) => {
    const match = line.trim().match(regex);
    if (match) {
      const time = match[1]; // 時間文字列 (例: '1:15')
      const title = match[2]; // タイトル (例: 'トピックA')
      const seconds = timeToSeconds(time); // 秒に変換 (例: 75)
      chapters.push({ time, title, seconds });
    }
  });

  if (chapters.length === 0) {
    chapterListElement.innerHTML =
      '<p>チャプター情報が見つかりませんでした。</p>';
    return;
  }

  // 目次リストのHTMLを生成
  const ul = document.createElement('ul');
  chapters.forEach((chapter) => {
    const li = document.createElement('li');
    li.textContent = `${chapter.time} ${chapter.title}`;
    li.setAttribute('data-seconds', chapter.seconds); // 秒数をdata属性として保持
    li.addEventListener('click', handleChapterClick);
    ul.appendChild(li);
  });
  chapterListElement.innerHTML = ''; // 古い内容をクリア
  chapterListElement.appendChild(ul); // 生成したリストを追加
}

// クリックイベントのハンドラ関数
function handleChapterClick(event) {
  const chapter = event.currentTarget; // クリックされたli要素
  const seconds = chapter.getAttribute('data-seconds');

  if (seconds === null) {
    console.warn(
      'Clicked item is missing data-seconds attribute:',
      chapter.textContent
    );
    return;
  }

  console.log(
    `Chapter clicked: ${chapter.textContent.trim()}, seeking to ${seconds}s`
  ); // ログ追加

  // playerオブジェクトとseekToメソッドの存在を確認
  if (player && typeof player.seekTo === 'function') {
    player.seekTo(seconds, true); // 指定秒数に移動し、再生を開始

    // トランスクリプトも同期
    scrollToCurrentTime(seconds);
  } else {
    console.error(
      'Player is not ready or seekTo function is unavailable when clicking chapter.'
    );
  }
}

// ============================================
// CSS スタイルの追加
// ============================================
const style = document.createElement('style');
style.textContent = `
  #transcript-container {
    margin-top: 20px;
  }

  #transcript-box {
    height: 400px;
    overflow-y: auto;
    border: 1px solid #ddd;
    padding: 20px;
    background-color: #f9f9f9;
    border-radius: 8px;
    position: relative;
  }

  .transcript-item {
    margin-bottom: 15px;
    padding: 10px;
    border-radius: 4px;
    transition: background-color 0.3s ease;
    line-height: 1.6;
    cursor: pointer;
  }

  .transcript-item:hover {
    background-color: #f0f0f0;
  }

  .transcript-item.active {
    background-color: #e3f2fd;
    font-weight: bold;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }

  .transcript-time {
    color: #666;
    font-size: 0.9em;
    margin-right: 10px;
    font-weight: normal;
  }

  .transcript-accordion {
    margin-top: 20px;
  }

  .transcript-accordion summary {
    cursor: pointer;
    padding: 10px;
    background-color: #f0f0f0;
    border-radius: 4px;
    font-weight: bold;
  }

  .transcript-accordion summary:hover {
    background-color: #e0e0e0;
  }

  /* トランスクリプトソースを非表示にする */
  #transcript-source {
    display: none;
  }
`;
document.head.appendChild(style);