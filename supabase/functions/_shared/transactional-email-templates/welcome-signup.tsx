import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'FaceLume'
const APP_URL = 'https://www.getfacelume.com'

interface Props { name?: string }

const WelcomeEmail = ({ name }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Welcome to {SITE_NAME} — let's get you streaming.</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Welcome{name ? `, ${name}` : ''}!</Heading>
        <Text style={text}>
          Thanks for joining {SITE_NAME}. You're one step away from real-time AI face transformations on your live streams.
        </Text>
        <Text style={text}>
          Next up: activate your account to unlock streaming and receive your starter credits.
        </Text>
        <Section style={{ textAlign: 'center', margin: '32px 0' }}>
          <Button href={`${APP_URL}/activate`} style={button}>Activate your account</Button>
        </Section>
        <Text style={footer}>— The {SITE_NAME} team</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: WelcomeEmail,
  subject: `Welcome to ${SITE_NAME}`,
  displayName: 'Welcome / signup',
  previewData: { name: 'Alex' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px' }
const h1 = { fontSize: '26px', fontWeight: 'bold', color: '#1a0b2e', margin: '0 0 20px', fontFamily: 'Orbitron, sans-serif' }
const text = { fontSize: '15px', color: '#3a2c4d', lineHeight: '1.6', margin: '0 0 16px' }
const button = { backgroundColor: '#b829ff', color: '#ffffff', padding: '14px 28px', borderRadius: '12px', textDecoration: 'none', fontWeight: 600, fontSize: '15px' }
const footer = { fontSize: '13px', color: '#888', margin: '32px 0 0' }
