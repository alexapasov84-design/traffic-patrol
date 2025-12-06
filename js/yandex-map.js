// Яндекс.Карты интеграция для Traffic Patrol

class YandexMapManager {
    constructor() {
        this.map = null;
        this.markers = [];
        this.selectedTool = 'police';
        this.draggingMarker = null;
        this.userPoints = 100;
        this.userActivity = 0;
        
        // Центр карты (ваши координаты)
        this.defaultCenter = [55.459619, 38.438920];
        this.defaultZoom = 15;
        
        this.init();
    }
    
    async init() {
        // Ждем загрузку API Яндекс.Карт
        await this.waitForYMaps();
        
        // Инициализируем карту
        this.initMap();
        
        // Загружаем сохраненные метки
        this.loadMarkers();
        
        // Настраиваем события
        this.setupEvents();
        
        // Инициализируем Telegram
        this.initTelegram();
        
        console.log('Yandex Map Manager инициализирован');
    }
    
    waitForYMaps() {
        return new Promise((resolve) => {
            if (window.ymaps) {
                ymaps.ready(resolve);
            } else {
                const check = setInterval(() => {
                    if (window.ymaps) {
                        clearInterval(check);
                        ymaps.ready(resolve);
                    }
                }, 100);
            }
        });
    }
    
    initMap() {
        // Создаем карту
        this.map = new ymaps.Map('map', {
            center: this.defaultCenter,
            zoom: this.defaultZoom,
            controls: ['zoomControl', 'fullscreenControl']
        });
        
        // Стилизуем карту
        this.map.controls.get('zoomControl').options.set({
            size: 'small',
            position: {
                right: 10,
                top: 100
            }
        });
        
        this.map.controls.get('fullscreenControl').options.set({
            position: {
                right: 10,
                top: 150
            }
        });
        
        // Добавляем слой пробок
        this.map.geoObjects.add(new ymaps.layer.TrafficLayer({ zIndex: 100 }));
        
        // Добавляем поиск
        const searchControl = new ymaps.control.SearchControl({
            options: {
                noPlacemark: true,
                position: { left: 10, top: 10 }
            }
        });
        this.map.controls.add(searchControl);
        
        // Устанавливаем начальный тип карты (гибрид)
        this.map.setType('yandex#hybrid');
    }
    
    initTelegram() {
        if (window.Telegram && window.Telegram.WebApp) {
            const tg = window.Telegram.WebApp;
            
            // Разворачиваем на весь экран
            tg.expand();
            tg.enableClosingConfirmation();
            
            // Получаем данные пользователя
            if (tg.initDataUnsafe.user) {
                const user = tg.initDataUnsafe.user;
                document.getElementById('userName').textContent = user.first_name || 'Игрок';
                
                // Пытаемся получить геолокацию пользователя
                this.tryGetUserLocation();
            }
            
            // Настройка кнопки назад
            tg.BackButton.show();
            tg.BackButton.onClick(() => tg.close());
            
            console.log('Telegram Web App подключен');
        }
    }
    
    async tryGetUserLocation() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const userCoords = [position.coords.latitude, position.coords.longitude];
                    this.addUserMarker(userCoords);
                },
                (error) => {
                    console.log('Геолокация недоступна:', error);
                },
                { enableHighAccuracy: true, timeout: 5000 }
            );
        }
    }
    
    addUserMarker(coords) {
        const userMarker = new ymaps.Placemark(
            coords,
            {
                hintContent: 'Ваше местоположение',
                balloonContent: 'Вы здесь!'
            },
            {
                preset: 'islands#blueCircleDotIcon',
                draggable: false
            }
        );
        
        this.map.geoObjects.add(userMarker);
        
        // Центрируем карту на пользователе
        this.map.setCenter(coords, 16);
    }
    
    setupEvents() {
        // Обработчик клика по карте
        this.map.events.add('click', (e) => {
            const coords = e.get('coords');
            
            if (this.selectedTool === 'clear') {
                this.removeMarkerAt(coords);
            } else {
                this.addMarkerToMap(coords, this.selectedTool);
            }
        });
        
        // Обработчик долгого нажатия для ДТП
        let pressTimer;
        this.map.events.add('mousedown', () => {
            pressTimer = setTimeout(() => {
                if (this.selectedTool === 'accident') {
                    this.map.events.add('mouseup', (e) => {
                        const coords = e.get('coords');
                        this.addMarkerToMap(coords, 'accident');
                    }, { once: true });
                }
            }, 1000);
        });
        
        this.map.events.add('mouseup', () => {
            clearTimeout(pressTimer);
        });
        
        // Добавляем событие для перетаскивания
        this.map.events.add('click', (e) => {
            // Проверяем, была ли нажата метка
            const target = e.get('target');
            if (target && target.properties) {
                const type = target.properties.get('type');
                if (type && this.selectedTool !== 'clear') {
                    // Если метка уже есть и выбран не режим очистки, разрешаем перетаскивание
                    target.options.set('draggable', true);
                }
            }
        });
    }
    
    addMarkerToMap(coords, type) {
        // Проверяем очки
        const cost = this.getMarkerCost(type);
        if (this.userPoints < cost && type !== 'clear') {
            this.showNotification(`Недостаточно очков! Нужно ${cost}`, 'error');
            return;
        }
        
        // Создаем метку
        const markerId = 'marker_' + Date.now();
        const userName = document.getElementById('userName').textContent;
        
        // Настройки в зависимости от типа
        let preset, iconColor, iconGlyph;
        switch(type) {
            case 'police':
                preset = 'islands#blueStretchyIcon';
                iconColor = '#2196F3';
                iconGlyph = 'car';
                break;
            case 'accident':
                preset = 'islands#redStretchyIcon';
                iconColor = '#F44336';
                iconGlyph = 'attention';
                break;
            case 'hazard':
                preset = 'islands#orangeStretchyIcon';
                iconColor = '#FF9800';
                iconGlyph = 'triangle';
                break;
        }
        
        const marker = new ymaps.Placemark(
            coords,
            {
                hintContent: `${userName}: ${this.getTypeName(type)}`,
                balloonContent: `
                    <div style="color: black; font-family: Arial; padding: 10px;">
                        <strong style="color: #2196F3;">${this.getTypeName(type)}</strong><br>
                        <small>Добавил: ${userName}</small><br>
                        <small>Время: ${new Date().toLocaleTimeString()}</small><br>
                        <small>Координаты: ${coords[0].toFixed(6)}, ${coords[1].toFixed(6)}</small><br>
                        <button onclick="window.mapManager.removeMarkerById('${markerId}')" 
                                style="background: #f44336; color: white; border: none; padding: 8px 15px; border-radius: 5px; margin-top: 8px; cursor: pointer; font-size: 14px;">
                            🗑️ Удалить эту метку
                        </button>
                    </div>
                `,
                markerId: markerId,
                type: type,
                user: userName,
                coords: coords
            },
            {
                preset: preset,
                iconColor: iconColor,
                draggable: true, // Разрешаем перетаскивание
                hasBalloon: true,
                hasHint: true
            }
        );
        
        // События для перетаскивания
        marker.events.add('dragstart', (e) => {
            this.draggingMarker = markerId;
            console.log('Начали перетаскивать метку:', markerId);
        });
        
        marker.events.add('dragend', (e) => {
            this.draggingMarker = null;
            const newCoords = marker.geometry.getCoordinates();
            
            // Обновляем координаты в массиве
            const markerIndex = this.markers.findIndex(m => m.id === markerId);
            if (markerIndex !== -1) {
                this.markers[markerIndex].coords = newCoords;
                this.markers[markerIndex].moved = true;
                this.markers[markerIndex].moveTime = Date.now();
            }
            
            this.saveMarkers();
            this.showNotification('Метка перемещена!');
        });
        
        // Добавляем на карту
        this.map.geoObjects.add(marker);
        
        // Сохраняем в массиве
        this.markers.push({
            id: markerId,
            coords: coords,
            type: type,
            user: userName,
            timestamp: Date.now(),
            moved: false
        });
        
        // Обновляем очки
        if (type !== 'clear') {
            this.userPoints -= cost;
            this.userActivity++;
            this.updateUI();
        }
        
        // Сохраняем
        this.saveMarkers();
        
        // Показываем уведомление
        this.showNotification(`${this.getTypeName(type)} добавлен! -${cost} очков`);
        
        console.log('Метка добавлена:', { coords, type, markerId });
    }
    
    removeMarkerAt(coords) {
        // Ищем ближайшую метку
        const objects = this.map.geoObjects;
        let closestMarker = null;
        let minDistance = Infinity;
        
        objects.each((object) => {
            if (object.geometry && object.properties) {
                const markerCoords = object.geometry.getCoordinates();
                const distance = this.getDistance(coords, markerCoords);
                
                if (distance < 0.0005 && distance < minDistance) { // ~50 метров
                    minDistance = distance;
                    closestMarker = object;
                }
            }
        });
        
        if (closestMarker) {
            this.removeMarker(closestMarker);
        } else {
            this.showNotification('Метка не найдена рядом', 'warning');
        }
    }
    
    removeMarker(marker) {
        const markerId = marker.properties.get('markerId');
        const type = marker.properties.get('type');
        
        // Удаляем с карты
        this.map.geoObjects.remove(marker);
        
        // Удаляем из массива
        this.markers = this.markers.filter(m => m.id !== markerId);
        
        // Начисляем очки за очистку
        this.userPoints += 5;
        this.updateUI();
        
        // Сохраняем
        this.saveMarkers();
        
        // Уведомление
        this.showNotification('Метка удалена! +5 очков');
    }
    
    removeMarkerById(markerId) {
        const objects = this.map.geoObjects;
        let foundMarker = null;
        
        objects.each((object) => {
            if (object.properties && object.properties.get('markerId') === markerId) {
                foundMarker = object;
            }
        });
        
        if (foundMarker) {
            this.removeMarker(foundMarker);
        }
    }
    
    getDistance(coords1, coords2) {
        const latDiff = coords1[0] - coords2[0];
        const lonDiff = coords1[1] - coords2[1];
        return Math.sqrt(latDiff * latDiff + lonDiff * lonDiff);
    }
    
    getMarkerCost(type) {
        const costs = {
            police: 10,
            accident: 15,
            hazard: 8,
            clear: 0
        };
        return costs[type] || 10;
    }
    
    getTypeName(type) {
        const names = {
            police: 'Полицейский патруль 🚓',
            accident: 'ДТП 💥',
            hazard: 'Опасность ⚠️',
            clear: 'Очистка'
        };
        return names[type] || type;
    }
    
    loadMarkers() {
        try {
            const saved = localStorage.getItem('traffic_yandex_markers');
            if (saved) {
                const markers = JSON.parse(saved);
                markers.forEach(marker => {
                    // Пересоздаем метку на карте
                    this.recreateMarker(marker);
                });
            }
            
            const savedPoints = localStorage.getItem('traffic_points');
            if (savedPoints) {
                this.userPoints = parseInt(savedPoints);
            }
            
            this.updateUI();
        } catch (e) {
            console.error('Ошибка загрузки маркеров:', e);
        }
    }
    
    recreateMarker(markerData) {
        // Создаем метку из сохраненных данных
        const marker = new ymaps.Placemark(
            markerData.coords,
            {
                hintContent: `${markerData.user}: ${this.getTypeName(markerData.type)}`,
                balloonContent: `
                    <div style="color: black; font-family: Arial; padding: 10px;">
                        <strong style="color: #2196F3;">${this.getTypeName(markerData.type)}</strong><br>
                        <small>Добавил: ${markerData.user}</small><br>
                        <small>Время: ${new Date(markerData.timestamp).toLocaleTimeString()}</small><br>
                        <small>Координаты: ${markerData.coords[0].toFixed(6)}, ${markerData.coords[1].toFixed(6)}</small><br>
                        ${markerData.moved ? `<small>⚠️ Перемещена</small><br>` : ''}
                        <button onclick="window.mapManager.removeMarkerById('${markerData.id}')" 
                                style="background: #f44336; color: white; border: none; padding: 8px 15px; border-radius: 5px; margin-top: 8px; cursor: pointer; font-size: 14px;">
                            🗑️ Удалить эту метку
                        </button>
                    </div>
                `,
                markerId: markerData.id,
                type: markerData.type,
                user: markerData.user,
                coords: markerData.coords
            },
            {
                preset: markerData.type === 'police' ? 'islands#blueStretchyIcon' : 
                        markerData.type === 'accident' ? 'islands#redStretchyIcon' : 
                        'islands#orangeStretchyIcon',
                iconColor: markerData.type === 'police' ? '#2196F3' : 
                          markerData.type === 'accident' ? '#F44336' : '#FF9800',
                draggable: true,
                hasBalloon: true,
                hasHint: true
            }
        );
        
        // Добавляем события перетаскивания
        marker.events.add('dragend', (e) => {
            const newCoords = marker.geometry.getCoordinates();
            const markerIndex = this.markers.findIndex(m => m.id === markerData.id);
            if (markerIndex !== -1) {
                this.markers[markerIndex].coords = newCoords;
                this.markers[markerIndex].moved = true;
                this.markers[markerIndex].moveTime = Date.now();
                this.saveMarkers();
            }
        });
        
        this.map.geoObjects.add(marker);
        
        // Сохраняем в массиве меток
        this.markers.push(markerData);
    }
    
    saveMarkers() {
        localStorage.setItem('traffic_yandex_markers', JSON.stringify(this.markers));
        localStorage.setItem('traffic_points', this.userPoints.toString());
    }
    
    updateUI() {
        const markerCount = document.getElementById('markerCount');
        const userPoints = document.getElementById('userPoints');
        const userActivity = document.getElementById('userActivity');
        const userRank = document.getElementById('userRank');
        
        if (markerCount) markerCount.textContent = this.markers.length;
        if (userPoints) userPoints.textContent = this.userPoints;
        if (userActivity) userActivity.textContent = this.userActivity;
        
        // Обновляем ранг
        if (userRank) {
            userRank.textContent = this.calculateRank();
        }
    }
    
    calculateRank() {
        if (this.userPoints >= 1000) return 'Комиссар 👮‍♂️';
        if (this.userPoints >= 500) return 'Сержант 👮';
        if (this.userPoints >= 200) return 'Офицер 🚔';
        if (this.userPoints >= 100) return 'Патрульный 🚓';
        return 'Новичок 🚦';
    }
    
    selectTool(tool) {
        this.selectedTool = tool;
        
        // Обновляем активные кнопки
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.tool === tool) {
                btn.classList.add('active');
            }
        });
        
        this.showNotification(`Выбран: ${this.getTypeName(tool)}`);
    }
    
    centerToUser() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const userCoords = [position.coords.latitude, position.coords.longitude];
                    this.map.setCenter(userCoords, 16);
                    this.showNotification('Карта центрирована на вас');
                },
                () => {
                    // Если геолокация недоступна, центрируем на дефолтные координаты
                    this.map.setCenter(this.defaultCenter, this.defaultZoom);
                    this.showNotification('Карта центрирована на базовые координаты');
                }
            );
        } else {
            this.map.setCenter(this.defaultCenter, this.defaultZoom);
        }
    }
    
    showChat() {
        document.getElementById('chatModal').classList.add('show');
        document.getElementById('chatBadge').textContent = '0';
        setTimeout(() => {
            document.getElementById('chatInput').focus();
        }, 300);
    }
    
    hideChat() {
        document.getElementById('chatModal').classList.remove('show');
    }
    
    sendMessage() {
        const input = document.getElementById('chatInput');
        const message = input.value.trim();
        
        if (message) {
            const userName = document.getElementById('userName').textContent;
            const messagesDiv = document.getElementById('chatMessages');
            
            const messageDiv = document.createElement('div');
            messageDiv.className = 'user-message';
            messageDiv.innerHTML = `
                <strong>${userName}:</strong> ${message}
                <small>${new Date().toLocaleTimeString()}</small>
            `;
            
            messagesDiv.appendChild(messageDiv);
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
            
            input.value = '';
            
            // Сохраняем в localStorage
            this.saveChatMessage(userName, message);
        }
    }
    
    saveChatMessage(user, message) {
        try {
            const chatHistory = JSON.parse(localStorage.getItem('traffic_chat') || '[]');
            chatHistory.push({
                user: user,
                message: message,
                timestamp: Date.now()
            });
            
            // Храним только последние 100 сообщений
            if (chatHistory.length > 100) {
                chatHistory.splice(0, chatHistory.length - 100);
            }
            
            localStorage.setItem('traffic_chat', JSON.stringify(chatHistory));
        } catch (e) {
            console.error('Ошибка сохранения сообщения:', e);
        }
    }
    
    loadChatMessages() {
        try {
            const chatHistory = JSON.parse(localStorage.getItem('traffic_chat') || '[]');
            const messagesDiv = document.getElementById('chatMessages');
            
            chatHistory.forEach(msg => {
                const messageDiv = document.createElement('div');
                messageDiv.className = 'user-message';
                messageDiv.innerHTML = `
                    <strong>${msg.user}:</strong> ${msg.message}
                    <small>${new Date(msg.timestamp).toLocaleTimeString()}</small>
                `;
                messagesDiv.appendChild(messageDiv);
            });
            
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        } catch (e) {
            console.error('Ошибка загрузки чата:', e);
        }
    }
    
    showNotification(message, type = 'success') {
        // Удаляем старые уведомления
        const oldNotifications = document.querySelectorAll('.notification');
        oldNotifications.forEach(n => n.remove());
        
        // Создаем новое уведомление
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'error' ? 'exclamation-circle' : type === 'warning' ? 'exclamation-triangle' : 'check-circle'}"></i>
            ${message}
        `;
        
        document.body.appendChild(notification);
        
        // Автоматическое скрытие
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateY(-20px)';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

// Инициализация при загрузке страницы
let mapManager;

document.addEventListener('DOMContentLoaded', () => {
    mapManager = new YandexMapManager();
    window.mapManager = mapManager;
    
    // Глобальные функции для кнопок
    window.selectTool = (tool) => mapManager.selectTool(tool);
    window.centerToUser = () => mapManager.centerToUser();
    window.showChat = () => mapManager.showChat();
    window.hideChat = () => mapManager.hideChat();
    window.sendMessage = () => mapManager.sendMessage();
    window.removeMarkerById = (id) => mapManager.removeMarkerById(id);
    
    // Загружаем историю чата
    setTimeout(() => {
        mapManager.loadChatMessages();
    }, 1000);
    
    // Добавляем обработчик клавиши Escape для закрытия чата
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            mapManager.hideChat();
        }
    });
    
    // Обработчик отправки сообщения по Enter
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                mapManager.sendMessage();
            }
        });
    }
});
