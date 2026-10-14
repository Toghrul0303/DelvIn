import type { Metadata } from 'next'
import Link from 'next/link'
import { ContactLink, LegalDocument, LegalSection } from '@/components/legal-document'

export const metadata: Metadata = {
  title: 'Terms of Service — DelvIn',
  description: 'Terms of Service for DelvIn, the AI academic workspace at delvin.study.',
}

export default function TermsPage() {
  return (
    <LegalDocument title="Terms of Service">
      <LegalSection title="Agreement">
        <p>
          These Terms of Service govern your use of DelvIn, the service at delvin.study. By creating an account or using DelvIn, you agree to these terms. If you do not agree, do not use the service.
        </p>
      </LegalSection>
      <LegalSection title="The service">
        <p>
          DelvIn is an AI academic STEM workspace. It gives you a smart whiteboard, step-by-step AI guidance, and the study tools described on the homepage. The plans offered are Free, Pro, and Premium.
        </p>
      </LegalSection>
      <LegalSection title="Accounts">
        <p>
          Some features require an account. You are responsible for activity under your account and for keeping your login details private.
        </p>
      </LegalSection>
      <LegalSection title="Subscriptions and billing">
        <p>
          Free is available at no charge, with the limits shown on the homepage. Pro and Premium are paid subscriptions. Paid plans are billed by Lemon Squeezy, which acts as the Merchant of Record. Refunds for an initial subscription follow the <Link href="/refund" className="text-[#a82e83]">Refund Policy</Link>.
        </p>
      </LegalSection>
      <LegalSection title="Acceptable use">
        <p>
          Use DelvIn for your own study. Do not misuse the service, attempt to disrupt it, or use it in a way that harms other people.
        </p>
      </LegalSection>
      <LegalSection title="Your study material">
        <p>
          You keep your own notes, problems, and other study material. DelvIn uses that material only to provide the workspace to you.
        </p>
      </LegalSection>
      <LegalSection title="Contact">
        <p>
          Questions about these terms: email <ContactLink />.
        </p>
      </LegalSection>
    </LegalDocument>
  )
}
