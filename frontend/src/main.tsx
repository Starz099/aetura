import { createRoot } from "react-dom/client";
import { invoke } from "@tauri-apps/api/core";
import "./index.css";
import App from "./Router.tsx";
import { configureApiClient } from "@/services/api/client";

const storedTheme = localStorage.getItem("theme");
if (storedTheme === "dark") {
	document.documentElement.classList.add("dark");
} else {
	document.documentElement.classList.remove("dark");
}

async function bootstrap() {
	await configureApiClient(() => invoke<number>("get_engine_port"));

	createRoot(document.getElementById("root")!).render(<App />);
}

void bootstrap();
