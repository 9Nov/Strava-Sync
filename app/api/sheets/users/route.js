import { getUsers, initSpreadsheet } from '@/lib/googleSheets';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        await initSpreadsheet();
        const users = await getUsers();
        return NextResponse.json({ users });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }
}
