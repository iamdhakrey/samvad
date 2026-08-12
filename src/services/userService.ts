import { AUTH0_DOMAIN } from "../hooks/useAuth0Desktop";
import { User } from "../store/authStore";


export async function fetchUserInfo(accessToken: string): Promise<User> {
    try {
        const response = await fetch(`https://${AUTH0_DOMAIN}/userinfo`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch user info: ${response.statusText}`);
        }

        const user: User = await response.json();
        return user;
    } catch (err) {
        console.error('Error fetching user info:', err);
        throw err;
    }
}

export async function logout(accessToken: string): Promise<void> {
    try {
        // Revoke the access token at Auth0
        const response = await fetch(`https://${AUTH0_DOMAIN}/oauth/revoke`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                client_id: 'dasdasdasdsdm5Wf87ZSQP',
                token: accessToken,
            }),
        });

        if (!response.ok) {
            console.warn('Failed to revoke token at Auth0');
        }
    } catch (err) {
        console.error('Error revoking token:', err);
    }
}

export function parseJwt(token: string): any {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
            atob(base64)
                .split('')
                .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
        );
        return JSON.parse(jsonPayload);
    } catch (err) {
        console.error('Failed to parse JWT:', err);
        return null;
    }
}
