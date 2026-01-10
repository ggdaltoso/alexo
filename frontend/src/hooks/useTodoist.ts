import { useState, useEffect, useCallback } from 'react';
import { todoistService, TodoistTask } from '../services/todoist';

interface UseTodoistReturn {
  tasks: TodoistTask[];
  loading: boolean;
  error: string | null;
  refreshTasks: () => Promise<void>;
}

export function useTodoist(): UseTodoistReturn {
  const [tasks, setTasks] = useState<TodoistTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const fetchedTasks = await todoistService.getTodayTasks();
      setTasks(fetchedTasks);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tasks');
      console.error('Error fetching tasks:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshTasks();
  }, [refreshTasks]);

  return {
    tasks,
    loading,
    error,
    refreshTasks,
  };
}
