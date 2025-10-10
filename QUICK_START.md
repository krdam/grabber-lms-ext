# ⚡ Быстрый старт - 3 минуты!

## ✅ Что уже готово:

- ✅ **FFmpeg установлен** (ffmpeg version 6.1.1)
- ✅ **Native Host создан** (`~/.local/share/chrome-native-messaging/`)
- ✅ **Зарегистрирован в Chrome**
- ✅ **Расширение обновлено** до версии 3.0.0

---

## 🚀 Осталось 3 шага:

### Шаг 1: Узнайте ID расширения (30 сек)

1. Откройте: `chrome://extensions/`
2. Найдите **"Nano Page Saver"**
3. **Скопируйте ID** (длинная строка под названием)
   
   Например: `abcdefghijklmnopqrstuvwxyz123456`

---

### Шаг 2: Обновите manifest (1 мин)

**Откройте файл:**
```bash
nano ~/.local/share/chrome-native-messaging/com.nanopagesaver.videomerger.json
```

**Замените `EXTENSION_ID_WILL_BE_ADDED` на ваш ID:**
```json
{
  "name": "com.nanopagesaver.videomerger",
  "description": "Video Merger Native Host for Nano Page Saver",
  "path": "/home/dima/.local/share/chrome-native-messaging/video_merger_host.py",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://ВАШ_ID_СЮДА/"
  ]
}
```

**Сохраните:** `Ctrl+O`, `Enter`, `Ctrl+X`

---

### Шаг 3: Перезапустите Chrome (30 сек)

**Закройте Chrome ПОЛНОСТЬЮ:**
```bash
killall chrome
google-chrome &
```

Или просто закройте все окна Chrome и откройте заново.

---

## 🎬 Тестируем!

1. **Откройте страницу с видео** (например, Vimeo)
2. **Нажмите на иконку расширения**
3. **Нажмите "Download HLS"**
4. **Откройте консоль popup** (правый клик → Inspect → Console)

### ✅ Если всё работает, увидите:

```
Attempting automatic merge with Native Host + FFmpeg...
✓ Native Host available! Using FFmpeg for fast merge...
Merging with FFmpeg (fast!)...
✅ Successfully merged with Native Host!
Output: /home/dima/Downloads/video_1.mp4
```

**И файл со звуком появится в Downloads!** 🎉

---

## 🆘 Если не работает:

Смотрите подробную инструкцию: `NATIVE_HOST_SETUP.md`

Или пришлите логи из консоли popup - я помогу!

---

## ⚡ Что вы получили:

| Метод | Время | Качество | Звук |
|-------|-------|----------|------|
| **Native Host + FFmpeg** | **~35 сек** ⚡ | ✅ | ✅ |
| Запись (MediaRecorder) | 233 сек 🐌 | ✅ | ✅ |
| Онлайн (Clideo) | 150 сек ⏱️ | ✅ | ✅ |
| 2 файла вручную | ∞ 😢 | ✅ | ❌ |

**Как у Video DownloadHelper, но ВАШЕ!** 🚀

