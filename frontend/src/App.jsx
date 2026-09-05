import './App.css';
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import ProjectDetails from "./pages/ProjectDetails";

function App() {
  return (
    <BrowserRouter>

      <main style={{ minHeight: "calc(100vh - 120px)" }}>
        {/* 100vh minus header + footer height to push footer down */}
        <Routes>
  <Route
    path="/"
    element={<Home />}
  />

  <Route
    path="/project/:projectId"
    element={<ProjectDetails />}
  />

  <Route
    path="/analysis/:analysisRunId"
    element={<ProjectDetails />}
  />
</Routes>
      </main>

      
    </BrowserRouter>
  );
}

export default App;