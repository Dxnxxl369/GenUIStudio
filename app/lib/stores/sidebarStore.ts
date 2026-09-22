import { atom } from 'nanostores';

export const isSidebarOpen = atom<boolean>(false);

export function toggleSidebar() {
  const next = !isSidebarOpen.get();
  isSidebarOpen.set(next);
  if (typeof document !== 'undefined') {
    document.documentElement.style.setProperty('--sidebar-width', next ? '340px' : '0px');
  }
}

export function setSidebarOpen(open: boolean) {
  isSidebarOpen.set(open);
  if (typeof document !== 'undefined') {
    document.documentElement.style.setProperty('--sidebar-width', open ? '340px' : '0px');
  }
}
