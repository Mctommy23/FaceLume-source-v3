import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Row, Column, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'FaceLume'
const APP_URL = 'https://www.getfacelume.com'

interface Props {
  credits?: number
  amountUsd?: number
  orderId?: string
}

const ReceiptEmail = ({ credits, amountUsd, orderId }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Receipt for your {SITE_NAME} credits purchase.</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Payment received</Heading>
        <Text style={text}>
          Thanks for your purchase. Your credits have been added to your {SITE_NAME} account.
        </Text>
        <Section style={box}>
          <Row><Column style={lbl}>Credits</Column><Column style={val}>{credits ?? '—'}</Column></Row>
          <Hr style={hr} />
          <Row><Column style={lbl}>Amount</Column><Column style={val}>${amountUsd?.toFixed(2) ?? '—'} USD</Column></Row>
          {orderId && (<><Hr style={hr} /><Row><Column style={lbl}>Order ID</Column><Column style={{ ...val, fontFamily: 'monospace', fontSize: '12px' }}>{orderId}</Column></Row></>)}
        </Section>
        <Section style={{ textAlign: 'center', margin: '32px 0' }}>
          <Button href={`${APP_URL}/dashboard`} style={button}>View your dashboard</Button>
        </Section>
        <Text style={footer}>Keep this email as your receipt.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ReceiptEmail,
  subject: (d) => `Receipt: ${d.credits ?? ''} ${SITE_NAME} credits`.trim(),
  displayName: 'Credit purchase receipt',
  previewData: { credits: 5000, amountUsd: 25, orderId: 'topup_abc123' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px' }
const h1 = { fontSize: '26px', fontWeight: 'bold', color: '#1a0b2e', margin: '0 0 20px', fontFamily: 'Orbitron, sans-serif' }
const text = { fontSize: '15px', color: '#3a2c4d', lineHeight: '1.6', margin: '0 0 16px' }
const box = { backgroundColor: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: '12px', padding: '8px 20px', margin: '20px 0' }
const lbl = { fontSize: '13px', color: '#6b5b80', padding: '12px 0' }
const val = { fontSize: '14px', color: '#1a0b2e', fontWeight: 600, textAlign: 'right' as const, padding: '12px 0' }
const hr = { borderColor: '#e9d5ff', margin: 0 }
const button = { backgroundColor: '#b829ff', color: '#ffffff', padding: '14px 28px', borderRadius: '12px', textDecoration: 'none', fontWeight: 600, fontSize: '15px' }
const footer = { fontSize: '12px', color: '#888', margin: '24px 0 0' }
