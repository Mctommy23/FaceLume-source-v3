/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text,
} from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your FaceLume verification code</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Confirm reauthentication</Heading>
        <Text style={text}>Use the code below to confirm your identity:</Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={footer}>This code expires shortly. If you didn't request it, ignore this email.</Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '560px' }
const h1 = { fontSize: '26px', fontWeight: 'bold' as const, color: '#1a0b2e', margin: '0 0 20px', fontFamily: "'Orbitron', sans-serif" }
const text = { fontSize: '15px', color: '#3a2c4d', lineHeight: '1.6', margin: '0 0 24px' }
const codeStyle = { fontFamily: 'monospace', fontSize: '28px', fontWeight: 'bold' as const, color: '#b829ff', letterSpacing: '0.2em', margin: '0 0 30px', padding: '16px 20px', backgroundColor: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: '12px', textAlign: 'center' as const }
const footer = { fontSize: '12px', color: '#888', margin: '30px 0 0' }
