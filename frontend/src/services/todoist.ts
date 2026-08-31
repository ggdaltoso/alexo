const TODOIST_API_URL = 'https://api.todoist.com/api/v1';

// Max page size accepted by the v1 API; pages are followed via next_cursor.
const PAGE_LIMIT = 200;

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

// Task shape as returned by the v1 API, before normalization
interface ApiTask {
  id: string;
  content: string;
  description: string | null;
  checked: boolean;
  priority: number;
  // date is YYYY-MM-DD for all-day tasks, RFC 3339 when it has a time
  due: { date: string; string: string } | null;
  project_id: string;
  labels: string[];
  added_at: string;
  completed_at: string | null;
}

// v1 wraps list endpoints in a cursor-paginated envelope
interface Paginated<T> {
  results: T[];
  next_cursor: string | null;
}

// ...except the completed endpoints, which use `items`
interface CompletedResponse {
  items: ApiTask[];
  next_cursor: string | null;
}

function toTask(task: ApiTask): TodoistTask {
  return {
    id: task.id,
    content: task.content,
    description: task.description ?? '',
    is_completed: task.checked,
    priority: task.priority,
    due: task.due
      ? {
          // Split the RFC 3339 form so consumers always get a plain date
          date: task.due.date.slice(0, 10),
          string: task.due.string,
          datetime: task.due.date.includes('T') ? task.due.date : undefined,
        }
      : undefined,
    project_id: task.project_id,
    labels: task.labels,
    created_at: task.added_at,
  };
}

class TodoistService {
  private apiToken: string;

  constructor() {
    this.apiToken = import.meta.env.VITE_TODOIST_API_TOKEN || '';
  }

  private async request<T>(
    endpoint: string,
    params: Record<string, string> = {},
  ): Promise<T> {
    if (!this.apiToken) {
      throw new Error(
        'Todoist API token not configured. Please set VITE_TODOIST_API_TOKEN in your .env file.',
      );
    }

    const query = new URLSearchParams(params).toString();
    const response = await fetch(
      `${TODOIST_API_URL}${endpoint}${query ? `?${query}` : ''}`,
      {
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Todoist API error: ${response.statusText}`);
    }

    return response.json();
  }

  // Follows next_cursor so a long overdue list is not silently truncated
  private async requestAllPages(
    endpoint: string,
    params: Record<string, string> = {},
  ): Promise<ApiTask[]> {
    const tasks: ApiTask[] = [];
    let cursor: string | null = null;

    do {
      const page: Paginated<ApiTask> = await this.request<Paginated<ApiTask>>(
        endpoint,
        {
          ...params,
          limit: String(PAGE_LIMIT),
          ...(cursor ? { cursor } : {}),
        },
      );
      tasks.push(...page.results);
      cursor = page.next_cursor;
    } while (cursor);

    return tasks;
  }

  async getTasks(): Promise<TodoistTask[]> {
    const tasks = await this.requestAllPages('/tasks');
    return tasks.map(toTask);
  }

  async getTasksByFilter(filter: string): Promise<TodoistTask[]> {
    const tasks = await this.requestAllPages('/tasks/filter', {
      query: filter,
    });
    return tasks.map(toTask);
  }

  async getTodayTasks(): Promise<TodoistTask[]> {
    // Fetch active and completed tasks for today in parallel
    const [activeTasks, completedTasks] = await Promise.all([
      this.getTasksByFilter('today | overdue'),
      this.getCompletedTasksToday(),
    ]);

    return [...activeTasks, ...completedTasks];
  }

  private async getCompletedTasksToday(): Promise<TodoistTask[]> {
    try {
      const today = new Date();
      const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();
      const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString();

      const response = await this.request<CompletedResponse>(
        '/tasks/completed/by_completion_date',
        {
          since: startOfDay,
          until: endOfDay,
          limit: String(PAGE_LIMIT),
        },
      );

      return response.items.map(toTask);
    } catch (error) {
      console.error('Error fetching completed tasks:', error);
      return []; // Return empty array on error
    }
  }
}

export const todoistService = new TodoistService();
