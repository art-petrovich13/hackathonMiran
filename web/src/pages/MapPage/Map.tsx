import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import locationsData from './locations.json';
import { createRoute } from '../../services/routeService';
import type { RouteRequest, RouteResponse } from '../../services/routeService';
import styles from './Map.module.scss';

const Map = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [routeInfo, setRouteInfo] = useState<{
    distance: number;
    duration: number;
    isLoading: boolean;
  }>({
    distance: 0,
    duration: 0,
    isLoading: true,
  });

  const decodePolyline = (encoded: string) => {
    const points: [number, number][] = [];
    let index = 0;
    let lat = 0;
    let lng = 0;

    while (index < encoded.length) {
      let b;
      let shift = 0;
      let result = 0;

      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);

      const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lat += dlat;

      shift = 0;
      result = 0;

      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);

      const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lng += dlng;

      points.push([lng / 1e5, lat / 1e5]);
    }

    return points;
  };

  const formatDistance = (meters: number): string => {
    if (meters < 1000) {
      return `${Math.round(meters)} м`;
    }
    return `${(meters / 1000).toFixed(1)} км`;
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours} ч ${minutes} мин`;
    }
    return `${minutes} мин`;
  };

  const calculateTotalStats = async (): Promise<{ totalDistance: number; totalDuration: number }> => {
    let totalDistance = 0;
    let totalDuration = 0;
    const segmentResponses: RouteResponse[] = [];

    // Собираем данные по всем сегментам
    for (let i = 0; i < locationsData.places.length - 1; i++) {
      const place = locationsData.places[i];
      const nextPlace = locationsData.places[i + 1];

      const segmentData: RouteRequest = {
        places: [place, nextPlace],
        start: place.location,
        end: nextPlace.location
      };

      try {
        const response = await createRoute(segmentData);
        segmentResponses.push(response);

        // Суммируем расстояние из summary.travel
        totalDistance += response.plan.summary.travel;

        // Суммируем общую продолжительность из summary.duration
        totalDuration += response.plan.summary.duration;

        // Добавляем время посещения текущей точки (кроме последней)
        if (i < locationsData.places.length - 1) {
          totalDuration += place.durationMinutes * 60; // Конвертируем минуты в секунды
        }
      } catch (error) {
        console.error(`Error loading segment ${i + 1}:`, error);
      }
    }

    return { totalDistance, totalDuration };
  };

  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    fetch('/maps-u-travel/style/style.json')
      .then(response => response.json())
      .then(async (style) => {
        if (style.sources && style.sources.openmaptiles) {
          style.sources.openmaptiles.url = style.sources.openmaptiles.url.replace('https://maps.u-travel.by', '/maps-u-travel');
        }
        if (style.glyphs) {
          style.glyphs = style.glyphs.replace('https://trailstash.github.io/openmaptiles-fonts', '/glyphs/openmaptiles-fonts');
        }

        map.current = new maplibregl.Map({
          container: mapContainer.current!,
          style: style,
          center: [27.5, 53.9], // Центр Беларуси
          zoom: 6,
          minZoom: 4,
          maxBounds: [
            [23.2, 51.5], // Юго-западный угол
            [32.8, 56.2]  // Северо-восточный угол
          ]
        });

        // Загружаем маршрут после готовности карты
        map.current.on('load', async () => {
          try {
            setRouteInfo(prev => ({ ...prev, isLoading: true }));

            // Рассчитываем общую статистику маршрута
            const stats = await calculateTotalStats();
            setRouteInfo({
              distance: stats.totalDistance,
              duration: stats.totalDuration,
              isLoading: false
            });

            // Создаем последовательные сегменты маршрута
            const allCoordinates: [number, number][] = [];
            const segmentPromises = locationsData.places.slice(0, -1).map(async (place, index) => {
              const nextPlace = locationsData.places[index + 1];
              const segmentData: RouteRequest = {
                places: [place, nextPlace],
                start: place.location,
                end: nextPlace.location
              };
              const response = await createRoute(segmentData);
              return decodePolyline(response.plan.geometry);
            });

            const segmentCoordinates = await Promise.all(segmentPromises);
            segmentCoordinates.forEach(coords => allCoordinates.push(...coords));

            // Удаляем существующие источник и слой маршрута, если они есть
            if (map.current!.getSource('route')) {
              map.current!.removeLayer('route');
              map.current!.removeSource('route');
            }

            // Добавляем источник и слой маршрута
            map.current!.addSource('route', {
              type: 'geojson',
              data: {
                type: 'Feature',
                properties: {},
                geometry: {
                  type: 'LineString',
                  coordinates: allCoordinates
                }
              }
            });

            map.current!.addLayer({
              id: 'route',
              type: 'line',
              source: 'route',
              layout: {
                'line-join': 'round',
                'line-cap': 'round'
              },
              paint: {
                'line-color': '#3887be',
                'line-width': 5,
                'line-opacity': 0.75
              }
            });

            // Подгоняем карту под границы маршрута
            const bounds = new maplibregl.LngLatBounds();
            allCoordinates.forEach(coord => bounds.extend(coord));
            map.current!.fitBounds(bounds, { padding: 50 });

            // Добавляем маркеры для мест
            locationsData.places.forEach((place) => {
              new maplibregl.Marker()
                .setLngLat([place.location.lon, place.location.lat])
                .setPopup(new maplibregl.Popup().setHTML(`<h3>${place.label}</h3>`))
                .addTo(map.current!);
            });

            // Добавляем стартовый маркер
            new maplibregl.Marker({ color: 'green' })
              .setLngLat([locationsData.places[0].location.lon, locationsData.places[0].location.lat])
              .setPopup(new maplibregl.Popup().setHTML('<h3>Старт</h3>'))
              .addTo(map.current!);

            // Добавляем конечный маркер
            new maplibregl.Marker({ color: 'red' })
              .setLngLat([locationsData.places[locationsData.places.length - 1].location.lon, locationsData.places[locationsData.places.length - 1].location.lat])
              .setPopup(new maplibregl.Popup().setHTML('<h3>Финиш</h3>'))
              .addTo(map.current!);

          } catch (error) {
            console.error('Ошибка загрузки маршрута:', error);
            setRouteInfo(prev => ({ ...prev, isLoading: false }));
          }
        });
      })
      .catch(error => console.error('Ошибка загрузки стиля:', error));

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  return (
  <div className={styles.mapContainer}>
    <div ref={mapContainer} className={styles.map} />

    {/* Карточки с информацией сверху слева */}
    <div className={styles.infoCards}>
      <div className={styles.card}>
        <div className={styles.cardLabel}>Общее время в пути</div>
        <div className={styles.cardValue}>
          {routeInfo.isLoading ? '...' : formatDuration(routeInfo.duration)}
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardLabel}>Общее расстояние</div>
        <div className={styles.cardValue}>
          {routeInfo.isLoading ? '...' : formatDistance(routeInfo.distance)}
        </div>
      </div>
    </div>

    {/* Кнопка "Поехали" снизу */}
    <div className={styles.buttonContainer}>
      <button className={styles.startButton}>
        <span className={styles.buttonText}>Поехали</span>
      </button>
    </div>
  </div>
);
};

export default Map;