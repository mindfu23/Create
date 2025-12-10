import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import { CreatecampHome } from "@/pages/CreatecampHome";
import { JournalPage } from "@/pages/JournalPage";
import { ProjectsPage } from "@/pages/ProjectsPage";
import { TodoPage } from "@/pages/TodoPage";
import { SharePage } from "@/pages/SharePage";

function Router() {
  return (
    <Switch>
      {/* Add pages below */}
      <Route path="/" component={CreatecampHome} />
      <Route path="/journal" component={JournalPage} />
      <Route path="/projects" component={ProjectsPage} />
      <Route path="/todo" component={TodoPage} />
      <Route path="/share" component={SharePage} />
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
