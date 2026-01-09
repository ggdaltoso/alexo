import { useTodoist } from '../hooks/useTodoist';
import { Frame, List, TaskBar, Button } from '@react95/core';
import { Loader, RefreshCw } from 'lucide-react';

export function TodoScreen() {
  const { tasks, loading, error, refreshTasks } = useTodoist();

  const getPriorityColor = (priority: number) => {
    switch (priority) {
      case 4:
        return 'red';
      case 3:
        return 'orange';
      case 2:
        return 'blue';
      default:
        return 'gray';
    }
  };

  const getPriorityLabel = (priority: number) => {
    switch (priority) {
      case 4:
        return 'P1';
      case 3:
        return 'P2';
      case 2:
        return 'P3';
      default:
        return 'P4';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader className="w-8 h-8 animate-spin text-gray-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <Frame className="p-4" variant="well">
          <h2 className="text-red-600 font-bold mb-2">Error</h2>
          <p className="text-sm mb-4">{error}</p>
          <Button onClick={refreshTasks}>Retry</Button>
        </Frame>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#008080]">
      {/* Title Bar */}
      <TaskBar className="flex-shrink-0">
        <div className="flex items-center justify-between w-full px-2">
          <span className="font-bold">Todoist Tasks</span>
          <Button size="sm" onClick={refreshTasks} disabled={loading}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </TaskBar>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden p-2">
        <Frame className="h-full flex flex-col" variant="window">
          <div className="bg-[#000080] text-white px-2 py-1 flex justify-between items-center">
            <span className="font-bold text-sm">
              Active Tasks ({tasks.length})
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-2 bg-white">
            {tasks.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No active tasks</p>
              </div>
            ) : (
              <List className="w-full">
                {tasks.map((task) => (
                  <li
                    key={task.id}
                    className="border-b border-gray-300 py-2 px-3 hover:bg-[#000080] hover:text-white cursor-pointer group"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`inline-block px-1 text-xs font-bold text-white rounded`}
                        style={{
                          backgroundColor: getPriorityColor(task.priority),
                        }}
                      >
                        {getPriorityLabel(task.priority)}
                      </span>
                      <span className="text-sm font-medium">
                        {task.content}
                      </span>
                    </div>
                    {task.description && (
                      <p className="text-xs text-gray-600 ml-6 mt-1 group-hover:text-gray-300">
                        {task.description}
                      </p>
                    )}
                    {task.due && (
                      <p className="text-xs text-gray-500 ml-6 mt-1 group-hover:text-gray-300">
                        📅 {task.due.string}
                      </p>
                    )}
                  </li>
                ))}
              </List>
            )}
          </div>
        </Frame>
      </div>
    </div>
  );
}
