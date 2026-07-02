// Client-safe: no server imports. Single source of truth for contact form
// validation — the form component and /api/contact both parse with this schema,
// and the topic list is derived from the site's support areas so the form can
// never drift from the support section content.
import { z } from "zod"
import { lotusBuildSupportAreas } from "@/lib/lotus-build-site-content"

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export const CONTACT_TOPICS = lotusBuildSupportAreas.map((area) => ({
  value: slugify(area.title),
  label: area.title,
  description: area.description,
}))

const topicValues = CONTACT_TOPICS.map((topic) => topic.value) as [string, ...string[]]

export const CONTACT_FIELD_LIMITS = {
  name: { min: 2, max: 80 },
  email: { min: 5, max: 254 },
  message: { min: 20, max: 4000 },
} as const

export const contactFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(CONTACT_FIELD_LIMITS.name.min, "Enter your name.")
    .max(CONTACT_FIELD_LIMITS.name.max, `Keep your name under ${CONTACT_FIELD_LIMITS.name.max} characters.`),
  email: z
    .string()
    .trim()
    .min(CONTACT_FIELD_LIMITS.email.min, "Enter your email address.")
    .max(CONTACT_FIELD_LIMITS.email.max, "Email address is too long.")
    .pipe(z.email("Enter a valid email address.")),
  topic: z.enum(topicValues, "Choose a topic."),
  message: z
    .string()
    .trim()
    .min(CONTACT_FIELD_LIMITS.message.min, `Tell us a bit more — at least ${CONTACT_FIELD_LIMITS.message.min} characters.`)
    .max(CONTACT_FIELD_LIMITS.message.max, `Keep your message under ${CONTACT_FIELD_LIMITS.message.max} characters.`),
})

export type ContactFormValues = z.infer<typeof contactFormSchema>
