import type { Metadata } from 'next'
import { ContactLink, LegalDocument, LegalSection } from '@/components/legal-document'

export const metadata: Metadata = {
  title: 'Privacy Policy — DelvIn',
  description: 'Privacy Policy for DelvIn. We collect only the data needed to run the product, and we do not sell it.',
}

export default function PrivacyPage() {
  return (
    <LegalDocument title="Privacy Policy">
      <LegalSection title="Who we are">
        <p>
          This policy describes how DelvIn, the service at delvin.study, handles personal data. Questions about privacy: email <ContactLink />.
        </p>
      </LegalSection>
      <LegalSection title="Data we collect">
        <p>
          DelvIn collects only the data needed to run your account and the product. That includes the account details you give us, such as your email address, and the study activity required to provide the workspace.
        </p>
      </LegalSection>
      <LegalSection title="We do not sell personal data">
        <p>
          DelvIn does not sell your personal data.
        </p>
      </LegalSection>
      <LegalSection title="How we use data">
        <p>
          We use the data we collect to operate DelvIn, keep your account working, and reply when you contact us. We do not use it for an unrelated purpose.
        </p>
      </LegalSection>
      <LegalSection title="Payments">
        <p>
          Payments for Pro and Premium are handled by Lemon Squeezy, our Merchant of Record. DelvIn does not store full card numbers.
        </p>
      </LegalSection>
      <LegalSection title="Contact">
        <p>
          Privacy questions: email <ContactLink />.
        </p>
      </LegalSection>
    </LegalDocument>
  )
}
