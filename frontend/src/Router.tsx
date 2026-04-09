import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/home";
import Navbar from "./components/navbar/index";
import Recordings from "./pages/recordings";
import Editor from "./pages/editor";

const App = () => {
  return (
    <div>
      <BrowserRouter>
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/recordings" element={<Recordings />} />
          <Route path="/editor" element={<Editor />} />
          <Route path="/editor/:address" element={<Editor />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
};

export default App;
