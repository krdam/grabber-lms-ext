#!/bin/bash
# Update Extension ID in Native Host manifest

echo "🔧 Nano Page Saver - Update Extension ID"
echo "========================================="
echo ""
echo "📋 Шаг 1: Получите ID расширения"
echo ""
echo "1. Откройте в Chrome: chrome://extensions/"
echo "2. Включите 'Режим разработчика' (Developer mode)"
echo "3. Найдите 'Nano Page Saver'"
echo "4. Скопируйте ID (32 символа под названием)"
echo ""
echo "Пример: abcdefghijklmnopqrstuvwxyz123456"
echo ""
read -p "Введите Extension ID: " EXTENSION_ID

# Validate ID (should be 32 characters)
if [ ${#EXTENSION_ID} -ne 32 ]; then
    echo ""
    echo "❌ Ошибка: ID должен быть 32 символа!"
    echo "Длина введенного: ${#EXTENSION_ID}"
    exit 1
fi

echo ""
echo "✅ ID принят: $EXTENSION_ID"
echo ""
echo "📝 Обновляю manifest..."

# Update manifest
MANIFEST_PATH="$HOME/.local/share/chrome-native-messaging/com.nanopagesaver.videomerger.json"

cat > "$MANIFEST_PATH" <<EOF
{
  "name": "com.nanopagesaver.videomerger",
  "description": "Video Merger Native Host for Nano Page Saver",
  "path": "$HOME/.local/share/chrome-native-messaging/video_merger_host.py",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://$EXTENSION_ID/"
  ]
}
EOF

echo "✅ Manifest обновлён!"
echo ""
echo "📄 Содержимое manifest:"
cat "$MANIFEST_PATH"
echo ""
echo "========================================="
echo "🔄 Шаг 2: Перезапустите Chrome"
echo "========================================="
echo ""
echo "Закройте ВСЕ окна Chrome и откройте снова"
echo ""
echo "Или выполните:"
echo "  killall chrome"
echo "  google-chrome &"
echo ""
echo "========================================="
echo "🧪 Шаг 3: Тестируйте"
echo "========================================="
echo ""
echo "1. Откройте страницу с HLS видео"
echo "2. Нажмите на иконку расширения"
echo "3. Правый клик на popup → Inspect → Console"
echo "4. Нажмите 'Download HLS'"
echo ""
echo "Если увидите:"
echo "  ✓ Native Host available!"
echo "  ✅ Successfully merged!"
echo ""
echo "Значит всё работает! 🎉"
echo ""
echo "✅ Настройка завершена!"

