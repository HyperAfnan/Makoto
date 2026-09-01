import type { ApiSettings } from "./shared";

const form = document.querySelector<HTMLFormElement>("#settings");
const status = document.querySelector<HTMLElement>("#status");

const setStatus = (message: string) => {
	if (status) status.textContent = message;
};

const setSearchProvider = (provider?: "google" | "brave" | "tavily") => {
	const braveCheckbox = document.querySelector<HTMLInputElement>("#useBrave");
	const tavilyCheckbox = document.querySelector<HTMLInputElement>("#useTavily");
	if (braveCheckbox) braveCheckbox.checked = provider === "brave";
	if (tavilyCheckbox) tavilyCheckbox.checked = provider === "tavily";
};

chrome.storage.local.get("apiSettings", ({ apiSettings }: { apiSettings?: ApiSettings }) => {
	if (!apiSettings) return setSearchProvider("brave");
	const fields = ["geminiApiKey", "braveApiKey", "tavilyApiKey", "geminiModel", "maxSources"] as const;
	for (const field of fields) {
		const el = document.querySelector<HTMLInputElement | HTMLSelectElement>(`#${field}`);
		if (el && apiSettings[field] !== undefined) {
			el.value = String(apiSettings[field]);
		}
	}
	setSearchProvider(apiSettings.searchProvider || "brave");
});

for (const id of ["useBrave", "useTavily"]) {
	const el = document.querySelector<HTMLInputElement>(`#${id}`);
	el?.addEventListener("change", (event) => {
		const target = event.target as HTMLInputElement;
		if (target.checked) {
			setSearchProvider(id === "useBrave" ? "brave" : "tavily");
		} else {
			target.checked = true;
		}
	});
}

const setVisible = (id: string, visible: boolean) => {
	const input = document.querySelector<HTMLInputElement>(`#${id}`);
	if (input) input.type = visible ? "text" : "password";
	const button = document.querySelector<HTMLButtonElement>(`[data-target="${id}"]`);
	if (button) {
		const open = button.querySelector<SVGElement>(".eye-open");
		const off = button.querySelector<SVGElement>(".eye-off");
		if (open) open.style.display = visible ? "none" : "block";
		if (off) off.style.display = visible ? "block" : "none";
	}
};

for (const button of document.querySelectorAll<HTMLButtonElement>("[data-target]")) {
	button.addEventListener("click", () => {
		const targetId = button.dataset.target;
		if (!targetId) return;
		const input = document.querySelector<HTMLInputElement>(`#${targetId}`);
		if (input) {
			setVisible(targetId, input.type === "password");
		}
	});
}

document.querySelector<HTMLInputElement>("#showKeys")?.addEventListener("change", (event) => {
	const checked = (event.target as HTMLInputElement).checked;
	for (const id of ["geminiApiKey", "braveApiKey", "tavilyApiKey"]) {
		setVisible(id, checked);
	}
});

form?.addEventListener("submit", async (event) => {
	event.preventDefault();
	const useBrave = document.querySelector<HTMLInputElement>("#useBrave")?.checked;
	const geminiApiKey = document.querySelector<HTMLInputElement>("#geminiApiKey")?.value.trim() ?? "";
	const braveApiKey = document.querySelector<HTMLInputElement>("#braveApiKey")?.value.trim() ?? "";
	const tavilyApiKey = document.querySelector<HTMLInputElement>("#tavilyApiKey")?.value.trim() ?? "";
	const geminiModel = document.querySelector<HTMLSelectElement>("#geminiModel")?.value ?? "gemini-2.0-flash";
	const maxSources = Number(document.querySelector<HTMLInputElement>("#maxSources")?.value) || 5;

	const settings: ApiSettings = {
		searchProvider: useBrave ? "brave" : "tavily",
		geminiApiKey,
		braveApiKey,
		tavilyApiKey,
		geminiModel,
		maxSources,
	};

	await chrome.storage.local.set({ apiSettings: settings });
	setStatus("Settings saved.");
});

document.querySelector<HTMLButtonElement>("#clear")?.addEventListener("click", async () => {
	for (const id of ["geminiApiKey", "braveApiKey", "tavilyApiKey"]) {
		const el = document.querySelector<HTMLInputElement>(`#${id}`);
		if (el) el.value = "";
	}
	await chrome.storage.local.remove("apiSettings");
	setStatus("API keys cleared.");
});
