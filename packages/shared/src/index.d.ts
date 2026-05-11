// Type declarations for @todo/shared. The runtime values live in index.js.

export type Todo = {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateTodoInput = {
  title: string;
};

export type UpdateTodoInput = {
  title?: string;
  completed?: boolean;
};

export declare const TODO_TITLE_MAX = 200;
