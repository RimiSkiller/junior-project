'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { updateTaskPosition, deleteTask } from '@/app/actions/task';
import { getUserRole } from '@/app/actions/member';
import AddTaskForm from '@/components/AddTaskForm';
import AddColumnForm from '@/components/AddColumnForm';
import DeleteColumnButton from '@/components/DeleteColumnButton';
import EditTaskModal from '@/components/EditTaskModal';
import ShareProjectModal from '@/components/ShareProjectModal';
import { checkPermission } from '@/lib/permissions';
import { useTaskRisk } from '@/hooks/useTaskRisk';
import RiskBadge from '@/components/RiskBadge';

// Wrapper to display risk badge for individual task cards
function TaskRiskBadge({ task }) {
  const { risk, loading } = useTaskRisk(task);

  // Only show for tasks with deadlines
  if (!task.deadline) return null;

  if (loading) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full
                       bg-gray-100 text-gray-400 text-xs border border-gray-200">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-pulse" />
        Analyzing...
      </span>
    );
  }

  if (!risk) return null;

  return (
    <RiskBadge
      riskLevel={risk.risk_level}
      score={risk.risk_score}
      reason={risk.reason}
      suggestions={risk.suggestions}
    />
  );
}

export default function BoardClient({ project, initialTasks, initialColumns }) {
  const [tasks, setTasks] = useState(initialTasks);
  const [columns, setColumns] = useState(initialColumns);
  const [deletingTaskId, setDeletingTaskId] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [userRole, setUserRole] = useState('owner');
  const portalRef = useRef(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const canManageColumns = checkPermission('manage_columns', userRole);
  const canCreateTasks = checkPermission('create_tasks', userRole);
  const canEditTasks = checkPermission('edit_tasks', userRole);
  const canDeleteTasks = checkPermission('delete_tasks', userRole);
  const canInviteMembers = checkPermission('invite_members', userRole);

  useEffect(() => {
    async function loadUserRole() {
      const role = await getUserRole(project.id);
      setUserRole(role || 'owner');
    }
    loadUserRole();
  }, [project.id]);

  useEffect(() => {
    const div = document.createElement('div');
    div.style.position = 'absolute';
    div.style.pointerEvents = 'none';
    div.style.top = '0';
    div.style.left = '0';
    div.style.width = '100%';
    div.style.height = '100%';
    div.style.zIndex = '9999';
    document.body.appendChild(div);
    portalRef.current = div;

    return () => {
      document.body.removeChild(div);
    };
  }, []);

  const columnMap = useMemo(() => {
    const map = {};
    columns.forEach((col) => {
      map[col.key] = { ...col, tasks: [] };
    });
    tasks.forEach((t) => {
      const col = map[t.column];
      if (!col) return;
      col.tasks.push(t);
    });
    Object.values(map).forEach((col) => {
      col.tasks.sort((a, b) => a.order - b.order);
    });
    return map;
  }, [columns, tasks]);

  const orderedColumnKeys = useMemo(
    () => columns.sort((a, b) => a.order - b.order).map((c) => c.key),
    [columns]
  );
  //deadline
  function isOverdue(deadline) {
    if (!deadline) return false;
    return new Date(deadline) < new Date();
  }

  function formatDeadline(deadline) {
    if (!deadline) return null;
    const date = new Date(deadline);
    const today = new Date();
    const diffTime = date - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'Overdue';
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  //drag and drop
  async function onDragEnd(result) {
    const { destination, source, draggableId, type } = result;
    if (!destination) return;

    if (destination.droppableId === source.droppableId && destination.index === source.index) {
      return;
    }
    // Drag Column
    if (type === 'COLUMN') {
      const newColumnOrder = Array.from(orderedColumnKeys);
      newColumnOrder.splice(source.index, 1);
      newColumnOrder.splice(destination.index, 0, draggableId);
      const updatedColumns = columns.map((col) => {
        const newIndex = newColumnOrder.indexOf(col.key);
        return { ...col, order: newIndex };
      });
      setColumns(updatedColumns);
      return;
    }

    const startKey = source.droppableId;
    const finishKey = destination.droppableId;
    let updatedTasks = tasks;
    // Drag Task inside col
    if (startKey === finishKey) {
      const colTasks = columnMap[startKey].tasks.slice();
      const [moved] = colTasks.splice(source.index, 1);
      colTasks.splice(destination.index, 0, moved);
      updatedTasks = tasks.map((task) => {
        if (task.column !== startKey) return task;
        const idx = colTasks.findIndex((t) => t.id === task.id);
        return { ...task, order: idx };
      });
      setTasks(updatedTasks);
      // Drag Task to another col
    } else {
      const startTasks = columnMap[startKey].tasks.slice();
      const finishTasks = columnMap[finishKey].tasks.slice();
      const [moved] = startTasks.splice(source.index, 1);
      moved.column = finishKey;
      finishTasks.splice(destination.index, 0, moved);
      updatedTasks = tasks.map((task) => {
        if (task.id === draggableId) return { ...task, column: finishKey };
        if (task.column === startKey) {
          const idx = startTasks.findIndex((t) => t.id === task.id);
          return { ...task, order: idx };
        }
        if (task.column === finishKey) {
          const idx = finishTasks.findIndex((t) => t.id === task.id);
          return { ...task, order: idx };
        }
        return task;
      });
      setTasks(updatedTasks);
    }
    // save in database
    const movedTask = updatedTasks.find((t) => t.id === draggableId);
    if (movedTask) {
      updateTaskPosition({
        taskId: movedTask.id,
        projectId: project.id,
        column: movedTask.column,
        order: movedTask.order,
      });
    }
  }

  function handleTaskCreated(newTask) {
    setTasks((prev) => [...prev, newTask]);
  }

  function handleColumnCreated(newColumn) {
    setColumns((prev) => [...prev, newColumn]);
  }

  function handleColumnDeleted(columnId) {
    setColumns((prev) => prev.filter((col) => col.id !== columnId));
  }

  async function handleDeleteTask(taskId) {
    if (!confirm('Delete this task?')) return;
    setDeletingTaskId(taskId);
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    const result = await deleteTask(taskId, project.id);
    if (result?.error) {
      alert(result.error);
      setDeletingTaskId(null);
    }
  }

  function handleTaskClick(task) {
    setEditingTask({ ...task, projectId: project.id });
  }

  function handleTaskUpdated(updatedTask) {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === updatedTask.id ? { ...t, ...updatedTask, deadline: updatedTask.deadline } : t
      )
    );
  }

  if (!isMounted) return null;

  return (
    <>
      {/* Premium Background */}
      <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-[#3d348b] via-[#5b4fa3] to-[#1a1640]">
        {/* Animated background orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#78e0dc] rounded-full mix-blend-screen filter blur-[120px] opacity-20 animate-float"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#ff8d4c] rounded-full mix-blend-screen filter blur-[120px] opacity-15 animate-float-delayed"></div>
          <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-[#78e0dc] rounded-full mix-blend-screen filter blur-[120px] opacity-10 animate-pulse-slow"></div>
        </div>

        {/* Grid pattern overlay */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjAzIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-30"></div>

        {/* Premium Header */}
        <header className="relative z-20 border-b border-white/10 backdrop-blur-xl bg-white/5 sticky top-0">
          <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 sm:px-8 lg:px-10">
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="group flex items-center gap-2 rounded-xl px-4 py-2 text-white/70 hover:text-white hover:bg-white/10 transition-all duration-300"
              >
                <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="font-semibold">Back</span>
              </Link>

              <div className="relative w-12 h-12">
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-[#78e0dc] to-[#ff8d4c] animate-spin-slow opacity-80"></div>
                <div className="absolute inset-[2px] rounded-xl bg-gradient-to-br from-[#3d348b] to-[#1a1640] flex items-center justify-center">
                  <svg className="w-6 h-6 text-[#78e0dc]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>

              <div>
                <h1 className="text-xl font-black text-white tracking-tight">{project.title}</h1>
                <p className="text-xs text-white/60 font-medium">Project Workspace</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Team Insights Link */}
              <Link
                href={`/dashboard/project/${project.id}/team-insights`}
                className="group/button relative overflow-hidden rounded-xl transition-all duration-300 hover:scale-105"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-[#ff8d4c] to-[#ff6b2b]"></div>
                <div className="relative px-5 py-2.5 flex items-center gap-2">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <span className="text-sm font-black text-white">Team Insights</span>
                </div>
              </Link>

              {canInviteMembers && (
                <button
                  onClick={() => setShowShareModal(true)}
                  className="group/button relative overflow-hidden rounded-xl transition-all duration-300 hover:scale-105"
                >
                <div className="absolute inset-0 bg-gradient-to-r from-[#78e0dc] to-[#5bcac6]"></div>
                <div className="relative px-5 py-2.5 flex items-center gap-2">
                  <svg className="w-4 h-4 text-[#3d348b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  <span className="text-sm font-black text-[#3d348b]">Share</span>
                </div>
              </button>
              )}
          </div>
          </div>
        </header>

        {/* Board Container */}
        <div className="relative z-10 overflow-x-auto p-6">
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="all-columns" direction="horizontal" type="COLUMN">
              {(provided) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="flex items-start gap-6 pb-6"
                >
                  {orderedColumnKeys.map((key, index) => {
                    const col = columnMap[key];
                    if (!col) return null;
                    const showAdd = col.key === 'todo';

                    return (
                      <Draggable key={col.id} draggableId={col.key} index={index} isDragDisabled={!canManageColumns}>
                        {(columnProvided, columnSnapshot) => {
                          const columnElement = (
                            <div
                              ref={columnProvided.innerRef}
                              {...columnProvided.draggableProps}
                              style={{
                                ...columnProvided.draggableProps.style,
                              }}
                              className={`w-80 shrink-0 group/column animate-fade-in-up ${columnSnapshot.isDragging ? 'scale-105 rotate-2' : ''
                                }`}
                            >
                              {/* Glass Column */}
                              <div className="relative">
                                <div className={`absolute -inset-[1px] bg-gradient-to-b from-white/30 to-white/10 rounded-2xl blur-sm transition-opacity duration-300 ${columnSnapshot.isDragging ? 'opacity-100' : 'opacity-0 group-hover/column:opacity-100'}`}></div>

                                <div className="relative bg-gradient-to-br from-white/[0.15] to-white/[0.05] backdrop-blur-xl rounded-2xl border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.2)] overflow-hidden">
                                  {/* Shimmer effect */}
                                  <div className="absolute inset-0 -translate-x-full group-hover/column:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>

                                  {/* Column Header - DRAG HANDLE */}
                                  <div
                                    {...columnProvided.dragHandleProps}
                                    className="relative z-10 p-4 flex justify-between items-center border-b border-white/10 cursor-grab active:cursor-grabbing group/header"
                                  >
                                    <div className="flex items-center gap-2">
                                      {/* Drag Icon */}
                                      <svg className="w-4 h-4 text-white/40 group-hover/header:text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                                      </svg>
                                      {/* Column Name in ORANGE */}
                                      <h3 className="text-lg font-black text-[#ff8d4c]">{col.title}</h3>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="px-2.5 py-1 rounded-full bg-[#ff8d4c]/20 text-xs font-bold text-[#ff8d4c] backdrop-blur-sm border border-[#ff8d4c]/30">
                                        {col.tasks.length}
                                      </span>
                                      {canManageColumns && (
                                        <DeleteColumnButton
                                          columnId={col.id}
                                          projectId={project.id}
                                          columnTitle={col.title}
                                          onDeleted={handleColumnDeleted}
                                        />
                                      )}
                                    </div>
                                  </div>

                                  {/* Tasks Area */}
                                  <Droppable droppableId={col.key} type="TASK">
                                    {(provided, snapshot) => (
                                      <div
                                        ref={provided.innerRef}
                                        {...provided.droppableProps}
                                        className={`relative z-10 p-3 space-y-3 min-h-[200px] transition-colors duration-300 ${snapshot.isDraggingOver ? 'bg-[#78e0dc]/10' : ''
                                          }`}
                                      >
                                        {col.tasks.map((task, taskIndex) => (
                                          <Draggable key={task.id} draggableId={task.id} index={taskIndex} isDragDisabled={!canEditTasks}>
                                            {(dragProvided, dragSnapshot) => {
                                              const taskElement = (
                                                <div
                                                  ref={dragProvided.innerRef}
                                                  {...dragProvided.draggableProps}
                                                  {...dragProvided.dragHandleProps}
                                                  style={{
                                                    ...dragProvided.draggableProps.style,
                                                  }}
                                                  onClick={() => canEditTasks && !dragSnapshot.isDragging && handleTaskClick(task)}
                                                  className="group/task relative"
                                                >
                                                  {/* Task Card Glow */}
                                                  <div className={`absolute -inset-[1px] bg-gradient-to-r from-[#78e0dc]/50 to-[#ff8d4c]/50 rounded-xl opacity-0 group-hover/task:opacity-100 blur transition-opacity duration-300 ${dragSnapshot.isDragging ? 'opacity-100' : ''}`}></div>

                                                  {/* Task Card */}
                                                  <div className={`relative bg-gradient-to-br from-white/20 to-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-4 cursor-pointer transition-all duration-300 hover:scale-[1.02] ${dragSnapshot.isDragging ? 'scale-105 shadow-[0_20px_40px_rgba(120,224,220,0.3)] rotate-3' : 'shadow-lg'
                                                    }`}>
                                                    {canDeleteTasks && (
                                                      <button
                                                        onPointerDown={(e) => {
                                                        e.stopPropagation();
                                                        e.preventDefault();
                                                        handleDeleteTask(task.id);
                                                      }}
                                                      disabled={deletingTaskId === task.id}
                                                      className="absolute top-2 right-2 opacity-0 group-hover/task:opacity-100 rounded-lg p-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 hover:text-red-200 transition-all duration-300 disabled:opacity-50"
                                                    >
                                                      {deletingTaskId === task.id ? (
                                                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                        </svg>
                                                      ) : (
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                        </svg>
                                                        )}
                                                      </button>
                                                    )}

                                                    {/* Task Title in TEAL */}
                                                    <div className="font-bold text-[#78e0dc] pr-8 mb-1">{task.title}</div>
                                                    
                                                    {/* Show assignee initials avatar if task is assigned */}
                                                    {task.assignedTo && task.assigneeName && (
                                                      <div className="flex items-center gap-1 mt-1.5 mb-2">
                                                        <div className="w-5 h-5 rounded-full bg-[#78e0dc]/20 text-[#78e0dc] text-xs
                                                                        font-bold flex items-center justify-center">
                                                          {task.assigneeName.charAt(0).toUpperCase()}
                                                        </div>
                                                        <span className="text-xs text-white/60 font-medium">{task.assigneeName}</span>
                                                      </div>
                                                    )}

                                                    {task.description && (
                                                      <div className="text-xs text-white/70 line-clamp-2 mb-2">{task.description}</div>
                                                    )}

                                                    {/* Deadline Badge */}
                                                    {task.deadline && (
                                                      <div className="mt-3 flex items-center gap-2 flex-wrap">
                                                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold backdrop-blur-sm ${isOverdue(task.deadline)
                                                          ? 'bg-red-500/20 text-red-200 border border-red-400/30'
                                                          : 'bg-blue-500/20 text-blue-200 border border-blue-400/30'
                                                          }`}>
                                                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                          </svg>
                                                          {formatDeadline(task.deadline)}
                                                        </span>
                                                        {/* AI Risk Badge */}
                                                        <TaskRiskBadge task={task} />
                                                      </div>
                                                    )}
                                                  </div>
                                                </div>
                                              );

                                              if (dragSnapshot.isDragging && portalRef.current) {
                                                return createPortal(taskElement, portalRef.current);
                                              }

                                              return taskElement;
                                            }}
                                          </Draggable>
                                        ))}

                                        {provided.placeholder}

                                        {showAdd && canCreateTasks && (
                                          <div className="pt-2">
                                            <AddTaskForm
                                              projectId={project.id}
                                              column={col.key}
                                              onCreated={handleTaskCreated}
                                            />
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </Droppable>
                                </div>
                              </div>
                            </div>
                          );

                          if (columnSnapshot.isDragging && portalRef.current) {
                            return createPortal(columnElement, portalRef.current);
                          }

                          return columnElement;
                        }}
                      </Draggable>
                    );
                  })}

                  {provided.placeholder}

                  {canManageColumns && (
                    <div className="shrink-0">
                      <AddColumnForm projectId={project.id} onCreated={handleColumnCreated} />
                    </div>
                  )}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </div>
      </div>

      {/* Modals */}
      {editingTask && (
        <EditTaskModal
          task={editingTask}
          userRole={userRole}
          onClose={() => setEditingTask(null)}
          onUpdated={handleTaskUpdated}
        />
      )}

      {showShareModal && (
        <ShareProjectModal
          projectId={project.id}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </>
  );
}
