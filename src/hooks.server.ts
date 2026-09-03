import type { Handle } from '@sveltejs/kit';

const handleAuth: Handle = async ({ event, resolve }) => {
	event.locals.user = null;
	event.locals.session = null;

	try {
		const auth = await import('$lib/server/auth');
		const sessionToken = event.cookies.get(auth.sessionCookieName);
		if (!sessionToken) return resolve(event);

		const { session, user } = await auth.validateSessionToken(sessionToken);
		if (session) {
			auth.setSessionTokenCookie(event, sessionToken, session.expiresAt);
			event.locals.user = user;
			event.locals.session = session;
		} else {
			auth.deleteSessionTokenCookie(event);
		}
	} catch {
		// sqlite native module / uninit DB — GPU ops and prerendered pages still work
	}

	return resolve(event);
};

export const handle: Handle = handleAuth;
