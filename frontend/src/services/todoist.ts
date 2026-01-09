const TODOIST_API_URL = 'https://api.todoist.com/rest/v2';

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

export interface CreateTaskParams {
  content: string;
  description?: string;
  priority?: number;
  due_string?: string;
  project_id?: string;
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

  async getActiveTasks(): Promise<TodoistTask[]> {
    const tasks = await this.getTasks();
    return tasks.filter((task) => !task.is_completed);
  }

  async getTodayTasks(): Promise<TodoistTask[]> {
    const allTasks = await this.getTasks();
    const today = new Date().toISOString().split('T')[0]; // formato YYYY-MM-DD

    return allTasks.filter((task) => {
      if (!task.due) return false;
      return task.due.date === today;
    });
  }

  async createTask(params: CreateTaskParams): Promise<TodoistTask> {
    return this.request<TodoistTask>('/tasks', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async updateTask(
    id: string,
    params: Partial<CreateTaskParams>,
  ): Promise<TodoistTask> {
    return this.request<TodoistTask>(`/tasks/${id}`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async completeTask(id: string): Promise<void> {
    await this.request<void>(`/tasks/${id}/close`, {
      method: 'POST',
    });
  }

  async reopenTask(id: string): Promise<void> {
    await this.request<void>(`/tasks/${id}/reopen`, {
      method: 'POST',
    });
  }

  async deleteTask(id: string): Promise<void> {
    await this.request<void>(`/tasks/${id}`, {
      method: 'DELETE',
    });
  }
}

export const todoistService = new TodoistService();
