import {prisma} from "../../index.js";

const RETROFIT_SERVER_ADMINS = async () => {
    console.log('RETROFITTING SERVER ADMINS')

    // the user IDs of the users to make admin
    const userIds = ['771849d5-5701-452a-b4ae-a67ddfe92fe3'];
    // the server IDs of the servers they should be admins of
    const serverIds = [1,2,7];

    for (let serverId of serverIds) {
        let role;

        // check if an Admin role for the server already exists
        role = await prisma.role.findFirst({
            where: {
                name: 'Admin',
                serverId: parseInt(serverId),
            },
        });

        // if no Admin role exists for this server, create it
        if (!role) {
            role = await prisma.role.create({
                data: {
                    name: 'Admin',
                    description: 'Administrator role with full permissions',
                    serverId: parseInt(serverId),
                },
            });
        }

        for (let userId of userIds) {

            // Find the server member
            const serverMember = await prisma.server_member.findUnique({
                where: {
                    userId_serverId: {
                        userId: userId,
                        serverId: parseInt(serverId)
                    },
                },
            });

            // If server member is not found, create one
            let server_member_user_id;
            let server_member_server_id;
            if (!serverMember) {
                const createdServerMember = await prisma.server_member.create({
                    data: {
                        userId: userId,
                        serverId: serverId
                    }
                });
                server_member_user_id = createdServerMember.userId;
                server_member_server_id = createdServerMember.serverId;
            } else {
                server_member_user_id = serverMember.userId;
                server_member_server_id = serverMember.serverId;
            }

            // check if the user is already an Admin
            const isAdmin = await prisma.userToRoles.findFirst({
                where: {
                    userId: userId,
                    roleId: role.id,
                },
            });

            // if the user is not an Admin, assign them the Admin role
            if (!isAdmin) {
                await prisma.userToRoles.create({
                    data: {
                        userId: userId,
                        roleId: role.id,
                        server_member_user_id,
                        server_member_server_id,
                    },
                });
            }
        }
    }

    console.log("Successfully assigned Admin roles");

}

RETROFIT_SERVER_ADMINS()
    .then(res => console.log('COMPLETE'))
    .catch(err => console.log('nah: ', err))