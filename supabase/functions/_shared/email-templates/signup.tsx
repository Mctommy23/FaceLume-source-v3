/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Link, Preview, Text,
} from 'npm:@react-email/components@0.0.22'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({ siteName, siteUrl, recipient, confirmationUrl }: SignupEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Verify your email to activate FaceLume</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Welcome to FaceLume</Heading>
        <Text style={text}>
          Thanks for signing up for{' '}
          <Link href={siteUrl} style={link}><strong>{siteName}</strong></Link>. Confirm your email
          ({recipient}) to unlock streaming.
        </Text>
        <Button style={button} href={confirmationUrl}>Verify email</Button>
        <Text style={footer}>If you didn't create an account, you can ignore this email.</Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '560px' }
const h1 = { fontSize: '26px', fontWeight: 'bold' as const, color: '#1a0b2e', margin: '0 0 20px', fontFamily: "'Orbitron', sans-serif" }
const text = { fontSize: '15px', color: '#3a2c4d', lineHeight: '1.6', margin: '0 0 24px' }
const link = { color: '#b829ff', textDecoration: 'underline' }
const button = { backgroundColor: '#b829ff', color: '#ffffff', fontSize: '15px', fontWeight: 600, borderRadius: '14px', padding: '14px 28px', textDecoration: 'none' }
const footer = { fontSize: '12px', color: '#888', margin: '30px 0 0' }
