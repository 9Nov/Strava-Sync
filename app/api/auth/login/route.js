import { getStravaAuthUrl } from '@/lib/strava';
import { NextResponse } from 'next/server';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name'); // The display name user entered

    if (!name) {
        return NextResponse.redirect(new URL('/?error=missing_name', request.url));
    }

    // Generate the Strava OAuth URL with the name as state
    const url = getStravaAuthUrl(name);

    return NextResponse.redirect(url);
}
