import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { Project, AppSettings } from '../types';
import { db, DEFAULT_SETTINGS } from '../db/database';
import { createNewProject } from '../utils/projectFactory';

interface ProjectListState {
  projects: Project[];
  searchQuery: string;
  selectedIds: string[];
  settings: AppSettings;
  isLoading: boolean;

  loadProjects: () => Promise<void>;
  setSearchQuery: (q: string) => void;
  toggleSelect: (id: string, multi: boolean) => void;
  selectAll: () => void;
  clearSelection: () => void;
  setSelection: (ids: string[]) => void;

  createProject: (name?: string) => Promise<Project>;
  deleteProjects: (ids: string[]) => Promise<void>;
  duplicateProjects: (ids: string[]) => Promise<void>;
  renameProject: (id: string, name: string) => Promise<void>;
  setProjectCover: (id: string, coverBase64: string) => Promise<void>;
  importProjectSB: (project: Project) => Promise<void>;
  updateSettings: (settings: AppSettings) => Promise<void>;
}

export const useProjectListStore = create<ProjectListState>((set, get) => ({
  projects: [],
  searchQuery: '',
  selectedIds: [],
  settings: DEFAULT_SETTINGS,
  isLoading: true,

  loadProjects: async () => {
    set({ isLoading: true });
    const list = await db.projects.orderBy('updatedAt').reverse().toArray();
    const savedSettings = await db.settings.get('app-settings');
    set({
      projects: list,
      settings: savedSettings?.value || DEFAULT_SETTINGS,
      isLoading: false
    });
  },

  setSearchQuery: (q) => set({ searchQuery: q }),

  toggleSelect: (id, multi) => {
    const { selectedIds } = get();
    if (!multi) {
      set({ selectedIds: [id] });
      return;
    }
    if (selectedIds.includes(id)) {
      set({ selectedIds: selectedIds.filter(item => item !== id) });
    } else {
      set({ selectedIds: [...selectedIds, id] });
    }
  },

  selectAll: () => {
    const { projects, searchQuery } = get();
    const filtered = projects.filter(p =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    set({ selectedIds: filtered.map(p => p.id) });
  },

  clearSelection: () => set({ selectedIds: [] }),
  setSelection: (ids) => set({ selectedIds: ids }),

  createProject: async (name) => {
    const project = createNewProject(name);
    await db.projects.add(project);
    await get().loadProjects();
    return project;
  },

  deleteProjects: async (ids) => {
    await db.projects.bulkDelete(ids);
    set({ selectedIds: [] });
    await get().loadProjects();
  },

  duplicateProjects: async (ids) => {
    const { projects } = get();
    const copies: Project[] = [];
    for (const id of ids) {
      const orig = projects.find(p => p.id === id);
      if (orig) {
        copies.push({
          ...JSON.parse(JSON.stringify(orig)),
          id: uuidv4(),
          name: `${orig.name}-副本`,
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
      }
    }
    await db.projects.bulkAdd(copies);
    set({ selectedIds: [] });
    await get().loadProjects();
  },

  renameProject: async (id, name) => {
    await db.projects.update(id, { name, updatedAt: Date.now() });
    await get().loadProjects();
  },

  setProjectCover: async (id, coverBase64) => {
    await db.projects.update(id, { coverImage: coverBase64, updatedAt: Date.now() });
    await get().loadProjects();
  },

  importProjectSB: async (project) => {
    const imported: Project = {
      ...project,
      id: uuidv4(),
      name: `${project.name} (导入)`,
      updatedAt: Date.now()
    };
    await db.projects.add(imported);
    await get().loadProjects();
  },

  updateSettings: async (settings) => {
    await db.settings.put({ id: 'app-settings', value: settings });
    set({ settings });
  }
}));