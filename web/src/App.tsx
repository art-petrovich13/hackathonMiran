import { useEffect, useState } from 'react';
import { Camera, Send } from 'lucide-react';
import styles from './App.module.css';

interface DevicePhoto {
  deviceId: number;
  photoUrl: string | null;
  file: File | null;
}

// 🔧 НАСТРОЙКА: URL вашего backend
const API_URL = 'https://tony-ultimately-oven-montgomery.trycloudflare.com/upload';

function App() {
  const [photos, setPhotos] = useState<DevicePhoto[]>([
    { deviceId: 1, photoUrl: null, file: null },
    { deviceId: 2, photoUrl: null, file: null },
    { deviceId: 3, photoUrl: null, file: null },
  ]);

  const [isSending, setIsSending] = useState(false);
  const [tg, setTg] = useState<any>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
      const telegram = (window as any).Telegram.WebApp;
      telegram.ready();
      telegram.expand();
      setTg(telegram);
      
      // Получаем userId из initData
      const initData = telegram.initData || '';
      console.log('🔍 Raw initData:', initData);
      
      // Парсим initData для получения user
      let extractedUserId = null;
      
      if (telegram.initDataUnsafe?.user?.id) {
        extractedUserId = telegram.initDataUnsafe.user.id.toString();
      } else if (initData) {
        // Парсим initData вручную
        const params = new URLSearchParams(initData);
        const userJson = params.get('user');
        if (userJson) {
          try {
            const user = JSON.parse(userJson);
            extractedUserId = user.id?.toString();
          } catch (e) {
            console.error('Ошибка парсинга user:', e);
          }
        }
      }
      
      console.log('✅ Telegram WebApp инициализирован');
      console.log('👤 User ID:', extractedUserId);
      console.log('📱 Platform:', telegram.platform);
      console.log('🌐 Version:', telegram.version);
      
      if (extractedUserId) {
        setUserId(extractedUserId);
      } else {
        console.warn('⚠️ User ID не найден. Используется тестовый ID.');
        // Для тестирования можно использовать фиксированный ID
        // В продакшене это нужно убрать!
        setUserId('TEST_USER_ID');
      }
      
      // Настройка главной кнопки
      telegram.MainButton.setText('📤 Отправить на анализ');
      telegram.MainButton.hide();
    }
  }, []);

  const handleCameraCapture = (deviceId: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      console.log(`📸 Фото добавлено для прибора ${deviceId}:`, file.name);
      const url = URL.createObjectURL(file);
      setPhotos(prev => prev.map(device =>
        device.deviceId === deviceId
          ? { ...device, photoUrl: url, file }
          : device
      ));
    }
  };

  const allPhotosTaken = photos.every(photo => photo.photoUrl !== null);
  const takenPhotosCount = photos.filter(photo => photo.photoUrl !== null).length;

  // Показываем/скрываем главную кнопку Telegram
  useEffect(() => {
    if (tg) {
      if (allPhotosTaken) {
        tg.MainButton.show();
        tg.MainButton.enable();
      } else {
        tg.MainButton.hide();
      }
    }
  }, [allPhotosTaken, tg]);

  const handleSubmit = async () => {
    if (!allPhotosTaken || isSending) {
      console.log('⚠️ Условие не выполнено:', { allPhotosTaken, isSending });
      return;
    }
    
    if (!userId) {
      alert('❌ Не удалось получить ID пользователя. Откройте мини-апп из Telegram бота.');
      return;
    }

    setIsSending(true);
    console.log('🚀 Начало отправки фото...');
    
    try {
      console.log('👤 Chat ID:', userId);
      console.log('📦 Отправка на:', API_URL);

      // Создаем FormData для отправки файлов
      const formData = new FormData();
      formData.append('chatId', userId);
      
      // Добавляем файлы
      photos.forEach((photo, index) => {
        if (photo.file) {
          formData.append('photos', photo.file, `device_${photo.deviceId}.jpg`);
          console.log(`📎 Файл ${index + 1}:`, photo.file.name, `(${(photo.file.size / 1024).toFixed(2)} KB)`);
        }
      });

      // Отправляем на backend
      const response = await fetch(API_URL, {
        method: 'POST',
        body: formData
      });

      console.log('📡 Статус ответа:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ошибка сервера: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ Ответ сервера:', result);

      // Показываем успешное сообщение (используем обычный alert для совместимости)
      if (tg && tg.showAlert && tg.version >= '6.1') {
        tg.showAlert('✅ Фото успешно отправлены на анализ!');
      } else {
        alert('✅ Фото успешно отправлены на анализ!');
      }
      
      // Закрываем WebApp после отправки
      setTimeout(() => {
        if (tg && tg.close) {
          tg.close();
        }
      }, 1500);
      
    } catch (error: any) {
      console.error('❌ Ошибка отправки:', error);
      
      let errorMessage = 'Не удалось отправить фото';
      if (error.message) {
        errorMessage += `: ${error.message}`;
      }
      
      // Используем обычный alert для совместимости
      if (tg && tg.showAlert && tg.version >= '6.1') {
        tg.showAlert(errorMessage);
      } else {
        alert(errorMessage);
      }
      setIsSending(false);
    }
  };

  // Обработчик нажатия на главную кнопку Telegram
  useEffect(() => {
    if (tg) {
      tg.MainButton.onClick(handleSubmit);
      return () => {
        tg.MainButton.offClick(handleSubmit);
      };
    }
  }, [tg, photos, isSending, allPhotosTaken, userId]);

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <h1 className={styles.title}>📸 Фото приборов</h1>

        {/* Отладочная информация */}
        {!userId && (
          <div style={{ 
            padding: '10px', 
            background: '#fff3cd', 
            border: '1px solid #ffc107',
            borderRadius: '8px',
            marginBottom: '15px'
          }}>
            ⚠️ Откройте приложение из Telegram бота
          </div>
        )}

        <div className={styles.photoCounter}>
          <p>Сделано фото: {takenPhotosCount} из {photos.length}</p>
          {allPhotosTaken && (
            <p className={styles.readyText}>✅ Все фото готовы к отправке!</p>
          )}
        </div>

        {photos.map((device) => (
          <div key={device.deviceId} className={styles.deviceBlock}>
            <div className={styles.deviceContent}>
              <h2 className={styles.deviceTitle}>Прибор {device.deviceId}</h2>

              <label htmlFor={`camera-input-${device.deviceId}`} className={styles.photoLabel}>
                <div className={styles.photoUploadArea}>
                  {device.photoUrl ? (
                    <div className={styles.photoPreviewContainer}>
                      <img
                        src={device.photoUrl}
                        alt={`Прибор ${device.deviceId}`}
                        className={styles.photoImage}
                      />
                      <div className={styles.photoOverlay}>
                        <Camera className={styles.overlayIcon} size={32} />
                        <span>Изменить фото</span>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.emptyState}>
                      <Camera size={48} className={styles.emptyIcon} />
                      <p className={styles.emptyText}>Нажмите для фото</p>
                    </div>
                  )}
                </div>
                <input
                  id={`camera-input-${device.deviceId}`}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className={styles.fileInput}
                  onChange={(e) => handleCameraCapture(device.deviceId, e)}
                />
              </label>
            </div>
          </div>
        ))}

        {/* Запасная кнопка (если MainButton не работает) */}
        <button 
          className={`${styles.submitButton} ${!allPhotosTaken || isSending ? styles.submitButtonDisabled : ''}`}
          onClick={handleSubmit}
          disabled={!allPhotosTaken || isSending}
        >
          {isSending ? (
            <>
              <div className={styles.loadingSpinner}></div>
              Отправка...
            </>
          ) : (
            <>
              <Send size={20} />
              📤 Отправить на анализ
            </>
          )}
        </button>

        {!allPhotosTaken && (
          <p className={styles.helperText}>
            Сделайте все 3 фото для отправки
          </p>
        )}
      </div>
    </div>
  );
}

export default App;