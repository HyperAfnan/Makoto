import type { AnalysisRequest } from "@context/shared";

export type ValidationResult = { value?: AnalysisRequest; error?: string };
export type StatusSender = (message: string) => void;
