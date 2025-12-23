import { useQuery } from '@tanstack/react-query';
import type { Coordinates } from '../types';
import { fetchWeather } from '../services/weather';

const SAO_VICENTE_COORDINATES: Coordinates = {
  latitude: -23.9633, // São Vicente, SP, Brazil
  longitude: -46.3919,
};

export function useWeather(coordinates: Coordinates = SAO_VICENTE_COORDINATES) {
  return useQuery({
    queryKey: ['weather', coordinates],
    queryFn: () => fetchWeather(coordinates),
    refetchInterval: 1800000, // Refetch every 30 minutes
    staleTime: 1500000, // Consider data stale after 25 minutes
  });
}
