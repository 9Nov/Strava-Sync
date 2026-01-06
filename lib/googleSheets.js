import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

export async function getSheetsClient() {
    const auth = new google.auth.GoogleAuth({
        credentials: {
            client_email: process.env.GOOGLE_CLIENT_EMAIL,
            private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        },
        scopes: SCOPES,
    });

    return google.sheets({ version: 'v4', auth });
}

export const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
export const METADATA_SHEET_TITLE = '_Metadata';

/**
 * Initializes the Spreadsheet with the Metadata sheet if it doesn't exist.
 */
export async function initSpreadsheet() {
    const sheets = await getSheetsClient();
    try {
        const response = await sheets.spreadsheets.get({
            spreadsheetId: SPREADSHEET_ID,
        });

        const sheetTitles = response.data.sheets?.map(s => s.properties?.title) || [];
        if (!sheetTitles.includes(METADATA_SHEET_TITLE)) {
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId: SPREADSHEET_ID,
                requestBody: {
                    requests: [
                        {
                            addSheet: {
                                properties: {
                                    title: METADATA_SHEET_TITLE,
                                },
                            },
                        },
                    ],
                },
            });
            // Add headers
            await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: `${METADATA_SHEET_TITLE}!A1:C1`,
                valueInputOption: 'RAW',
                requestBody: {
                    values: [['Display Name', 'Strava ID', 'RefreshToken']],
                },
            });
        }
    } catch (error) {
        console.error('Error initializing spreadsheet:', error);
        throw error;
    }
}

export async function getUsers() {
    const sheets = await getSheetsClient();
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${METADATA_SHEET_TITLE}!A2:C`,
        });
        const rows = response.data.values || [];
        return rows.map(row => ({
            displayName: row[0],
            stravaId: row[1],
            refreshToken: row[2],
        }));
    } catch (error) {
        console.error('Error fetching users:', error);
        return [];
    }
}

const HEADERS = [
    'Activity ID', 'Name', 'Type', 'Distance (km)', 'Time (min)', 'Date',
    'Description', 'Elevation Gain (m)', 'Avg Speed (km/h)', 'Max Speed (km/h)',
    'Avg HR (bpm)', 'Max HR (bpm)', 'Avg Cadence', 'Avg Watts', 'Max Watts',
    'Suffer Score', 'Kilojoules'
];

export async function addUser(displayName, stravaId, refreshToken) {
    const sheets = await getSheetsClient();

    // 1. Check if user already exists in Metadata, if so update token
    const users = await getUsers();
    const existingUserIndex = users.findIndex(u => u.displayName === displayName);

    if (existingUserIndex >= 0) {
        // Update the refresh token for the existing user
        // Row is index + 2 (header + 1-based)
        const range = `${METADATA_SHEET_TITLE}!C${existingUserIndex + 2}`;
        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: range,
            valueInputOption: 'RAW',
            requestBody: {
                values: [[refreshToken]]
            }
        });
        // We assume the sheet for this user already exists.
        return true;
    }

    // 2. Create a new Sheet for the user
    try {
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            requestBody: {
                requests: [{
                    addSheet: {
                        properties: {
                            title: displayName, // Sheet name = User name
                        }
                    }
                }]
            }
        });

        // 3. Add Headers to new sheet
        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${displayName}!A1:Q1`, // A to Q
            valueInputOption: 'RAW',
            requestBody: {
                values: [HEADERS]
            }
        });
    } catch (error) {
        // If sheet already exists but user wasn't in metadata (weird case), ignore error
        if (!error.message.includes('already exists')) {
            throw error;
        }
    }

    // 4. Save metadata (New User)
    await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${METADATA_SHEET_TITLE}!A:C`,
        valueInputOption: 'RAW',
        requestBody: {
            values: [[displayName, stravaId, refreshToken]]
        }
    });

    return true;
}

export async function updateSheetHeaders(displayName) {
    const sheets = await getSheetsClient();
    try {
        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${displayName}!A1:Q1`,
            valueInputOption: 'RAW',
            requestBody: {
                values: [HEADERS]
            }
        });
    } catch (error) {
        console.error(`Failed to update headers for ${displayName}`, error);
    }
}

export async function getActivityIds(sheetTitle) {
    const sheets = await getSheetsClient();
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetTitle}!A2:A`, // Activity ID is in Column A
        });
        const rows = response.data.values || [];
        // Flatten and return as Set for O(1) lookups
        return new Set(rows.map(row => row[0]));
    } catch (error) {
        return new Set();
    }
}

export async function getLatestActivityDate(sheetTitle) {
    const sheets = await getSheetsClient();
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetTitle}!A2:F`, // Get all data
        });
        const rows = response.data.values || [];
        if (rows.length === 0) return null;

        // Assuming Date is in Column F (index 5)
        // We need to find the latest date. 
        // If we append sequentially, the last row is the latest.
        const lastRow = rows[rows.length - 1];
        return lastRow[5]; // Date string
    } catch (error) {
        return null; // Sheet empty or error
    }
}

export async function appendActivities(sheetTitle, activities) {
    const sheets = await getSheetsClient();
    if (activities.length === 0) return;

    // Convert activities to rows
    const rows = activities.map(a => [
        a.id.toString(),
        a.name,
        a.type,
        (a.distance / 1000).toFixed(2), // meters to km
        (a.moving_time / 60).toFixed(2), // seconds to minutes
        a.start_date_local, // ISO string
        a.description || '', // Description
        a.total_elevation_gain || 0, // Elevation (m)
        (a.average_speed * 3.6).toFixed(1), // m/s to km/h
        (a.max_speed * 3.6).toFixed(1), // m/s to km/h
        a.average_heartrate || '',
        a.max_heartrate || '',
        a.average_cadence || '',
        a.average_watts || '',
        a.max_watts || '',
        a.suffer_score || '',
        a.kilojoules || ''
    ]);

    await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetTitle}!A:Q`,
        valueInputOption: 'RAW',
        requestBody: {
            values: rows
        }
    });
}
