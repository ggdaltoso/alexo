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
    // Busca tarefas de hoje usando o filtro da API do Todoist
    // Nota: A API v2 do Todoist retorna apenas tarefas não completadas por padrão
    return this.getTasksByFilter('today');
  }
}

export const todoistService = new TodoistService();
