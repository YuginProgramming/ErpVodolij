import axios from "axios";
import { dataBot } from "../values.js";

const getRouteDistanceAndMapLink = async (points) => {
  if (!points || points.length < 2) {
    return { distanceKm: 0, mapLink: '' };
  }

  // Сортуємо точки
  const sortedPoints = points.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  const origin = `${sortedPoints[0].latitude},${sortedPoints[0].longitude}`;
  const destination = `${sortedPoints[sortedPoints.length - 1].latitude},${sortedPoints[sortedPoints.length - 1].longitude}`;

  const waypointsArray = sortedPoints.slice(1, sortedPoints.length - 1)
    .map(p => `${p.latitude},${p.longitude}`);
  const waypoints = waypointsArray.length ? waypointsArray.join('|') : '';

  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&key=${dataBot.gapiKey}`;
  const fullUrl = waypoints ? `${url}&waypoints=${waypoints}` : url;

  try {
    const response = await axios.get(fullUrl);
    const data = response.data;

    if (data.status !== 'OK') {
      throw new Error(`Google Directions API error: ${data.status} - ${data.error_message || ''}`);
    }

    let totalDistance = 0;
    data.routes[0].legs.forEach(leg => {
      totalDistance += leg.distance.value;
    });

    const distanceKm = (totalDistance / 1000).toFixed(2);

    // Створюємо посилання на маршрут у Google Maps
    const baseMapUrl = `https://www.google.com/maps/dir/?api=1`;
    const mapLink = `${baseMapUrl}&origin=${origin}&destination=${destination}${waypointsArray.length ? `&waypoints=${waypointsArray.join('|')}` : ''}`;

    return { distanceKm, mapLink };
  } catch (error) {
    console.error('Error getting route:', error);
    return { distanceKm: null, mapLink: null };
  }
}

export {getRouteDistanceAndMapLink}
