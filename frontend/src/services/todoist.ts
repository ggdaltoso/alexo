const TODOIST_API_URL = 'https://api.todoist.com/rest/v2';
const TODOIST_SYNC_API_URL = 'https://api.todoist.com/sync/v9';

export interface TodoistTask {
  id: string;
  content: string;
  description: string;
  is_completed: boolean;
  priority: number; // 1 (normal) to 4 (urgent)
  due?: {
    date: string;
    string: string;
    datetime?: string;
  };
  project_id: string;
  labels: string[];
  created_at: string;
}

// Sync API types for completed tasks
interface CompletedItem {
  id: string;
  task_id: string;
  content: string;
  completed_at: string;
  project_id: string;
  note_count: number;
  notes: unknown[];
}

interface CompletedTasksResponse {
  items: CompletedItem[];
  has_more: boolean;
}

class TodoistService {
  private apiToken: string;

  constructor() {
    this.apiToken = import.meta.env.VITE_TODOIST_API_TOKEN || '';
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    if (!this.apiToken) {
      throw new Error(
        'Todoist API token not configured. Please set VITE_TODOIST_API_TOKEN in your .env file.',
      );
    }

    const response = await fetch(`${TODOIST_API_URL}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`Todoist API error: ${response.statusText}`);
    }

    return response.json();
  }

  async getTasks(): Promise<TodoistTask[]> {
    return this.request<TodoistTask[]>('/tasks');
  }

  async getTasksByFilter(filter: string): Promise<TodoistTask[]> {
    return this.request<TodoistTask[]>(
      `/tasks?filter=${encodeURIComponent(filter)}`,
    );
  }

  async getActiveTasks(): Promise<TodoistTask[]> {
    const tasks = await this.getTasks();
    return tasks.filter((task) => !task.is_completed);
  }

  async getTodayTasks(): Promise<TodoistTask[]> {
    // Fetch active and completed tasks for today in parallel
    const [activeTasks, completedTasks] = await Promise.all([
      this.getTasksByFilter('today'),
      this.getCompletedTasksToday(),
    ]);

    return [...activeTasks, ...completedTasks];
  }

  private async getCompletedTasksToday(): Promise<TodoistTask[]> {
    try {
      const today = new Date();
      const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();
      const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString();

      const response = await fetch(
        `${TODOIST_SYNC_API_URL}/completed/get_all`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            since: startOfDay,
            until: endOfDay,
            limit: 200,
          }),
        },
      );

      if (!response.ok) {
        console.error('Failed to fetch completed tasks:', response.statusText);
        return [];
      }

      const data: CompletedTasksResponse = await response.json();

      // Convert CompletedItem to TodoistTask
      return data.items.map((item) => ({
        id: item.task_id,
        content: item.content,
        description: '',
        is_completed: true,
        priority: 1,
        project_id: item.project_id,
        labels: [],
        created_at: item.completed_at,
      }));
    } catch (error) {
      console.error('Error fetching completed tasks:', error);
      return []; // Return empty array on error
    }
  }
}

export const todoistService = new TodoistService();
