# Auth-Gated App Testing Playbook (Community / Emergent Google Auth)

This playbook is used by the testing agent to validate the community auth flow
(cookie-based, Emergent Google OAuth).

## Collections
- `users` (unified profile — extended with `auth_providers`, `picture`, etc.)
- `user_sessions` (community cookie sessions)

## Step 1: Create Test User & Session
```
mongosh --eval "
use('test_database');
var userId = 'user_test' + Date.now();
var sessionToken = 'test_session_' + Date.now();
db.users.insertOne({
  id: userId,
  email: 'test.user.' + Date.now() + '@example.com',
  name: 'Test Member',
  role: 'member',
  picture: 'https://via.placeholder.com/150',
  auth_providers: [{ provider: 'google', provider_user_id: 'g_test_' + Date.now(), linked_at: new Date().toISOString() }],
  created_at: new Date().toISOString()
});
db.user_sessions.insertOne({
  user_id: userId,
  session_token: sessionToken,
  provider: 'google',
  expires_at: new Date(Date.now() + 7*24*60*60*1000).toISOString(),
  created_at: new Date().toISOString()
});
print('Session token: ' + sessionToken);
print('User ID: ' + userId);
"
```

## Step 2: Test Backend API
```
API=$REACT_APP_BACKEND_URL

# Cookie-based
curl -X GET "$API/api/community/auth/me" \
  --cookie "session_token=YOUR_SESSION_TOKEN"

# Bearer fallback
curl -X GET "$API/api/community/auth/me" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"

# Providers listing
curl -X GET "$API/api/community/auth/providers"

# Logout
curl -X POST "$API/api/community/auth/logout" \
  --cookie "session_token=YOUR_SESSION_TOKEN"
```

## Step 3: Browser Testing (Playwright)
```
await page.context.add_cookies([{
    "name": "session_token",
    "value": "YOUR_SESSION_TOKEN",
    "domain": "future-core-5.preview.emergentagent.com",
    "path": "/",
    "httpOnly": True,
    "secure": True,
    "sameSite": "None"
}])
await page.goto(f"{APP_URL}/")
# Header should show avatar + name from data-testid="header-profile-name"
# /join page should redirect to / when authenticated
```

## Success Indicators
- ✅ /api/community/auth/me returns user JSON with `id`, `email`, `name`, `picture`, `role`
- ✅ Header shows avatar + name when authenticated
- ✅ Redirect from /join to / when authenticated
- ✅ /api/community/auth/providers returns Google as enabled

## Failure Indicators
- ❌ 401 Unauthorized on /api/community/auth/me (session or cookie mismatch)
- ❌ /join redirect loop
- ❌ Missing httpOnly cookie after callback

## Notes
- Do NOT hardcode any redirect URL; the frontend uses `window.location.origin + '/'`.
- `session_id` in URL fragment is one-time; consumed by `/api/community/auth/session`.
- Multi-provider is architected but only `google` is enabled today.
