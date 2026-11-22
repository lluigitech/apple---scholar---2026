import TaskAssignmentBoard from './TaskAssignment/TaskAssignmentBoard';

const OfficerTaskAssignment = () => {
  return (
    <TaskAssignmentBoard
      title="Task Progress"
      subtitle="Track assigned requirements and review scholar submission progress"
      role="Officer"
      storageKey="officer-task-board"
      canManageTasks={false}
    />
  );
};

export default OfficerTaskAssignment;
