import { useTodoist } from '../hooks/useTodoist';
import { Frame, TitleBar, Fieldset, Checkbox } from '@react95/core';
import { Faxcover108 } from '@react95/icons/Faxcover108';
import { FilePen } from '@react95/icons/FilePen';
import { Joy108 } from '@react95/icons/Joy108';
import { Loader } from 'lucide-react';

export function TodoScreen() {
  const { data: tasks = [], isLoading, error } = useTodoist();

  const activeTasks = tasks.filter((task) => !task.is_completed);
  const completedTasks = tasks.filter((task) => task.is_completed);

  const isOverdue = (task: {
    due?: { date: string };
    is_completed: boolean;
  }) => {
    if (task.is_completed || !task.due) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Parse date in local timezone instead of UTC
    const [year, month, day] = task.due.date.split('-').map(Number);
    const dueDate = new Date(year, month - 1, day); // month is 0-indexed
    dueDate.setHours(0, 0, 0, 0);

    return dueDate < today;
  };

  if (isLoading) {
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
          <p className="text-sm mb-4">{error.message}</p>
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
        icon={<Faxcover108 variant="16x16_4" className="!w-[24px] !h-[24px]" />}
        className="text-[20px] h-[28px]"
        title={`Tarefas de hoje (${completedTasks.length}/${tasks.length})`}
      />
      {/* Main Content */}
      <Frame
        p="$6"
        className="h-full flex flex-col overflow-y-auto"
        variant="window"
      >
        {tasks.length === 0 ? (
          <div className="text-sm text-center py-9">
            <p>Sem tarefas</p>
          </div>
        ) : (
          <>
            {tasks.length > 0 && (
              <Fieldset
                className="[&>legend]:text-[0.5rem] mb-4 h-full"
                legend="Tarefas"
              >
                <Frame display="flex" flexDirection="column">
                  {[...completedTasks, ...activeTasks].map((task) => (
                    <Frame position="relative" key={task.id}>
                      <Checkbox
                        className="text-xs h-4 [&>*:nth-child(-n+2)]:w-3 [&>*:nth-child(-n+2)]:h-3 [&>*:nth-child(3)]:p-2 [&>*:nth-child(2)]:!bg-[length:12px]"
                        checked={task.is_completed}
                        disabled={task.is_completed}
                        readOnly
                      >
                        {task.content}
                      </Checkbox>

                      {task.description && (
                        <p className="text-[0.5rem] text-gray-600 ml-5 mt-0 ">
                          {task.description}
                        </p>
                      )}

                      {isOverdue(task) && (
                        <Frame
                          display="flex"
                          gap="$4"
                          className="text-[0.5rem] ml-[0.9rem] -mt-1 font-semibold"
                        >
                          <Joy108 variant="16x16_4" />
                          <span className="text-[0.4rem] text-red-800">
                            Atrasada desde {task.due?.string}
                          </span>
                        </Frame>
                      )}
                    </Frame>
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
