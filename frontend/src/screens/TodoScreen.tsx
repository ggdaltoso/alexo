import { useTodoist } from '../hooks/useTodoist';
import { Frame, TitleBar, Checkbox } from '@react95/core';
import { Faxcover108 } from '@react95/icons/Faxcover108';
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
      <div className="flex justify-center items-center h-full">
        <div>Erro ao carregar tarefas</div>
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
        icon={<Faxcover108 variant="16x16_4" />}
        title={`Tarefas de hoje (${completedTasks.length}/${tasks.length})`}
      />
      {/* Main Content */}
      <Frame
        p="$2"
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
              <Frame pl="$5" boxShadow="$in" h="100%">
                <Frame display="flex" flexDirection="column">
                  {[...completedTasks, ...activeTasks].map((task) => (
                    <Frame position="relative" key={task.id}>
                      <Checkbox
                        className="text-[0.45rem] h-2 [&>*:nth-child(-n+2)]:w-2 [&>*:nth-child(-n+2)]:h-2 [&>*:nth-child(3)]:p-1 [&>*:nth-child(2)]:!bg-[length:8px]"
                        checked={task.is_completed}
                        disabled={task.is_completed}
                        readOnly
                      >
                        {task.content}
                      </Checkbox>

                      {task.description && (
                        <p className="text-[0.35rem] text-gray-600 ml-3.5 mt-0 ">
                          {task.description}
                        </p>
                      )}

                      {isOverdue(task) && (
                        <Frame
                          display="flex"
                          alignItems="center"
                          gap="$4"
                          className="text-[0.3rem] ml-[0.7rem]  font-semibold"
                        >
                          <Joy108
                            variant="16x16_4"
                            className="-mt-[0.125rem]"
                          />
                          <span className="text-red-800">
                            Atrasada ({task.due?.string})
                          </span>
                        </Frame>
                      )}
                    </Frame>
                  ))}
                </Frame>
              </Frame>
            )}
          </>
        )}
      </Frame>
    </Frame>
  );
}
