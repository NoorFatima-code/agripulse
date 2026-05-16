// src/hooks/useWeather.ts
// Fetches real-time weather from OpenWeatherMap and maps it to farm conditions.
// Add VITE_OPENWEATHER_API_KEY to your .env file.

import { useState, useCallback } from "react";

export interface WeatherConditions {
  soilMoisture: number;   // estimated from humidity (%)
  tempC: number;          // actual temperature °C
  rainfallMm: number;     // rain in last 3 hours (mm)
  sunlightHours: number;  // estimated from cloud cover
  humidity: number;       // actual humidity (%)
}

interface WeatherState {
  loading: boolean;
  error: string | null;
  city: string | null;
  conditions: WeatherConditions | null;
}

const API_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY;

// Maps cloud cover % → estimated daily sunlight hours
function cloudsToSunlight(cloudPct: number): number {
  if (cloudPct <= 10) return 11;
  if (cloudPct <= 25) return 9;
  if (cloudPct <= 50) return 7;
  if (cloudPct <= 75) return 5;
  return 3;
}

// Estimates soil moisture from humidity (rough agronomic proxy)
function humidityToSoilMoisture(humidity: number): number {
  // Scale humidity (30-100%) → soil moisture (15-65%)
  return Math.round(15 + ((humidity - 30) / 70) * 50);
}

export function useWeather() {
  const [state, setState] = useState<WeatherState>({
    loading: false,
    error: null,
    city: null,
    conditions: null,
  });

  const fetchWeather = useCallback(async () => {
    if (!API_KEY) {
      setState((p) => ({
        ...p,
        error: "VITE_OPENWEATHER_API_KEY not set in .env",
      }));
      return;
    }

    setState((p) => ({ ...p, loading: true, error: null }));

    // Step 1: Get user's coordinates
    const coords = await new Promise<GeolocationCoordinates | null>((resolve) => {
      if (!navigator.geolocation) { resolve(null); return; }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(pos.coords),
        () => resolve(null),
        { timeout: 8000 }
      );
    });

    try {
      let url: string;

      if (coords) {
        // Use precise location
        url = `https://api.openweathermap.org/data/2.5/weather?lat=${coords.latitude}&lon=${coords.longitude}&appid=${API_KEY}&units=metric`;
      } else {
        // Fallback: auto-detect by IP via OpenWeatherMap (uses "auto" isn't supported,
        // so we use a free IP geolocation first)
        const ipRes = await fetch("https://ipapi.co/json/");
        const ipData = await ipRes.json();
        url = `https://api.openweathermap.org/data/2.5/weather?lat=${ipData.latitude}&lon=${ipData.longitude}&appid=${API_KEY}&units=metric`;
      }

      const res = await fetch(url);
      if (!res.ok) throw new Error(`Weather API error: ${res.status}`);
      const data = await res.json();

      const tempC      = Math.round(data.main.temp);
      const humidity   = data.main.humidity;
      const cloudPct   = data.clouds?.all ?? 50;
      const rainfallMm = data.rain?.["3h"] ?? data.rain?.["1h"] ?? 0;
      const city       = data.name ?? "Your location";

      const conditions: WeatherConditions = {
        tempC,
        humidity,
        rainfallMm: Math.min(Math.round(rainfallMm * 10) / 10, 100),
        sunlightHours: cloudsToSunlight(cloudPct),
        soilMoisture: humidityToSoilMoisture(humidity),
      };

      setState({ loading: false, error: null, city, conditions });
    } catch (err: any) {
      setState((p) => ({
        ...p,
        loading: false,
        error: err?.message ?? "Failed to fetch weather",
      }));
    }
  }, []);

  return { ...state, fetchWeather };
}

