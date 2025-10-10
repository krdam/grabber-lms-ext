# 🚀 Nano Page Saver - Native Host Setup

## ✅ Что уже готово:

- ✅ Native Host скрипт установлен: `~/.local/share/chrome-native-messaging/video_merger_host.py`
- ✅ Manifest создан: `~/.local/share/chrome-native-messaging/com.nanopagesaver.videomerger.json`
- ✅ Зарегистрирован в Chrome: `~/.config/google-chrome/NativeMessagingHosts/`
- ✅ Расширение обновлено до версии 3.0.0

---

## 📦 Что нужно установить:

### 1. FFmpeg (обязательно!)

FFmpeg - это программа для обработки видео, которая умеет быстро объединять видео и аудио.

**Установка на Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install ffmpeg
```

**Проверка установки:**
```bash
ffmpeg -version
```

Должно показать версию FFmpeg (например, `ffmpeg version 4.4.2`).

---

### 2. Добавить ID расширения в manifest

После установки расширения в Chrome нужно узнать его ID и добавить в Native Host manifest.

**Шаг 1: Узнайте ID расширения**
1. Откройте `chrome://extensions/`
2. Найдите "Nano Page Saver"
3. Скопируйте ID (например: `abcdefghijklmnopqrstuvwxyz123456`)

**Шаг 2: Обновите manifest**
```bash
nano ~/.local/share/chrome-native-messaging/com.nanopagesaver.videomerger.json
```

Замените `EXTENSION_ID_WILL_BE_ADDED` на ваш ID:
```json
{
  "name": "com.nanopagesaver.videomerger",
  "description": "Video Merger Native Host for Nano Page Saver",
  "path": "/home/dima/.local/share/chrome-native-messaging/video_merger_host.py",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://ВАШ_ID_ТУТ/"
  ]
}
```

**Шаг 3: Перезагрузите Chrome**
```bash
# Закройте Chrome полностью и откройте снова
```

---

## 🧪 Тестирование

### 1. Перезагрузите расширение
```
chrome://extensions/ → "Nano Page Saver" → кнопка ↻
```

### 2. Откройте страницу с HLS видео
Например, Vimeo с видео

### 3. Откройте консоль popup
Правый клик на popup → "Inspect" → вкладка "Console"

### 4. Нажмите "Download HLS"

### 5. Проверьте логи в консоли

**✅ Если Native Host работает:**
```
Attempting automatic merge with Native Host + FFmpeg...
✓ Native Host available! Using FFmpeg for fast merge...
Merging with FFmpeg (fast!)...
✅ Successfully merged with Native Host!
Output: /home/dima/Downloads/video_1.mp4
```

**❌ Если Native Host не работает:**
```
Native Host not available, falling back to 2 files...
Downloading as 2 separate files
```

---

## 🔧 Решение проблем

### Проблема: "Native Host not available"

**Решение 1: Проверьте FFmpeg**
```bash
which ffmpeg
# Должно показать: /usr/bin/ffmpeg
```

Если не показывает - FFmpeg не установлен. Установите:
```bash
sudo apt install ffmpeg
```

**Решение 2: Проверьте права на скрипт**
```bash
ls -la ~/.local/share/chrome-native-messaging/video_merger_host.py
# Должно быть: -rwxrwxr-x (исполняемый)
```

Если нет флага `x`:
```bash
chmod +x ~/.local/share/chrome-native-messaging/video_merger_host.py
```

**Решение 3: Проверьте manifest**
```bash
cat ~/.local/share/chrome-native-messaging/com.nanopagesaver.videomerger.json
```

Убедитесь, что:
- `path` указывает на правильный файл
- `allowed_origins` содержит правильный ID расширения

**Решение 4: Проверьте симлинк**
```bash
ls -la ~/.config/google-chrome/NativeMessagingHosts/com.nanopagesaver.videomerger.json
```

Должен быть симлинк, указывающий на manifest. Если нет:
```bash
ln -sf ~/.local/share/chrome-native-messaging/com.nanopagesaver.videomerger.json \
       ~/.config/google-chrome/NativeMessagingHosts/com.nanopagesaver.videomerger.json
```

**Решение 5: Проверьте Chrome (не Chromium)**
Native Messaging Host работает только в **Google Chrome**, не в Chromium!

Если у вас Chromium, создайте симлинк для него:
```bash
mkdir -p ~/.config/chromium/NativeMessagingHosts/
ln -sf ~/.local/share/chrome-native-messaging/com.nanopagesaver.videomerger.json \
       ~/.config/chromium/NativeMessagingHosts/com.nanopagesaver.videomerger.json
```

**Решение 6: Перезапустите Chrome ПОЛНОСТЬЮ**
```bash
# Закройте ВСЕ окна Chrome
# Убедитесь, что Chrome не работает в фоне
ps aux | grep chrome

# Если есть процессы - убейте их
killall chrome

# Запустите Chrome заново
google-chrome &
```

---

## 📊 Как это работает:

```
┌─────────────────┐
│ Chrome Extension│ (скачивает сегменты за ~30 сек)
└────────┬────────┘
         │ video.mp4 (97 MB)
         │ audio.m4a (6 MB)
         ↓
┌─────────────────┐
│  Native Host    │ (Python скрипт)
└────────┬────────┘
         │ Отправляет данные в FFmpeg
         ↓
┌─────────────────┐
│     FFmpeg      │ (объединяет за ~5 сек)
└────────┬────────┘
         │
         ↓
   video_1.mp4 (103 MB, со звуком!)
   в папке Downloads
```

**Итого: ~35 секунд!** (30 сек скачивание + 5 сек объединение)

Вместо 233 секунд записи или 2 минут онлайн-сервиса! ⚡

---

## 🎯 Преимущества Native Host:

- ✅ **Очень быстро** (FFmpeg работает напрямую на вашем ПК)
- ✅ **Без потери качества** (копирование без перекодирования)
- ✅ **Оффлайн** (не нужен интернет для объединения)
- ✅ **Автоматически** (не нужно ничего делать вручную)
- ✅ **Как у Video DownloadHelper** (у них точно так же!)

---

## 📝 Примечания:

1. **Безопасность:** Native Host работает только с вашим расширением (ID прописан в manifest)
2. **Приватность:** Всё работает локально, данные не уходят в интернет
3. **Fallback:** Если Native Host не работает, расширение автоматически скачает 2 файла отдельно
4. **Совместимость:** Работает на Linux, Mac, Windows (пути будут другие)

---

## 🆘 Нужна помощь?

Откройте консоль popup (Inspect → Console) и скопируйте все логи. Они покажут, что именно не работает!

