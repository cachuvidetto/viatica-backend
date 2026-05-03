// backend/scripts/get_invite_link.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const invitations = await prisma.invitation.findMany({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
        take: 5
    });

    console.log('\n--- Pending Invitations ---');
    if (invitations.length === 0) {
        console.log('No pending invitations found.');
    } else {
        invitations.forEach(invite => {
            console.log(`Email: ${invite.email}`);
            console.log(`Link: http://localhost:3000/accept-invite?token=${invite.token}`);
            console.log('---------------------------');
        });
    }
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
