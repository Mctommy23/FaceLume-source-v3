/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Text,
} from 'npm:@react-email/components@0.0.22'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({ siteName, confirmationUrl }: MagicLinkEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your {siteName} login link</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Your login link</Heading>
        <Text style={text}>
          Click below to log in to {siteName}. This link expires shortly.
        </Text>
        <Button style={button} href={confirmationUrl}>Log in</Button>
        <Text style={footer}>If you didn't request this, you can ignore this email.</Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '560px' }
const h1 = { fontSize: '26px', fontWeight: 'bold' as const, color: '#1a0b2e', margin: '0 0 20px', fontFamily: "'Orbitron', sans-serif" }
const text = { fontSize: '15px', color: '#3a2c4d', lineHeight: '1.6', margin: '0 0 24px' }
const button = { backgroundColor: '#b829ff', color: '#ffffff', fontSize: '15px', fontWeight: 600, borderRadius: '14px', padding: '14px 28px', textDecoration: 'none' }
const footer = { fontSize: '12px', color: '#888', margin: '30px 0 0' }
