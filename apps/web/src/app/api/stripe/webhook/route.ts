import { NextResponse } from 'next/server';

// Stripe is no longer used — payment is handled via Razorpay.
// This file is kept to avoid 404s from any stale webhook configs.
export async function POST() {
  return NextResponse.json({ received: true });
}
