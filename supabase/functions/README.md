# Supabase Edge Functions

This directory contains Edge Functions for the dIKtate website backend.

## Functions

### gemini-proxy

A proxy service for the Google Gemini API that handles:
- User authentication and trial credit verification
- Request forwarding to Gemini API
- Usage tracking and quota enforcement
- Support for custom API keys

## Deployment

### Prerequisites

1. Install Supabase CLI:
   ```bash
   npm install -g supabase
   ```

2. Login to Supabase:
   ```bash
   supabase login
   ```

3. Link to your project:
   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   ```

### Deploy Edge Functions

Deploy the gemini-proxy function:

```bash
supabase functions deploy gemini-proxy
```

### Set Environment Variables

Set the required environment variables for your Edge Function:

```bash
# Set the managed Gemini API key (for trial credits)
supabase secrets set GEMINI_API_KEY=your_gemini_api_key_here

# Verify secrets are set
supabase secrets list
```

### Test Locally

Run functions locally for testing:

```bash
# Start local Supabase
supabase start

# Serve the function locally
supabase functions serve gemini-proxy

# Test with curl
curl -i --location --request POST 'http://localhost:54321/functions/v1/gemini-proxy' \
  --header 'Authorization: Bearer YOUR_JWT_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{
    "model": "gemini-2.0-flash-001",
    "contents": [
      {
        "role": "user",
        "parts": [{"text": "Hello, world!"}]
      }
    ]
  }'
```

## Environment Variables

### Required for gemini-proxy

- `GEMINI_API_KEY` - Google Gemini API key for managed trial credits
- `SUPABASE_URL` - Automatically provided by Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - Automatically provided by Supabase

## Usage from Desktop App

### Authentication

The desktop app must include a valid JWT token in the Authorization header:

```typescript
const token = await supabase.auth.getSession().session?.access_token;

const response = await fetch('https://YOUR_PROJECT_REF.supabase.co/functions/v1/gemini-proxy', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'gemini-2.0-flash-001',
    contents: [
      {
        role: 'user',
        parts: [{ text: 'Your prompt here' }],
      },
    ],
  }),
});
```

### Error Handling

The function returns the following status codes:

- `200` - Success
- `401` - Unauthorized (missing or invalid token)
- `403` - Trial quota exceeded
- `404` - Profile not found
- `500` - Internal server error

### Response Format

Success response matches Gemini API format:

```json
{
  "candidates": [
    {
      "content": {
        "parts": [
          {
            "text": "Response text here"
          }
        ]
      }
    }
  ],
  "usageMetadata": {
    "totalTokenCount": 123
  }
}
```

Error response:

```json
{
  "error": "Error message",
  "wordsUsed": 1000,
  "wordsQuota": 15000
}
```

## Development

### File Structure

```
supabase/functions/
├── gemini-proxy/
│   ├── index.ts       # Main function code
│   └── deno.json      # Deno configuration
└── README.md          # This file
```

### Logs

View function logs in Supabase Dashboard or via CLI:

```bash
supabase functions logs gemini-proxy
```

### Testing

Test the function with different scenarios:

1. **Valid request with trial credits:**
   - Should proxy to Gemini API
   - Should record usage
   - Should return Gemini response

2. **Request with custom API key:**
   - Should use custom key
   - Should not enforce quota
   - Should still record usage

3. **Request with exceeded quota:**
   - Should return 403 error
   - Should not call Gemini API

4. **Request without authentication:**
   - Should return 401 error

## Troubleshooting

### Function not deploying

- Verify you're linked to the correct project: `supabase projects list`
- Check for syntax errors: `deno check supabase/functions/gemini-proxy/index.ts`

### Function returning 500

- Check function logs: `supabase functions logs gemini-proxy`
- Verify environment variables are set: `supabase secrets list`

### Quota not enforcing

- Verify RLS policies on `profiles` and `api_usage` tables
- Check that `update_budget` function exists in database
- Verify user's profile exists

## Security

- JWT tokens are verified by Supabase auth
- RLS policies enforce data access controls
- Custom API keys are encrypted at rest
- Service role key is only accessible to Edge Functions
- All requests are rate-limited by Supabase

## Cost Management

The function tracks usage to manage costs:

- Trial users: Limited to 15,000 words OR 15 days
- Custom key users: No limits, use own API key
- All usage recorded in `api_usage` table
- Budget tracked in `budget_tracker` table

## Support

For issues with Edge Functions:
1. Check function logs
2. Verify environment variables
3. Test locally first
4. Check Supabase Dashboard for errors
5. Review database RLS policies
