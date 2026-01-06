import { exchangeToken } from '@/lib/strava';
import { addUser, initSpreadsheet } from '@/lib/googleSheets';
import { NextResponse } from 'next/server';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state'); // We stored "DisplayName" here
    const error = searchParams.get('error');

    if (error || !code) {
        return NextResponse.redirect(new URL('/?error=auth_failed', request.url));
    }

    try {
        // 1. Exchange code for tokens
        const data = await exchangeToken(code);
        const { access_token, refresh_token, athlete } = data;

        // 2. Add user to Google Sheet
        // Use the Display Name provided in state, or fallback to Strava Name if state is missing
        const displayName = state || `${athlete.firstname} ${athlete.lastname}`;

        // Ensure Spreadsheet is initialized
        await initSpreadsheet();

        await addUser(displayName, athlete.id, refresh_token);

        return NextResponse.redirect(new URL(`/?success=user_added&name=${encodeURIComponent(displayName)}`, request.url));
    } catch (err) {
        console.error('Auth Callback Error:', err);
        return NextResponse.redirect(new URL('/?error=server_error', request.url));
    }
}
