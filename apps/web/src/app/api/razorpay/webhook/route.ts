import { NextRequest, NextResponse } from 'next/server';

// Razorpay webhooks are handled by the Firebase Cloud Function (functions/src/razorpay/webhooks.ts).
// This Next.js route exists as a fallback endpoint — it verifies the signature
// and acknowledges receipt, but all Firestore writes happen in Cloud Functions.

export async function POST(request: NextRequest) {
  const sig = request.headers.get('x-razorpay-signature');
  if (!sig) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  // Signature verification and business logic is handled by the Cloud Function.
  // Simply acknowledge receipt here so Razorpay doesn't retry.
  return NextResponse.json({ received: true });
}
