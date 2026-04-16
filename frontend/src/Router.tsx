import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/home";
import Recordings from "./pages/recordings";
import Editor from "./pages/editor";
import Settings from "./pages/settings";
import WindowTitlebar from "./components/window-titlebar";
import WindowResizeGrips from "./components/window-resize-grips";

const App = () => {
  return (
    <BrowserRouter>
      <div className="relative flex h-dvh min-h-screen flex-col bg-background text-foreground">
        <WindowResizeGrips />
        <WindowTitlebar />
        <main className="flex min-h-0 flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/recordings" element={<Recordings />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/editor" element={<Editor />} />
            <Route path="/editor/:address" element={<Editor />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
};

export default App;
