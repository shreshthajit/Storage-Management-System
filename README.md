# Storage-Management-System

## Base URL:
```
http://localhost:8888
```

## Google Sign In
```
1. Paste this link into the browser (http://localhost:8888/auth/google)
2. Do signin with your email
3. Now after successfully Signin we will get a token in the response

```
## .env file should have the following
```
ENCRYPTION_KEY=
JWT_SECRET=
JWT_REFRESH=
JWT_EXPIRES_IN=
SENDER_EMAIL=
SENDER_PW=
MONGO_URI=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=
```

## Run project Command:
```
yarn install
nodemon index.js
```
