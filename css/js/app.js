// Traffic Patrol Online - Основной файл

class TrafficGame {
    constructor() {
        this.markers = [];
        this.selectedTool = 'police';
        this.userPoints = 100;
        this.onlineCount = 1;
        this.userName = 'Игрок';
        this.isTelegram = false;
        
        this.init();
    }
    
    init() {
        // Проверяем Telegram
        if (window.Telegram && window.Telegram.WebApp) {
            this.isTelegram = true;
            this.initTelegram();
        } else {
            // Режим браузера для тестирования
            this.showNotification('Режим тестирования. В Telegram будет больше функций!');
        }
        
        this.setupEventListeners();
        this.loadMarkers();
        this.updateUI();
    }
    
    initTelegram() {
        const tg = window.Telegram.WebApp;
        
        // Настройка Telegram Web App
        tg.expand();
        tg.enableClosingConfirmation();
        tg.BackButton.show();
        tg.BackButton.onClick(() => tg.close());
        
        // Получаем данные пользователя
        if (tg.initDataUnsafe.user) {
            const user = tg.initDataUnsafe.user;
            this.userName = user.first_name || 'Игрок';
            this.userId = user.id;
            
            // Обновляем приветствие
            document.getElementById('userName').textContent = this.userName;
        }
        
        // Подписываемся на события
        tg.onEvent('themeChanged', this.updateTheme.bind(this));
        tg.onEvent('viewportChanged', this.onViewportChanged.bind(this));
        
        console.log('Telegram Web App инициализирован');
    }
    
    setupEventListeners() {
        // Кнопки инструментов
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tool = e.currentTarget.dataset.tool;
                this.selectTool(tool);
            });
        });
        
        // Клик по карте
        const map = document.getElementById('map');
        map.addEventListener('click', (e) => {
            const rect = map.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 100;
            const y = ((e.clientY - rect.top) / rect.height) * 100;
            
            this.handleMapClick(x, y);
        });
        
        // Долгое нажатие для ДТП
        let pressTimer;
        map.addEventListener('mousedown', (e) => {
            pressTimer = setTimeout(() => {
                const rect = map.getBoundingClientRect();
                const x = ((e.clientX - rect.left) / rect.width) * 100;
                const y = ((e.clientY - rect.top) / rect.height) * 100;
                
                if (this.selectedTool === 'accident') {
                    this.addMarker(x, y, 'accident');
                }
            }, 1000);
        });
        
        map.addEventListener('mouseup', () => clearTimeout(pressTimer));
        map.addEventListener('mouseleave', () => clearTimeout(pressTimer));
    }
    
    selectTool(tool) {
        this.selectedTool = tool;
        
        // Обновляем активную кнопку
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.tool === tool) {
                btn.classList.add('active');
            }
        });
        
        this.showTooltip(`Выбран: ${this.getToolName(tool)}`);
    }
    
    getToolName(tool) {
        const names = {
            police: 'Патруль 🚓',
            accident: 'ДТП 💥',
            hazard: 'Опасность ⚠️',
            clear: 'Очистка 🗑️'
        };
        return names[tool] || tool;
    }
    
    handleMapClick(x, y) {
        if (this.selectedTool === 'clear') {
            this.removeMarkerAt(x, y);
        } else {
            this.addMarker(x, y, this.selectedTool);
        }
    }
    
    addMarker(x, y, type) {
        // Проверяем очки
        if (this.userPoints < 10) {
            this.showNotification('Недостаточно очков! Нужно минимум 10');
            return;
        }
        
        // Создаем маркер
        const marker = {
            id: Date.now() + Math.random(),
            x: x,
            y: y,
            type: type,
            user: this.userName,
            userId: this.userId || 0,
            timestamp: Date.now()
        };
        
        // Добавляем в массив
        this.markers.push(marker);
        
        // Обновляем очки
        this.userPoints -= 10;
        
        // Обновляем интерфейс
        this.updateUI();
        this.renderMarkers();
        
        // Показываем уведомление
        this.showNotification(`${this.getToolName(type)} добавлен! -10 очков`);
        
        // В будущем: отправка на сервер
        this.saveToLocalStorage();
        
        console.log('Маркер добавлен:', marker);
    }
    
    removeMarkerAt(x, y) {
        const threshold = 5; // 5% расстояние
        
        for (let i = this.markers.length - 1; i >= 0; i--) {
            const marker = this.markers[i];
            const distance = Math.sqrt(
                Math.pow(marker.x - x, 2) + Math.pow(marker.y - y, 2)
            );
            
            if (distance < threshold) {
                // Удаляем маркер
                this.markers.splice(i, 1);
                
                // Начисляем очки за очистку
                this.userPoints += 5;
                
                // Обновляем интерфейс
                this.updateUI();
                this.renderMarkers();
                
                this.showNotification('Метка удалена! +5 очков');
                this.saveToLocalStorage();
                break;
            }
        }
    }
    
    renderMarkers() {
        const container = document.getElementById('markersContainer');
        if (!container) return;
        
        container.innerHTML = '';
        
        this.markers.forEach(marker => {
            const markerEl = document.createElement('div');
            markerEl.className = `marker ${marker.type}`;
            markerEl.style.left = `${marker.x}%`;
            markerEl.style.top = `${marker.y}%`;
            markerEl.title = `${marker.user}: ${this.getToolName(marker.type)}`;
            
            // Иконка в зависимости от типа
            let icon = '';
            switch(marker.type) {
                case 'police': icon = '🚓'; break;
                case 'accident': icon = '💥'; break;
                case 'hazard': icon = '⚠️'; break;
            }
            
            markerEl.innerHTML = icon;
            
            // Добавляем обработчик для удаления по двойному клику
            markerEl.addEventListener('dblclick', () => {
                if (confirm('Удалить эту метку?')) {
                    this.markers = this.markers.filter(m => m.id !== marker.id);
                    this.userPoints += 3;
                    this.updateUI();
                    this.renderMarkers();
                    this.saveToLocalStorage();
                }
            });
            
            container.appendChild(markerEl);
        });
    }
    
    updateUI() {
        // Обновляем счетчики
        document.getElementById('markerCount').textContent = this.markers.length;
        document.getElementById('onlineCount').textContent = this.onlineCount;
        document.getElementById('points').textContent = this.userPoints;
        document.getElementById('userName').textContent = this.userName;
        
        // Обновляем ранг
        const rank = this.calculateRank();
        document.getElementById('userRank').textContent = rank;
        
        // Обновляем прогресс-бар очков
        const progress = Math.min(this.userPoints / 100, 1);
        document.getElementById('pointsProgress').style.width = `${progress * 100}%`;
    }
    
    calculateRank() {
        if (this.userPoints >= 1000) return 'Комиссар 👮‍♂️';
        if (this.userPoints >= 500) return 'Сержант 👮';
        if (this.userPoints >= 200) return 'Офицер 🚔';
        if (this.userPoints >= 100) return 'Патрульный 🚓';
        return 'Новичок 🚦';
    }
    
    loadMarkers() {
        // Загружаем из localStorage (временно)
        const saved = localStorage.getItem('traffic_markers');
        if (saved) {
            try {
                this.markers = JSON.parse(saved);
                this.renderMarkers();
            } catch (e) {
                console.error('Ошибка загрузки маркеров:', e);
            }
        }
        
        // Загружаем очки
        const savedPoints = localStorage.getItem('traffic_points');
        if (savedPoints) {
            this.userPoints = parseInt(savedPoints) || 100;
        }
    }
    
    saveToLocalStorage() {
        // Сохраняем в localStorage (временно)
        localStorage.setItem('traffic_markers', JSON.stringify(this.markers));
        localStorage.setItem('traffic_points', this.userPoints.toString());
    }
    
    showNotification(message) {
        // Создаем временное уведомление
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4caf50;
            color: white;
            padding: 15px;
            border-radius: 10px;
            z-index: 1000;
            animation: slideIn 0.3s ease-out;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }
    
    showTooltip(text) {
        const tooltip = document.createElement('div');
        tooltip.textContent = text;
        tooltip.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 15px 25px;
            border-radius: 10px;
            z-index: 1000;
            border: 2px solid #00bcd4;
            font-size: 1.1rem;
            text-align: center;
        `;
        
        document.body.appendChild(tooltip);
        
        setTimeout(() => {
            document.body.removeChild(tooltip);
        }, 1500);
    }
    
    updateTheme() {
        if (!this.isTelegram) return;
        
        const tg = window.Telegram.WebApp;
        const isDark = tg.colorScheme === 'dark';
        
        document.body.style.backgroundColor = isDark ? '#1a1a1a' : '#ffffff';
        document.body.style.color = isDark ? '#ffffff' : '#000000';
    }
    
    onViewportChanged() {
        console.log('Viewport changed');
        this.renderMarkers();
    }
}

// Запуск игры при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    window.game = new TrafficGame();
    
    // Добавляем анимацию для прогресс-бара
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
        
        .points-progress {
            width: 100%;
            height: 5px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 3px;
            overflow: hidden;
            margin-top: 5px;
        }
        
        .points-progress-bar {
            height: 100%;
            background: linear-gradient(90deg, #4caf50, #00bcd4);
            width: 100%;
            transition: width 0.3s ease;
        }
    `;
    document.head.appendChild(style);
});
