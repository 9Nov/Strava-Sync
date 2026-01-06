import { getUsers, getLatestActivityDate, appendActivities, getActivityIds, updateSheetHeaders } from '@/lib/googleSheets';
import { refreshAccessToken, fetchActivities } from '@/lib/strava';
import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        const { displayName, startDate, endDate } = await request.json();

        if (!displayName) {
            return NextResponse.json({ error: 'Display Name is required' }, { status: 400 });
        }

        // 1. Get User Config
        const users = await getUsers();
        const user = users.find(u => u.displayName === displayName);

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // 2. Refresh Token
        const accessToken = await refreshAccessToken(user.refreshToken);

        // 3. Determine fetch window
        // Strava 'after' parameter is epoch timestamp
        let afterTimestamp = 0;
        let beforeTimestamp = null;

        if (startDate) {
            // User provided custom range
            afterTimestamp = Math.floor(new Date(startDate).getTime() / 1000);
            if (endDate) {
                // End date is inclusive likely, let's make sure it covers the day or exact time
                // Assuming user picks date, we might want end of day? 
                // For simplicity, we trust the input ISO string or midnight.
                beforeTimestamp = Math.floor(new Date(endDate).getTime() / 1000) + 86400; // Add 1 day to be inclusive if just date
            }
        } else {
            // Default: Sync from last activity
            const lastDateIso = await getLatestActivityDate(displayName);
            if (lastDateIso) {
                afterTimestamp = Math.floor(new Date(lastDateIso).getTime() / 1000);
            }
        }

        // 4. Fetch from Strava
        let activities = await fetchActivities(accessToken, afterTimestamp, beforeTimestamp);

        // Sort by date ascending to ensure we append in order
        activities = activities.sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

        // 4.5 Filter Duplicates
        // Get existing IDs
        const existingIds = await getActivityIds(displayName);
        const newActivities = activities.filter(a => !existingIds.has(a.id.toString()));

        // 5. Append to Sheet
        if (newActivities.length > 0 || activities.length > 0) {
            // Always update headers just in case it's an old sheet
            await updateSheetHeaders(displayName);
            if (newActivities.length > 0) {
                await appendActivities(displayName, newActivities);
            }
        }

        return NextResponse.json({
            success: true,
            count: newActivities.length,
            message: `Synced ${newActivities.length} new activities.`
        });

    } catch (error) {
        console.error('Sync Error:', error);
        return NextResponse.json({ error: 'Failed to sync data' }, { status: 500 });
    }
}
