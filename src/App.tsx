import React, { useState } from 'react';
import { ProjectHomePage } from './pages/ProjectHomePage';
import { ProjectPage } from './pages/ProjectPage';

export function App() {
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  if (activeProjectId) {
    return (
      <ProjectPage
        projectId={activeProjectId}
        onBack={() => setActiveProjectId(null)}
      />
    );
  }

  return <ProjectHomePage onOpenProject={id => setActiveProjectId(id)} />;
}

export default App;