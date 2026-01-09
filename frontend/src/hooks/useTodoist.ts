import { useState, useEffect, useCallback } from 'react';
import { todoistService, TodoistTask, CreateTaskParams } from '../services/todoist';

interface UseTodoistReturn {
  tasks: TodoistTask[];
  loading: boolean;
  error: string | null;
  refreshTasks: () => Promise<void>;
  createTask: (params: CreateTaskParams) => Promise<void>;
  completeTask: (id: string) => Promise<void>;
  reopenTask: (id: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
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

  const createTask = useCallback(async (params: CreateTaskParams) => {
    try {
      setError(null);
      await todoistService.createTask(params);
      await refreshTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
      throw err;
    }
  }, [refreshTasks]);

  const completeTask = useCallback(async (id: string) => {
    try {
      setError(null);
      await todoistService.completeTask(id);
      await refreshTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete task');
      throw err;
    }
  }, [refreshTasks]);

  const reopenTask = useCallback(async (id: string) => {
    try {
      setError(null);
      await todoistService.reopenTask(id);
      await refreshTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reopen task');
      throw err;
    }
  }, [refreshTasks]);

  const deleteTask = useCallback(async (id: string) => {
    try {
      setError(null);
      await todoistService.deleteTask(id);
      await refreshTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete task');
      throw err;
    }
  }, [refreshTasks]);

  useEffect(() => {
    refreshTasks();
  }, [refreshTasks]);

  return {
    tasks,
    loading,
    error,
    refreshTasks,
    createTask,
    completeTask,
    reopenTask,
    deleteTask,
  };
}
