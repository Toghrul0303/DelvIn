import type { Metadata } from 'next'
import { ContactLink, LegalDocument, LegalSection } from '@/components/legal-document'

export const metadata: Metadata = {
  title: 'Refund Policy — DelvIn',
  description: 'Refund Policy for DelvIn at delvin.study. Initial subscriptions include a 7-day refund window.',
}

export default function RefundPage() {
  return (
    <LegalDocument title="Refund Policy">
      <LegalSection title="This policy">
        <p>
          This Refund Policy applies to DelvIn, the service at delvin.study.
        </p>
      </LegalSection>
      <LegalSection title="7-day window">
        <p>
          You may request a refund within 7 days of your initial subscription purchase. This window applies to the first purchase of a paid DelvIn subscription.
        </p>
      </LegalSection>
      <LegalSection title="How to request a refund">
        <p>
          Email <ContactLink /> within those 7 days. Include the email on your DelvIn account and the date of the purchase. If the request meets this policy, the refund is issued for that initial subscription charge.
        </p>
      </LegalSection>
      <LegalSection title="Renewals">
        <p>
          Later renewal charges are outside that initial-subscription window. The 7-day refund does not apply to renewal charges.
        </p>
      </LegalSection>
      <LegalSection title="Contact">
        <p>
          Refund questions: email <ContactLink />.
        </p>
      </LegalSection>
    </LegalDocument>
  )
}
