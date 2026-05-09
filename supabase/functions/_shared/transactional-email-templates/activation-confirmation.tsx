import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'FaceLume'
const APP_URL = 'https://www.getfacelume.com'

interface Props { licenseKey?: string; credits?: number }

const ActivationEmail = ({ licenseKey, credits }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your {SITE_NAME} account is activated.</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>You're activated</Heading>
        <Text style={text}>
          Your {SITE_NAME} account is unlocked and ready to stream{credits ? ` with ${credits} starter credits` : ''}.
        </Text>
        {licenseKey && (
          <Section style={keyBox}>
            <Text style={keyLabel}>YOUR LICENSE KEY</Text>
            <Text style={keyValue}>{licenseKey}</Text>
          </Section>
        )}
        <Section style={{ textAlign: 'center', margin: '32px 0' }}>
          <Button href={`${APP_URL}/app`} style={button}>Open the studio</Button>
        </Section>
        <Text style={footer}>Keep your license key safe — you'll need it to activate the desktop app.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ActivationEmail,
  subject: `Your ${SITE_NAME} account is activated`,
  displayName: 'Activation confirmation',
  previewData: { licenseKey: 'FL-XXXX-XXXX-XXXX-XXXX', credits: 1200 },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px' }
const h1 = { fontSize: '26px', fontWeight: 'bold', color: '#1a0b2e', margin: '0 0 20px', fontFamily: 'Orbitron, sans-serif' }
const text = { fontSize: '15px', color: '#3a2c4d', lineHeight: '1.6', margin: '0 0 16px' }
const keyBox = { backgroundColor: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: '12px', padding: '16px 20px', margin: '20px 0' }
const keyLabel = { fontSize: '11px', letterSpacing: '0.1em', color: '#7c3aed', margin: '0 0 6px', fontWeight: 600 }
const keyValue = { fontFamily: 'monospace', fontSize: '14px', color: '#1a0b2e', margin: 0, wordBreak: 'break-all' as const }
const button = { backgroundColor: '#b829ff', color: '#ffffff', padding: '14px 28px', borderRadius: '12px', textDecoration: 'none', fontWeight: 600, fontSize: '15px' }
const footer = { fontSize: '12px', color: '#888', margin: '24px 0 0' }
