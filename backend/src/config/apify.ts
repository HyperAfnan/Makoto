import { ApifyClient } from "apify-client";
import { env } from "./env.js";

export function getApifyClient(token?: string): ApifyClient {
	return new ApifyClient({
		token: token || env.APIFY_API_TOKEN,
	});
}

export const client = getApifyClient();
