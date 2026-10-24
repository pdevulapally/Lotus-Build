import { MetadataRoute } from "next"

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://lotus-build.app"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/tasks", "/project/", "/computer/", "/settings", "/verify-email"],
      },
      {
        userAgent: "Googlebot",
        allow: "/",
        disallow: ["/tasks", "/project/", "/computer/", "/settings", "/verify-email"],
      },
      {
        userAgent: "Bingbot",
        allow: "/",
        disallow: ["/tasks", "/project/", "/computer/", "/settings", "/verify-email"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  }
}
