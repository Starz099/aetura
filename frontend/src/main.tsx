import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./Router.tsx";

const storedTheme = localStorage.getItem("theme");
if (storedTheme === "dark") {
	document.documentElement.classList.add("dark");
} else {
	document.documentElement.classList.remove("dark");
}

createRoot(document.getElementById("root")!).render(<App />);
