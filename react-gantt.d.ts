/**
 * @file react-gantt.d.ts
 * @description Dichiarazione di tipo ambiente per il modulo @svar-widgets/react-gantt.
 * Questo file informa il compilatore TypeScript della struttura del modulo,
 * permettendo l'importazione con type-checking completo.
 */

declare module '@svar-widgets/react-gantt' {
  import React from 'react';

  /**
   * @interface Task
   * @description Rappresenta un singolo task nel diagramma di Gantt.
   */
  export interface Task {
    id: string;
    name: string;
    start: Date;
    end: Date;
    type: 'task' | 'milestone' | 'project';
    progress?: number;
    dependencies?: string[];
    description?: string;
  }

  /**
   * @interface GanttProps
   * @description Prop per il componente Gantt.
   */
  export interface GanttProps {
    tasks: Task[];
    viewMode?: 'day' | 'week' | 'month' | 'quarter' | 'year';
    listCellWidth?: string;
    ganttHeight?: number;
    columnWidth?: number;
    locale?: string;
    todayColor?: string;
  }

  const Gantt: React.FC<GanttProps>;
  export default Gantt;
}
