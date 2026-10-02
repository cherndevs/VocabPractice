import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { startGradeSync } from "./lib/grade-sync";

startGradeSync();

createRoot(document.getElementById("root")!).render(<App />);
