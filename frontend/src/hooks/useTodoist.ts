import { useQuery } from '@tanstack/react-query';
import { todoistService } from '../services/todoist';

export function useTodoist() {
  return useQuery({
    queryKey: ['todoist-tasks'],
    queryFn: () => todoistService.getTodayTasks(),
    refetchInterval: 1800000, // Refetch every 30 minutes
    staleTime: 1500000, // Consider data stale after 25 minutes
  });
}
