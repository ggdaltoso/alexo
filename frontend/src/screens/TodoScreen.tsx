import { useTodoist } from '../hooks/useTodoist';
import { Frame, Button, TitleBar, Fieldset, Checkbox } from '@react95/core';
import { FilePen } from '@react95/icons';
import { Loader } from 'lucide-react';
import { Fragment } from 'react/jsx-runtime';

console.log({ envs: import.meta.env });

export function TodoScreen() {
  const { tasks, loading, error, refreshTasks } = useTodoist();

  const activeTasks = tasks.filter((task) => !task.is_completed);
  const completedTasks = tasks.filter((task) => task.is_completed);

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
    <Frame
      boxShadow="$out"
      bgColor="$material"
      p="$2"
      gap="$2"
      display="flex"
      flexDirection="column"
      h="100%"
    >
      <TitleBar
        icon={<FilePen variant="16x16_4" className="!w-[24px] !h-[24px]" />}
        className="text-[20px] h-[32px]"
        title={`Today's Tasks (${activeTasks.length}/${tasks.length})`}
      />
      {/* Main Content */}
      <Frame
        p="$6"
        className="h-full flex flex-col overflow-y-auto"
        variant="window"
      >
        {tasks.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No tasks for today</p>
          </div>
        ) : (
          <>
            {/* Active Tasks */}
            {activeTasks.length > 0 && (
              <Fieldset
                className="[&>legend]:text-[0.5rem] mb-4"
                legend="Active Tasks"
              >
                <Frame display="flex" flexDirection="column">
                  {activeTasks.map((task) => (
                    <Fragment key={task.id}>
                      <Checkbox
                        className="text-xs h-4 [&>*:nth-child(-n+2)]:w-3 [&>*:nth-child(-n+2)]:h-3 [&>*:nth-child(3)]:p-2"
                        checked={task.is_completed}
                      >
                        {task.content}
                      </Checkbox>

                      {task.description && (
                        <p className="text-xs text-gray-600 ml-6 mt-1 mb-2">
                          {task.description}
                        </p>
                      )}
                    </Fragment>
                  ))}
                </Frame>
              </Fieldset>
            )}

            {/* Completed Tasks */}
            {completedTasks.length > 0 && (
              <Fieldset
                className="[&>legend]:text-[0.5rem] mt-4"
                legend="Completed Tasks"
              >
                <Frame display="flex" flexDirection="column">
                  {completedTasks.map((task) => (
                    <Fragment key={task.id}>
                      <Checkbox
                        className="text-xs h-4 [&>*:nth-child(-n+2)]:w-3 [&>*:nth-child(-n+2)]:h-3 [&>*:nth-child(3)]:p-2"
                        checked={task.is_completed}
                      >
                        <span className="line-through text-gray-500">
                          {task.content}
                        </span>
                      </Checkbox>

                      {task.description && (
                        <p className="text-xs text-gray-400 ml-6 mt-1 mb-2 line-through">
                          {task.description}
                        </p>
                      )}
                    </Fragment>
                  ))}
                </Frame>
              </Fieldset>
            )}
          </>
        )}
      </Frame>
    </Frame>
  );
}
