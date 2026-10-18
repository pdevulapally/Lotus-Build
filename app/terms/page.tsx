import { LegalContentDocument } from "@/components/content/legal-document"
import { termsOfService } from "@/lib/legal/terms"

export default function TermsPage() {
  return <LegalContentDocument content={termsOfService} />
}
