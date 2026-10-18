import { LegalContentDocument } from "@/components/content/legal-document"
import { privacyPolicy } from "@/lib/legal/privacy"

export default function PrivacyPage() {
  return <LegalContentDocument content={privacyPolicy} />
}
