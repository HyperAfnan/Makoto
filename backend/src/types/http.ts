import type { AnalysisRequest } from "./shared.js";

export type ValidationResult = { value?: AnalysisRequest; error?: string };
export type StatusSender = (message: string) => void;
