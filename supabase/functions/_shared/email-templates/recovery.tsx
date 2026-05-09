/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Text,
} from 'npm:@react-email/components@0.0.22'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({ siteName, confirmationUrl }: RecoveryEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Reset your {siteName} password</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Reset your password</Heading>
        <Text style={text}>
          We received a request to reset your password for {siteName}. Click below to choose a new one.
        </Text>
        <Button style={button} href={confirmationUrl}>Reset password</Button>
        <Text style={footer}>
          If you didn't request a reset, you can ignore this email — your password won't change.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '560px' }
const h1 = { fontSize: '26px', fontWeight: 'bold' as const, color: '#1a0b2e', margin: '0 0 20px', fontFamily: "'Orbitron', sans-serif" }
const text = { fontSize: '15px', color: '#3a2c4d', lineHeight: '1.6', margin: '0 0 24px' }
const button = { backgroundColor: '#b829ff', color: '#ffffff', fontSize: '15px', fontWeight: 600, borderRadius: '14px', padding: '14px 28px', textDecoration: 'none' }
const footer = { fontSize: '12px', color: '#888', margin: '30px 0 0' }
