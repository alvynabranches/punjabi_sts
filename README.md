# Speech to Speech

# Software Architecture
- The frontend is developed using Next.js with TypeScript
- The backend is developed using Nest.js with TypeScript

# APIs Used
- Uses Google Speech to Text
- Uses GPT to Convert the Question to Answer (Text to Text)
- Uses Google Text to Speech to give audio output

# .env File
OPENAI_API_KEY=
GOOGLE_APPLICATION_CREDENTIALS="/app/google-cloud.json"
GOOGLE_PROJECT_ID=

- Generate the google-cloud.json using service account and rename the file.

- Need more features to upgrade this application.
