import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	// AGENTS.md is this repository's agent map; Next.js must not rewrite it.
	agentRules: false,
	poweredByHeader: false,
	reactStrictMode: true,
	typedRoutes: true,
};

export default nextConfig;
