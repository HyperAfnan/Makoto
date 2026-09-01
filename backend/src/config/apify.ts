import { ApifyClient } from "apify-client";
import { env } from "./env";

export const client = new ApifyClient({
	token: env.APIFY_API_TOKEN,
});
