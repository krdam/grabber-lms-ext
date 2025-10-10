# Модули Nano Page Saver

## 📦 Созданные модули

### ✅ utils.js (52 строки)
**Назначение:** Утилитарные функции для работы с файлами, форматированием и UI

**Exports:**
- `sanitizeFilename(filename)` - Очистка имени файла от недопустимых символов
- `showStatus(message, type, statusDiv)` - Показ статусных сообщений
- `showProgress(label, percent, ...)` - Управление прогресс-баром
- `hideProgress(...)` - Скрытие прогресс-бара
- `formatSize(bytes)` - Форматирование размера файла (MB, GB)
- `formatSpeed(bytesPerSec)` - Форматирование скорости загрузки

**Использование:**
```javascript
import { sanitizeFilename, formatSize } from './modules/utils.js';

const filename = sanitizeFilename("My Video: Cool!");  // "My_Video__Cool_"
const size = formatSize(1048576);  // "1.00 MB"
```

### ✅ hls-downloader.js (353 строки)
**Назначение:** Парсинг HLS манифестов и загрузка видео сегментов

**Exports:**
- `class HLSDownloader`
  - `parseM3U8(url)` - Парсинг .m3u8 файлов
  - `parseVariants(manifestText, baseUrl)` - Извлечение вариантов качества
  - `downloadSegmentedVideo(manifestUrl, filename, videoInfo, onProgress)` - Полный цикл загрузки

**Возможности:**
- ✅ Парсинг master и variant плейлистов
- ✅ Обнаружение отдельных аудио дорожек  
- ✅ Выбор наивысшего качества
- ✅ Загрузка видео и аудио сегментов
- ✅ Прогресс-коллбэки для каждого сегмента
- ✅ Автоматическое слияние в Blob

**Использование:**
```javascript
import { HLSDownloader } from './modules/hls-downloader.js';

const downloader = new HLSDownloader();

await downloader.downloadSegmentedVideo(
  'https://example.com/video.m3u8',
  'my-video.mp4',
  { quality: '1080p' },
  (progress) => {
    console.log(`${progress.stage}: ${progress.progress}%`);
    // stage: 'parsing' | 'selecting' | 'downloading' | 'merging' | 'saving' | 'completed'
  }
);
```

## 🔄 Модули для создания

### download-manager.js (~360 строк)
**Что извлечь:**
- `class DownloadManager` из popup.js (строки 35-389)
- Управление задачами загрузки
- Прогресс-бары для каждой задачи
- UI обновления

**План:**
```javascript
export class DownloadManager {
  constructor() { }
  setupMessageListener() { }
  startDirectDownload(url, filename, videoInfo) { }
  startSegmentedDownload(url, filename, videoInfo) { }
  updateTaskUI(task) { }
  // ...
}
```

### video-detector.js (~300 строк)
**Что извлечь:**
- `detectVideos()` - функция поиска видео (строки ~2050-2150)
- `displayVideos(videos, tabId)` - отображение списка видео (строки ~2230-2430)
- Логика обнаружения HTML5, YouTube, Vimeo

### video-recorder.js (~150 строк)
**Что извлечь:**
- `recordAndDownloadVideo(videoIndex)` - запись через MediaRecorder (строки ~2760-2860)
- Логика захвата видео потока

### pdf-processor.js (~800 строк)
**Что извлечь:**
- `saveAsPdf()` - главная функция
- `extractPageContentForPdfWrapper(options)`
- `generateSimplePdfHtml(pageData, options)`
- Функции извлечения скрытого контента

### html-processor.js (~400 строк)
**Что извлечь:**
- `saveAsHtml()`
- `extractPageContent(options)`
- `minifyHtml(html)`

## 🚀 Как завершить модуляризацию

### Шаг 1: Создать remaining модули

Создайте файлы в `modules/` и перенесите соответствующий код из `popup.js`:

```bash
cd /home/dima/projects/grabber-ext/modules
touch download-manager.js video-detector.js video-recorder.js pdf-processor.js html-processor.js
```

### Шаг 2: Обновить popup.js

Замените код на импорты:

```javascript
// popup.js
import { sanitizeFilename, showStatus, formatSize } from './modules/utils.js';
import { HLSDownloader } from './modules/hls-downloader.js';
import { DownloadManager } from './modules/download-manager.js';
import { detectVideos, displayVideos, downloadVideo } from './modules/video-detector.js';
import { recordAndDownloadVideo } from './modules/video-recorder.js';
import { saveAsPdf } from './modules/pdf-processor.js';
import { saveAsHtml } from './modules/html-processor.js';

// DOM elements
const pageTitle = document.getElementById('pageTitle');
// ...

// Initialize
const downloadManager = new DownloadManager();
const hlsDownloader = new HLSDownloader();

// Event listeners and initialization code
// ...
```

### Шаг 3: Обновить popup.html

```html
<!-- Изменить: -->
<script src="popup.js"></script>

<!-- На: -->
<script type="module" src="popup.js"></script>
```

### Шаг 4: Тестирование

1. Перезагрузить расширение в `chrome://extensions/`
2. Проверить все функции:
   - Сохранение HTML/PDF
   - Обнаружение видео
   - Прямая загрузка MP4
   - Загрузка HLS
   - Запись видео
3. Проверить консоль на ошибки

## 📝 Важные замечания

### Передача зависимостей

Некоторым модулям нужны DOM элементы или глобальные объекты:

```javascript
// ❌ Плохо: модуль зависит от глобальных переменных
export function showStatus(message) {
  statusDiv.textContent = message;  // statusDiv откуда?
}

// ✅ Хорошо: явная передача зависимостей
export function showStatus(message, type, statusDiv) {
  statusDiv.textContent = message;
}
```

### Chrome API в модулях

Chrome APIs работают в модулях:

```javascript
// modules/video-detector.js
export async function detectVideos() {
  const results = await chrome.scripting.executeScript({...});
  return results;
}
```

### Взаимосвязи модулей

```
popup.js (главный)
  ├─→ utils.js (используется всеми)
  ├─→ download-manager.js
  │    └─→ hls-downloader.js
  │    └─→ utils.js
  ├─→ video-detector.js
  │    └─→ video-recorder.js
  │    └─→ utils.js
  ├─→ pdf-processor.js
  │    └─→ utils.js
  └─→ html-processor.js
       └─→ utils.js
```

## 🎯 Преимущества после модуляризации

✅ **Читаемость**: Файлы по 50-400 строк вместо 2861  
✅ **Поддержка**: Легко найти нужную функцию  
✅ **Тестирование**: Модули независимы  
✅ **Производительность**: Браузер кэширует модули  
✅ **Переиспользование**: Модули можно использовать в других проектах  

## 🔗 Дополнительные ресурсы

- [ES6 Modules в Chrome Extensions](https://developer.chrome.com/docs/extensions/mv3/migrating_to_service_workers/#using-es-modules)
- [JavaScript Modules (MDN)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
- [Best Practices для модулей](https://developer.chrome.com/docs/extensions/mv3/intro/mv3-overview/)

