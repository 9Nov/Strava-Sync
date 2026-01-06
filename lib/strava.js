import axios from 'axios';

const STRAVA_API_URL = 'https://www.strava.com/api/v3';
const STRAVA_OAUTH_URL = 'https://www.strava.com/oauth';

export const getStravaAuthUrl = (state) => {
    const params = new URLSearchParams({
        client_id: process.env.STRAVA_CLIENT_ID,
        redirect_uri: `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/strava`,
        response_type: 'code',
        approval_prompt: 'force',
        scope: 'activity:read_all',
        state: state, // We pass the desired user display name here to link it back after callback
    });

    return `${STRAVA_OAUTH_URL}/authorize?${params.toString()}`;
};

export async function exchangeToken(code) {
    try {
        const response = await axios.post(`${STRAVA_OAUTH_URL}/token`, {
            client_id: process.env.STRAVA_CLIENT_ID,
            client_secret: process.env.STRAVA_CLIENT_SECRET,
            code: code,
            grant_type: 'authorization_code',
        });
        return response.data;
    } catch (error) {
        console.error('Error exchanging token:', error.response?.data || error.message);
        throw error;
    }
}

export async function refreshAccessToken(refreshToken) {
    try {
        const response = await axios.post(`${STRAVA_OAUTH_URL}/token`, {
            client_id: process.env.STRAVA_CLIENT_ID,
            client_secret: process.env.STRAVA_CLIENT_SECRET,
            refresh_token: refreshToken,
            grant_type: 'refresh_token',
        });
        return response.data.access_token;
    } catch (error) {
        console.error('Error refreshing token:', error.response?.data || error.message);
        throw error;
    }
}

export async function fetchActivities(accessToken, afterTimestamp = 0, beforeTimestamp = null) {
    // Strava lists activities. We might want to page through them if there are many.
    // For now, let's fetch the first page (up to 30 items) or use 'after' param.
    try {
        const params = {
            after: afterTimestamp,
            per_page: 50,
        };
        if (beforeTimestamp) {
            params.before = beforeTimestamp;
        }

        const response = await axios.get(`${STRAVA_API_URL}/athlete/activities`, {
            headers: { Authorization: `Bearer ${accessToken}` },
            params: params
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching activities:', error.response?.data || error.message);
        throw error;
    }
}
