import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'FaceLume'
const APP_URL = 'https://www.getfacelume.com'

interface Props { credits?: number }

const LowCreditsEmail = ({ credits }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You're running low on {SITE_NAME} credits.</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Credits running low</Heading>
        <Text style={text}>
          {credits !== undefined
            ? `You have ${credits} credits left on ${SITE_NAME}.`
            : `Your ${SITE_NAME} credits are running low.`}
          {' '}Top up now to avoid interrupted streams.
        </Text>
        <Section style={{ textAlign: 'center', margin: '32px 0' }}>
          <Button href={`${APP_URL}/credits`} style={button}>Top up credits</Button>
        </Section>
        <Text style={footer}>You'll get this reminder once when your balance dips below the warning threshold.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: LowCreditsEmail,
  subject: `Your ${SITE_NAME} credits are running low`,
  displayName: 'Low credits warning',
  previewData: { credits: 250 },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px' }
const h1 = { fontSize: '26px', fontWeight: 'bold', color: '#1a0b2e', margin: '0 0 20px', fontFamily: 'Orbitron, sans-serif' }
const text = { fontSize: '15px', color: '#3a2c4d', lineHeight: '1.6', margin: '0 0 16px' }
const button = { backgroundColor: '#b829ff', color: '#ffffff', padding: '14px 28px', borderRadius: '12px', textDecoration: 'none', fontWeight: 600, fontSize: '15px' }
const footer = { fontSize: '12px', color: '#888', margin: '24px 0 0' }
