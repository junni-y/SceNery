import Dexie, { Table } from 'dexie';
import { Project, AppSettings } from '../types';

export class StoryboardDB extends Dexie {
  projects!: Table<Project, string>;
  settings!: Table<{ id: string; value: AppSettings }, string>;

  constructor() {
    super('StoryboardProDB');
    this.version(1).stores({
      projects: 'id, name, updatedAt, createdAt',
      settings: 'id'
    });
  }
}

export const db = new StoryboardDB();

export const DEFAULT_SETTINGS: AppSettings = {
  shortcuts: {
    undo: 'Ctrl+z',
    redo: 'Ctrl+y',
    save: 'Ctrl+s',
    delete: 'Delete',
    selectAll: 'Ctrl+a',
    confirmEdit: 'Ctrl+Enter',
    toggleGrid: "Ctrl+'"
  },
  defaultAspectRatio: '16:9'
};