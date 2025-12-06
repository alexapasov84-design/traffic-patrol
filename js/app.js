// Основной файл приложения - теперь использует Яндекс.Карты

document.addEventListener('DOMContentLoaded', () => {
    console.log('Traffic Patrol Online запущен!');
    
    // Проверяем API ключ
    checkApiKey();
    
    // Инициализация Telegram
    initTelegram();
    
    // Настройка событий
    setupGlobalEvents();
});

function initTelegram() {
    if (window.Telegram && window.Telegram.WebApp) {
        const tg = window.Telegram.WebApp;
        
        // Настройка Web App
        tg.expand();
        tg.ready();
        
        // Обновляем тему Telegram
        updateTelegramTheme(tg);
        
        // Событие изменения темы
        tg.onEvent('themeChanged', () => updateTelegramTheme(tg));
        
        console.log('Telegram Web App инициализирован');
    }
}

function updateTelegramTheme(tg) {
    const isDark = tg.colorScheme === 'dark';
    document.body.setAttribute('data-theme', isDark ? 'dark' : 'light');
}

function setupGlobalEvents() {
    // Добавляем стиль для нотификаций
    const style = document.createElement('style');
    style.textContent = `
        .notification {
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4caf50;
            color: white;
            padding: 15px 25px;
            border-radius: 10px;
            z-index: 10000;
            animation: slideIn 0.3s ease-out;
            box-shadow: 0 5px 15px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            gap: 10px;
            max-width: 300px;
            transition: all 0.3s;
        }
        
        .notification.error {
            background: #f44336;
        }
        
        .notification.warning {
            background: #ff9800;
        }
        
        @keyframes slideIn {
            from {
                opacity: 0;
                transform: translateY(-20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        /* Стили для темной темы Telegram */
        [data-theme="dark"] {
            --text-color: #ffffff;
            --bg-color: #1a1a1a;
        }
        
        [data-theme="light"] {
            --text-color: #000000;
            --bg-color: #ffffff;
        }
    `;
    document.head.appendChild(style);
}

function checkApiKey() {
    // Проверяем, что API ключ установлен
    const scripts = document.querySelectorAll('script');
    let hasApiKey = false;
    
    scripts.forEach(script => {
        if (script.src.includes('api-maps.yandex.ru')) {
            if (script.src.includes('365e247d-d853-4425-b9cc-13bfa1169a49')) {
                hasApiKey = true;
                console.log('✅ API ключ Яндекс.Карт найден');
            }
        }
    });
    
    if (!hasApiKey) {
        console.error('❌ API ключ Яндекс.Карт не найден!');
        showErrorNotification('Ошибка: API ключ Яндекс.Карт не настроен');
    }
}

function showErrorNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification error';
    notification.innerHTML = `
        <i class="fas fa-exclamation-circle"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

// Глобальные вспомогательные функции
window.showNotification = function(message, type = 'success') {
    if (window.mapManager && window.mapManager.showNotification) {
        window.mapManager.showNotification(message, type);
    }
};

// Проверяем загрузку Яндекс.Карт
setTimeout(() => {
    if (!window.ymaps) {
        console.warn('⚠️ Яндекс.Карты еще не загрузились');
    } else {
        console.log('✅ Яндекс.Карты API загружен');
    }
}, 2000);
